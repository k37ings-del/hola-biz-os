import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/webhooks/whatsapp")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const mode = url.searchParams.get("hub.mode");
        const token = url.searchParams.get("hub.verify_token");
        const challenge = url.searchParams.get("hub.challenge");

        const verifyToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;
        if (mode === "subscribe" && token === verifyToken) {
          return new Response(challenge || "OK", { status: 200 });
        }
        return new Response("Forbidden", { status: 403 });
      },

      POST: async ({ request }) => {
        const body = await request.json().catch(() => ({}));

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const entry = body.entry?.[0];
        const changes = entry?.changes?.[0];
        const value = changes?.value;

        if (value?.messages) {
          for (const msg of value.messages) {
            await handleIncomingMessage(supabaseAdmin, msg, value.metadata?.phone_number_id);
          }
        }

        if (value?.statuses) {
          for (const status of value.statuses) {
            await handleMessageStatus(supabaseAdmin, status);
          }
        }

        return new Response(JSON.stringify({ ok: true }), {
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});

async function handleIncomingMessage(sb: any, msg: any, phoneNumberId: string | undefined) {
  const from = msg.from;
  const text = msg.text?.body;
  const timestamp = msg.timestamp;
  const msgId = msg.id;

  const { data: tenant } = await sb
    .from("tenants")
    .select("id")
    .eq("wa_phone_number", phoneNumberId ? `+${phoneNumberId}` : "")
    .single();

  if (!tenant?.id) return;

  const { data: customer } = await sb
    .from("customers")
    .select("id")
    .eq("tenant_id", tenant.id)
    .eq("wa_phone", from)
    .maybeSingle();

  if (!customer?.id) return;

  const { data: conversation } = await sb
    .from("conversations")
    .select("id, unread_count")
    .eq("tenant_id", tenant.id)
    .eq("customer_id", customer.id)
    .maybeSingle();

  let convoId = conversation?.id;
  if (!convoId) {
    const { data: newConvo } = await sb
      .from("conversations")
      .insert({
        tenant_id: tenant.id,
        customer_id: customer.id,
        status: "open",
        unread_count: 0,
        last_message: text,
        last_message_at: new Date(Number(timestamp) * 1000).toISOString(),
      })
      .select("id")
      .single();
    convoId = newConvo?.id;
  }

  if (convoId && text) {
    await sb.from("messages").insert({
      conversation_id: convoId,
      customer_id: customer.id,
      direction: "inbound",
      delivery_status: "delivered",
      message_type: "text",
      content: text,
      meta: { wa_msg_id: msgId } as any,
    });

    const newUnreadCount = (conversation?.unread_count ?? 0) + 1;
    await sb
      .from("conversations")
      .update({
        last_message: text,
        last_message_at: new Date(Number(timestamp) * 1000).toISOString(),
        unread_count: newUnreadCount,
      })
      .eq("id", convoId);
  }
}

async function handleMessageStatus(sb: any, status: any) {
  const msgId = status.id;
  const statusValue = status.status;

  const deliveryStatus =
    statusValue === "delivered" ? "delivered" : statusValue === "read" ? "read" : "sent";

  await sb
    .from("messages")
    .update({ delivery_status: deliveryStatus })
    .eq("meta->wa_msg_id", msgId);
}
