ALTER TABLE public.staff
  ADD COLUMN IF NOT EXISTS notify_email_on_booking boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_calendar_invite boolean NOT NULL DEFAULT true;