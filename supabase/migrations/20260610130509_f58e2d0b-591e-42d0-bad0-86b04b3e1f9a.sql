
-- Whitelisted owners can read the demo tenant even without a user row yet
CREATE POLICY "tenants_demo_whitelist" ON public.tenants FOR SELECT TO authenticated
  USING (is_demo AND LOWER(COALESCE(auth.jwt()->>'email','')) IN ('holaweb.africa@gmail.com','k37.ings@gmail.com'));

-- Create the demo tenant with a fixed UUID so seed scripts can reference it
INSERT INTO public.tenants (id, name, industry, country, country_code, email, plan_tier, is_demo)
VALUES ('11111111-1111-1111-1111-111111111111', 'Glam Studio Lagos', 'Beauty & Wellness', 'Nigeria', 'NG', 'hello@glamstudiolagos.demo', 'growth', TRUE)
ON CONFLICT (id) DO NOTHING;
