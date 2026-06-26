import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const DEMO_TENANT_ID = "11111111-1111-1111-1111-111111111111";

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from("users")
    .select("admin_access, role")
    .eq("supabase_auth_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!data?.admin_access || !["owner", "admin"].includes(data.role)) {
    throw new Error("Forbidden");
  }
}

export const getDemoSnapshot = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [tenant, customers, bookings, services, staff, payments, invoices] = await Promise.all([
      supabaseAdmin.from("tenants").select("*").eq("id", DEMO_TENANT_ID).single(),
      supabaseAdmin
        .from("customers")
        .select("id, display_name, phone, email, created_at")
        .eq("tenant_id", DEMO_TENANT_ID)
        .order("created_at", { ascending: false })
        .limit(50),
      supabaseAdmin
        .from("bookings")
        .select("id, ref_code, status, starts_at, amount_cents, currency, customer_id, service_id")
        .eq("tenant_id", DEMO_TENANT_ID)
        .order("starts_at", { ascending: false })
        .limit(50),
      supabaseAdmin
        .from("services")
        .select("id, name, duration_minutes, price_cents, currency, active")
        .eq("tenant_id", DEMO_TENANT_ID)
        .order("name"),
      supabaseAdmin
        .from("staff")
        .select("id, full_name, role, active")
        .eq("tenant_id", DEMO_TENANT_ID)
        .order("full_name"),
      supabaseAdmin
        .from("payments")
        .select("id, gateway, gateway_ref, amount_cents, currency, status, paid_at, created_at")
        .eq("tenant_id", DEMO_TENANT_ID)
        .order("created_at", { ascending: false })
        .limit(50),
      supabaseAdmin
        .from("invoices")
        .select("id, number, status, amount_cents, currency, due_at, created_at")
        .eq("tenant_id", DEMO_TENANT_ID)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

    if (tenant.error) throw tenant.error;

    const revenue = (payments.data ?? [])
      .filter((p) => p.status === "CONFIRMED")
      .reduce<Record<string, number>>((acc, p) => {
        acc[p.currency] = (acc[p.currency] ?? 0) + (p.amount_cents ?? 0);
        return acc;
      }, {});

    return {
      tenant: tenant.data,
      customers: customers.data ?? [],
      bookings: bookings.data ?? [],
      services: services.data ?? [],
      staff: staff.data ?? [],
      payments: payments.data ?? [],
      invoices: invoices.data ?? [],
      revenue,
    };
  });

export const listAllTenants = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: tenants, error } = await supabaseAdmin
      .from("tenants")
      .select(
        "id, name, industry, country, country_code, email, plan_tier, subscription_status, is_demo, is_admin_workspace, created_at",
      )
      .order("created_at", { ascending: false });
    if (error) throw error;

    const tenantIds = (tenants ?? []).map((t) => t.id);
    if (tenantIds.length === 0) return { tenants: [] };

    const [usersAgg, customersAgg, bookingsAgg, paymentsAgg] = await Promise.all([
      supabaseAdmin.from("users").select("tenant_id").in("tenant_id", tenantIds),
      supabaseAdmin.from("customers").select("tenant_id").in("tenant_id", tenantIds),
      supabaseAdmin.from("bookings").select("tenant_id").in("tenant_id", tenantIds),
      supabaseAdmin
        .from("payments")
        .select("tenant_id, amount_cents, currency, status")
        .in("tenant_id", tenantIds),
    ]);

    const tally = (rows: any[] | null) => {
      const m: Record<string, number> = {};
      (rows ?? []).forEach((r) => {
        m[r.tenant_id] = (m[r.tenant_id] ?? 0) + 1;
      });
      return m;
    };
    const userCounts = tally(usersAgg.data);
    const custCounts = tally(customersAgg.data);
    const bookCounts = tally(bookingsAgg.data);
    const revenueByTenant: Record<string, Record<string, number>> = {};
    (paymentsAgg.data ?? []).forEach((p: any) => {
      if (p.status !== "CONFIRMED") return;
      revenueByTenant[p.tenant_id] ??= {};
      revenueByTenant[p.tenant_id][p.currency] =
        (revenueByTenant[p.tenant_id][p.currency] ?? 0) + (p.amount_cents ?? 0);
    });

    return {
      tenants: (tenants ?? []).map((t) => ({
        ...t,
        users_count: userCounts[t.id] ?? 0,
        customers_count: custCounts[t.id] ?? 0,
        bookings_count: bookCounts[t.id] ?? 0,
        revenue: revenueByTenant[t.id] ?? {},
      })),
    };
  });

export const updateTenantStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    z.object({
      tenantId: z.string().uuid(),
      plan_tier: z.enum(["starter", "growth", "pro", "enterprise"]).optional(),
      subscription_status: z.enum(["active", "suspended", "cancelled", "trial"]).optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch: { plan_tier?: string; subscription_status?: string } = {};
    if (data.plan_tier) patch.plan_tier = data.plan_tier;
    if (data.subscription_status) patch.subscription_status = data.subscription_status;
    if (Object.keys(patch).length === 0) return { ok: true };
    const { error } = await supabaseAdmin
      .from("tenants")
      .update(patch as any)
      .eq("id", data.tenantId);
    if (error) throw error;
    return { ok: true };
  });
