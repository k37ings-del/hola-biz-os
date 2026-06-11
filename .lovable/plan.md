## Scope decision

You picked: customer-facing first, real CRUD against the signed-in user's tenant, full admin spec. That is realistically **5+ build passes**. This plan covers **Pass 1** in detail and sketches passes 2–5 so we agree on the shape before I start.

I will NOT touch the existing demo tenant (Glam Studio Lagos) or HQ tenant data. New CRUD writes against `current_tenant_id()`.

---

## Pass 1 — Foundations + Inbox + Customers + Bookings

### 1.1 Fix the hydration error (blocking)

`src/routes/auth.tsx` likely renders a `<Suspense>` boundary or branches on `typeof window`. The diff in the runtime error shows server emitted `<Suspense>`, client emitted `<div>`. Fix: mark `/auth` as `ssr: false` (it's a client-only auth flow anyway) and remove any `typeof window` branches in its render path.

### 1.2 DB / migration work

Add to existing tables (no new tables needed for Pass 1):

- `tenants.default_currency text not null default 'NGN'` — editable per tenant, drives all money formatting. Backfill existing rows from country.
- `bookings.cancellation_reason text`, `bookings.no_show_reason text`.
- `customers.status text not null default 'active'` check in ('active','inactive','blocked'); `customers.notes text`.
- `conversations.assigned_staff_id uuid references staff(id)`; ensure `status` check in ('open','waiting','resolved').
- Indexes: `bookings (tenant_id, starts_at desc)`, `conversations (tenant_id, updated_at desc)`, `customers (tenant_id, last_seen_at desc)`.

RLS: every table already scoped by `current_tenant_id()`. Verify policies cover INSERT/UPDATE/DELETE for `owner`/`admin`/`manager`. Add missing ones. GRANTs to `authenticated` + `service_role`.

### 1.3 Shared UI primitives (built once, reused everywhere)

Create under `src/components/shell/`:

- `PageHeader` — H1 + subtitle + actions slot. Sets `<title>` via TanStack `head()`.
- `StatCardGrid` + `StatCard` — 3–4 KPI cards.
- `DataToolbar` — search input + filter chips + sort dropdown.
- `SlideOver` — right-drawer 480px, sticky footer, dirty-state warn-on-close, ESC + backdrop close.
- `ConfirmDialog` — destructive confirmation w/ reason field option.
- `EmptyState` — icon + title + description + CTA.
- `StatusBadge` — single component, variant per status (confirmed/pending/cancelled/completed/no-show/active/inactive/blocked/open/waiting/resolved).
- `SkeletonTable` — shimmer rows with 300ms artificial delay helper.
- `MoneyText` — reads tenant `default_currency`, formats `ZAR 299.00` style. Replaces hardcoded NGN/₦ everywhere.
- `PhoneText` — international format.
- `RelativeTime` / `AbsoluteDateTime`.
- Mobile: sidebar collapses to bottom nav via existing `useIsMobile`.

Toasts already via `sonner`. Pagination util (10/page default, "Load more" pattern).

### 1.4 Tenant-currency wiring

- `useTenantCurrency()` hook reads from `useCurrentUser().tenant.default_currency`.
- Settings → Business profile gets a Currency dropdown (NGN, ZAR, KES, GHS, UGX, TZS, RWF, USD, EUR, GBP).
- Service create/edit currency field defaults to tenant currency but is overridable per-service (already in schema).
- All `formatCurrency` calls switch to use tenant currency by default.

### 1.5 Inbox module (`/inbox`)

- Server fns: `listConversations`, `getConversation(id)`, `sendMessage`, `updateConversationStatus`, `assignConversation`, `listTemplates`.
- Two-pane layout (left 320px list, right thread). Mobile: list-or-thread, not both.
- Status tabs, unread toggle, search by name/phone.
- WhatsApp-style chat bubbles, delivery-status icons, customer header with booking count + "View customer" link.
- Composer: textarea + Send + Template picker modal + Attach (disabled tooltip).
- Template picker: read approved rows from a new lightweight `message_templates` view (filter `notifications`/seed table) — for Pass 1, seed 8 generic templates per tenant on first load via server fn.
- Empty states for both panes.

### 1.6 Customers module (`/customers`)

- Server fns: `listCustomers`, `getCustomer(id)`, `updateCustomer`, `blockCustomer`, `bulkAction`, `getCustomerStats`.
- 4 stat cards. Sortable table with checkbox multi-select. Search + status + date-range filters.
- Slide-over with Overview / Conversation / Notes tabs. Notes auto-save (debounced server fn).
- Bulk action bar: Export (CSV), Block, Send template.
- Empty state.

### 1.7 Bookings module (`/bookings`)

- Server fns: `listBookings`, `getBooking`, `createBooking`, `updateBookingStatus`, `cancelBooking`, `sendPaymentReminder`, `getBookingStats`, `availableSlots(staffId, serviceId, date)`.
- 4 stat cards. Table view + Calendar view toggle (week default, month/day toggles). Use `react-day-picker` (already shadcn) for date filters; build a minimal week-grid calendar in-house (no new heavy lib).
- Filters: status, date range, staff, service, search.
- Slide-over detail with Customer / Appointment / Payment / Timeline sections + action row with cancel/no-show reason dialogs.
- New booking slide-over with cascading selectors. Payment: send-link / mark-paid / pay-later.
- Empty state.

---

## Pass 2 — Services + Staff

Drag-reorder services (dnd-kit), buffer/deposit/booking-window rules, weekly availability grid, color picker, staff↔services assignment. New table: `staff_services` join, `staff_availability` weekly rows + `staff_overrides` date rows.

## Pass 3 — Settings (6 tabs)

Business profile (with logo upload to Lovable Cloud storage — adds 1 bucket), WhatsApp setup (placeholder cards — actual Meta connection deferred), Booking rules → write to `tenant_settings`, Notifications → new `notification_preferences` table, Payments → reuses `gateway_config`, Subscription/billing → reads `tenants.plan_tier`, shows static plan cards.

## Pass 4 — Admin expansion

Keep current `/admin`. Add sub-nav: Overview (charts via recharts — already installed), Tenants (expand current table + create/impersonate), WhatsApp numbers, Support queue (new `support_tickets` table), Platform settings (new `platform_settings` singleton table with feature flags + announcement).

**Impersonation** is non-trivial — it needs an "acting_as_tenant_id" override on every server fn that currently uses `current_tenant_id()`. I'll implement it via a signed cookie set by a super-admin-only `startImpersonation` server fn, read by a new `effective_tenant_id()` SQL function used by RLS. Flagging this as the riskiest part of the whole spec.

## Pass 5 — Polish

Mobile bottom nav, skeleton states everywhere, role-based redirect guard with toast, "Admin mode" banner styling, accessibility pass, full Cypress-style manual test of every CRUD path.

---

## Out of scope / explicit deferrals

- Real WhatsApp Meta connection (UI only; no API calls).
- Real payment gateway connections (UI + `gateway_config` row only; no Paystack/MPesa SDK).
- CSV export beyond a simple client-side download.
- Email notifications (toggles persist; no SMTP wiring).
- Logo upload requires creating a Cloud storage bucket (Pass 3).

---

## What I need from you before I start Pass 1

1. **Confirm Pass 1 scope** as written, OR trim it (e.g. "skip Calendar view in Pass 1, table only").
2. **Currency default for NEW tenants** — keep NGN, or switch to "ask during signup"? (Existing tenants get migrated from country code.)
3. **Calendar view in Pass 1 or Pass 2?** Building a usable week-grid with drag-resize is ~1 full pass on its own. Recommend Pass 1 = table view only, Pass 2 ships the calendar with Services/Staff.

Once you answer those three, I start Pass 1 (hydration fix + migration + shared primitives + Inbox + Customers + Bookings table view). Expect that to be one large build response; the other passes follow one at a time.