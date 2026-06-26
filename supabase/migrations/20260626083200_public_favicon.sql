-- Update public_get_booking_page to include favicon_url (backward compatible - returns null for existing tenants)
CREATE OR REPLACE FUNCTION public.public_get_booking_page(_slug TEXT)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE t RECORD; result JSONB;
BEGIN
  SELECT id, name, slug, brand_color, logo_url, favicon_url, timezone, default_currency, intake_form, buffer_minutes, country_code
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