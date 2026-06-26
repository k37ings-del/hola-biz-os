import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type WhatsAppCloudConfig = {
  accessToken: string;
  phoneNumberId: string;
  businessAccountId: string;
  webhookVerifyToken: string;
};

export type OnboardingStatus = {
  status: "not_started" | "pending" | "connected" | "error";
  phoneNumber?: string;
  verifiedAt?: string;
  error?: string;
};

export type WhatsAppMessage = {
  to: string;
  body?: string;
  type?: "text" | "template";
  template?: {
    name: string;
    language: string;
    components?: Array<{
      type: string;
      parameters: Array<{ type: string; text: string }>;
    }>;
  };
};

export type WhatsAppSendResult = {
  success: boolean;
  messageId?: string;
  error?: string;
};

export class WhatsAppCloudService {
  private config: WhatsAppCloudConfig;

  constructor(config: WhatsAppCloudConfig) {
    this.config = config;
  }

  private get apiUrl(): string {
    return `https://graph.facebook.com/v19.0/${this.config.phoneNumberId}`;
  }

  private async request(endpoint: string, body: Record<string, unknown>): Promise<any> {
    const url = `${this.apiUrl}${endpoint}`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.config.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const json = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(json.error?.message || `WhatsApp API error: ${response.status}`);
    }
    return json;
  }

  async initiateOnboarding(
    tenantId: string,
    phoneNumber: string,
    adminClient: SupabaseClient<Database>,
  ) {
    const { data: existing } = await adminClient
      .from("tenants")
      .select("wa_phone_number, wa_number_id")
      .eq("id", tenantId)
      .single();

    if (existing?.wa_phone_number && existing?.wa_number_id) {
      return { status: "connected" as const, phoneNumber: existing.wa_phone_number };
    }

    const { data: tenant, error } = await adminClient
      .from("tenants")
      .update({ wa_phone_number: phoneNumber })
      .eq("id", tenantId)
      .select("id, wa_phone_number, wa_number_id")
      .single();

    if (error) throw error;
    return { status: "pending" as const, phoneNumber: tenant?.wa_phone_number };
  }

  async sendTemplateMessage(message: WhatsAppMessage): Promise<WhatsAppSendResult> {
    const payload: any = {
      messaging_product: "whatsapp",
      to: message.to,
      type: "template",
      template: message.template,
    };

    try {
      const result = await this.request("/messages", payload);
      return {
        success: true,
        messageId: result.messages?.[0]?.id,
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  async sendTextMessage(message: WhatsAppMessage): Promise<WhatsAppSendResult> {
    const payload = {
      messaging_product: "whatsapp",
      to: message.to,
      type: "text",
      text: { body: message.body },
    };

    try {
      const result = await this.request("/messages", payload);
      return {
        success: true,
        messageId: result.messages?.[0]?.id,
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  async sendUpdate(
    tenantId: string,
    toPhone: string,
    template: string,
    variables: Record<string, string>,
    adminClient: SupabaseClient<Database>,
  ): Promise<WhatsAppSendResult> {
    const { data: tenant } = await adminClient
      .from("tenants")
      .select("wa_number_id, wa_phone_number, name, brand_color")
      .eq("id", tenantId)
      .single();

    if (!tenant?.wa_number_id || !tenant?.wa_phone_number) {
      return { success: false, error: "WhatsApp not configured for this tenant" };
    }

    const templateParams = Object.entries(variables).map(([key, value]) => ({
      type: "text",
      text: value,
    }));

    return this.sendTemplateMessage({
      to: toPhone,
      type: "template",
      template: {
        name: template,
        language: "en",
        components: [
          {
            type: "body",
            parameters: templateParams,
          },
        ],
      },
    });
  }

  async notifyClients(
    tenantId: string,
    messages: Array<{ to: string; body: string }>,
    adminClient: SupabaseClient<Database>,
  ): Promise<WhatsAppSendResult[]> {
    const { data: tenant } = await adminClient
      .from("tenants")
      .select("wa_phone_number")
      .eq("id", tenantId)
      .single();

    if (!tenant?.wa_phone_number) {
      return messages.map(() => ({ success: false, error: "WhatsApp not configured" }));
    }

    return Promise.all(messages.map((m) => this.sendTextMessage({ to: m.to, body: m.body })));
  }

  async registerWebhook(webhookUrl: string): Promise<{ success: boolean; error?: string }> {
    try {
      await this.request("/webhook", {
        callback_url: webhookUrl,
        verify_token: this.config.webhookVerifyToken,
      });
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  static fromTenant(
    tenant: { wa_phone_number?: string | null; wa_number_id?: string | null },
    accessToken: string,
  ): WhatsAppCloudService | null {
    if (!tenant.wa_phone_number || !tenant.wa_number_id) return null;

    return new WhatsAppCloudService({
      accessToken,
      phoneNumberId: tenant.wa_number_id,
      businessAccountId: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || "",
      webhookVerifyToken: process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || "default_verify_token",
    });
  }
}

export function createWhatsAppService(
  accessToken: string,
  phoneNumberId: string,
): WhatsAppCloudService {
  return new WhatsAppCloudService({
    accessToken,
    phoneNumberId,
    businessAccountId: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || "",
    webhookVerifyToken: process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || "default_verify_token",
  });
}

export function formatPhoneForWhatsApp(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const cleaned = phone.replace(/\s+/g, "").replace(/[^\d+]/g, "");
  if (!cleaned.startsWith("+")) return `+${cleaned}`;
  return cleaned;
}
