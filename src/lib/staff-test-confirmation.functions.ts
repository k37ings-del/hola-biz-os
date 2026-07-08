import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { buildIcsInvite } from "@/lib/ics-invite";

/**
 * Admin/owner action: send a test booking confirmation to a staff member using
 * their exact notification preferences (email + optional .ics), and also send
 * a copy of the CLIENT confirmation to the caller's email so both templates
 * can be verified in one click. Does not create a real booking.
 */
export const sendStaffTestConfirmation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      staff_id: z.string().uuid(),
      client_test_email: z.string().email().optional(),
    }).parse(d),
  )
  .handler(async ({ context, data }) => {
    // Confirm caller is an admin/owner of the same tenant as the staff
    const { data: me } = await context.supabase
      .from("users")
      .select("tenant_id, role, admin_access, email")
      .eq("supabase_auth_id", context.userId)
      .maybeSingle();
    if (!me?.tenant_id) throw new Error("No tenant");
    const role = (me as any).role;
    if (!(role === "owner" || role === "admin" || (me as any).admin_access)) {
      throw new Error("Forbidden: owners and admins only");
    }

    const { data: staff } = await context.supabase
      .from("staff")
      .select("id, name, email, notify_email_on_booking, notify_calendar_invite")
      .eq("id", data.staff_id)
      .eq("tenant_id", me.tenant_id)
      .maybeSingle();
    if (!staff) throw new Error("Staff not found");

    const { data: tenant } = await context.supabase
      .from("tenants")
      .select("name, brand_color, email, timezone")
      .eq("id", me.tenant_id)
      .maybeSingle();

    const brand = (tenant as any)?.brand_color || "#C5283D";
    const startsAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const endsAt = new Date(startsAt.getTime() + 45 * 60 * 1000);
    const refCode = `TEST-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    const testClient = { name: "Ada Test Client", email: "ada.test@example.com", phone: "+2348012345678" };
    const whenStr = `${startsAt.toLocaleDateString("en-US", {
      weekday: "long", day: "numeric", month: "long", timeZone: (tenant as any)?.timezone,
    })} at ${startsAt.toLocaleTimeString("en-US", {
      hour: "numeric", minute: "2-digit", timeZone: (tenant as any)?.timezone,
    })}`;

    const resendKey = process.env.RESEND_API_KEY;
    const results: Array<{ target: string; sent: boolean; skipped_reason?: string; id?: string }> = [];

    // ---- Staff test email ----
    if (!staff.email) {
      results.push({ target: "staff", sent: false, skipped_reason: "no personal email set for this staff member" });
    } else if (staff.notify_email_on_booking === false) {
      results.push({ target: "staff", sent: false, skipped_reason: "staff opted out of booking emails" });
    } else if (!resendKey) {
      results.push({ target: "staff", sent: false, skipped_reason: "RESEND_API_KEY not configured" });
    } else {
      const html = renderTestEmail({
        title: "🧪 Test: new booking assigned to you",
        intro: `This is a <strong>test</strong> confirmation to verify your notification setup at <strong>${escapeHtml((tenant as any)?.name ?? "your workspace")}</strong>. No real booking was created.`,
        whenStr, refCode, brand, staffName: staff.name, clientName: testClient.name,
        clientEmail: testClient.email, clientPhone: testClient.phone,
        icsNote: staff.notify_calendar_invite !== false,
      });
      const ics = staff.notify_calendar_invite !== false
        ? buildIcsInvite({
            uid: `${refCode}@holaweb-test`,
            startsAt: startsAt.toISOString(),
            endsAt: endsAt.toISOString(),
            summary: `[TEST] Booking — ${testClient.name}`,
            description: `Ref: ${refCode}\nClient: ${testClient.name}\nEmail: ${testClient.email}\nPhone: ${testClient.phone}`,
            organizerName: (tenant as any)?.name ?? "HolaWeb",
            organizerEmail: (tenant as any)?.email ?? undefined,
            attendeeName: staff.name,
            attendeeEmail: staff.email,
            status: "CONFIRMED",
            tenantTimezone: (tenant as any)?.timezone,
          })
        : null;
      const r = await sendResend({
        resendKey,
        from: `${(tenant as any)?.name ?? "HolaWeb"} <onboarding@resend.dev>`,
        to: staff.email,
        subject: `[Test] Booking confirmation — ${refCode}`,
        html,
        replyTo: (tenant as any)?.email ?? undefined,
        ics,
        icsFilename: `test-booking-${refCode}.ics`,
      });
      results.push({ target: "staff", sent: r.ok, id: r.id, skipped_reason: r.ok ? undefined : r.err });
    }

    // ---- Client test email ----
    const clientTo = data.client_test_email || (me as any).email;
    if (!clientTo) {
      results.push({ target: "client", sent: false, skipped_reason: "no client test email provided" });
    } else if (!resendKey) {
      results.push({ target: "client", sent: false, skipped_reason: "RESEND_API_KEY not configured" });
    } else {
      const html = renderTestEmail({
        title: "🧪 Test: booking confirmation (client view)",
        intro: `Preview of the confirmation email your clients would receive from <strong>${escapeHtml((tenant as any)?.name ?? "your workspace")}</strong>. No real booking was created.`,
        whenStr, refCode, brand, staffName: staff.name, clientName: testClient.name,
        clientEmail: testClient.email, clientPhone: testClient.phone,
        icsNote: false,
      });
      const r = await sendResend({
        resendKey,
        from: `${(tenant as any)?.name ?? "HolaWeb"} <onboarding@resend.dev>`,
        to: clientTo,
        subject: `[Test] Client booking confirmation — ${refCode}`,
        html,
        replyTo: (tenant as any)?.email ?? undefined,
      });
      results.push({ target: "client", sent: r.ok, id: r.id, skipped_reason: r.ok ? undefined : r.err });
    }

    return { ok: true, ref_code: refCode, results };
  });

async function sendResend(opts: {
  resendKey: string;
  from: string;
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
  ics?: string | null;
  icsFilename?: string;
}): Promise<{ ok: boolean; id?: string; err?: string }> {
  const body: any = {
    from: opts.from, to: [opts.to], subject: opts.subject, html: opts.html,
    reply_to: opts.replyTo,
  };
  if (opts.ics) {
    body.attachments = [{
      filename: opts.icsFilename ?? "invite.ics",
      content: Buffer.from(opts.ics, "utf-8").toString("base64"),
      content_type: "text/calendar; method=REQUEST; charset=utf-8",
    }];
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${opts.resendKey}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) return { ok: false, err: `${res.status}: ${(await res.text()).slice(0, 160)}` };
  const j: any = await res.json().catch(() => ({}));
  return { ok: true, id: j?.id };
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function renderTestEmail(opts: {
  title: string;
  intro: string;
  whenStr: string;
  refCode: string;
  brand: string;
  staffName: string;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  icsNote: boolean;
}) {
  return `<!doctype html><html><body style="margin:0;padding:24px;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e5e5e5">
    <div style="background:${opts.brand};padding:20px 24px;color:#fff">
      <div style="font-size:11px;text-transform:uppercase;letter-spacing:1.2px;opacity:0.85">Holaweb — Test email</div>
      <div style="font-size:20px;font-weight:600;margin-top:4px">${escapeHtml(opts.title)}</div>
    </div>
    <div style="padding:24px;color:#111;font-size:14px;line-height:1.55">
      <p style="margin:0 0 14px">${opts.intro}</p>
      <table style="width:100%;border-collapse:collapse;font-size:13px;margin-top:12px">
        <tr><td style="padding:6px 0;color:#666;width:120px">Ref</td><td style="padding:6px 0"><code>${escapeHtml(opts.refCode)}</code></td></tr>
        <tr><td style="padding:6px 0;color:#666">When</td><td style="padding:6px 0">${escapeHtml(opts.whenStr)}</td></tr>
        <tr><td style="padding:6px 0;color:#666">Staff</td><td style="padding:6px 0">${escapeHtml(opts.staffName)}</td></tr>
        <tr><td style="padding:6px 0;color:#666">Client</td><td style="padding:6px 0">${escapeHtml(opts.clientName)}</td></tr>
        <tr><td style="padding:6px 0;color:#666">Email</td><td style="padding:6px 0">${escapeHtml(opts.clientEmail)}</td></tr>
        <tr><td style="padding:6px 0;color:#666">Phone</td><td style="padding:6px 0">${escapeHtml(opts.clientPhone)}</td></tr>
      </table>
      ${opts.icsNote ? `<p style="margin-top:14px;font-size:12px;color:#666">A calendar invite (<code>.ics</code>) is attached. Accept it to verify auto-add to your calendar.</p>` : ""}
      <p style="margin-top:20px;font-size:11px;color:#888">Sent from Holaweb Business OS to verify your booking notifications. Ignore if unexpected.</p>
    </div>
  </div>
</body></html>`;
}
