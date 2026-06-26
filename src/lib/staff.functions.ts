import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function tenantOf(supabase: any, userId: string): Promise<string | null> {
  const { data } = await supabase
    .from("users")
    .select("tenant_id")
    .eq("supabase_auth_id", userId)
    .maybeSingle();
  return data?.tenant_id ?? null;
}

const DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

function defaultAvailability() {
  return Object.fromEntries(
    DAY_KEYS.map((k) => [
      k,
      { active: !["sat", "sun"].includes(k), open: "09:00", close: "18:00" },
    ]),
  );
}

export const listStaff = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const tenantId = await tenantOf(context.supabase, context.userId);
    if (!tenantId) return { staff: [], services: [], todayCount: 0, weekCount: 0 };

    const [{ data: staff }, { data: services }, { data: links }, { data: bookings }] =
      await Promise.all([
        context.supabase
          .from("staff")
          .select(
            "id, name, wa_number, email, role, bio, photo_url, active, availability, created_at",
          )
          .eq("tenant_id", tenantId)
          .order("name"),
        context.supabase
          .from("services")
          .select("id, name, price_cents, currency, duration_minutes, active")
          .eq("tenant_id", tenantId)
          .order("name"),
        context.supabase
          .from("staff_services")
          .select("staff_id, service_id")
          .eq("tenant_id", tenantId),
        context.supabase
          .from("bookings")
          .select("id, staff_id, starts_at, status")
          .eq("tenant_id", tenantId)
          .gte("starts_at", new Date(Date.now() - 7 * 86400000).toISOString()),
      ]);

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();

    const todayCount = (bookings ?? []).filter(
      (b: any) => b.starts_at >= startOfToday && b.starts_at < endOfToday,
    ).length;
    const weekCount = (bookings ?? []).length;

    return {
      staff: staff ?? [],
      services: services ?? [],
      links: links ?? [],
      bookings: bookings ?? [],
      todayCount,
      weekCount,
    };
  });

export const upsertStaff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid().optional(),
        name: z.string().trim().min(1).max(120),
        wa_number: z.string().trim().max(40).optional().nullable(),
        email: z.string().trim().email().max(255).optional().or(z.literal("")).nullable(),
        role: z.enum(["Owner", "Senior Staff", "Staff", "Contractor"]),
        bio: z.string().trim().max(1000).optional().nullable(),
        photo_url: z.string().trim().max(1000).optional().nullable(),
        active: z.boolean(),
        availability: z.record(z.any()).optional(),
        service_ids: z.array(z.string().uuid()).optional(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const tenantId = await tenantOf(context.supabase, context.userId);
    if (!tenantId) throw new Error("No tenant");

    const payload: any = {
      tenant_id: tenantId,
      name: data.name,
      wa_number: data.wa_number || null,
      email: data.email || null,
      role: data.role,
      bio: data.bio || null,
      photo_url: data.photo_url || null,
      active: data.active,
      availability: data.availability ?? defaultAvailability(),
    };

    let staffId = data.id;
    if (staffId) {
      const { error } = await context.supabase
        .from("staff")
        .update(payload)
        .eq("id", staffId)
        .eq("tenant_id", tenantId);
      if (error) throw error;
    } else {
      const { data: ins, error } = await context.supabase
        .from("staff")
        .insert(payload)
        .select("id")
        .single();
      if (error) throw error;
      staffId = ins.id;
    }

    if (data.service_ids) {
      await context.supabase
        .from("staff_services")
        .delete()
        .eq("staff_id", staffId)
        .eq("tenant_id", tenantId);
      if (data.service_ids.length) {
        const rows = data.service_ids.map((sid) => ({
          staff_id: staffId!,
          service_id: sid,
          tenant_id: tenantId,
        }));
        const { error } = await context.supabase.from("staff_services").insert(rows);
        if (error) throw error;
      }
    }
    return { ok: true, id: staffId };
  });

export const setStaffActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid(), active: z.boolean() }).parse(d))
  .handler(async ({ context, data }) => {
    const tenantId = await tenantOf(context.supabase, context.userId);
    if (!tenantId) throw new Error("No tenant");
    const { error } = await context.supabase
      .from("staff")
      .update({ active: data.active })
      .eq("id", data.id)
      .eq("tenant_id", tenantId);
    if (error) throw error;
    return { ok: true };
  });

export const deleteStaff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const tenantId = await tenantOf(context.supabase, context.userId);
    if (!tenantId) throw new Error("No tenant");
    const { error } = await context.supabase
      .from("staff")
      .delete()
      .eq("id", data.id)
      .eq("tenant_id", tenantId);
    if (error) throw error;
    return { ok: true };
  });
