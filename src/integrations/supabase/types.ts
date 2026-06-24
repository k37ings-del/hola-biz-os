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
      audit_logs: {
        Row: {
          action: string
          actor_email: string | null
          actor_user_id: string | null
          after: Json | null
          before: Json | null
          created_at: string
          entity: string
          entity_id: string | null
          id: string
          tenant_id: string
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_user_id?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string
          entity: string
          entity_id?: string | null
          id?: string
          tenant_id: string
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_user_id?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string
          entity?: string
          entity_id?: string | null
          id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_runs: {
        Row: {
          automation_id: string
          booking_id: string | null
          created_at: string
          error: string | null
          id: string
          scheduled_at: string
          sent_at: string | null
          status: string
          tenant_id: string
        }
        Insert: {
          automation_id: string
          booking_id?: string | null
          created_at?: string
          error?: string | null
          id?: string
          scheduled_at: string
          sent_at?: string | null
          status?: string
          tenant_id: string
        }
        Update: {
          automation_id?: string
          booking_id?: string | null
          created_at?: string
          error?: string | null
          id?: string
          scheduled_at?: string
          sent_at?: string | null
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_runs_automation_id_fkey"
            columns: ["automation_id"]
            isOneToOne: false
            referencedRelation: "automations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_runs_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_runs_tenant_id_fkey"
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
          cancel_token: string | null
          cancellation_reason: string | null
          created_at: string
          currency: string
          customer_email: string | null
          customer_id: string | null
          customer_name: string | null
          customer_phone: string | null
          ends_at: string
          id: string
          intake_responses: Json | null
          meeting_url: string | null
          no_show_reason: string | null
          notes: string | null
          portal_token: string | null
          ref_code: string
          reschedule_token: string | null
          service_id: string | null
          source: string | null
          staff_id: string | null
          starts_at: string
          status: string
          tenant_id: string
          timezone: string | null
          updated_at: string
        }
        Insert: {
          amount_cents: number
          cancel_token?: string | null
          cancellation_reason?: string | null
          created_at?: string
          currency: string
          customer_email?: string | null
          customer_id?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          ends_at: string
          id?: string
          intake_responses?: Json | null
          meeting_url?: string | null
          no_show_reason?: string | null
          notes?: string | null
          portal_token?: string | null
          ref_code: string
          reschedule_token?: string | null
          service_id?: string | null
          source?: string | null
          staff_id?: string | null
          starts_at: string
          status?: string
          tenant_id: string
          timezone?: string | null
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          cancel_token?: string | null
          cancellation_reason?: string | null
          created_at?: string
          currency?: string
          customer_email?: string | null
          customer_id?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          ends_at?: string
          id?: string
          intake_responses?: Json | null
          meeting_url?: string | null
          no_show_reason?: string | null
          notes?: string | null
          portal_token?: string | null
          ref_code?: string
          reschedule_token?: string | null
          service_id?: string | null
          source?: string | null
          staff_id?: string | null
          starts_at?: string
          status?: string
          tenant_id?: string
          timezone?: string | null
          updated_at?: string
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
      calendar_connections: {
        Row: {
          access_token: string | null
          account_email: string | null
          calendar_id: string | null
          created_at: string
          expires_at: string | null
          id: string
          provider: string
          refresh_token: string | null
          scope: string | null
          staff_id: string
          sync_enabled: boolean
          tenant_id: string
          updated_at: string
        }
        Insert: {
          access_token?: string | null
          account_email?: string | null
          calendar_id?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          provider: string
          refresh_token?: string | null
          scope?: string | null
          staff_id: string
          sync_enabled?: boolean
          tenant_id: string
          updated_at?: string
        }
        Update: {
          access_token?: string | null
          account_email?: string | null
          calendar_id?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          provider?: string
          refresh_token?: string | null
          scope?: string | null
          staff_id?: string
          sync_enabled?: boolean
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_connections_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_connections_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          assigned_staff_id: string | null
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
          assigned_staff_id?: string | null
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
          assigned_staff_id?: string | null
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
            foreignKeyName: "conversations_assigned_staff_id_fkey"
            columns: ["assigned_staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
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
          last_seen_at: string | null
          notes: string | null
          status: string
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
          last_seen_at?: string | null
          notes?: string | null
          status?: string
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
          last_seen_at?: string | null
          notes?: string | null
          status?: string
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
      message_templates: {
        Row: {
          body: string
          category: string
          created_at: string
          id: string
          name: string
          status: string
          tenant_id: string
        }
        Insert: {
          body: string
          category?: string
          created_at?: string
          id?: string
          name: string
          status?: string
          tenant_id: string
        }
        Update: {
          body?: string
          category?: string
          created_at?: string
          id?: string
          name?: string
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_templates_tenant_id_fkey"
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
          delivery_status: string
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
          delivery_status?: string
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
          delivery_status?: string
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
      payouts: {
        Row: {
          amount_cents: number
          created_at: string
          currency: string
          destination: string | null
          id: string
          paid_at: string | null
          provider: string
          provider_ref: string | null
          scheduled_for: string | null
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          amount_cents: number
          created_at?: string
          currency: string
          destination?: string | null
          id?: string
          paid_at?: string | null
          provider: string
          provider_ref?: string | null
          scheduled_for?: string | null
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          currency?: string
          destination?: string | null
          id?: string
          paid_at?: string | null
          provider?: string
          provider_ref?: string | null
          scheduled_for?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payouts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      refunds: {
        Row: {
          amount_cents: number
          booking_id: string | null
          created_at: string
          currency: string
          id: string
          payment_id: string | null
          processed_at: string | null
          processed_by: string | null
          provider: string | null
          provider_ref: string | null
          reason: string | null
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          amount_cents: number
          booking_id?: string | null
          created_at?: string
          currency: string
          id?: string
          payment_id?: string | null
          processed_at?: string | null
          processed_by?: string | null
          provider?: string | null
          provider_ref?: string | null
          reason?: string | null
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          booking_id?: string | null
          created_at?: string
          currency?: string
          id?: string
          payment_id?: string | null
          processed_at?: string | null
          processed_by?: string | null
          provider?: string | null
          provider_ref?: string | null
          reason?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "refunds_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "refunds_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "refunds_processed_by_fkey"
            columns: ["processed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "refunds_tenant_id_fkey"
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
          active: boolean
          availability: Json
          bio: string | null
          buffer_minutes: number | null
          created_at: string
          email: string | null
          ics_token: string | null
          id: string
          name: string
          photo_url: string | null
          role: string
          tenant_id: string
          updated_at: string
          wa_number: string | null
        }
        Insert: {
          active?: boolean
          availability?: Json
          bio?: string | null
          buffer_minutes?: number | null
          created_at?: string
          email?: string | null
          ics_token?: string | null
          id?: string
          name: string
          photo_url?: string | null
          role?: string
          tenant_id: string
          updated_at?: string
          wa_number?: string | null
        }
        Update: {
          active?: boolean
          availability?: Json
          bio?: string | null
          buffer_minutes?: number | null
          created_at?: string
          email?: string | null
          ics_token?: string | null
          id?: string
          name?: string
          photo_url?: string | null
          role?: string
          tenant_id?: string
          updated_at?: string
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
      staff_schedules: {
        Row: {
          breaks: Json
          buffer_after_minutes: number
          buffer_before_minutes: number
          created_at: string
          id: string
          max_daily_appointments: number | null
          staff_id: string
          tenant_id: string
          time_off: Json
          updated_at: string
          weekly: Json
        }
        Insert: {
          breaks?: Json
          buffer_after_minutes?: number
          buffer_before_minutes?: number
          created_at?: string
          id?: string
          max_daily_appointments?: number | null
          staff_id: string
          tenant_id: string
          time_off?: Json
          updated_at?: string
          weekly?: Json
        }
        Update: {
          breaks?: Json
          buffer_after_minutes?: number
          buffer_before_minutes?: number
          created_at?: string
          id?: string
          max_daily_appointments?: number | null
          staff_id?: string
          tenant_id?: string
          time_off?: Json
          updated_at?: string
          weekly?: Json
        }
        Relationships: [
          {
            foreignKeyName: "staff_schedules_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: true
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_schedules_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_services: {
        Row: {
          created_at: string
          service_id: string
          staff_id: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          service_id: string
          staff_id: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          service_id?: string
          staff_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_services_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_services_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_services_tenant_id_fkey"
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
          brand_color: string | null
          buffer_minutes: number | null
          business_hours: Json
          country: string
          country_code: string
          created_at: string
          default_currency: string
          email: string | null
          id: string
          industry: string | null
          intake_form: Json | null
          is_admin_workspace: boolean
          is_demo: boolean
          logo_url: string | null
          name: string
          payment_providers: Json
          plan_tier: string
          slug: string
          subscription_status: string
          timezone: string | null
          wa_number_id: string | null
          wa_phone_number: string | null
          whatsapp_number: string | null
        }
        Insert: {
          brand_color?: string | null
          buffer_minutes?: number | null
          business_hours?: Json
          country: string
          country_code: string
          created_at?: string
          default_currency?: string
          email?: string | null
          id?: string
          industry?: string | null
          intake_form?: Json | null
          is_admin_workspace?: boolean
          is_demo?: boolean
          logo_url?: string | null
          name: string
          payment_providers?: Json
          plan_tier?: string
          slug: string
          subscription_status?: string
          timezone?: string | null
          wa_number_id?: string | null
          wa_phone_number?: string | null
          whatsapp_number?: string | null
        }
        Update: {
          brand_color?: string | null
          buffer_minutes?: number | null
          business_hours?: Json
          country?: string
          country_code?: string
          created_at?: string
          default_currency?: string
          email?: string | null
          id?: string
          industry?: string | null
          intake_form?: Json | null
          is_admin_workspace?: boolean
          is_demo?: boolean
          logo_url?: string | null
          name?: string
          payment_providers?: Json
          plan_tier?: string
          slug?: string
          subscription_status?: string
          timezone?: string | null
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
      waiting_list: {
        Row: {
          claim_token: string | null
          created_at: string
          customer_email: string | null
          customer_name: string
          customer_phone: string | null
          desired_from: string | null
          desired_to: string | null
          expires_at: string | null
          id: string
          notes: string | null
          notified_at: string | null
          offered_starts_at: string | null
          service_id: string | null
          staff_id: string | null
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          claim_token?: string | null
          created_at?: string
          customer_email?: string | null
          customer_name: string
          customer_phone?: string | null
          desired_from?: string | null
          desired_to?: string | null
          expires_at?: string | null
          id?: string
          notes?: string | null
          notified_at?: string | null
          offered_starts_at?: string | null
          service_id?: string | null
          staff_id?: string | null
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          claim_token?: string | null
          created_at?: string
          customer_email?: string | null
          customer_name?: string
          customer_phone?: string | null
          desired_from?: string | null
          desired_to?: string | null
          expires_at?: string | null
          id?: string
          notes?: string | null
          notified_at?: string | null
          offered_starts_at?: string | null
          service_id?: string | null
          staff_id?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "waiting_list_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waiting_list_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waiting_list_tenant_id_fkey"
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
      admin_platform_metrics: { Args: never; Returns: Json }
      current_tenant_id: { Args: never; Returns: string }
      current_user_role: {
        Args: never
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_admin_access: { Args: never; Returns: boolean }
      public_cancel_booking: {
        Args: { _reason: string; _token: string }
        Returns: Json
      }
      public_claim_waitlist_slot: { Args: { _token: string }; Returns: Json }
      public_create_booking: {
        Args: {
          _customer_email: string
          _customer_name: string
          _customer_phone: string
          _intake: Json
          _service_id: string
          _staff_id: string
          _starts_at: string
          _tenant_id: string
          _timezone: string
        }
        Returns: Json
      }
      public_get_availability: {
        Args: {
          _day: string
          _service_id: string
          _staff_id: string
          _tenant_id: string
        }
        Returns: Json
      }
      public_get_booking_by_token: {
        Args: { _kind: string; _token: string }
        Returns: Json
      }
      public_get_booking_page: { Args: { _slug: string }; Returns: Json }
      public_get_customer_portal: { Args: { _token: string }; Returns: Json }
      public_get_staff_ics: { Args: { _token: string }; Returns: Json }
      public_get_waitlist_offer: { Args: { _token: string }; Returns: Json }
      public_join_waitlist: {
        Args: {
          _customer_email: string
          _customer_name: string
          _customer_phone: string
          _desired_from: string
          _desired_to: string
          _notes: string
          _service_id: string
          _staff_id: string
          _tenant_id: string
        }
        Returns: Json
      }
      public_reschedule_booking: {
        Args: { _new_starts_at: string; _token: string }
        Returns: Json
      }
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
