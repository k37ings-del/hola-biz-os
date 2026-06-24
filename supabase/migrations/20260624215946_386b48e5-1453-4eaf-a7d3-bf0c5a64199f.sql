
-- =========================================================
-- Waiting list
-- =========================================================
CREATE TABLE public.waiting_list (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  service_id UUID REFERENCES public.services(id) ON DELETE SET NULL,
  staff_id UUID REFERENCES public.staff(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL,
  customer_email TEXT,
  customer_phone TEXT,
  desired_from TIMESTAMPTZ,
  desired_to TIMESTAMPTZ,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting','notified','booked','expired','cancelled')),
  notified_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX waiting_list_tenant_idx ON public.waiting_list(tenant_id, status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.waiting_list TO authenticated;
GRANT ALL ON public.waiting_list TO service_role;
ALTER TABLE public.waiting_list ENABLE ROW LEVEL SECURITY;
CREATE POLICY waiting_list_tenant ON public.waiting_list FOR ALL TO authenticated
  USING (tenant_id = current_tenant_id()) WITH CHECK (tenant_id = current_tenant_id());
CREATE TRIGGER waiting_list_touch BEFORE UPDATE ON public.waiting_list
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =========================================================
-- Refunds
-- =========================================================
CREATE TABLE public.refunds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  payment_id UUID REFERENCES public.payments(id) ON DELETE SET NULL,
  booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','succeeded','failed')),
  provider TEXT,
  provider_ref TEXT,
  processed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX refunds_tenant_idx ON public.refunds(tenant_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.refunds TO authenticated;
GRANT ALL ON public.refunds TO service_role;
ALTER TABLE public.refunds ENABLE ROW LEVEL SECURITY;
CREATE POLICY refunds_tenant ON public.refunds FOR ALL TO authenticated
  USING (tenant_id = current_tenant_id() AND current_user_role() IN ('owner','admin','manager'))
  WITH CHECK (tenant_id = current_tenant_id() AND current_user_role() IN ('owner','admin','manager'));
CREATE TRIGGER refunds_touch BEFORE UPDATE ON public.refunds
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =========================================================
-- Payouts
-- =========================================================
CREATE TABLE public.payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','in_transit','paid','failed')),
  destination TEXT,
  scheduled_for TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  provider_ref TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX payouts_tenant_idx ON public.payouts(tenant_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payouts TO authenticated;
GRANT ALL ON public.payouts TO service_role;
ALTER TABLE public.payouts ENABLE ROW LEVEL SECURITY;
CREATE POLICY payouts_tenant ON public.payouts FOR ALL TO authenticated
  USING (tenant_id = current_tenant_id() AND current_user_role() IN ('owner','admin','manager'))
  WITH CHECK (tenant_id = current_tenant_id() AND current_user_role() IN ('owner','admin','manager'));
CREATE TRIGGER payouts_touch BEFORE UPDATE ON public.payouts
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =========================================================
-- Staff schedules
-- =========================================================
CREATE TABLE public.staff_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  weekly JSONB NOT NULL DEFAULT '{}'::jsonb,
  breaks JSONB NOT NULL DEFAULT '[]'::jsonb,
  time_off JSONB NOT NULL DEFAULT '[]'::jsonb,
  buffer_before_minutes INTEGER NOT NULL DEFAULT 0,
  buffer_after_minutes INTEGER NOT NULL DEFAULT 0,
  max_daily_appointments INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (staff_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff_schedules TO authenticated;
GRANT ALL ON public.staff_schedules TO service_role;
ALTER TABLE public.staff_schedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY staff_schedules_tenant ON public.staff_schedules FOR ALL TO authenticated
  USING (tenant_id = current_tenant_id()) WITH CHECK (tenant_id = current_tenant_id());
CREATE TRIGGER staff_schedules_touch BEFORE UPDATE ON public.staff_schedules
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =========================================================
-- Audit logs
-- =========================================================
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  actor_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  actor_email TEXT,
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id UUID,
  before JSONB,
  after JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX audit_logs_tenant_idx ON public.audit_logs(tenant_id, created_at DESC);
GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY audit_logs_read ON public.audit_logs FOR SELECT TO authenticated
  USING (tenant_id = current_tenant_id() AND current_user_role() IN ('owner','admin'));
CREATE POLICY audit_logs_insert ON public.audit_logs FOR INSERT TO authenticated
  WITH CHECK (tenant_id = current_tenant_id());

-- =========================================================
-- Booking reschedule / cancel tokens
-- =========================================================
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS reschedule_token TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS cancel_token TEXT UNIQUE;

CREATE OR REPLACE FUNCTION public.bookings_set_tokens()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.reschedule_token IS NULL THEN
    NEW.reschedule_token := encode(gen_random_bytes(24), 'hex');
  END IF;
  IF NEW.cancel_token IS NULL THEN
    NEW.cancel_token := encode(gen_random_bytes(24), 'hex');
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS bookings_tokens_trg ON public.bookings;
CREATE TRIGGER bookings_tokens_trg BEFORE INSERT ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.bookings_set_tokens();

UPDATE public.bookings
  SET reschedule_token = encode(gen_random_bytes(24), 'hex')
  WHERE reschedule_token IS NULL;
UPDATE public.bookings
  SET cancel_token = encode(gen_random_bytes(24), 'hex')
  WHERE cancel_token IS NULL;

-- =========================================================
-- Public reschedule / cancel RPCs (no auth required)
-- =========================================================
CREATE OR REPLACE FUNCTION public.public_get_booking_by_token(_token TEXT, _kind TEXT)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE b RECORD; t RECORD; s RECORD;
BEGIN
  IF _kind = 'reschedule' THEN
    SELECT * INTO b FROM public.bookings WHERE reschedule_token = _token LIMIT 1;
  ELSIF _kind = 'cancel' THEN
    SELECT * INTO b FROM public.bookings WHERE cancel_token = _token LIMIT 1;
  ELSE RETURN NULL; END IF;
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT name, slug, brand_color, logo_url, timezone INTO t FROM public.tenants WHERE id = b.tenant_id;
  SELECT name, duration_minutes INTO s FROM public.services WHERE id = b.service_id;
  RETURN jsonb_build_object(
    'id', b.id, 'ref_code', b.ref_code, 'status', b.status,
    'starts_at', b.starts_at, 'ends_at', b.ends_at,
    'customer_name', b.customer_name, 'customer_email', b.customer_email,
    'service', jsonb_build_object('name', s.name, 'duration_minutes', s.duration_minutes),
    'tenant', jsonb_build_object('name', t.name, 'slug', t.slug, 'brand_color', t.brand_color, 'logo_url', t.logo_url)
  );
END $$;

CREATE OR REPLACE FUNCTION public.public_cancel_booking(_token TEXT, _reason TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE b RECORD;
BEGIN
  SELECT * INTO b FROM public.bookings WHERE cancel_token = _token LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'invalid_token'; END IF;
  IF b.status IN ('CANCELLED','COMPLETED','NO_SHOW') THEN RAISE EXCEPTION 'not_cancellable'; END IF;
  UPDATE public.bookings SET status='CANCELLED', cancellation_reason = COALESCE(_reason,'Customer cancelled'), updated_at=now()
    WHERE id = b.id;
  RETURN jsonb_build_object('ok', true);
END $$;

CREATE OR REPLACE FUNCTION public.public_reschedule_booking(_token TEXT, _new_starts_at TIMESTAMPTZ)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE b RECORD; svc RECORD; conflicts INT; new_end TIMESTAMPTZ;
BEGIN
  SELECT * INTO b FROM public.bookings WHERE reschedule_token = _token LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'invalid_token'; END IF;
  IF b.status IN ('CANCELLED','COMPLETED','NO_SHOW') THEN RAISE EXCEPTION 'not_reschedulable'; END IF;
  IF _new_starts_at < now() THEN RAISE EXCEPTION 'past_time'; END IF;
  SELECT duration_minutes INTO svc FROM public.services WHERE id = b.service_id;
  new_end := _new_starts_at + (COALESCE(svc.duration_minutes,30) || ' minutes')::interval;
  SELECT COUNT(*) INTO conflicts FROM public.bookings
    WHERE tenant_id = b.tenant_id AND id <> b.id AND status IN ('PENDING_PAYMENT','CONFIRMED')
      AND (b.staff_id IS NULL OR staff_id = b.staff_id)
      AND tstzrange(starts_at, ends_at, '[)') && tstzrange(_new_starts_at, new_end, '[)');
  IF conflicts > 0 THEN RAISE EXCEPTION 'slot_taken'; END IF;
  UPDATE public.bookings SET starts_at = _new_starts_at, ends_at = new_end, updated_at = now() WHERE id = b.id;
  RETURN jsonb_build_object('ok', true);
END $$;

GRANT EXECUTE ON FUNCTION public.public_get_booking_by_token(TEXT,TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.public_cancel_booking(TEXT,TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.public_reschedule_booking(TEXT,TIMESTAMPTZ) TO anon, authenticated;
