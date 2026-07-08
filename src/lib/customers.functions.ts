import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function tenantOf(supabase: any, userId: string): Promise<string | null> {
  const { data } = await supabase.from("users").select("tenant_id").eq("supabase_auth_id", userId).maybeSingle();
  return data?.tenant_id ?? null;
}

export const listCustomers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const tenantId = await tenantOf(context.supabase, context.userId);
    if (!tenantId) return { customers: [], stats: { total: 0, active_month: 0, repeat: 0, new_week: 0 } };

    const [{ data: customers, error }, { data: bookingsAgg }] = await Promise.all([
      context.supabase
        .from("customers")
        .select("id, display_name, wa_phone, email, status, booking_count, first_seen, last_seen_at, notes, tags")
        .eq("tenant_id", tenantId)
        .order("first_seen", { ascending: false })
        .limit(500),
      context.supabase
        .from("bookings")
        .select("customer_id, amount_cents, currency, status, starts_at")
        .eq("tenant_id", tenantId),
    ]);
    if (error) throw error;

    const spendByCustomer: Record<string, number> = {};
    const lastBookingByCustomer: Record<string, string> = {};
    (bookingsAgg ?? []).forEach((b: any) => {
      if (!b.customer_id) return;
      if (b.status === "COMPLETED" || b.status === "CONFIRMED") {
        spendByCustomer[b.customer_id] = (spendByCustomer[b.customer_id] ?? 0) + (b.amount_cents ?? 0);
      }
      const cur = lastBookingByCustomer[b.customer_id];
      if (!cur || new Date(b.starts_at) > new Date(cur)) lastBookingByCustomer[b.customer_id] = b.starts_at;
    });

    const now = Date.now();
    const weekAgo = now - 7 * 24 * 3600 * 1000;
    const monthAgo = now - 30 * 24 * 3600 * 1000;

    const enriched = (customers ?? []).map((c: any) => ({
      ...c,
      total_spent_cents: spendByCustomer[c.id] ?? 0,
      last_booking_at: lastBookingByCustomer[c.id] ?? null,
    }));

    const stats = {
      total: enriched.length,
      active_month: enriched.filter((c) => c.last_booking_at && new Date(c.last_booking_at).getTime() > monthAgo).length,
      repeat: enriched.filter((c) => (c.booking_count ?? 0) >= 2).length,
      new_week: enriched.filter((c) => new Date(c.first_seen).getTime() > weekAgo).length,
    };

    return { customers: enriched, stats };
  });

export const getCustomer = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const tenantId = await tenantOf(context.supabase, context.userId);
    if (!tenantId) throw new Error("No tenant");

    const [{ data: customer, error }, { data: bookings }] = await Promise.all([
      context.supabase.from("customers").select("*").eq("id", data.id).eq("tenant_id", tenantId).maybeSingle(),
      context.supabase
        .from("bookings")
        .select("id, ref_code, status, starts_at, amount_cents, currency")
        .eq("customer_id", data.id)
        .eq("tenant_id", tenantId)
        .order("starts_at", { ascending: false })
        .limit(20),
    ]);
    const messages: any[] = [];
    if (error) throw error;
    if (!customer) throw new Error("Customer not found");

    const noShows = (bookings ?? []).filter((b: any) => b.status === "NO_SHOW").length;
    const cancellations = (bookings ?? []).filter((b: any) => b.status === "CANCELLED").length;
    const totalSpent = (bookings ?? [])
      .filter((b: any) => b.status === "CONFIRMED" || b.status === "COMPLETED")
      .reduce((s: number, b: any) => s + (b.amount_cents ?? 0), 0);

    return {
      customer,
      bookings: bookings ?? [],
      messages: (messages ?? []).reverse(),
      stats: {
        total_bookings: customer.booking_count ?? bookings?.length ?? 0,
        total_spent_cents: totalSpent,
        no_shows: noShows,
        cancellations,
      },
    };
  });

