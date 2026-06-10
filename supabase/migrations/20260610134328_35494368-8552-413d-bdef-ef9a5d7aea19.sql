
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS is_admin_workspace boolean NOT NULL DEFAULT false;

INSERT INTO public.tenants (id, name, industry, country, country_code, email, plan_tier, subscription_status, business_hours, is_demo, is_admin_workspace)
VALUES (
  '22222222-2222-2222-2222-222222222222',
  'Holaweb HQ',
  'Platform',
  'Nigeria',
  'NG',
  'holaweb.africa@gmail.com',
  'enterprise',
  'active',
  '{"mon":{"active":true,"open":"09:00","close":"18:00"},"tue":{"active":true,"open":"09:00","close":"18:00"},"wed":{"active":true,"open":"09:00","close":"18:00"},"thu":{"active":true,"open":"09:00","close":"18:00"},"fri":{"active":true,"open":"09:00","close":"18:00"},"sat":{"active":false,"open":"09:00","close":"18:00"},"sun":{"active":false,"open":"09:00","close":"18:00"}}'::jsonb,
  false,
  true
)
ON CONFLICT (id) DO UPDATE SET is_admin_workspace = true;

UPDATE public.users
SET tenant_id = '22222222-2222-2222-2222-222222222222', admin_access = true
WHERE lower(email) IN ('holaweb.africa@gmail.com','k37.ings@gmail.com');

DROP POLICY IF EXISTS tenants_demo_whitelist ON public.tenants;
CREATE POLICY tenants_demo_admin_read ON public.tenants
  FOR SELECT
  USING (is_demo AND public.has_admin_access());
