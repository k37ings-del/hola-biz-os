import { createFileRoute } from "@tanstack/react-router";

/**
 * Public cron endpoint. Called by pg_cron with the project's anon key as `apikey`.
 * Drains pending automation_runs and dispatches them via configured channels.
 *
 * Currently supports:
 * - Email via Resend (booking_confirmed, before_appointment, post_visit_review, waitlist_offer)
 *
 * WhatsApp / SMS dispatchers can be added by extending the `dispatch()` function.
 */
export const Route = createFileRoute("/api/public/hooks/run-automations")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = request.headers.get("apikey");
        if (!apiKey) {
          return new Response(JSON.stringify({ error: "missing_apikey" }), { status: 401, headers: { "Content-Type": "application/json" } });
        }
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const resendKey = process.env.RESEND_API_KEY;

        const { data: due, error } = await supabaseAdmin
          .from("automation_runs")
          .select("id, automation_id, booking_id, tenant_id, trigger_type, payload")
          .eq("status", "pending")
          .lte("scheduled_at", new Date().toISOString())
          .limit(50);

        if (error) {
          return new Response(JSON.stringify({ error: error.message }), { status: 500 });
        }

        let sent = 0;
        let failed = 0;
        const results: any[] = [];

        for (const run of due ?? []) {
          try {
            const dispatched = await dispatch(supabaseAdmin, run, resendKey);
            const anySent = dispatched.some((d) => !d.skipped);
            await supabaseAdmin
              .from("automation_runs")
              .update({
                status: anySent ? "sent" : "skipped",
                sent_at: new Date().toISOString(),
                result: { channels: dispatched } as any,
              })
              .eq("id", run.id);
            if (anySent) sent++;
            results.push({ id: run.id, channels: dispatched });
          } catch (err: any) {
            failed++;
            await supabaseAdmin
              .from("automation_runs")
              .update({
                status: "failed",
                error: String(err?.message ?? err).slice(0, 500),
              })
              .eq("id", run.id);
            results.push({ id: run.id, error: String(err?.message ?? err) });
          }
        }

        return new Response(
          JSON.stringify({ ok: true, processed: due?.length ?? 0, sent, failed }),
          { headers: { "Content-Type": "application/json" } },
        );
      },
    },
  },
});

type DispatchResult = { channel: string; skipped?: boolean; reason?: string; provider_id?: string };

