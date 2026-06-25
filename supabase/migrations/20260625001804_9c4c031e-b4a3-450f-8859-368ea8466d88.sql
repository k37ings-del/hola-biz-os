CREATE OR REPLACE FUNCTION public.public_request_portal_link(_contact text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  c TEXT := trim(_contact);
  is_email BOOLEAN;
  norm_email TEXT;
  norm_phone TEXT;
  b RECORD;
  t RECORD;
BEGIN
  IF c IS NULL OR length(c) < 4 THEN RETURN NULL; END IF;
  is_email := position('@' in c) > 0;
  IF is_email THEN
    norm_email := lower(c);
    SELECT * INTO b FROM public.bookings
      WHERE customer_email = norm_email
        AND status IN ('PENDING_PAYMENT','CONFIRMED','COMPLETED')
      ORDER BY (starts_at >= now()) DESC, starts_at DESC
      LIMIT 1;
  ELSE
    -- normalize phone: strip non-digit (keep last 9-12 digits for fuzzy match)
    norm_phone := regexp_replace(c, '[^0-9]', '', 'g');
    IF length(norm_phone) < 6 THEN RETURN NULL; END IF;
    SELECT * INTO b FROM public.bookings
      WHERE regexp_replace(COALESCE(customer_phone,''), '[^0-9]', '', 'g') LIKE '%' || right(norm_phone, 9)
        AND status IN ('PENDING_PAYMENT','CONFIRMED','COMPLETED')
      ORDER BY (starts_at >= now()) DESC, starts_at DESC
      LIMIT 1;
  END IF;
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT name, slug, brand_color, logo_url, email AS tenant_email INTO t
    FROM public.tenants WHERE id = b.tenant_id;
  RETURN jsonb_build_object(
    'portal_token', b.portal_token,
    'customer_name', b.customer_name,
    'customer_email', b.customer_email,
    'customer_phone', b.customer_phone,
    'tenant_name', t.name,
    'tenant_email', t.tenant_email,
    'brand_color', t.brand_color,
    'logo_url', t.logo_url
  );
END $function$;

REVOKE EXECUTE ON FUNCTION public.public_request_portal_link(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_request_portal_link(text) TO anon, authenticated;