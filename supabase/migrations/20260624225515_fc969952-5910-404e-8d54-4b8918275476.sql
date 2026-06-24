REVOKE EXECUTE ON FUNCTION public.has_admin_access() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.current_tenant_id() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.current_user_role() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_platform_metrics() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.apply_admin_whitelist() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.waitlist_offer_on_cancel() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.bookings_set_tokens() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.public_get_booking_page(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.public_get_availability(uuid, uuid, uuid, date) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.public_create_booking(uuid, uuid, uuid, timestamptz, text, text, text, jsonb, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.public_get_booking_by_token(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.public_cancel_booking(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.public_reschedule_booking(text, timestamptz) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.public_get_waitlist_offer(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.public_join_waitlist(uuid, uuid, uuid, text, text, text, timestamptz, timestamptz, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.public_claim_waitlist_slot(text) TO anon, authenticated;