async function dispatch(sb: any, run: any, resendKey: string | undefined): Promise<DispatchResult[]> {
  // Resolve booking + tenant context for templating
  let booking: any = null;
  let tenant: any = null;
  let service: any = null;

  if (run.booking_id) {
    const { data } = await sb.from("bookings").select("*").eq("id", run.booking_id).maybeSingle();
    booking = data;
  }
  if (run.tenant_id) {
    const { data } = await sb.from("tenants").select("id, name, slug, email, brand_color").eq("id", run.tenant_id).maybeSingle();
    tenant = data;
  }
  if (booking?.service_id) {
    const { data } = await sb.from("services").select("name, duration_minutes").eq("id", booking.service_id).maybeSingle();
    service = data;
  }
  let staff: any = null;
  if (booking?.staff_id) {
    const { data } = await sb.from("staff").select("name, email").eq("id", booking.staff_id).maybeSingle();
    staff = data;
  }

  const brand = tenant?.brand_color || "#C5283D";
  const portalUrl = booking?.portal_token
    ? `https://hola-biz-os.lovable.app/p/${booking.portal_token}`
    : null;
  const startsAt = booking?.starts_at ? new Date(booking.starts_at) : null;
  const whenStr = startsAt
    ? `${startsAt.toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "long" })} at ${startsAt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`
    : "";

  let toEmail: string | null = null;
  let toPhone: string | null = null;
  let subject = "";
  let html = "";
  let waText = "";
  // Channels: email always; WhatsApp for booking_confirmed + reminders only
  let waEnabled = false;

  switch (run.trigger_type) {
    case "booking_confirmed":
    case "booking_created": {
      toEmail = booking?.customer_email ?? null;
      toPhone = booking?.customer_phone ?? null;
      waEnabled = true;
      subject = `Booking confirmed · ${booking?.ref_code ?? ""} · ${tenant?.name ?? "us"}`;
      html = renderBookingEmail({
        title: "You're booked! 🎉",
        intro: `Thanks for booking with <strong>${escapeHtml(tenant?.name ?? "us")}</strong>. Keep this email — it's your receipt and includes a link you can reopen anytime to track your booking.`,
        customerName: booking?.customer_name,
        customerEmail: booking?.customer_email,
        customerPhone: booking?.customer_phone,
        serviceName: service?.name,
        staffName: staff?.name,
        whenStr,
        durationMin: service?.duration_minutes,
        refCode: booking?.ref_code,
        amountCents: booking?.amount_cents,
        currency: booking?.currency,
        status: booking?.status,
        tenantName: tenant?.name,
        tenantEmail: tenant?.email,
        portalUrl,
        brand,
        ctaLabel: "Track my booking",
        invoice: true,
      });
      waText = `Hi ${booking?.customer_name ?? ""}, your booking with ${tenant?.name ?? "us"} is confirmed ✅\n${service?.name ? service.name + " — " : ""}${whenStr}\nRef: ${booking?.ref_code ?? ""}${portalUrl ? `\nTrack: ${portalUrl}` : ""}`;

      break;
    }
    case "before_appointment":
    case "reminder_24h": {
      toEmail = booking?.customer_email ?? null;
      toPhone = booking?.customer_phone ?? null;
      waEnabled = true;
      subject = `Reminder: your appointment tomorrow with ${tenant?.name ?? "us"}`;
      html = renderBookingEmail({
        title: "See you soon 👋",
        intro: `This is a friendly reminder of your upcoming appointment with <strong>${escapeHtml(tenant?.name ?? "us")}</strong>.`,
        customerName: booking?.customer_name,
        serviceName: service?.name,
        whenStr,
        refCode: booking?.ref_code,
        portalUrl,
        brand,
        ctaLabel: "Manage my booking",
      });
      waText = `Reminder 👋 ${booking?.customer_name ?? ""}, you have an appointment with ${tenant?.name ?? "us"}.\n${service?.name ? service.name + " — " : ""}${whenStr}${portalUrl ? `\nManage: ${portalUrl}` : ""}`;
      break;
    }
    case "post_visit_review": {
      toEmail = booking?.customer_email ?? null;
      subject = `How was your visit to ${tenant?.name ?? "us"}?`;
      html = renderBookingEmail({
        title: "Thanks for visiting 💛",
        intro: `We hope you had a great experience with <strong>${escapeHtml(tenant?.name ?? "us")}</strong>. A short review would mean the world.`,
        customerName: booking?.customer_name,
        serviceName: service?.name,
        whenStr,
        refCode: booking?.ref_code,
        portalUrl,
        brand,
        ctaLabel: "Leave a review",
      });
      break;
    }
    case "waitlist_offer": {
      const { claim_token } = run.payload ?? {};
      const { data: w } = await sb.from("waiting_list").select("customer_email, customer_name, customer_phone").eq("id", run.payload?.waiting_list_id).maybeSingle();
      toEmail = w?.customer_email ?? null;
      toPhone = w?.customer_phone ?? null;
      waEnabled = true;
      const claimUrl = claim_token ? `https://hola-biz-os.lovable.app/waitlist/${claim_token}` : null;
      subject = `A slot opened up at ${tenant?.name ?? "us"} — claim it now`;
      html = renderBookingEmail({
        title: "A spot opened up ⏰",
        intro: `Good news, ${escapeHtml(w?.customer_name ?? "friend")} — a slot just opened with <strong>${escapeHtml(tenant?.name ?? "us")}</strong>. You have 2 hours to claim it.`,
        customerName: w?.customer_name,
        serviceName: service?.name,
        whenStr: run.payload?.starts_at ? new Date(run.payload.starts_at).toLocaleString() : "",
        refCode: "",
        portalUrl: claimUrl,
        brand,
        ctaLabel: "Claim my slot",
      });
      waText = `⏰ A spot just opened at ${tenant?.name ?? "us"}! Claim within 2h: ${claimUrl ?? ""}`;
      break;
    }
    default: {
      return [{ channel: "email", skipped: true, reason: `unsupported trigger: ${run.trigger_type}` }];
    }
  }

  const results: DispatchResult[] = [];
  results.push(await sendEmail({ to: toEmail, subject, html, tenant, resendKey }));
  if (waEnabled && waText) {
    results.push(await sendWhatsApp({ to: toPhone, text: waText }));
  }
  // Also notify the assigned staff member on booking_created / booking_confirmed
  if ((run.trigger_type === "booking_created" || run.trigger_type === "booking_confirmed") && staff?.email) {
    const staffSubject = `New booking: ${booking?.customer_name ?? "Customer"} — ${service?.name ?? "appointment"}`;
    const staffHtml = renderBookingEmail({
      title: "New booking assigned to you 📅",
      intro: `You have a new booking at <strong>${escapeHtml(tenant?.name ?? "your workspace")}</strong>.`,
      customerName: booking?.customer_name,
      serviceName: service?.name,
      whenStr,
      refCode: booking?.ref_code,
      portalUrl: null,
      brand,
      ctaLabel: undefined,
    });
    results.push(await sendEmail({ to: staff.email, subject: staffSubject, html: staffHtml, tenant, resendKey }));
  }
  return results;
}

