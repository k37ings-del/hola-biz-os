import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";

function publicClient() {
  return createClient<Database>(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
}

export const getBookingPage = createServerFn({ method: "GET" })
  .validator((d: unknown) => z.object({ slug: z.string().min(1).max(100) }).parse(d))
  .handler(async ({ data }) => {
    const sb = publicClient();
    const { data: result, error } = await sb.rpc("public_get_booking_page", { _slug: data.slug });
    if (error) throw error;
    return result as any;
  });

export const getAvailability = createServerFn({ method: "GET" })
  .validator((d: unknown) =>
    z
      .object({
        tenant_id: z.string().uuid(),
        service_id: z.string().uuid(),
        staff_id: z.string().uuid().nullable().optional(),
        day: z.string(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const sb = publicClient();
    const { data: result, error } = await sb.rpc("public_get_availability", {
      _tenant_id: data.tenant_id,
      _service_id: data.service_id,
      _staff_id: (data.staff_id ?? null) as any,
      _day: data.day,
    });
    if (error) throw error;
    return result as any;
  });

export const createPublicBooking = createServerFn({ method: "POST" })
  .validator((d: unknown) =>
    z
      .object({
        tenant_id: z.string().uuid(),
        service_id: z.string().uuid(),
        staff_id: z.string().uuid().nullable().optional(),
        starts_at: z.string(),
        customer_name: z.string().trim().min(2).max(100),
        customer_email: z.string().trim().email().max(255).optional().or(z.literal("")),
        customer_phone: z.string().trim().max(40).optional().or(z.literal("")),
        intake: z.record(z.string(), z.any()).default({}),
        timezone: z.string().max(80),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const sb = publicClient();
    const { data: result, error } = await sb.rpc("public_create_booking", {
      _tenant_id: data.tenant_id,
      _service_id: data.service_id,
      _staff_id: (data.staff_id ?? null) as any,
      _starts_at: data.starts_at,
      _customer_name: data.customer_name,
      _customer_email: (data.customer_email || null) as any,
      _customer_phone: (data.customer_phone || null) as any,
      _intake: data.intake,
      _timezone: data.timezone,
    });
    if (error) {
      const map: Record<string, string> = {
        invalid_service: "That service is no longer available.",
        invalid_staff: "Selected staff member is unavailable.",
        invalid_name: "Please enter your full name.",
        contact_required: "Please provide an email or phone number.",
        past_time: "Please choose a time in the future.",
        slot_taken: "That slot was just booked. Please pick another time.",
      };
      throw new Error(map[error.message] ?? error.message);
    }
    return result as { id: string; ref_code: string };
  });
