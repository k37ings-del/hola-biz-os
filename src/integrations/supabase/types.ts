export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      ai_agents: {
        Row: {
          active: boolean
          config: Json
          created_at: string
          id: string
          name: string | null
          purpose: string | null
          tenant_id: string
        }
        Insert: {
          active?: boolean
          config?: Json
          created_at?: string
          id?: string
          name?: string | null
          purpose?: string | null
          tenant_id: string
        }
        Update: {
          active?: boolean
          config?: Json
          created_at?: string
          id?: string
          name?: string | null
          purpose?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_agents_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      automations: {
        Row: {
          action_type: string | null
          active: boolean
          config: Json
          created_at: string
          id: string
          name: string | null
          tenant_id: string
          trigger_type: string | null
        }
        Insert: {
          action_type?: string | null
          active?: boolean
          config?: Json
          created_at?: string
          id?: string
          name?: string | null
          tenant_id: string
          trigger_type?: string | null
        }
        Update: {
          action_type?: string | null
          active?: boolean
          config?: Json
          created_at?: string
          id?: string
          name?: string | null
          tenant_id?: string
          trigger_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "automations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          amount_cents: number
          created_at: string
          currency: string
          customer_id: string | null
          ends_at: string
          id: string
          notes: string | null
          ref_code: string
          service_id: string | null
          staff_id: string | null
          starts_at: string
          status: string
          tenant_id: string
        }
        Insert: {
          amount_cents: number
          created_at?: string
          currency: string
          customer_id?: string | null
          ends_at: string
          id?: string
          notes?: string | null
          ref_code: string
          service_id?: string | null
          staff_id?: string | null
          starts_at: string
          status?: string
          tenant_id: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          currency?: string
          customer_id?: string | null
          ends_at?: string
          id?: string
          notes?: string | null
          ref_code?: string
          service_id?: string | null
          staff_id?: string | null
          starts_at?: string
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          created_at: string
          customer_id: string
          id: string
          last_message: string | null
          last_message_at: string | null
          status: string
          tenant_id: string
          unread_count: number
        }
        Insert: {
          created_at?: string
          customer_id: string
          id?: string
          last_message?: string | null
          last_message_at?: string | null
          status?: string
          tenant_id: string
          unread_count?: number
        }
        Update: {
          created_at?: string
          customer_id?: string
          id?: string
          last_message?: string | null
          last_message_at?: string | null
          status?: string
          tenant_id?: string
          unread_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "conversations_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          booking_count: number
          country_code: string | null
          created_at: string
          display_name: string
          email: string | null
          first_seen: string
          id: string
          notes: string | null
          tags: Json
          tenant_id: string
          wa_phone: string | null
        }
        Insert: {
          booking_count?: number
          country_code?: string | null
          created_at?: string
          display_name: string
          email?: string | null
          first_seen?: string
          id?: string
          notes?: string | null
          tags?: Json
          tenant_id: string
          wa_phone?: string | null
        }
        Update: {
          booking_count?: number
          country_code?: string | null
          created_at?: string
          display_name?: string
          email?: string | null
          first_seen?: string
          id?: string
          notes?: string | null
          tags?: Json
          tenant_id?: string
          wa_phone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      gateway_config: {
        Row: {
          active: boolean
          config: Json
          created_at: string
          gateway: string
          id: string
          tenant_id: string
        }
        Insert: {
          active?: boolean
          config?: Json
          created_at?: string
          gateway: string
          id?: string
          tenant_id: string
        }
        Update: {
          active?: boolean
          config?: Json
          created_at?: string
          gateway?: string
          id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gateway_config_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount_cents: number
          created_at: string
          currency: string
          customer_id: string | null
          description: string | null
          due_date: string | null
          id: string
          invoice_number: string
          payment_link: string | null
          status: string
          tenant_id: string
        }
        Insert: {
          amount_cents: number
          created_at?: string
          currency: string
          customer_id?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          invoice_number: string
          payment_link?: string | null
          status?: string
          tenant_id: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          currency?: string
          customer_id?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          invoice_number?: string
          payment_link?: string | null
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string | null
          conversation_id: string
          created_at: string
          customer_id: string | null
          direction: string
          id: string
          message_type: string
          meta: Json
        }
        Insert: {
          content?: string | null
          conversation_id: string
          created_at?: string
          customer_id?: string | null
          direction: string
          id?: string
          message_type?: string
          meta?: Json
        }
        Update: {
          content?: string | null
          conversation_id?: string
          created_at?: string
          customer_id?: string | null
          direction?: string
          id?: string
          message_type?: string
          meta?: Json
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          booking_id: string | null
          created_at: string
          customer_id: string | null
          id: string
          scheduled_at: string | null
          sent_at: string | null
          status: string
          tenant_id: string
          type: string | null
          wa_msg_id: string | null
        }
        Insert: {
          booking_id?: string | null
          created_at?: string
          customer_id?: string | null
          id?: string
          scheduled_at?: string | null
          sent_at?: string | null
          status?: string
          tenant_id: string
          type?: string | null
          wa_msg_id?: string | null
        }
        Update: {
          booking_id?: string | null
          created_at?: string
          customer_id?: string | null
          id?: string
          scheduled_at?: string | null
          sent_at?: string | null
          status?: string
          tenant_id?: string
          type?: string | null
          wa_msg_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount_cents: number
          booking_id: string | null
          created_at: string
          currency: string
          customer_id: string | null
          gateway: string | null
          gateway_payload: Json
          gateway_ref: string | null
          id: string
          invoice_id: string | null
          paid_at: string | null
          retry_count: number
          status: string
          tenant_id: string
        }
        Insert: {
          amount_cents: number
          booking_id?: string | null
          created_at?: string
          currency: string
          customer_id?: string | null
          gateway?: string | null
          gateway_payload?: Json
          gateway_ref?: string | null
          id?: string
          invoice_id?: string | null
          paid_at?: string | null
          retry_count?: number
          status?: string
          tenant_id: string
        }
        Update: {
          amount_cents?: number
          booking_id?: string | null
          created_at?: string
          currency?: string
          customer_id?: string | null
          gateway?: string | null
          gateway_payload?: Json
          gateway_ref?: string | null
          id?: string
          invoice_id?: string | null
          paid_at?: string | null
          retry_count?: number
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          active: boolean
          created_at: string
          currency: string
          duration_minutes: number
          id: string
          name: string
          price_cents: number
          tenant_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          currency: string
          duration_minutes: number
          id?: string
          name: string
          price_cents: number
          tenant_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          currency?: string
          duration_minutes?: number
          id?: string
          name?: string
          price_cents?: number
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "services_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      staff: {
        Row: {
          availability: Json
          created_at: string
          id: string
          name: string
          tenant_id: string
          wa_number: string | null
        }
        Insert: {
          availability?: Json
          created_at?: string
          id?: string
          name: string
          tenant_id: string
          wa_number?: string | null
        }
        Update: {
          availability?: Json
          created_at?: string
          id?: string
          name?: string
          tenant_id?: string
          wa_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "staff_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_settings: {
        Row: {
          created_at: string
          id: string
          module: string
          settings: Json
          tenant_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          module: string
          settings?: Json
          tenant_id: string
        }
        Update: {
          created_at?: string
          id?: string
          module?: string
          settings?: Json
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_settings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          business_hours: Json
          country: string
          country_code: string
          created_at: string
          email: string | null
          id: string
          industry: string | null
          is_demo: boolean
          name: string
          plan_tier: string
          subscription_status: string
          wa_number_id: string | null
          wa_phone_number: string | null
          whatsapp_number: string | null
        }
        Insert: {
          business_hours?: Json
          country: string
          country_code: string
          created_at?: string
          email?: string | null
          id?: string
          industry?: string | null
          is_demo?: boolean
          name: string
          plan_tier?: string
          subscription_status?: string
          wa_number_id?: string | null
          wa_phone_number?: string | null
          whatsapp_number?: string | null
        }
        Update: {
          business_hours?: Json
          country?: string
          country_code?: string
          created_at?: string
          email?: string | null
          id?: string
          industry?: string | null
          is_demo?: boolean
          name?: string
          plan_tier?: string
          subscription_status?: string
          wa_number_id?: string | null
          wa_phone_number?: string | null
          whatsapp_number?: string | null
        }
        Relationships: []
      }
      users: {
        Row: {
          admin_access: boolean
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          supabase_auth_id: string
          tenant_id: string
        }
        Insert: {
          admin_access?: boolean
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          supabase_auth_id: string
          tenant_id: string
        }
        Update: {
          admin_access?: boolean
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          supabase_auth_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "users_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_tenant_id: { Args: never; Returns: string }
      current_user_role: {
        Args: never
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_admin_access: { Args: never; Returns: boolean }
    }
    Enums: {
      app_role: "owner" | "admin" | "manager" | "agent"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["owner", "admin", "manager", "agent"],
    },
  },
} as const
