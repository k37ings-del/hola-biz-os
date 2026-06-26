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
  slug: z
    .string()
    .min(2)
    .max(80)
    .regex(/^[a-z0-9-]+$/, "lowercase letters, numbers, dashes only"),
  brand_color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "must be a hex color like #C5283D"),
  logo_url: z.string().url().nullable().or(z.literal("")).optional(),
  email: z.string().email().nullable().or(z.literal("")).optional(),
  whatsapp_number: z.string().max(40).nullable().or(z.literal("")).optional(),
  timezone: z.string().min(2).max(80),
  default_currency: z.string().min(3).max(8),
  buffer_minutes: z.number().int().min(0).max(240),
  business_hours: z
    .object({
      mon: BusinessHoursDay,
      tue: BusinessHoursDay,
      wed: BusinessHoursDay,
      thu: BusinessHoursDay,
      fri: BusinessHoursDay,
      sat: BusinessHoursDay,
      sun: BusinessHoursDay,
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
        "id, name, slug, brand_color, logo_url, favicon_url, email, whatsapp_number, timezone, default_currency, buffer_minutes, business_hours, country, country_code, industry, plan_tier, subscription_status",
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

const UploadLogoSchema = z.object({
  file: z
    .instanceof(File)
    .refine((f) => f.size <= 2097152, "Max 2MB")
    .optional(),
});

export const uploadTenantLogo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => UploadLogoSchema.parse(d))
  .handler(async ({ context, data }) => {
    const u = await tenantOf(context.supabase, context.userId);
    if (!u?.tenant_id) throw new Error("No tenant");
    assertAdmin(u.role);

    if (!data.file) return { ok: true };

    const file = data.file;
    const ext = file.name.split(".").pop()?.toLowerCase() || "png";
    const filename = `logo-${u.tenant_id}-${Date.now()}.${ext}`;
    const filepath = `tenants/${filename}`;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { error: uploadError } = await context.supabase.storage
      .from("tenant-logos")
      .upload(filepath, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) throw uploadError;

    const { data: urlData } = context.supabase.storage.from("tenant-logos").getPublicUrl(filepath);

    // Generate favicon URLs (Supabase storage supports image transformations via URL)
    const baseUrl = urlData.publicUrl.split("?")[0];
    const favicon16 = `${baseUrl}?width=16&height=16&resize=contain`;
    const favicon32 = `${baseUrl}?width=32&height=32&resize=contain`;

    const { error: updateError } = await context.supabase
      .from("tenants")
      .update({ logo_url: urlData.publicUrl, favicon_url: favicon32 })
      .eq("id", u.tenant_id);

    if (updateError) throw updateError;

    return { ok: true, logo_url: urlData.publicUrl, favicon_16: favicon16, favicon_32: favicon32 };
  });
