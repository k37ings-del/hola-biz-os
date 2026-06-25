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

function getOrigin(): string {
  return process.env.PUBLIC_APP_URL || "https://hola-biz-os.lovable.app";
}

async function sendPortalEmail(args: {
  to: string;
  customerName: string | null;
  tenantName: string;
  brandColor: string | null;
  logoUrl: string | null;
  portalUrl: string;
}) {
  const apiKey = process.env.LOVABLE_API_KEY;
  const resendKey = process.env.RESEND_API_KEY;
  if (!apiKey || !resendKey) {
    console.warn("[portal-link] Missing LOVABLE_API_KEY or RESEND_API_KEY; skipping send");
    return;
  }
  const brand = args.brandColor || "#C5283D";
  const html = `<!doctype html><html><body style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#f7f7f8;margin:0;padding:24px;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:520px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #eee;">
    <tr><td style="background:${brand};padding:20px 24px;color:#fff;">
      ${args.logoUrl ? `<img src="${args.logoUrl}" alt="${args.tenantName}" style="height:36px;background:#fff;padding:4px;border-radius:6px;"/>` : ""}
      <h1 style="margin:8px 0 0;font-size:18px;font-weight:600;">${args.tenantName}</h1>
    </td></tr>
    <tr><td style="padding:24px;color:#111;">
      <p style="margin:0 0 12px;">Hi ${args.customerName || "there"},</p>
      <p style="margin:0 0 16px;">Here's your secure link to view, reschedule, or cancel your appointment with <strong>${args.tenantName}</strong>:</p>
      <p style="margin:0 0 20px;"><a href="${args.portalUrl}" style="display:inline-block;background:${brand};color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600;">Open my appointment</a></p>
      <p style="margin:0;color:#666;font-size:12px;">If you didn't request this, you can ignore this email.</p>
    </td></tr>
  </table></body></html>`;

  const res = await fetch("https://connector-gateway.lovable.dev/resend/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "X-Connection-Api-Key": resendKey,
    },
    body: JSON.stringify({
      from: `${args.tenantName} <onboarding@resend.dev>`,
      to: [args.to],
      subject: `Your appointment link · ${args.tenantName}`,
      html,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    console.error("[portal-link] Resend failed", res.status, body);
  }
}

export const requestPortalLink = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ contact: z.string().trim().min(4).max(120) }).parse(d),
  )
  .handler(async ({ data }) => {
    const sb = publicClient();
    const { data: result, error } = await sb.rpc("public_request_portal_link", {
      _contact: data.contact,
    });
    if (error) {
      console.error("[portal-link] RPC error", error);
      // Always return generic shape (no enumeration)
      return { ok: true, channel: null as null | "email" | "none" };
    }
    if (!result) {
      return { ok: true, channel: "none" as const };
    }
    const r = result as any;
    const portalUrl = `${getOrigin()}/p/${r.portal_token}`;

    if (r.customer_email) {
      await sendPortalEmail({
        to: r.customer_email,
        customerName: r.customer_name,
        tenantName: r.tenant_name,
        brandColor: r.brand_color,
        logoUrl: r.logo_url,
        portalUrl,
      });
      return { ok: true, channel: "email" as const };
    }
    // No email on file — we still don't reveal that. Return generic.
    return { ok: true, channel: "none" as const };
  });
