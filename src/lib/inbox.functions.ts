import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function tenantOf(supabase: any, userId: string): Promise<string | null> {
  const { data } = await supabase.from("users").select("tenant_id").eq("supabase_auth_id", userId).maybeSingle();
  return data?.tenant_id ?? null;
}

export const listConversations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const tenantId = await tenantOf(context.supabase, context.userId);
    if (!tenantId) return { conversations: [], stats: { open: 0, unread: 0, mine: 0 } };

    const { data, error } = await context.supabase
      .from("conversations")
      .select("id, status, last_message, last_message_at, unread_count, assigned_staff_id, customer:customers(id, display_name, wa_phone, email)")
      .eq("tenant_id", tenantId)
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .limit(200);
    if (error) throw error;

    const list = data ?? [];
    return {
      conversations: list,
      stats: {
        open: list.filter((c: any) => c.status === "open").length,
        unread: list.reduce((s: number, c: any) => s + (c.unread_count ?? 0), 0),
        mine: list.filter((c: any) => c.assigned_staff_id).length,
      },
    };
  });

export const getConversation = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const tenantId = await tenantOf(context.supabase, context.userId);
    if (!tenantId) throw new Error("No tenant");

    const [{ data: convo, error: cErr }, { data: messages, error: mErr }] = await Promise.all([
      context.supabase
        .from("conversations")
        .select("id, status, assigned_staff_id, unread_count, customer:customers(id, display_name, wa_phone, email)")
        .eq("id", data.id)
        .eq("tenant_id", tenantId)
        .maybeSingle(),
      context.supabase
        .from("messages")
        .select("id, content, direction, created_at, delivery_status, message_type")
        .eq("conversation_id", data.id)
        .order("created_at", { ascending: true })
        .limit(200),
    ]);
    if (cErr) throw cErr;
    if (mErr) throw mErr;
    if (!convo) throw new Error("Conversation not found");

    // mark as read
    await context.supabase.from("conversations").update({ unread_count: 0 }).eq("id", data.id).eq("tenant_id", tenantId);

    return { conversation: convo, messages: messages ?? [] };
  });

export const sendMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ conversation_id: z.string().uuid(), content: z.string().trim().min(1).max(4000) }).parse(d))
  .handler(async ({ context, data }) => {
    const tenantId = await tenantOf(context.supabase, context.userId);
    if (!tenantId) throw new Error("No tenant");
    const { data: convo, error: cErr } = await context.supabase
      .from("conversations")
      .select("id, customer_id")
      .eq("id", data.conversation_id)
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (cErr) throw cErr;
    if (!convo) throw new Error("Conversation not found");

    const { error } = await context.supabase.from("messages").insert({
      conversation_id: data.conversation_id,
      customer_id: convo.customer_id,
      direction: "outbound",
      delivery_status: "sent",
      message_type: "text",
      content: data.content,
    });
    if (error) throw error;

    await context.supabase
      .from("conversations")
      .update({ last_message: data.content, last_message_at: new Date().toISOString(), status: "open" })
      .eq("id", data.conversation_id);

    return { ok: true };
  });

export const setConversationStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid(), status: z.enum(["open", "closed", "archived"]) }).parse(d))
  .handler(async ({ context, data }) => {
    const tenantId = await tenantOf(context.supabase, context.userId);
    if (!tenantId) throw new Error("No tenant");
    const { error } = await context.supabase.from("conversations").update({ status: data.status }).eq("id", data.id).eq("tenant_id", tenantId);
    if (error) throw error;
    return { ok: true };
  });