export const upsertCustomer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      id: z.string().uuid().optional(),
      display_name: z.string().trim().min(1).max(120),
      wa_phone: z.string().trim().min(4).max(32).nullable().optional(),
      email: z.string().trim().email().max(255).nullable().or(z.literal("")).optional(),
      notes: z.string().max(4000).nullable().optional(),
      status: z.enum(["active", "inactive", "blocked"]).optional(),
    }).parse(d)
  )
  .handler(async ({ context, data }) => {
    const tenantId = await tenantOf(context.supabase, context.userId);
    if (!tenantId) throw new Error("No tenant");
    const payload: any = {
      tenant_id: tenantId,
      display_name: data.display_name,
      wa_phone: data.wa_phone || null,
      email: data.email || null,
      notes: data.notes ?? null,
      ...(data.status ? { status: data.status } : {}),
    };
    if (data.id) {
      const { error } = await context.supabase.from("customers").update(payload).eq("id", data.id).eq("tenant_id", tenantId);
      if (error) throw error;
      return { ok: true, id: data.id };
    }
    const { data: inserted, error } = await context.supabase.from("customers").insert(payload).select("id").single();
    if (error) throw error;
    return { ok: true, id: inserted.id };
  });

export const setCustomerStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ ids: z.array(z.string().uuid()).min(1), status: z.enum(["active","inactive","blocked"]) }).parse(d))
  .handler(async ({ context, data }) => {
    const tenantId = await tenantOf(context.supabase, context.userId);
    if (!tenantId) throw new Error("No tenant");
    const { error } = await context.supabase.from("customers").update({ status: data.status } as any).in("id", data.ids).eq("tenant_id", tenantId);
    if (error) throw error;
    return { ok: true, count: data.ids.length };
  });

export const deleteCustomers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ ids: z.array(z.string().uuid()).min(1).max(500) }).parse(d))
  .handler(async ({ context, data }) => {
    const tenantId = await tenantOf(context.supabase, context.userId);
    if (!tenantId) throw new Error("No tenant");
    const { error } = await context.supabase.from("customers").delete().in("id", data.ids).eq("tenant_id", tenantId);
    if (error) throw error;
    return { ok: true, count: data.ids.length };
  });

export const updateCustomerNotes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid(), notes: z.string().max(4000) }).parse(d))
  .handler(async ({ context, data }) => {
    const tenantId = await tenantOf(context.supabase, context.userId);
    if (!tenantId) throw new Error("No tenant");
    const { error } = await context.supabase.from("customers").update({ notes: data.notes }).eq("id", data.id).eq("tenant_id", tenantId);
    if (error) throw error;
    return { ok: true };
  });

export const importCustomersCSV = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      rows: z
        .array(
          z.object({
            display_name: z.string().trim().min(1).max(120),
            email: z.string().trim().max(255).optional().nullable(),
            wa_phone: z.string().trim().max(40).optional().nullable(),
            notes: z.string().trim().max(2000).optional().nullable(),
          })
        )
        .min(1)
        .max(2000),
    }).parse(d)
  )
  .handler(async ({ context, data }) => {
    const tenantId = await tenantOf(context.supabase, context.userId);
    if (!tenantId) throw new Error("No tenant");

    // Fetch existing to de-dupe on email/phone
    const { data: existing } = await context.supabase
      .from("customers")
      .select("id, email, wa_phone")
      .eq("tenant_id", tenantId);
    const emails = new Set((existing ?? []).map((c: any) => (c.email ?? "").toLowerCase()).filter(Boolean));
    const phones = new Set((existing ?? []).map((c: any) => (c.wa_phone ?? "").replace(/\D/g, "")).filter(Boolean));

    const toInsert: any[] = [];
    let skipped = 0;
    for (const row of data.rows) {
      const email = (row.email ?? "").trim().toLowerCase() || null;
      const phone = (row.wa_phone ?? "").trim() || null;
      const phoneDigits = phone ? phone.replace(/\D/g, "") : "";
      if ((email && emails.has(email)) || (phoneDigits && phones.has(phoneDigits))) {
        skipped++;
        continue;
      }
      if (email) emails.add(email);
      if (phoneDigits) phones.add(phoneDigits);
      toInsert.push({
        tenant_id: tenantId,
        display_name: row.display_name.trim(),
        email,
        wa_phone: phone,
        notes: row.notes?.trim() || null,
        status: "active",
        booking_count: 0,
        first_seen: new Date().toISOString(),
        last_seen_at: new Date().toISOString(),
      });
    }

    if (toInsert.length === 0) return { imported: 0, skipped };
    const { error } = await context.supabase.from("customers").insert(toInsert);
    if (error) throw error;
    return { imported: toInsert.length, skipped };
  });
