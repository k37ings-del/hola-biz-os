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

export const TRIGGERS = [
  "booking_confirmed",
  "before_appointment",
  "after_appointment",
  "payment_overdue",
  "post_visit_review",
  "follow_up",
] as const;
export const CHANNELS = ["whatsapp", "email", "sms"] as const;

export type AutomationConfig = {
  channel: (typeof CHANNELS)[number];
  offset_minutes: number;
  subject?: string | null;
  template: string;
};

export const listAutomations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const tenantId = await tenantOf(context.supabase, context.userId);
    if (!tenantId) return { automations: [], runs: [] };
    const [{ data: automations }, { data: runs }] = await Promise.all([
      context.supabase
        .from("automations")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false }),
      context.supabase
        .from("automation_runs")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("scheduled_at", { ascending: false })
        .limit(50),
    ]);
    return { automations: automations ?? [], runs: runs ?? [] };
  });

export const upsertAutomation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        name: z.string().min(2).max(100),
        trigger: z.enum(TRIGGERS),
        offset_minutes: z.number().int(),
        channel: z.enum(CHANNELS),
        subject: z.string().max(200).nullable().optional(),
        template: z.string().min(2).max(4000),
        active: z.boolean(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const tenantId = await tenantOf(context.supabase, context.userId);
    if (!tenantId) throw new Error("No tenant");
    const config: AutomationConfig = {
      channel: data.channel,
      offset_minutes: data.offset_minutes,
      subject: data.subject ?? null,
      template: data.template,
    };
    const payload = {
      tenant_id: tenantId,
      name: data.name,
      trigger_type: data.trigger,
      action_type: data.channel,
      active: data.active,
      config: config as any,
    };
    if (data.id) {
      const { error } = await context.supabase
        .from("automations")
        .update(payload)
        .eq("id", data.id)
        .eq("tenant_id", tenantId);
      if (error) throw error;
      return { ok: true, id: data.id };
    }
    const { data: inserted, error } = await context.supabase
      .from("automations")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw error;
    return { ok: true, id: inserted.id };
  });

export const deleteAutomation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const tenantId = await tenantOf(context.supabase, context.userId);
    if (!tenantId) throw new Error("No tenant");
    const { error } = await context.supabase
      .from("automations")
      .delete()
      .eq("id", data.id)
      .eq("tenant_id", tenantId);
    if (error) throw error;
    return { ok: true };
  });

export const setAutomationActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), active: z.boolean() }).parse(d))
  .handler(async ({ context, data }) => {
    const tenantId = await tenantOf(context.supabase, context.userId);
    if (!tenantId) throw new Error("No tenant");
    const { error } = await context.supabase
      .from("automations")
      .update({ active: data.active })
      .eq("id", data.id)
      .eq("tenant_id", tenantId);
    if (error) throw error;
    return { ok: true };
  });
