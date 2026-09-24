// Generated from the Supabase schema. Do not edit by hand.
// Refresh with: npm run db:types

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
      appointment_status_history: {
        Row: {
          appointment_id: string
          changed_by: string | null
          created_at: string
          from_status: Database["public"]["Enums"]["appointment_status"] | null
          id: string
          reason: string | null
          to_status: Database["public"]["Enums"]["appointment_status"]
        }
        Insert: {
          appointment_id: string
          changed_by?: string | null
          created_at?: string
          from_status?: Database["public"]["Enums"]["appointment_status"] | null
          id?: string
          reason?: string | null
          to_status: Database["public"]["Enums"]["appointment_status"]
        }
        Update: {
          appointment_id?: string
          changed_by?: string | null
          created_at?: string
          from_status?: Database["public"]["Enums"]["appointment_status"] | null
          id?: string
          reason?: string | null
          to_status?: Database["public"]["Enums"]["appointment_status"]
        }
        Relationships: [
          {
            foreignKeyName: "appointment_status_history_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_status_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      appointments: {
        Row: {
          business_id: string
          cancellation_reason: string | null
          cancelled_at: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          currency: string
          customer_email: string | null
          customer_name: string | null
          customer_notes: string | null
          customer_phone: string | null
          customer_profile_id: string | null
          deposit_cents: number
          deposit_status: Database["public"]["Enums"]["deposit_status"]
          ends_at: string
          growth_link_id: string | null
          id: string
          internal_notes: string | null
          is_demo: boolean
          location_id: string | null
          payment_due_at: string | null
          price_cents: number
          service_id: string | null
          service_name_snapshot: Json | null
          source: Database["public"]["Enums"]["appointment_source"]
          staff_profile_id: string | null
          starts_at: string
          status: Database["public"]["Enums"]["appointment_status"]
          updated_at: string
        }
        Insert: {
          business_id: string
          cancellation_reason?: string | null
          cancelled_at?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          customer_email?: string | null
          customer_name?: string | null
          customer_notes?: string | null
          customer_phone?: string | null
          customer_profile_id?: string | null
          deposit_cents?: number
          deposit_status?: Database["public"]["Enums"]["deposit_status"]
          ends_at: string
          growth_link_id?: string | null
          id?: string
          internal_notes?: string | null
          is_demo?: boolean
          location_id?: string | null
          payment_due_at?: string | null
          price_cents?: number
          service_id?: string | null
          service_name_snapshot?: Json | null
          source?: Database["public"]["Enums"]["appointment_source"]
          staff_profile_id?: string | null
          starts_at: string
          status?: Database["public"]["Enums"]["appointment_status"]
          updated_at?: string
        }
        Update: {
          business_id?: string
          cancellation_reason?: string | null
          cancelled_at?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          customer_email?: string | null
          customer_name?: string | null
          customer_notes?: string | null
          customer_phone?: string | null
          customer_profile_id?: string | null
          deposit_cents?: number
          deposit_status?: Database["public"]["Enums"]["deposit_status"]
          ends_at?: string
          growth_link_id?: string | null
          id?: string
          internal_notes?: string | null
          is_demo?: boolean
          location_id?: string | null
          payment_due_at?: string | null
          price_cents?: number
          service_id?: string | null
          service_name_snapshot?: Json | null
          source?: Database["public"]["Enums"]["appointment_source"]
          staff_profile_id?: string | null
          starts_at?: string
          status?: Database["public"]["Enums"]["appointment_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_customer_profile_id_fkey"
            columns: ["customer_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_growth_link_id_fkey"
            columns: ["growth_link_id"]
            isOneToOne: false
            referencedRelation: "growth_links"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_staff_profile_id_fkey"
            columns: ["staff_profile_id"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_profile_id: string | null
          business_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: number
          metadata: Json
        }
        Insert: {
          action: string
          actor_profile_id?: string | null
          business_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: never
          metadata?: Json
        }
        Update: {
          action?: string
          actor_profile_id?: string | null
          business_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: never
          metadata?: Json
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_profile_id_fkey"
            columns: ["actor_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      business_clients: {
        Row: {
          business_id: string
          consent_marketing: boolean
          consent_updated_at: string | null
          created_at: string
          email: string | null
          first_visit_at: string | null
          full_name: string | null
          id: string
          is_demo: boolean
          last_visit_at: string | null
          notes: string | null
          phone: string | null
          profile_id: string | null
          tags: string[]
          total_spend_cents: number
          total_visits: number
          unsubscribe_token: string
          updated_at: string
        }
        Insert: {
          business_id: string
          consent_marketing?: boolean
          consent_updated_at?: string | null
          created_at?: string
          email?: string | null
          first_visit_at?: string | null
          full_name?: string | null
          id?: string
          is_demo?: boolean
          last_visit_at?: string | null
          notes?: string | null
          phone?: string | null
          profile_id?: string | null
          tags?: string[]
          total_spend_cents?: number
          total_visits?: number
          unsubscribe_token?: string
          updated_at?: string
        }
        Update: {
          business_id?: string
          consent_marketing?: boolean
          consent_updated_at?: string | null
          created_at?: string
          email?: string | null
          first_visit_at?: string | null
          full_name?: string | null
          id?: string
          is_demo?: boolean
          last_visit_at?: string | null
          notes?: string | null
          phone?: string | null
          profile_id?: string | null
          tags?: string[]
          total_spend_cents?: number
          total_visits?: number
          unsubscribe_token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_clients_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_clients_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      business_closures: {
        Row: {
          business_id: string
          created_at: string
          created_by: string | null
          ends_at: string
          id: string
          location_id: string | null
          reason: string | null
          starts_at: string
        }
        Insert: {
          business_id: string
          created_at?: string
          created_by?: string | null
          ends_at: string
          id?: string
          location_id?: string | null
          reason?: string | null
          starts_at: string
        }
        Update: {
          business_id?: string
          created_at?: string
          created_by?: string | null
          ends_at?: string
          id?: string
          location_id?: string | null
          reason?: string | null
          starts_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_closures_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_closures_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_closures_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      business_subscriptions: {
        Row: {
          billing_interval: string
          business_id: string
          cancel_at_period_end: boolean
          created_at: string
          current_period_end: string | null
          last_event_at: string
          plan: string
          status: string
          stripe_customer_id: string
          stripe_subscription_id: string
          updated_at: string
        }
        Insert: {
          billing_interval: string
          business_id: string
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          last_event_at: string
          plan: string
          status: string
          stripe_customer_id: string
          stripe_subscription_id: string
          updated_at?: string
        }
        Update: {
          billing_interval?: string
          business_id?: string
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          last_event_at?: string
          plan?: string
          status?: string
          stripe_customer_id?: string
          stripe_subscription_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_subscriptions_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: true
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      business_hours: {
        Row: {
          closes_at: string
          created_at: string
          day_of_week: number
          id: string
          location_id: string
          opens_at: string
        }
        Insert: {
          closes_at: string
          created_at?: string
          day_of_week: number
          id?: string
          location_id: string
          opens_at: string
        }
        Update: {
          closes_at?: string
          created_at?: string
          day_of_week?: number
          id?: string
          location_id?: string
          opens_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_hours_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      business_members: {
        Row: {
          business_id: string
          created_at: string
          id: string
          invited_email: string | null
          profile_id: string | null
          role: Database["public"]["Enums"]["business_role"]
          status: Database["public"]["Enums"]["member_status"]
          updated_at: string
        }
        Insert: {
          business_id: string
          created_at?: string
          id?: string
          invited_email?: string | null
          profile_id?: string | null
          role?: Database["public"]["Enums"]["business_role"]
          status?: Database["public"]["Enums"]["member_status"]
          updated_at?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          id?: string
          invited_email?: string | null
          profile_id?: string | null
          role?: Database["public"]["Enums"]["business_role"]
          status?: Database["public"]["Enums"]["member_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_members_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_members_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      business_payment_accounts: {
        Row: {
          account_id: string
          business_id: string
          charges_enabled: boolean
          created_at: string
          details_submitted: boolean
          payouts_enabled: boolean
          provider: string
          updated_at: string
        }
        Insert: {
          account_id: string
          business_id: string
          charges_enabled?: boolean
          created_at?: string
          details_submitted?: boolean
          payouts_enabled?: boolean
          provider?: string
          updated_at?: string
        }
        Update: {
          account_id?: string
          business_id?: string
          charges_enabled?: boolean
          created_at?: string
          details_submitted?: boolean
          payouts_enabled?: boolean
          provider?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_payment_accounts_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: true
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      businesses: {
        Row: {
          booking_policy: Json
          category: Database["public"]["Enums"]["business_category"]
          cover_image_url: string | null
          created_at: string
          created_by: string | null
          currency: string
          default_locale: string
          deposits_enabled: boolean
          description: Json | null
          email: string | null
          gallery: Json
          google_review_url: string | null
          id: string
          is_demo: boolean
          legal_name: string | null
          logo_url: string | null
          name: string
          phone: string | null
          search_vector: unknown
          short_pitch: Json | null
          slug: string
          status: Database["public"]["Enums"]["business_status"]
          timezone: string
          updated_at: string
          website: string | null
        }
        Insert: {
          booking_policy?: Json
          category?: Database["public"]["Enums"]["business_category"]
          cover_image_url?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          default_locale?: string
          deposits_enabled?: boolean
          description?: Json | null
          email?: string | null
          gallery?: Json
          google_review_url?: string | null
          id?: string
          is_demo?: boolean
          legal_name?: string | null
          logo_url?: string | null
          name: string
          phone?: string | null
          search_vector?: unknown
          short_pitch?: Json | null
          slug: string
          status?: Database["public"]["Enums"]["business_status"]
          timezone?: string
          updated_at?: string
          website?: string | null
        }
        Update: {
          booking_policy?: Json
          category?: Database["public"]["Enums"]["business_category"]
          cover_image_url?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          default_locale?: string
          deposits_enabled?: boolean
          description?: Json | null
          email?: string | null
          gallery?: Json
          google_review_url?: string | null
          id?: string
          is_demo?: boolean
          legal_name?: string | null
          logo_url?: string | null
          name?: string
          phone?: string | null
          search_vector?: unknown
          short_pitch?: Json | null
          slug?: string
          status?: Database["public"]["Enums"]["business_status"]
          timezone?: string
          updated_at?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "businesses_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_event_links: {
        Row: {
          appointment_id: string
          connection_id: string
          created_at: string
          external_event_id: string
          id: string
          last_synced_at: string | null
        }
        Insert: {
          appointment_id: string
          connection_id: string
          created_at?: string
          external_event_id: string
          id?: string
          last_synced_at?: string | null
        }
        Update: {
          appointment_id?: string
          connection_id?: string
          created_at?: string
          external_event_id?: string
          id?: string
          last_synced_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "calendar_event_links_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_event_links_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "external_calendar_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_preferences: {
        Row: {
          accessibility_notes: string | null
          created_at: string
          notes: string | null
          preferred_channel: Database["public"]["Enums"]["notification_channel"]
          preferred_locale: string | null
          profile_id: string
          reminder_lead_minutes: number
          updated_at: string
        }
        Insert: {
          accessibility_notes?: string | null
          created_at?: string
          notes?: string | null
          preferred_channel?: Database["public"]["Enums"]["notification_channel"]
          preferred_locale?: string | null
          profile_id: string
          reminder_lead_minutes?: number
          updated_at?: string
        }
        Update: {
          accessibility_notes?: string | null
          created_at?: string
          notes?: string | null
          preferred_channel?: Database["public"]["Enums"]["notification_channel"]
          preferred_locale?: string | null
          profile_id?: string
          reminder_lead_minutes?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_preferences_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      external_calendar_connections: {
        Row: {
          account_email: string | null
          business_id: string | null
          calendar_id: string | null
          created_at: string
          id: string
          last_synced_at: string | null
          profile_id: string | null
          provider: Database["public"]["Enums"]["calendar_provider"]
          scopes: string[]
          status: Database["public"]["Enums"]["connection_status"]
          sync_error: string | null
          updated_at: string
        }
        Insert: {
          account_email?: string | null
          business_id?: string | null
          calendar_id?: string | null
          created_at?: string
          id?: string
          last_synced_at?: string | null
          profile_id?: string | null
          provider?: Database["public"]["Enums"]["calendar_provider"]
          scopes?: string[]
          status?: Database["public"]["Enums"]["connection_status"]
          sync_error?: string | null
          updated_at?: string
        }
        Update: {
          account_email?: string | null
          business_id?: string | null
          calendar_id?: string | null
          created_at?: string
          id?: string
          last_synced_at?: string | null
          profile_id?: string | null
          provider?: Database["public"]["Enums"]["calendar_provider"]
          scopes?: string[]
          status?: Database["public"]["Enums"]["connection_status"]
          sync_error?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "external_calendar_connections_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_calendar_connections_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      growth_links: {
        Row: {
          booking_count: number
          business_id: string
          code: string
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          kind: string
          label: string
          referrer_client_id: string | null
          referrer_profile_id: string | null
          service_id: string | null
          target: string
          updated_at: string
          visit_count: number
        }
        Insert: {
          booking_count?: number
          business_id: string
          code: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          kind?: string
          label: string
          referrer_client_id?: string | null
          referrer_profile_id?: string | null
          service_id?: string | null
          target?: string
          updated_at?: string
          visit_count?: number
        }
        Update: {
          booking_count?: number
          business_id?: string
          code?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          kind?: string
          label?: string
          referrer_client_id?: string | null
          referrer_profile_id?: string | null
          service_id?: string | null
          target?: string
          updated_at?: string
          visit_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "growth_links_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "growth_links_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "growth_links_referrer_client_id_fkey"
            columns: ["referrer_client_id"]
            isOneToOne: false
            referencedRelation: "business_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "growth_links_referrer_profile_id_fkey"
            columns: ["referrer_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "growth_links_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      locations: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          business_id: string
          city: string | null
          country_code: string
          created_at: string
          id: string
          is_active: boolean
          is_primary: boolean
          latitude: number | null
          longitude: number | null
          name: string
          phone: string | null
          postal_code: string | null
          region: string | null
          timezone: string
          updated_at: string
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          business_id: string
          city?: string | null
          country_code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_primary?: boolean
          latitude?: number | null
          longitude?: number | null
          name: string
          phone?: string | null
          postal_code?: string | null
          region?: string | null
          timezone?: string
          updated_at?: string
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          business_id?: string
          city?: string | null
          country_code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_primary?: boolean
          latitude?: number | null
          longitude?: number | null
          name?: string
          phone?: string | null
          postal_code?: string | null
          region?: string | null
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "locations_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_campaigns: {
        Row: {
          audience: Json
          business_id: string
          channel: Database["public"]["Enums"]["notification_channel"]
          created_at: string
          created_by: string | null
          id: string
          is_demo: boolean
          name: string
          scheduled_at: string | null
          sent_at: string | null
          stats: Json
          status: Database["public"]["Enums"]["campaign_status"]
          template: Json
          type: Database["public"]["Enums"]["campaign_type"]
          updated_at: string
        }
        Insert: {
          audience?: Json
          business_id: string
          channel?: Database["public"]["Enums"]["notification_channel"]
          created_at?: string
          created_by?: string | null
          id?: string
          is_demo?: boolean
          name: string
          scheduled_at?: string | null
          sent_at?: string | null
          stats?: Json
          status?: Database["public"]["Enums"]["campaign_status"]
          template?: Json
          type?: Database["public"]["Enums"]["campaign_type"]
          updated_at?: string
        }
        Update: {
          audience?: Json
          business_id?: string
          channel?: Database["public"]["Enums"]["notification_channel"]
          created_at?: string
          created_by?: string | null
          id?: string
          is_demo?: boolean
          name?: string
          scheduled_at?: string | null
          sent_at?: string | null
          stats?: Json
          status?: Database["public"]["Enums"]["campaign_status"]
          template?: Json
          type?: Database["public"]["Enums"]["campaign_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketing_campaigns_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketing_campaigns_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_deliveries: {
        Row: {
          appointment_id: string | null
          attempts: number
          business_client_id: string | null
          business_id: string
          campaign_id: string | null
          channel: Database["public"]["Enums"]["notification_channel"]
          created_at: string
          error: string | null
          event_type: Database["public"]["Enums"]["notification_event"]
          id: string
          idempotency_key: string
          last_attempt_at: string | null
          locale: string
          profile_id: string | null
          provider: string | null
          provider_message_id: string | null
          scheduled_for: string
          sent_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          appointment_id?: string | null
          attempts?: number
          business_client_id?: string | null
          business_id: string
          campaign_id?: string | null
          channel?: Database["public"]["Enums"]["notification_channel"]
          created_at?: string
          error?: string | null
          event_type: Database["public"]["Enums"]["notification_event"]
          id?: string
          idempotency_key: string
          last_attempt_at?: string | null
          locale?: string
          profile_id?: string | null
          provider?: string | null
          provider_message_id?: string | null
          scheduled_for?: string
          sent_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          appointment_id?: string | null
          attempts?: number
          business_client_id?: string | null
          business_id?: string
          campaign_id?: string | null
          channel?: Database["public"]["Enums"]["notification_channel"]
          created_at?: string
          error?: string | null
          event_type?: Database["public"]["Enums"]["notification_event"]
          id?: string
          idempotency_key?: string
          last_attempt_at?: string | null
          locale?: string
          profile_id?: string | null
          provider?: string | null
          provider_message_id?: string | null
          scheduled_for?: string
          sent_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_deliveries_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_deliveries_business_client_id_fkey"
            columns: ["business_client_id"]
            isOneToOne: false
            referencedRelation: "business_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_deliveries_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_deliveries_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "marketing_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_deliveries_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          business_id: string | null
          channel: Database["public"]["Enums"]["notification_channel"]
          created_at: string
          enabled: boolean
          event_type: Database["public"]["Enums"]["notification_event"]
          id: string
          profile_id: string
          updated_at: string
        }
        Insert: {
          business_id?: string | null
          channel: Database["public"]["Enums"]["notification_channel"]
          created_at?: string
          enabled?: boolean
          event_type: Database["public"]["Enums"]["notification_event"]
          id?: string
          profile_id: string
          updated_at?: string
        }
        Update: {
          business_id?: string | null
          channel?: Database["public"]["Enums"]["notification_channel"]
          created_at?: string
          enabled?: boolean
          event_type?: Database["public"]["Enums"]["notification_event"]
          id?: string
          profile_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_preferences_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_preferences_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_records: {
        Row: {
          amount_cents: number
          appointment_id: string | null
          business_id: string
          created_at: string
          currency: string
          failure_reason: string | null
          id: string
          is_demo: boolean
          kind: Database["public"]["Enums"]["payment_kind"]
          profile_id: string | null
          provider: string | null
          provider_payment_reference: string | null
          provider_reference: string | null
          related_payment_id: string | null
          status: Database["public"]["Enums"]["payment_status"]
          updated_at: string
        }
        Insert: {
          amount_cents: number
          appointment_id?: string | null
          business_id: string
          created_at?: string
          currency?: string
          failure_reason?: string | null
          id?: string
          is_demo?: boolean
          kind?: Database["public"]["Enums"]["payment_kind"]
          profile_id?: string | null
          provider?: string | null
          provider_payment_reference?: string | null
          provider_reference?: string | null
          related_payment_id?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          appointment_id?: string | null
          business_id?: string
          created_at?: string
          currency?: string
          failure_reason?: string | null
          id?: string
          is_demo?: boolean
          kind?: Database["public"]["Enums"]["payment_kind"]
          profile_id?: string | null
          provider?: string | null
          provider_payment_reference?: string | null
          provider_reference?: string | null
          related_payment_id?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_records_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_records_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_records_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_records_related_payment_id_fkey"
            columns: ["related_payment_id"]
            isOneToOne: false
            referencedRelation: "payment_records"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          is_demo: boolean
          locale: string
          marketing_opt_in: boolean
          phone: string | null
          timezone: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          is_demo?: boolean
          locale?: string
          marketing_opt_in?: boolean
          phone?: string | null
          timezone?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          is_demo?: boolean
          locale?: string
          marketing_opt_in?: boolean
          phone?: string | null
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          failure_count: number
          id: string
          last_used_at: string | null
          p256dh: string
          profile_id: string
          updated_at: string
          user_agent: string | null
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          failure_count?: number
          id?: string
          last_used_at?: string | null
          p256dh: string
          profile_id: string
          updated_at?: string
          user_agent?: string | null
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          failure_count?: number
          id?: string
          last_used_at?: string | null
          p256dh?: string
          profile_id?: string
          updated_at?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      review_invitations: {
        Row: {
          appointment_id: string
          business_id: string
          channel: Database["public"]["Enums"]["notification_channel"]
          created_at: string
          destination: string
          id: string
          responded_at: string | null
          sent_at: string | null
        }
        Insert: {
          appointment_id: string
          business_id: string
          channel?: Database["public"]["Enums"]["notification_channel"]
          created_at?: string
          destination?: string
          id?: string
          responded_at?: string | null
          sent_at?: string | null
        }
        Update: {
          appointment_id?: string
          business_id?: string
          channel?: Database["public"]["Enums"]["notification_channel"]
          created_at?: string
          destination?: string
          id?: string
          responded_at?: string | null
          sent_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "review_invitations_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_invitations_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          appointment_id: string | null
          author_profile_id: string | null
          business_id: string
          business_response: string | null
          comment: string | null
          created_at: string
          id: string
          is_demo: boolean
          rating: number
          responded_at: string | null
          staff_profile_id: string | null
          status: Database["public"]["Enums"]["review_status"]
          updated_at: string
        }
        Insert: {
          appointment_id?: string | null
          author_profile_id?: string | null
          business_id: string
          business_response?: string | null
          comment?: string | null
          created_at?: string
          id?: string
          is_demo?: boolean
          rating: number
          responded_at?: string | null
          staff_profile_id?: string | null
          status?: Database["public"]["Enums"]["review_status"]
          updated_at?: string
        }
        Update: {
          appointment_id?: string | null
          author_profile_id?: string | null
          business_id?: string
          business_response?: string | null
          comment?: string | null
          created_at?: string
          id?: string
          is_demo?: boolean
          rating?: number
          responded_at?: string | null
          staff_profile_id?: string | null
          status?: Database["public"]["Enums"]["review_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: true
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_author_profile_id_fkey"
            columns: ["author_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_staff_profile_id_fkey"
            columns: ["staff_profile_id"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_businesses: {
        Row: {
          business_id: string
          created_at: string
          profile_id: string
        }
        Insert: {
          business_id: string
          created_at?: string
          profile_id: string
        }
        Update: {
          business_id?: string
          created_at?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_businesses_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_businesses_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      service_staff: {
        Row: {
          service_id: string
          staff_profile_id: string
        }
        Insert: {
          service_id: string
          staff_profile_id: string
        }
        Update: {
          service_id?: string
          staff_profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_staff_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_staff_staff_profile_id_fkey"
            columns: ["staff_profile_id"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          buffer_after_minutes: number
          buffer_before_minutes: number
          business_id: string
          category: Database["public"]["Enums"]["service_category"]
          created_at: string
          currency: string
          deposit_cents: number
          description: Json | null
          duration_minutes: number
          id: string
          is_active: boolean
          name: Json
          price_cents: number
          requires_deposit: boolean
          sort_order: number
          updated_at: string
        }
        Insert: {
          buffer_after_minutes?: number
          buffer_before_minutes?: number
          business_id: string
          category?: Database["public"]["Enums"]["service_category"]
          created_at?: string
          currency?: string
          deposit_cents?: number
          description?: Json | null
          duration_minutes: number
          id?: string
          is_active?: boolean
          name: Json
          price_cents?: number
          requires_deposit?: boolean
          sort_order?: number
          updated_at?: string
        }
        Update: {
          buffer_after_minutes?: number
          buffer_before_minutes?: number
          business_id?: string
          category?: Database["public"]["Enums"]["service_category"]
          created_at?: string
          currency?: string
          deposit_cents?: number
          description?: Json | null
          duration_minutes?: number
          id?: string
          is_active?: boolean
          name?: Json
          price_cents?: number
          requires_deposit?: boolean
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "services_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_profiles: {
        Row: {
          avatar_url: string | null
          bio: Json | null
          business_id: string
          color: string
          created_at: string
          display_name: string
          id: string
          is_bookable: boolean
          member_id: string | null
          sort_order: number
          title: Json | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: Json | null
          business_id: string
          color?: string
          created_at?: string
          display_name: string
          id?: string
          is_bookable?: boolean
          member_id?: string | null
          sort_order?: number
          title?: Json | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          bio?: Json | null
          business_id?: string
          color?: string
          created_at?: string
          display_name?: string
          id?: string
          is_bookable?: boolean
          member_id?: string | null
          sort_order?: number
          title?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_profiles_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_profiles_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: true
            referencedRelation: "business_members"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_time_off: {
        Row: {
          created_at: string
          ends_at: string
          id: string
          reason: string | null
          staff_profile_id: string
          starts_at: string
        }
        Insert: {
          created_at?: string
          ends_at: string
          id?: string
          reason?: string | null
          staff_profile_id: string
          starts_at: string
        }
        Update: {
          created_at?: string
          ends_at?: string
          id?: string
          reason?: string | null
          staff_profile_id?: string
          starts_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_time_off_staff_profile_id_fkey"
            columns: ["staff_profile_id"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_working_hours: {
        Row: {
          created_at: string
          day_of_week: number
          ends_at: string
          id: string
          location_id: string | null
          staff_profile_id: string
          starts_at: string
        }
        Insert: {
          created_at?: string
          day_of_week: number
          ends_at: string
          id?: string
          location_id?: string | null
          staff_profile_id: string
          starts_at: string
        }
        Update: {
          created_at?: string
          day_of_week?: number
          ends_at?: string
          id?: string
          location_id?: string | null
          staff_profile_id?: string
          starts_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_working_hours_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_working_hours_staff_profile_id_fkey"
            columns: ["staff_profile_id"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      waitlist_entries: {
        Row: {
          business_id: string
          created_at: string
          earliest_minutes: number | null
          from_date: string
          id: string
          latest_minutes: number | null
          note: string | null
          offer_count: number
          offered_at: string | null
          profile_id: string
          service_id: string | null
          staff_profile_id: string | null
          status: string
          to_date: string
          updated_at: string
        }
        Insert: {
          business_id: string
          created_at?: string
          earliest_minutes?: number | null
          from_date: string
          id?: string
          latest_minutes?: number | null
          note?: string | null
          offer_count?: number
          offered_at?: string | null
          profile_id: string
          service_id?: string | null
          staff_profile_id?: string | null
          status?: string
          to_date: string
          updated_at?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          earliest_minutes?: number | null
          from_date?: string
          id?: string
          latest_minutes?: number | null
          note?: string | null
          offer_count?: number
          offered_at?: string | null
          profile_id?: string
          service_id?: string | null
          staff_profile_id?: string | null
          status?: string
          to_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "waitlist_entries_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waitlist_entries_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waitlist_entries_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waitlist_entries_staff_profile_id_fkey"
            columns: ["staff_profile_id"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      business_rating_summary: {
        Row: {
          average_rating: number | null
          business_id: string | null
          review_count: number | null
        }
        Relationships: [
          {
            foreignKeyName: "reviews_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      apply_stripe_subscription: {
        Args: {
          p_business_id: string
          p_cancel_at_period_end: boolean
          p_current_period_end: string | null
          p_customer_id: string
          p_event_at: string
          p_interval: string
          p_plan: string
          p_status: string
          p_subscription_id: string
        }
        Returns: undefined
      }
      book_appointment: {
        Args: {
          p_customer_notes?: string
          p_growth_code?: string
          p_location_id?: string
          p_service_id: string
          p_staff_profile_id: string
          p_starts_at: string
        }
        Returns: {
          business_id: string
          cancellation_reason: string | null
          cancelled_at: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          currency: string
          customer_email: string | null
          customer_name: string | null
          customer_notes: string | null
          customer_phone: string | null
          customer_profile_id: string | null
          deposit_cents: number
          deposit_status: Database["public"]["Enums"]["deposit_status"]
          ends_at: string
          growth_link_id: string | null
          id: string
          internal_notes: string | null
          is_demo: boolean
          location_id: string | null
          payment_due_at: string | null
          price_cents: number
          service_id: string | null
          service_name_snapshot: Json | null
          source: Database["public"]["Enums"]["appointment_source"]
          staff_profile_id: string | null
          starts_at: string
          status: Database["public"]["Enums"]["appointment_status"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "appointments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      cancel_appointment: {
        Args: { p_appointment_id: string; p_reason?: string }
        Returns: {
          business_id: string
          cancellation_reason: string | null
          cancelled_at: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          currency: string
          customer_email: string | null
          customer_name: string | null
          customer_notes: string | null
          customer_phone: string | null
          customer_profile_id: string | null
          deposit_cents: number
          deposit_status: Database["public"]["Enums"]["deposit_status"]
          ends_at: string
          growth_link_id: string | null
          id: string
          internal_notes: string | null
          is_demo: boolean
          location_id: string | null
          payment_due_at: string | null
          price_cents: number
          service_id: string | null
          service_name_snapshot: Json | null
          source: Database["public"]["Enums"]["appointment_source"]
          staff_profile_id: string | null
          starts_at: string
          status: Database["public"]["Enums"]["appointment_status"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "appointments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      claim_notification_deliveries: {
        Args: { p_limit?: number }
        Returns: {
          appointment_id: string | null
          attempts: number
          business_client_id: string | null
          business_id: string
          campaign_id: string | null
          channel: Database["public"]["Enums"]["notification_channel"]
          created_at: string
          error: string | null
          event_type: Database["public"]["Enums"]["notification_event"]
          id: string
          idempotency_key: string
          last_attempt_at: string | null
          locale: string
          profile_id: string | null
          provider: string | null
          provider_message_id: string | null
          scheduled_for: string
          sent_at: string | null
          status: string
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "notification_deliveries"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      claim_pending_invitations: { Args: never; Returns: number }
      complete_deposit_refund: {
        Args: {
          p_error?: string
          p_provider_reference: string
          p_refund_id: string
          p_succeeded: boolean
        }
        Returns: undefined
      }
      create_business: {
        Args: {
          p_address?: string
          p_category: Database["public"]["Enums"]["business_category"]
          p_city: string
          p_currency?: string
          p_locale?: string
          p_name: string
          p_phone?: string
          p_timezone?: string
        }
        Returns: {
          booking_policy: Json
          category: Database["public"]["Enums"]["business_category"]
          cover_image_url: string | null
          created_at: string
          created_by: string | null
          currency: string
          default_locale: string
          deposits_enabled: boolean
          description: Json | null
          email: string | null
          gallery: Json
          google_review_url: string | null
          id: string
          is_demo: boolean
          legal_name: string | null
          logo_url: string | null
          name: string
          phone: string | null
          search_vector: unknown
          short_pitch: Json | null
          slug: string
          status: Database["public"]["Enums"]["business_status"]
          timezone: string
          updated_at: string
          website: string | null
        }
        SetofOptions: {
          from: "*"
          to: "businesses"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      expire_unpaid_deposits: { Args: never; Returns: number }
      finalize_campaign: { Args: { p_campaign_id: string }; Returns: undefined }
      get_available_slots: {
        Args: {
          p_from: string
          p_location_id?: string
          p_service_id: string
          p_staff_profile_id?: string
          p_to: string
        }
        Returns: {
          ends_at: string
          staff_profile_id: string
          starts_at: string
        }[]
      }
      get_business_dashboard: {
        Args: { p_business_id: string; p_from: string; p_to: string }
        Returns: {
          appointments_cancelled: number
          appointments_completed: number
          appointments_no_show: number
          appointments_total: number
          average_rating: number
          booked_minutes: number
          capacity_minutes: number
          completed_revenue_cents: number
          expected_revenue_cents: number
          new_clients: number
          returning_clients: number
          review_count: number
          unanswered_reviews: number
        }[]
      }
      link_payment_account: {
        Args: { p_account_id: string; p_business_id: string }
        Returns: undefined
      }
      pending_deposit_refunds: {
        Args: { p_limit?: number }
        Returns: {
          account_id: string
          amount_cents: number
          appointment_id: string
          currency: string
          payment_reference: string
          refund_id: string
        }[]
      }
      preview_campaign_audience: {
        Args: { p_audience?: Json; p_business_id: string; p_limit?: number }
        Returns: {
          email: string
          full_name: string
          id: string
          last_visit_at: string
          phone: string
          tags: string[]
          total_spend_cents: number
          total_visits: number
        }[]
      }
      queue_campaign: { Args: { p_campaign_id: string }; Returns: number }
      release_unpaid_deposit: {
        Args: { p_appointment_id: string; p_reason?: string }
        Returns: boolean
      }
      reschedule_appointment: {
        Args: {
          p_appointment_id: string
          p_new_staff_profile_id?: string
          p_new_starts_at: string
        }
        Returns: {
          business_id: string
          cancellation_reason: string | null
          cancelled_at: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          currency: string
          customer_email: string | null
          customer_name: string | null
          customer_notes: string | null
          customer_phone: string | null
          customer_profile_id: string | null
          deposit_cents: number
          deposit_status: Database["public"]["Enums"]["deposit_status"]
          ends_at: string
          growth_link_id: string | null
          id: string
          internal_notes: string | null
          is_demo: boolean
          location_id: string | null
          payment_due_at: string | null
          price_cents: number
          service_id: string | null
          service_name_snapshot: Json | null
          source: Database["public"]["Enums"]["appointment_source"]
          staff_profile_id: string | null
          starts_at: string
          status: Database["public"]["Enums"]["appointment_status"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "appointments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      resolve_growth_link: {
        Args: { p_code: string }
        Returns: {
          business_slug: string
          link_id: string
          service_id: string
          target: string
        }[]
      }
      search_businesses: {
        Args: {
          p_category?: Database["public"]["Enums"]["business_category"]
          p_city?: string
          p_limit?: number
          p_max_price_cents?: number
          p_near_lat?: number
          p_near_lng?: number
          p_offset?: number
          p_open_on?: string
          p_query?: string
          p_sort?: string
        }
        Returns: {
          average_rating: number
          category: Database["public"]["Enums"]["business_category"]
          city: string
          country_code: string
          cover_image_url: string
          currency: string
          distance_km: number
          id: string
          logo_url: string
          min_price_cents: number
          name: string
          review_count: number
          service_categories: Database["public"]["Enums"]["service_category"][]
          short_pitch: Json
          slug: string
        }[]
      }
      settle_deposit: {
        Args: {
          p_amount_cents: number
          p_appointment_id: string
          p_currency: string
          p_payment_reference: string
          p_session_id: string
        }
        Returns: string
      }
      sweep_waitlist: { Args: never; Returns: number }
      sync_payment_account: {
        Args: {
          p_account_id: string
          p_charges_enabled: boolean
          p_details_submitted: boolean
          p_payouts_enabled: boolean
        }
        Returns: string
      }
      unsubscribe_marketing: {
        Args: { p_token: string }
        Returns: {
          already_unsubscribed: boolean
          business_name: string
        }[]
      }
      upcoming_business_closures: {
        Args: { p_business_id: string }
        Returns: {
          ends_at: string
          location_id: string
          starts_at: string
        }[]
      }
    }
    Enums: {
      appointment_source:
        | "customer_web"
        | "business_admin"
        | "walk_in"
        | "import"
      appointment_status:
        | "pending"
        | "confirmed"
        | "completed"
        | "cancelled"
        | "no_show"
      business_category:
        | "hair_salon"
        | "barbershop"
        | "nail_studio"
        | "lash_brow"
        | "skincare"
        | "makeup"
        | "massage"
        | "spa"
        | "tattoo"
        | "other"
      business_role: "owner" | "admin" | "manager" | "staff"
      business_status: "draft" | "active" | "suspended"
      calendar_provider: "google" | "apple" | "ics"
      campaign_status: "draft" | "scheduled" | "sending" | "sent" | "cancelled"
      campaign_type:
        | "win_back"
        | "reminder"
        | "birthday"
        | "anniversary"
        | "custom"
      connection_status: "active" | "revoked" | "error"
      deposit_status:
        | "none"
        | "awaiting"
        | "paid"
        | "waived"
        | "void"
        | "refund_pending"
        | "refunded"
        | "retained"
        | "applied"
      member_status: "invited" | "active" | "disabled"
      notification_channel: "email" | "sms" | "whatsapp" | "viber" | "push"
      notification_event:
        | "booking_confirmation"
        | "reminder"
        | "cancellation"
        | "reschedule"
        | "review_request"
        | "marketing"
        | "waitlist_offer"
      payment_kind: "deposit" | "full" | "refund"
      payment_status:
        | "pending"
        | "succeeded"
        | "failed"
        | "refunded"
        | "cancelled"
      review_status: "published" | "pending" | "hidden"
      service_category:
        | "hair"
        | "barber"
        | "nails"
        | "lashes_brows"
        | "skincare"
        | "makeup"
        | "massage"
        | "spa"
        | "tattoo"
        | "other"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      appointment_source: [
        "customer_web",
        "business_admin",
        "walk_in",
        "import",
      ],
      appointment_status: [
        "pending",
        "confirmed",
        "completed",
        "cancelled",
        "no_show",
      ],
      business_category: [
        "hair_salon",
        "barbershop",
        "nail_studio",
        "lash_brow",
        "skincare",
        "makeup",
        "massage",
        "spa",
        "tattoo",
        "other",
      ],
      business_role: ["owner", "admin", "manager", "staff"],
      business_status: ["draft", "active", "suspended"],
      calendar_provider: ["google", "apple", "ics"],
      campaign_status: ["draft", "scheduled", "sending", "sent", "cancelled"],
      campaign_type: [
        "win_back",
        "reminder",
        "birthday",
        "anniversary",
        "custom",
      ],
      connection_status: ["active", "revoked", "error"],
      deposit_status: [
        "none",
        "awaiting",
        "paid",
        "waived",
        "void",
        "refund_pending",
        "refunded",
        "retained",
        "applied",
      ],
      member_status: ["invited", "active", "disabled"],
      notification_channel: ["email", "sms", "whatsapp", "viber", "push"],
      notification_event: [
        "booking_confirmation",
        "reminder",
        "cancellation",
        "reschedule",
        "review_request",
        "marketing",
        "waitlist_offer",
      ],
      payment_kind: ["deposit", "full", "refund"],
      payment_status: [
        "pending",
        "succeeded",
        "failed",
        "refunded",
        "cancelled",
      ],
      review_status: ["published", "pending", "hidden"],
      service_category: [
        "hair",
        "barber",
        "nails",
        "lashes_brows",
        "skincare",
        "makeup",
        "massage",
        "spa",
        "tattoo",
        "other",
      ],
    },
  },
} as const
