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

const DayKey = z.enum(["mon", "tue", "wed", "thu", "fri", "sat", "sun"]);
const WeeklySchema = z.record(
  DayKey,
  z.object({
    active: z.boolean(),
    open: z.string().regex(/^\d{2}:\d{2}$/),
    close: z.string().regex(/^\d{2}:\d{2}$/),
  }),
);

export const listSchedules = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const tenantId = await tenantOf(context.supabase, context.userId);
    if (!tenantId) return { staff: [], schedules: [] };
    const [{ data: staff }, { data: schedules }] = await Promise.all([
      context.supabase
        .from("staff")
        .select("id, name, role, photo_url, ics_token, active")
        .eq("tenant_id", tenantId)
        .eq("active", true)
        .order("name"),
      context.supabase.from("staff_schedules").select("*").eq("tenant_id", tenantId),
    ]);
    return { staff: staff ?? [], schedules: schedules ?? [] };
  });

export const upsertSchedule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        staff_id: z.string().uuid(),
        weekly: WeeklySchema,
        time_off: z
          .array(z.object({ from: z.string(), to: z.string(), reason: z.string().optional() }))
          .default([]),
        buffer_before_minutes: z.number().int().min(0).max(120).default(0),
        buffer_after_minutes: z.number().int().min(0).max(120).default(0),
        max_daily_appointments: z.number().int().min(0).max(100).nullable().default(null),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const tenantId = await tenantOf(context.supabase, context.userId);
    if (!tenantId) throw new Error("No tenant");
    const { error } = await context.supabase.from("staff_schedules").upsert(
      {
        tenant_id: tenantId,
        staff_id: data.staff_id,
        weekly: data.weekly as any,
        time_off: data.time_off as any,
        buffer_before_minutes: data.buffer_before_minutes,
        buffer_after_minutes: data.buffer_after_minutes,
        max_daily_appointments: data.max_daily_appointments,
      } as any,
      { onConflict: "staff_id" },
    );
    if (error) throw error;
    return { ok: true };
  });
