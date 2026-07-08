-- 1. Drop Inbox tables (destructive — user confirmed)
DROP TABLE IF EXISTS public.messages CASCADE;
DROP TABLE IF EXISTS public.conversations CASCADE;
DROP TABLE IF EXISTS public.message_templates CASCADE;

-- 2. Link users → staff for personal schedule view
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS staff_id UUID REFERENCES public.staff(id) ON DELETE SET NULL;

-- 3. Update customer portal to expose staff.wa_number for WhatsApp deep-link
CREATE OR REPLACE FUNCTION public.public_get_customer_portal(_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE b RECORD; t RECORD; s RECORD; st RECORD; history JSONB;
BEGIN
  SELECT * INTO b FROM public.bookings WHERE portal_token = _token LIMIT 1;
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT name, slug, brand_color, logo_url, timezone, email AS tenant_email INTO t FROM public.tenants WHERE id = b.tenant_id;
  SELECT name, duration_minutes, price_cents, currency INTO s FROM public.services WHERE id = b.service_id;
  SELECT name, photo_url, wa_number, email INTO st FROM public.staff WHERE id = b.staff_id;
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', x.id, 'ref_code', x.ref_code, 'status', x.status,
    'starts_at', x.starts_at, 'ends_at', x.ends_at,
    'service_name', sv.name, 'staff_name', stf.name,
    'cancel_token', x.cancel_token, 'reschedule_token', x.reschedule_token,
    'portal_token', x.portal_token
  ) ORDER BY x.starts_at DESC), '[]'::jsonb) INTO history
  FROM public.bookings x
  LEFT JOIN public.services sv ON sv.id = x.service_id
  LEFT JOIN public.staff stf ON stf.id = x.staff_id
  WHERE x.tenant_id = b.tenant_id
    AND ((b.customer_email IS NOT NULL AND x.customer_email = b.customer_email)
      OR (b.customer_phone IS NOT NULL AND x.customer_phone = b.customer_phone));
  RETURN jsonb_build_object(
    'booking', jsonb_build_object('id', b.id, 'ref_code', b.ref_code, 'status', b.status,
      'starts_at', b.starts_at, 'ends_at', b.ends_at, 'amount_cents', b.amount_cents, 'currency', b.currency,
      'customer_name', b.customer_name, 'customer_email', b.customer_email, 'customer_phone', b.customer_phone,
      'cancel_token', b.cancel_token, 'reschedule_token', b.reschedule_token),
    'service', to_jsonb(s),
    'staff', CASE WHEN st IS NULL THEN NULL ELSE to_jsonb(st) END,
    'tenant', to_jsonb(t),
    'history', history
  );
END $function$;