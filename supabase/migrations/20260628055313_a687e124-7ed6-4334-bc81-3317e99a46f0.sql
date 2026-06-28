
ALTER FUNCTION public.bookings_set_tokens() SET search_path = public, extensions;
ALTER FUNCTION public.bookings_set_portal_token() SET search_path = public, extensions;
ALTER FUNCTION public.staff_set_ics_token() SET search_path = public, extensions;
ALTER FUNCTION public.waitlist_offer_on_cancel() SET search_path = public, extensions;

CREATE OR REPLACE FUNCTION public.bookings_enqueue_confirmation()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
BEGIN
  IF (TG_OP = 'INSERT' AND NEW.status IN ('PENDING_PAYMENT','CONFIRMED'))
     OR (TG_OP = 'UPDATE' AND NEW.status = 'CONFIRMED' AND OLD.status IS DISTINCT FROM 'CONFIRMED') THEN
    INSERT INTO public.automation_runs (tenant_id, booking_id, automation_id, trigger_type, payload, status, scheduled_at)
    VALUES (NEW.tenant_id, NEW.id, NULL,
      CASE WHEN TG_OP='INSERT' THEN 'booking_created' ELSE 'booking_confirmed' END,
      jsonb_build_object('booking_id', NEW.id), 'pending', now());
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS bookings_enqueue_confirmation_ins ON public.bookings;
CREATE TRIGGER bookings_enqueue_confirmation_ins
AFTER INSERT ON public.bookings
FOR EACH ROW EXECUTE FUNCTION public.bookings_enqueue_confirmation();

DROP TRIGGER IF EXISTS bookings_enqueue_confirmation_upd ON public.bookings;
CREATE TRIGGER bookings_enqueue_confirmation_upd
AFTER UPDATE OF status ON public.bookings
FOR EACH ROW EXECUTE FUNCTION public.bookings_enqueue_confirmation();

DROP POLICY IF EXISTS "tenant_logos_auth_read" ON storage.objects;
CREATE POLICY "tenant_logos_auth_read" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'tenant-logos');

DROP POLICY IF EXISTS "tenant_logos_member_write" ON storage.objects;
CREATE POLICY "tenant_logos_member_write" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'tenant-logos' AND (storage.foldername(name))[1] = public.current_tenant_id()::text);

DROP POLICY IF EXISTS "tenant_logos_member_update" ON storage.objects;
CREATE POLICY "tenant_logos_member_update" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'tenant-logos' AND (storage.foldername(name))[1] = public.current_tenant_id()::text);

DROP POLICY IF EXISTS "tenant_logos_member_delete" ON storage.objects;
CREATE POLICY "tenant_logos_member_delete" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'tenant-logos' AND (storage.foldername(name))[1] = public.current_tenant_id()::text);

CREATE OR REPLACE FUNCTION public.admin_delete_booking(_booking_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_admin_access() THEN RAISE EXCEPTION 'forbidden'; END IF;
  DELETE FROM public.automation_runs WHERE booking_id = _booking_id;
  DELETE FROM public.bookings WHERE id = _booking_id;
  RETURN jsonb_build_object('ok', true);
END $$;

CREATE OR REPLACE FUNCTION public.admin_delete_tenant(_tenant_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_admin_access() THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF EXISTS (SELECT 1 FROM public.tenants WHERE id = _tenant_id AND is_admin_workspace = true) THEN
    RAISE EXCEPTION 'cannot_delete_admin_workspace';
  END IF;
  DELETE FROM public.tenants WHERE id = _tenant_id;
  RETURN jsonb_build_object('ok', true);
END $$;

REVOKE EXECUTE ON FUNCTION public.admin_delete_booking(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_delete_tenant(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_delete_booking(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_tenant(uuid) TO authenticated;
