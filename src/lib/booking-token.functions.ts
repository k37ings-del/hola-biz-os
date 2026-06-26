import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";

function publicClient() {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
}

export const getBookingByToken = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) =>
    z
      .object({ token: z.string().min(8).max(128), kind: z.enum(["reschedule", "cancel"]) })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const sb = publicClient();
    const { data: row, error } = await sb.rpc("public_get_booking_by_token", {
      _token: data.token,
      _kind: data.kind,
    });
    if (error) throw error;
    return row;
  });

export const cancelBookingByToken = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({ token: z.string().min(8).max(128), reason: z.string().max(500).optional() })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const sb = publicClient();
    const { error } = await sb.rpc("public_cancel_booking", {
      _token: data.token,
      _reason: data.reason ?? null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const rescheduleBookingByToken = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ token: z.string().min(8).max(128), new_starts_at: z.string() }).parse(d),
  )
  .handler(async ({ data }) => {
    const sb = publicClient();
    const { error } = await sb.rpc("public_reschedule_booking", {
      _token: data.token,
      _new_starts_at: data.new_starts_at,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
