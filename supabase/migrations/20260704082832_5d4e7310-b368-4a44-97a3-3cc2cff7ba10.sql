
-- 1) Tighten waiting_list RLS: only tenant owners/admins may access rows (which
--    hold claim_token + customer PII). The intended customer recipient reaches
--    their row via SECURITY DEFINER RPCs (public_get_waitlist_offer / claim),
--    which bypass RLS. Other staff no longer see claim tokens or contacts.
DROP POLICY IF EXISTS waiting_list_tenant ON public.waiting_list;

CREATE POLICY waiting_list_admin_read ON public.waiting_list
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.current_user_role() IN ('owner'::app_role, 'admin'::app_role, 'manager'::app_role)
  );

CREATE POLICY waiting_list_admin_write ON public.waiting_list
  FOR ALL TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.current_user_role() IN ('owner'::app_role, 'admin'::app_role, 'manager'::app_role)
  )
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.current_user_role() IN ('owner'::app_role, 'admin'::app_role, 'manager'::app_role)
  );

-- 2) Fix "Martin Testing" bug: when a booking is placed, refresh the linked
--    customer's display_name / email / phone with the values from the new
--    booking so the customer directory always reflects the latest form input.
CREATE OR REPLACE FUNCTION public.bookings_link_customer()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE cust_id uuid;
BEGIN
  IF NEW.customer_id IS NOT NULL THEN RETURN NEW; END IF;
  IF COALESCE(NEW.customer_email, NEW.customer_phone) IS NULL THEN RETURN NEW; END IF;

  SELECT id INTO cust_id FROM public.customers
    WHERE tenant_id = NEW.tenant_id
      AND ((NEW.customer_email IS NOT NULL AND lower(email) = lower(NEW.customer_email))
        OR (NEW.customer_phone IS NOT NULL AND wa_phone = NEW.customer_phone))
    ORDER BY first_seen ASC LIMIT 1;

  IF cust_id IS NULL THEN
    INSERT INTO public.customers (tenant_id, display_name, email, wa_phone, status, booking_count, first_seen, last_seen_at)
    VALUES (NEW.tenant_id,
            COALESCE(NULLIF(trim(NEW.customer_name),''), 'Customer'),
            lower(NULLIF(trim(NEW.customer_email),'')),
            NULLIF(trim(NEW.customer_phone),''),
            'active', 1, now(), now())
    RETURNING id INTO cust_id;
  ELSE
    -- Always refresh with the freshest details from the booking form
    UPDATE public.customers
      SET booking_count = COALESCE(booking_count,0) + 1,
          last_seen_at = now(),
          display_name = COALESCE(NULLIF(trim(NEW.customer_name),''), display_name),
          email = COALESCE(lower(NULLIF(trim(NEW.customer_email),'')), email),
          wa_phone = COALESCE(NULLIF(trim(NEW.customer_phone),''), wa_phone)
      WHERE id = cust_id;
  END IF;

  NEW.customer_id := cust_id;
  RETURN NEW;
END $$;
