
-- Customer portal token on bookings
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS portal_token TEXT UNIQUE;
UPDATE public.bookings SET portal_token = encode(gen_random_bytes(18), 'hex') WHERE portal_token IS NULL;

-- ICS feed token on staff
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS ics_token TEXT UNIQUE;
UPDATE public.staff SET ics_token = encode(gen_random_bytes(18), 'hex') WHERE ics_token IS NULL;

-- Payment provider config on tenants
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS payment_providers JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Token autogen triggers
CREATE OR REPLACE FUNCTION public.bookings_set_portal_token()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.portal_token IS NULL THEN NEW.portal_token := encode(gen_random_bytes(18), 'hex'); END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS bookings_portal_token_trg ON public.bookings;
CREATE TRIGGER bookings_portal_token_trg BEFORE INSERT ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.bookings_set_portal_token();
REVOKE EXECUTE ON FUNCTION public.bookings_set_portal_token() FROM PUBLIC, anon;

CREATE OR REPLACE FUNCTION public.staff_set_ics_token()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.ics_token IS NULL THEN NEW.ics_token := encode(gen_random_bytes(18), 'hex'); END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS staff_ics_token_trg ON public.staff;
CREATE TRIGGER staff_ics_token_trg BEFORE INSERT ON public.staff
  FOR EACH ROW EXECUTE FUNCTION public.staff_set_ics_token();
REVOKE EXECUTE ON FUNCTION public.staff_set_ics_token() FROM PUBLIC, anon;

