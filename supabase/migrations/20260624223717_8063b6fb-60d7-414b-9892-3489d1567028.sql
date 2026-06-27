
-- Ensure pgcrypto extension is available for gen_random_bytes
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =========================================================
-- Waiting list: claim token + auto-fill on cancellation
-- =========================================================
ALTER TABLE public.waiting_list
  ADD COLUMN IF NOT EXISTS claim_token TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS offered_starts_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS waiting_list_claim_token_idx ON public.waiting_list(claim_token);
CREATE INDEX IF NOT EXISTS waiting_list_service_idx ON public.waiting_list(tenant_id, service_id, status);

-- Public: join waitlist (anonymous customer)
CREATE OR REPLACE FUNCTION public.public_join_waitlist(
  _tenant_id UUID, _service_id UUID, _staff_id UUID,
  _customer_name TEXT, _customer_email TEXT, _customer_phone TEXT,
  _desired_from TIMESTAMPTZ, _desired_to TIMESTAMPTZ, _notes TEXT
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE new_id UUID;
BEGIN
  IF _customer_name IS NULL OR length(trim(_customer_name)) < 2 THEN RAISE EXCEPTION 'invalid_name'; END IF;
  IF _customer_email IS NULL AND _customer_phone IS NULL THEN RAISE EXCEPTION 'contact_required'; END IF;
  PERFORM 1 FROM public.services WHERE id = _service_id AND tenant_id = _tenant_id AND active = TRUE;
  IF NOT FOUND THEN RAISE EXCEPTION 'invalid_service'; END IF;

  INSERT INTO public.waiting_list (tenant_id, service_id, staff_id, customer_name, customer_email, customer_phone,
    desired_from, desired_to, notes, status)
  VALUES (_tenant_id, _service_id, _staff_id, trim(_customer_name),
    lower(nullif(trim(_customer_email),'')), nullif(trim(_customer_phone),''),
    _desired_from, _desired_to, _notes, 'waiting')
  RETURNING id INTO new_id;
  RETURN jsonb_build_object('id', new_id);
END $$;

-- Public: look up a waitlist offer by token
CREATE OR REPLACE FUNCTION public.public_get_waitlist_offer(_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE w RECORD; t RECORD; s RECORD;
BEGIN
  SELECT * INTO w FROM public.waiting_list WHERE claim_token = _token LIMIT 1;
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT name, slug, brand_color, logo_url, timezone INTO t FROM public.tenants WHERE id = w.tenant_id;
  SELECT name, duration_minutes, price_cents, currency INTO s FROM public.services WHERE id = w.service_id;
  RETURN jsonb_build_object(
    'id', w.id, 'status', w.status, 'expires_at', w.expires_at,
    'offered_starts_at', w.offered_starts_at, 'customer_name', w.customer_name,
    'customer_email', w.customer_email,
    'service', jsonb_build_object('name', s.name, 'duration_minutes', s.duration_minutes,
      'price_cents', s.price_cents, 'currency', s.currency),
    'tenant', jsonb_build_object('name', t.name, 'slug', t.slug, 'brand_color', t.brand_color, 'logo_url', t.logo_url)
  );
END $$;

-- Public: claim the offered slot
CREATE OR REPLACE FUNCTION public.public_claim_waitlist_slot(_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE w RECORD; svc RECORD; conflicts INT; new_ref TEXT; new_id UUID; new_end TIMESTAMPTZ;
BEGIN
  SELECT * INTO w FROM public.waiting_list WHERE claim_token = _token LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'invalid_token'; END IF;
  IF w.status <> 'notified' THEN RAISE EXCEPTION 'not_offered'; END IF;
  IF w.expires_at IS NOT NULL AND w.expires_at < now() THEN
    UPDATE public.waiting_list SET status='expired' WHERE id = w.id;
    RAISE EXCEPTION 'offer_expired';
  END IF;
  IF w.offered_starts_at IS NULL THEN RAISE EXCEPTION 'no_slot'; END IF;

  SELECT duration_minutes, price_cents, currency INTO svc FROM public.services WHERE id = w.service_id;
  new_end := w.offered_starts_at + (svc.duration_minutes || ' minutes')::interval;

  SELECT COUNT(*) INTO conflicts FROM public.bookings
    WHERE tenant_id = w.tenant_id AND status IN ('PENDING_PAYMENT','CONFIRMED')
      AND (w.staff_id IS NULL OR staff_id = w.staff_id)
      AND tstzrange(starts_at, ends_at, '[)') && tstzrange(w.offered_starts_at, new_end, '[)');
  IF conflicts > 0 THEN
    UPDATE public.waiting_list SET status='waiting', offered_starts_at=NULL, claim_token=NULL, expires_at=NULL WHERE id = w.id;
    RAISE EXCEPTION 'slot_taken';
  END IF;

  new_ref := 'BK-' || upper(substring(md5(random()::text||clock_timestamp()::text) from 1 for 6));
  INSERT INTO public.bookings (tenant_id, service_id, staff_id, starts_at, ends_at, amount_cents, currency,
    ref_code, status, customer_name, customer_email, customer_phone, source)
  VALUES (w.tenant_id, w.service_id, w.staff_id, w.offered_starts_at, new_end, svc.price_cents, svc.currency,
    new_ref, 'CONFIRMED', w.customer_name, w.customer_email, w.customer_phone, 'waitlist')
  RETURNING id INTO new_id;

  UPDATE public.waiting_list SET status='booked' WHERE id = w.id;
  RETURN jsonb_build_object('booking_id', new_id, 'ref_code', new_ref);
END $$;

-- Trigger: when booking is cancelled, offer slot to next waiting customer
CREATE OR REPLACE FUNCTION public.waitlist_offer_on_cancel()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE w_id UUID; new_token TEXT;
BEGIN
  IF NEW.status = 'CANCELLED' AND OLD.status <> 'CANCELLED' THEN
    SELECT id INTO w_id FROM public.waiting_list
      WHERE tenant_id = NEW.tenant_id
        AND service_id = NEW.service_id
        AND status = 'waiting'
        AND (staff_id IS NULL OR staff_id = NEW.staff_id)
        AND (desired_from IS NULL OR desired_from <= NEW.starts_at)
        AND (desired_to IS NULL OR desired_to >= NEW.starts_at)
      ORDER BY created_at ASC
      LIMIT 1;
    IF w_id IS NOT NULL THEN
      new_token := upper(substring(md5(random()::text||clock_timestamp()::text) from 1 for 32);
      UPDATE public.waiting_list
        SET status = 'notified',
            offered_starts_at = NEW.starts_at,
            claim_token = new_token,
            notified_at = now(),
            expires_at = now() + interval '2 hours'
        WHERE id = w_id;

      -- queue an automation_run for outbound notification (worker will deliver)
      INSERT INTO public.automation_runs (tenant_id, automation_id, trigger_type, payload, status, scheduled_at)
      VALUES (NEW.tenant_id, NULL, 'waitlist_offer',
        jsonb_build_object('waiting_list_id', w_id, 'claim_token', new_token,
          'booking_id', NEW.id, 'starts_at', NEW.starts_at),
        'pending', now());
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS bookings_waitlist_offer_trg ON public.bookings;
CREATE TRIGGER bookings_waitlist_offer_trg AFTER UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.waitlist_offer_on_cancel();

-- =========================================================
-- Super-admin platform metrics
-- =========================================================
CREATE OR REPLACE FUNCTION public.admin_platform_metrics()
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE result JSONB;
BEGIN
  IF NOT public.has_admin_access() THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT jsonb_build_object(
    'companies_total', (SELECT COUNT(*) FROM public.tenants WHERE is_demo = false AND is_admin_workspace = false),
    'companies_active', (SELECT COUNT(*) FROM public.tenants WHERE subscription_status='active' AND is_demo=false AND is_admin_workspace=false),
    'companies_trial', (SELECT COUNT(*) FROM public.tenants WHERE subscription_status='trial' AND is_demo=false AND is_admin_workspace=false),
    'companies_cancelled_30d', (SELECT COUNT(*) FROM public.tenants WHERE subscription_status='cancelled' AND updated_at > now() - interval '30 days' AND is_demo=false AND is_admin_workspace=false),
    'plan_breakdown', (SELECT COALESCE(jsonb_object_agg(plan_tier, c), '{}'::jsonb) FROM (SELECT plan_tier, COUNT(*) c FROM public.tenants WHERE is_demo=false AND is_admin_workspace=false GROUP BY plan_tier) x),
    'users_total', (SELECT COUNT(*) FROM public.users),
    'users_active_30d', (SELECT COUNT(DISTINCT supabase_auth_id) FROM public.audit_logs WHERE created_at > now() - interval '30 days'),
    'bookings_total', (SELECT COUNT(*) FROM public.bookings),
    'bookings_30d', (SELECT COUNT(*) FROM public.bookings WHERE created_at > now() - interval '30 days'),
    'platform_revenue', (SELECT COALESCE(jsonb_object_agg(currency, total), '{}'::jsonb) FROM (SELECT currency, SUM(amount_cents) total FROM public.payments WHERE status='CONFIRMED' GROUP BY currency) x),
    'platform_revenue_30d', (SELECT COALESCE(jsonb_object_agg(currency, total), '{}'::jsonb) FROM (SELECT currency, SUM(amount_cents) total FROM public.payments WHERE status='CONFIRMED' AND paid_at > now() - interval '30 days' GROUP BY currency) x),
    'failed_payments_7d', (SELECT COUNT(*) FROM public.payments WHERE status='FAILED' AND created_at > now() - interval '7 days'),
    'failed_payments_amount_7d', (SELECT COALESCE(jsonb_object_agg(currency, total), '{}'::jsonb) FROM (SELECT currency, SUM(amount_cents) total FROM public.payments WHERE status='FAILED' AND created_at > now() - interval '7 days' GROUP BY currency) x),
    'automation_pending', (SELECT COUNT(*) FROM public.automation_runs WHERE status='pending'),
    'automation_failed_24h', (SELECT COUNT(*) FROM public.automation_runs WHERE status='failed' AND created_at > now() - interval '24 hours'),
    'waitlist_active', (SELECT COUNT(*) FROM public.waiting_list WHERE status IN ('waiting','notified')),
    'mrr', (SELECT COALESCE(SUM(CASE plan_tier
      WHEN 'starter' THEN 29 WHEN 'growth' THEN 79 WHEN 'pro' THEN 199 WHEN 'enterprise' THEN 499
      ELSE 0 END), 0) FROM public.tenants WHERE subscription_status='active' AND is_demo=false AND is_admin_workspace=false),
    'churn_30d_pct', (
      SELECT CASE WHEN denom=0 THEN 0 ELSE ROUND(100.0 * num / denom, 2) END
      FROM (SELECT
        (SELECT COUNT(*) FROM public.tenants WHERE subscription_status='cancelled' AND updated_at > now() - interval '30 days' AND is_demo=false AND is_admin_workspace=false)::numeric AS num,
        (SELECT COUNT(*) FROM public.tenants WHERE created_at < now() - interval '30 days' AND is_demo=false AND is_admin_workspace=false)::numeric AS denom
      ) c
    ),
    'recent_signups', (SELECT COALESCE(jsonb_agg(jsonb_build_object('id',id,'name',name,'country',country,'plan_tier',plan_tier,'created_at',created_at) ORDER BY created_at DESC), '[]'::jsonb)
      FROM (SELECT id, name, country, plan_tier, created_at FROM public.tenants WHERE is_demo=false AND is_admin_workspace=false ORDER BY created_at DESC LIMIT 10) r)
  ) INTO result;
  RETURN result;
END $$;
