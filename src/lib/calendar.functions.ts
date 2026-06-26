import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function tenantOf(supabase: any, userId: string) {
  const { data } = await supabase
    .from("users")
    .select("tenant_id")
    .eq("supabase_auth_id", userId)
    .maybeSingle();
  return data?.tenant_id as string | null;
}

export const PROVIDERS = ["google_calendar", "outlook", "zoom", "google_meet"] as const;

export const listCalendarConnections = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => z.object({ staff_id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const tenantId = await tenantOf(context.supabase, context.userId);
    if (!tenantId) return [];
    const { data: list, error } = await context.supabase
      .from("calendar_connections")
      .select("id, provider, account_email, calendar_id, sync_enabled, created_at")
      .eq("tenant_id", tenantId)
      .eq("staff_id", data.staff_id);
    if (error) throw error;
    return list ?? [];
  });

export const upsertCalendarConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) =>
    z
      .object({
        staff_id: z.string().uuid(),
        provider: z.enum(PROVIDERS),
        account_email: z.string().email().max(255),
        calendar_id: z.string().max(255).optional().nullable(),
        sync_enabled: z.boolean().default(true),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const tenantId = await tenantOf(context.supabase, context.userId);
    if (!tenantId) throw new Error("No tenant");
    const { error } = await context.supabase.from("calendar_connections").upsert(
      {
        tenant_id: tenantId,
        staff_id: data.staff_id,
        provider: data.provider,
        account_email: data.account_email,
        calendar_id: data.calendar_id ?? null,
        sync_enabled: data.sync_enabled,
      } as any,
      { onConflict: "staff_id,provider" },
    );
    if (error) throw error;
    return { ok: true };
  });

export const deleteCalendarConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const tenantId = await tenantOf(context.supabase, context.userId);
    if (!tenantId) throw new Error("No tenant");
    const { error } = await context.supabase
      .from("calendar_connections")
      .delete()
      .eq("id", data.id)
      .eq("tenant_id", tenantId);
    if (error) throw error;
    return { ok: true };
  });