-- Update create_booking RPC to return portal_token
CREATE OR REPLACE FUNCTION public.public_create_booking(_tenant_id uuid, _service_id uuid, _staff_id uuid, _starts_at timestamp with time zone, _customer_name text, _customer_email text, _customer_phone text, _intake jsonb, _timezone text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE svc RECORD; conflict_count INT; new_ref TEXT; new_id UUID; new_portal TEXT;
BEGIN
  SELECT id, duration_minutes, price_cents, currency INTO svc
    FROM public.services WHERE id = _service_id AND tenant_id = _tenant_id AND active = TRUE;
  IF NOT FOUND THEN RAISE EXCEPTION 'invalid_service'; END IF;
  IF _staff_id IS NOT NULL THEN
    PERFORM 1 FROM public.staff WHERE id = _staff_id AND tenant_id = _tenant_id AND active = TRUE;
    IF NOT FOUND THEN RAISE EXCEPTION 'invalid_staff'; END IF;
  END IF;
  IF _customer_name IS NULL OR length(trim(_customer_name)) < 2 THEN RAISE EXCEPTION 'invalid_name'; END IF;
  IF _customer_email IS NULL AND _customer_phone IS NULL THEN RAISE EXCEPTION 'contact_required'; END IF;
  IF _starts_at < now() THEN RAISE EXCEPTION 'past_time'; END IF;
  SELECT COUNT(*) INTO conflict_count FROM public.bookings
  WHERE tenant_id = _tenant_id AND status IN ('PENDING_PAYMENT','CONFIRMED')
    AND (_staff_id IS NULL OR staff_id = _staff_id)
    AND tstzrange(starts_at, ends_at, '[)') && tstzrange(_starts_at, _starts_at + (svc.duration_minutes || ' minutes')::interval, '[)');
  IF conflict_count > 0 THEN RAISE EXCEPTION 'slot_taken'; END IF;
  new_ref := 'BK-' || upper(substring(md5(random()::text||clock_timestamp()::text) from 1 for 6));
  INSERT INTO public.bookings (tenant_id, service_id, staff_id, starts_at, ends_at, amount_cents, currency,
    ref_code, status, customer_name, customer_email, customer_phone, intake_responses, timezone, source)
  VALUES (_tenant_id, _service_id, _staff_id, _starts_at,
    _starts_at + (svc.duration_minutes || ' minutes')::interval, svc.price_cents, svc.currency,
    new_ref, 'PENDING_PAYMENT', trim(_customer_name), lower(nullif(trim(_customer_email),'')),
    nullif(trim(_customer_phone),''), COALESCE(_intake, '{}'::jsonb), _timezone, 'public')
  RETURNING id, portal_token INTO new_id, new_portal;
  RETURN jsonb_build_object('id', new_id, 'ref_code', new_ref, 'portal_token', new_portal);
END; $function$;

-- Customer portal: view by portal_token (no login)
CREATE OR REPLACE FUNCTION public.public_get_customer_portal(_token text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE b RECORD; t RECORD; s RECORD; st RECORD; history JSONB;
BEGIN
  SELECT * INTO b FROM public.bookings WHERE portal_token = _token LIMIT 1;
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT name, slug, brand_color, logo_url, timezone, email AS tenant_email INTO t FROM public.tenants WHERE id = b.tenant_id;
  SELECT name, duration_minutes, price_cents, currency INTO s FROM public.services WHERE id = b.service_id;
  SELECT name, photo_url INTO st FROM public.staff WHERE id = b.staff_id;
  -- Past + upcoming bookings for same customer (matched by email or phone)
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', x.id, 'ref_code', x.ref_code, 'status', x.status,
    'starts_at', x.starts_at, 'ends_at', x.ends_at,
    'service_name', sv.name, 'staff_name', stf.name,
    'cancel_token', x.cancel_token, 'reschedule_token', x.reschedule_token,
    'portal_token', x.portal_token
  ) ORDER BY x.starts_at DESC), '[]'::jsonb) INTO history
  FROM public.bookings x
  LEFT JOIN public.services sv ON sv.id = x.service_id
  LEFT JOIN public.staff stf ON stf.id = x.staff_id
  WHERE x.tenant_id = b.tenant_id
    AND ((b.customer_email IS NOT NULL AND x.customer_email = b.customer_email)
      OR (b.customer_phone IS NOT NULL AND x.customer_phone = b.customer_phone));
  RETURN jsonb_build_object(
    'booking', jsonb_build_object('id', b.id, 'ref_code', b.ref_code, 'status', b.status,
      'starts_at', b.starts_at, 'ends_at', b.ends_at, 'amount_cents', b.amount_cents, 'currency', b.currency,
      'customer_name', b.customer_name, 'customer_email', b.customer_email, 'customer_phone', b.customer_phone,
      'cancel_token', b.cancel_token, 'reschedule_token', b.reschedule_token),
    'service', to_jsonb(s),
    'staff', CASE WHEN st IS NULL THEN NULL ELSE to_jsonb(st) END,
    'tenant', to_jsonb(t),
    'history', history
  );
END $$;
REVOKE EXECUTE ON FUNCTION public.public_get_customer_portal(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_get_customer_portal(text) TO anon, authenticated;

-- ICS feed: confirmed + pending bookings for a staff member
CREATE OR REPLACE FUNCTION public.public_get_staff_ics(_token text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE st RECORD; t RECORD; rows JSONB;
BEGIN
  SELECT * INTO st FROM public.staff WHERE ics_token = _token LIMIT 1;
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT name, timezone INTO t FROM public.tenants WHERE id = st.tenant_id;
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', b.id, 'ref_code', b.ref_code, 'starts_at', b.starts_at, 'ends_at', b.ends_at,
    'customer_name', b.customer_name, 'customer_phone', b.customer_phone,
    'service_name', sv.name, 'status', b.status
  )), '[]'::jsonb) INTO rows
  FROM public.bookings b
  LEFT JOIN public.services sv ON sv.id = b.service_id
  WHERE b.tenant_id = st.tenant_id AND b.staff_id = st.id
    AND b.status IN ('PENDING_PAYMENT','CONFIRMED')
    AND b.starts_at > now() - interval '30 days';
  RETURN jsonb_build_object('staff_name', st.name, 'tenant_name', t.name, 'tenant_tz', t.timezone, 'bookings', rows);
END $$;
REVOKE EXECUTE ON FUNCTION public.public_get_staff_ics(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_get_staff_ics(text) TO anon, authenticated;
