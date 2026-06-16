
DROP POLICY IF EXISTS users_insert_self_or_owner ON public.users;
CREATE POLICY users_insert_self_or_owner ON public.users
  FOR INSERT TO authenticated
  WITH CHECK (
    (
      supabase_auth_id = auth.uid()
      AND admin_access = false
      AND role IN ('owner'::app_role, 'agent'::app_role)
      AND NOT EXISTS (
        SELECT 1 FROM public.tenants t
        WHERE t.id = tenant_id
          AND (t.is_admin_workspace OR t.is_demo)
          AND LOWER(COALESCE((auth.jwt() ->> 'email'), '')) NOT IN ('holaweb.africa@gmail.com','k37.ings@gmail.com')
      )
    )
    OR (
      tenant_id = current_tenant_id()
      AND current_user_role() IN ('owner'::app_role, 'admin'::app_role)
    )
  );

DROP POLICY IF EXISTS users_update_self_or_owner ON public.users;
CREATE POLICY users_update_self_or_owner ON public.users
  FOR UPDATE TO authenticated
  USING (
    (supabase_auth_id = auth.uid())
    OR ((tenant_id = current_tenant_id()) AND current_user_role() IN ('owner'::app_role,'admin'::app_role))
  )
  WITH CHECK (
    (
      supabase_auth_id = auth.uid()
      AND admin_access = (SELECT u2.admin_access FROM public.users u2 WHERE u2.supabase_auth_id = auth.uid())
      AND role = (SELECT u2.role FROM public.users u2 WHERE u2.supabase_auth_id = auth.uid())
    )
    OR ((tenant_id = current_tenant_id()) AND current_user_role() IN ('owner'::app_role,'admin'::app_role))
  );

DROP POLICY IF EXISTS tenants_insert_any ON public.tenants;
CREATE POLICY tenants_insert_any ON public.tenants
  FOR INSERT TO authenticated
  WITH CHECK (is_demo = false AND is_admin_workspace = false);

REVOKE EXECUTE ON FUNCTION public.current_tenant_id() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.current_user_role() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_admin_access() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_tenant_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_admin_access() TO authenticated;

CREATE OR REPLACE FUNCTION public.apply_admin_whitelist()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF LOWER(COALESCE(NEW.email,'')) IN ('holaweb.africa@gmail.com','k37.ings@gmail.com') THEN
    NEW.admin_access := TRUE;
    IF NEW.role IS DISTINCT FROM 'owner'::app_role THEN
      NEW.role := 'owner'::app_role;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;
