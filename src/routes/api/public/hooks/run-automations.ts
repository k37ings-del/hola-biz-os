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
            await supabaseAdmin
              .from("automation_runs")
              .update({
                status: dispatched.skipped ? "skipped" : "sent",
                sent_at: new Date().toISOString(),
                result: dispatched as any,
              })
              .eq("id", run.id);
            if (!dispatched.skipped) sent++;
            results.push({ id: run.id, ...dispatched });
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

async function dispatch(sb: any, run: any, resendKey: string | undefined): Promise<DispatchResult> {
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

  // No email key configured → mark as skipped so the queue stays observable
  if (!resendKey) {
    return { channel: "email", skipped: true, reason: "RESEND_API_KEY not configured" };
  }

  let to: string | null = null;
  let subject = "";
  let html = "";
  const brand = tenant?.brand_color || "#C5283D";
  const portalUrl = booking?.portal_token
    ? `https://hola-biz-os.lovable.app/p/${booking.portal_token}`
    : null;
  const startsAt = booking?.starts_at ? new Date(booking.starts_at) : null;
  const whenStr = startsAt
    ? `${startsAt.toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "long" })} at ${startsAt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`
    : "";

  switch (run.trigger_type) {
    case "booking_confirmed":
    case "booking_created": {
      to = booking?.customer_email ?? null;
      subject = `Your booking with ${tenant?.name ?? "us"} is confirmed`;
      html = renderBookingEmail({
        title: "You're booked! 🎉",
        intro: `Thanks for booking with <strong>${escapeHtml(tenant?.name ?? "us")}</strong>.`,
        customerName: booking?.customer_name,
        serviceName: service?.name,
        whenStr,
        refCode: booking?.ref_code,
        portalUrl,
        brand,
        ctaLabel: "View my booking",
      });
      break;
    }
    case "before_appointment":
    case "reminder_24h": {
      to = booking?.customer_email ?? null;
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
      break;
    }
    case "post_visit_review": {
      to = booking?.customer_email ?? null;
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
      const { data: w } = await sb.from("waiting_list").select("customer_email, customer_name").eq("id", run.payload?.waiting_list_id).maybeSingle();
      to = w?.customer_email ?? null;
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
      break;
    }
    default: {
      return { channel: "email", skipped: true, reason: `unsupported trigger: ${run.trigger_type}` };
    }
  }

  if (!to) {
    return { channel: "email", skipped: true, reason: "no recipient email" };
  }

  const fromName = tenant?.name ?? "HolaWeb";
  // Resend's onboarding sender is used until each tenant verifies their own domain.
  const fromAddress = `${fromName} <onboarding@resend.dev>`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${resendKey}`,
    },
    body: JSON.stringify({
      from: fromAddress,
      to: [to],
      subject,
      html,
      reply_to: tenant?.email ?? undefined,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Resend ${res.status}: ${body.slice(0, 200)}`);
  }
  const json: any = await res.json().catch(() => ({}));
  return { channel: "email", provider_id: json?.id ?? null };
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
