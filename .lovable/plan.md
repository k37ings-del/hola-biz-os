# Implementation Plan

## 1. Navigation restructure

- **New `/crm` route** with tabs: Bookings | Customers. Old `/bookings` and `/customers` become thin redirect files → `/crm?tab=bookings|customers`. Existing components extracted into `<BookingsTab />` and `<CustomersTab />` and rendered inside `/crm`.
- **Dashboard**: add a "Calendar" tile linking to `/calendar`. Keep `/calendar` route intact.
- **Sidebar**: remove Calendar, Inbox, Schedule, Automations, Staff. Sidebar becomes: Dashboard, CRM, Services, Finance, Invoices, Payments, Settings (+ Admin/Demo for super-admins).
- **Settings page** gains new tabs: General, Branding, Notifications, **Schedule**, **Automations**, **Staff**, **Integrations**, Billing (existing tabs preserved).
  - Schedule tab shows only the signed-in user's own staff row (matched by `users.email` → `staff.email`). Removes the "Business hours" section entirely.
  - Automations tab hosts current `/automations` UI.
  - Staff tab hosts current `/staff` UI (still tenant-wide for admins/owners).

## 2. Remove Inbox

- Delete `src/routes/_authenticated/inbox.tsx`, sidebar entry, and `src/lib/inbox.functions.ts`.
- Migration drops `public.messages`, `public.conversations`, `public.message_templates` (with CASCADE).

## 3. WhatsApp deep-link on customer portal

- On `/p/$token`, add a prominent "Send WhatsApp message to {staff}" button.
- Requires staff `wa_number`. Builds `https://wa.me/{digits}?text={encoded}` with message:
  `Hello {Staff Name}, I just wanted to confirm with your availability on {date} at {time}. Thank you. {Client Name}`
- Uses tenant timezone for date/time formatting.
- Extend `public_get_customer_portal` RPC to also return `staff.wa_number`.

## 4. Client + staff booking confirmation emails

- Confirmation email to the **client** is already sent by the automation worker. Verify wiring by adding an explicit log line and ensuring `booking_created` triggers regardless of payment. No behavior change if working.
- Add a per-staff "Personal email confirmed" flag inferred from `staff.email` presence — surfaced as a small pill in the staff list ("Email set" / "No personal email").

## 5. "Send test confirmation" button (admin/owner)

- In the Staff tab, per-row action button (visible to admin/owner only) that calls a new `sendStaffTestConfirmation` server function.
- The server fn builds a fake booking payload for the staff member's assigned services (or a stub), respects their `notify_email_on_booking` / `notify_calendar_invite` preferences, and calls the same email/ICS renderer used by the worker. Also sends a copy to the **client-side** confirmation template addressed to a `test_recipient` email (defaults to the admin's own email) so both templates are verifiable in one click.
- Returns `{ staff: {sent, skipped_reason}, client: {sent} }` so the toast shows exactly what happened.

## 6. One-way Google/Outlook push (foundation only)

- Extend `calendar_connections` UI in Settings > Integrations (moved from staff drawer) to accept an ICS feed URL per staff.
- Confirmation emails already deliver `METHOD:REQUEST` ICS to staff — accepting them adds to their calendar. No OAuth this round (per your choice). Add clear copy in the Integrations tab explaining this and that OAuth-based two-way sync is coming.

## 7. Vitest ICS timezone/DST tests

- Add `bun add -d vitest @vitest/coverage-v8`.
- Add `vitest.config.ts` and `src/lib/__tests__/ics-invite.test.ts` covering `buildIcsInvite`:
  - Africa/Lagos (no DST) — verifies UTC instant equals local time - 1h.
  - Europe/London around BST start (2026-03-29 01:30 UTC) and end (2026-10-25 01:30 UTC).
  - America/New_York around DST spring-forward (2026-03-08) and fall-back (2026-11-01).
  - Assertion: `DTSTART`/`DTEND` are absolute UTC (`Z`-suffixed) and equal the expected UTC ISO for a booking scheduled at each tenant's local wall-clock time.
- Extract `buildIcsInvite` from `run-automations.ts` into `src/lib/ics-invite.ts` so it's importable by tests and by the route handler.

## 8. Hydration fix

- `src/routes/auth.tsx` renders under `_authenticated`? No — it's public. Wrap client-only branch (any `typeof window` in Google OAuth logic) so SSR/CSR markup matches.

## Technical notes

- `/crm` uses TanStack Router `search` schema `{ tab: 'bookings' | 'customers' }` with `bookings` default.
- Sidebar link count drops from ~11 to 7 for non-admins. Existing deep links like `/bookings` still work via redirect route files (`createFileRoute` → `beforeLoad: throw redirect`).
- Migration is destructive for inbox tables — you confirmed drop.
- No route file removals for `/staff`, `/automations`, `/schedule` yet: convert them to redirect files pointing to `/settings?tab=staff|automations|schedule` so any bookmarks still work.

## Out of scope this round (per your answers)

- Full two-way Google/Outlook OAuth sync (deferred).
- Any changes to booking write path or public booking schema.

Reply "go" to implement.