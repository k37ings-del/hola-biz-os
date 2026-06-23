import { createFileRoute } from "@tanstack/react-router";

/**
 * Public cron endpoint. Called by pg_cron with the project's anon key as `apikey`.
 * Picks pending automation_runs whose scheduled_at has passed, marks them sent,
 * and (in production) would dispatch to WhatsApp / Email / SMS providers.
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

        // 1. Find bookings that need new runs scheduled (booking_confirmed automations
        //    fire once per booking; before_appointment automations schedule by offset).
        //    For MVP we just process already-scheduled rows.

        // 2. Drain due runs.
        const { data: due, error } = await supabaseAdmin
          .from("automation_runs")
          .select("id, automation_id, booking_id, tenant_id")
          .eq("status", "pending")
          .lte("scheduled_at", new Date().toISOString())
          .limit(50);

        if (error) {
          return new Response(JSON.stringify({ error: error.message }), { status: 500 });
        }

        let sent = 0;
        for (const run of due ?? []) {
          // TODO: render template & dispatch via provider for this tenant.
          // For now we mark as sent so the pipeline is observable.
          const { error: upErr } = await supabaseAdmin
            .from("automation_runs")
            .update({ status: "sent", sent_at: new Date().toISOString() })
            .eq("id", run.id);
          if (!upErr) sent++;
        }

        return new Response(
          JSON.stringify({ ok: true, processed: due?.length ?? 0, sent }),
          { headers: { "Content-Type": "application/json" } },
        );
      },
    },
  },
});
