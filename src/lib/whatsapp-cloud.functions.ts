import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  WhatsAppCloudService,
  formatPhoneForWhatsApp,
  type WhatsAppMessage,
} from "@/lib/whatsapp-cloud.service";

export const WHATSAPP_TEMPLATES = [
  "booking_confirmed",
  "reminder_24h",
  "reminder_1h",
  "payment_request",
  "appointment_cancelled",
] as const;

export const initiateOnboarding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        phone_number: z.string().min(10).max(20),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

    if (!accessToken || !phoneNumberId) {
      throw new Error("WhatsApp Cloud API not configured");
    }

    const service = new WhatsAppCloudService({
      accessToken,
      phoneNumberId,
      businessAccountId: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || "",
      webhookVerifyToken: process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || "",
    });

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const result = await service.initiateOnboarding(
      context.tenantId,
      data.phone_number,
      supabaseAdmin,
    );

    return result;
  });

export const sendWhatsAppMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        to: z.string().min(10).max(20),
        body: z.string().min(1).max(4096).optional(),
        template: z.string().optional(),
        variables: z.record(z.string()).optional(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: tenant } = await context.supabase
      .from("tenants")
      .select("wa_phone_number, wa_number_id")
      .eq("id", context.tenantId)
      .single();

    const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
    if (!accessToken || !tenant?.wa_number_id) {
      return { success: false, error: "WhatsApp not configured" };
    }

    const service = new WhatsAppCloudService({
      accessToken,
      phoneNumberId: tenant.wa_number_id,
      businessAccountId: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || "",
      webhookVerifyToken: process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || "",
    });

    if (data.template) {
      return service.sendUpdate(
        context.tenantId,
        formatPhoneForWhatsApp(data.to) || data.to,
        data.template,
        data.variables || {},
        supabaseAdmin,
      );
    }

    return service.sendTextMessage({
      to: formatPhoneForWhatsApp(data.to) || data.to,
      body: data.body || "",
    });
  });

export const sendBulkNotifications = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        messages: z
          .array(
            z.object({
              to: z.string().min(10).max(20),
              body: z.string().min(1).max(4096),
            }),
          )
          .max(100),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: tenant } = await context.supabase
      .from("tenants")
      .select("wa_phone_number, wa_number_id")
      .eq("id", context.tenantId)
      .single();

    const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
    if (!accessToken || !tenant?.wa_number_id) {
      return { success: false, error: "WhatsApp not configured" };
    }

    const service = new WhatsAppCloudService({
      accessToken,
      phoneNumberId: tenant.wa_number_id,
      businessAccountId: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || "",
      webhookVerifyToken: process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || "",
    });

    const results = await service.notifyClients(context.tenantId, data.messages, supabaseAdmin);

    return { success: true, results };
  });

export const registerWebhook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        webhook_url: z.string().url(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

    if (!accessToken || !phoneNumberId) {
      throw new Error("WhatsApp Cloud API not configured");
    }

    const service = new WhatsAppCloudService({
      accessToken,
      phoneNumberId,
      businessAccountId: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || "",
      webhookVerifyToken: process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || "",
    });

    return service.registerWebhook(data.webhook_url);
  });
