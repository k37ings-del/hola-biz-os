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

export const listServices = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const tenantId = await tenantOf(context.supabase, context.userId);
    if (!tenantId) return { services: [] };
    const { data, error } = await context.supabase
      .from("services")
      .select("id, name, duration_minutes, price_cents, currency, active, created_at")
      .eq("tenant_id", tenantId)
      .order("name");
    if (error) throw error;
    return { services: data ?? [] };
  });

export const upsertService = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid().optional(),
        name: z.string().trim().min(1).max(120),
        duration_minutes: z.number().int().min(5).max(1440),
        price_cents: z.number().int().min(0),
        currency: z.string().min(3).max(8),
        active: z.boolean().optional(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const tenantId = await tenantOf(context.supabase, context.userId);
    if (!tenantId) throw new Error("No tenant");
    const payload: any = {
      tenant_id: tenantId,
      name: data.name,
      duration_minutes: data.duration_minutes,
      price_cents: data.price_cents,
      currency: data.currency,
      ...(typeof data.active === "boolean" ? { active: data.active } : {}),
    };
    if (data.id) {
      const { error } = await context.supabase
        .from("services")
        .update(payload)
        .eq("id", data.id)
        .eq("tenant_id", tenantId);
      if (error) throw error;
      return { ok: true, id: data.id };
    }
    const { data: ins, error } = await context.supabase
      .from("services")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw error;
    return { ok: true, id: ins.id };
  });

export const deleteService = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const tenantId = await tenantOf(context.supabase, context.userId);
    if (!tenantId) throw new Error("No tenant");
    const { error } = await context.supabase
      .from("services")
      .delete()
      .eq("id", data.id)
      .eq("tenant_id", tenantId);
    if (error) throw error;
    return { ok: true };
  });
