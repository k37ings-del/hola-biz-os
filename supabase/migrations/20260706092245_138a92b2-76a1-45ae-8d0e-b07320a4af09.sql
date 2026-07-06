
-- Refresh linked customer PII when an admin edits booking name/email/phone
CREATE OR REPLACE FUNCTION public.bookings_refresh_customer_on_update()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.customer_id IS NULL THEN RETURN NEW; END IF;
  IF (COALESCE(NEW.customer_name,'') IS DISTINCT FROM COALESCE(OLD.customer_name,''))
     OR (COALESCE(NEW.customer_email,'') IS DISTINCT FROM COALESCE(OLD.customer_email,''))
     OR (COALESCE(NEW.customer_phone,'') IS DISTINCT FROM COALESCE(OLD.customer_phone,'')) THEN
    UPDATE public.customers
      SET display_name = COALESCE(NULLIF(trim(NEW.customer_name),''), display_name),
          email = COALESCE(lower(NULLIF(trim(NEW.customer_email),'')), email),
          wa_phone = COALESCE(NULLIF(trim(NEW.customer_phone),''), wa_phone),
          last_seen_at = now()
      WHERE id = NEW.customer_id;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS bookings_refresh_customer_on_update_trg ON public.bookings;
CREATE TRIGGER bookings_refresh_customer_on_update_trg
  AFTER UPDATE OF customer_name, customer_email, customer_phone ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.bookings_refresh_customer_on_update();
