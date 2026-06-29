
-- Auto-link/create customer record on booking insert, and update last_seen on confirmation
CREATE OR REPLACE FUNCTION public.bookings_link_customer()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
    VALUES (NEW.tenant_id, COALESCE(NULLIF(trim(NEW.customer_name),''), 'Customer'),
            lower(NULLIF(trim(NEW.customer_email),'')), NULLIF(trim(NEW.customer_phone),''),
            'active', 1, now(), now())
    RETURNING id INTO cust_id;
  ELSE
    UPDATE public.customers
      SET booking_count = COALESCE(booking_count,0) + 1,
          last_seen_at = now(),
          display_name = COALESCE(NULLIF(display_name,''), NEW.customer_name)
      WHERE id = cust_id;
  END IF;

  NEW.customer_id := cust_id;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS bookings_link_customer_trg ON public.bookings;
CREATE TRIGGER bookings_link_customer_trg
  BEFORE INSERT ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.bookings_link_customer();

-- Backfill: link existing bookings that lack a customer_id
DO $$
DECLARE r RECORD; cust_id uuid;
BEGIN
  FOR r IN SELECT id, tenant_id, customer_name, customer_email, customer_phone FROM public.bookings
           WHERE customer_id IS NULL AND COALESCE(customer_email, customer_phone) IS NOT NULL LOOP
    SELECT id INTO cust_id FROM public.customers
      WHERE tenant_id = r.tenant_id
        AND ((r.customer_email IS NOT NULL AND lower(email) = lower(r.customer_email))
          OR (r.customer_phone IS NOT NULL AND wa_phone = r.customer_phone))
      LIMIT 1;
    IF cust_id IS NULL THEN
      INSERT INTO public.customers (tenant_id, display_name, email, wa_phone, status, booking_count, first_seen, last_seen_at)
      VALUES (r.tenant_id, COALESCE(NULLIF(trim(r.customer_name),''),'Customer'),
              lower(NULLIF(trim(r.customer_email),'')), NULLIF(trim(r.customer_phone),''),
              'active', 1, now(), now())
      RETURNING id INTO cust_id;
    END IF;
    UPDATE public.bookings SET customer_id = cust_id WHERE id = r.id;
  END LOOP;
END $$;
