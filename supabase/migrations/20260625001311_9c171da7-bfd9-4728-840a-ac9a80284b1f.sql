
-- Lock down EXECUTE on SECURITY DEFINER functions. Revoke from PUBLIC, then grant
-- to the specific roles each function is actually meant for.

-- Trigger-only functions: not callable by anyone via the API.
REVOKE EXECUTE ON FUNCTION public.apply_admin_whitelist() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.touch_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.bookings_set_tokens() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.bookings_set_portal_token() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.staff_set_ics_token() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.waitlist_offer_on_cancel() FROM PUBLIC, anon, authenticated;

-- Auth helpers: only signed-in users need them.
REVOKE EXECUTE ON FUNCTION public.has_admin_access() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.current_tenant_id() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.current_user_role() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_admin_access() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_tenant_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_role() TO authenticated;

-- Admin-only metrics: function self-checks has_admin_access(); restrict execute to authenticated.
REVOKE EXECUTE ON FUNCTION public.admin_platform_metrics() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_platform_metrics() TO authenticated;

-- Public-facing booking / portal / waitlist RPCs: intentionally callable by anon.
REVOKE EXECUTE ON FUNCTION public.public_create_booking(uuid, uuid, uuid, timestamptz, text, text, text, jsonb, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_create_booking(uuid, uuid, uuid, timestamptz, text, text, text, jsonb, text) TO anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.public_get_booking_page(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_get_booking_page(text) TO anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.public_get_availability(uuid, uuid, uuid, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_get_availability(uuid, uuid, uuid, date) TO anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.public_get_customer_portal(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_get_customer_portal(text) TO anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.public_cancel_booking(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_cancel_booking(text, text) TO anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.public_get_booking_by_token(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_get_booking_by_token(text, text) TO anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.public_get_staff_ics(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_get_staff_ics(text) TO anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.public_reschedule_booking(text, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_reschedule_booking(text, timestamptz) TO anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.public_get_waitlist_offer(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_get_waitlist_offer(text) TO anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.public_join_waitlist(uuid, uuid, uuid, text, text, text, timestamptz, timestamptz, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_join_waitlist(uuid, uuid, uuid, text, text, text, timestamptz, timestamptz, text) TO anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.public_claim_waitlist_slot(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_claim_waitlist_slot(text) TO anon, authenticated;
