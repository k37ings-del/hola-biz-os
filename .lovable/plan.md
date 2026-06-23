# HolaWeb Appointments & Commerce OS — Build Plan

This is a multi-week scope. I'll break it into phases so we can ship value each turn instead of one mega-change that breaks half the app. Confirm the phase order (or re-order) and I'll start with Phase 1 next turn.

## Positioning & instant fixes (this turn, if you approve)
1. Re-brand the app shell, meta titles, and marketing copy from "Business OS / booking system" to **HolaWeb Appointments & Commerce OS**.
2. Fix the sign-up country default: stop hard-defaulting to Nigeria. On registration, detect country from the browser (`Intl.DateTimeFormat().resolvedOptions().timeZone` + `navigator.language`) as a suggestion, but the user picks the country in the form and the tenant's `country` + `default_currency` are set from that selection only.
3. Remove any remaining salon-specific copy/icons (already partially done) and audit the Holaweb tenant so it shows ZAR + South Africa, not Lagos.

## Phase 1 — Customer-facing booking flow (public)
- Public route `/{tenant-slug}/book` (and later custom domain), mobile-first, white-label (logo, primary color, business name from `tenants`/`tenant_settings`).
- Wizard: Service → Staff (optional) → Date → Time slot → Customer info → Intake form → Summary → Pay → Confirmation.
- Real-time availability using staff working hours + existing bookings + service `duration_minutes` + configurable buffer.
- Timezone auto-detect, multi-location aware (schema additions: `locations` table, `staff.location_id`).
- Backed by public-read server functions (publishable key + narrow anon SELECT on services/staff/availability views).

## Phase 2 — Booking lifecycle & ops
- Reschedule + cancel links (signed token, no login required for the customer).
- Waiting list table + auto-notify when a slot frees.
- Recurring availability & buffer times in Staff → Schedule.
- Automated reminders/follow-ups (scheduled via pg_cron → `/api/public/cron/*` route).

## Phase 3 — Finance module
- New `/finance` route consolidating Invoices, Payments, Refunds, Payouts (replaces the current placeholder pages).
- Schema: extend `invoices`, `payments`; add `refunds`, `payouts`.
- Per-tenant payment provider config in `tenant_settings`.

## Phase 4 — Payment provider integrations
Ship one at a time, each behind a provider adapter interface:
PayFast, Ozow, Yoco, Peach, Paystack, Flutterwave, Stripe. Webhooks under `/api/public/webhooks/{provider}` with signature verification.

## Phase 5 — Calendar & meeting integrations
Google Calendar, Outlook, Zoom, Google Meet — per-staff OAuth, two-way sync, auto-create meeting link on confirmation.

## Phase 6 — WhatsApp Cloud API
Outbound confirmations/reminders + inbound webhook into the existing Inbox module.

## Phase 7 — Automation module
`/automations` UI to configure triggers (booking confirmed, 24h before, payment overdue, post-visit review, follow-up campaign) → channels (WhatsApp, email, SMS). Stored as rules executed by the cron worker.

## Phase 8 — Analytics module
`/analytics` with revenue, bookings, customer growth, service & staff performance, conversion funnel. Server-side aggregates, charts via Recharts.

## Phase 9 — AI features (via Lovable AI Gateway, `google/gemini-3-flash-preview`)
- AI Booking Assistant (chat that books on the public site).
- AI Receptionist (auto-replies in Inbox).
- AI Customer Summary (per-customer profile card).
- AI Suggested Follow-Ups (per booking).

## Phase 10 — Polish pass
Modernize cards/tables/forms, tighten visual hierarchy, accessibility, dark-mode audit, empty/loading/error states everywhere.

## Technical notes (for me, not blocking)
- All new tables: `GRANT` + RLS scoped to `current_tenant_id()`; public booking surface uses narrow `TO anon` SELECT policies on a curated view, never the raw tables.
- All app-internal calls = `createServerFn`. Webhooks/cron = `/api/public/*` server routes with signature verification.
- Custom domain support reuses Lovable's existing domain plumbing per tenant.

## Question for you
Do you want me to:
**(A)** Do the positioning + country/currency fix **this turn**, then start Phase 1 next turn, **or**
**(B)** Jump straight into Phase 1 (customer-facing booking flow) and bundle the rebrand into it?

Also: any phase you want re-ordered or dropped? (E.g. if WhatsApp or Stripe is urgent, I'll move it earlier.)