async function sendEmail(opts: { to: string | null; subject: string; html: string; tenant: any; resendKey: string | undefined }): Promise<DispatchResult> {
  if (!opts.resendKey) return { channel: "email", skipped: true, reason: "RESEND_API_KEY not configured" };
  if (!opts.to) return { channel: "email", skipped: true, reason: "no recipient email" };
  const fromName = opts.tenant?.name ?? "HolaWeb";
  const fromAddress = `${fromName} <onboarding@resend.dev>`;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${opts.resendKey}` },
    body: JSON.stringify({ from: fromAddress, to: [opts.to], subject: opts.subject, html: opts.html, reply_to: opts.tenant?.email ?? undefined }),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const json: any = await res.json().catch(() => ({}));
  return { channel: "email", provider_id: json?.id ?? null };
}

async function sendWhatsApp(opts: { to: string | null; text: string }): Promise<DispatchResult> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_WHATSAPP_FROM; // e.g. "whatsapp:+14155238886"
  if (!sid || !token || !from) {
    return { channel: "whatsapp", skipped: true, reason: "Twilio WhatsApp not configured" };
  }
  if (!opts.to) return { channel: "whatsapp", skipped: true, reason: "no recipient phone" };
  const toNumber = opts.to.startsWith("whatsapp:") ? opts.to : `whatsapp:${opts.to.replace(/\s+/g, "")}`;
  const auth = Buffer.from(`${sid}:${token}`).toString("base64");
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Authorization: `Basic ${auth}` },
    body: new URLSearchParams({ To: toNumber, From: from, Body: opts.text }),
  });
  if (!res.ok) throw new Error(`Twilio ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const json: any = await res.json().catch(() => ({}));
  return { channel: "whatsapp", provider_id: json?.sid ?? null };
}


function escapeHtml(s: string | null | undefined) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function renderBookingEmail(opts: {
  title: string;
  intro: string;
  customerName?: string | null;
  serviceName?: string | null;
  whenStr?: string | null;
  refCode?: string | null;
  portalUrl?: string | null;
  brand: string;
  ctaLabel?: string;
}) {
  const cta = opts.portalUrl && opts.ctaLabel
    ? `<a href="${opts.portalUrl}" style="display:inline-block;background:${opts.brand};color:#fff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:600;font-size:14px;margin-top:18px">${escapeHtml(opts.ctaLabel)}</a>`
    : "";
  const rows = [
    opts.customerName && row("Name", escapeHtml(opts.customerName)),
    opts.serviceName && row("Service", escapeHtml(opts.serviceName)),
    opts.whenStr && row("When", escapeHtml(opts.whenStr)),
    opts.refCode && row("Reference", `<code style="font-family:monospace">${escapeHtml(opts.refCode)}</code>`),
  ].filter(Boolean).join("");

  return `<!doctype html><html><body style="margin:0;background:#f6f6f8;font-family:-apple-system,Segoe UI,sans-serif;color:#1a1a1a">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
    <tr><td align="center" style="padding:32px 16px">
      <table role="presentation" width="560" cellspacing="0" cellpadding="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.06)">
        <tr><td style="background:${opts.brand};padding:24px 28px;color:#fff">
          <p style="margin:0;font-size:11px;letter-spacing:.12em;text-transform:uppercase;opacity:.85">HolaWeb</p>
          <h1 style="margin:6px 0 0;font-size:22px;font-weight:600">${escapeHtml(opts.title)}</h1>
        </td></tr>
        <tr><td style="padding:24px 28px">
          <p style="margin:0 0 14px;font-size:14px;line-height:1.6">${opts.intro}</p>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="font-size:13px;border-top:1px solid #eee;margin-top:8px">${rows}</table>
          ${cta}
        </td></tr>
        <tr><td style="padding:14px 28px;background:#fafafa;color:#888;font-size:11px;text-align:center">
          Powered by HolaWeb Business OS
        </td></tr>
      </table>
    </td></tr>
  </table></body></html>`;
}

function row(k: string, v: string) {
  return `<tr><td style="padding:10px 0;color:#888;width:90px">${k}</td><td style="padding:10px 0">${v}</td></tr>`;
}
