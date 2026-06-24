import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function tenantOf(supabase: any, userId: string) {
  const { data } = await supabase.from("users").select("tenant_id").eq("supabase_auth_id", userId).maybeSingle();
  return data?.tenant_id as string | null;
}

export const getCalendarRange = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ from: z.string(), to: z.string() }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const tenantId = await tenantOf(context.supabase, context.userId);
    if (!tenantId) return { bookings: [], staff: [] };
    const [{ data: bookings, error: bErr }, { data: staff, error: sErr }] = await Promise.all([
      context.supabase
        .from("bookings")
        .select("id, ref_code, status, starts_at, ends_at, customer_name, service:services(id,name), staff:staff(id,name)")
        .eq("tenant_id", tenantId)
        .gte("starts_at", data.from)
        .lte("starts_at", data.to)
        .order("starts_at", { ascending: true }),
      context.supabase.from("staff").select("id, name").eq("tenant_id", tenantId).eq("active", true).order("name"),
    ]);
    if (bErr) throw bErr;
    if (sErr) throw sErr;
    return { bookings: bookings ?? [], staff: staff ?? [] };
  });
