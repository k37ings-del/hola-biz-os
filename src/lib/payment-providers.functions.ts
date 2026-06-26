import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function tenantOf(supabase: any, userId: string) {
  const { data } = await supabase
    .from("users")
    .select("tenant_id, role")
    .eq("supabase_auth_id", userId)
    .maybeSingle();
  return data as { tenant_id: string | null; role: string | null } | null;
}

const ProviderConfigSchema = z.object({
  enabled: z.boolean().default(false),
  test_mode: z.boolean().default(true),
  merchant_id: z.string().max(200).optional().default(""),
  merchant_key: z.string().max(500).optional().default(""),
  passphrase: z.string().max(500).optional().default(""),
  api_key: z.string().max(500).optional().default(""),
  secret_key: z.string().max(500).optional().default(""),
  public_key: z.string().max(500).optional().default(""),
  site_code: z.string().max(200).optional().default(""),
  private_key: z.string().max(500).optional().default(""),
});

const PROVIDER_KEYS = ["payfast", "yoco", "ozow", "paystack", "stripe"] as const;
const Schema = z.object(
  Object.fromEntries(PROVIDER_KEYS.map((k) => [k, ProviderConfigSchema.optional()])) as any,
);

export const getPaymentProviders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const u = await tenantOf(context.supabase, context.userId);
    if (!u?.tenant_id) return {};
    const { data } = await context.supabase
      .from("tenants")
      .select("payment_providers")
      .eq("id", u.tenant_id)
      .maybeSingle();
    return (data?.payment_providers ?? {}) as Record<string, any>;
  });

export const savePaymentProviders = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Schema.parse(d))
  .handler(async ({ context, data }) => {
    const u = await tenantOf(context.supabase, context.userId);
    if (!u?.tenant_id) throw new Error("No tenant");
    if (!["owner", "admin"].includes(u.role ?? "")) throw new Error("Forbidden");
    const { error } = await context.supabase
      .from("tenants")
      .update({ payment_providers: data as any })
      .eq("id", u.tenant_id);
    if (error) throw error;
    return { ok: true };
  });
