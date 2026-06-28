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

function assertAdmin(role: string | null) {
  if (!["owner", "admin"].includes(role ?? "")) throw new Error("Forbidden");
}

const BusinessHoursDay = z.object({
  active: z.boolean(),
  open: z.string().regex(/^\d{2}:\d{2}$/),
  close: z.string().regex(/^\d{2}:\d{2}$/),
});

const BrandingSchema = z.object({
  name: z.string().min(2).max(120),
  slug: z.string().min(2).max(80).regex(/^[a-z0-9-]+$/, "lowercase letters, numbers, dashes only"),
  brand_color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "must be a hex color like #C5283D"),
  logo_url: z.string().url().nullable().or(z.literal("")).optional(),
  email: z.string().email().nullable().or(z.literal("")).optional(),
  whatsapp_number: z.string().max(40).nullable().or(z.literal("")).optional(),
  timezone: z.string().min(2).max(80),
  default_currency: z.string().min(3).max(8),
  buffer_minutes: z.number().int().min(0).max(240),
  business_hours: z
    .object({
      mon: BusinessHoursDay, tue: BusinessHoursDay, wed: BusinessHoursDay,
      thu: BusinessHoursDay, fri: BusinessHoursDay, sat: BusinessHoursDay, sun: BusinessHoursDay,
    })
    .partial()
    .optional(),
});

export const getTenantSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const u = await tenantOf(context.supabase, context.userId);
    if (!u?.tenant_id) return null;
    const { data, error } = await context.supabase
      .from("tenants")
      .select(
        "id, name, slug, brand_color, logo_url, email, whatsapp_number, timezone, default_currency, buffer_minutes, business_hours, country, country_code, industry, plan_tier, subscription_status",
      )
      .eq("id", u.tenant_id)
      .maybeSingle();
    if (error) throw error;
    return { ...data, role: u.role };
  });

export const saveTenantBranding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => BrandingSchema.parse(d))
  .handler(async ({ context, data }) => {
    const u = await tenantOf(context.supabase, context.userId);
    if (!u?.tenant_id) throw new Error("No tenant");
    assertAdmin(u.role);

    // Unique slug check (ignore self)
    const { data: dup } = await context.supabase
      .from("tenants")
      .select("id")
      .eq("slug", data.slug)
      .neq("id", u.tenant_id)
      .maybeSingle();
    if (dup) throw new Error("That booking page URL is already taken");

    const patch: any = {
      name: data.name,
      slug: data.slug,
      brand_color: data.brand_color,
      logo_url: data.logo_url || null,
      email: data.email || null,
      whatsapp_number: data.whatsapp_number || null,
      timezone: data.timezone,
      default_currency: data.default_currency,
      buffer_minutes: data.buffer_minutes,
    };
    if (data.business_hours) patch.business_hours = data.business_hours;

    const { error } = await context.supabase.from("tenants").update(patch).eq("id", u.tenant_id);
    if (error) throw error;
    return { ok: true };
  });

const LogoUploadSchema = z.object({
  filename: z.string().min(1).max(120),
  content_type: z.string().min(3).max(100),
  // Base64-encoded file body (without the data: prefix). Capped to roughly 2 MB.
  data_base64: z.string().min(8).max(3_500_000),
});

const ALLOWED_LOGO_TYPES = new Set([
  "image/png", "image/jpeg", "image/jpg", "image/webp", "image/svg+xml",
  "image/x-icon", "image/vnd.microsoft.icon",
]);

const MAX_LOGO_BYTES = 2 * 1024 * 1024;

export const uploadTenantLogo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => LogoUploadSchema.parse(d))
  .handler(async ({ context, data }) => {
    const u = await tenantOf(context.supabase, context.userId);
    if (!u?.tenant_id) throw new Error("No tenant");
    assertAdmin(u.role);

    if (!ALLOWED_LOGO_TYPES.has(data.content_type)) {
      throw new Error("Use a PNG, JPG, WEBP, SVG, or ICO image");
    }
    const bytes = Buffer.from(data.data_base64, "base64");
    if (bytes.byteLength === 0) throw new Error("File appears to be empty");
    if (bytes.byteLength > MAX_LOGO_BYTES) throw new Error("Logo must be 2 MB or smaller");

    const ext = (data.filename.split(".").pop() || "png").toLowerCase().replace(/[^a-z0-9]/g, "");
    const objectPath = `${u.tenant_id}/logo-${Date.now()}.${ext}`;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: upErr } = await supabaseAdmin.storage
      .from("tenant-logos")
      .upload(objectPath, bytes, { contentType: data.content_type, upsert: true });
    if (upErr) throw upErr;

    // Bucket is private; mint a long-lived signed URL (1 year).
    const { data: signed, error: signErr } = await supabaseAdmin.storage
      .from("tenant-logos")
      .createSignedUrl(objectPath, 60 * 60 * 24 * 365);
    if (signErr || !signed?.signedUrl) throw signErr ?? new Error("Could not generate logo URL");

    const { error } = await supabaseAdmin
      .from("tenants")
      .update({ logo_url: signed.signedUrl })
      .eq("id", u.tenant_id);
    if (error) throw error;

    return { ok: true, logo_url: signed.signedUrl };
  });
