import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateRefCode } from "@/lib/format";

async function tenantOf(supabase: any, userId: string): Promise<string | null> {
  const { data } = await supabase.from("users").select("tenant_id").eq("supabase_auth_id", userId).maybeSingle();
  return data?.tenant_id ?? null;
}

const STATUSES = ["PENDING_PAYMENT", "CONFIRMED", "COMPLETED", "CANCELLED", "NO_SHOW", "EXPIRED"] as const;

export const listBookings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const tenantId = await tenantOf(context.supabase, context.userId);
    if (!tenantId) return { bookings: [], stats: { upcoming: 0, today: 0, pending: 0, completed_week: 0 } };

    const { data, error } = await context.supabase
      .from("bookings")
      .select("id, ref_code, status, starts_at, ends_at, amount_cents, currency, notes, cancellation_reason, no_show_reason, customer:customers(id, display_name, wa_phone), service:services(id, name), staff:staff(id, name)")
      .eq("tenant_id", tenantId)
      .order("starts_at", { ascending: false })
      .limit(500);
    if (error) throw error;

    const list = data ?? [];
    const now = Date.now();
    const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart); dayEnd.setDate(dayEnd.getDate() + 1);
    const weekAgo = now - 7 * 24 * 3600 * 1000;

    return {
      bookings: list,
      stats: {
        upcoming: list.filter((b: any) => new Date(b.starts_at).getTime() > now && (b.status === "CONFIRMED" || b.status === "PENDING_PAYMENT")).length,
        today: list.filter((b: any) => {
          const t = new Date(b.starts_at).getTime();
          return t >= dayStart.getTime() && t < dayEnd.getTime();
        }).length,
        pending: list.filter((b: any) => b.status === "PENDING_PAYMENT").length,
        completed_week: list.filter((b: any) => b.status === "COMPLETED" && new Date(b.starts_at).getTime() > weekAgo).length,
      },
    };
  });

export const upsertBooking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      id: z.string().uuid().optional(),
      customer_id: z.string().uuid().nullable().optional(),
      service_id: z.string().uuid().nullable().optional(),
      staff_id: z.string().uuid().nullable().optional(),
      starts_at: z.string(),
      ends_at: z.string(),
      amount_cents: z.number().int().min(0),
      currency: z.string().min(3).max(8),
      status: z.enum(STATUSES).optional(),
      notes: z.string().max(2000).nullable().optional(),
    }).parse(d)
  )
  .handler(async ({ context, data }) => {
    const tenantId = await tenantOf(context.supabase, context.userId);
    if (!tenantId) throw new Error("No tenant");
    const payload: any = {
      tenant_id: tenantId,
      customer_id: data.customer_id ?? null,
      service_id: data.service_id ?? null,
      staff_id: data.staff_id ?? null,
      starts_at: data.starts_at,
      ends_at: data.ends_at,
      amount_cents: data.amount_cents,
      currency: data.currency,
      notes: data.notes ?? null,
      ...(data.status ? { status: data.status } : {}),
    };
    if (data.id) {
      const { error } = await context.supabase.from("bookings").update(payload).eq("id", data.id).eq("tenant_id", tenantId);
      if (error) throw error;
      return { ok: true, id: data.id };
    }
    payload.ref_code = generateRefCode("BK");
    payload.status = data.status ?? "PENDING_PAYMENT";
    const { data: inserted, error } = await context.supabase.from("bookings").insert(payload).select("id").single();
    if (error) throw error;
    return { ok: true, id: inserted.id };
  });

export const setBookingStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      id: z.string().uuid(),
      status: z.enum(STATUSES),
      reason: z.string().max(500).optional(),
    }).parse(d)
  )
  .handler(async ({ context, data }) => {
    const tenantId = await tenantOf(context.supabase, context.userId);
    if (!tenantId) throw new Error("No tenant");
    const patch: any = { status: data.status };
    if (data.status === "CANCELLED") patch.cancellation_reason = data.reason ?? null;
    if (data.status === "NO_SHOW") patch.no_show_reason = data.reason ?? null;
    const { error } = await context.supabase.from("bookings").update(patch).eq("id", data.id).eq("tenant_id", tenantId);
    if (error) throw error;
    return { ok: true };
  });

export const bookingFormOptions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const tenantId = await tenantOf(context.supabase, context.userId);
    if (!tenantId) return { customers: [], services: [], staff: [] };
    const [{ data: customers }, { data: services }, { data: staff }] = await Promise.all([
      context.supabase.from("customers").select("id, display_name, wa_phone").eq("tenant_id", tenantId).order("display_name").limit(500),
      context.supabase.from("services").select("id, name, duration_minutes, price_cents, currency").eq("tenant_id", tenantId).eq("active", true).order("name"),
      context.supabase.from("staff").select("id, name").eq("tenant_id", tenantId).order("name"),
    ]);
    return { customers: customers ?? [], services: services ?? [], staff: staff ?? [] };
  });

export const deleteBooking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const tenantId = await tenantOf(context.supabase, context.userId);
    if (!tenantId) throw new Error("No tenant");
    const { error } = await context.supabase
      .from("bookings")
      .delete()
      .eq("id", data.id)
      .eq("tenant_id", tenantId);
    if (error) throw error;
    return { ok: true };
  });
