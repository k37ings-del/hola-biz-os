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

export const getFinanceOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const tenantId = await tenantOf(context.supabase, context.userId);
    if (!tenantId)
      return {
        invoices: [],
        payments: [],
        refunds: [],
        payouts: [],
        stats: { revenue: 0, outstanding: 0, refunded: 0, payouts: 0 },
      };
    const [inv, pay, ref, pyo] = await Promise.all([
      context.supabase
        .from("invoices")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false })
        .limit(100),
      context.supabase
        .from("payments")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false })
        .limit(100),
      context.supabase
        .from("refunds")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false })
        .limit(100),
      context.supabase
        .from("payouts")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false })
        .limit(100),
    ]);
    const invoices = inv.data ?? [];
    const payments = pay.data ?? [];
    const refunds = ref.data ?? [];
    const payouts = pyo.data ?? [];
    const revenue = payments
      .filter((p: any) => p.status === "succeeded" || p.status === "paid")
      .reduce((a: number, p: any) => a + (p.amount_cents || 0), 0);
    const outstanding = invoices
      .filter((i: any) => i.status !== "paid" && i.status !== "cancelled")
      .reduce((a: number, i: any) => a + (i.amount_cents || 0), 0);
    const refunded = refunds
      .filter((r: any) => r.status === "succeeded")
      .reduce((a: number, r: any) => a + (r.amount_cents || 0), 0);
    const payoutsTotal = payouts
      .filter((p: any) => p.status === "paid")
      .reduce((a: number, p: any) => a + (p.amount_cents || 0), 0);
    return {
      invoices,
      payments,
      refunds,
      payouts,
      stats: { revenue, outstanding, refunded, payouts: payoutsTotal },
    };
  });

export const createRefund = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        payment_id: z.string().uuid().optional().nullable(),
        booking_id: z.string().uuid().optional().nullable(),
        amount_cents: z.number().int().min(1),
        currency: z.string().min(3).max(8),
        reason: z.string().max(500).optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const tenantId = await tenantOf(context.supabase, context.userId);
    if (!tenantId) throw new Error("No tenant");
    const { error } = await context.supabase.from("refunds").insert({
      tenant_id: tenantId,
      payment_id: data.payment_id ?? null,
      booking_id: data.booking_id ?? null,
      amount_cents: data.amount_cents,
      currency: data.currency,
      reason: data.reason ?? null,
    } as any);
    if (error) throw error;
    return { ok: true };
  });
