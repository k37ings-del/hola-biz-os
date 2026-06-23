
-- TENANT EXTENSIONS
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS slug TEXT,
  ADD COLUMN IF NOT EXISTS brand_color TEXT DEFAULT '#C5283D',
  ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'Africa/Johannesburg',
  ADD COLUMN IF NOT EXISTS intake_form JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS buffer_minutes INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS logo_url TEXT;

UPDATE public.tenants
SET slug = LOWER(REGEXP_REPLACE(REGEXP_REPLACE(name, '[^a-zA-Z0-9]+', '-', 'g'), '(^-|-$)', '', 'g')) || '-' || SUBSTRING(id::text, 1, 6)
WHERE slug IS NULL;

DO $$ BEGIN
  ALTER TABLE public.tenants ALTER COLUMN slug SET NOT NULL;
EXCEPTION WHEN others THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.tenants ADD CONSTRAINT tenants_slug_key UNIQUE (slug);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL; END $$;

-- BOOKINGS
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS customer_name TEXT,
  ADD COLUMN IF NOT EXISTS customer_email TEXT,
  ADD COLUMN IF NOT EXISTS customer_phone TEXT,
  ADD COLUMN IF NOT EXISTS intake_responses JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS meeting_url TEXT,
  ADD COLUMN IF NOT EXISTS timezone TEXT,
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual';

-- STAFF
ALTER TABLE public.staff
  ADD COLUMN IF NOT EXISTS buffer_minutes INT DEFAULT 0;

-- CALENDAR CONNECTIONS
CREATE TABLE IF NOT EXISTS public.calendar_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('google_calendar','outlook','zoom','google_meet')),
  account_email TEXT,
  calendar_id TEXT,
  access_token TEXT,
  refresh_token TEXT,
  expires_at TIMESTAMPTZ,
  scope TEXT,
  sync_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (staff_id, provider)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.calendar_connections TO authenticated;
GRANT ALL ON public.calendar_connections TO service_role;
ALTER TABLE public.calendar_connections ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS calendar_connections_tenant ON public.calendar_connections;
CREATE POLICY calendar_connections_tenant ON public.calendar_connections
  FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());
DROP TRIGGER IF EXISTS calendar_connections_touch ON public.calendar_connections;
CREATE TRIGGER calendar_connections_touch BEFORE UPDATE ON public.calendar_connections
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- AUTOMATIONS
CREATE TABLE IF NOT EXISTS public.automations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  trigger TEXT NOT NULL,
  offset_minutes INT NOT NULL DEFAULT 0,
  channel TEXT NOT NULL,
  subject TEXT,
  template TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.automations TO authenticated;
GRANT ALL ON public.automations TO service_role;
ALTER TABLE public.automations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS automations_tenant ON public.automations;
CREATE POLICY automations_tenant ON public.automations
  FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());
DROP TRIGGER IF EXISTS automations_touch ON public.automations;
CREATE TRIGGER automations_touch BEFORE UPDATE ON public.automations
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE IF NOT EXISTS public.automation_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  automation_id UUID NOT NULL REFERENCES public.automations(id) ON DELETE CASCADE,
  booking_id UUID REFERENCES public.bookings(id) ON DELETE CASCADE,
  scheduled_at TIMESTAMPTZ NOT NULL,
  sent_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending',
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS automation_runs_due_idx ON public.automation_runs(scheduled_at) WHERE status = 'pending';
GRANT SELECT ON public.automation_runs TO authenticated;
GRANT ALL ON public.automation_runs TO service_role;
ALTER TABLE public.automation_runs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS automation_runs_tenant_read ON public.automation_runs;
CREATE POLICY automation_runs_tenant_read ON public.automation_runs
  FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id());

-- PUBLIC RPCS
CREATE OR REPLACE FUNCTION public.public_get_booking_page(_slug TEXT)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE t RECORD; result JSONB;
BEGIN
  SELECT id, name, slug, brand_color, logo_url, timezone, default_currency, intake_form, buffer_minutes, country_code
    INTO t FROM public.tenants WHERE slug = _slug LIMIT 1;
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT jsonb_build_object(
    'tenant', to_jsonb(t),
    'services', COALESCE((SELECT jsonb_agg(jsonb_build_object('id',id,'name',name,'duration_minutes',duration_minutes,'price_cents',price_cents,'currency',currency) ORDER BY name)
      FROM public.services WHERE tenant_id = t.id AND active = TRUE), '[]'::jsonb),
    'staff', COALESCE((SELECT jsonb_agg(jsonb_build_object('id',s.id,'name',s.name,'role',s.role,'photo_url',s.photo_url,
      'service_ids', COALESCE((SELECT jsonb_agg(service_id) FROM public.staff_services WHERE staff_id = s.id), '[]'::jsonb)) ORDER BY s.name)
      FROM public.staff s WHERE s.tenant_id = t.id AND s.active = TRUE), '[]'::jsonb)
  ) INTO result;
  RETURN result;
END; $$;
REVOKE EXECUTE ON FUNCTION public.public_get_booking_page(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_get_booking_page(TEXT) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.public_get_availability(_tenant_id UUID,_service_id UUID,_staff_id UUID,_day DATE)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE svc RECORD; tenant_rec RECORD; bookings_arr JSONB;
BEGIN
  SELECT duration_minutes INTO svc FROM public.services WHERE id = _service_id AND tenant_id = _tenant_id AND active = TRUE;
  IF NOT FOUND THEN RETURN jsonb_build_object('slots','[]'::jsonb); END IF;
  SELECT buffer_minutes, business_hours INTO tenant_rec FROM public.tenants WHERE id = _tenant_id;
  SELECT COALESCE(jsonb_agg(jsonb_build_object('starts_at',b.starts_at,'ends_at',b.ends_at,'staff_id',b.staff_id)), '[]'::jsonb) INTO bookings_arr
  FROM public.bookings b
  WHERE b.tenant_id = _tenant_id AND b.status IN ('PENDING_PAYMENT','CONFIRMED') AND b.starts_at::date = _day
    AND (_staff_id IS NULL OR b.staff_id = _staff_id OR b.staff_id IS NULL);
  RETURN jsonb_build_object('duration_minutes',svc.duration_minutes,'buffer_minutes',COALESCE(tenant_rec.buffer_minutes,0),'business_hours',tenant_rec.business_hours,'existing',bookings_arr);
END; $$;
REVOKE EXECUTE ON FUNCTION public.public_get_availability(UUID,UUID,UUID,DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_get_availability(UUID,UUID,UUID,DATE) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.public_create_booking(
  _tenant_id UUID,_service_id UUID,_staff_id UUID,_starts_at TIMESTAMPTZ,
  _customer_name TEXT,_customer_email TEXT,_customer_phone TEXT,_intake JSONB,_timezone TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE svc RECORD; conflict_count INT; new_ref TEXT; new_id UUID;
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
  RETURNING id INTO new_id;
  RETURN jsonb_build_object('id', new_id, 'ref_code', new_ref);
END; $$;
REVOKE EXECUTE ON FUNCTION public.public_create_booking(UUID,UUID,UUID,TIMESTAMPTZ,TEXT,TEXT,TEXT,JSONB,TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_create_booking(UUID,UUID,UUID,TIMESTAMPTZ,TEXT,TEXT,TEXT,JSONB,TEXT) TO anon, authenticated;

UPDATE public.tenants
SET slug = 'holaweb', default_currency = 'ZAR', country = 'South Africa',
    country_code = 'ZA', timezone = 'Africa/Johannesburg', brand_color = '#C5283D'
WHERE id = '22222222-2222-2222-2222-222222222222';
