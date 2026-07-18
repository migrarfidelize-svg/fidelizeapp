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
      api_keys: {
        Row: {
          created_at: string
          created_by: string | null
          establishment_id: string
          id: string
          key_hash: string
          last_used_at: string | null
          name: string
          prefix: string
          revoked_at: string | null
          scopes: string[]
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          establishment_id: string
          id?: string
          key_hash: string
          last_used_at?: string | null
          name: string
          prefix: string
          revoked_at?: string | null
          scopes?: string[]
        }
        Update: {
          created_at?: string
          created_by?: string | null
          establishment_id?: string
          id?: string
          key_hash?: string
          last_used_at?: string | null
          name?: string
          prefix?: string
          revoked_at?: string | null
          scopes?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "api_keys_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
        ]
      }
      app_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["platform_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["platform_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["platform_role"]
          user_id?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          entity_id: string | null
          entity_type: string | null
          establishment_id: string | null
          id: string
          ip: string | null
          metadata: Json | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          establishment_id?: string | null
          id?: string
          ip?: string | null
          metadata?: Json | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          establishment_id?: string | null
          id?: string
          ip?: string | null
          metadata?: Json | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          active: boolean
          created_at: string
          establishment_id: string
          id: string
          name: string
          reward_description: string | null
          reward_title: string
          reward_validity_days: number | null
          rules: string | null
          stamp_icon: string
          stamp_validity_days: number | null
          stamps_required: number
          type: Database["public"]["Enums"]["campaign_type"]
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          establishment_id: string
          id?: string
          name: string
          reward_description?: string | null
          reward_title: string
          reward_validity_days?: number | null
          rules?: string | null
          stamp_icon?: string
          stamp_validity_days?: number | null
          stamps_required?: number
          type?: Database["public"]["Enums"]["campaign_type"]
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          establishment_id?: string
          id?: string
          name?: string
          reward_description?: string | null
          reward_title?: string
          reward_validity_days?: number | null
          rules?: string | null
          stamp_icon?: string
          stamp_validity_days?: number | null
          stamps_required?: number
          type?: Database["public"]["Enums"]["campaign_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
        ]
      }
      consents: {
        Row: {
          accepted_at: string
          customer_id: string
          establishment_id: string
          id: string
          ip: string | null
          marketing_opt_in: boolean
          terms_version: string
        }
        Insert: {
          accepted_at?: string
          customer_id: string
          establishment_id: string
          id?: string
          ip?: string | null
          marketing_opt_in?: boolean
          terms_version?: string
        }
        Update: {
          accepted_at?: string
          customer_id?: string
          establishment_id?: string
          id?: string
          ip?: string | null
          marketing_opt_in?: boolean
          terms_version?: string
        }
        Relationships: [
          {
            foreignKeyName: "consents_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consents_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
        ]
      }
      coupons: {
        Row: {
          active: boolean
          code: string
          created_at: string
          created_by: string | null
          description: string | null
          discount_amount: number | null
          discount_pct: number | null
          id: string
          max_uses: number | null
          plan_tier: Database["public"]["Enums"]["plan_tier"] | null
          uses: number
          valid_from: string | null
          valid_until: string | null
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          discount_amount?: number | null
          discount_pct?: number | null
          id?: string
          max_uses?: number | null
          plan_tier?: Database["public"]["Enums"]["plan_tier"] | null
          uses?: number
          valid_from?: string | null
          valid_until?: string | null
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          discount_amount?: number | null
          discount_pct?: number | null
          id?: string
          max_uses?: number | null
          plan_tier?: Database["public"]["Enums"]["plan_tier"] | null
          uses?: number
          valid_from?: string | null
          valid_until?: string | null
        }
        Relationships: []
      }
      customers: {
        Row: {
          access_token: string
          birthdate: string | null
          blocked: boolean
          code: string
          created_at: string
          email: string | null
          establishment_id: string
          id: string
          last_visit_at: string | null
          marketing_opt_in: boolean
          name: string
          notes: string | null
          phone: string
          updated_at: string
          visits_count: number
        }
        Insert: {
          access_token?: string
          birthdate?: string | null
          blocked?: boolean
          code?: string
          created_at?: string
          email?: string | null
          establishment_id: string
          id?: string
          last_visit_at?: string | null
          marketing_opt_in?: boolean
          name: string
          notes?: string | null
          phone: string
          updated_at?: string
          visits_count?: number
        }
        Update: {
          access_token?: string
          birthdate?: string | null
          blocked?: boolean
          code?: string
          created_at?: string
          email?: string | null
          establishment_id?: string
          id?: string
          last_visit_at?: string | null
          marketing_opt_in?: boolean
          name?: string
          notes?: string | null
          phone?: string
          updated_at?: string
          visits_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "customers_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
        ]
      }
      data_requests: {
        Row: {
          created_at: string
          customer_id: string | null
          customer_phone: string | null
          establishment_id: string
          id: string
          kind: string
          processed_at: string | null
          reason: string | null
          requested_by: string | null
          result_url: string | null
          status: string
        }
        Insert: {
          created_at?: string
          customer_id?: string | null
          customer_phone?: string | null
          establishment_id: string
          id?: string
          kind: string
          processed_at?: string | null
          reason?: string | null
          requested_by?: string | null
          result_url?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          customer_id?: string | null
          customer_phone?: string | null
          establishment_id?: string
          id?: string
          kind?: string
          processed_at?: string | null
          reason?: string | null
          requested_by?: string | null
          result_url?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "data_requests_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "data_requests_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
        ]
      }
      establishment_members: {
        Row: {
          active: boolean
          created_at: string
          display_name: string | null
          establishment_id: string
          id: string
          invited_email: string | null
          last_pin_used_at: string | null
          pin_hash: string | null
          role: Database["public"]["Enums"]["member_role"]
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          display_name?: string | null
          establishment_id: string
          id?: string
          invited_email?: string | null
          last_pin_used_at?: string | null
          pin_hash?: string | null
          role?: Database["public"]["Enums"]["member_role"]
          user_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          display_name?: string | null
          establishment_id?: string
          id?: string
          invited_email?: string | null
          last_pin_used_at?: string | null
          pin_hash?: string | null
          role?: Database["public"]["Enums"]["member_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "establishment_members_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
        ]
      }
      establishment_settings: {
        Row: {
          appearance: Json
          billing_prefs: Json
          card: Json
          created_at: string
          establishment_id: string
          notifications: Json
          privacy: Json
          security: Json
          updated_at: string
        }
        Insert: {
          appearance?: Json
          billing_prefs?: Json
          card?: Json
          created_at?: string
          establishment_id: string
          notifications?: Json
          privacy?: Json
          security?: Json
          updated_at?: string
        }
        Update: {
          appearance?: Json
          billing_prefs?: Json
          card?: Json
          created_at?: string
          establishment_id?: string
          notifications?: Json
          privacy?: Json
          security?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "establishment_settings_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: true
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
        ]
      }
      establishments: {
        Row: {
          accent_color: string
          active: boolean
          address: string | null
          archived_at: string | null
          average_ticket: number | null
          business_hours: string | null
          cep: string | null
          city: string | null
          cnpj: string | null
          cover_url: string | null
          created_at: string
          created_by: string | null
          description: string | null
          email: string | null
          facebook: string | null
          google_maps_url: string | null
          id: string
          instagram: string | null
          logo_url: string | null
          name: string
          phone: string | null
          plan: Database["public"]["Enums"]["plan_tier"]
          primary_color: string
          razao_social: string | null
          segment: string | null
          slug: string
          state: string | null
          theme: string
          tiktok: string | null
          timezone: string
          updated_at: string
          website: string | null
          whatsapp: string | null
        }
        Insert: {
          accent_color?: string
          active?: boolean
          address?: string | null
          archived_at?: string | null
          average_ticket?: number | null
          business_hours?: string | null
          cep?: string | null
          city?: string | null
          cnpj?: string | null
          cover_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          email?: string | null
          facebook?: string | null
          google_maps_url?: string | null
          id?: string
          instagram?: string | null
          logo_url?: string | null
          name: string
          phone?: string | null
          plan?: Database["public"]["Enums"]["plan_tier"]
          primary_color?: string
          razao_social?: string | null
          segment?: string | null
          slug: string
          state?: string | null
          theme?: string
          tiktok?: string | null
          timezone?: string
          updated_at?: string
          website?: string | null
          whatsapp?: string | null
        }
        Update: {
          accent_color?: string
          active?: boolean
          address?: string | null
          archived_at?: string | null
          average_ticket?: number | null
          business_hours?: string | null
          cep?: string | null
          city?: string | null
          cnpj?: string | null
          cover_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          email?: string | null
          facebook?: string | null
          google_maps_url?: string | null
          id?: string
          instagram?: string | null
          logo_url?: string | null
          name?: string
          phone?: string | null
          plan?: Database["public"]["Enums"]["plan_tier"]
          primary_color?: string
          razao_social?: string | null
          segment?: string | null
          slug?: string
          state?: string | null
          theme?: string
          tiktok?: string | null
          timezone?: string
          updated_at?: string
          website?: string | null
          whatsapp?: string | null
        }
        Relationships: []
      }
      helpdesk_members: {
        Row: {
          active: boolean
          created_at: string
          establishment_id: string
          id: string
          role: Database["public"]["Enums"]["helpdesk_role"]
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          establishment_id: string
          id?: string
          role?: Database["public"]["Enums"]["helpdesk_role"]
          user_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          establishment_id?: string
          id?: string
          role?: Database["public"]["Enums"]["helpdesk_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "helpdesk_members_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
        ]
      }
      kb_articles: {
        Row: {
          author_id: string | null
          body_html: string
          body_text: string
          category_id: string | null
          created_at: string
          establishment_id: string
          excerpt: string | null
          helpful_count: number
          id: string
          not_helpful_count: number
          published: boolean
          search_tsv: unknown
          slug: string
          tags: string[]
          title: string
          updated_at: string
          views: number
        }
        Insert: {
          author_id?: string | null
          body_html?: string
          body_text?: string
          category_id?: string | null
          created_at?: string
          establishment_id: string
          excerpt?: string | null
          helpful_count?: number
          id?: string
          not_helpful_count?: number
          published?: boolean
          search_tsv?: unknown
          slug: string
          tags?: string[]
          title: string
          updated_at?: string
          views?: number
        }
        Update: {
          author_id?: string | null
          body_html?: string
          body_text?: string
          category_id?: string | null
          created_at?: string
          establishment_id?: string
          excerpt?: string | null
          helpful_count?: number
          id?: string
          not_helpful_count?: number
          published?: boolean
          search_tsv?: unknown
          slug?: string
          tags?: string[]
          title?: string
          updated_at?: string
          views?: number
        }
        Relationships: [
          {
            foreignKeyName: "kb_articles_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "kb_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kb_articles_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
        ]
      }
      kb_categories: {
        Row: {
          created_at: string
          description: string | null
          establishment_id: string
          icon: string | null
          id: string
          name: string
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          establishment_id: string
          icon?: string | null
          id?: string
          name: string
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          establishment_id?: string
          icon?: string | null
          id?: string
          name?: string
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "kb_categories_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
        ]
      }
      kb_feedback: {
        Row: {
          article_id: string
          comment: string | null
          created_at: string
          helpful: boolean
          id: string
          visitor_hash: string | null
        }
        Insert: {
          article_id: string
          comment?: string | null
          created_at?: string
          helpful: boolean
          id?: string
          visitor_hash?: string | null
        }
        Update: {
          article_id?: string
          comment?: string | null
          created_at?: string
          helpful?: boolean
          id?: string
          visitor_hash?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kb_feedback_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "kb_articles"
            referencedColumns: ["id"]
          },
        ]
      }
      loyalty_cards: {
        Row: {
          campaign_id: string
          created_at: string
          customer_id: string
          cycle: number
          establishment_id: string
          id: string
          stamps: number
          updated_at: string
        }
        Insert: {
          campaign_id: string
          created_at?: string
          customer_id: string
          cycle?: number
          establishment_id: string
          id?: string
          stamps?: number
          updated_at?: string
        }
        Update: {
          campaign_id?: string
          created_at?: string
          customer_id?: string
          cycle?: number
          establishment_id?: string
          id?: string
          stamps?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "loyalty_cards_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_cards_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_cards_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_templates: {
        Row: {
          active: boolean
          body: string
          channel: string
          created_at: string
          establishment_id: string
          event: string
          id: string
          subject: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          body?: string
          channel?: string
          created_at?: string
          establishment_id: string
          event: string
          id?: string
          subject?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          body?: string
          channel?: string
          created_at?: string
          establishment_id?: string
          event?: string
          id?: string
          subject?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_templates_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_provider_credentials: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          credentials_ciphertext: string | null
          environment: string
          establishment_id: string
          id: string
          provider: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          credentials_ciphertext?: string | null
          environment?: string
          establishment_id: string
          id?: string
          provider: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          credentials_ciphertext?: string | null
          environment?: string
          establishment_id?: string
          id?: string
          provider?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_provider_credentials_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          created_at: string
          features: Json
          id: string
          max_campaigns: number | null
          max_customers: number | null
          max_staff: number | null
          name: string
          price_monthly: number
          tier: Database["public"]["Enums"]["plan_tier"]
        }
        Insert: {
          created_at?: string
          features?: Json
          id?: string
          max_campaigns?: number | null
          max_customers?: number | null
          max_staff?: number | null
          name: string
          price_monthly?: number
          tier: Database["public"]["Enums"]["plan_tier"]
        }
        Update: {
          created_at?: string
          features?: Json
          id?: string
          max_campaigns?: number | null
          max_customers?: number | null
          max_staff?: number | null
          name?: string
          price_monthly?: number
          tier?: Database["public"]["Enums"]["plan_tier"]
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      rewards: {
        Row: {
          campaign_id: string
          card_id: string
          cycle: number
          establishment_id: string
          expires_at: string | null
          id: string
          redeemed_at: string | null
          redeemed_by: string | null
          unlocked_at: string
        }
        Insert: {
          campaign_id: string
          card_id: string
          cycle: number
          establishment_id: string
          expires_at?: string | null
          id?: string
          redeemed_at?: string | null
          redeemed_by?: string | null
          unlocked_at?: string
        }
        Update: {
          campaign_id?: string
          card_id?: string
          cycle?: number
          establishment_id?: string
          expires_at?: string | null
          id?: string
          redeemed_at?: string | null
          redeemed_by?: string | null
          unlocked_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rewards_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rewards_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "loyalty_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rewards_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
        ]
      }
      stamps: {
        Row: {
          added_by: string | null
          card_id: string
          created_at: string
          cycle: number
          establishment_id: string
          id: string
          reverted_at: string | null
          reverted_by: string | null
        }
        Insert: {
          added_by?: string | null
          card_id: string
          created_at?: string
          cycle: number
          establishment_id: string
          id?: string
          reverted_at?: string | null
          reverted_by?: string | null
        }
        Update: {
          added_by?: string | null
          card_id?: string
          created_at?: string
          cycle?: number
          establishment_id?: string
          id?: string
          reverted_at?: string | null
          reverted_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stamps_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "loyalty_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stamps_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_events: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          actor_id: string | null
          created_at: string
          establishment_id: string
          event_type: string
          from_plan: string | null
          id: string
          message: string | null
          metadata: Json
          to_plan: string | null
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          actor_id?: string | null
          created_at?: string
          establishment_id: string
          event_type: string
          from_plan?: string | null
          id?: string
          message?: string | null
          metadata?: Json
          to_plan?: string | null
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          actor_id?: string | null
          created_at?: string
          establishment_id?: string
          event_type?: string
          from_plan?: string | null
          id?: string
          message?: string | null
          metadata?: Json
          to_plan?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subscription_events_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          establishment_id: string
          external_id: string | null
          id: string
          metadata: Json
          plan_id: string | null
          provider: string | null
          status: string
          tier: Database["public"]["Enums"]["plan_tier"]
          trial_ends_at: string | null
          updated_at: string
        }
        Insert: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          establishment_id: string
          external_id?: string | null
          id?: string
          metadata?: Json
          plan_id?: string | null
          provider?: string | null
          status?: string
          tier?: Database["public"]["Enums"]["plan_tier"]
          trial_ends_at?: string | null
          updated_at?: string
        }
        Update: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          establishment_id?: string
          external_id?: string | null
          id?: string
          metadata?: Json
          plan_id?: string | null
          provider?: string | null
          status?: string
          tier?: Database["public"]["Enums"]["plan_tier"]
          trial_ends_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: true
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      team_invites: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          email: string
          establishment_id: string
          expires_at: string
          id: string
          invited_by: string | null
          revoked_at: string | null
          role: Database["public"]["Enums"]["member_role"]
          token: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email: string
          establishment_id: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          revoked_at?: string | null
          role?: Database["public"]["Enums"]["member_role"]
          token: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email?: string
          establishment_id?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          revoked_at?: string | null
          role?: Database["public"]["Enums"]["member_role"]
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_invites_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_messages: {
        Row: {
          attachments: Json
          author_name: string | null
          author_type: Database["public"]["Enums"]["ticket_author_type"]
          author_user_id: string | null
          body: string
          created_at: string
          id: string
          internal: boolean
          ticket_id: string
        }
        Insert: {
          attachments?: Json
          author_name?: string | null
          author_type: Database["public"]["Enums"]["ticket_author_type"]
          author_user_id?: string | null
          body: string
          created_at?: string
          id?: string
          internal?: boolean
          ticket_id: string
        }
        Update: {
          attachments?: Json
          author_name?: string | null
          author_type?: Database["public"]["Enums"]["ticket_author_type"]
          author_user_id?: string | null
          body?: string
          created_at?: string
          id?: string
          internal?: boolean
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_quick_replies: {
        Row: {
          body: string
          created_at: string
          establishment_id: string
          id: string
          shortcut: string
          title: string
        }
        Insert: {
          body: string
          created_at?: string
          establishment_id: string
          id?: string
          shortcut: string
          title: string
        }
        Update: {
          body?: string
          created_at?: string
          establishment_id?: string
          id?: string
          shortcut?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_quick_replies_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
        ]
      }
      tickets: {
        Row: {
          assigned_to: string | null
          channel: Database["public"]["Enums"]["ticket_channel"]
          created_at: string
          csat: number | null
          csat_comment: string | null
          due_first_response_at: string | null
          due_resolution_at: string | null
          establishment_id: string
          first_response_at: string | null
          id: string
          number: number
          priority: Database["public"]["Enums"]["ticket_priority"]
          requester_email: string
          requester_name: string | null
          requester_user_id: string | null
          solved_at: string | null
          status: Database["public"]["Enums"]["ticket_status"]
          subject: string
          tags: string[]
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          channel?: Database["public"]["Enums"]["ticket_channel"]
          created_at?: string
          csat?: number | null
          csat_comment?: string | null
          due_first_response_at?: string | null
          due_resolution_at?: string | null
          establishment_id: string
          first_response_at?: string | null
          id?: string
          number?: number
          priority?: Database["public"]["Enums"]["ticket_priority"]
          requester_email: string
          requester_name?: string | null
          requester_user_id?: string | null
          solved_at?: string | null
          status?: Database["public"]["Enums"]["ticket_status"]
          subject: string
          tags?: string[]
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          channel?: Database["public"]["Enums"]["ticket_channel"]
          created_at?: string
          csat?: number | null
          csat_comment?: string | null
          due_first_response_at?: string | null
          due_resolution_at?: string | null
          establishment_id?: string
          first_response_at?: string | null
          id?: string
          number?: number
          priority?: Database["public"]["Enums"]["ticket_priority"]
          requester_email?: string
          requester_name?: string | null
          requester_user_id?: string | null
          solved_at?: string | null
          status?: Database["public"]["Enums"]["ticket_status"]
          subject?: string
          tags?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tickets_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_deliveries: {
        Row: {
          attempted_at: string
          event: string
          id: string
          ok: boolean
          payload: Json | null
          response: string | null
          status_code: number | null
          webhook_id: string
        }
        Insert: {
          attempted_at?: string
          event: string
          id?: string
          ok?: boolean
          payload?: Json | null
          response?: string | null
          status_code?: number | null
          webhook_id: string
        }
        Update: {
          attempted_at?: string
          event?: string
          id?: string
          ok?: boolean
          payload?: Json | null
          response?: string | null
          status_code?: number | null
          webhook_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_deliveries_webhook_id_fkey"
            columns: ["webhook_id"]
            isOneToOne: false
            referencedRelation: "webhooks"
            referencedColumns: ["id"]
          },
        ]
      }
      webhooks: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          establishment_id: string
          events: string[]
          id: string
          name: string
          secret: string
          updated_at: string
          url: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          establishment_id: string
          events?: string[]
          id?: string
          name: string
          secret: string
          updated_at?: string
          url: string
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          establishment_id?: string
          events?: string[]
          id?: string
          name?: string
          secret?: string
          updated_at?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhooks_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_establishment_access: {
        Args: { _est: string; _user: string }
        Returns: boolean
      }
      has_establishment_role: {
        Args: {
          _est: string
          _min_role: Database["public"]["Enums"]["member_role"]
          _user: string
        }
        Returns: boolean
      }
      is_helpdesk_admin: {
        Args: { _est: string; _user: string }
        Returns: boolean
      }
      is_helpdesk_agent: {
        Args: { _est: string; _user: string }
        Returns: boolean
      }
      is_super_admin: { Args: { _user: string }; Returns: boolean }
    }
    Enums: {
      campaign_type: "stamps" | "points"
      helpdesk_role: "hd_admin" | "hd_agent"
      member_role: "owner" | "manager" | "staff"
      plan_tier: "free" | "starter" | "pro" | "enterprise"
      platform_role: "super_admin"
      ticket_author_type: "customer" | "agent" | "system"
      ticket_channel: "form" | "email" | "chat" | "agent"
      ticket_priority: "low" | "normal" | "high" | "urgent"
      ticket_status: "open" | "pending" | "on_hold" | "solved" | "closed"
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
      campaign_type: ["stamps", "points"],
      helpdesk_role: ["hd_admin", "hd_agent"],
      member_role: ["owner", "manager", "staff"],
      plan_tier: ["free", "starter", "pro", "enterprise"],
      platform_role: ["super_admin"],
      ticket_author_type: ["customer", "agent", "system"],
      ticket_channel: ["form", "email", "chat", "agent"],
      ticket_priority: ["low", "normal", "high", "urgent"],
      ticket_status: ["open", "pending", "on_hold", "solved", "closed"],
    },
  },
} as const
