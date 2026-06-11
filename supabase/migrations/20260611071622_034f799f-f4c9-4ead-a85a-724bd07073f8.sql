
-- Normalize legacy 'pending' conversation status to 'waiting' before adding constraint
UPDATE public.conversations SET status = 'waiting' WHERE status = 'pending';

-- 1. Tenant default currency
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS default_currency text NOT NULL DEFAULT 'NGN';

UPDATE public.tenants SET default_currency = CASE
  WHEN country_code = 'ZA' THEN 'ZAR'
  WHEN country_code = 'KE' THEN 'KES'
  WHEN country_code = 'GH' THEN 'GHS'
  WHEN country_code = 'UG' THEN 'UGX'
  WHEN country_code = 'TZ' THEN 'TZS'
  WHEN country_code = 'RW' THEN 'RWF'
  WHEN country_code = 'US' THEN 'USD'
  WHEN country_code = 'GB' THEN 'GBP'
  WHEN country_code IN ('FR','DE','ES','IT','NL','BE','PT','IE') THEN 'EUR'
  ELSE default_currency
END;

-- 2. Customer status + last_seen
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS last_seen_at timestamptz;

DO $$ BEGIN
  ALTER TABLE public.customers
    ADD CONSTRAINT customers_status_check CHECK (status IN ('active','inactive','blocked'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS customers_last_seen_idx
  ON public.customers (tenant_id, COALESCE(last_seen_at, first_seen) DESC);

-- 3. Booking reasons + updated_at
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS cancellation_reason text,
  ADD COLUMN IF NOT EXISTS no_show_reason text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS bookings_tenant_starts_idx
  ON public.bookings (tenant_id, starts_at DESC);

-- 4. Conversation assignment + index
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS assigned_staff_id uuid REFERENCES public.staff(id) ON DELETE SET NULL;

DO $$ BEGIN
  ALTER TABLE public.conversations
    ADD CONSTRAINT conversations_status_check CHECK (status IN ('open','waiting','resolved'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS conversations_tenant_updated_idx
  ON public.conversations (tenant_id, COALESCE(last_message_at, created_at) DESC);

-- 5. touch_updated_at trigger
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS bookings_touch ON public.bookings;
CREATE TRIGGER bookings_touch BEFORE UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 6. message_templates table
CREATE TABLE IF NOT EXISTS public.message_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  category text NOT NULL DEFAULT 'custom',
  body text NOT NULL,
  status text NOT NULL DEFAULT 'approved',
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.message_templates TO authenticated;
GRANT ALL ON public.message_templates TO service_role;

ALTER TABLE public.message_templates ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "message_templates_tenant" ON public.message_templates
    FOR ALL TO authenticated
    USING (tenant_id = public.current_tenant_id())
    WITH CHECK (tenant_id = public.current_tenant_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS message_templates_tenant_idx
  ON public.message_templates (tenant_id);

-- 7. messages direction + delivery status
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS direction text NOT NULL DEFAULT 'inbound',
  ADD COLUMN IF NOT EXISTS delivery_status text NOT NULL DEFAULT 'sent';

DO $$ BEGIN
  ALTER TABLE public.messages
    ADD CONSTRAINT messages_direction_check CHECK (direction IN ('inbound','outbound'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.messages
    ADD CONSTRAINT messages_delivery_status_check CHECK (delivery_status IN ('sent','delivered','read','failed'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
