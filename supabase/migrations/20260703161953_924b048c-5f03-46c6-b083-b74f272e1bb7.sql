-- 1. Auto-link booking → customer
DROP TRIGGER IF EXISTS bookings_link_customer_trg ON public.bookings;
CREATE TRIGGER bookings_link_customer_trg
  BEFORE INSERT ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.bookings_link_customer();

-- 2. Staff-photos bucket policies (bucket already created via tool)
DROP POLICY IF EXISTS "staff_photos_tenant_read" ON storage.objects;
CREATE POLICY "staff_photos_tenant_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'staff-photos' AND (storage.foldername(name))[1] = (public.current_tenant_id())::text);

DROP POLICY IF EXISTS "staff_photos_tenant_write" ON storage.objects;
CREATE POLICY "staff_photos_tenant_write" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'staff-photos' AND (storage.foldername(name))[1] = (public.current_tenant_id())::text);

DROP POLICY IF EXISTS "staff_photos_tenant_update" ON storage.objects;
CREATE POLICY "staff_photos_tenant_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'staff-photos' AND (storage.foldername(name))[1] = (public.current_tenant_id())::text);

DROP POLICY IF EXISTS "staff_photos_tenant_delete" ON storage.objects;
CREATE POLICY "staff_photos_tenant_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'staff-photos' AND (storage.foldername(name))[1] = (public.current_tenant_id())::text);

-- 3. Restrict SELECT on calendar_connections
DROP POLICY IF EXISTS calendar_connections_tenant ON public.calendar_connections;
DROP POLICY IF EXISTS calendar_connections_select ON public.calendar_connections;
DROP POLICY IF EXISTS calendar_connections_write ON public.calendar_connections;

CREATE POLICY calendar_connections_select ON public.calendar_connections
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND (
      public.current_user_role() IN ('owner', 'admin')
      OR EXISTS (
        SELECT 1 FROM public.staff s
        JOIN public.users u ON u.tenant_id = s.tenant_id
        WHERE s.id = calendar_connections.staff_id
          AND u.supabase_auth_id = auth.uid()
          AND LOWER(COALESCE(s.email, '')) = LOWER(COALESCE(u.email, ''))
      )
    )
  );

CREATE POLICY calendar_connections_write ON public.calendar_connections
  FOR ALL TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.current_user_role() IN ('owner', 'admin')
  )
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.current_user_role() IN ('owner', 'admin')
  );