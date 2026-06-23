
-- 1. SECURITY DEFINER functions: ensure no public/anon execute
REVOKE EXECUTE ON FUNCTION public.current_tenant_id() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.current_user_role() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_admin_access() FROM PUBLIC, anon;

-- 2. tenants_demo_admin_read: restrict to authenticated
DROP POLICY IF EXISTS tenants_demo_admin_read ON public.tenants;
CREATE POLICY tenants_demo_admin_read ON public.tenants
  FOR SELECT
  TO authenticated
  USING (is_demo AND public.has_admin_access());

-- 3. users INSERT: prevent self-registering as 'owner' unless whitelisted
DROP POLICY IF EXISTS users_insert_self_or_owner ON public.users;
CREATE POLICY users_insert_self_or_owner ON public.users
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (
      supabase_auth_id = auth.uid()
      AND admin_access = false
      AND (
        role = 'agent'::app_role
        OR (
          role = 'owner'::app_role
          AND lower(COALESCE(auth.jwt() ->> 'email', '')) = ANY (ARRAY['holaweb.africa@gmail.com','k37.ings@gmail.com'])
        )
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.tenants t
        WHERE t.id = users.tenant_id
          AND (t.is_admin_workspace OR t.is_demo)
          AND lower(COALESCE(auth.jwt() ->> 'email', '')) <> ALL (ARRAY['holaweb.africa@gmail.com','k37.ings@gmail.com'])
      )
    )
    OR (
      tenant_id = current_tenant_id()
      AND current_user_role() = ANY (ARRAY['owner'::app_role, 'admin'::app_role])
    )
  );

-- 4. users UPDATE: owners/admins cannot grant admin_access (whitelist trigger only)
DROP POLICY IF EXISTS users_update_self_or_owner ON public.users;
CREATE POLICY users_update_self_or_owner ON public.users
  FOR UPDATE
  TO authenticated
  USING (
    supabase_auth_id = auth.uid()
    OR (tenant_id = current_tenant_id() AND current_user_role() = ANY (ARRAY['owner'::app_role, 'admin'::app_role]))
  )
  WITH CHECK (
    (
      supabase_auth_id = auth.uid()
      AND admin_access = (SELECT u2.admin_access FROM public.users u2 WHERE u2.supabase_auth_id = auth.uid())
      AND role = (SELECT u2.role FROM public.users u2 WHERE u2.supabase_auth_id = auth.uid())
    )
    OR (
      tenant_id = current_tenant_id()
      AND current_user_role() = ANY (ARRAY['owner'::app_role, 'admin'::app_role])
      AND (
        admin_access = false
        OR lower(COALESCE(email, '')) = ANY (ARRAY['holaweb.africa@gmail.com','k37.ings@gmail.com'])
      )
    )
  );
