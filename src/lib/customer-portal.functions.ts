import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";

function publicClient() {
  return createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
  );
}

export const getCustomerPortal = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ token: z.string().min(8).max(80) }).parse(d))
  .handler(async ({ data }) => {
    const sb = publicClient();
    const { data: result, error } = await sb.rpc("public_get_customer_portal", { _token: data.token });
    if (error) throw error;
    return result as any;
  });
