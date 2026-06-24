import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const joinWaitlist = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({
      tenant_id: z.string().uuid(),
      service_id: z.string().uuid(),
      staff_id: z.string().uuid().nullable().optional(),
      customer_name: z.string().min(2).max(120),
      customer_email: z.string().email().max(255).optional().nullable(),
      customer_phone: z.string().max(40).optional().nullable(),
      desired_from: z.string().optional().nullable(),
      desired_to: z.string().optional().nullable(),
      notes: z.string().max(500).optional().nullable(),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const { createClient } = await import("@supabase/supabase-js");
    const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: res, error } = await sb.rpc("public_join_waitlist", {
      _tenant_id: data.tenant_id, _service_id: data.service_id, _staff_id: data.staff_id ?? null,
      _customer_name: data.customer_name, _customer_email: data.customer_email ?? null,
      _customer_phone: data.customer_phone ?? null,
      _desired_from: data.desired_from ?? null, _desired_to: data.desired_to ?? null,
      _notes: data.notes ?? null,
    });
    if (error) throw new Error(error.message);
    return res as { id: string };
  });

export const getWaitlistOffer = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ token: z.string().min(8) }).parse(d))
  .handler(async ({ data }) => {
    const { createClient } = await import("@supabase/supabase-js");
    const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: res, error } = await sb.rpc("public_get_waitlist_offer", { _token: data.token });
    if (error) throw new Error(error.message);
    return res as any;
  });

export const claimWaitlistSlot = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: z.string().min(8) }).parse(d))
  .handler(async ({ data }) => {
    const { createClient } = await import("@supabase/supabase-js");
    const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: res, error } = await sb.rpc("public_claim_waitlist_slot", { _token: data.token });
    if (error) throw new Error(error.message);
    return res as { booking_id: string; ref_code: string };
  });
