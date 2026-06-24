import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

/**
 * Public iCalendar feed for a staff member.
 * URL: /api/public/ics/<staff.ics_token>.ics
 * Subscribe in Google Calendar / Outlook / Apple Calendar via "Add by URL".
 * One-way sync: HolaWeb → external calendar (read-only feed).
 */
export const Route = createFileRoute("/api/public/ics/$token")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const token = (params.token ?? "").replace(/\.ics$/i, "");
        if (!token || token.length < 10 || token.length > 80) {
          return new Response("Invalid token", { status: 400 });
        }
        const sb = createClient<Database>(
          process.env.SUPABASE_URL!,
          process.env.SUPABASE_PUBLISHABLE_KEY!,
          { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
        );
        const { data, error } = await sb.rpc("public_get_staff_ics", { _token: token });
        if (error || !data) return new Response("Not found", { status: 404 });

        const payload = data as { staff_name: string; tenant_name: string; bookings: any[] };

        const fmt = (iso: string) => {
          const d = new Date(iso);
          const z = (n: number) => String(n).padStart(2, "0");
          return `${d.getUTCFullYear()}${z(d.getUTCMonth() + 1)}${z(d.getUTCDate())}T${z(d.getUTCHours())}${z(d.getUTCMinutes())}${z(d.getUTCSeconds())}Z`;
        };
        const escape = (s: string) => s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");

        const lines: string[] = [
          "BEGIN:VCALENDAR",
          "VERSION:2.0",
          "PRODID:-//HolaWeb//Business OS//EN",
          "METHOD:PUBLISH",
          "CALSCALE:GREGORIAN",
          `X-WR-CALNAME:${escape(payload.tenant_name)} – ${escape(payload.staff_name)}`,
          `X-WR-CALDESC:HolaWeb bookings for ${escape(payload.staff_name)}`,
          "REFRESH-INTERVAL;VALUE=DURATION:PT15M",
          "X-PUBLISHED-TTL:PT15M",
        ];
        for (const b of payload.bookings ?? []) {
          const summary = `${b.service_name ?? "Appointment"} – ${b.customer_name ?? ""}`.trim();
          const desc = [
            b.ref_code && `Ref: ${b.ref_code}`,
            b.customer_phone && `Phone: ${b.customer_phone}`,
            `Status: ${b.status}`,
          ].filter(Boolean).join("\n");
          lines.push(
            "BEGIN:VEVENT",
            `UID:${b.id}@holaweb`,
            `DTSTAMP:${fmt(new Date().toISOString())}`,
            `DTSTART:${fmt(b.starts_at)}`,
            `DTEND:${fmt(b.ends_at)}`,
            `SUMMARY:${escape(summary)}`,
            `DESCRIPTION:${escape(desc)}`,
            `STATUS:${b.status === "CONFIRMED" ? "CONFIRMED" : "TENTATIVE"}`,
            "END:VEVENT",
          );
        }
        lines.push("END:VCALENDAR");

        return new Response(lines.join("\r\n"), {
          status: 200,
          headers: {
            "Content-Type": "text/calendar; charset=utf-8",
            "Cache-Control": "public, max-age=300",
            "Content-Disposition": `inline; filename="holaweb-${token.slice(0, 8)}.ics"`,
          },
        });
      },
    },
  },
});
