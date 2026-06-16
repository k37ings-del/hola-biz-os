
-- Extend staff table
ALTER TABLE public.staff
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'Staff',
  ADD COLUMN IF NOT EXISTS bio text,
  ADD COLUMN IF NOT EXISTS photo_url text,
  ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.staff
  DROP CONSTRAINT IF EXISTS staff_role_check;
ALTER TABLE public.staff
  ADD CONSTRAINT staff_role_check CHECK (role IN ('Owner','Senior Staff','Staff','Contractor'));

DROP TRIGGER IF EXISTS staff_touch_updated_at ON public.staff;
CREATE TRIGGER staff_touch_updated_at BEFORE UPDATE ON public.staff
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- staff_services join table
CREATE TABLE IF NOT EXISTS public.staff_services (
  staff_id uuid NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  service_id uuid NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (staff_id, service_id)
);

CREATE INDEX IF NOT EXISTS staff_services_tenant_idx ON public.staff_services(tenant_id);
CREATE INDEX IF NOT EXISTS staff_services_service_idx ON public.staff_services(service_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff_services TO authenticated;
GRANT ALL ON public.staff_services TO service_role;

ALTER TABLE public.staff_services ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff_services tenant access" ON public.staff_services;
CREATE POLICY "staff_services tenant access"
  ON public.staff_services
  FOR ALL
  TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());
