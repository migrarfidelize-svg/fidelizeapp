-- =====================================================================
-- FIDELIZE - SCHEMA COMPLETO (gerado automaticamente do banco conectado)
-- Execute este arquivo no SQL Editor do Supabase (projeto novo e vazio).
-- =====================================================================

-- Extensões
create extension if not exists "pg_cron" with schema extensions;
create extension if not exists "pg_net" with schema extensions;
create extension if not exists "pg_stat_statements" with schema extensions;
create extension if not exists "pgcrypto" with schema extensions;
create extension if not exists "supabase_vault" with schema extensions;
create extension if not exists "uuid-ossp" with schema extensions;

-- ---------------------------------------------------------------------
-- 1. TIPOS ENUM
-- ---------------------------------------------------------------------
do $$ begin create type public.account_type as enum ('customer', 'establishment', 'super_admin'); exception when duplicate_object then null; end $$;
do $$ begin create type public.campaign_type as enum ('stamps', 'points'); exception when duplicate_object then null; end $$;
do $$ begin create type public.customer_tier as enum ('bronze', 'prata', 'ouro', 'diamante'); exception when duplicate_object then null; end $$;
do $$ begin create type public.helpdesk_role as enum ('hd_admin', 'hd_agent'); exception when duplicate_object then null; end $$;
do $$ begin create type public.member_role as enum ('owner', 'manager', 'staff'); exception when duplicate_object then null; end $$;
do $$ begin create type public.menu_default_view as enum ('stories', 'list'); exception when duplicate_object then null; end $$;
do $$ begin create type public.menu_media_kind as enum ('image', 'video'); exception when duplicate_object then null; end $$;
do $$ begin create type public.menu_status as enum ('draft', 'published', 'paused'); exception when duplicate_object then null; end $$;
do $$ begin create type public.order_fulfillment as enum ('pickup', 'delivery'); exception when duplicate_object then null; end $$;
do $$ begin create type public.order_status as enum ('new', 'confirmed', 'preparing', 'ready', 'completed', 'cancelled'); exception when duplicate_object then null; end $$;
do $$ begin create type public.plan_tier as enum ('free', 'starter', 'pro', 'enterprise', 'business'); exception when duplicate_object then null; end $$;
do $$ begin create type public.platform_role as enum ('super_admin'); exception when duplicate_object then null; end $$;
do $$ begin create type public.public_review_action as enum ('apologize', 'ask_details', 'thank', 'invite_google', 'invite_share', 'none'); exception when duplicate_object then null; end $$;
do $$ begin create type public.public_review_qtype as enum ('stars', 'nps', 'yes_no', 'choice', 'short', 'long'); exception when duplicate_object then null; end $$;
do $$ begin create type public.public_review_source as enum ('linktree', 'direct_url', 'qr', 'embed'); exception when duplicate_object then null; end $$;
do $$ begin create type public.public_review_status as enum ('new', 'analyzing', 'contacting', 'resolved', 'archived'); exception when duplicate_object then null; end $$;
do $$ begin create type public.showcase_kind as enum ('menu', 'catalog'); exception when duplicate_object then null; end $$;
do $$ begin create type public.support_author_type as enum ('customer', 'admin', 'system'); exception when duplicate_object then null; end $$;
do $$ begin create type public.support_category as enum ('duvidas', 'tecnico', 'carimbos', 'clientes', 'qrcode', 'campanhas', 'pagamentos', 'conta', 'sugestao', 'outro'); exception when duplicate_object then null; end $$;
do $$ begin create type public.support_priority as enum ('low', 'normal', 'high', 'urgent'); exception when duplicate_object then null; end $$;
do $$ begin create type public.support_status as enum ('open', 'in_progress', 'waiting_customer', 'answered', 'resolved', 'closed'); exception when duplicate_object then null; end $$;
do $$ begin create type public.ticket_author_type as enum ('customer', 'agent', 'system'); exception when duplicate_object then null; end $$;
do $$ begin create type public.ticket_channel as enum ('form', 'email', 'chat', 'agent'); exception when duplicate_object then null; end $$;
do $$ begin create type public.ticket_priority as enum ('low', 'normal', 'high', 'urgent'); exception when duplicate_object then null; end $$;
do $$ begin create type public.ticket_status as enum ('open', 'pending', 'on_hold', 'solved', 'closed'); exception when duplicate_object then null; end $$;

-- Sequências independentes
create sequence if not exists public.support_ticket_seq;

-- ---------------------------------------------------------------------
-- 2. TABELAS
-- ---------------------------------------------------------------------
create table if not exists public.achievements (
  "id" uuid default gen_random_uuid() not null,
  "code" text not null,
  "title" text not null,
  "description" text not null,
  "icon" text default 'Award'::text not null,
  "rarity" text default 'common'::text not null,
  "criteria_type" text not null,
  "criteria_value" integer default 1 not null,
  "sort_order" integer default 0 not null,
  "is_active" boolean default true not null,
  "created_at" timestamp with time zone default now() not null
);
create table if not exists public.ai_analyses (
  "id" uuid default gen_random_uuid() not null,
  "establishment_id" uuid not null,
  "surface" text not null,
  "target_id" uuid,
  "overall_score" integer default 0 not null,
  "scores_json" jsonb default '{}'::jsonb not null,
  "findings_json" jsonb default '[]'::jsonb not null,
  "tokens_used" integer default 0 not null,
  "model" text,
  "created_by" uuid,
  "created_at" timestamp with time zone default now() not null
);
create table if not exists public.ai_findings_state (
  "id" uuid default gen_random_uuid() not null,
  "analysis_id" uuid not null,
  "establishment_id" uuid not null,
  "finding_key" text not null,
  "target_type" text,
  "target_id" uuid,
  "status" text default 'open'::text not null,
  "applied_payload" jsonb,
  "actor_id" uuid,
  "updated_at" timestamp with time zone default now() not null
);
create table if not exists public.ai_usage (
  "id" uuid default gen_random_uuid() not null,
  "establishment_id" uuid not null,
  "surface" text not null,
  "kind" text not null,
  "units" integer default 1 not null,
  "tokens" integer default 0 not null,
  "actor_id" uuid,
  "created_at" timestamp with time zone default now() not null
);
create table if not exists public.api_keys (
  "id" uuid default gen_random_uuid() not null,
  "establishment_id" uuid not null,
  "name" text not null,
  "prefix" text not null,
  "key_hash" text not null,
  "scopes" text[] default ARRAY[]::text[] not null,
  "last_used_at" timestamp with time zone,
  "created_by" uuid,
  "revoked_at" timestamp with time zone,
  "created_at" timestamp with time zone default now() not null
);
create table if not exists public.app_engagement_events (
  "id" bigint generated always as identity not null,
  "user_id" uuid,
  "establishment_id" uuid,
  "audience" text not null,
  "event_type" text not null,
  "platform" text,
  "browser" text,
  "standalone" boolean,
  "ua" text,
  "meta" jsonb default '{}'::jsonb not null,
  "occurred_at" timestamp with time zone default now() not null
);
create table if not exists public.app_roles (
  "id" uuid default gen_random_uuid() not null,
  "user_id" uuid not null,
  "role" platform_role not null,
  "created_at" timestamp with time zone default now() not null
);
create table if not exists public.audit_logs (
  "id" uuid default gen_random_uuid() not null,
  "establishment_id" uuid,
  "user_id" uuid,
  "action" text not null,
  "entity_type" text,
  "entity_id" uuid,
  "metadata" jsonb,
  "ip" text,
  "created_at" timestamp with time zone default now() not null
);
create table if not exists public.auth_attempts (
  "id" uuid default gen_random_uuid() not null,
  "ip" text,
  "identifier" text,
  "action" text not null,
  "success" boolean default false not null,
  "created_at" timestamp with time zone default now() not null
);
create table if not exists public.campaigns (
  "id" uuid default gen_random_uuid() not null,
  "establishment_id" uuid not null,
  "name" text not null,
  "type" campaign_type default 'stamps'::campaign_type not null,
  "stamps_required" integer default 10 not null,
  "reward_title" text not null,
  "reward_description" text,
  "rules" text,
  "stamp_icon" text default 'coffee'::text not null,
  "stamp_validity_days" integer,
  "reward_validity_days" integer default 60,
  "active" boolean default true not null,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null,
  "primary_color" text,
  "accent_color" text
);
create table if not exists public.channel_events (
  "id" bigint generated always as identity not null,
  "establishment_id" uuid not null,
  "channel" text not null,
  "event_type" text not null,
  "ref_id" text,
  "ref_label" text,
  "utm_source" text,
  "utm_medium" text,
  "utm_campaign" text,
  "ua" text,
  "ip_hash" text,
  "occurred_at" timestamp with time zone default now() not null
);
create table if not exists public.consents (
  "id" uuid default gen_random_uuid() not null,
  "customer_id" uuid not null,
  "establishment_id" uuid not null,
  "terms_version" text default '1.0'::text not null,
  "marketing_opt_in" boolean default false not null,
  "accepted_at" timestamp with time zone default now() not null,
  "ip" text,
  "user_agent" text,
  "privacy_version" text,
  "source" text
);
create table if not exists public.coupons (
  "id" uuid default gen_random_uuid() not null,
  "code" text not null,
  "description" text,
  "discount_pct" numeric(5,2),
  "discount_amount" numeric(10,2),
  "plan_tier" plan_tier,
  "valid_from" timestamp with time zone,
  "valid_until" timestamp with time zone,
  "max_uses" integer,
  "uses" integer default 0 not null,
  "active" boolean default true not null,
  "created_by" uuid,
  "created_at" timestamp with time zone default now() not null
);
create table if not exists public.customer_achievements (
  "id" uuid default gen_random_uuid() not null,
  "user_id" uuid not null,
  "achievement_code" text not null,
  "establishment_id" uuid,
  "unlocked_at" timestamp with time zone default now() not null,
  "seen_at" timestamp with time zone
);
create table if not exists public.customer_reviews (
  "id" uuid default gen_random_uuid() not null,
  "establishment_id" uuid not null,
  "review_form_id" uuid not null,
  "customer_id" uuid,
  "rating" integer not null,
  "comment" text,
  "customer_name" text,
  "customer_phone" text,
  "customer_email" text,
  "employee_id" uuid,
  "branch_id" uuid,
  "order_reference" text,
  "source" public_review_source default 'linktree'::public_review_source not null,
  "status" public_review_status default 'new'::public_review_status not null,
  "anonymous" boolean default false not null,
  "device_hash" text,
  "ip_hash" text,
  "internal_note" text,
  "assigned_to" uuid,
  "ticket_id" uuid,
  "submitted_at" timestamp with time zone default now() not null,
  "resolved_at" timestamp with time zone,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null,
  "merchant_reply" text,
  "merchant_reply_at" timestamp with time zone,
  "merchant_reply_by" uuid,
  "public_hidden" boolean default false not null
);
create table if not exists public.customers (
  "id" uuid default gen_random_uuid() not null,
  "establishment_id" uuid not null,
  "name" text not null,
  "phone" text not null,
  "email" text,
  "birthdate" date,
  "code" text default upper(SUBSTRING(md5((gen_random_uuid())::text) FROM 1 FOR 8)) not null,
  "access_token" text default encode(extensions.gen_random_bytes(24), 'hex'::text) not null,
  "marketing_opt_in" boolean default false not null,
  "blocked" boolean default false not null,
  "notes" text,
  "last_visit_at" timestamp with time zone,
  "visits_count" integer default 0 not null,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null,
  "tier" customer_tier default 'bronze'::customer_tier not null,
  "referral_code" text,
  "referred_by" uuid,
  "user_id" uuid,
  "pinned_at" timestamp with time zone
);
create table if not exists public.data_requests (
  "id" uuid default gen_random_uuid() not null,
  "establishment_id" uuid not null,
  "customer_id" uuid,
  "customer_phone" text,
  "kind" text not null,
  "status" text default 'pending'::text not null,
  "requested_by" uuid,
  "reason" text,
  "result_url" text,
  "processed_at" timestamp with time zone,
  "created_at" timestamp with time zone default now() not null
);
create table if not exists public.email_logs (
  "id" uuid default gen_random_uuid() not null,
  "to_email" text not null,
  "subject" text not null,
  "template" text,
  "status" text not null,
  "resend_id" text,
  "error" text,
  "duration_ms" integer,
  "actor_id" uuid,
  "establishment_id" uuid,
  "created_at" timestamp with time zone default now() not null
);
create table if not exists public.email_queue (
  "id" uuid default gen_random_uuid() not null,
  "to_email" text not null,
  "subject" text not null,
  "html" text not null,
  "text" text,
  "template" text,
  "variables" jsonb default '{}'::jsonb not null,
  "status" text default 'pending'::text not null,
  "attempts" integer default 0 not null,
  "max_attempts" integer default 5 not null,
  "next_attempt_at" timestamp with time zone default now() not null,
  "last_error" text,
  "resend_id" text,
  "actor_id" uuid,
  "establishment_id" uuid,
  "sent_at" timestamp with time zone,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);
create table if not exists public.email_templates (
  "id" uuid default gen_random_uuid() not null,
  "slug" text not null,
  "name" text not null,
  "description" text,
  "subject" text not null,
  "html" text not null,
  "text" text,
  "variables" jsonb default '[]'::jsonb not null,
  "is_system" boolean default false not null,
  "active" boolean default true not null,
  "updated_by" uuid,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);
create table if not exists public.establishment_feature_overrides (
  "id" uuid default gen_random_uuid() not null,
  "establishment_id" uuid not null,
  "feature_key" text not null,
  "enabled" boolean default true not null,
  "note" text,
  "granted_by" uuid,
  "expires_at" timestamp with time zone,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);
create table if not exists public.establishment_goals (
  "id" uuid default gen_random_uuid() not null,
  "establishment_id" uuid not null,
  "month" date not null,
  "stamps_goal" integer default 0 not null,
  "customers_goal" integer default 0 not null,
  "rewards_goal" integer default 0 not null,
  "revenue_goal" numeric(12,2) default 0 not null,
  "created_by" uuid,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);
create table if not exists public.establishment_members (
  "id" uuid default gen_random_uuid() not null,
  "establishment_id" uuid not null,
  "user_id" uuid not null,
  "role" member_role default 'staff'::member_role not null,
  "invited_email" text,
  "active" boolean default true not null,
  "created_at" timestamp with time zone default now() not null,
  "pin_hash" text,
  "display_name" text,
  "last_pin_used_at" timestamp with time zone
);
create table if not exists public.establishment_settings (
  "establishment_id" uuid not null,
  "privacy" jsonb default '{"policy_text": "", "retention_days": 730, "require_consent": true, "default_marketing_opt_in": false}'::jsonb not null,
  "notifications" jsonb default '{"events": {"birthday": false, "new_stamp": true, "reward_ready": true, "inactive_customer": false}, "channels": {"email": true, "whatsapp": false}, "inactive_days": 60}'::jsonb not null,
  "appearance" jsonb default '{"font": "inter", "card_shape": "rounded", "logo_shape": "circle", "stamp_icon": "star"}'::jsonb not null,
  "card" jsonb default '{"back_text": "", "program_name": "Programa Fidelidade", "default_reward": "Brinde especial", "post_reward_message": "Obrigado por participar!", "stamp_validity_days": 180, "default_stamps_required": 10}'::jsonb not null,
  "security" jsonb default '{"two_factor_required": false, "require_pin_to_stamp": false, "session_timeout_minutes": 0}'::jsonb not null,
  "billing_prefs" jsonb default '{"tax_id": "", "address": "", "invoice_email": ""}'::jsonb not null,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);
create table if not exists public.establishments (
  "id" uuid default gen_random_uuid() not null,
  "slug" text not null,
  "name" text not null,
  "description" text,
  "address" text,
  "phone" text,
  "whatsapp" text,
  "instagram" text,
  "email" text,
  "business_hours" text,
  "logo_url" text,
  "cover_url" text,
  "primary_color" text default '#5B21B6'::text not null,
  "accent_color" text default '#F97066'::text not null,
  "theme" text default 'light'::text not null,
  "plan" plan_tier default 'free'::plan_tier not null,
  "active" boolean default true not null,
  "average_ticket" numeric(10,2),
  "created_by" uuid,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null,
  "cnpj" text,
  "razao_social" text,
  "segment" text,
  "website" text,
  "city" text,
  "state" text,
  "cep" text,
  "facebook" text,
  "tiktok" text,
  "google_maps_url" text,
  "timezone" text default 'America/Sao_Paulo'::text not null,
  "archived_at" timestamp with time zone,
  "external_links" jsonb default '[]'::jsonb not null,
  "qr_destination" text default 'reviews'::text not null
);
create table if not exists public.feature_gate_events (
  "id" uuid default gen_random_uuid() not null,
  "establishment_id" uuid not null,
  "user_id" uuid,
  "feature_key" text not null,
  "action" text not null,
  "context" jsonb default '{}'::jsonb not null,
  "plan_tier" text,
  "created_at" timestamp with time zone default now() not null
);
create table if not exists public.help_article_views (
  "id" bigint default nextval('help_article_views_id_seq'::regclass) not null,
  "article_id" uuid not null,
  "user_id" uuid,
  "created_at" timestamp with time zone default now() not null
);
create table if not exists public.help_articles (
  "id" uuid default gen_random_uuid() not null,
  "category_id" uuid not null,
  "slug" text not null,
  "title" text not null,
  "excerpt" text,
  "content" text not null,
  "keywords" text,
  "reading_time" integer default 3 not null,
  "sort_order" integer default 0 not null,
  "published" boolean default true not null,
  "views" integer default 0 not null,
  "helpful_yes" integer default 0 not null,
  "helpful_no" integer default 0 not null,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);
create table if not exists public.help_categories (
  "id" uuid default gen_random_uuid() not null,
  "slug" text not null,
  "name" text not null,
  "description" text,
  "icon" text,
  "sort_order" integer default 0 not null,
  "active" boolean default true not null,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);
create table if not exists public.help_feedback (
  "id" bigint default nextval('help_feedback_id_seq'::regclass) not null,
  "article_id" uuid not null,
  "user_id" uuid,
  "helpful" boolean not null,
  "comment" text,
  "created_at" timestamp with time zone default now() not null
);
create table if not exists public.helpdesk_members (
  "id" uuid default gen_random_uuid() not null,
  "establishment_id" uuid not null,
  "user_id" uuid not null,
  "role" helpdesk_role default 'hd_agent'::helpdesk_role not null,
  "active" boolean default true not null,
  "created_at" timestamp with time zone default now() not null
);
create table if not exists public.integrations (
  "id" uuid default gen_random_uuid() not null,
  "category" text not null,
  "provider" text not null,
  "enabled" boolean default false not null,
  "mode" text,
  "config" jsonb default '{}'::jsonb not null,
  "credentials_ref" jsonb default '{}'::jsonb not null,
  "last_test_status" text,
  "last_test_message" text,
  "last_tested_at" timestamp with time zone,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null,
  "credentials" jsonb default '{}'::jsonb not null,
  "last_test_details" jsonb,
  "updated_by" uuid
);
create table if not exists public.kb_articles (
  "id" uuid default gen_random_uuid() not null,
  "establishment_id" uuid not null,
  "category_id" uuid,
  "title" text not null,
  "slug" text not null,
  "excerpt" text,
  "body_html" text default ''::text not null,
  "body_text" text default ''::text not null,
  "tags" text[] default '{}'::text[] not null,
  "published" boolean default false not null,
  "views" integer default 0 not null,
  "helpful_count" integer default 0 not null,
  "not_helpful_count" integer default 0 not null,
  "author_id" uuid,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null,
  "search_tsv" tsvector default ((setweight(to_tsvector('portuguese'::regconfig, COALESCE(title, ''::text)), 'A'::"char") || setweight(to_tsvector('portuguese'::regconfig, COALESCE(excerpt, ''::text)), 'B'::"char")) || setweight(to_tsvector('portuguese'::regconfig, COALESCE(body_text, ''::text)), 'C'::"char"))
);
create table if not exists public.kb_categories (
  "id" uuid default gen_random_uuid() not null,
  "establishment_id" uuid not null,
  "name" text not null,
  "slug" text not null,
  "description" text,
  "icon" text,
  "sort_order" integer default 0 not null,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);
create table if not exists public.kb_feedback (
  "id" uuid default gen_random_uuid() not null,
  "article_id" uuid not null,
  "helpful" boolean not null,
  "comment" text,
  "visitor_hash" text,
  "created_at" timestamp with time zone default now() not null
);
create table if not exists public.landing_content (
  "key" text not null,
  "data" jsonb default '{}'::jsonb not null,
  "updated_at" timestamp with time zone default now() not null,
  "updated_by" uuid
);
create table if not exists public.link_tree_links (
  "id" uuid default gen_random_uuid() not null,
  "page_id" uuid not null,
  "kind" text default 'custom'::text not null,
  "label" text not null,
  "url" text not null,
  "icon" text,
  "enabled" boolean default true not null,
  "sort_order" integer default 0 not null,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null,
  "data" jsonb default '{}'::jsonb not null
);
create table if not exists public.link_tree_pages (
  "id" uuid default gen_random_uuid() not null,
  "establishment_id" uuid not null,
  "title" text,
  "description" text,
  "logo_url" text,
  "cover_url" text,
  "theme" jsonb default '{}'::jsonb not null,
  "social" jsonb default '{}'::jsonb not null,
  "published" boolean default false not null,
  "published_at" timestamp with time zone,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);
create table if not exists public.log_purge_runs (
  "id" uuid default gen_random_uuid() not null,
  "ran_at" timestamp with time zone default now() not null,
  "details" jsonb default '{}'::jsonb not null,
  "total_deleted" integer default 0 not null
);
create table if not exists public.log_retention_policies (
  "table_name" text not null,
  "retention_days" integer not null,
  "timestamp_column" text default 'created_at'::text not null,
  "note" text,
  "updated_at" timestamp with time zone default now() not null
);
create table if not exists public.loyalty_cards (
  "id" uuid default gen_random_uuid() not null,
  "customer_id" uuid not null,
  "campaign_id" uuid not null,
  "establishment_id" uuid not null,
  "stamps" integer default 0 not null,
  "cycle" integer default 1 not null,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);
create table if not exists public.member_permissions (
  "member_id" uuid not null,
  "establishment_id" uuid not null,
  "overrides" jsonb default '{}'::jsonb not null,
  "updated_at" timestamp with time zone default now() not null,
  "updated_by" uuid
);
create table if not exists public.menu_categories (
  "id" uuid default gen_random_uuid() not null,
  "menu_id" uuid not null,
  "establishment_id" uuid not null,
  "name" text not null,
  "description" text,
  "image_url" text,
  "position" integer default 0 not null,
  "active" boolean default true not null,
  "featured" boolean default false not null,
  "available_days" smallint[] default ARRAY[(0)::smallint, (1)::smallint, (2)::smallint, (3)::smallint, (4)::smallint, (5)::smallint, (6)::smallint] not null,
  "available_start" time without time zone,
  "available_end" time without time zone,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);
create table if not exists public.menu_item_favorites (
  "id" uuid default gen_random_uuid() not null,
  "item_id" uuid not null,
  "user_id" uuid not null,
  "created_at" timestamp with time zone default now() not null
);
create table if not exists public.menu_item_media (
  "id" uuid default gen_random_uuid() not null,
  "item_id" uuid not null,
  "establishment_id" uuid not null,
  "kind" menu_media_kind not null,
  "url" text not null,
  "poster_url" text,
  "position" integer default 0 not null,
  "size_bytes" bigint,
  "mime" text,
  "width" integer,
  "height" integer,
  "duration_ms" integer,
  "created_at" timestamp with time zone default now() not null
);
create table if not exists public.menu_items (
  "id" uuid default gen_random_uuid() not null,
  "menu_id" uuid not null,
  "category_id" uuid,
  "establishment_id" uuid not null,
  "name" text not null,
  "short_desc" text,
  "long_desc" text,
  "price" numeric(10,2),
  "promo_price" numeric(10,2),
  "currency" text default 'BRL'::text not null,
  "image_url" text,
  "video_url" text,
  "video_poster_url" text,
  "ingredients" text[] default '{}'::text[] not null,
  "addons" jsonb default '[]'::jsonb not null,
  "notes" text,
  "badges" jsonb default '{}'::jsonb not null,
  "allergens" text[] default '{}'::text[] not null,
  "prep_minutes" integer,
  "order_action" jsonb default '{"type": "none"}'::jsonb not null,
  "position" integer default 0 not null,
  "active" boolean default true not null,
  "available_days" smallint[] default ARRAY[(0)::smallint, (1)::smallint, (2)::smallint, (3)::smallint, (4)::smallint, (5)::smallint, (6)::smallint] not null,
  "time_start" time without time zone,
  "time_end" time without time zone,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null,
  "variants" jsonb default '[]'::jsonb not null,
  "sku" text,
  "brand" text,
  "stock_status" text default 'in_stock'::text not null,
  "external_url" text,
  "track_stock" boolean default false not null,
  "stock_qty" integer,
  "gallery" jsonb default '[]'::jsonb not null,
  "ai_hash" text,
  "ai_analyzed_at" timestamp with time zone
);
create table if not exists public.menu_publish_events (
  "id" uuid default gen_random_uuid() not null,
  "menu_id" uuid not null,
  "establishment_id" uuid not null,
  "from_status" menu_status,
  "to_status" menu_status not null,
  "actor_id" uuid,
  "notes" text,
  "created_at" timestamp with time zone default now() not null
);
create table if not exists public.menu_qr_designs (
  "id" uuid default gen_random_uuid() not null,
  "menu_id" uuid not null,
  "establishment_id" uuid not null,
  "format" text default 'table'::text not null,
  "color" text default '#000000'::text not null,
  "logo_url" text,
  "layout" jsonb default '{}'::jsonb not null,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);
create table if not exists public.merchant_message_reads (
  "message_id" uuid not null,
  "user_id" uuid not null,
  "read_at" timestamp with time zone default now() not null
);
create table if not exists public.merchant_messages (
  "id" uuid default gen_random_uuid() not null,
  "establishment_id" uuid not null,
  "author_id" uuid,
  "kind" text default 'novidade'::text not null,
  "title" text not null,
  "body" text not null,
  "image_url" text,
  "link_url" text,
  "published_at" timestamp with time zone default now() not null,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null,
  "source" text default 'manual'::text not null,
  "push_log_id" uuid
);
create table if not exists public.notification_templates (
  "id" uuid default gen_random_uuid() not null,
  "establishment_id" uuid not null,
  "event" text not null,
  "channel" text default 'email'::text not null,
  "subject" text,
  "body" text default ''::text not null,
  "active" boolean default true not null,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);
create table if not exists public.order_items (
  "id" uuid default gen_random_uuid() not null,
  "order_id" uuid not null,
  "item_id" uuid,
  "name" text not null,
  "sku" text,
  "variant_label" text,
  "unit_price" numeric(12,2) default 0 not null,
  "qty" integer default 1 not null,
  "line_total" numeric(12,2) default 0 not null,
  "created_at" timestamp with time zone default now() not null
);
create table if not exists public.orders (
  "id" uuid default gen_random_uuid() not null,
  "establishment_id" uuid not null,
  "menu_id" uuid,
  "kind" showcase_kind default 'catalog'::showcase_kind not null,
  "order_number" integer default 0 not null,
  "customer_name" text not null,
  "customer_phone" text,
  "fulfillment" order_fulfillment default 'pickup'::order_fulfillment not null,
  "address" text,
  "note" text,
  "payment_method" text,
  "items_total" numeric(12,2) default 0 not null,
  "total" numeric(12,2) default 0 not null,
  "currency" text default 'BRL'::text not null,
  "status" order_status default 'new'::order_status not null,
  "source" text default 'whatsapp'::text not null,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);
create table if not exists public.payment_logs (
  "id" uuid default gen_random_uuid() not null,
  "event_type" text not null,
  "mp_resource" text,
  "mp_id" text,
  "action" text,
  "live_mode" boolean,
  "signature_valid" boolean default false not null,
  "processed" boolean default false not null,
  "error" text,
  "payload" jsonb,
  "headers" jsonb,
  "created_at" timestamp with time zone default now() not null,
  "mode" text,
  "reason" text,
  "response_status" integer,
  "retry_count" integer default 0 not null,
  "next_retry_at" timestamp with time zone,
  "last_retry_at" timestamp with time zone,
  "provider" text default 'mercadopago'::text not null
);
create table if not exists public.payment_provider_credentials (
  "id" uuid default gen_random_uuid() not null,
  "establishment_id" uuid not null,
  "provider" text not null,
  "credentials_ciphertext" text,
  "environment" text default 'sandbox'::text not null,
  "active" boolean default false not null,
  "created_by" uuid,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);
create table if not exists public.payment_settings (
  "id" uuid default gen_random_uuid() not null,
  "environment" text default 'sandbox'::text not null,
  "public_key" text,
  "webhook_url" text,
  "last_tested_at" timestamp with time zone,
  "last_test_status" text,
  "last_test_message" text,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null,
  "account_email" text,
  "account_nickname" text,
  "account_id" text
);
create table if not exists public.payments (
  "id" uuid default gen_random_uuid() not null,
  "establishment_id" uuid not null,
  "subscription_id" uuid,
  "plan_id" uuid,
  "plan_slug" text,
  "mp_payment_id" text,
  "mp_order_id" text,
  "mp_preference_id" text,
  "amount" numeric(12,2) not null,
  "currency" text default 'BRL'::text not null,
  "method" text not null,
  "status" text default 'pending'::text not null,
  "status_detail" text,
  "pix_qr_code" text,
  "pix_qr_code_base64" text,
  "pix_copy_paste" text,
  "pix_expires_at" timestamp with time zone,
  "boleto_url" text,
  "receipt_url" text,
  "card_last4" text,
  "card_brand" text,
  "installments" integer,
  "payer_email" text,
  "payer_doc" text,
  "idempotency_key" text,
  "raw" jsonb,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null,
  "approved_at" timestamp with time zone,
  "provider" text default 'mercadopago'::text not null,
  "provider_payment_id" text
);
create table if not exists public.pixel_events (
  "id" uuid default gen_random_uuid() not null,
  "pixel_id" text,
  "event_name" text not null,
  "path" text,
  "referrer" text,
  "session_hash" text,
  "device" text,
  "source" text default 'browser'::text not null,
  "capi_status" text,
  "props" jsonb default '{}'::jsonb not null,
  "created_at" timestamp with time zone default now() not null
);
create table if not exists public.plan_features (
  "id" uuid default gen_random_uuid() not null,
  "plan_id" uuid not null,
  "feature_key" text not null,
  "feature_name" text not null,
  "enabled" boolean default true not null,
  "limit_value" integer,
  "created_at" timestamp with time zone default now() not null
);
create table if not exists public.plan_funnel_events (
  "id" uuid default gen_random_uuid() not null,
  "created_at" timestamp with time zone default now() not null,
  "session_id" text,
  "stage" text not null,
  "plan_slug" text,
  "plan_name" text,
  "amount" numeric(10,2),
  "source" text,
  "provider" text,
  "user_id" uuid,
  "meta" jsonb default '{}'::jsonb not null
);
create table if not exists public.plans (
  "id" uuid default gen_random_uuid() not null,
  "tier" plan_tier not null,
  "name" text not null,
  "price_monthly" numeric(10,2) default 0 not null,
  "max_customers" integer,
  "max_staff" integer,
  "max_campaigns" integer,
  "features" jsonb default '{}'::jsonb not null,
  "created_at" timestamp with time zone default now() not null,
  "slug" text not null,
  "description" text,
  "price_yearly" numeric(10,2),
  "currency" text default 'BRL'::text not null,
  "customer_limit" integer,
  "employee_limit" integer,
  "campaign_limit" integer,
  "unit_limit" integer,
  "active_card_limit" integer,
  "stamp_limit" integer,
  "email_limit" integer,
  "storage_limit_mb" integer,
  "ticket_limit" integer,
  "is_active" boolean default true not null,
  "is_featured" boolean default false not null,
  "display_order" integer default 0 not null,
  "trial_days" integer default 0 not null,
  "button_text" text,
  "archived_at" timestamp with time zone,
  "updated_at" timestamp with time zone default now() not null
);
create table if not exists public.poster_designs (
  "id" uuid default gen_random_uuid() not null,
  "establishment_id" uuid not null,
  "name" text not null,
  "data" jsonb not null,
  "created_by" uuid,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null,
  "applied_by" uuid,
  "applied_at" timestamp with time zone
);
create table if not exists public.print_orders (
  "id" uuid default gen_random_uuid() not null,
  "order_number" text default ('FID-'::text || to_char(clock_timestamp(), 'YYMMDDHH24MISSMS'::text)) not null,
  "establishment_id" uuid not null,
  "requested_by" uuid,
  "quantity" integer not null,
  "paper" text not null,
  "finish" text,
  "format" text,
  "shipping_address" jsonb not null,
  "contact_email" text,
  "contact_phone" text,
  "notes" text,
  "pdf_path" text,
  "svg_path" text,
  "status" text default 'pending'::text not null,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);
create table if not exists public.profiles (
  "id" uuid not null,
  "full_name" text,
  "avatar_url" text,
  "phone" text,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null,
  "account_type" account_type default 'customer'::account_type not null
);
create table if not exists public.profiles_account_type_backup (
  "id" uuid default gen_random_uuid() not null,
  "profile_id" uuid not null,
  "account_type" account_type,
  "backup_batch" text not null,
  "backed_up_at" timestamp with time zone default now() not null
);
create table if not exists public.promotions (
  "id" uuid default gen_random_uuid() not null,
  "establishment_id" uuid not null,
  "title" text not null,
  "body" text,
  "media" jsonb default '[]'::jsonb not null,
  "external_links" jsonb default '[]'::jsonb not null,
  "active" boolean default true not null,
  "starts_at" timestamp with time zone,
  "ends_at" timestamp with time zone,
  "created_by" uuid,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);
create table if not exists public.push_events (
  "id" uuid default gen_random_uuid() not null,
  "user_id" uuid,
  "customer_id" uuid,
  "establishment_id" uuid,
  "subscription_id" uuid,
  "event_type" text not null,
  "status" text,
  "hostname" text,
  "browser" text,
  "operating_system" text,
  "error_code" text,
  "error_message" text,
  "metadata" jsonb default '{}'::jsonb not null,
  "created_at" timestamp with time zone default now() not null
);
create table if not exists public.push_logs (
  "id" uuid default gen_random_uuid() not null,
  "establishment_id" uuid,
  "subscription_id" uuid,
  "customer_id" uuid,
  "title" text not null,
  "body" text,
  "url" text,
  "status" text default 'sent'::text not null,
  "status_code" integer,
  "error" text,
  "created_at" timestamp with time zone default now() not null
);
create table if not exists public.push_subscriptions (
  "id" uuid default gen_random_uuid() not null,
  "establishment_id" uuid,
  "customer_id" uuid,
  "user_id" uuid,
  "endpoint" text not null,
  "p256dh" text not null,
  "auth_key" text not null,
  "user_agent" text,
  "preferences" jsonb default '{"stamp": true, "reward": true, "birthday": true, "campaign": true}'::jsonb not null,
  "active" boolean default true not null,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null,
  "last_error" text,
  "device_type" text,
  "operating_system" text,
  "browser" text,
  "permission_status" text,
  "last_seen_at" timestamp with time zone default now()
);
create table if not exists public.qr_scans (
  "id" bigint generated always as identity not null,
  "establishment_id" uuid not null,
  "dest" text not null,
  "ua" text,
  "ip_hash" text,
  "scanned_at" timestamp with time zone default now() not null
);
create table if not exists public.qr_tags (
  "id" uuid default gen_random_uuid() not null,
  "establishment_id" uuid not null,
  "code" text not null,
  "label" text not null,
  "location" text,
  "destination" text,
  "active" boolean default true not null,
  "scans_count" integer default 0 not null,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);
create table if not exists public.restaurant_menus (
  "id" uuid default gen_random_uuid() not null,
  "establishment_id" uuid not null,
  "status" menu_status default 'draft'::menu_status not null,
  "default_view" menu_default_view default 'list'::menu_default_view not null,
  "display_name" text,
  "tagline" text,
  "cover_url" text,
  "logo_url" text,
  "theme" jsonb default '{}'::jsonb not null,
  "contact" jsonb default '{}'::jsonb not null,
  "hours" jsonb default '{}'::jsonb not null,
  "closed_message" text,
  "order_defaults" jsonb default '{}'::jsonb not null,
  "published_at" timestamp with time zone,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null,
  "kind" showcase_kind default 'menu'::showcase_kind not null
);
create table if not exists public.retention_dispatches (
  "id" uuid default gen_random_uuid() not null,
  "establishment_id" uuid not null,
  "customer_id" uuid not null,
  "kind" text not null,
  "channel" text not null,
  "status" text default 'sent'::text not null,
  "payload" jsonb,
  "error" text,
  "created_at" timestamp with time zone default now() not null
);
create table if not exists public.retention_events (
  "id" uuid default gen_random_uuid() not null,
  "establishment_id" uuid not null,
  "customer_id" uuid not null,
  "event_type" text not null,
  "from_value" text,
  "to_value" text,
  "meta" jsonb,
  "created_at" timestamp with time zone default now() not null
);
create table if not exists public.retention_settings (
  "establishment_id" uuid not null,
  "birthday_enabled" boolean default true not null,
  "birthday_message" text default 'Feliz aniversário! Um mimo especial te espera na sua próxima visita.'::text not null,
  "birthday_coupon_percent" integer default 0 not null,
  "reengagement_enabled" boolean default true not null,
  "reengagement_days" integer default 30 not null,
  "reengagement_message" text default 'Sentimos sua falta! Que tal voltar e acumular mais carimbos?'::text not null,
  "tiers_enabled" boolean default true not null,
  "tier_thresholds" jsonb default '{"ouro": 25, "prata": 10, "bronze": 0, "diamante": 50}'::jsonb not null,
  "referral_enabled" boolean default false not null,
  "referral_bonus_stamps" integer default 1 not null,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);
create table if not exists public.review_answers (
  "id" uuid default gen_random_uuid() not null,
  "review_id" uuid not null,
  "question_id" uuid not null,
  "answer_text" text,
  "answer_number" numeric,
  "answer_boolean" boolean,
  "created_at" timestamp with time zone default now() not null
);
create table if not exists public.review_events (
  "id" uuid default gen_random_uuid() not null,
  "review_form_id" uuid not null,
  "review_id" uuid,
  "event_type" text not null,
  "meta" jsonb,
  "created_at" timestamp with time zone default now() not null
);
create table if not exists public.review_forms (
  "id" uuid default gen_random_uuid() not null,
  "establishment_id" uuid not null,
  "active" boolean default true not null,
  "title" text default 'Como foi sua experiência conosco?'::text not null,
  "question" text default 'Sua opinião nos ajuda a melhorar.'::text not null,
  "description" text,
  "submit_label" text default 'Enviar avaliação'::text not null,
  "success_message" text default 'Obrigado pela sua avaliação!'::text not null,
  "star_color" text default '#FACC15'::text not null,
  "button_color" text default '#7C3AED'::text not null,
  "google_review_url" text,
  "redirect_to_google_enabled" boolean default false not null,
  "show_average" boolean default true not null,
  "show_review_count" boolean default true not null,
  "anonymous_allowed" boolean default true not null,
  "name_required" boolean default false not null,
  "phone_required" boolean default false not null,
  "email_required" boolean default false not null,
  "comment_required" boolean default false not null,
  "allow_multiple" boolean default false not null,
  "cooldown_hours" integer default 24 not null,
  "consent_text" text default 'Ao enviar, você autoriza o uso destes dados para que a empresa possa responder à sua avaliação.'::text,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);
create table if not exists public.review_questions (
  "id" uuid default gen_random_uuid() not null,
  "review_form_id" uuid not null,
  "question" text not null,
  "question_type" public_review_qtype default 'short'::public_review_qtype not null,
  "choices" jsonb,
  "required" boolean default false not null,
  "display_order" integer default 0 not null,
  "active" boolean default true not null,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);
create table if not exists public.review_rating_options (
  "id" uuid default gen_random_uuid() not null,
  "review_form_id" uuid not null,
  "rating" integer not null,
  "enabled" boolean default true not null,
  "label" text not null,
  "selection_message" text,
  "comment_required" boolean default false not null,
  "post_submit_action" public_review_action default 'thank'::public_review_action not null,
  "display_order" integer default 0 not null,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);
create table if not exists public.review_settings (
  "id" uuid default gen_random_uuid() not null,
  "establishment_id" uuid not null,
  "auto_prompt" boolean default true not null,
  "prompt_title" text default 'Como foi seu atendimento?'::text not null,
  "prompt_message" text default 'Sua opinião nos ajuda a melhorar. Leva menos de 30 segundos!'::text not null,
  "ask_nps" boolean default false not null,
  "ask_categories" boolean default true not null,
  "google_place_url" text,
  "google_redirect_min_rating" integer default 5 not null,
  "public_page_enabled" boolean default true not null,
  "thank_you_message" text default 'Obrigado pelo seu feedback!'::text not null,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null,
  "theme" jsonb default '{"accent": null, "preset": "circuit", "pattern": "grid", "bg_color": null, "headline": null, "subheadline": null, "show_reviews": true, "show_powered_by": true}'::jsonb not null
);
create table if not exists public.reviews (
  "id" uuid default gen_random_uuid() not null,
  "establishment_id" uuid not null,
  "customer_id" uuid,
  "card_id" uuid,
  "stamp_id" uuid,
  "rating" integer not null,
  "nps" integer,
  "categories" jsonb default '{}'::jsonb not null,
  "comment" text,
  "customer_name" text,
  "reply" text,
  "replied_at" timestamp with time zone,
  "replied_by" uuid,
  "is_public" boolean default true not null,
  "source" text default 'voucher'::text not null,
  "ip_hash" text,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);
create table if not exists public.rewards (
  "id" uuid default gen_random_uuid() not null,
  "card_id" uuid not null,
  "campaign_id" uuid not null,
  "establishment_id" uuid not null,
  "cycle" integer not null,
  "unlocked_at" timestamp with time zone default now() not null,
  "redeemed_at" timestamp with time zone,
  "redeemed_by" uuid,
  "expires_at" timestamp with time zone,
  "expiry_notified_at" timestamp with time zone
);
create table if not exists public.scheduled_pushes (
  "id" uuid default gen_random_uuid() not null,
  "establishment_id" uuid not null,
  "title" text not null,
  "body" text,
  "url" text,
  "segment" jsonb default '{}'::jsonb not null,
  "scheduled_at" timestamp with time zone not null,
  "status" text default 'pending'::text not null,
  "sent_at" timestamp with time zone,
  "result" jsonb,
  "created_by" uuid,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);
create table if not exists public.sponsored_ad_campaigns (
  "id" uuid default gen_random_uuid() not null,
  "establishment_id" uuid not null,
  "package_id" uuid,
  "category_id" text not null,
  "title" text default ''::text not null,
  "description" text default ''::text not null,
  "image_path" text,
  "image_source" text default 'upload'::text not null,
  "cta_label" text default 'Saiba mais'::text not null,
  "destination_type" text default 'establishment'::text not null,
  "destination_slug" text default ''::text not null,
  "status" text default 'draft'::text not null,
  "requested_start_at" timestamp with time zone,
  "starts_at" timestamp with time zone,
  "ends_at" timestamp with time zone,
  "paused_at" timestamp with time zone,
  "pause_origin" text,
  "pause_reason" text,
  "total_paused_seconds" integer default 0 not null,
  "submitted_at" timestamp with time zone,
  "approved_at" timestamp with time zone,
  "approved_by" uuid,
  "rejected_at" timestamp with time zone,
  "rejected_by" uuid,
  "rejection_reason" text,
  "changes_requested_reason" text,
  "is_courtesy" boolean default false not null,
  "courtesy_reason" text,
  "package_name_snapshot" text,
  "duration_days_snapshot" integer,
  "price_cents_snapshot" integer,
  "currency_snapshot" text,
  "settings_snapshot" jsonb,
  "terms_accepted_at" timestamp with time zone,
  "terms_version" integer,
  "terms_accepted_by" uuid,
  "tracking_token" text default encode(extensions.gen_random_bytes(24), 'hex'::text) not null,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null,
  "created_by" uuid,
  "updated_by" uuid
);
create table if not exists public.sponsored_ad_daily_metrics (
  "id" uuid default gen_random_uuid() not null,
  "campaign_id" uuid not null,
  "metric_date" date not null,
  "unique_impressions" integer default 0 not null,
  "unique_clicks" integer default 0 not null,
  "updated_at" timestamp with time zone default now() not null
);
create table if not exists public.sponsored_ad_events (
  "id" uuid default gen_random_uuid() not null,
  "campaign_id" uuid not null,
  "event_type" text not null,
  "session_hash" text not null,
  "viewer_user_id" uuid,
  "category_id" text,
  "placement" text default 'wallet_discover'::text not null,
  "dedupe_bucket" text not null,
  "occurred_at" timestamp with time zone default now() not null,
  "created_at" timestamp with time zone default now() not null
);
create table if not exists public.sponsored_ad_orders (
  "id" uuid default gen_random_uuid() not null,
  "campaign_id" uuid not null,
  "establishment_id" uuid not null,
  "gateway" text not null,
  "payment_method" text default 'pix'::text not null,
  "external_payment_id" text,
  "idempotency_key" text not null,
  "amount_cents" integer not null,
  "currency" text default 'BRL'::text not null,
  "status" text default 'pending'::text not null,
  "pix_code" text,
  "pix_qr_code" text,
  "pix_expires_at" timestamp with time zone,
  "paid_at" timestamp with time zone,
  "refunded_at" timestamp with time zone,
  "gateway_status" text,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);
create table if not exists public.sponsored_ad_packages (
  "id" uuid default gen_random_uuid() not null,
  "name" text not null,
  "description" text,
  "duration_days" integer not null,
  "price_cents" integer not null,
  "currency" text default 'BRL'::text not null,
  "is_active" boolean default true not null,
  "display_order" integer default 0 not null,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null,
  "created_by" uuid,
  "updated_by" uuid
);
create table if not exists public.sponsored_ad_reviews (
  "id" uuid default gen_random_uuid() not null,
  "campaign_id" uuid not null,
  "admin_user_id" uuid,
  "action" text not null,
  "from_status" text,
  "to_status" text,
  "reason" text,
  "note" text,
  "creative_snapshot" jsonb,
  "created_at" timestamp with time zone default now() not null
);
create table if not exists public.sponsored_ad_settings (
  "id" boolean default true not null,
  "max_ads_per_category" integer default 3 not null,
  "impression_dedupe_minutes" integer default 30 not null,
  "click_dedupe_minutes" integer default 5 not null,
  "max_impressions_per_session_24h" integer default 3 not null,
  "allowed_categories" text[] default ARRAY['alimentacao'::text, 'beleza'::text, 'saude'::text, 'moda'::text, 'fitness'::text, 'pet'::text, 'servicos'::text, 'lazer'::text, 'outros'::text] not null,
  "default_gateway" text default 'mercadopago'::text not null,
  "pix_expiration_minutes" integer default 30 not null,
  "allow_self_pause" boolean default true not null,
  "self_pause_extends_period" boolean default false not null,
  "advertiser_terms" text default 'Ao enviar um anúncio você declara que o conteúdo é verdadeiro, próprio ou licenciado, e que não viola leis, direitos de terceiros ou a política de conteúdo da Fidelize. Anúncios enganosos, ofensivos, adultos, políticos, discriminatórios ou com ofertas inexistentes serão rejeitados sem reembolso.'::text not null,
  "advertiser_terms_version" integer default 1 not null,
  "updated_at" timestamp with time zone default now() not null,
  "updated_by" uuid
);
create table if not exists public.stamps (
  "id" uuid default gen_random_uuid() not null,
  "card_id" uuid not null,
  "establishment_id" uuid not null,
  "added_by" uuid,
  "cycle" integer not null,
  "reverted_at" timestamp with time zone,
  "reverted_by" uuid,
  "created_at" timestamp with time zone default now() not null
);
create table if not exists public.subscription_events (
  "id" uuid default gen_random_uuid() not null,
  "establishment_id" uuid not null,
  "event_type" text not null,
  "from_plan" text,
  "to_plan" text,
  "message" text,
  "actor_id" uuid,
  "metadata" jsonb default '{}'::jsonb not null,
  "acknowledged_at" timestamp with time zone,
  "acknowledged_by" uuid,
  "created_at" timestamp with time zone default now() not null
);
create table if not exists public.subscriptions (
  "id" uuid default gen_random_uuid() not null,
  "establishment_id" uuid not null,
  "plan_id" uuid,
  "tier" plan_tier default 'free'::plan_tier not null,
  "status" text default 'active'::text not null,
  "provider" text,
  "external_id" text,
  "current_period_start" timestamp with time zone,
  "current_period_end" timestamp with time zone,
  "cancel_at_period_end" boolean default false not null,
  "trial_ends_at" timestamp with time zone,
  "metadata" jsonb default '{}'::jsonb not null,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null,
  "mp_customer_id" text,
  "mp_subscription_id" text,
  "mp_last_payment_id" text,
  "payment_method" text,
  "next_billing_date" timestamp with time zone,
  "cancelled_at" timestamp with time zone
);
create table if not exists public.support_messages (
  "id" uuid default gen_random_uuid() not null,
  "ticket_id" uuid not null,
  "sender_user_id" uuid,
  "sender_type" support_author_type not null,
  "sender_name" text,
  "message" text not null,
  "is_internal" boolean default false not null,
  "attachments" jsonb default '[]'::jsonb not null,
  "created_at" timestamp with time zone default now() not null,
  "read_at" timestamp with time zone
);
create table if not exists public.support_quick_replies (
  "id" uuid default gen_random_uuid() not null,
  "shortcut" text not null,
  "title" text not null,
  "body" text not null,
  "created_by" uuid,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);
create table if not exists public.support_status_history (
  "id" uuid default gen_random_uuid() not null,
  "ticket_id" uuid not null,
  "from_status" support_status,
  "to_status" support_status not null,
  "changed_by" uuid,
  "reason" text,
  "created_at" timestamp with time zone default now() not null
);
create table if not exists public.support_tickets (
  "id" uuid default gen_random_uuid() not null,
  "protocol" text default ('SPT-'::text || lpad((nextval('support_ticket_seq'::regclass))::text, 6, '0'::text)) not null,
  "establishment_id" uuid,
  "requester_user_id" uuid not null,
  "requester_name" text,
  "requester_email" text not null,
  "subject" text not null,
  "category" support_category default 'outro'::support_category not null,
  "priority" support_priority default 'normal'::support_priority not null,
  "status" support_status default 'open'::support_status not null,
  "assigned_admin_id" uuid,
  "has_unread_customer" boolean default false not null,
  "has_unread_admin" boolean default true not null,
  "first_response_at" timestamp with time zone,
  "resolved_at" timestamp with time zone,
  "closed_at" timestamp with time zone,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);
create table if not exists public.system_email_settings (
  "id" uuid default gen_random_uuid() not null,
  "resend_api_key" text not null,
  "sender_email" text not null,
  "sender_name" text not null,
  "reply_to" text,
  "singleton" boolean default true not null,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);
create table if not exists public.team_invites (
  "id" uuid default gen_random_uuid() not null,
  "establishment_id" uuid not null,
  "email" text not null,
  "role" member_role default 'staff'::member_role not null,
  "token" text not null,
  "invited_by" uuid,
  "expires_at" timestamp with time zone default (now() + '7 days'::interval) not null,
  "accepted_at" timestamp with time zone,
  "accepted_by" uuid,
  "revoked_at" timestamp with time zone,
  "created_at" timestamp with time zone default now() not null
);
create table if not exists public.ticket_messages (
  "id" uuid default gen_random_uuid() not null,
  "ticket_id" uuid not null,
  "author_type" ticket_author_type not null,
  "author_user_id" uuid,
  "author_name" text,
  "body" text not null,
  "internal" boolean default false not null,
  "attachments" jsonb default '[]'::jsonb not null,
  "created_at" timestamp with time zone default now() not null
);
create table if not exists public.ticket_quick_replies (
  "id" uuid default gen_random_uuid() not null,
  "establishment_id" uuid not null,
  "shortcut" text not null,
  "title" text not null,
  "body" text not null,
  "created_at" timestamp with time zone default now() not null
);
create table if not exists public.tickets (
  "id" uuid default gen_random_uuid() not null,
  "establishment_id" uuid not null,
  "number" integer default nextval('tickets_number_seq'::regclass) not null,
  "subject" text not null,
  "status" ticket_status default 'open'::ticket_status not null,
  "priority" ticket_priority default 'normal'::ticket_priority not null,
  "channel" ticket_channel default 'form'::ticket_channel not null,
  "tags" text[] default '{}'::text[] not null,
  "requester_user_id" uuid,
  "requester_email" text not null,
  "requester_name" text,
  "assigned_to" uuid,
  "first_response_at" timestamp with time zone,
  "solved_at" timestamp with time zone,
  "due_first_response_at" timestamp with time zone,
  "due_resolution_at" timestamp with time zone,
  "csat" integer,
  "csat_comment" text,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);
create table if not exists public.user_notifications (
  "id" uuid default gen_random_uuid() not null,
  "user_id" uuid,
  "customer_id" uuid,
  "establishment_id" uuid,
  "push_log_id" uuid,
  "audience" text default 'user'::text not null,
  "kind" text default 'aviso'::text not null,
  "title" text not null,
  "body" text,
  "url" text,
  "read_at" timestamp with time zone,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);
create table if not exists public.wallet_pass_devices (
  "id" uuid default gen_random_uuid() not null,
  "pass_id" uuid not null,
  "device_library_identifier" text not null,
  "push_token" text not null,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);
create table if not exists public.wallet_passes (
  "id" uuid default gen_random_uuid() not null,
  "establishment_id" uuid not null,
  "customer_id" uuid not null,
  "card_id" uuid,
  "platform" text not null,
  "serial_number" text not null,
  "auth_token" text default encode(extensions.gen_random_bytes(24), 'hex'::text) not null,
  "google_object_id" text,
  "google_class_id" text,
  "status" text default 'active'::text not null,
  "last_synced_at" timestamp with time zone,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);
create table if not exists public.wallet_settings (
  "establishment_id" uuid not null,
  "google_enabled" boolean default true not null,
  "apple_enabled" boolean default true not null,
  "logo_url" text,
  "hero_image_url" text,
  "background_color" text default '#5B21B6'::text not null,
  "foreground_color" text default '#FFFFFF'::text not null,
  "label_color" text default '#E9D5FF'::text not null,
  "front_text" text,
  "back_text" text,
  "custom_message" text,
  "show_qr" boolean default true not null,
  "show_barcode" boolean default false not null,
  "barcode_format" text default 'QR_CODE'::text not null,
  "fields" jsonb default '{"code": true, "tier": true, "expiry": true, "points": true, "reward": true, "stamps": true, "contact": true, "customer": true}'::jsonb not null,
  "validity_days" integer,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);
create table if not exists public.webhook_deliveries (
  "id" uuid default gen_random_uuid() not null,
  "webhook_id" uuid not null,
  "event" text not null,
  "status_code" integer,
  "ok" boolean default false not null,
  "payload" jsonb,
  "response" text,
  "attempted_at" timestamp with time zone default now() not null
);
create table if not exists public.webhooks (
  "id" uuid default gen_random_uuid() not null,
  "establishment_id" uuid not null,
  "name" text not null,
  "url" text not null,
  "secret" text not null,
  "events" text[] default ARRAY[]::text[] not null,
  "active" boolean default true not null,
  "created_by" uuid,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);

-- ---------------------------------------------------------------------
-- 3. CONSTRAINTS (PK, UNIQUE, CHECK, FK)
-- ---------------------------------------------------------------------
-- pk/unique/check
alter table public.achievements add constraint achievements_code_key UNIQUE (code);
alter table public.achievements add constraint achievements_criteria_type_check CHECK ((criteria_type = ANY (ARRAY['stamps_total'::text, 'rewards_total'::text, 'establishments_total'::text, 'tier_reached'::text, 'weekly_streak'::text, 'first_stamp'::text, 'first_reward'::text, 'referrals_total'::text])));
alter table public.achievements add constraint achievements_pkey PRIMARY KEY (id);
alter table public.achievements add constraint achievements_rarity_check CHECK ((rarity = ANY (ARRAY['common'::text, 'rare'::text, 'epic'::text, 'legendary'::text])));
alter table public.ai_analyses add constraint ai_analyses_overall_score_check CHECK (((overall_score >= 0) AND (overall_score <= 100)));
alter table public.ai_analyses add constraint ai_analyses_pkey PRIMARY KEY (id);
alter table public.ai_analyses add constraint ai_analyses_surface_check CHECK ((surface = ANY (ARRAY['menu'::text, 'catalog'::text])));
alter table public.ai_findings_state add constraint ai_findings_state_analysis_id_finding_key_key UNIQUE (analysis_id, finding_key);
alter table public.ai_findings_state add constraint ai_findings_state_pkey PRIMARY KEY (id);
alter table public.ai_findings_state add constraint ai_findings_state_status_check CHECK ((status = ANY (ARRAY['open'::text, 'applied'::text, 'ignored'::text, 'edited'::text])));
alter table public.ai_usage add constraint ai_usage_kind_check CHECK ((kind = ANY (ARRAY['analysis'::text, 'import'::text, 'describe'::text, 'combo'::text, 'image'::text])));
alter table public.ai_usage add constraint ai_usage_pkey PRIMARY KEY (id);
alter table public.ai_usage add constraint ai_usage_surface_check CHECK ((surface = ANY (ARRAY['menu'::text, 'catalog'::text])));
alter table public.api_keys add constraint api_keys_pkey PRIMARY KEY (id);
alter table public.app_engagement_events add constraint app_engagement_events_audience_check CHECK ((audience = ANY (ARRAY['merchant'::text, 'customer'::text])));
alter table public.app_engagement_events add constraint app_engagement_events_event_type_check CHECK ((event_type = ANY (ARRAY['install_prompt_shown'::text, 'install_accepted'::text, 'install_dismissed'::text, 'install_manual_guide'::text, 'push_enabled'::text, 'push_denied'::text, 'push_blocked'::text, 'push_dismissed'::text, 'push_disabled'::text, 'push_failed'::text])));
alter table public.app_engagement_events add constraint app_engagement_events_pkey PRIMARY KEY (id);
alter table public.app_roles add constraint app_roles_pkey PRIMARY KEY (id);
alter table public.app_roles add constraint app_roles_user_id_role_key UNIQUE (user_id, role);
alter table public.audit_logs add constraint audit_logs_pkey PRIMARY KEY (id);
alter table public.auth_attempts add constraint auth_attempts_pkey PRIMARY KEY (id);
alter table public.campaigns add constraint campaigns_pkey PRIMARY KEY (id);
alter table public.campaigns add constraint campaigns_stamps_required_check CHECK (((stamps_required >= 2) AND (stamps_required <= 50)));
alter table public.channel_events add constraint channel_events_channel_check CHECK ((channel = ANY (ARRAY['linktree'::text, 'reviews'::text, 'loyalty'::text, 'qr'::text, 'menu'::text, 'catalog'::text])));
alter table public.channel_events add constraint channel_events_event_type_check CHECK ((event_type = ANY (ARRAY['page_view'::text, 'link_click'::text, 'qr_scan'::text])));
alter table public.channel_events add constraint channel_events_pkey PRIMARY KEY (id);
alter table public.consents add constraint consents_pkey PRIMARY KEY (id);
alter table public.coupons add constraint coupons_code_key UNIQUE (code);
alter table public.coupons add constraint coupons_pkey PRIMARY KEY (id);
alter table public.customer_achievements add constraint customer_achievements_pkey PRIMARY KEY (id);
alter table public.customer_achievements add constraint customer_achievements_user_id_achievement_code_key UNIQUE (user_id, achievement_code);
alter table public.customer_reviews add constraint customer_reviews_pkey PRIMARY KEY (id);
alter table public.customer_reviews add constraint customer_reviews_rating_check CHECK (((rating >= 1) AND (rating <= 5)));
alter table public.customers add constraint customers_establishment_id_code_key UNIQUE (establishment_id, code);
alter table public.customers add constraint customers_establishment_id_phone_key UNIQUE (establishment_id, phone);
alter table public.customers add constraint customers_pkey PRIMARY KEY (id);
alter table public.data_requests add constraint data_requests_kind_check CHECK ((kind = ANY (ARRAY['export'::text, 'delete'::text])));
alter table public.data_requests add constraint data_requests_pkey PRIMARY KEY (id);
alter table public.data_requests add constraint data_requests_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'processing'::text, 'done'::text, 'failed'::text])));
alter table public.email_logs add constraint email_logs_pkey PRIMARY KEY (id);
alter table public.email_logs add constraint email_logs_status_check CHECK ((status = ANY (ARRAY['sent'::text, 'failed'::text, 'test'::text])));
alter table public.email_queue add constraint email_queue_pkey PRIMARY KEY (id);
alter table public.email_queue add constraint email_queue_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'processing'::text, 'sent'::text, 'failed'::text])));
alter table public.email_templates add constraint email_templates_pkey PRIMARY KEY (id);
alter table public.email_templates add constraint email_templates_slug_key UNIQUE (slug);
alter table public.establishment_feature_overrides add constraint establishment_feature_override_establishment_id_feature_key_key UNIQUE (establishment_id, feature_key);
alter table public.establishment_feature_overrides add constraint establishment_feature_overrides_pkey PRIMARY KEY (id);
alter table public.establishment_goals add constraint establishment_goals_establishment_id_month_key UNIQUE (establishment_id, month);
alter table public.establishment_goals add constraint establishment_goals_pkey PRIMARY KEY (id);
alter table public.establishment_members add constraint establishment_members_establishment_id_user_id_key UNIQUE (establishment_id, user_id);
alter table public.establishment_members add constraint establishment_members_pkey PRIMARY KEY (id);
alter table public.establishment_settings add constraint establishment_settings_pkey PRIMARY KEY (establishment_id);
alter table public.establishments add constraint establishments_pkey PRIMARY KEY (id);
alter table public.establishments add constraint establishments_qr_destination_check CHECK ((qr_destination = ANY (ARRAY['reviews'::text, 'linktree'::text, 'landing'::text, 'menu'::text, 'catalog'::text])));
alter table public.establishments add constraint establishments_slug_key UNIQUE (slug);
alter table public.feature_gate_events add constraint feature_gate_events_pkey PRIMARY KEY (id);
alter table public.help_article_views add constraint help_article_views_pkey PRIMARY KEY (id);
alter table public.help_articles add constraint help_articles_category_id_slug_key UNIQUE (category_id, slug);
alter table public.help_articles add constraint help_articles_pkey PRIMARY KEY (id);
alter table public.help_categories add constraint help_categories_pkey PRIMARY KEY (id);
alter table public.help_categories add constraint help_categories_slug_key UNIQUE (slug);
alter table public.help_feedback add constraint help_feedback_pkey PRIMARY KEY (id);
alter table public.helpdesk_members add constraint helpdesk_members_establishment_id_user_id_key UNIQUE (establishment_id, user_id);
alter table public.helpdesk_members add constraint helpdesk_members_pkey PRIMARY KEY (id);
alter table public.integrations add constraint integrations_category_check CHECK ((category = ANY (ARRAY['ai'::text, 'payments'::text, 'email'::text, 'sms'::text, 'storage'::text, 'marketing'::text, 'analytics'::text, 'other'::text])));
alter table public.integrations add constraint integrations_category_provider_unique UNIQUE (category, provider);
alter table public.integrations add constraint integrations_mode_check CHECK (((mode IS NULL) OR (mode = ANY (ARRAY['sandbox'::text, 'production'::text]))));
alter table public.integrations add constraint integrations_pkey PRIMARY KEY (id);
alter table public.kb_articles add constraint kb_articles_establishment_id_slug_key UNIQUE (establishment_id, slug);
alter table public.kb_articles add constraint kb_articles_pkey PRIMARY KEY (id);
alter table public.kb_categories add constraint kb_categories_establishment_id_slug_key UNIQUE (establishment_id, slug);
alter table public.kb_categories add constraint kb_categories_pkey PRIMARY KEY (id);
alter table public.kb_feedback add constraint kb_feedback_pkey PRIMARY KEY (id);
alter table public.landing_content add constraint landing_content_pkey PRIMARY KEY (key);
alter table public.link_tree_links add constraint link_tree_links_pkey PRIMARY KEY (id);
alter table public.link_tree_pages add constraint link_tree_pages_establishment_id_key UNIQUE (establishment_id);
alter table public.link_tree_pages add constraint link_tree_pages_pkey PRIMARY KEY (id);
alter table public.log_purge_runs add constraint log_purge_runs_pkey PRIMARY KEY (id);
alter table public.log_retention_policies add constraint log_retention_policies_pkey PRIMARY KEY (table_name);
alter table public.log_retention_policies add constraint log_retention_policies_retention_days_check CHECK ((retention_days > 0));
alter table public.loyalty_cards add constraint loyalty_cards_customer_id_campaign_id_key UNIQUE (customer_id, campaign_id);
alter table public.loyalty_cards add constraint loyalty_cards_pkey PRIMARY KEY (id);
alter table public.member_permissions add constraint member_permissions_pkey PRIMARY KEY (member_id);
alter table public.menu_categories add constraint menu_categories_pkey PRIMARY KEY (id);
alter table public.menu_item_favorites add constraint menu_item_favorites_item_id_user_id_key UNIQUE (item_id, user_id);
alter table public.menu_item_favorites add constraint menu_item_favorites_pkey PRIMARY KEY (id);
alter table public.menu_item_media add constraint menu_item_media_pkey PRIMARY KEY (id);
alter table public.menu_items add constraint menu_items_pkey PRIMARY KEY (id);
alter table public.menu_items add constraint menu_items_stock_status_chk CHECK ((stock_status = ANY (ARRAY['in_stock'::text, 'made_to_order'::text, 'out_of_stock'::text])));
alter table public.menu_publish_events add constraint menu_publish_events_pkey PRIMARY KEY (id);
alter table public.menu_qr_designs add constraint menu_qr_designs_pkey PRIMARY KEY (id);
alter table public.merchant_message_reads add constraint merchant_message_reads_pkey PRIMARY KEY (message_id, user_id);
alter table public.merchant_messages add constraint merchant_messages_body_check CHECK (((char_length(body) >= 3) AND (char_length(body) <= 2000)));
alter table public.merchant_messages add constraint merchant_messages_kind_check CHECK ((kind = ANY (ARRAY['promo'::text, 'novidade'::text, 'aviso'::text])));
alter table public.merchant_messages add constraint merchant_messages_pkey PRIMARY KEY (id);
alter table public.merchant_messages add constraint merchant_messages_source_check CHECK ((source = ANY (ARRAY['manual'::text, 'push'::text, 'system'::text])));
alter table public.merchant_messages add constraint merchant_messages_title_check CHECK (((char_length(title) >= 3) AND (char_length(title) <= 120)));
alter table public.notification_templates add constraint notification_templates_establishment_id_event_channel_key UNIQUE (establishment_id, event, channel);
alter table public.notification_templates add constraint notification_templates_pkey PRIMARY KEY (id);
alter table public.order_items add constraint order_items_pkey PRIMARY KEY (id);
alter table public.orders add constraint orders_pkey PRIMARY KEY (id);
alter table public.payment_logs add constraint payment_logs_pkey PRIMARY KEY (id);
alter table public.payment_provider_credentials add constraint payment_provider_credentials_environment_check CHECK ((environment = ANY (ARRAY['sandbox'::text, 'production'::text])));
alter table public.payment_provider_credentials add constraint payment_provider_credentials_establishment_id_provider_key UNIQUE (establishment_id, provider);
alter table public.payment_provider_credentials add constraint payment_provider_credentials_pkey PRIMARY KEY (id);
alter table public.payment_provider_credentials add constraint payment_provider_credentials_provider_check CHECK ((provider = ANY (ARRAY['asaas'::text, 'mercadopago'::text, 'paghiper'::text, 'stripe'::text])));
alter table public.payment_settings add constraint payment_settings_environment_check CHECK ((environment = ANY (ARRAY['sandbox'::text, 'production'::text])));
alter table public.payment_settings add constraint payment_settings_pkey PRIMARY KEY (id);
alter table public.payments add constraint payments_method_check CHECK ((method = ANY (ARRAY['pix'::text, 'credit_card'::text, 'boleto'::text])));
alter table public.payments add constraint payments_mp_payment_id_key UNIQUE (mp_payment_id);
alter table public.payments add constraint payments_pkey PRIMARY KEY (id);
alter table public.payments add constraint payments_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'in_process'::text, 'approved'::text, 'authorized'::text, 'rejected'::text, 'cancelled'::text, 'refunded'::text, 'charged_back'::text])));
alter table public.pixel_events add constraint pixel_events_pkey PRIMARY KEY (id);
alter table public.plan_features add constraint plan_features_pkey PRIMARY KEY (id);
alter table public.plan_features add constraint plan_features_plan_id_feature_key_key UNIQUE (plan_id, feature_key);
alter table public.plan_funnel_events add constraint plan_funnel_events_pkey PRIMARY KEY (id);
alter table public.plan_funnel_events add constraint plan_funnel_events_stage_check CHECK ((stage = ANY (ARRAY['landing_select'::text, 'auth_intent'::text, 'checkout_open'::text, 'checkout_mismatch'::text])));
alter table public.plans add constraint plans_pkey PRIMARY KEY (id);
alter table public.plans add constraint plans_tier_key UNIQUE (tier);
alter table public.poster_designs add constraint poster_designs_pkey PRIMARY KEY (id);
alter table public.print_orders add constraint print_orders_order_number_key UNIQUE (order_number);
alter table public.print_orders add constraint print_orders_pkey PRIMARY KEY (id);
alter table public.print_orders add constraint print_orders_quantity_check CHECK (((quantity > 0) AND (quantity <= 10000)));
alter table public.print_orders add constraint print_orders_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'processing'::text, 'shipped'::text, 'delivered'::text, 'cancelled'::text])));
alter table public.profiles add constraint profiles_pkey PRIMARY KEY (id);
alter table public.profiles_account_type_backup add constraint profiles_account_type_backup_pkey PRIMARY KEY (id);
alter table public.promotions add constraint promotions_links_max_10 CHECK ((jsonb_array_length(external_links) <= 10));
alter table public.promotions add constraint promotions_media_max_5 CHECK ((jsonb_array_length(media) <= 5));
alter table public.promotions add constraint promotions_pkey PRIMARY KEY (id);
alter table public.promotions add constraint promotions_title_len CHECK (((char_length(title) >= 1) AND (char_length(title) <= 120)));
alter table public.push_events add constraint push_events_pkey PRIMARY KEY (id);
alter table public.push_logs add constraint push_logs_pkey PRIMARY KEY (id);
alter table public.push_logs add constraint push_logs_status_check CHECK ((status = ANY (ARRAY['sent'::text, 'failed'::text, 'expired'::text])));
alter table public.push_subscriptions add constraint push_subscriptions_owner_chk CHECK (((customer_id IS NOT NULL) OR (user_id IS NOT NULL)));
alter table public.push_subscriptions add constraint push_subscriptions_pkey PRIMARY KEY (id);
alter table public.qr_scans add constraint qr_scans_dest_check CHECK ((dest = ANY (ARRAY['main'::text, 'second'::text])));
alter table public.qr_scans add constraint qr_scans_pkey PRIMARY KEY (id);
alter table public.qr_tags add constraint qr_tags_code_format CHECK ((code ~ '^[a-z0-9]{4,16}$'::text));
alter table public.qr_tags add constraint qr_tags_code_key UNIQUE (code);
alter table public.qr_tags add constraint qr_tags_destination_check CHECK ((destination = ANY (ARRAY['reviews'::text, 'linktree'::text, 'landing'::text, 'menu'::text])));
alter table public.qr_tags add constraint qr_tags_label_len CHECK (((char_length(label) >= 1) AND (char_length(label) <= 80)));
alter table public.qr_tags add constraint qr_tags_location_len CHECK (((location IS NULL) OR (char_length(location) <= 80)));
alter table public.qr_tags add constraint qr_tags_pkey PRIMARY KEY (id);
alter table public.restaurant_menus add constraint restaurant_menus_pkey PRIMARY KEY (id);
alter table public.retention_dispatches add constraint retention_dispatches_channel_check CHECK ((channel = ANY (ARRAY['email'::text, 'push'::text, 'both'::text])));
alter table public.retention_dispatches add constraint retention_dispatches_kind_check CHECK ((kind = ANY (ARRAY['birthday'::text, 'reengagement'::text, 'reward_expiring'::text, 'tier_up'::text, 'broadcast'::text])));
alter table public.retention_dispatches add constraint retention_dispatches_pkey PRIMARY KEY (id);
alter table public.retention_dispatches add constraint retention_dispatches_status_check CHECK ((status = ANY (ARRAY['sent'::text, 'failed'::text, 'skipped'::text])));
alter table public.retention_events add constraint retention_events_event_type_check CHECK ((event_type = ANY (ARRAY['tier_up'::text, 'tier_down'::text, 'referral_click'::text, 'referral_share'::text, 'referral_signup'::text, 'referral_reward'::text, 'birthday_sent'::text, 'reengagement_sent'::text])));
alter table public.retention_events add constraint retention_events_pkey PRIMARY KEY (id);
alter table public.retention_settings add constraint retention_settings_birthday_coupon_percent_check CHECK (((birthday_coupon_percent >= 0) AND (birthday_coupon_percent <= 100)));
alter table public.retention_settings add constraint retention_settings_pkey PRIMARY KEY (establishment_id);
alter table public.retention_settings add constraint retention_settings_reengagement_days_check CHECK (((reengagement_days >= 7) AND (reengagement_days <= 365)));
alter table public.retention_settings add constraint retention_settings_referral_bonus_stamps_check CHECK (((referral_bonus_stamps >= 0) AND (referral_bonus_stamps <= 5)));
alter table public.review_answers add constraint review_answers_pkey PRIMARY KEY (id);
alter table public.review_events add constraint review_events_pkey PRIMARY KEY (id);
alter table public.review_forms add constraint review_forms_cooldown_hours_check CHECK (((cooldown_hours >= 0) AND (cooldown_hours <= 720)));
alter table public.review_forms add constraint review_forms_establishment_id_key UNIQUE (establishment_id);
alter table public.review_forms add constraint review_forms_pkey PRIMARY KEY (id);
alter table public.review_questions add constraint review_questions_pkey PRIMARY KEY (id);
alter table public.review_rating_options add constraint review_rating_options_pkey PRIMARY KEY (id);
alter table public.review_rating_options add constraint review_rating_options_rating_check CHECK (((rating >= 1) AND (rating <= 5)));
alter table public.review_rating_options add constraint review_rating_options_review_form_id_rating_key UNIQUE (review_form_id, rating);
alter table public.review_settings add constraint review_settings_establishment_id_key UNIQUE (establishment_id);
alter table public.review_settings add constraint review_settings_google_redirect_min_rating_check CHECK (((google_redirect_min_rating >= 1) AND (google_redirect_min_rating <= 5)));
alter table public.review_settings add constraint review_settings_pkey PRIMARY KEY (id);
alter table public.reviews add constraint reviews_nps_check CHECK (((nps >= 0) AND (nps <= 10)));
alter table public.reviews add constraint reviews_pkey PRIMARY KEY (id);
alter table public.reviews add constraint reviews_rating_check CHECK (((rating >= 1) AND (rating <= 5)));
alter table public.rewards add constraint rewards_pkey PRIMARY KEY (id);
alter table public.scheduled_pushes add constraint scheduled_pushes_pkey PRIMARY KEY (id);
alter table public.scheduled_pushes add constraint scheduled_pushes_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'sent'::text, 'canceled'::text, 'failed'::text])));
alter table public.sponsored_ad_campaigns add constraint sponsored_ad_campaigns_category_id_check CHECK ((category_id = ANY (ARRAY['alimentacao'::text, 'beleza'::text, 'saude'::text, 'moda'::text, 'fitness'::text, 'pet'::text, 'servicos'::text, 'lazer'::text, 'outros'::text])));
alter table public.sponsored_ad_campaigns add constraint sponsored_ad_campaigns_cta_label_check CHECK ((cta_label = ANY (ARRAY['Conhecer estabelecimento'::text, 'Ver oferta'::text, 'Ver catálogo'::text, 'Ver cardápio'::text, 'Ver benefícios'::text, 'Saiba mais'::text])));
alter table public.sponsored_ad_campaigns add constraint sponsored_ad_campaigns_description_check CHECK ((char_length(description) <= 140));
alter table public.sponsored_ad_campaigns add constraint sponsored_ad_campaigns_destination_type_check CHECK ((destination_type = ANY (ARRAY['establishment'::text, 'catalog'::text, 'menu'::text, 'linktree'::text, 'loyalty_card'::text])));
alter table public.sponsored_ad_campaigns add constraint sponsored_ad_campaigns_image_source_check CHECK ((image_source = ANY (ARRAY['upload'::text, 'logo'::text, 'cover'::text])));
alter table public.sponsored_ad_campaigns add constraint sponsored_ad_campaigns_pkey PRIMARY KEY (id);
alter table public.sponsored_ad_campaigns add constraint sponsored_ad_campaigns_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'pending_review'::text, 'changes_requested'::text, 'approved_awaiting_payment'::text, 'payment_pending'::text, 'payment_confirmed'::text, 'scheduled'::text, 'active'::text, 'paused'::text, 'expired'::text, 'rejected'::text, 'cancelled'::text, 'refund_pending'::text, 'refunded'::text])));
alter table public.sponsored_ad_campaigns add constraint sponsored_ad_campaigns_title_check CHECK ((char_length(title) <= 60));
alter table public.sponsored_ad_campaigns add constraint sponsored_ad_campaigns_tracking_token_key UNIQUE (tracking_token);
alter table public.sponsored_ad_daily_metrics add constraint sponsored_ad_daily_metrics_pkey PRIMARY KEY (id);
alter table public.sponsored_ad_daily_metrics add constraint sponsored_ad_daily_metrics_uk UNIQUE (campaign_id, metric_date);
alter table public.sponsored_ad_events add constraint sponsored_ad_events_dedupe_uk UNIQUE (campaign_id, event_type, session_hash, dedupe_bucket);
alter table public.sponsored_ad_events add constraint sponsored_ad_events_event_type_check CHECK ((event_type = ANY (ARRAY['impression'::text, 'click'::text])));
alter table public.sponsored_ad_events add constraint sponsored_ad_events_pkey PRIMARY KEY (id);
alter table public.sponsored_ad_orders add constraint sponsored_ad_orders_amount_cents_check CHECK ((amount_cents >= 0));
alter table public.sponsored_ad_orders add constraint sponsored_ad_orders_gateway_check CHECK ((gateway = ANY (ARRAY['mercadopago'::text, 'asaas'::text])));
alter table public.sponsored_ad_orders add constraint sponsored_ad_orders_idempotency_key_key UNIQUE (idempotency_key);
alter table public.sponsored_ad_orders add constraint sponsored_ad_orders_payment_method_check CHECK ((payment_method = 'pix'::text));
alter table public.sponsored_ad_orders add constraint sponsored_ad_orders_pkey PRIMARY KEY (id);
alter table public.sponsored_ad_orders add constraint sponsored_ad_orders_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'paid'::text, 'expired'::text, 'cancelled'::text, 'refunded'::text, 'failed'::text])));
alter table public.sponsored_ad_packages add constraint sponsored_ad_packages_duration_days_check CHECK (((duration_days > 0) AND (duration_days <= 365)));
alter table public.sponsored_ad_packages add constraint sponsored_ad_packages_pkey PRIMARY KEY (id);
alter table public.sponsored_ad_packages add constraint sponsored_ad_packages_price_cents_check CHECK ((price_cents >= 0));
alter table public.sponsored_ad_reviews add constraint sponsored_ad_reviews_pkey PRIMARY KEY (id);
alter table public.sponsored_ad_settings add constraint sponsored_ad_settings_click_dedupe_minutes_check CHECK (((click_dedupe_minutes >= 1) AND (click_dedupe_minutes <= 1440)));
alter table public.sponsored_ad_settings add constraint sponsored_ad_settings_default_gateway_check CHECK ((default_gateway = ANY (ARRAY['mercadopago'::text, 'asaas'::text])));
alter table public.sponsored_ad_settings add constraint sponsored_ad_settings_id_check CHECK (id);
alter table public.sponsored_ad_settings add constraint sponsored_ad_settings_impression_dedupe_minutes_check CHECK (((impression_dedupe_minutes >= 1) AND (impression_dedupe_minutes <= 1440)));
alter table public.sponsored_ad_settings add constraint sponsored_ad_settings_max_ads_per_category_check CHECK (((max_ads_per_category >= 1) AND (max_ads_per_category <= 10)));
alter table public.sponsored_ad_settings add constraint sponsored_ad_settings_max_impressions_per_session_24h_check CHECK (((max_impressions_per_session_24h >= 1) AND (max_impressions_per_session_24h <= 50)));
alter table public.sponsored_ad_settings add constraint sponsored_ad_settings_pix_expiration_minutes_check CHECK (((pix_expiration_minutes >= 5) AND (pix_expiration_minutes <= 1440)));
alter table public.sponsored_ad_settings add constraint sponsored_ad_settings_pkey PRIMARY KEY (id);
alter table public.stamps add constraint stamps_pkey PRIMARY KEY (id);
alter table public.subscription_events add constraint subscription_events_event_type_check CHECK ((event_type = ANY (ARRAY['upgrade'::text, 'downgrade'::text, 'cancel'::text, 'reactivate'::text, 'payment_failed'::text, 'plan_change'::text])));
alter table public.subscription_events add constraint subscription_events_pkey PRIMARY KEY (id);
alter table public.subscriptions add constraint subscriptions_establishment_id_key UNIQUE (establishment_id);
alter table public.subscriptions add constraint subscriptions_pkey PRIMARY KEY (id);
alter table public.subscriptions add constraint subscriptions_status_check CHECK ((status = ANY (ARRAY['trial'::text, 'trialing'::text, 'active'::text, 'pending'::text, 'awaiting_payment'::text, 'past_due'::text, 'cancelled'::text, 'suspended'::text, 'incomplete'::text])));
alter table public.support_messages add constraint support_messages_pkey PRIMARY KEY (id);
alter table public.support_quick_replies add constraint support_quick_replies_pkey PRIMARY KEY (id);
alter table public.support_status_history add constraint support_status_history_pkey PRIMARY KEY (id);
alter table public.support_tickets add constraint support_tickets_pkey PRIMARY KEY (id);
alter table public.support_tickets add constraint support_tickets_protocol_key UNIQUE (protocol);
alter table public.system_email_settings add constraint system_email_settings_pkey PRIMARY KEY (id);
alter table public.system_email_settings add constraint system_email_settings_singleton_unique UNIQUE (singleton);
alter table public.team_invites add constraint team_invites_pkey PRIMARY KEY (id);
alter table public.team_invites add constraint team_invites_token_key UNIQUE (token);
alter table public.ticket_messages add constraint ticket_messages_pkey PRIMARY KEY (id);
alter table public.ticket_quick_replies add constraint ticket_quick_replies_establishment_id_shortcut_key UNIQUE (establishment_id, shortcut);
alter table public.ticket_quick_replies add constraint ticket_quick_replies_pkey PRIMARY KEY (id);
alter table public.tickets add constraint tickets_pkey PRIMARY KEY (id);
alter table public.user_notifications add constraint user_notifications_audience_check CHECK ((audience = ANY (ARRAY['user'::text, 'customer'::text, 'operator'::text, 'admin'::text])));
alter table public.user_notifications add constraint user_notifications_kind_check CHECK ((kind = ANY (ARRAY['promo'::text, 'novidade'::text, 'aviso'::text, 'push'::text])));
alter table public.user_notifications add constraint user_notifications_owner_chk CHECK (((user_id IS NOT NULL) OR (customer_id IS NOT NULL)));
alter table public.user_notifications add constraint user_notifications_pkey PRIMARY KEY (id);
alter table public.user_notifications add constraint user_notifications_title_check CHECK (((char_length(title) >= 2) AND (char_length(title) <= 120)));
alter table public.wallet_pass_devices add constraint wallet_pass_devices_pass_id_device_library_identifier_key UNIQUE (pass_id, device_library_identifier);
alter table public.wallet_pass_devices add constraint wallet_pass_devices_pkey PRIMARY KEY (id);
alter table public.wallet_passes add constraint wallet_passes_pkey PRIMARY KEY (id);
alter table public.wallet_passes add constraint wallet_passes_platform_check CHECK ((platform = ANY (ARRAY['apple'::text, 'google'::text])));
alter table public.wallet_passes add constraint wallet_passes_platform_serial_number_key UNIQUE (platform, serial_number);
alter table public.wallet_passes add constraint wallet_passes_status_check CHECK ((status = ANY (ARRAY['active'::text, 'revoked'::text, 'expired'::text])));
alter table public.wallet_settings add constraint wallet_settings_pkey PRIMARY KEY (establishment_id);
alter table public.webhook_deliveries add constraint webhook_deliveries_pkey PRIMARY KEY (id);
alter table public.webhooks add constraint webhooks_pkey PRIMARY KEY (id);

-- foreign keys
alter table public.ai_analyses add constraint ai_analyses_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.ai_analyses add constraint ai_analyses_establishment_id_fkey FOREIGN KEY (establishment_id) REFERENCES establishments(id) ON DELETE CASCADE;
alter table public.ai_findings_state add constraint ai_findings_state_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.ai_findings_state add constraint ai_findings_state_analysis_id_fkey FOREIGN KEY (analysis_id) REFERENCES ai_analyses(id) ON DELETE CASCADE;
alter table public.ai_findings_state add constraint ai_findings_state_establishment_id_fkey FOREIGN KEY (establishment_id) REFERENCES establishments(id) ON DELETE CASCADE;
alter table public.ai_usage add constraint ai_usage_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.ai_usage add constraint ai_usage_establishment_id_fkey FOREIGN KEY (establishment_id) REFERENCES establishments(id) ON DELETE CASCADE;
alter table public.api_keys add constraint api_keys_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.api_keys add constraint api_keys_establishment_id_fkey FOREIGN KEY (establishment_id) REFERENCES establishments(id) ON DELETE CASCADE;
alter table public.app_engagement_events add constraint app_engagement_events_establishment_id_fkey FOREIGN KEY (establishment_id) REFERENCES establishments(id) ON DELETE SET NULL;
alter table public.app_roles add constraint app_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.audit_logs add constraint audit_logs_establishment_id_fkey FOREIGN KEY (establishment_id) REFERENCES establishments(id) ON DELETE CASCADE;
alter table public.audit_logs add constraint audit_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.campaigns add constraint campaigns_establishment_id_fkey FOREIGN KEY (establishment_id) REFERENCES establishments(id) ON DELETE CASCADE;
alter table public.channel_events add constraint channel_events_establishment_id_fkey FOREIGN KEY (establishment_id) REFERENCES establishments(id) ON DELETE CASCADE;
alter table public.consents add constraint consents_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE;
alter table public.consents add constraint consents_establishment_id_fkey FOREIGN KEY (establishment_id) REFERENCES establishments(id) ON DELETE CASCADE;
alter table public.coupons add constraint coupons_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.customer_achievements add constraint customer_achievements_achievement_code_fkey FOREIGN KEY (achievement_code) REFERENCES achievements(code) ON DELETE CASCADE;
alter table public.customer_achievements add constraint customer_achievements_establishment_id_fkey FOREIGN KEY (establishment_id) REFERENCES establishments(id) ON DELETE SET NULL;
alter table public.customer_achievements add constraint customer_achievements_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.customer_reviews add constraint customer_reviews_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.customer_reviews add constraint customer_reviews_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL;
alter table public.customer_reviews add constraint customer_reviews_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.customer_reviews add constraint customer_reviews_establishment_id_fkey FOREIGN KEY (establishment_id) REFERENCES establishments(id) ON DELETE CASCADE;
alter table public.customer_reviews add constraint customer_reviews_merchant_reply_by_fkey FOREIGN KEY (merchant_reply_by) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.customer_reviews add constraint customer_reviews_review_form_id_fkey FOREIGN KEY (review_form_id) REFERENCES review_forms(id) ON DELETE CASCADE;
alter table public.customer_reviews add constraint customer_reviews_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE SET NULL;
alter table public.customers add constraint customers_establishment_id_fkey FOREIGN KEY (establishment_id) REFERENCES establishments(id) ON DELETE CASCADE;
alter table public.customers add constraint customers_referred_by_fkey FOREIGN KEY (referred_by) REFERENCES customers(id) ON DELETE SET NULL;
alter table public.customers add constraint customers_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.data_requests add constraint data_requests_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL;
alter table public.data_requests add constraint data_requests_establishment_id_fkey FOREIGN KEY (establishment_id) REFERENCES establishments(id) ON DELETE CASCADE;
alter table public.data_requests add constraint data_requests_requested_by_fkey FOREIGN KEY (requested_by) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.email_templates add constraint email_templates_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.establishment_feature_overrides add constraint establishment_feature_overrides_establishment_id_fkey FOREIGN KEY (establishment_id) REFERENCES establishments(id) ON DELETE CASCADE;
alter table public.establishment_goals add constraint establishment_goals_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.establishment_goals add constraint establishment_goals_establishment_id_fkey FOREIGN KEY (establishment_id) REFERENCES establishments(id) ON DELETE CASCADE;
alter table public.establishment_members add constraint establishment_members_establishment_id_fkey FOREIGN KEY (establishment_id) REFERENCES establishments(id) ON DELETE CASCADE;
alter table public.establishment_members add constraint establishment_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.establishment_settings add constraint establishment_settings_establishment_id_fkey FOREIGN KEY (establishment_id) REFERENCES establishments(id) ON DELETE CASCADE;
alter table public.establishments add constraint establishments_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.feature_gate_events add constraint feature_gate_events_establishment_id_fkey FOREIGN KEY (establishment_id) REFERENCES establishments(id) ON DELETE CASCADE;
alter table public.feature_gate_events add constraint feature_gate_events_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.help_article_views add constraint help_article_views_article_id_fkey FOREIGN KEY (article_id) REFERENCES help_articles(id) ON DELETE CASCADE;
alter table public.help_articles add constraint help_articles_category_id_fkey FOREIGN KEY (category_id) REFERENCES help_categories(id) ON DELETE CASCADE;
alter table public.help_feedback add constraint help_feedback_article_id_fkey FOREIGN KEY (article_id) REFERENCES help_articles(id) ON DELETE CASCADE;
alter table public.helpdesk_members add constraint helpdesk_members_establishment_id_fkey FOREIGN KEY (establishment_id) REFERENCES establishments(id) ON DELETE CASCADE;
alter table public.helpdesk_members add constraint helpdesk_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.integrations add constraint integrations_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.kb_articles add constraint kb_articles_author_id_fkey FOREIGN KEY (author_id) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.kb_articles add constraint kb_articles_category_id_fkey FOREIGN KEY (category_id) REFERENCES kb_categories(id) ON DELETE SET NULL;
alter table public.kb_articles add constraint kb_articles_establishment_id_fkey FOREIGN KEY (establishment_id) REFERENCES establishments(id) ON DELETE CASCADE;
alter table public.kb_categories add constraint kb_categories_establishment_id_fkey FOREIGN KEY (establishment_id) REFERENCES establishments(id) ON DELETE CASCADE;
alter table public.kb_feedback add constraint kb_feedback_article_id_fkey FOREIGN KEY (article_id) REFERENCES kb_articles(id) ON DELETE CASCADE;
alter table public.link_tree_links add constraint link_tree_links_page_id_fkey FOREIGN KEY (page_id) REFERENCES link_tree_pages(id) ON DELETE CASCADE;
alter table public.link_tree_pages add constraint link_tree_pages_establishment_id_fkey FOREIGN KEY (establishment_id) REFERENCES establishments(id) ON DELETE CASCADE;
alter table public.loyalty_cards add constraint loyalty_cards_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE;
alter table public.loyalty_cards add constraint loyalty_cards_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE;
alter table public.loyalty_cards add constraint loyalty_cards_establishment_id_fkey FOREIGN KEY (establishment_id) REFERENCES establishments(id) ON DELETE CASCADE;
alter table public.member_permissions add constraint member_permissions_establishment_id_fkey FOREIGN KEY (establishment_id) REFERENCES establishments(id) ON DELETE CASCADE;
alter table public.member_permissions add constraint member_permissions_member_id_fkey FOREIGN KEY (member_id) REFERENCES establishment_members(id) ON DELETE CASCADE;
alter table public.menu_categories add constraint menu_categories_establishment_id_fkey FOREIGN KEY (establishment_id) REFERENCES establishments(id) ON DELETE CASCADE;
alter table public.menu_categories add constraint menu_categories_menu_id_fkey FOREIGN KEY (menu_id) REFERENCES restaurant_menus(id) ON DELETE CASCADE;
alter table public.menu_item_favorites add constraint menu_item_favorites_item_id_fkey FOREIGN KEY (item_id) REFERENCES menu_items(id) ON DELETE CASCADE;
alter table public.menu_item_favorites add constraint menu_item_favorites_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.menu_item_media add constraint menu_item_media_establishment_id_fkey FOREIGN KEY (establishment_id) REFERENCES establishments(id) ON DELETE CASCADE;
alter table public.menu_item_media add constraint menu_item_media_item_id_fkey FOREIGN KEY (item_id) REFERENCES menu_items(id) ON DELETE CASCADE;
alter table public.menu_items add constraint menu_items_category_id_fkey FOREIGN KEY (category_id) REFERENCES menu_categories(id) ON DELETE SET NULL;
alter table public.menu_items add constraint menu_items_establishment_id_fkey FOREIGN KEY (establishment_id) REFERENCES establishments(id) ON DELETE CASCADE;
alter table public.menu_items add constraint menu_items_menu_id_fkey FOREIGN KEY (menu_id) REFERENCES restaurant_menus(id) ON DELETE CASCADE;
alter table public.menu_publish_events add constraint menu_publish_events_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.menu_publish_events add constraint menu_publish_events_establishment_id_fkey FOREIGN KEY (establishment_id) REFERENCES establishments(id) ON DELETE CASCADE;
alter table public.menu_publish_events add constraint menu_publish_events_menu_id_fkey FOREIGN KEY (menu_id) REFERENCES restaurant_menus(id) ON DELETE CASCADE;
alter table public.menu_qr_designs add constraint menu_qr_designs_establishment_id_fkey FOREIGN KEY (establishment_id) REFERENCES establishments(id) ON DELETE CASCADE;
alter table public.menu_qr_designs add constraint menu_qr_designs_menu_id_fkey FOREIGN KEY (menu_id) REFERENCES restaurant_menus(id) ON DELETE CASCADE;
alter table public.merchant_message_reads add constraint merchant_message_reads_message_id_fkey FOREIGN KEY (message_id) REFERENCES merchant_messages(id) ON DELETE CASCADE;
alter table public.merchant_message_reads add constraint merchant_message_reads_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.merchant_messages add constraint merchant_messages_author_id_fkey FOREIGN KEY (author_id) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.merchant_messages add constraint merchant_messages_establishment_id_fkey FOREIGN KEY (establishment_id) REFERENCES establishments(id) ON DELETE CASCADE;
alter table public.merchant_messages add constraint merchant_messages_push_log_id_fkey FOREIGN KEY (push_log_id) REFERENCES push_logs(id) ON DELETE SET NULL;
alter table public.notification_templates add constraint notification_templates_establishment_id_fkey FOREIGN KEY (establishment_id) REFERENCES establishments(id) ON DELETE CASCADE;
alter table public.order_items add constraint order_items_item_id_fkey FOREIGN KEY (item_id) REFERENCES menu_items(id) ON DELETE SET NULL;
alter table public.order_items add constraint order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE;
alter table public.orders add constraint orders_establishment_id_fkey FOREIGN KEY (establishment_id) REFERENCES establishments(id) ON DELETE CASCADE;
alter table public.orders add constraint orders_menu_id_fkey FOREIGN KEY (menu_id) REFERENCES restaurant_menus(id) ON DELETE SET NULL;
alter table public.payment_provider_credentials add constraint payment_provider_credentials_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.payment_provider_credentials add constraint payment_provider_credentials_establishment_id_fkey FOREIGN KEY (establishment_id) REFERENCES establishments(id) ON DELETE CASCADE;
alter table public.payments add constraint payments_establishment_id_fkey FOREIGN KEY (establishment_id) REFERENCES establishments(id) ON DELETE CASCADE;
alter table public.payments add constraint payments_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES plans(id) ON DELETE SET NULL;
alter table public.payments add constraint payments_subscription_id_fkey FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE SET NULL;
alter table public.plan_features add constraint plan_features_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES plans(id) ON DELETE CASCADE;
alter table public.poster_designs add constraint poster_designs_applied_by_fkey FOREIGN KEY (applied_by) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.poster_designs add constraint poster_designs_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.poster_designs add constraint poster_designs_establishment_id_fkey FOREIGN KEY (establishment_id) REFERENCES establishments(id) ON DELETE CASCADE;
alter table public.print_orders add constraint print_orders_establishment_id_fkey FOREIGN KEY (establishment_id) REFERENCES establishments(id) ON DELETE CASCADE;
alter table public.print_orders add constraint print_orders_requested_by_fkey FOREIGN KEY (requested_by) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.profiles add constraint profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.promotions add constraint promotions_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.promotions add constraint promotions_establishment_id_fkey FOREIGN KEY (establishment_id) REFERENCES establishments(id) ON DELETE CASCADE;
alter table public.push_events add constraint push_events_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL;
alter table public.push_events add constraint push_events_establishment_id_fkey FOREIGN KEY (establishment_id) REFERENCES establishments(id) ON DELETE SET NULL;
alter table public.push_events add constraint push_events_subscription_id_fkey FOREIGN KEY (subscription_id) REFERENCES push_subscriptions(id) ON DELETE SET NULL;
alter table public.push_events add constraint push_events_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.push_logs add constraint push_logs_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL;
alter table public.push_logs add constraint push_logs_establishment_id_fkey FOREIGN KEY (establishment_id) REFERENCES establishments(id) ON DELETE CASCADE;
alter table public.push_logs add constraint push_logs_subscription_id_fkey FOREIGN KEY (subscription_id) REFERENCES push_subscriptions(id) ON DELETE SET NULL;
alter table public.push_subscriptions add constraint push_subscriptions_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE;
alter table public.push_subscriptions add constraint push_subscriptions_establishment_id_fkey FOREIGN KEY (establishment_id) REFERENCES establishments(id) ON DELETE CASCADE;
alter table public.push_subscriptions add constraint push_subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.qr_scans add constraint qr_scans_establishment_id_fkey FOREIGN KEY (establishment_id) REFERENCES establishments(id) ON DELETE CASCADE;
alter table public.qr_tags add constraint qr_tags_establishment_id_fkey FOREIGN KEY (establishment_id) REFERENCES establishments(id) ON DELETE CASCADE;
alter table public.restaurant_menus add constraint restaurant_menus_establishment_id_fkey FOREIGN KEY (establishment_id) REFERENCES establishments(id) ON DELETE CASCADE;
alter table public.retention_dispatches add constraint retention_dispatches_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE;
alter table public.retention_dispatches add constraint retention_dispatches_establishment_id_fkey FOREIGN KEY (establishment_id) REFERENCES establishments(id) ON DELETE CASCADE;
alter table public.retention_events add constraint retention_events_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE;
alter table public.retention_events add constraint retention_events_establishment_id_fkey FOREIGN KEY (establishment_id) REFERENCES establishments(id) ON DELETE CASCADE;
alter table public.retention_settings add constraint retention_settings_establishment_id_fkey FOREIGN KEY (establishment_id) REFERENCES establishments(id) ON DELETE CASCADE;
alter table public.review_answers add constraint review_answers_question_id_fkey FOREIGN KEY (question_id) REFERENCES review_questions(id) ON DELETE CASCADE;
alter table public.review_answers add constraint review_answers_review_id_fkey FOREIGN KEY (review_id) REFERENCES customer_reviews(id) ON DELETE CASCADE;
alter table public.review_events add constraint review_events_review_form_id_fkey FOREIGN KEY (review_form_id) REFERENCES review_forms(id) ON DELETE CASCADE;
alter table public.review_events add constraint review_events_review_id_fkey FOREIGN KEY (review_id) REFERENCES customer_reviews(id) ON DELETE SET NULL;
alter table public.review_forms add constraint review_forms_establishment_id_fkey FOREIGN KEY (establishment_id) REFERENCES establishments(id) ON DELETE CASCADE;
alter table public.review_questions add constraint review_questions_review_form_id_fkey FOREIGN KEY (review_form_id) REFERENCES review_forms(id) ON DELETE CASCADE;
alter table public.review_rating_options add constraint review_rating_options_review_form_id_fkey FOREIGN KEY (review_form_id) REFERENCES review_forms(id) ON DELETE CASCADE;
alter table public.review_settings add constraint review_settings_establishment_id_fkey FOREIGN KEY (establishment_id) REFERENCES establishments(id) ON DELETE CASCADE;
alter table public.reviews add constraint reviews_card_id_fkey FOREIGN KEY (card_id) REFERENCES loyalty_cards(id) ON DELETE SET NULL;
alter table public.reviews add constraint reviews_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL;
alter table public.reviews add constraint reviews_establishment_id_fkey FOREIGN KEY (establishment_id) REFERENCES establishments(id) ON DELETE CASCADE;
alter table public.reviews add constraint reviews_replied_by_fkey FOREIGN KEY (replied_by) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.reviews add constraint reviews_stamp_id_fkey FOREIGN KEY (stamp_id) REFERENCES stamps(id) ON DELETE SET NULL;
alter table public.rewards add constraint rewards_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE;
alter table public.rewards add constraint rewards_card_id_fkey FOREIGN KEY (card_id) REFERENCES loyalty_cards(id) ON DELETE CASCADE;
alter table public.rewards add constraint rewards_establishment_id_fkey FOREIGN KEY (establishment_id) REFERENCES establishments(id) ON DELETE CASCADE;
alter table public.rewards add constraint rewards_redeemed_by_fkey FOREIGN KEY (redeemed_by) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.scheduled_pushes add constraint scheduled_pushes_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.scheduled_pushes add constraint scheduled_pushes_establishment_id_fkey FOREIGN KEY (establishment_id) REFERENCES establishments(id) ON DELETE CASCADE;
alter table public.sponsored_ad_campaigns add constraint sponsored_ad_campaigns_establishment_id_fkey FOREIGN KEY (establishment_id) REFERENCES establishments(id) ON DELETE CASCADE;
alter table public.sponsored_ad_campaigns add constraint sponsored_ad_campaigns_package_id_fkey FOREIGN KEY (package_id) REFERENCES sponsored_ad_packages(id) ON DELETE SET NULL;
alter table public.sponsored_ad_daily_metrics add constraint sponsored_ad_daily_metrics_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES sponsored_ad_campaigns(id) ON DELETE CASCADE;
alter table public.sponsored_ad_events add constraint sponsored_ad_events_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES sponsored_ad_campaigns(id) ON DELETE CASCADE;
alter table public.sponsored_ad_orders add constraint sponsored_ad_orders_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES sponsored_ad_campaigns(id) ON DELETE CASCADE;
alter table public.sponsored_ad_orders add constraint sponsored_ad_orders_establishment_id_fkey FOREIGN KEY (establishment_id) REFERENCES establishments(id) ON DELETE CASCADE;
alter table public.sponsored_ad_reviews add constraint sponsored_ad_reviews_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES sponsored_ad_campaigns(id) ON DELETE CASCADE;
alter table public.stamps add constraint stamps_added_by_fkey FOREIGN KEY (added_by) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.stamps add constraint stamps_card_id_fkey FOREIGN KEY (card_id) REFERENCES loyalty_cards(id) ON DELETE CASCADE;
alter table public.stamps add constraint stamps_establishment_id_fkey FOREIGN KEY (establishment_id) REFERENCES establishments(id) ON DELETE CASCADE;
alter table public.stamps add constraint stamps_reverted_by_fkey FOREIGN KEY (reverted_by) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.subscription_events add constraint subscription_events_establishment_id_fkey FOREIGN KEY (establishment_id) REFERENCES establishments(id) ON DELETE CASCADE;
alter table public.subscriptions add constraint subscriptions_establishment_id_fkey FOREIGN KEY (establishment_id) REFERENCES establishments(id) ON DELETE CASCADE;
alter table public.subscriptions add constraint subscriptions_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES plans(id) ON DELETE SET NULL;
alter table public.support_messages add constraint support_messages_sender_user_id_fkey FOREIGN KEY (sender_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.support_messages add constraint support_messages_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES support_tickets(id) ON DELETE CASCADE;
alter table public.support_quick_replies add constraint support_quick_replies_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.support_status_history add constraint support_status_history_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.support_status_history add constraint support_status_history_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES support_tickets(id) ON DELETE CASCADE;
alter table public.support_tickets add constraint support_tickets_assigned_admin_id_fkey FOREIGN KEY (assigned_admin_id) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.support_tickets add constraint support_tickets_establishment_id_fkey FOREIGN KEY (establishment_id) REFERENCES establishments(id) ON DELETE SET NULL;
alter table public.support_tickets add constraint support_tickets_requester_user_id_fkey FOREIGN KEY (requester_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.team_invites add constraint team_invites_accepted_by_fkey FOREIGN KEY (accepted_by) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.team_invites add constraint team_invites_establishment_id_fkey FOREIGN KEY (establishment_id) REFERENCES establishments(id) ON DELETE CASCADE;
alter table public.team_invites add constraint team_invites_invited_by_fkey FOREIGN KEY (invited_by) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.ticket_messages add constraint ticket_messages_author_user_id_fkey FOREIGN KEY (author_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.ticket_messages add constraint ticket_messages_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE;
alter table public.ticket_quick_replies add constraint ticket_quick_replies_establishment_id_fkey FOREIGN KEY (establishment_id) REFERENCES establishments(id) ON DELETE CASCADE;
alter table public.tickets add constraint tickets_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.tickets add constraint tickets_establishment_id_fkey FOREIGN KEY (establishment_id) REFERENCES establishments(id) ON DELETE CASCADE;
alter table public.tickets add constraint tickets_requester_user_id_fkey FOREIGN KEY (requester_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.user_notifications add constraint user_notifications_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE;
alter table public.user_notifications add constraint user_notifications_establishment_id_fkey FOREIGN KEY (establishment_id) REFERENCES establishments(id) ON DELETE CASCADE;
alter table public.user_notifications add constraint user_notifications_push_log_id_fkey FOREIGN KEY (push_log_id) REFERENCES push_logs(id) ON DELETE SET NULL;
alter table public.wallet_pass_devices add constraint wallet_pass_devices_pass_id_fkey FOREIGN KEY (pass_id) REFERENCES wallet_passes(id) ON DELETE CASCADE;
alter table public.wallet_passes add constraint wallet_passes_card_id_fkey FOREIGN KEY (card_id) REFERENCES loyalty_cards(id) ON DELETE SET NULL;
alter table public.wallet_passes add constraint wallet_passes_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE;
alter table public.wallet_passes add constraint wallet_passes_establishment_id_fkey FOREIGN KEY (establishment_id) REFERENCES establishments(id) ON DELETE CASCADE;
alter table public.wallet_settings add constraint wallet_settings_establishment_id_fkey FOREIGN KEY (establishment_id) REFERENCES establishments(id) ON DELETE CASCADE;
alter table public.webhook_deliveries add constraint webhook_deliveries_webhook_id_fkey FOREIGN KEY (webhook_id) REFERENCES webhooks(id) ON DELETE CASCADE;
alter table public.webhooks add constraint webhooks_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.webhooks add constraint webhooks_establishment_id_fkey FOREIGN KEY (establishment_id) REFERENCES establishments(id) ON DELETE CASCADE;

-- ---------------------------------------------------------------------
-- 4. ÍNDICES
-- ---------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_ai_analyses_est_surface ON public.ai_analyses USING btree (establishment_id, surface, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_findings_est ON public.ai_findings_state USING btree (establishment_id, status);
CREATE INDEX IF NOT EXISTS idx_ai_usage_est_month ON public.ai_usage USING btree (establishment_id, surface, created_at DESC);
CREATE INDEX IF NOT EXISTS app_engagement_events_est_time_idx ON public.app_engagement_events USING btree (establishment_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS app_engagement_events_type_time_idx ON public.app_engagement_events USING btree (event_type, occurred_at DESC);
CREATE INDEX IF NOT EXISTS app_engagement_events_user_idx ON public.app_engagement_events USING btree (user_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_est_created ON public.audit_logs USING btree (establishment_id, created_at DESC);
CREATE INDEX IF NOT EXISTS auth_attempts_created_idx ON public.auth_attempts USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS auth_attempts_identifier_idx ON public.auth_attempts USING btree (identifier, created_at DESC);
CREATE INDEX IF NOT EXISTS auth_attempts_ip_idx ON public.auth_attempts USING btree (ip, created_at DESC);
CREATE INDEX IF NOT EXISTS channel_events_est_channel_time_idx ON public.channel_events USING btree (establishment_id, channel, occurred_at DESC);
CREATE INDEX IF NOT EXISTS channel_events_est_time_idx ON public.channel_events USING btree (establishment_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_customer_achievements_user ON public.customer_achievements USING btree (user_id, unlocked_at DESC);
CREATE INDEX IF NOT EXISTS idx_customer_reviews_cooldown ON public.customer_reviews USING btree (review_form_id, device_hash, submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_customer_reviews_est_created ON public.customer_reviews USING btree (establishment_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_customer_reviews_form ON public.customer_reviews USING btree (review_form_id);
CREATE INDEX IF NOT EXISTS idx_customer_reviews_public_recent ON public.customer_reviews USING btree (establishment_id, created_at DESC) WHERE (public_hidden = false);
CREATE INDEX IF NOT EXISTS idx_customer_reviews_status ON public.customer_reviews USING btree (establishment_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS customers_est_user_unique ON public.customers USING btree (establishment_id, user_id) WHERE (user_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS customers_token ON public.customers USING btree (access_token);
CREATE INDEX IF NOT EXISTS customers_user_id_idx ON public.customers USING btree (user_id) WHERE (user_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_customers_est_created ON public.customers USING btree (establishment_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_customers_est_last_visit ON public.customers USING btree (establishment_id, last_visit_at DESC);
CREATE INDEX IF NOT EXISTS idx_customers_est_name ON public.customers USING btree (establishment_id, name);
CREATE INDEX IF NOT EXISTS idx_customers_user_pinned ON public.customers USING btree (user_id, pinned_at DESC NULLS LAST) WHERE (user_id IS NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS uq_customers_est_referral ON public.customers USING btree (establishment_id, referral_code) WHERE (referral_code IS NOT NULL);
CREATE INDEX IF NOT EXISTS data_requests_est_idx ON public.data_requests USING btree (establishment_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_created ON public.email_logs USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_logs_created_at ON public.email_logs USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_queue_pending ON public.email_queue USING btree (status, next_attempt_at) WHERE (status = ANY (ARRAY['pending'::text, 'processing'::text]));
CREATE INDEX IF NOT EXISTS idx_goals_est_month ON public.establishment_goals USING btree (establishment_id, month DESC);
CREATE INDEX IF NOT EXISTS idx_establishment_members_user_active ON public.establishment_members USING btree (user_id, establishment_id) WHERE (active = true);
CREATE INDEX IF NOT EXISTS idx_feature_gate_events_est ON public.feature_gate_events USING btree (establishment_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feature_gate_events_feature ON public.feature_gate_events USING btree (feature_key, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_help_articles_category ON public.help_articles USING btree (category_id);
CREATE INDEX IF NOT EXISTS idx_help_articles_search ON public.help_articles USING gin (to_tsvector('portuguese'::regconfig, ((((((COALESCE(title, ''::text) || ' '::text) || COALESCE(excerpt, ''::text)) || ' '::text) || COALESCE(content, ''::text)) || ' '::text) || COALESCE(keywords, ''::text))));
CREATE INDEX IF NOT EXISTS idx_helpdesk_members_user_active ON public.helpdesk_members USING btree (user_id, establishment_id) WHERE (active = true);
CREATE INDEX IF NOT EXISTS kb_articles_est_pub_idx ON public.kb_articles USING btree (establishment_id, published);
CREATE INDEX IF NOT EXISTS kb_articles_search_idx ON public.kb_articles USING gin (search_tsv);
CREATE INDEX IF NOT EXISTS link_tree_links_page_order_idx ON public.link_tree_links USING btree (page_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_loyalty_cards_customer ON public.loyalty_cards USING btree (customer_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_cards_est_campaign ON public.loyalty_cards USING btree (establishment_id, campaign_id);
CREATE INDEX IF NOT EXISTS idx_member_permissions_member ON public.member_permissions USING btree (member_id);
CREATE INDEX IF NOT EXISTS member_permissions_est_idx ON public.member_permissions USING btree (establishment_id);
CREATE INDEX IF NOT EXISTS idx_menu_categories_menu ON public.menu_categories USING btree (menu_id, "position");
CREATE INDEX IF NOT EXISTS idx_menu_item_favorites_user ON public.menu_item_favorites USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_menu_item_media_item ON public.menu_item_media USING btree (item_id, "position");
CREATE INDEX IF NOT EXISTS idx_menu_items_category ON public.menu_items USING btree (category_id, "position");
CREATE INDEX IF NOT EXISTS idx_menu_items_menu ON public.menu_items USING btree (menu_id, "position");
CREATE INDEX IF NOT EXISTS idx_menu_publish_events_menu ON public.menu_publish_events USING btree (menu_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_menu_qr_designs_menu ON public.menu_qr_designs USING btree (menu_id);
CREATE INDEX IF NOT EXISTS idx_msg_reads_user ON public.merchant_message_reads USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_merchant_messages_est_pub ON public.merchant_messages USING btree (establishment_id, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_merchant_messages_source_pub ON public.merchant_messages USING btree (source, published_at DESC);
CREATE INDEX IF NOT EXISTS order_items_order_idx ON public.order_items USING btree (order_id);
CREATE INDEX IF NOT EXISTS orders_est_created_idx ON public.orders USING btree (establishment_id, created_at DESC);
CREATE INDEX IF NOT EXISTS orders_est_status_idx ON public.orders USING btree (establishment_id, status);
CREATE INDEX IF NOT EXISTS idx_payment_logs_created ON public.payment_logs USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_logs_error_created ON public.payment_logs USING btree (error, created_at DESC) WHERE (error IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_payment_logs_mp_id ON public.payment_logs USING btree (mp_resource, mp_id);
CREATE INDEX IF NOT EXISTS payment_logs_provider_created_idx ON public.payment_logs USING btree (provider, created_at DESC);
CREATE INDEX IF NOT EXISTS payment_logs_retry_idx ON public.payment_logs USING btree (next_retry_at) WHERE ((error IS NOT NULL) AND (processed = false));
CREATE INDEX IF NOT EXISTS idx_payments_est_status ON public.payments USING btree (establishment_id, status);
CREATE INDEX IF NOT EXISTS idx_payments_establishment ON public.payments USING btree (establishment_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_mp_payment_id ON public.payments USING btree (mp_payment_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments USING btree (status);
CREATE INDEX IF NOT EXISTS idx_payments_status_created ON public.payments USING btree (status, created_at DESC);
CREATE INDEX IF NOT EXISTS payments_provider_ppid_idx ON public.payments USING btree (provider, provider_payment_id);
CREATE INDEX IF NOT EXISTS pixel_events_created_at_idx ON public.pixel_events USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS pixel_events_event_name_idx ON public.pixel_events USING btree (event_name);
CREATE INDEX IF NOT EXISTS idx_plan_funnel_events_plan_created ON public.plan_funnel_events USING btree (plan_slug, created_at DESC);
CREATE INDEX IF NOT EXISTS plan_funnel_events_created_idx ON public.plan_funnel_events USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS plan_funnel_events_session_idx ON public.plan_funnel_events USING btree (session_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS plans_slug_uidx ON public.plans USING btree (slug);
CREATE INDEX IF NOT EXISTS poster_designs_est_idx ON public.poster_designs USING btree (establishment_id, created_at DESC);
CREATE INDEX IF NOT EXISTS print_orders_est_idx ON public.print_orders USING btree (establishment_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_promotions_est_active ON public.promotions USING btree (establishment_id, active, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_push_events_est_created ON public.push_events USING btree (establishment_id, created_at DESC) WHERE (establishment_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_push_events_type ON public.push_events USING btree (event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_push_events_user_created ON public.push_events USING btree (user_id, created_at DESC) WHERE (user_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_push_logs_customer ON public.push_logs USING btree (customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_push_logs_est_date ON public.push_logs USING btree (establishment_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_push_subs_customer ON public.push_subscriptions USING btree (customer_id) WHERE (customer_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_push_subs_est_active ON public.push_subscriptions USING btree (establishment_id) WHERE (active = true);
CREATE INDEX IF NOT EXISTS idx_push_subs_user ON public.push_subscriptions USING btree (user_id) WHERE (user_id IS NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS push_subscriptions_customer_endpoint_unq ON public.push_subscriptions USING btree (customer_id, endpoint) WHERE (customer_id IS NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS push_subscriptions_user_endpoint_unq ON public.push_subscriptions USING btree (user_id, endpoint) WHERE ((user_id IS NOT NULL) AND (customer_id IS NULL));
CREATE INDEX IF NOT EXISTS qr_scans_est_time_idx ON public.qr_scans USING btree (establishment_id, scanned_at DESC);
CREATE INDEX IF NOT EXISTS qr_tags_code_idx ON public.qr_tags USING btree (code);
CREATE INDEX IF NOT EXISTS qr_tags_est_idx ON public.qr_tags USING btree (establishment_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS restaurant_menus_est_kind_uidx ON public.restaurant_menus USING btree (establishment_id, kind);
CREATE INDEX IF NOT EXISTS idx_retention_dispatches_customer_kind ON public.retention_dispatches USING btree (customer_id, kind, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_retention_dispatches_est_kind_date ON public.retention_dispatches USING btree (establishment_id, kind, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_retention_events_customer_date ON public.retention_events USING btree (customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_retention_events_est_type_date ON public.retention_events USING btree (establishment_id, event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_review_answers_review ON public.review_answers USING btree (review_id);
CREATE INDEX IF NOT EXISTS idx_review_events_form_created ON public.review_events USING btree (review_form_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reviews_customer ON public.reviews USING btree (customer_id);
CREATE INDEX IF NOT EXISTS idx_reviews_est ON public.reviews USING btree (establishment_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS ux_reviews_one_per_stamp ON public.reviews USING btree (stamp_id) WHERE (stamp_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_rewards_card ON public.rewards USING btree (card_id);
CREATE INDEX IF NOT EXISTS idx_rewards_card_redeemed ON public.rewards USING btree (card_id) WHERE (redeemed_at IS NOT NULL);
CREATE INDEX IF NOT EXISTS rewards_expiring_idx ON public.rewards USING btree (expires_at) WHERE ((redeemed_at IS NULL) AND (expiry_notified_at IS NULL));
CREATE INDEX IF NOT EXISTS idx_scheduled_pushes_due ON public.scheduled_pushes USING btree (scheduled_at) WHERE (status = 'pending'::text);
CREATE INDEX IF NOT EXISTS idx_scheduled_pushes_est ON public.scheduled_pushes USING btree (establishment_id, scheduled_at DESC);
CREATE INDEX IF NOT EXISTS idx_ads_campaigns_est_status ON public.sponsored_ad_campaigns USING btree (establishment_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ads_campaigns_rotation ON public.sponsored_ad_campaigns USING btree (category_id, starts_at, ends_at) WHERE (status = 'active'::text);
CREATE INDEX IF NOT EXISTS idx_ads_campaigns_scheduling ON public.sponsored_ad_campaigns USING btree (starts_at) WHERE (status = ANY (ARRAY['scheduled'::text, 'active'::text]));
CREATE INDEX IF NOT EXISTS idx_ads_campaigns_status ON public.sponsored_ad_campaigns USING btree (status);
CREATE INDEX IF NOT EXISTS idx_ads_events_campaign_date ON public.sponsored_ad_events USING btree (campaign_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_ads_orders_campaign ON public.sponsored_ad_orders USING btree (campaign_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ads_orders_external ON public.sponsored_ad_orders USING btree (gateway, external_payment_id);
CREATE INDEX IF NOT EXISTS idx_ads_orders_status ON public.sponsored_ad_orders USING btree (status);
CREATE INDEX IF NOT EXISTS idx_ads_reviews_campaign ON public.sponsored_ad_reviews USING btree (campaign_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stamps_card_active ON public.stamps USING btree (card_id, created_at DESC) WHERE (reverted_at IS NULL);
CREATE INDEX IF NOT EXISTS idx_stamps_card_created ON public.stamps USING btree (card_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stamps_est_created ON public.stamps USING btree (establishment_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_subev_est_created ON public.subscription_events USING btree (establishment_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_subev_unack ON public.subscription_events USING btree (created_at DESC) WHERE (acknowledged_at IS NULL);
CREATE INDEX IF NOT EXISTS idx_subscriptions_est_status ON public.subscriptions USING btree (establishment_id, status);
CREATE INDEX IF NOT EXISTS support_messages_ticket_idx ON public.support_messages USING btree (ticket_id, created_at);
CREATE INDEX IF NOT EXISTS support_status_history_ticket_idx ON public.support_status_history USING btree (ticket_id, created_at);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON public.support_tickets USING btree (status);
CREATE INDEX IF NOT EXISTS support_tickets_establishment_idx ON public.support_tickets USING btree (establishment_id);
CREATE INDEX IF NOT EXISTS support_tickets_requester_idx ON public.support_tickets USING btree (requester_user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS team_invites_email_idx ON public.team_invites USING btree (lower(email));
CREATE INDEX IF NOT EXISTS team_invites_est_idx ON public.team_invites USING btree (establishment_id);
CREATE INDEX IF NOT EXISTS tm_ticket_idx ON public.ticket_messages USING btree (ticket_id, created_at);
CREATE INDEX IF NOT EXISTS idx_tickets_est_status ON public.tickets USING btree (establishment_id, status);
CREATE INDEX IF NOT EXISTS tickets_requester_idx ON public.tickets USING btree (requester_user_id);
CREATE INDEX IF NOT EXISTS idx_user_notifications_customer_date ON public.user_notifications USING btree (customer_id, created_at DESC) WHERE (customer_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_user_notifications_unread ON public.user_notifications USING btree (user_id, created_at DESC) WHERE ((read_at IS NULL) AND (user_id IS NOT NULL));
CREATE INDEX IF NOT EXISTS idx_user_notifications_user_date ON public.user_notifications USING btree (user_id, created_at DESC) WHERE (user_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS wallet_passes_est_idx ON public.wallet_passes USING btree (establishment_id);
CREATE UNIQUE INDEX IF NOT EXISTS wallet_passes_unique_customer_platform ON public.wallet_passes USING btree (customer_id, platform);

-- ---------------------------------------------------------------------
-- 5. FUNCTIONS
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_and_unlock_achievements(_user_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_stamps_total INT := 0;
  v_rewards_total INT := 0;
  v_establishments_total INT := 0;
  v_max_tier_rank INT := 1;
  v_unlocked_count INT := 0;
  ach RECORD;
  v_match BOOLEAN;
BEGIN
  IF _user_id IS NULL THEN RETURN 0; END IF;

  SELECT COUNT(*)::int INTO v_stamps_total
    FROM public.stamps s
    JOIN public.loyalty_cards lc ON lc.id = s.card_id
    JOIN public.customers c ON c.id = lc.customer_id
   WHERE c.user_id = _user_id
     AND s.reverted_at IS NULL;

  SELECT COUNT(*)::int INTO v_rewards_total
    FROM public.rewards r
    JOIN public.loyalty_cards lc ON lc.id = r.card_id
    JOIN public.customers c ON c.id = lc.customer_id
   WHERE c.user_id = _user_id
     AND r.redeemed_at IS NOT NULL;

  SELECT COUNT(DISTINCT c.establishment_id)::int INTO v_establishments_total
    FROM public.customers c
   WHERE c.user_id = _user_id;

  SELECT COALESCE(MAX(
    CASE tier::text
      WHEN 'diamante' THEN 4
      WHEN 'ouro' THEN 3
      WHEN 'prata' THEN 2
      WHEN 'bronze' THEN 1
      ELSE 0
    END
  ), 1) INTO v_max_tier_rank
    FROM public.customers WHERE user_id = _user_id;

  FOR ach IN
    SELECT a.* FROM public.achievements a
    WHERE a.is_active = true
      AND NOT EXISTS (
        SELECT 1 FROM public.customer_achievements ca
        WHERE ca.user_id = _user_id AND ca.achievement_code = a.code
      )
  LOOP
    v_match := false;
    CASE ach.criteria_type
      WHEN 'first_stamp' THEN v_match := v_stamps_total >= 1;
      WHEN 'stamps_total' THEN v_match := v_stamps_total >= ach.criteria_value;
      WHEN 'first_reward' THEN v_match := v_rewards_total >= 1;
      WHEN 'rewards_total' THEN v_match := v_rewards_total >= ach.criteria_value;
      WHEN 'establishments_total' THEN v_match := v_establishments_total >= ach.criteria_value;
      WHEN 'tier_reached' THEN v_match := v_max_tier_rank >= ach.criteria_value;
      ELSE v_match := false;
    END CASE;

    IF v_match THEN
      INSERT INTO public.customer_achievements (user_id, achievement_code)
      VALUES (_user_id, ach.code)
      ON CONFLICT DO NOTHING;
      v_unlocked_count := v_unlocked_count + 1;
    END IF;
  END LOOP;

  RETURN v_unlocked_count;
END;
$function$;

CREATE OR REPLACE FUNCTION public.compute_tier(_visits integer, _thresholds jsonb)
 RETURNS customer_tier
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
DECLARE
  t public.customer_tier := 'bronze';
BEGIN
  IF _visits >= COALESCE((_thresholds->>'diamante')::int, 50) THEN RETURN 'diamante'; END IF;
  IF _visits >= COALESCE((_thresholds->>'ouro')::int, 25) THEN RETURN 'ouro'; END IF;
  IF _visits >= COALESCE((_thresholds->>'prata')::int, 10) THEN RETURN 'prata'; END IF;
  RETURN 'bronze';
END; $function$;

CREATE OR REPLACE FUNCTION public.dashboard_summary(_est uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
DECLARE
  v_month_start timestamptz := date_trunc('month', now() at time zone 'utc');
  v_prev_start  timestamptz := v_month_start - interval '1 month';
  v_since       timestamptz := now() - interval '30 days';
  v_result      jsonb;
BEGIN
  SELECT jsonb_build_object(
    'customersCount', (SELECT count(*) FROM customers c WHERE c.establishment_id = _est),
    'stampsCount',    (SELECT count(*) FROM stamps s WHERE s.establishment_id = _est AND s.reverted_at IS NULL),
    'rewardsCount',   (SELECT count(*) FROM rewards r WHERE r.establishment_id = _est),
    'redeemedCount',  (SELECT count(*) FROM rewards r WHERE r.establishment_id = _est AND r.redeemed_at IS NOT NULL),
    'mom', jsonb_build_object(
      'customers', jsonb_build_object(
        'current',  (SELECT count(*) FROM customers c WHERE c.establishment_id = _est AND c.created_at >= v_month_start),
        'previous', (SELECT count(*) FROM customers c WHERE c.establishment_id = _est AND c.created_at >= v_prev_start AND c.created_at < v_month_start)
      ),
      'stamps', jsonb_build_object(
        'current',  (SELECT count(*) FROM stamps s WHERE s.establishment_id = _est AND s.reverted_at IS NULL AND s.created_at >= v_month_start),
        'previous', (SELECT count(*) FROM stamps s WHERE s.establishment_id = _est AND s.reverted_at IS NULL AND s.created_at >= v_prev_start AND s.created_at < v_month_start)
      ),
      'rewards', jsonb_build_object(
        'current',  (SELECT count(*) FROM rewards r WHERE r.establishment_id = _est AND r.redeemed_at >= v_month_start),
        'previous', (SELECT count(*) FROM rewards r WHERE r.establishment_id = _est AND r.redeemed_at >= v_prev_start AND r.redeemed_at < v_month_start)
      )
    ),
    'topCustomers', COALESCE((
      SELECT jsonb_agg(t) FROM (
        SELECT c.id, c.name, c.visits_count, c.last_visit_at
        FROM customers c
        WHERE c.establishment_id = _est
        ORDER BY c.visits_count DESC NULLS LAST
        LIMIT 6
      ) t
    ), '[]'::jsonb),
    'daily', COALESCE((
      SELECT jsonb_object_agg(d, n) FROM (
        SELECT to_char(s.created_at, 'YYYY-MM-DD') AS d, count(*) AS n
        FROM stamps s
        WHERE s.establishment_id = _est AND s.reverted_at IS NULL AND s.created_at >= v_since
        GROUP BY 1
      ) g
    ), '{}'::jsonb),
    'goals', COALESCE((
      SELECT to_jsonb(g) FROM establishment_goals g
      WHERE g.establishment_id = _est
        AND g.month = date_trunc('month', now() at time zone 'utc')::date
      LIMIT 1
    ), 'null'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.delete_my_account()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  DELETE FROM public.establishment_members WHERE user_id = uid;
  DELETE FROM public.helpdesk_members WHERE user_id = uid;
  DELETE FROM public.app_roles WHERE user_id = uid;
  DELETE FROM public.profiles WHERE id = uid;
  DELETE FROM auth.users WHERE id = uid;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_establishment_plan(_est uuid)
 RETURNS plans
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT p.* FROM public.plans p
  JOIN public.establishments e ON e.id = _est
  WHERE p.tier = e.plan
  ORDER BY p.is_active DESC LIMIT 1
$function$;

CREATE OR REPLACE FUNCTION public.get_sponsored_ads_for_discovery(_category text, _session_hash text, _limit integer DEFAULT 3)
 RETURNS TABLE(campaign_id uuid, tracking_token text, title text, description text, image_path text, image_source text, cta_label text, destination_type text, destination_slug text, category_id text, establishment_name text, establishment_slug text, establishment_logo_url text, establishment_primary_color text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH cfg AS (
    SELECT max_ads_per_category, max_impressions_per_session_24h
    FROM public.sponsored_ad_settings WHERE id
  ), eligible AS (
    SELECT c.*, e.name AS est_name, e.slug AS est_slug, e.logo_url AS est_logo, e.primary_color AS est_color
    FROM public.sponsored_ad_campaigns c
    JOIN public.establishments e ON e.id = c.establishment_id
    CROSS JOIN cfg
    WHERE c.status = 'active'
      AND c.paused_at IS NULL
      AND e.active = true
      AND e.archived_at IS NULL
      AND c.starts_at IS NOT NULL AND c.starts_at <= now()
      AND c.ends_at IS NOT NULL AND c.ends_at > now()
      AND (_category IS NULL OR c.category_id = _category)
      AND c.category_id = ANY (SELECT unnest(allowed_categories) FROM public.sponsored_ad_settings WHERE id)
      AND (
        _session_hash IS NULL OR (
          SELECT count(*) FROM public.sponsored_ad_events ev
          WHERE ev.campaign_id = c.id
            AND ev.event_type = 'impression'
            AND ev.session_hash = _session_hash
            AND ev.occurred_at > now() - interval '24 hours'
        ) < cfg.max_impressions_per_session_24h
      )
  ), scored AS (
    SELECT el.*,
      COALESCE((
        SELECT m.unique_impressions FROM public.sponsored_ad_daily_metrics m
        WHERE m.campaign_id = el.id AND m.metric_date = (now() AT TIME ZONE 'utc')::date
      ), 0) AS today_impressions,
      COALESCE((
        SELECT 1 FROM public.sponsored_ad_events ev
        WHERE ev.campaign_id = el.id
          AND ev.event_type = 'impression'
          AND ev.session_hash = _session_hash
          AND ev.occurred_at > now() - interval '1 hour'
        LIMIT 1
      ), 0) AS seen_recently
    FROM eligible el
  )
  SELECT s.id, s.tracking_token, s.title, s.description, s.image_path, s.image_source,
         s.cta_label, s.destination_type, s.destination_slug, s.category_id,
         s.est_name, s.est_slug, s.est_logo, s.est_color
  FROM scored s
  ORDER BY s.seen_recently ASC, s.today_impressions ASC,
           md5(s.id::text || COALESCE(_session_hash, '')) ASC
  LIMIT LEAST(GREATEST(COALESCE(_limit, 3), 1), (SELECT max_ads_per_category FROM cfg));
$function$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $function$;

CREATE OR REPLACE FUNCTION public.has_active_subscription(_est uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT COALESCE((
    SELECT e.active
       AND e.archived_at IS NULL
       AND EXISTS (
         SELECT 1 FROM public.subscriptions s
         WHERE s.establishment_id = e.id
           AND s.status IN ('active','trial','trialing')
           AND (s.current_period_end IS NULL OR s.current_period_end > now() - interval '3 days')
       )
    FROM public.establishments e
    WHERE e.id = _est
  ), false);
$function$;

CREATE OR REPLACE FUNCTION public.has_establishment_access(_user uuid, _est uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (SELECT 1 FROM public.establishment_members
                 WHERE user_id = _user AND establishment_id = _est AND active = true);
$function$;

CREATE OR REPLACE FUNCTION public.has_establishment_role(_user uuid, _est uuid, _min_role member_role)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.establishment_members
    WHERE user_id = _user AND establishment_id = _est AND active = true
    AND (
      _min_role = 'staff'
      OR (_min_role = 'manager' AND role IN ('manager','owner'))
      OR (_min_role = 'owner'   AND role = 'owner')
    )
  );
$function$;

CREATE OR REPLACE FUNCTION public.has_plan_feature(_est uuid, _feature text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT public.has_plan_feature_strict(_est, _feature)
      OR EXISTS (
        SELECT 1 FROM public.establishment_feature_overrides o
        WHERE o.establishment_id = _est
          AND o.feature_key = _feature
          AND o.enabled = true
          AND (o.expires_at IS NULL OR o.expires_at > now())
      )
$function$;

CREATE OR REPLACE FUNCTION public.has_plan_feature_strict(_est uuid, _feature text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT COALESCE((
    SELECT pf.enabled FROM public.plan_features pf
    JOIN public.plans p ON p.id = pf.plan_id
    JOIN public.establishments e ON e.id = _est
    WHERE p.tier = e.plan AND pf.feature_key = _feature
    LIMIT 1
  ), false)
$function$;

CREATE OR REPLACE FUNCTION public.is_establishment_user(_user uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.establishment_members
    WHERE user_id = _user AND active = true
  );
$function$;

CREATE OR REPLACE FUNCTION public.is_helpdesk_admin(_user uuid, _est uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.helpdesk_members
    WHERE user_id = _user AND establishment_id = _est AND active = true AND role = 'hd_admin'
  ) OR EXISTS (
    SELECT 1 FROM public.establishment_members
    WHERE user_id = _user AND establishment_id = _est AND active = true AND role IN ('owner','manager')
  );
$function$;

CREATE OR REPLACE FUNCTION public.is_helpdesk_agent(_user uuid, _est uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.helpdesk_members
    WHERE user_id = _user AND establishment_id = _est AND active = true
  ) OR EXISTS (
    SELECT 1 FROM public.establishment_members
    WHERE user_id = _user AND establishment_id = _est AND active = true AND role IN ('owner','manager')
  );
$function$;

CREATE OR REPLACE FUNCTION public.is_super_admin(_user uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (SELECT 1 FROM public.app_roles WHERE user_id = _user AND role = 'super_admin');
$function$;

CREATE OR REPLACE FUNCTION public.mark_past_due_subscriptions()
 RETURNS TABLE(marked_past_due integer, blocked integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_past_due int := 0; v_blocked int := 0;
BEGIN
  WITH upd AS (
    UPDATE public.subscriptions
       SET status = 'past_due', updated_at = now()
     WHERE status = 'active'
       AND current_period_end IS NOT NULL
       AND current_period_end < (now() - interval '3 days')
     RETURNING id
  )
  SELECT count(*) INTO v_past_due FROM upd;

  WITH blk AS (
    UPDATE public.establishments e
       SET active = false, updated_at = now()
      FROM public.subscriptions s
     WHERE s.establishment_id = e.id
       AND s.status = 'past_due'
       AND s.current_period_end IS NOT NULL
       AND s.current_period_end < (now() - interval '10 days')
       AND e.active = true
     RETURNING e.id
  )
  SELECT count(*) INTO v_blocked FROM blk;

  RETURN QUERY SELECT v_past_due, v_blocked;
END;
$function$;

CREATE OR REPLACE FUNCTION public.member_can(_user uuid, _est uuid, _action text)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_role member_role;
  v_active boolean;
  v_member_id uuid;
  v_override jsonb;
  v_default boolean;
BEGIN
  IF _user IS NULL OR _est IS NULL OR _action IS NULL THEN
    RETURN false;
  END IF;

  -- Super admin sempre pode
  IF public.is_super_admin(_user) THEN
    RETURN true;
  END IF;

  SELECT id, role, active INTO v_member_id, v_role, v_active
    FROM public.establishment_members
   WHERE user_id = _user AND establishment_id = _est
   LIMIT 1;

  IF v_member_id IS NULL OR v_active IS NOT TRUE THEN
    RETURN false;
  END IF;

  -- Owner sempre pode tudo
  IF v_role = 'owner' THEN
    RETURN true;
  END IF;

  -- Override individual (true/false) tem prioridade
  SELECT overrides INTO v_override
    FROM public.member_permissions
   WHERE member_id = v_member_id;

  IF v_override ? _action THEN
    RETURN COALESCE((v_override ->> _action)::boolean, false);
  END IF;

  -- Padrão do papel
  IF v_role = 'manager' THEN
    v_default := _action NOT IN (
      'billing.manage',      -- só owner mexe em cobrança/plano
      'team.roles.manage'    -- só owner promove/rebaixa papéis
    );
  ELSE -- staff
    v_default := _action IN (
      'stamping.use',
      'customers.view',
      'customers.edit',
      'reviews.view',
      'reviews.reply',
      'push.send',
      'support.open',
      'support.reply',
      'analytics.view'
    );
  END IF;

  RETURN COALESCE(v_default, false);
END;
$function$;

CREATE OR REPLACE FUNCTION public.menu_storage_est_id(_path text)
 RETURNS uuid
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  SELECT NULLIF(substring(_path FROM '^est_([0-9a-fA-F-]{36})/'), '')::uuid
$function$;

CREATE OR REPLACE FUNCTION public.my_account_type()
 RETURNS account_type
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RETURN NULL; END IF;
  IF EXISTS (SELECT 1 FROM public.app_roles WHERE user_id = uid AND role = 'super_admin') THEN
    RETURN 'super_admin';
  END IF;
  IF EXISTS (SELECT 1 FROM public.establishment_members WHERE user_id = uid AND active = true) THEN
    RETURN 'establishment';
  END IF;
  RETURN 'customer';
END; $function$;

CREATE OR REPLACE FUNCTION public.my_subscription_gate()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT jsonb_build_object(
    'has_establishment', EXISTS (
      SELECT 1 FROM public.establishment_members m
      WHERE m.user_id = auth.uid() AND m.active = true
    ),
    'active', EXISTS (
      SELECT 1 FROM public.establishment_members m
      WHERE m.user_id = auth.uid() AND m.active = true
        AND public.has_active_subscription(m.establishment_id)
    ),
    'super_admin', public.is_super_admin(auth.uid())
  );
$function$;

CREATE OR REPLACE FUNCTION public.purge_expired_logs()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  pol RECORD;
  removed bigint;
  result jsonb := '{}'::jsonb;
  total bigint := 0;
BEGIN
  FOR pol IN SELECT * FROM public.log_retention_policies LOOP
    CONTINUE WHEN to_regclass('public.' || quote_ident(pol.table_name)) IS NULL;
    CONTINUE WHEN NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = pol.table_name
        AND column_name = pol.timestamp_column
    );

    BEGIN
      EXECUTE format(
        'DELETE FROM public.%I WHERE %I < now() - ($1 || '' days'')::interval',
        pol.table_name, pol.timestamp_column
      ) USING pol.retention_days;
      GET DIAGNOSTICS removed = ROW_COUNT;
    EXCEPTION WHEN OTHERS THEN
      removed := -1; -- tabela protegida (auditoria imutável) ou erro pontual
    END;

    IF removed <> 0 THEN
      result := result || jsonb_build_object(pol.table_name, removed);
      IF removed > 0 THEN total := total + removed; END IF;
    END IF;
  END LOOP;

  INSERT INTO public.log_purge_runs (details, total_deleted) VALUES (result, total);
  RETURN result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.register_sponsored_ad_event(_token text, _event_type text, _session_hash text, _placement text DEFAULT 'wallet_discover'::text, _viewer_user_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_campaign public.sponsored_ad_campaigns%ROWTYPE;
  v_window integer;
  v_bucket text;
  v_inserted boolean := false;
BEGIN
  IF _event_type NOT IN ('impression','click') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_event');
  END IF;
  IF _session_hash IS NULL OR length(_session_hash) < 8 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_session');
  END IF;

  SELECT * INTO v_campaign FROM public.sponsored_ad_campaigns
  WHERE tracking_token = _token LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  IF v_campaign.status <> 'active'
     OR v_campaign.paused_at IS NOT NULL
     OR v_campaign.starts_at IS NULL OR v_campaign.starts_at > now()
     OR v_campaign.ends_at IS NULL OR v_campaign.ends_at <= now() THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'inactive');
  END IF;

  SELECT CASE WHEN _event_type = 'impression' THEN impression_dedupe_minutes ELSE click_dedupe_minutes END
    INTO v_window FROM public.sponsored_ad_settings WHERE id;
  v_window := COALESCE(v_window, 30);

  v_bucket := to_char(
    to_timestamp(floor(extract(epoch FROM now()) / (v_window * 60)) * (v_window * 60)) AT TIME ZONE 'utc',
    'YYYYMMDDHH24MI'
  );

  INSERT INTO public.sponsored_ad_events
    (campaign_id, event_type, session_hash, viewer_user_id, category_id, placement, dedupe_bucket)
  VALUES
    (v_campaign.id, _event_type, _session_hash, _viewer_user_id, v_campaign.category_id,
     COALESCE(_placement, 'wallet_discover'), v_bucket)
  ON CONFLICT ON CONSTRAINT sponsored_ad_events_dedupe_uk DO NOTHING;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  IF NOT v_inserted THEN
    RETURN jsonb_build_object('ok', true, 'counted', false, 'reason', 'deduped');
  END IF;

  INSERT INTO public.sponsored_ad_daily_metrics (campaign_id, metric_date, unique_impressions, unique_clicks)
  VALUES (
    v_campaign.id,
    (now() AT TIME ZONE 'utc')::date,
    CASE WHEN _event_type = 'impression' THEN 1 ELSE 0 END,
    CASE WHEN _event_type = 'click' THEN 1 ELSE 0 END
  )
  ON CONFLICT (campaign_id, metric_date) DO UPDATE SET
    unique_impressions = public.sponsored_ad_daily_metrics.unique_impressions
      + CASE WHEN _event_type = 'impression' THEN 1 ELSE 0 END,
    unique_clicks = public.sponsored_ad_daily_metrics.unique_clicks
      + CASE WHEN _event_type = 'click' THEN 1 ELSE 0 END,
    updated_at = now();

  RETURN jsonb_build_object(
    'ok', true, 'counted', true,
    'destination_type', v_campaign.destination_type,
    'destination_slug', v_campaign.destination_slug
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.sponsored_ads_admin_overview()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT jsonb_build_object(
    'revenue_cents', COALESCE((SELECT sum(amount_cents) FROM public.sponsored_ad_orders WHERE status = 'paid'), 0),
    'refunded_cents', COALESCE((SELECT sum(amount_cents) FROM public.sponsored_ad_orders WHERE status = 'refunded'), 0),
    'orders_paid', (SELECT count(*) FROM public.sponsored_ad_orders WHERE status = 'paid'),
    'orders_pending', (SELECT count(*) FROM public.sponsored_ad_orders WHERE status = 'pending'),
    'by_status', COALESCE((
      SELECT jsonb_object_agg(status, n) FROM (
        SELECT status, count(*) AS n FROM public.sponsored_ad_campaigns GROUP BY status
      ) t
    ), '{}'::jsonb),
    'by_category', COALESCE((
      SELECT jsonb_object_agg(category_id, n) FROM (
        SELECT category_id, count(*) AS n FROM public.sponsored_ad_campaigns
        WHERE status = 'active' GROUP BY category_id
      ) t
    ), '{}'::jsonb),
    'impressions', COALESCE((SELECT sum(unique_impressions) FROM public.sponsored_ad_daily_metrics), 0),
    'clicks', COALESCE((SELECT sum(unique_clicks) FROM public.sponsored_ad_daily_metrics), 0),
    'advertisers', (SELECT count(DISTINCT establishment_id) FROM public.sponsored_ad_campaigns),
    'top_packages', COALESCE((
      SELECT jsonb_agg(t) FROM (
        SELECT package_name_snapshot AS name, count(*) AS sold
        FROM public.sponsored_ad_campaigns
        WHERE package_name_snapshot IS NOT NULL
          AND status IN ('payment_confirmed','scheduled','active','paused','expired')
        GROUP BY 1 ORDER BY 2 DESC LIMIT 5
      ) t
    ), '[]'::jsonb),
    'approval_rate', (
      SELECT CASE WHEN count(*) FILTER (WHERE approved_at IS NOT NULL OR rejected_at IS NOT NULL) = 0 THEN NULL
        ELSE round(
          100.0 * count(*) FILTER (WHERE approved_at IS NOT NULL)
          / count(*) FILTER (WHERE approved_at IS NOT NULL OR rejected_at IS NOT NULL), 1)
        END
      FROM public.sponsored_ad_campaigns
    ),
    'avg_review_minutes', (
      SELECT round(avg(extract(epoch FROM (approved_at - submitted_at)) / 60)::numeric, 1)
      FROM public.sponsored_ad_campaigns
      WHERE approved_at IS NOT NULL AND submitted_at IS NOT NULL
    ),
    'slots', COALESCE((
      SELECT jsonb_object_agg(category_id, n) FROM (
        SELECT category_id, count(*) AS n FROM public.sponsored_ad_campaigns
        WHERE status = 'active' AND paused_at IS NULL
          AND starts_at <= now() AND ends_at > now()
        GROUP BY category_id
      ) t
    ), '{}'::jsonb),
    'max_slots', (SELECT max_ads_per_category FROM public.sponsored_ad_settings WHERE id)
  );
$function$;

CREATE OR REPLACE FUNCTION public.tg_block_mutation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RAISE EXCEPTION 'Registro de auditoria é imutável (% não permitido em %)', TG_OP, TG_TABLE_NAME
    USING ERRCODE = 'insufficient_privilege';
END;
$function$;

CREATE OR REPLACE FUNCTION public.tg_establishment_subscription_events()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  plan_order jsonb := '{"free":0,"starter":1,"pro":2,"enterprise":3,"business":4}'::jsonb;
  from_rank int;
  to_rank int;
BEGIN
  IF (TG_OP = 'UPDATE') THEN
    IF NEW.plan IS DISTINCT FROM OLD.plan THEN
      from_rank := (plan_order->>(OLD.plan::text))::int;
      to_rank := (plan_order->>(NEW.plan::text))::int;
      INSERT INTO public.subscription_events (establishment_id, event_type, from_plan, to_plan, actor_id, message)
      VALUES (
        NEW.id,
        CASE WHEN to_rank > from_rank THEN 'upgrade'
             WHEN to_rank < from_rank THEN 'downgrade'
             ELSE 'plan_change' END,
        OLD.plan, NEW.plan, auth.uid(),
        'Plano alterado de ' || OLD.plan::text || ' para ' || NEW.plan::text
      );
    END IF;
    IF NEW.active IS DISTINCT FROM OLD.active THEN
      INSERT INTO public.subscription_events (establishment_id, event_type, from_plan, to_plan, actor_id, message)
      VALUES (
        NEW.id,
        CASE WHEN NEW.active THEN 'reactivate' ELSE 'cancel' END,
        OLD.plan, NEW.plan, auth.uid(),
        CASE WHEN NEW.active THEN 'Estabelecimento reativado' ELSE 'Estabelecimento bloqueado/cancelado' END
      );
    END IF;
  END IF;
  RETURN NEW;
END; $function$;

CREATE OR REPLACE FUNCTION public.tg_menu_items_stock_status()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.track_stock THEN
    IF COALESCE(NEW.stock_qty, 0) <= 0 THEN
      NEW.stock_qty := COALESCE(NEW.stock_qty, 0);
      NEW.stock_status := 'out_of_stock';
    ELSIF NEW.stock_status = 'out_of_stock' THEN
      NEW.stock_status := 'in_stock';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.tg_menu_status_defaults()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF (TG_OP = 'INSERT') OR (TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status) THEN
    IF NEW.status = 'published' AND NEW.published_at IS NULL THEN
      NEW.published_at := now();
    END IF;
  END IF;
  RETURN NEW;
END
$function$;

CREATE OR REPLACE FUNCTION public.tg_menu_status_history()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.menu_publish_events (menu_id, establishment_id, from_status, to_status, actor_id)
    VALUES (NEW.id, NEW.establishment_id, NULL, NEW.status, auth.uid());
  ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.menu_publish_events (menu_id, establishment_id, from_status, to_status, actor_id)
    VALUES (NEW.id, NEW.establishment_id, OLD.status, NEW.status, auth.uid());
  END IF;
  RETURN NULL;
END
$function$;

CREATE OR REPLACE FUNCTION public.tg_merchant_messages_rate_limit()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE last_at timestamptz;
BEGIN
  IF COALESCE(NEW.source, 'manual') <> 'manual' THEN
    RETURN NEW;
  END IF;

  SELECT MAX(published_at) INTO last_at
    FROM public.merchant_messages
    WHERE establishment_id = NEW.establishment_id
      AND source = 'manual';

  IF last_at IS NOT NULL AND last_at > now() - interval '7 days' THEN
    RAISE EXCEPTION 'Limite atingido: 1 mensagem por semana. Próxima em %', (last_at + interval '7 days')
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.tg_order_number()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.order_number IS NULL OR NEW.order_number = 0 THEN
    SELECT COALESCE(MAX(order_number), 0) + 1 INTO NEW.order_number
      FROM public.orders WHERE establishment_id = NEW.establishment_id;
  END IF;
  RETURN NEW;
END; $function$;

CREATE OR REPLACE FUNCTION public.tg_recompute_tier_after_stamp()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_customer_id uuid;
  v_est_id uuid;
  v_visits int;
  v_from public.customer_tier;
  v_to public.customer_tier;
  v_thresholds jsonb;
BEGIN
  IF NEW.reverted_at IS NOT NULL THEN RETURN NEW; END IF;

  SELECT c.id, c.establishment_id, c.tier, COALESCE(c.visits_count, 0)
    INTO v_customer_id, v_est_id, v_from, v_visits
    FROM public.loyalty_cards lc
    JOIN public.customers c ON c.id = lc.customer_id
   WHERE lc.id = NEW.card_id;

  IF v_customer_id IS NULL THEN RETURN NEW; END IF;

  SELECT COALESCE(tier_thresholds, '{"bronze":0,"prata":10,"ouro":25,"diamante":50}'::jsonb)
    INTO v_thresholds
    FROM public.retention_settings WHERE establishment_id = v_est_id;
  v_thresholds := COALESCE(v_thresholds, '{"bronze":0,"prata":10,"ouro":25,"diamante":50}'::jsonb);

  v_to := public.compute_tier(v_visits, v_thresholds);

  IF v_to <> v_from THEN
    UPDATE public.customers SET tier = v_to, updated_at = now() WHERE id = v_customer_id;
    INSERT INTO public.retention_events (establishment_id, customer_id, event_type, from_value, to_value)
    VALUES (v_est_id, v_customer_id,
            CASE WHEN v_to::text > v_from::text THEN 'tier_up' ELSE 'tier_down' END,
            v_from::text, v_to::text);
  END IF;
  RETURN NEW;
END; $function$;

CREATE OR REPLACE FUNCTION public.tg_rewards_check_achievements()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_user UUID;
BEGIN
  IF NEW.redeemed_at IS NULL OR OLD.redeemed_at IS NOT NULL THEN RETURN NEW; END IF;
  SELECT c.user_id INTO v_user
    FROM public.loyalty_cards lc
    JOIN public.customers c ON c.id = lc.customer_id
   WHERE lc.id = NEW.card_id;
  IF v_user IS NOT NULL THEN
    PERFORM public.check_and_unlock_achievements(v_user);
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.tg_sponsored_ad_campaign_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF current_user = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.status := 'draft';
    NEW.starts_at := NULL;
    NEW.ends_at := NULL;
    NEW.approved_at := NULL;
    NEW.approved_by := NULL;
    NEW.rejected_at := NULL;
    NEW.rejected_by := NULL;
    NEW.is_courtesy := false;
    NEW.price_cents_snapshot := NULL;
    NEW.duration_days_snapshot := NULL;
    NEW.package_name_snapshot := NULL;
    NEW.currency_snapshot := NULL;
    NEW.settings_snapshot := NULL;
    NEW.total_paused_seconds := 0;
    NEW.paused_at := NULL;
    NEW.submitted_at := NULL;
    NEW.terms_accepted_at := NULL;
    NEW.terms_version := NULL;
    NEW.terms_accepted_by := NULL;
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status
     OR NEW.establishment_id IS DISTINCT FROM OLD.establishment_id
     OR NEW.starts_at IS DISTINCT FROM OLD.starts_at
     OR NEW.ends_at IS DISTINCT FROM OLD.ends_at
     OR NEW.approved_at IS DISTINCT FROM OLD.approved_at
     OR NEW.approved_by IS DISTINCT FROM OLD.approved_by
     OR NEW.rejected_at IS DISTINCT FROM OLD.rejected_at
     OR NEW.rejected_by IS DISTINCT FROM OLD.rejected_by
     OR NEW.rejection_reason IS DISTINCT FROM OLD.rejection_reason
     OR NEW.changes_requested_reason IS DISTINCT FROM OLD.changes_requested_reason
     OR NEW.price_cents_snapshot IS DISTINCT FROM OLD.price_cents_snapshot
     OR NEW.duration_days_snapshot IS DISTINCT FROM OLD.duration_days_snapshot
     OR NEW.package_name_snapshot IS DISTINCT FROM OLD.package_name_snapshot
     OR NEW.currency_snapshot IS DISTINCT FROM OLD.currency_snapshot
     OR NEW.settings_snapshot IS DISTINCT FROM OLD.settings_snapshot
     OR NEW.is_courtesy IS DISTINCT FROM OLD.is_courtesy
     OR NEW.paused_at IS DISTINCT FROM OLD.paused_at
     OR NEW.total_paused_seconds IS DISTINCT FROM OLD.total_paused_seconds
     OR NEW.tracking_token IS DISTINCT FROM OLD.tracking_token
     OR NEW.submitted_at IS DISTINCT FROM OLD.submitted_at
     OR NEW.terms_accepted_at IS DISTINCT FROM OLD.terms_accepted_at
     OR NEW.terms_version IS DISTINCT FROM OLD.terms_version
  THEN
    RAISE EXCEPTION 'Alteração não permitida: status, período, preço e aprovação são controlados pelo servidor.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.tg_stamps_check_achievements()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_user UUID;
BEGIN
  IF NEW.reverted_at IS NOT NULL THEN RETURN NEW; END IF;
  SELECT c.user_id INTO v_user
    FROM public.loyalty_cards lc
    JOIN public.customers c ON c.id = lc.customer_id
   WHERE lc.id = NEW.card_id;
  IF v_user IS NOT NULL THEN
    PERFORM public.check_and_unlock_achievements(v_user);
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.tg_support_message_after_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.is_internal THEN RETURN NEW; END IF;

  IF NEW.sender_type = 'admin' THEN
    UPDATE public.support_tickets
      SET has_unread_customer = true,
          has_unread_admin    = false,
          first_response_at   = COALESCE(first_response_at, NEW.created_at),
          status              = CASE WHEN status IN ('closed','resolved') THEN status
                                     ELSE 'waiting_customer' END,
          updated_at          = now()
      WHERE id = NEW.ticket_id;
  ELSIF NEW.sender_type = 'customer' THEN
    UPDATE public.support_tickets
      SET has_unread_admin    = true,
          has_unread_customer = false,
          status              = CASE WHEN status IN ('closed') THEN status
                                     WHEN status IN ('resolved') THEN 'open'
                                     ELSE 'in_progress' END,
          updated_at          = now()
      WHERE id = NEW.ticket_id;
  END IF;
  RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION public.tg_support_status_history()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.support_status_history (ticket_id, from_status, to_status, changed_by, reason)
    VALUES (NEW.id, NULL, NEW.status, NEW.requester_user_id, 'Ticket criado');
  ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.support_status_history (ticket_id, from_status, to_status, changed_by, reason)
    VALUES (NEW.id, OLD.status, NEW.status, auth.uid(), NULL);
    IF NEW.status = 'resolved' AND NEW.resolved_at IS NULL THEN NEW.resolved_at := now(); END IF;
    IF NEW.status = 'closed' AND NEW.closed_at IS NULL THEN NEW.closed_at := now(); END IF;
  END IF;
  RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION public.tg_ticket_defaults()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.due_first_response_at IS NULL THEN
    NEW.due_first_response_at := NEW.created_at + CASE NEW.priority
      WHEN 'urgent' THEN interval '1 hour'
      WHEN 'high' THEN interval '4 hours'
      WHEN 'normal' THEN interval '8 hours'
      ELSE interval '24 hours' END;
  END IF;
  IF NEW.due_resolution_at IS NULL THEN
    NEW.due_resolution_at := NEW.created_at + CASE NEW.priority
      WHEN 'urgent' THEN interval '8 hours'
      WHEN 'high' THEN interval '1 day'
      WHEN 'normal' THEN interval '3 days'
      ELSE interval '5 days' END;
  END IF;
  RETURN NEW;
END; $function$;

CREATE OR REPLACE FUNCTION public.tg_ticket_first_response()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.author_type = 'agent' AND NEW.internal = false THEN
    UPDATE public.tickets
      SET first_response_at = COALESCE(first_response_at, NEW.created_at),
          status = CASE WHEN status = 'open' THEN 'pending' ELSE status END,
          updated_at = now()
      WHERE id = NEW.ticket_id;
  ELSIF NEW.author_type = 'customer' AND NEW.internal = false THEN
    UPDATE public.tickets
      SET status = CASE WHEN status IN ('solved','closed') THEN 'open' ELSE status END,
          updated_at = now()
      WHERE id = NEW.ticket_id;
  END IF;
  RETURN NEW;
END; $function$;

CREATE OR REPLACE FUNCTION public.tg_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $function$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

-- ---------------------------------------------------------------------
-- 6. VIEWS
-- ---------------------------------------------------------------------
-- (nenhuma view no schema public)

-- ---------------------------------------------------------------------
-- 7. TRIGGERS
-- ---------------------------------------------------------------------
CREATE TRIGGER trg_ai_findings_state_updated BEFORE UPDATE ON public.ai_findings_state FOR EACH ROW EXECUTE FUNCTION tg_updated_at();
CREATE TRIGGER audit_logs_immutable BEFORE DELETE OR UPDATE ON public.audit_logs FOR EACH ROW EXECUTE FUNCTION tg_block_mutation();
CREATE TRIGGER camp_updated BEFORE UPDATE ON public.campaigns FOR EACH ROW EXECUTE FUNCTION tg_updated_at();
CREATE TRIGGER trg_customer_reviews_updated BEFORE UPDATE ON public.customer_reviews FOR EACH ROW EXECUTE FUNCTION tg_updated_at();
CREATE TRIGGER cust_updated BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION tg_updated_at();
CREATE TRIGGER trg_email_queue_updated_at BEFORE UPDATE ON public.email_queue FOR EACH ROW EXECUTE FUNCTION tg_updated_at();
CREATE TRIGGER trg_email_templates_updated_at BEFORE UPDATE ON public.email_templates FOR EACH ROW EXECUTE FUNCTION tg_updated_at();
CREATE TRIGGER trg_feature_overrides_updated_at BEFORE UPDATE ON public.establishment_feature_overrides FOR EACH ROW EXECUTE FUNCTION tg_updated_at();
CREATE TRIGGER trg_goals_updated_at BEFORE UPDATE ON public.establishment_goals FOR EACH ROW EXECUTE FUNCTION tg_updated_at();
CREATE TRIGGER trg_settings_updated BEFORE UPDATE ON public.establishment_settings FOR EACH ROW EXECUTE FUNCTION tg_updated_at();
CREATE TRIGGER est_updated BEFORE UPDATE ON public.establishments FOR EACH ROW EXECUTE FUNCTION tg_updated_at();
CREATE TRIGGER trg_establishment_sub_events AFTER UPDATE ON public.establishments FOR EACH ROW EXECUTE FUNCTION tg_establishment_subscription_events();
CREATE TRIGGER trg_help_articles_updated_at BEFORE UPDATE ON public.help_articles FOR EACH ROW EXECUTE FUNCTION tg_updated_at();
CREATE TRIGGER trg_help_categories_updated_at BEFORE UPDATE ON public.help_categories FOR EACH ROW EXECUTE FUNCTION tg_updated_at();
CREATE TRIGGER integrations_set_updated_at BEFORE UPDATE ON public.integrations FOR EACH ROW EXECUTE FUNCTION tg_updated_at();
CREATE TRIGGER trg_kba_updated BEFORE UPDATE ON public.kb_articles FOR EACH ROW EXECUTE FUNCTION tg_updated_at();
CREATE TRIGGER trg_kbc_updated BEFORE UPDATE ON public.kb_categories FOR EACH ROW EXECUTE FUNCTION tg_updated_at();
CREATE TRIGGER landing_content_updated_at BEFORE UPDATE ON public.landing_content FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER link_tree_links_updated_at BEFORE UPDATE ON public.link_tree_links FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER link_tree_pages_updated_at BEFORE UPDATE ON public.link_tree_pages FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER card_updated BEFORE UPDATE ON public.loyalty_cards FOR EACH ROW EXECUTE FUNCTION tg_updated_at();
CREATE TRIGGER member_permissions_touch BEFORE UPDATE ON public.member_permissions FOR EACH ROW EXECUTE FUNCTION tg_updated_at();
CREATE TRIGGER trg_menu_categories_updated BEFORE UPDATE ON public.menu_categories FOR EACH ROW EXECUTE FUNCTION tg_updated_at();
CREATE TRIGGER trg_menu_items_stock_status BEFORE INSERT OR UPDATE ON public.menu_items FOR EACH ROW EXECUTE FUNCTION tg_menu_items_stock_status();
CREATE TRIGGER trg_menu_items_updated BEFORE UPDATE ON public.menu_items FOR EACH ROW EXECUTE FUNCTION tg_updated_at();
CREATE TRIGGER trg_menu_qr_designs_updated BEFORE UPDATE ON public.menu_qr_designs FOR EACH ROW EXECUTE FUNCTION tg_updated_at();
CREATE TRIGGER trg_merchant_messages_rate_limit BEFORE INSERT ON public.merchant_messages FOR EACH ROW EXECUTE FUNCTION tg_merchant_messages_rate_limit();
CREATE TRIGGER trg_merchant_messages_updated_at BEFORE UPDATE ON public.merchant_messages FOR EACH ROW EXECUTE FUNCTION tg_updated_at();
CREATE TRIGGER trg_tpl_updated BEFORE UPDATE ON public.notification_templates FOR EACH ROW EXECUTE FUNCTION tg_updated_at();
CREATE TRIGGER orders_updated_at BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION tg_updated_at();
CREATE TRIGGER set_order_number BEFORE INSERT ON public.orders FOR EACH ROW EXECUTE FUNCTION tg_order_number();
CREATE TRIGGER payment_logs_immutable BEFORE DELETE OR UPDATE ON public.payment_logs FOR EACH ROW EXECUTE FUNCTION tg_block_mutation();
CREATE TRIGGER trg_ppc_updated BEFORE UPDATE ON public.payment_provider_credentials FOR EACH ROW EXECUTE FUNCTION tg_updated_at();
CREATE TRIGGER trg_payment_settings_updated BEFORE UPDATE ON public.payment_settings FOR EACH ROW EXECUTE FUNCTION tg_updated_at();
CREATE TRIGGER trg_payments_updated BEFORE UPDATE ON public.payments FOR EACH ROW EXECUTE FUNCTION tg_updated_at();
CREATE TRIGGER plans_updated_at BEFORE UPDATE ON public.plans FOR EACH ROW EXECUTE FUNCTION tg_updated_at();
CREATE TRIGGER poster_designs_updated_at BEFORE UPDATE ON public.poster_designs FOR EACH ROW EXECUTE FUNCTION tg_updated_at();
CREATE TRIGGER print_orders_updated_at BEFORE UPDATE ON public.print_orders FOR EACH ROW EXECUTE FUNCTION tg_updated_at();
CREATE TRIGGER profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION tg_updated_at();
CREATE TRIGGER promotions_set_updated_at BEFORE UPDATE ON public.promotions FOR EACH ROW EXECUTE FUNCTION tg_updated_at();
CREATE TRIGGER trg_push_subs_updated_at BEFORE UPDATE ON public.push_subscriptions FOR EACH ROW EXECUTE FUNCTION tg_updated_at();
CREATE TRIGGER qr_tags_updated_at BEFORE UPDATE ON public.qr_tags FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_restaurant_menus_status_defaults BEFORE INSERT OR UPDATE ON public.restaurant_menus FOR EACH ROW EXECUTE FUNCTION tg_menu_status_defaults();
CREATE TRIGGER trg_restaurant_menus_status_history AFTER INSERT OR UPDATE ON public.restaurant_menus FOR EACH ROW EXECUTE FUNCTION tg_menu_status_history();
CREATE TRIGGER trg_restaurant_menus_updated BEFORE UPDATE ON public.restaurant_menus FOR EACH ROW EXECUTE FUNCTION tg_updated_at();
CREATE TRIGGER trg_retention_settings_updated_at BEFORE UPDATE ON public.retention_settings FOR EACH ROW EXECUTE FUNCTION tg_updated_at();
CREATE TRIGGER trg_review_forms_updated BEFORE UPDATE ON public.review_forms FOR EACH ROW EXECUTE FUNCTION tg_updated_at();
CREATE TRIGGER trg_review_questions_updated BEFORE UPDATE ON public.review_questions FOR EACH ROW EXECUTE FUNCTION tg_updated_at();
CREATE TRIGGER trg_review_options_updated BEFORE UPDATE ON public.review_rating_options FOR EACH ROW EXECUTE FUNCTION tg_updated_at();
CREATE TRIGGER trg_review_settings_updated BEFORE UPDATE ON public.review_settings FOR EACH ROW EXECUTE FUNCTION tg_updated_at();
CREATE TRIGGER trg_reviews_updated BEFORE UPDATE ON public.reviews FOR EACH ROW EXECUTE FUNCTION tg_updated_at();
CREATE TRIGGER trg_rewards_check_achievements AFTER UPDATE OF redeemed_at ON public.rewards FOR EACH ROW EXECUTE FUNCTION tg_rewards_check_achievements();
CREATE TRIGGER trg_scheduled_pushes_updated BEFORE UPDATE ON public.scheduled_pushes FOR EACH ROW EXECUTE FUNCTION tg_updated_at();
CREATE TRIGGER trg_ads_campaigns_guard BEFORE INSERT OR UPDATE ON public.sponsored_ad_campaigns FOR EACH ROW EXECUTE FUNCTION tg_sponsored_ad_campaign_guard();
CREATE TRIGGER trg_ads_campaigns_updated_at BEFORE UPDATE ON public.sponsored_ad_campaigns FOR EACH ROW EXECUTE FUNCTION tg_updated_at();
CREATE TRIGGER trg_ads_events_immutable BEFORE DELETE OR UPDATE ON public.sponsored_ad_events FOR EACH ROW EXECUTE FUNCTION tg_block_mutation();
CREATE TRIGGER trg_ads_orders_updated_at BEFORE UPDATE ON public.sponsored_ad_orders FOR EACH ROW EXECUTE FUNCTION tg_updated_at();
CREATE TRIGGER trg_ads_packages_updated_at BEFORE UPDATE ON public.sponsored_ad_packages FOR EACH ROW EXECUTE FUNCTION tg_updated_at();
CREATE TRIGGER trg_ads_reviews_immutable BEFORE DELETE OR UPDATE ON public.sponsored_ad_reviews FOR EACH ROW EXECUTE FUNCTION tg_block_mutation();
CREATE TRIGGER trg_stamps_check_achievements AFTER INSERT ON public.stamps FOR EACH ROW EXECUTE FUNCTION tg_stamps_check_achievements();
CREATE TRIGGER trg_stamps_recompute_tier AFTER INSERT ON public.stamps FOR EACH ROW EXECUTE FUNCTION tg_recompute_tier_after_stamp();
CREATE TRIGGER subscription_events_immutable BEFORE DELETE OR UPDATE ON public.subscription_events FOR EACH ROW EXECUTE FUNCTION tg_block_mutation();
CREATE TRIGGER trg_subs_updated BEFORE UPDATE ON public.subscriptions FOR EACH ROW EXECUTE FUNCTION tg_updated_at();
CREATE TRIGGER trg_support_message_after_insert AFTER INSERT ON public.support_messages FOR EACH ROW EXECUTE FUNCTION tg_support_message_after_insert();
CREATE TRIGGER trg_support_quick_replies_updated BEFORE UPDATE ON public.support_quick_replies FOR EACH ROW EXECUTE FUNCTION tg_updated_at();
CREATE TRIGGER trg_support_status_history_ins AFTER INSERT ON public.support_tickets FOR EACH ROW EXECUTE FUNCTION tg_support_status_history();
CREATE TRIGGER trg_support_status_history_upd BEFORE UPDATE ON public.support_tickets FOR EACH ROW EXECUTE FUNCTION tg_support_status_history();
CREATE TRIGGER trg_support_tickets_updated BEFORE UPDATE ON public.support_tickets FOR EACH ROW EXECUTE FUNCTION tg_updated_at();
CREATE TRIGGER trg_system_email_settings_updated_at BEFORE UPDATE ON public.system_email_settings FOR EACH ROW EXECUTE FUNCTION tg_updated_at();
CREATE TRIGGER trg_ticket_first_response AFTER INSERT ON public.ticket_messages FOR EACH ROW EXECUTE FUNCTION tg_ticket_first_response();
CREATE TRIGGER trg_ticket_defaults BEFORE INSERT ON public.tickets FOR EACH ROW EXECUTE FUNCTION tg_ticket_defaults();
CREATE TRIGGER trg_tk_updated BEFORE UPDATE ON public.tickets FOR EACH ROW EXECUTE FUNCTION tg_updated_at();
CREATE TRIGGER trg_user_notifications_updated_at BEFORE UPDATE ON public.user_notifications FOR EACH ROW EXECUTE FUNCTION tg_updated_at();
CREATE TRIGGER wallet_pass_devices_updated_at BEFORE UPDATE ON public.wallet_pass_devices FOR EACH ROW EXECUTE FUNCTION tg_updated_at();
CREATE TRIGGER wallet_passes_updated_at BEFORE UPDATE ON public.wallet_passes FOR EACH ROW EXECUTE FUNCTION tg_updated_at();
CREATE TRIGGER wallet_settings_updated_at BEFORE UPDATE ON public.wallet_settings FOR EACH ROW EXECUTE FUNCTION tg_updated_at();
CREATE TRIGGER trg_webhooks_updated BEFORE UPDATE ON public.webhooks FOR EACH ROW EXECUTE FUNCTION tg_updated_at();

-- ---------------------------------------------------------------------
-- 8. GRANTS (Data API / PostgREST)
-- ---------------------------------------------------------------------

-- ---------------------------------------------------------------------
-- 9. ROW LEVEL SECURITY + POLICIES
-- ---------------------------------------------------------------------
alter table public.achievements enable row level security;
alter table public.ai_analyses enable row level security;
alter table public.ai_findings_state enable row level security;
alter table public.ai_usage enable row level security;
alter table public.api_keys enable row level security;
alter table public.app_engagement_events enable row level security;
alter table public.app_roles enable row level security;
alter table public.audit_logs enable row level security;
alter table public.auth_attempts enable row level security;
alter table public.campaigns enable row level security;
alter table public.channel_events enable row level security;
alter table public.consents enable row level security;
alter table public.coupons enable row level security;
alter table public.customer_achievements enable row level security;
alter table public.customer_reviews enable row level security;
alter table public.customers enable row level security;
alter table public.data_requests enable row level security;
alter table public.email_logs enable row level security;
alter table public.email_queue enable row level security;
alter table public.email_templates enable row level security;
alter table public.establishment_feature_overrides enable row level security;
alter table public.establishment_goals enable row level security;
alter table public.establishment_members enable row level security;
alter table public.establishment_settings enable row level security;
alter table public.establishments enable row level security;
alter table public.feature_gate_events enable row level security;
alter table public.help_article_views enable row level security;
alter table public.help_articles enable row level security;
alter table public.help_categories enable row level security;
alter table public.help_feedback enable row level security;
alter table public.helpdesk_members enable row level security;
alter table public.integrations enable row level security;
alter table public.kb_articles enable row level security;
alter table public.kb_categories enable row level security;
alter table public.kb_feedback enable row level security;
alter table public.landing_content enable row level security;
alter table public.link_tree_links enable row level security;
alter table public.link_tree_pages enable row level security;
alter table public.log_purge_runs enable row level security;
alter table public.log_retention_policies enable row level security;
alter table public.loyalty_cards enable row level security;
alter table public.member_permissions enable row level security;
alter table public.menu_categories enable row level security;
alter table public.menu_item_favorites enable row level security;
alter table public.menu_item_media enable row level security;
alter table public.menu_items enable row level security;
alter table public.menu_publish_events enable row level security;
alter table public.menu_qr_designs enable row level security;
alter table public.merchant_message_reads enable row level security;
alter table public.merchant_messages enable row level security;
alter table public.notification_templates enable row level security;
alter table public.order_items enable row level security;
alter table public.orders enable row level security;
alter table public.payment_logs enable row level security;
alter table public.payment_provider_credentials enable row level security;
alter table public.payment_settings enable row level security;
alter table public.payments enable row level security;
alter table public.pixel_events enable row level security;
alter table public.plan_features enable row level security;
alter table public.plan_funnel_events enable row level security;
alter table public.plans enable row level security;
alter table public.poster_designs enable row level security;
alter table public.print_orders enable row level security;
alter table public.profiles enable row level security;
alter table public.profiles_account_type_backup enable row level security;
alter table public.promotions enable row level security;
alter table public.push_events enable row level security;
alter table public.push_logs enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.qr_scans enable row level security;
alter table public.qr_tags enable row level security;
alter table public.restaurant_menus enable row level security;
alter table public.retention_dispatches enable row level security;
alter table public.retention_events enable row level security;
alter table public.retention_settings enable row level security;
alter table public.review_answers enable row level security;
alter table public.review_events enable row level security;
alter table public.review_forms enable row level security;
alter table public.review_questions enable row level security;
alter table public.review_rating_options enable row level security;
alter table public.review_settings enable row level security;
alter table public.reviews enable row level security;
alter table public.rewards enable row level security;
alter table public.scheduled_pushes enable row level security;
alter table public.sponsored_ad_campaigns enable row level security;
alter table public.sponsored_ad_daily_metrics enable row level security;
alter table public.sponsored_ad_events enable row level security;
alter table public.sponsored_ad_orders enable row level security;
alter table public.sponsored_ad_packages enable row level security;
alter table public.sponsored_ad_reviews enable row level security;
alter table public.sponsored_ad_settings enable row level security;
alter table public.stamps enable row level security;
alter table public.subscription_events enable row level security;
alter table public.subscriptions enable row level security;
alter table public.support_messages enable row level security;
alter table public.support_quick_replies enable row level security;
alter table public.support_status_history enable row level security;
alter table public.support_tickets enable row level security;
alter table public.system_email_settings enable row level security;
alter table public.team_invites enable row level security;
alter table public.ticket_messages enable row level security;
alter table public.ticket_quick_replies enable row level security;
alter table public.tickets enable row level security;
alter table public.user_notifications enable row level security;
alter table public.wallet_pass_devices enable row level security;
alter table public.wallet_passes enable row level security;
alter table public.wallet_settings enable row level security;
alter table public.webhook_deliveries enable row level security;
alter table public.webhooks enable row level security;

create policy "achievements_public_read" on public.achievements as permissive for select to public
  using ((is_active = true));
create policy "ai_analyses_delete" on public.ai_analyses as permissive for delete to authenticated
  using (has_establishment_role(auth.uid(), establishment_id, 'manager'::member_role));
create policy "ai_analyses_insert" on public.ai_analyses as permissive for insert to authenticated
  with check (has_establishment_access(auth.uid(), establishment_id));
create policy "ai_analyses_select" on public.ai_analyses as permissive for select to authenticated
  using (has_establishment_access(auth.uid(), establishment_id));
create policy "ai_analyses_update" on public.ai_analyses as permissive for update to authenticated
  using (has_establishment_access(auth.uid(), establishment_id));
create policy "ai_findings_state_all" on public.ai_findings_state as permissive for all to authenticated
  using (has_establishment_access(auth.uid(), establishment_id))
  with check (has_establishment_access(auth.uid(), establishment_id));
create policy "ai_usage_insert" on public.ai_usage as permissive for insert to authenticated
  with check (has_establishment_access(auth.uid(), establishment_id));
create policy "ai_usage_select" on public.ai_usage as permissive for select to authenticated
  using (has_establishment_access(auth.uid(), establishment_id));
create policy "apik_manager_read" on public.api_keys as permissive for select to authenticated
  using (has_establishment_role(auth.uid(), establishment_id, 'manager'::member_role));
create policy "apik_manager_update" on public.api_keys as permissive for update to authenticated
  using (has_establishment_role(auth.uid(), establishment_id, 'manager'::member_role))
  with check (has_establishment_role(auth.uid(), establishment_id, 'manager'::member_role));
create policy "apik_manager_write" on public.api_keys as permissive for insert to authenticated
  with check (has_establishment_role(auth.uid(), establishment_id, 'manager'::member_role));
create policy "members read establishment engagement events" on public.app_engagement_events as permissive for select to authenticated
  using (((establishment_id IS NOT NULL) AND has_establishment_access(auth.uid(), establishment_id)));
create policy "read own engagement events" on public.app_engagement_events as permissive for select to authenticated
  using ((user_id = auth.uid()));
create policy "super admin reads engagement events" on public.app_engagement_events as permissive for select to authenticated
  using (is_super_admin(auth.uid()));
create policy "users insert own engagement events" on public.app_engagement_events as permissive for insert to authenticated
  with check ((user_id = auth.uid()));
create policy "app_roles_self_read" on public.app_roles as permissive for select to authenticated
  using ((user_id = auth.uid()));
create policy "audit_admin_read" on public.audit_logs as permissive for select to authenticated
  using (is_super_admin(auth.uid()));
create policy "audit_manager_read" on public.audit_logs as permissive for select to authenticated
  using (has_establishment_role(auth.uid(), establishment_id, 'manager'::member_role));
create policy "Super admins can read auth attempts" on public.auth_attempts as permissive for select to authenticated
  using (is_super_admin(auth.uid()));
create policy "camp_auth_read" on public.campaigns as permissive for select to authenticated
  using (((active = true) OR has_establishment_access(auth.uid(), establishment_id)));
create policy "camp_manager_write" on public.campaigns as permissive for all to authenticated
  using (has_establishment_role(auth.uid(), establishment_id, 'manager'::member_role))
  with check (has_establishment_role(auth.uid(), establishment_id, 'manager'::member_role));
create policy "camp_public_read" on public.campaigns as permissive for select to anon
  using ((active = true));
create policy "campaigns_admin_read" on public.campaigns as permissive for select to authenticated
  using (is_super_admin(auth.uid()));
create policy "campaigns_requires_active_subscription" on public.campaigns as restrictive for insert to authenticated
  with check ((is_super_admin(auth.uid()) OR has_active_subscription(establishment_id)));
create policy "members read channel events" on public.channel_events as permissive for select to authenticated
  using (has_establishment_access(auth.uid(), establishment_id));
create policy "consents_member_read" on public.consents as permissive for select to authenticated
  using (has_establishment_access(auth.uid(), establishment_id));
create policy "coupons_admin_all" on public.coupons as permissive for all to authenticated
  using (is_super_admin(auth.uid()))
  with check (is_super_admin(auth.uid()));
create policy "customer_achievements_owner_read" on public.customer_achievements as permissive for select to authenticated
  using ((auth.uid() = user_id));
create policy "customer_achievements_owner_update_seen" on public.customer_achievements as permissive for update to authenticated
  using ((auth.uid() = user_id))
  with check ((auth.uid() = user_id));
create policy "Public can read non-hidden reviews of active establishments" on public.customer_reviews as permissive for select to anon, authenticated
  using (((public_hidden = false) AND (EXISTS ( SELECT 1
   FROM establishments e
  WHERE ((e.id = customer_reviews.establishment_id) AND (e.active = true))))));
create policy "managers delete reviews" on public.customer_reviews as permissive for delete to authenticated
  using (has_establishment_role(auth.uid(), establishment_id, 'manager'::member_role));
create policy "managers update reviews" on public.customer_reviews as permissive for update to authenticated
  using (has_establishment_role(auth.uid(), establishment_id, 'manager'::member_role))
  with check (has_establishment_role(auth.uid(), establishment_id, 'manager'::member_role));
create policy "members read reviews" on public.customer_reviews as permissive for select to authenticated
  using (has_establishment_access(auth.uid(), establishment_id));
create policy "cust_manager_delete" on public.customers as permissive for delete to authenticated
  using (has_establishment_role(auth.uid(), establishment_id, 'manager'::member_role));
create policy "cust_member_read" on public.customers as permissive for select to authenticated
  using (has_establishment_access(auth.uid(), establishment_id));
create policy "cust_self_read" on public.customers as permissive for select to authenticated
  using ((user_id = auth.uid()));
create policy "cust_self_update" on public.customers as permissive for update to authenticated
  using ((user_id = auth.uid()))
  with check ((user_id = auth.uid()));
create policy "cust_staff_insert" on public.customers as permissive for insert to authenticated
  with check (has_establishment_access(auth.uid(), establishment_id));
create policy "cust_staff_update" on public.customers as permissive for update to authenticated
  using (has_establishment_access(auth.uid(), establishment_id));
create policy "customers_admin_read" on public.customers as permissive for select to authenticated
  using (is_super_admin(auth.uid()));
create policy "customers_requires_active_subscription" on public.customers as restrictive for insert to authenticated
  with check ((is_super_admin(auth.uid()) OR has_active_subscription(establishment_id)));
create policy "dr_manager_read" on public.data_requests as permissive for select to authenticated
  using (has_establishment_role(auth.uid(), establishment_id, 'manager'::member_role));
create policy "dr_manager_update" on public.data_requests as permissive for update to authenticated
  using (has_establishment_role(auth.uid(), establishment_id, 'manager'::member_role))
  with check (has_establishment_role(auth.uid(), establishment_id, 'manager'::member_role));
create policy "dr_manager_write" on public.data_requests as permissive for insert to authenticated
  with check (has_establishment_role(auth.uid(), establishment_id, 'manager'::member_role));
create policy "Super admins read email logs" on public.email_logs as permissive for select to authenticated
  using (is_super_admin(auth.uid()));
create policy "deny_all_client_access" on public.email_queue as permissive for all to anon, authenticated
  using (false)
  with check (false);
create policy "deny_all_client_access" on public.email_templates as permissive for all to anon, authenticated
  using (false)
  with check (false);
create policy "Members can view their overrides" on public.establishment_feature_overrides as permissive for select to authenticated
  using (has_establishment_access(auth.uid(), establishment_id));
create policy "Super admins manage feature overrides" on public.establishment_feature_overrides as permissive for all to authenticated
  using (is_super_admin(auth.uid()))
  with check (is_super_admin(auth.uid()));
create policy "managers manage goals" on public.establishment_goals as permissive for all to authenticated
  using (has_establishment_role(auth.uid(), establishment_id, 'manager'::member_role))
  with check (has_establishment_role(auth.uid(), establishment_id, 'manager'::member_role));
create policy "members read goals" on public.establishment_goals as permissive for select to authenticated
  using (has_establishment_access(auth.uid(), establishment_id));
create policy "members_admin_read" on public.establishment_members as permissive for select to authenticated
  using (is_super_admin(auth.uid()));
create policy "members_delete" on public.establishment_members as permissive for delete to authenticated
  using (has_establishment_role(auth.uid(), establishment_id, 'owner'::member_role));
create policy "members_insert" on public.establishment_members as permissive for insert to authenticated
  with check ((has_establishment_role(auth.uid(), establishment_id, 'owner'::member_role) OR ((user_id = auth.uid()) AND (role = 'owner'::member_role) AND (EXISTS ( SELECT 1
   FROM establishments e
  WHERE ((e.id = establishment_members.establishment_id) AND (e.created_by = auth.uid())))) AND (NOT (EXISTS ( SELECT 1
   FROM establishment_members m
  WHERE (m.establishment_id = establishment_members.establishment_id)))))));
create policy "members_self_read" on public.establishment_members as permissive for select to authenticated
  using (((user_id = auth.uid()) OR has_establishment_role(auth.uid(), establishment_id, 'manager'::member_role)));
create policy "members_update" on public.establishment_members as permissive for update to authenticated
  using (has_establishment_role(auth.uid(), establishment_id, 'owner'::member_role));
create policy "settings_manager_update" on public.establishment_settings as permissive for update to authenticated
  using (has_establishment_role(auth.uid(), establishment_id, 'manager'::member_role))
  with check (has_establishment_role(auth.uid(), establishment_id, 'manager'::member_role));
create policy "settings_manager_write" on public.establishment_settings as permissive for insert to authenticated
  with check (has_establishment_role(auth.uid(), establishment_id, 'manager'::member_role));
create policy "settings_member_read" on public.establishment_settings as permissive for select to authenticated
  using (has_establishment_access(auth.uid(), establishment_id));
create policy "est_admin_all" on public.establishments as permissive for all to authenticated
  using (is_super_admin(auth.uid()))
  with check (is_super_admin(auth.uid()));
create policy "est_auth_read" on public.establishments as permissive for select to authenticated
  using (((active = true) OR has_establishment_access(auth.uid(), id)));
create policy "est_owner_delete" on public.establishments as permissive for delete to authenticated
  using (has_establishment_role(auth.uid(), id, 'owner'::member_role));
create policy "est_owner_insert" on public.establishments as permissive for insert to authenticated
  with check ((auth.uid() = created_by));
create policy "est_owner_update" on public.establishments as permissive for update to authenticated
  using (has_establishment_role(auth.uid(), id, 'owner'::member_role));
create policy "est_public_read" on public.establishments as permissive for select to anon
  using ((active = true));
create policy "members insert own establishment gate events" on public.feature_gate_events as permissive for insert to authenticated
  with check (has_establishment_access(auth.uid(), establishment_id));
create policy "members read own establishment gate events" on public.feature_gate_events as permissive for select to authenticated
  using (has_establishment_role(auth.uid(), establishment_id, 'manager'::member_role));
create policy "super admin reads all gate events" on public.feature_gate_events as permissive for select to authenticated
  using (is_super_admin(auth.uid()));
create policy "help_article_views_insert_valid_article" on public.help_article_views as permissive for insert to authenticated
  with check ((EXISTS ( SELECT 1
   FROM help_articles a
  WHERE (a.id = help_article_views.article_id))));
create policy "help_article_views_read_admin" on public.help_article_views as permissive for select to authenticated
  using (is_super_admin(auth.uid()));
create policy "help_articles_admin_write" on public.help_articles as permissive for all to authenticated
  using (is_super_admin(auth.uid()))
  with check (is_super_admin(auth.uid()));
create policy "help_articles_read_admin" on public.help_articles as permissive for select to authenticated
  using (is_super_admin(auth.uid()));
create policy "help_articles_read_public" on public.help_articles as permissive for select to anon, authenticated
  using ((published = true));
create policy "help_categories_admin_write" on public.help_categories as permissive for all to authenticated
  using (is_super_admin(auth.uid()))
  with check (is_super_admin(auth.uid()));
create policy "help_categories_read_admin" on public.help_categories as permissive for select to authenticated
  using (is_super_admin(auth.uid()));
create policy "help_categories_read_public" on public.help_categories as permissive for select to anon, authenticated
  using ((active = true));
create policy "help_feedback_insert_valid_article" on public.help_feedback as permissive for insert to authenticated
  with check ((EXISTS ( SELECT 1
   FROM help_articles a
  WHERE (a.id = help_feedback.article_id))));
create policy "help_feedback_read_admin" on public.help_feedback as permissive for select to authenticated
  using (is_super_admin(auth.uid()));
create policy "hm_delete" on public.helpdesk_members as permissive for delete to authenticated
  using (is_helpdesk_admin(auth.uid(), establishment_id));
create policy "hm_insert" on public.helpdesk_members as permissive for insert to authenticated
  with check (is_helpdesk_admin(auth.uid(), establishment_id));
create policy "hm_select" on public.helpdesk_members as permissive for select to authenticated
  using (((user_id = auth.uid()) OR is_helpdesk_admin(auth.uid(), establishment_id)));
create policy "hm_update" on public.helpdesk_members as permissive for update to authenticated
  using (is_helpdesk_admin(auth.uid(), establishment_id));
create policy "integrations_super_admin_delete" on public.integrations as permissive for delete to authenticated
  using (is_super_admin(auth.uid()));
create policy "integrations_super_admin_insert" on public.integrations as permissive for insert to authenticated
  with check (is_super_admin(auth.uid()));
create policy "integrations_super_admin_select" on public.integrations as permissive for select to authenticated
  using (is_super_admin(auth.uid()));
create policy "integrations_super_admin_update" on public.integrations as permissive for update to authenticated
  using (is_super_admin(auth.uid()))
  with check (is_super_admin(auth.uid()));
create policy "kba_agent_select" on public.kb_articles as permissive for select to authenticated
  using (is_helpdesk_agent(auth.uid(), establishment_id));
create policy "kba_manage" on public.kb_articles as permissive for all to authenticated
  using (is_helpdesk_agent(auth.uid(), establishment_id))
  with check (is_helpdesk_agent(auth.uid(), establishment_id));
create policy "kba_public_select" on public.kb_articles as permissive for select to anon, authenticated
  using ((published = true));
create policy "kbc_manage" on public.kb_categories as permissive for all to authenticated
  using (is_helpdesk_agent(auth.uid(), establishment_id))
  with check (is_helpdesk_agent(auth.uid(), establishment_id));
create policy "kbc_public_select" on public.kb_categories as permissive for select to public
  using ((EXISTS ( SELECT 1
   FROM kb_articles a
  WHERE ((a.category_id = kb_categories.id) AND (a.published = true)))));
create policy "kbf_agent_select" on public.kb_feedback as permissive for select to authenticated
  using ((EXISTS ( SELECT 1
   FROM kb_articles a
  WHERE ((a.id = kb_feedback.article_id) AND is_helpdesk_agent(auth.uid(), a.establishment_id)))));
create policy "kbf_insert_valid_article" on public.kb_feedback as permissive for insert to authenticated
  with check ((EXISTS ( SELECT 1
   FROM kb_articles a
  WHERE (a.id = kb_feedback.article_id))));
create policy "landing_content admin write" on public.landing_content as permissive for all to authenticated
  using (is_super_admin(auth.uid()))
  with check (is_super_admin(auth.uid()));
create policy "landing_content public read" on public.landing_content as permissive for select to anon, authenticated
  using (true);
create policy "Members manage links of their page" on public.link_tree_links as permissive for all to authenticated
  using ((EXISTS ( SELECT 1
   FROM link_tree_pages p
  WHERE ((p.id = link_tree_links.page_id) AND has_establishment_access(auth.uid(), p.establishment_id)))))
  with check ((EXISTS ( SELECT 1
   FROM link_tree_pages p
  WHERE ((p.id = link_tree_links.page_id) AND has_establishment_access(auth.uid(), p.establishment_id)))));
create policy "Public can read links of published pages" on public.link_tree_links as permissive for select to public
  using ((EXISTS ( SELECT 1
   FROM link_tree_pages p
  WHERE ((p.id = link_tree_links.page_id) AND (p.published = true)))));
create policy "Members manage their page" on public.link_tree_pages as permissive for all to authenticated
  using (has_establishment_access(auth.uid(), establishment_id))
  with check (has_establishment_access(auth.uid(), establishment_id));
create policy "Public can read published pages" on public.link_tree_pages as permissive for select to public
  using ((published = true));
create policy "link_tree_pages_requires_active_subscription" on public.link_tree_pages as restrictive for insert to authenticated
  with check ((is_super_admin(auth.uid()) OR has_active_subscription(establishment_id)));
create policy "super admin reads purge runs" on public.log_purge_runs as permissive for select to authenticated
  using (is_super_admin(auth.uid()));
create policy "super admin reads retention policies" on public.log_retention_policies as permissive for select to authenticated
  using (is_super_admin(auth.uid()));
create policy "card_member_insert" on public.loyalty_cards as permissive for insert to authenticated
  with check (has_establishment_access(auth.uid(), establishment_id));
create policy "card_member_read" on public.loyalty_cards as permissive for select to authenticated
  using (has_establishment_access(auth.uid(), establishment_id));
create policy "card_member_update" on public.loyalty_cards as permissive for update to authenticated
  using (has_establishment_access(auth.uid(), establishment_id))
  with check (has_establishment_access(auth.uid(), establishment_id));
create policy "card_self_read" on public.loyalty_cards as permissive for select to authenticated
  using ((EXISTS ( SELECT 1
   FROM customers c
  WHERE ((c.id = loyalty_cards.customer_id) AND (c.user_id = auth.uid())))));
create policy "cards_admin_read" on public.loyalty_cards as permissive for select to authenticated
  using (is_super_admin(auth.uid()));
create policy "member_permissions_admin_all" on public.member_permissions as permissive for all to authenticated
  using (has_establishment_role(auth.uid(), establishment_id, 'manager'::member_role))
  with check (has_establishment_role(auth.uid(), establishment_id, 'manager'::member_role));
create policy "member_permissions_self_read" on public.member_permissions as permissive for select to authenticated
  using ((EXISTS ( SELECT 1
   FROM establishment_members em
  WHERE ((em.id = member_permissions.member_id) AND (em.user_id = auth.uid())))));
create policy "menu_categories_members_read" on public.menu_categories as permissive for select to authenticated
  using (has_establishment_access(auth.uid(), establishment_id));
create policy "menu_categories_members_write" on public.menu_categories as permissive for all to authenticated
  using (has_establishment_role(auth.uid(), establishment_id, 'manager'::member_role))
  with check (has_establishment_role(auth.uid(), establishment_id, 'manager'::member_role));
create policy "menu_categories_public_read" on public.menu_categories as permissive for select to anon, authenticated
  using (((active = true) AND (EXISTS ( SELECT 1
   FROM restaurant_menus m
  WHERE ((m.id = menu_categories.menu_id) AND (m.status = 'published'::menu_status))))));
create policy "menu_categories_requires_active_subscription" on public.menu_categories as restrictive for insert to authenticated
  with check ((is_super_admin(auth.uid()) OR has_active_subscription(establishment_id)));
create policy "menu_item_favorites_own" on public.menu_item_favorites as permissive for all to authenticated
  using ((user_id = auth.uid()))
  with check ((user_id = auth.uid()));
create policy "menu_item_media_members_read" on public.menu_item_media as permissive for select to authenticated
  using (has_establishment_access(auth.uid(), establishment_id));
create policy "menu_item_media_members_write" on public.menu_item_media as permissive for all to authenticated
  using (has_establishment_role(auth.uid(), establishment_id, 'manager'::member_role))
  with check (has_establishment_role(auth.uid(), establishment_id, 'manager'::member_role));
create policy "menu_item_media_public_read" on public.menu_item_media as permissive for select to anon, authenticated
  using ((EXISTS ( SELECT 1
   FROM (menu_items i
     JOIN restaurant_menus m ON ((m.id = i.menu_id)))
  WHERE ((i.id = menu_item_media.item_id) AND (i.active = true) AND (m.status = 'published'::menu_status)))));
create policy "menu_items_members_read" on public.menu_items as permissive for select to authenticated
  using (has_establishment_access(auth.uid(), establishment_id));
create policy "menu_items_members_write" on public.menu_items as permissive for all to authenticated
  using (has_establishment_role(auth.uid(), establishment_id, 'manager'::member_role))
  with check (has_establishment_role(auth.uid(), establishment_id, 'manager'::member_role));
create policy "menu_items_public_read" on public.menu_items as permissive for select to anon, authenticated
  using (((active = true) AND (EXISTS ( SELECT 1
   FROM restaurant_menus m
  WHERE ((m.id = menu_items.menu_id) AND (m.status = 'published'::menu_status))))));
create policy "menu_publish_events_members_insert" on public.menu_publish_events as permissive for insert to authenticated
  with check (has_establishment_role(auth.uid(), establishment_id, 'manager'::member_role));
create policy "menu_publish_events_members_read" on public.menu_publish_events as permissive for select to authenticated
  using (has_establishment_access(auth.uid(), establishment_id));
create policy "menu_qr_designs_members" on public.menu_qr_designs as permissive for all to authenticated
  using (has_establishment_access(auth.uid(), establishment_id))
  with check (has_establishment_role(auth.uid(), establishment_id, 'manager'::member_role));
create policy "Users manage own reads" on public.merchant_message_reads as permissive for all to authenticated
  using ((user_id = auth.uid()))
  with check ((user_id = auth.uid()));
create policy "Customers read their establishment messages" on public.merchant_messages as permissive for select to authenticated
  using (((published_at > (now() - '90 days'::interval)) AND (EXISTS ( SELECT 1
   FROM customers c
  WHERE ((c.establishment_id = merchant_messages.establishment_id) AND (c.user_id = auth.uid()))))));
create policy "Managers manage own establishment messages" on public.merchant_messages as permissive for all to authenticated
  using (has_establishment_role(auth.uid(), establishment_id, 'manager'::member_role))
  with check (has_establishment_role(auth.uid(), establishment_id, 'manager'::member_role));
create policy "tpl_manager_write" on public.notification_templates as permissive for all to authenticated
  using (has_establishment_role(auth.uid(), establishment_id, 'manager'::member_role))
  with check (has_establishment_role(auth.uid(), establishment_id, 'manager'::member_role));
create policy "tpl_member_read" on public.notification_templates as permissive for select to authenticated
  using (has_establishment_access(auth.uid(), establishment_id));
create policy "Members view own establishment order items" on public.order_items as permissive for select to authenticated
  using ((EXISTS ( SELECT 1
   FROM orders o
  WHERE ((o.id = order_items.order_id) AND (has_establishment_access(auth.uid(), o.establishment_id) OR is_super_admin(auth.uid()))))));
create policy "Managers delete own establishment orders" on public.orders as permissive for delete to authenticated
  using (has_establishment_role(auth.uid(), establishment_id, 'manager'::member_role));
create policy "Members update own establishment orders" on public.orders as permissive for update to authenticated
  using (has_establishment_access(auth.uid(), establishment_id))
  with check (has_establishment_access(auth.uid(), establishment_id));
create policy "Members view own establishment orders" on public.orders as permissive for select to authenticated
  using ((has_establishment_access(auth.uid(), establishment_id) OR is_super_admin(auth.uid())));
create policy "super admin reads payment_logs" on public.payment_logs as permissive for select to authenticated
  using (is_super_admin(auth.uid()));
create policy "ppc_manager_read" on public.payment_provider_credentials as permissive for select to authenticated
  using (has_establishment_role(auth.uid(), establishment_id, 'owner'::member_role));
create policy "super admin manages payment_settings" on public.payment_settings as permissive for all to authenticated
  using (is_super_admin(auth.uid()))
  with check (is_super_admin(auth.uid()));
create policy "members read own payments" on public.payments as permissive for select to authenticated
  using ((has_establishment_access(auth.uid(), establishment_id) OR is_super_admin(auth.uid())));
create policy "owners insert own payments" on public.payments as permissive for insert to authenticated
  with check (has_establishment_role(auth.uid(), establishment_id, 'owner'::member_role));
create policy "super admin manages payments" on public.payments as permissive for all to authenticated
  using (is_super_admin(auth.uid()))
  with check (is_super_admin(auth.uid()));
create policy "Super admins can read pixel events" on public.pixel_events as permissive for select to authenticated
  using (is_super_admin(auth.uid()));
create policy "plan_features admin write" on public.plan_features as permissive for all to public
  using (is_super_admin(auth.uid()))
  with check (is_super_admin(auth.uid()));
create policy "plan_features read" on public.plan_features as permissive for select to public
  using (true);
create policy "plan funnel admin read" on public.plan_funnel_events as permissive for select to authenticated
  using (is_super_admin(auth.uid()));
create policy "plans admin write" on public.plans as permissive for all to public
  using (is_super_admin(auth.uid()))
  with check (is_super_admin(auth.uid()));
create policy "plans read" on public.plans as permissive for select to public
  using (true);
create policy "plans_public_read" on public.plans as permissive for select to anon, authenticated
  using (true);
create policy "members delete designs" on public.poster_designs as permissive for delete to authenticated
  using (has_establishment_access(auth.uid(), establishment_id));
create policy "members insert designs" on public.poster_designs as permissive for insert to authenticated
  with check ((has_establishment_access(auth.uid(), establishment_id) AND (created_by = auth.uid())));
create policy "members read designs" on public.poster_designs as permissive for select to authenticated
  using (has_establishment_access(auth.uid(), establishment_id));
create policy "members update designs" on public.poster_designs as permissive for update to authenticated
  using (has_establishment_access(auth.uid(), establishment_id))
  with check (has_establishment_access(auth.uid(), establishment_id));
create policy "managers insert orders" on public.print_orders as permissive for insert to authenticated
  with check ((has_establishment_role(auth.uid(), establishment_id, 'manager'::member_role) AND (requested_by = auth.uid())));
create policy "managers update orders" on public.print_orders as permissive for update to authenticated
  using (has_establishment_role(auth.uid(), establishment_id, 'manager'::member_role))
  with check (has_establishment_role(auth.uid(), establishment_id, 'manager'::member_role));
create policy "members read orders" on public.print_orders as permissive for select to authenticated
  using (has_establishment_access(auth.uid(), establishment_id));
create policy "profiles_admin_read" on public.profiles as permissive for select to authenticated
  using (is_super_admin(auth.uid()));
create policy "profiles_self_insert" on public.profiles as permissive for insert to authenticated
  with check ((auth.uid() = id));
create policy "profiles_self_read" on public.profiles as permissive for select to authenticated
  using ((auth.uid() = id));
create policy "profiles_self_write" on public.profiles as permissive for update to authenticated
  using ((auth.uid() = id));
create policy "backup_super_admin_read" on public.profiles_account_type_backup as permissive for select to authenticated
  using (is_super_admin(auth.uid()));
create policy "Managers delete promotions" on public.promotions as permissive for delete to authenticated
  using (has_establishment_role(auth.uid(), establishment_id, 'manager'::member_role));
create policy "Managers insert promotions" on public.promotions as permissive for insert to authenticated
  with check (has_establishment_role(auth.uid(), establishment_id, 'manager'::member_role));
create policy "Managers update promotions" on public.promotions as permissive for update to authenticated
  using (has_establishment_role(auth.uid(), establishment_id, 'manager'::member_role))
  with check (has_establishment_role(auth.uid(), establishment_id, 'manager'::member_role));
create policy "Members read own promotions" on public.promotions as permissive for select to authenticated
  using (has_establishment_access(auth.uid(), establishment_id));
create policy "Public reads active promotions" on public.promotions as permissive for select to anon, authenticated
  using (((active = true) AND ((starts_at IS NULL) OR (starts_at <= now())) AND ((ends_at IS NULL) OR (ends_at >= now())) AND (EXISTS ( SELECT 1
   FROM establishments e
  WHERE ((e.id = promotions.establishment_id) AND (e.active = true))))));
create policy "promotions_requires_active_subscription" on public.promotions as restrictive for insert to authenticated
  with check ((is_super_admin(auth.uid()) OR has_active_subscription(establishment_id)));
create policy "users insert own push events" on public.push_events as permissive for insert to authenticated
  with check (((user_id IS NULL) OR (user_id = auth.uid())));
create policy "users read own push events" on public.push_events as permissive for select to authenticated
  using ((((user_id IS NOT NULL) AND (user_id = auth.uid())) OR ((establishment_id IS NOT NULL) AND has_establishment_access(auth.uid(), establishment_id)) OR is_super_admin(auth.uid())));
create policy "members read push logs" on public.push_logs as permissive for select to authenticated
  using (((establishment_id IS NOT NULL) AND has_establishment_access(auth.uid(), establishment_id)));
create policy "members read customer push subs" on public.push_subscriptions as permissive for select to authenticated
  using (((establishment_id IS NOT NULL) AND has_establishment_access(auth.uid(), establishment_id)));
create policy "user manages own push subs" on public.push_subscriptions as permissive for all to authenticated
  using ((auth.uid() = user_id))
  with check ((auth.uid() = user_id));
create policy "members read scans" on public.qr_scans as permissive for select to authenticated
  using (has_establishment_access(auth.uid(), establishment_id));
create policy "qr_tags delete by manager+" on public.qr_tags as permissive for delete to authenticated
  using ((has_establishment_role(auth.uid(), establishment_id, 'manager'::member_role) OR is_super_admin(auth.uid())));
create policy "qr_tags insert by staff+" on public.qr_tags as permissive for insert to authenticated
  with check ((has_establishment_role(auth.uid(), establishment_id, 'staff'::member_role) OR is_super_admin(auth.uid())));
create policy "qr_tags select by members" on public.qr_tags as permissive for select to authenticated
  using ((has_establishment_role(auth.uid(), establishment_id, 'staff'::member_role) OR is_super_admin(auth.uid())));
create policy "qr_tags update by staff+" on public.qr_tags as permissive for update to authenticated
  using ((has_establishment_role(auth.uid(), establishment_id, 'staff'::member_role) OR is_super_admin(auth.uid())))
  with check ((has_establishment_role(auth.uid(), establishment_id, 'staff'::member_role) OR is_super_admin(auth.uid())));
create policy "restaurant_menus_members_read" on public.restaurant_menus as permissive for select to authenticated
  using (has_establishment_access(auth.uid(), establishment_id));
create policy "restaurant_menus_members_write" on public.restaurant_menus as permissive for all to authenticated
  using (has_establishment_role(auth.uid(), establishment_id, 'manager'::member_role))
  with check (has_establishment_role(auth.uid(), establishment_id, 'manager'::member_role));
create policy "restaurant_menus_public_read_published" on public.restaurant_menus as permissive for select to anon, authenticated
  using ((status = 'published'::menu_status));
create policy "restaurant_menus_requires_active_subscription" on public.restaurant_menus as restrictive for insert to authenticated
  with check ((is_super_admin(auth.uid()) OR has_active_subscription(establishment_id)));
create policy "members read retention dispatches" on public.retention_dispatches as permissive for select to authenticated
  using (has_establishment_access(auth.uid(), establishment_id));
create policy "service inserts retention dispatches" on public.retention_dispatches as permissive for insert to authenticated
  with check (has_establishment_role(auth.uid(), establishment_id, 'manager'::member_role));
create policy "anon can log referral tracking" on public.retention_events as permissive for insert to anon
  with check ((event_type = ANY (ARRAY['referral_click'::text, 'referral_share'::text])));
create policy "members read retention events" on public.retention_events as permissive for select to authenticated
  using (has_establishment_access(auth.uid(), establishment_id));
create policy "managers write retention settings" on public.retention_settings as permissive for all to authenticated
  using (has_establishment_role(auth.uid(), establishment_id, 'manager'::member_role))
  with check (has_establishment_role(auth.uid(), establishment_id, 'manager'::member_role));
create policy "members read retention settings" on public.retention_settings as permissive for select to authenticated
  using (has_establishment_access(auth.uid(), establishment_id));
create policy "members read answers" on public.review_answers as permissive for select to authenticated
  using ((EXISTS ( SELECT 1
   FROM customer_reviews r
  WHERE ((r.id = review_answers.review_id) AND has_establishment_access(auth.uid(), r.establishment_id)))));
create policy "members read events" on public.review_events as permissive for select to authenticated
  using ((EXISTS ( SELECT 1
   FROM review_forms f
  WHERE ((f.id = review_events.review_form_id) AND has_establishment_access(auth.uid(), f.establishment_id)))));
create policy "managers manage form" on public.review_forms as permissive for all to authenticated
  using (has_establishment_role(auth.uid(), establishment_id, 'manager'::member_role))
  with check (has_establishment_role(auth.uid(), establishment_id, 'manager'::member_role));
create policy "members read own form" on public.review_forms as permissive for select to authenticated
  using (has_establishment_access(auth.uid(), establishment_id));
create policy "public read active forms" on public.review_forms as permissive for select to anon
  using ((active = true));
create policy "managers manage questions" on public.review_questions as permissive for all to authenticated
  using ((EXISTS ( SELECT 1
   FROM review_forms f
  WHERE ((f.id = review_questions.review_form_id) AND has_establishment_role(auth.uid(), f.establishment_id, 'manager'::member_role)))))
  with check ((EXISTS ( SELECT 1
   FROM review_forms f
  WHERE ((f.id = review_questions.review_form_id) AND has_establishment_role(auth.uid(), f.establishment_id, 'manager'::member_role)))));
create policy "members read questions" on public.review_questions as permissive for select to authenticated
  using ((EXISTS ( SELECT 1
   FROM review_forms f
  WHERE ((f.id = review_questions.review_form_id) AND has_establishment_access(auth.uid(), f.establishment_id)))));
create policy "public read active questions" on public.review_questions as permissive for select to anon
  using (((active = true) AND (EXISTS ( SELECT 1
   FROM review_forms f
  WHERE ((f.id = review_questions.review_form_id) AND (f.active = true))))));
create policy "managers manage options" on public.review_rating_options as permissive for all to authenticated
  using ((EXISTS ( SELECT 1
   FROM review_forms f
  WHERE ((f.id = review_rating_options.review_form_id) AND has_establishment_role(auth.uid(), f.establishment_id, 'manager'::member_role)))))
  with check ((EXISTS ( SELECT 1
   FROM review_forms f
  WHERE ((f.id = review_rating_options.review_form_id) AND has_establishment_role(auth.uid(), f.establishment_id, 'manager'::member_role)))));
create policy "members read options" on public.review_rating_options as permissive for select to authenticated
  using ((EXISTS ( SELECT 1
   FROM review_forms f
  WHERE ((f.id = review_rating_options.review_form_id) AND has_establishment_access(auth.uid(), f.establishment_id)))));
create policy "public read options of active form" on public.review_rating_options as permissive for select to anon
  using ((EXISTS ( SELECT 1
   FROM review_forms f
  WHERE ((f.id = review_rating_options.review_form_id) AND (f.active = true)))));
create policy "review_settings owner manage" on public.review_settings as permissive for all to authenticated
  using (has_establishment_role(auth.uid(), establishment_id, 'manager'::member_role))
  with check (has_establishment_role(auth.uid(), establishment_id, 'manager'::member_role));
create policy "review_settings public read" on public.review_settings as permissive for select to anon, authenticated
  using (true);
create policy "reviews insert authenticated" on public.reviews as permissive for insert to authenticated
  with check (((customer_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM customers c
  WHERE ((c.id = reviews.customer_id) AND (c.user_id = auth.uid()) AND (c.establishment_id = reviews.establishment_id)))) AND ((stamp_id IS NULL) OR (EXISTS ( SELECT 1
   FROM (stamps s
     JOIN loyalty_cards lc ON ((lc.id = s.card_id)))
  WHERE ((s.id = reviews.stamp_id) AND (lc.customer_id = reviews.customer_id))))) AND ((card_id IS NULL) OR (EXISTS ( SELECT 1
   FROM loyalty_cards lc
  WHERE ((lc.id = reviews.card_id) AND (lc.customer_id = reviews.customer_id)))))));
create policy "reviews owner delete" on public.reviews as permissive for delete to authenticated
  using (has_establishment_role(auth.uid(), establishment_id, 'manager'::member_role));
create policy "reviews owner read" on public.reviews as permissive for select to authenticated
  using (has_establishment_access(auth.uid(), establishment_id));
create policy "reviews owner update" on public.reviews as permissive for update to authenticated
  using (has_establishment_role(auth.uid(), establishment_id, 'manager'::member_role))
  with check (has_establishment_role(auth.uid(), establishment_id, 'manager'::member_role));
create policy "reviews public read" on public.reviews as permissive for select to anon, authenticated
  using ((is_public = true));
create policy "rewards_member_insert" on public.rewards as permissive for insert to authenticated
  with check (has_establishment_access(auth.uid(), establishment_id));
create policy "rewards_member_read" on public.rewards as permissive for select to authenticated
  using (has_establishment_access(auth.uid(), establishment_id));
create policy "rewards_member_update" on public.rewards as permissive for update to authenticated
  using (has_establishment_access(auth.uid(), establishment_id))
  with check (has_establishment_access(auth.uid(), establishment_id));
create policy "rewards_self_read" on public.rewards as permissive for select to authenticated
  using ((EXISTS ( SELECT 1
   FROM (loyalty_cards lc
     JOIN customers c ON ((c.id = lc.customer_id)))
  WHERE ((lc.id = rewards.card_id) AND (c.user_id = auth.uid())))));
create policy "scheduled_push_manager_delete" on public.scheduled_pushes as permissive for delete to authenticated
  using (has_establishment_role(auth.uid(), establishment_id, 'manager'::member_role));
create policy "scheduled_push_manager_insert" on public.scheduled_pushes as permissive for insert to authenticated
  with check (has_establishment_role(auth.uid(), establishment_id, 'manager'::member_role));
create policy "scheduled_push_manager_read" on public.scheduled_pushes as permissive for select to authenticated
  using (has_establishment_role(auth.uid(), establishment_id, 'manager'::member_role));
create policy "scheduled_push_manager_update" on public.scheduled_pushes as permissive for update to authenticated
  using (has_establishment_role(auth.uid(), establishment_id, 'manager'::member_role))
  with check (has_establishment_role(auth.uid(), establishment_id, 'manager'::member_role));
create policy "scheduled_pushes_requires_active_subscription" on public.scheduled_pushes as restrictive for insert to authenticated
  with check ((is_super_admin(auth.uid()) OR has_active_subscription(establishment_id)));
create policy "ads_campaigns_delete_draft" on public.sponsored_ad_campaigns as permissive for delete to authenticated
  using (((status = 'draft'::text) AND member_can(auth.uid(), establishment_id, 'ads.manage'::text)));
create policy "ads_campaigns_insert_own_draft" on public.sponsored_ad_campaigns as permissive for insert to authenticated
  with check (((status = 'draft'::text) AND member_can(auth.uid(), establishment_id, 'ads.manage'::text)));
create policy "ads_campaigns_select_own" on public.sponsored_ad_campaigns as permissive for select to authenticated
  using ((member_can(auth.uid(), establishment_id, 'ads.manage'::text) OR is_super_admin(auth.uid())));
create policy "ads_campaigns_update_editable" on public.sponsored_ad_campaigns as permissive for update to authenticated
  using (((status = ANY (ARRAY['draft'::text, 'changes_requested'::text])) AND member_can(auth.uid(), establishment_id, 'ads.manage'::text)))
  with check (((status = ANY (ARRAY['draft'::text, 'changes_requested'::text])) AND member_can(auth.uid(), establishment_id, 'ads.manage'::text)));
create policy "ads_metrics_select_own" on public.sponsored_ad_daily_metrics as permissive for select to authenticated
  using ((is_super_admin(auth.uid()) OR (EXISTS ( SELECT 1
   FROM sponsored_ad_campaigns c
  WHERE ((c.id = sponsored_ad_daily_metrics.campaign_id) AND member_can(auth.uid(), c.establishment_id, 'ads.manage'::text))))));
create policy "ads_orders_select_own" on public.sponsored_ad_orders as permissive for select to authenticated
  using ((member_can(auth.uid(), establishment_id, 'ads.manage'::text) OR is_super_admin(auth.uid())));
create policy "ads_packages_admin_all" on public.sponsored_ad_packages as permissive for all to authenticated
  using (is_super_admin(auth.uid()))
  with check (is_super_admin(auth.uid()));
create policy "ads_packages_read_active_authenticated" on public.sponsored_ad_packages as permissive for select to authenticated
  using (((is_active = true) OR is_super_admin(auth.uid())));
create policy "ads_reviews_select_scoped" on public.sponsored_ad_reviews as permissive for select to authenticated
  using ((is_super_admin(auth.uid()) OR (EXISTS ( SELECT 1
   FROM sponsored_ad_campaigns c
  WHERE ((c.id = sponsored_ad_reviews.campaign_id) AND member_can(auth.uid(), c.establishment_id, 'ads.manage'::text))))));
create policy "ads_settings_admin_write" on public.sponsored_ad_settings as permissive for all to authenticated
  using (is_super_admin(auth.uid()))
  with check (is_super_admin(auth.uid()));
create policy "ads_settings_read_authenticated" on public.sponsored_ad_settings as permissive for select to authenticated
  using (true);
create policy "stamps_admin_read" on public.stamps as permissive for select to authenticated
  using (is_super_admin(auth.uid()));
create policy "stamps_member_insert" on public.stamps as permissive for insert to authenticated
  with check (has_establishment_access(auth.uid(), establishment_id));
create policy "stamps_member_read" on public.stamps as permissive for select to authenticated
  using (has_establishment_access(auth.uid(), establishment_id));
create policy "stamps_member_update" on public.stamps as permissive for update to authenticated
  using (has_establishment_access(auth.uid(), establishment_id))
  with check (has_establishment_access(auth.uid(), establishment_id));
create policy "stamps_requires_active_subscription" on public.stamps as restrictive for insert to authenticated
  with check ((is_super_admin(auth.uid()) OR has_active_subscription(establishment_id)));
create policy "stamps_self_read" on public.stamps as permissive for select to authenticated
  using ((EXISTS ( SELECT 1
   FROM (loyalty_cards lc
     JOIN customers c ON ((c.id = lc.customer_id)))
  WHERE ((lc.id = stamps.card_id) AND (c.user_id = auth.uid())))));
create policy "subev_admin_all" on public.subscription_events as permissive for all to authenticated
  using (is_super_admin(auth.uid()))
  with check (is_super_admin(auth.uid()));
create policy "subev_manager_read" on public.subscription_events as permissive for select to authenticated
  using (has_establishment_role(auth.uid(), establishment_id, 'manager'::member_role));
create policy "subs_member_read" on public.subscriptions as permissive for select to authenticated
  using ((has_establishment_access(auth.uid(), establishment_id) OR is_super_admin(auth.uid())));
create policy "support_msg_admin_insert" on public.support_messages as permissive for insert to authenticated
  with check ((is_super_admin(auth.uid()) AND (sender_type = ANY (ARRAY['admin'::support_author_type, 'system'::support_author_type]))));
create policy "support_msg_admin_select" on public.support_messages as permissive for select to authenticated
  using (is_super_admin(auth.uid()));
create policy "support_msg_requester_insert" on public.support_messages as permissive for insert to authenticated
  with check (((sender_type = 'customer'::support_author_type) AND (is_internal = false) AND (sender_user_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM support_tickets t
  WHERE ((t.id = support_messages.ticket_id) AND (t.requester_user_id = auth.uid()) AND (t.status <> 'closed'::support_status))))));
create policy "support_msg_requester_select" on public.support_messages as permissive for select to authenticated
  using (((is_internal = false) AND (EXISTS ( SELECT 1
   FROM support_tickets t
  WHERE ((t.id = support_messages.ticket_id) AND (t.requester_user_id = auth.uid()))))));
create policy "support_qr_admin_all" on public.support_quick_replies as permissive for all to authenticated
  using (is_super_admin(auth.uid()))
  with check (is_super_admin(auth.uid()));
create policy "support_history_admin_all" on public.support_status_history as permissive for all to authenticated
  using (is_super_admin(auth.uid()))
  with check (is_super_admin(auth.uid()));
create policy "support_history_requester_select" on public.support_status_history as permissive for select to authenticated
  using ((EXISTS ( SELECT 1
   FROM support_tickets t
  WHERE ((t.id = support_status_history.ticket_id) AND (t.requester_user_id = auth.uid())))));
create policy "support_tickets_admin_select" on public.support_tickets as permissive for select to authenticated
  using (is_super_admin(auth.uid()));
create policy "support_tickets_admin_update" on public.support_tickets as permissive for update to authenticated
  using (is_super_admin(auth.uid()))
  with check (is_super_admin(auth.uid()));
create policy "support_tickets_requester_insert" on public.support_tickets as permissive for insert to authenticated
  with check (((requester_user_id = auth.uid()) AND (assigned_admin_id IS NULL) AND (status = 'open'::support_status) AND (priority = ANY (ARRAY['low'::support_priority, 'normal'::support_priority, 'high'::support_priority])) AND (first_response_at IS NULL) AND (resolved_at IS NULL) AND (closed_at IS NULL)));
create policy "support_tickets_requester_select" on public.support_tickets as permissive for select to authenticated
  using ((requester_user_id = auth.uid()));
create policy "support_tickets_requester_update" on public.support_tickets as permissive for update to authenticated
  using ((requester_user_id = auth.uid()))
  with check (((requester_user_id = auth.uid()) AND (NOT (assigned_admin_id IS DISTINCT FROM assigned_admin_id))));
create policy "deny_all_client_access" on public.system_email_settings as permissive for all to anon, authenticated
  using (false)
  with check (false);
create policy "invites_manager_read" on public.team_invites as permissive for select to authenticated
  using (has_establishment_role(auth.uid(), establishment_id, 'manager'::member_role));
create policy "invites_manager_update" on public.team_invites as permissive for update to authenticated
  using (has_establishment_role(auth.uid(), establishment_id, 'manager'::member_role))
  with check (has_establishment_role(auth.uid(), establishment_id, 'manager'::member_role));
create policy "invites_manager_write" on public.team_invites as permissive for insert to authenticated
  with check (has_establishment_role(auth.uid(), establishment_id, 'manager'::member_role));
create policy "tm_agent_insert" on public.ticket_messages as permissive for insert to authenticated
  with check ((EXISTS ( SELECT 1
   FROM tickets t
  WHERE ((t.id = ticket_messages.ticket_id) AND is_helpdesk_agent(auth.uid(), t.establishment_id)))));
create policy "tm_agent_select" on public.ticket_messages as permissive for select to authenticated
  using ((EXISTS ( SELECT 1
   FROM tickets t
  WHERE ((t.id = ticket_messages.ticket_id) AND is_helpdesk_agent(auth.uid(), t.establishment_id)))));
create policy "tm_requester_insert" on public.ticket_messages as permissive for insert to authenticated
  with check (((author_type = 'customer'::ticket_author_type) AND (internal = false) AND (author_user_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM tickets t
  WHERE ((t.id = ticket_messages.ticket_id) AND (t.requester_user_id = auth.uid()))))));
create policy "tm_requester_select" on public.ticket_messages as permissive for select to authenticated
  using (((internal = false) AND (EXISTS ( SELECT 1
   FROM tickets t
  WHERE ((t.id = ticket_messages.ticket_id) AND (t.requester_user_id = auth.uid()))))));
create policy "qr_agent_all" on public.ticket_quick_replies as permissive for all to authenticated
  using (is_helpdesk_agent(auth.uid(), establishment_id))
  with check (is_helpdesk_agent(auth.uid(), establishment_id));
create policy "tk_agent_insert" on public.tickets as permissive for insert to authenticated
  with check (is_helpdesk_agent(auth.uid(), establishment_id));
create policy "tk_agent_select" on public.tickets as permissive for select to authenticated
  using (is_helpdesk_agent(auth.uid(), establishment_id));
create policy "tk_agent_update" on public.tickets as permissive for update to authenticated
  using (is_helpdesk_agent(auth.uid(), establishment_id));
create policy "tk_requester_insert" on public.tickets as permissive for insert to authenticated
  with check ((requester_user_id = auth.uid()));
create policy "tk_requester_select" on public.tickets as permissive for select to authenticated
  using ((requester_user_id = auth.uid()));
create policy "tk_requester_update" on public.tickets as permissive for update to authenticated
  using ((requester_user_id = auth.uid()))
  with check ((requester_user_id = auth.uid()));
create policy "Users read own app notifications" on public.user_notifications as permissive for select to authenticated
  using (((user_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM customers c
  WHERE ((c.id = user_notifications.customer_id) AND (c.user_id = auth.uid()))))));
create policy "Users update own app notifications" on public.user_notifications as permissive for update to authenticated
  using (((user_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM customers c
  WHERE ((c.id = user_notifications.customer_id) AND (c.user_id = auth.uid()))))))
  with check (((user_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM customers c
  WHERE ((c.id = user_notifications.customer_id) AND (c.user_id = auth.uid()))))));
create policy "deny_all_client_access" on public.wallet_pass_devices as permissive for all to anon, authenticated
  using (false)
  with check (false);
create policy "wallet_passes_member_read" on public.wallet_passes as permissive for select to authenticated
  using ((has_establishment_access(auth.uid(), establishment_id) OR is_super_admin(auth.uid()) OR (EXISTS ( SELECT 1
   FROM customers c
  WHERE ((c.id = wallet_passes.customer_id) AND (c.user_id = auth.uid()))))));
create policy "wallet_settings_member_write" on public.wallet_settings as permissive for all to authenticated
  using ((has_establishment_role(auth.uid(), establishment_id, 'manager'::member_role) OR is_super_admin(auth.uid())))
  with check ((has_establishment_role(auth.uid(), establishment_id, 'manager'::member_role) OR is_super_admin(auth.uid())));
create policy "wallet_settings_public_read" on public.wallet_settings as permissive for select to public
  using (true);
create policy "wd_manager_read" on public.webhook_deliveries as permissive for select to authenticated
  using ((EXISTS ( SELECT 1
   FROM webhooks w
  WHERE ((w.id = webhook_deliveries.webhook_id) AND has_establishment_role(auth.uid(), w.establishment_id, 'manager'::member_role)))));
create policy "webhooks_manager_all" on public.webhooks as permissive for all to authenticated
  using (has_establishment_role(auth.uid(), establishment_id, 'manager'::member_role))
  with check (has_establishment_role(auth.uid(), establishment_id, 'manager'::member_role));

-- ---------------------------------------------------------------------
-- 10. STORAGE (buckets + policies)
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('database_export_19_07_26', 'database_export_19_07_26', false, null, null)
on conflict (id) do nothing;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('database_export_24_07_26', 'database_export_24_07_26', false, null, null)
on conflict (id) do nothing;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('landing-media', 'landing-media', false, null, null)
on conflict (id) do nothing;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('logos', 'logos', false, null, null)
on conflict (id) do nothing;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('menu-images', 'menu-images', false, null, null)
on conflict (id) do nothing;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('menu-videos', 'menu-videos', false, null, null)
on conflict (id) do nothing;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('poster-print-orders', 'poster-print-orders', false, null, null)
on conflict (id) do nothing;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('promotions', 'promotions', false, null, null)
on conflict (id) do nothing;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('sponsored-ads', 'sponsored-ads', false, null, null)
on conflict (id) do nothing;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('ticket-attachments', 'ticket-attachments', false, null, null)
on conflict (id) do nothing;

-- Policies de storage.objects
create policy "Authenticated read promotions media" on storage.objects for select to authenticated
  using ((bucket_id = 'promotions'::text));
create policy "Members delete own est promotions media" on storage.objects for delete to authenticated
  using (((bucket_id = 'promotions'::text) AND has_establishment_role(auth.uid(), ((regexp_split_to_array(name, '/'::text))[1])::uuid, 'manager'::member_role)));
create policy "Members update own est promotions media" on storage.objects for update to authenticated
  using (((bucket_id = 'promotions'::text) AND has_establishment_role(auth.uid(), ((regexp_split_to_array(name, '/'::text))[1])::uuid, 'manager'::member_role)));
create policy "Members write own est promotions media" on storage.objects for insert to authenticated
  with check (((bucket_id = 'promotions'::text) AND has_establishment_role(auth.uid(), ((regexp_split_to_array(name, '/'::text))[1])::uuid, 'manager'::member_role)));
create policy "ads_creatives_member_delete" on storage.objects for delete to authenticated
  using (((bucket_id = 'sponsored-ads'::text) AND member_can(auth.uid(), menu_storage_est_id(name), 'ads.manage'::text)));
create policy "ads_creatives_member_read" on storage.objects for select to authenticated
  using (((bucket_id = 'sponsored-ads'::text) AND member_can(auth.uid(), menu_storage_est_id(name), 'ads.manage'::text)));
create policy "ads_creatives_member_write" on storage.objects for insert to authenticated
  with check (((bucket_id = 'sponsored-ads'::text) AND member_can(auth.uid(), menu_storage_est_id(name), 'ads.manage'::text)));
create policy "landing media admin all" on storage.objects for all to authenticated
  using (((bucket_id = 'landing-media'::text) AND is_super_admin(auth.uid())))
  with check (((bucket_id = 'landing-media'::text) AND is_super_admin(auth.uid())));
create policy "logos_auth_delete" on storage.objects for delete to authenticated
  using (((bucket_id = 'logos'::text) AND (owner = auth.uid())));
create policy "logos_auth_insert" on storage.objects for insert to authenticated
  with check (((bucket_id = 'logos'::text) AND (owner = auth.uid())));
create policy "logos_auth_read" on storage.objects for select to authenticated
  using ((bucket_id = 'logos'::text));
create policy "logos_auth_update" on storage.objects for update to authenticated
  using (((bucket_id = 'logos'::text) AND (owner = auth.uid())));
create policy "menu_media_members_delete" on storage.objects for delete to authenticated
  using (((bucket_id = ANY (ARRAY['menu-images'::text, 'menu-videos'::text])) AND (menu_storage_est_id(name) IS NOT NULL) AND has_establishment_role(auth.uid(), menu_storage_est_id(name), 'manager'::member_role)));
create policy "menu_media_members_insert" on storage.objects for insert to authenticated
  with check (((bucket_id = ANY (ARRAY['menu-images'::text, 'menu-videos'::text])) AND (menu_storage_est_id(name) IS NOT NULL) AND has_establishment_role(auth.uid(), menu_storage_est_id(name), 'manager'::member_role)));
create policy "menu_media_members_read" on storage.objects for select to authenticated
  using (((bucket_id = ANY (ARRAY['menu-images'::text, 'menu-videos'::text])) AND (menu_storage_est_id(name) IS NOT NULL) AND has_establishment_access(auth.uid(), menu_storage_est_id(name))));
create policy "menu_media_members_update" on storage.objects for update to authenticated
  using (((bucket_id = ANY (ARRAY['menu-images'::text, 'menu-videos'::text])) AND (menu_storage_est_id(name) IS NOT NULL) AND has_establishment_role(auth.uid(), menu_storage_est_id(name), 'manager'::member_role)));
create policy "print orders managers update" on storage.objects for update to authenticated
  using (((bucket_id = 'poster-print-orders'::text) AND has_establishment_role(auth.uid(), ((storage.foldername(name))[1])::uuid, 'manager'::member_role)))
  with check (((bucket_id = 'poster-print-orders'::text) AND has_establishment_role(auth.uid(), ((storage.foldername(name))[1])::uuid, 'manager'::member_role)));
create policy "print orders managers write" on storage.objects for insert to authenticated
  with check (((bucket_id = 'poster-print-orders'::text) AND has_establishment_role(auth.uid(), ((storage.foldername(name))[1])::uuid, 'manager'::member_role)));
create policy "print orders members read" on storage.objects for select to authenticated
  using (((bucket_id = 'poster-print-orders'::text) AND has_establishment_access(auth.uid(), ((storage.foldername(name))[1])::uuid)));

-- ---------------------------------------------------------------------
-- 11. DADOS INICIAIS (catálogos do sistema, sem dados de clientes)
-- ---------------------------------------------------------------------
-- plans (5 registros)
insert into public.plans ("id", "tier", "name", "price_monthly", "max_customers", "max_staff", "max_campaigns", "features", "created_at", "slug", "description", "price_yearly", "currency", "customer_limit", "employee_limit", "campaign_limit", "unit_limit", "active_card_limit", "stamp_limit", "email_limit", "storage_limit_mb", "ticket_limit", "is_active", "is_featured", "display_order", "trial_days", "button_text", "archived_at", "updated_at") values ('3a95c4ed-75c1-4e77-8d90-69b8c9dd3939', 'enterprise', 'Premium', 119.9, null, null, null, '{"exports": true, "reports": "advanced", "branding": false, "multi_unit": true, "segmentation": true}'::jsonb, '2026-07-18T14:53:09.041665+00:00', 'ilimitado', 'Operação sem limites: recursos completos, carteira digital Apple/Google, equipe ilimitada, integrações e marca própria sem Fidelize.', 997.9, 'BRL', null, null, null, null, null, null, null, null, null, true, false, 3, 0, 'Assinar Premium', null, '2026-07-29T18:16:41.122162+00:00') on conflict do nothing;
insert into public.plans ("id", "tier", "name", "price_monthly", "max_customers", "max_staff", "max_campaigns", "features", "created_at", "slug", "description", "price_yearly", "currency", "customer_limit", "employee_limit", "campaign_limit", "unit_limit", "active_card_limit", "stamp_limit", "email_limit", "storage_limit_mb", "ticket_limit", "is_active", "is_featured", "display_order", "trial_days", "button_text", "archived_at", "updated_at") values ('2c5ecfc1-560a-4a49-8b89-c0042b705575', 'pro', 'Profissional', 59.9, 10000, 10, 5, '{"exports": true, "reports": "advanced", "branding": false, "segmentation": true}'::jsonb, '2026-07-18T14:53:09.041665+00:00', 'profissional', 'O plano mais escolhido: catálogo digital, avaliações, notificações push e relatórios completos para crescer com previsibilidade.', 599.9, 'BRL', 1000, 5, null, null, null, null, null, null, null, true, true, 2, 0, 'Assinar Profissional', null, '2026-07-29T18:16:41.122162+00:00') on conflict do nothing;
insert into public.plans ("id", "tier", "name", "price_monthly", "max_customers", "max_staff", "max_campaigns", "features", "created_at", "slug", "description", "price_yearly", "currency", "customer_limit", "employee_limit", "campaign_limit", "unit_limit", "active_card_limit", "stamp_limit", "email_limit", "storage_limit_mb", "ticket_limit", "is_active", "is_featured", "display_order", "trial_days", "button_text", "archived_at", "updated_at") values ('d1fd179b-4efc-4f4d-ac18-26fee75e3922', 'business', 'Empresarial', 349.0, null, null, null, '{"quote_flow": true, "sales_contact": true}'::jsonb, '2026-07-30T19:01:17.240267+00:00', 'empresarial', 'Para redes e franquias: múltiplas unidades, volume ilimitado, onboarding assistido, SLA prioritário e suporte dedicado. Contratação via time comercial.', null, 'BRL', null, null, null, null, null, null, null, null, null, true, false, 4, 0, 'Falar com vendas', null, '2026-07-30T19:01:17.240267+00:00') on conflict do nothing;
insert into public.plans ("id", "tier", "name", "price_monthly", "max_customers", "max_staff", "max_campaigns", "features", "created_at", "slug", "description", "price_yearly", "currency", "customer_limit", "employee_limit", "campaign_limit", "unit_limit", "active_card_limit", "stamp_limit", "email_limit", "storage_limit_mb", "ticket_limit", "is_active", "is_featured", "display_order", "trial_days", "button_text", "archived_at", "updated_at") values ('40a18a80-4bc6-45c1-9a77-9657d630818b', 'free', 'Gratuito', 0.0, 100, 1, 1, '{"exports": false, "reports": "basic", "branding": true}'::jsonb, '2026-07-18T14:53:09.041665+00:00', 'free', 'Ideal para testar o Fidelize sem custo: cartão fidelidade digital, QR Code e carimbos para começar a fidelizar hoje mesmo.', null, 'BRL', 10, 1, 1, null, null, null, null, null, null, false, false, 0, 0, null, '2026-07-18T20:41:37.980014+00:00', '2026-07-28T00:52:51.279646+00:00') on conflict do nothing;
insert into public.plans ("id", "tier", "name", "price_monthly", "max_customers", "max_staff", "max_campaigns", "features", "created_at", "slug", "description", "price_yearly", "currency", "customer_limit", "employee_limit", "campaign_limit", "unit_limit", "active_card_limit", "stamp_limit", "email_limit", "storage_limit_mb", "ticket_limit", "is_active", "is_featured", "display_order", "trial_days", "button_text", "archived_at", "updated_at") values ('4fce6d1e-5c5f-43af-92c8-d0ce85f405d4', 'starter', 'Essencial', 29.9, 1000, 3, 2, '{"exports": true, "reports": "intermediate", "branding": true}'::jsonb, '2026-07-18T14:53:09.041665+00:00', 'essencial', 'Para quem já vende todo dia: mais clientes, campanhas de retenção e cardápio digital para transformar visitas em retorno.', 299.9, 'BRL', 300, 1, 3, null, null, null, null, null, null, true, false, 1, 0, 'Assinar Essencial', null, '2026-07-28T00:52:51.279646+00:00') on conflict do nothing;

-- plan_features (196 registros)
insert into public.plan_features ("id", "plan_id", "feature_key", "feature_name", "enabled", "limit_value", "created_at") values ('aa85868c-642d-488e-849e-3c61a71e25b1', '4fce6d1e-5c5f-43af-92c8-d0ce85f405d4', 'dashboard', 'Dashboard básico', true, null, '2026-07-18T20:41:37.980014+00:00') on conflict do nothing;
insert into public.plan_features ("id", "plan_id", "feature_key", "feature_name", "enabled", "limit_value", "created_at") values ('cec38bf9-a677-40ac-8abc-21287e73a9d1', '4fce6d1e-5c5f-43af-92c8-d0ce85f405d4', 'customers', 'Cadastro de clientes', true, null, '2026-07-18T20:41:37.980014+00:00') on conflict do nothing;
insert into public.plan_features ("id", "plan_id", "feature_key", "feature_name", "enabled", "limit_value", "created_at") values ('e3563c9b-6252-4544-940e-66c953659324', '4fce6d1e-5c5f-43af-92c8-d0ce85f405d4', 'loyalty_card', 'Cartão fidelidade digital', true, null, '2026-07-18T20:41:37.980014+00:00') on conflict do nothing;
insert into public.plan_features ("id", "plan_id", "feature_key", "feature_name", "enabled", "limit_value", "created_at") values ('2eaea39e-0a76-419b-8ca3-1a473ef3d9f6', '4fce6d1e-5c5f-43af-92c8-d0ce85f405d4', 'qrcode', 'QR Code', true, null, '2026-07-18T20:41:37.980014+00:00') on conflict do nothing;
insert into public.plan_features ("id", "plan_id", "feature_key", "feature_name", "enabled", "limit_value", "created_at") values ('8f7c833d-30b3-4ec8-bf59-d95f30fbb022', '4fce6d1e-5c5f-43af-92c8-d0ce85f405d4', 'stamps', 'Carimbos', true, null, '2026-07-18T20:41:37.980014+00:00') on conflict do nothing;
insert into public.plan_features ("id", "plan_id", "feature_key", "feature_name", "enabled", "limit_value", "created_at") values ('308089b2-641a-4497-bf8a-8085b709b4e0', '4fce6d1e-5c5f-43af-92c8-d0ce85f405d4', 'rewards', 'Recompensas', true, null, '2026-07-18T20:41:37.980014+00:00') on conflict do nothing;
insert into public.plan_features ("id", "plan_id", "feature_key", "feature_name", "enabled", "limit_value", "created_at") values ('a1348693-291a-413f-b31e-b7e2be6de5eb', '4fce6d1e-5c5f-43af-92c8-d0ce85f405d4', 'campaigns', 'Campanhas (1)', true, null, '2026-07-18T20:41:37.980014+00:00') on conflict do nothing;
insert into public.plan_features ("id", "plan_id", "feature_key", "feature_name", "enabled", "limit_value", "created_at") values ('1bef20b8-8318-429d-82be-d8c405cb65d4', '4fce6d1e-5c5f-43af-92c8-d0ce85f405d4', 'support_ticket', 'Suporte por ticket', true, null, '2026-07-18T20:41:37.980014+00:00') on conflict do nothing;
insert into public.plan_features ("id", "plan_id", "feature_key", "feature_name", "enabled", "limit_value", "created_at") values ('4fa93a28-7832-4db2-9186-0cfa6809f7bf', '2c5ecfc1-560a-4a49-8b89-c0042b705575', 'dashboard', 'Dashboard', true, null, '2026-07-18T20:41:37.980014+00:00') on conflict do nothing;
insert into public.plan_features ("id", "plan_id", "feature_key", "feature_name", "enabled", "limit_value", "created_at") values ('38d467eb-739b-4a35-bfc5-30199ab2d02f', '2c5ecfc1-560a-4a49-8b89-c0042b705575', 'customers', 'Cadastro de clientes', true, null, '2026-07-18T20:41:37.980014+00:00') on conflict do nothing;
insert into public.plan_features ("id", "plan_id", "feature_key", "feature_name", "enabled", "limit_value", "created_at") values ('6bde7011-16d0-4d3d-be00-129b7fab77fc', '2c5ecfc1-560a-4a49-8b89-c0042b705575', 'loyalty_card', 'Cartão fidelidade digital', true, null, '2026-07-18T20:41:37.980014+00:00') on conflict do nothing;
insert into public.plan_features ("id", "plan_id", "feature_key", "feature_name", "enabled", "limit_value", "created_at") values ('4e415a6c-e827-4076-8c8d-8ccb33924e4d', '2c5ecfc1-560a-4a49-8b89-c0042b705575', 'qrcode', 'QR Code', true, null, '2026-07-18T20:41:37.980014+00:00') on conflict do nothing;
insert into public.plan_features ("id", "plan_id", "feature_key", "feature_name", "enabled", "limit_value", "created_at") values ('94ae1218-5bc2-4e45-918b-e6b528f93166', '2c5ecfc1-560a-4a49-8b89-c0042b705575', 'stamps', 'Carimbos', true, null, '2026-07-18T20:41:37.980014+00:00') on conflict do nothing;
insert into public.plan_features ("id", "plan_id", "feature_key", "feature_name", "enabled", "limit_value", "created_at") values ('87937fc2-5381-4dd8-80b5-7f08f8abad0d', '2c5ecfc1-560a-4a49-8b89-c0042b705575', 'rewards', 'Recompensas', true, null, '2026-07-18T20:41:37.980014+00:00') on conflict do nothing;
insert into public.plan_features ("id", "plan_id", "feature_key", "feature_name", "enabled", "limit_value", "created_at") values ('b457c98d-865a-41ec-8d60-6571ade8e530', '2c5ecfc1-560a-4a49-8b89-c0042b705575', 'campaigns', 'Até 3 campanhas', true, null, '2026-07-18T20:41:37.980014+00:00') on conflict do nothing;
insert into public.plan_features ("id", "plan_id", "feature_key", "feature_name", "enabled", "limit_value", "created_at") values ('b097f04f-a5ab-42e3-abb8-f8cd7928cae4', '2c5ecfc1-560a-4a49-8b89-c0042b705575', 'reports', 'Relatórios', true, null, '2026-07-18T20:41:37.980014+00:00') on conflict do nothing;
insert into public.plan_features ("id", "plan_id", "feature_key", "feature_name", "enabled", "limit_value", "created_at") values ('31edb448-b9dc-468e-8a9d-73a255d5b7d7', '2c5ecfc1-560a-4a49-8b89-c0042b705575', 'export', 'Exportação de clientes', true, null, '2026-07-18T20:41:37.980014+00:00') on conflict do nothing;
insert into public.plan_features ("id", "plan_id", "feature_key", "feature_name", "enabled", "limit_value", "created_at") values ('8c31ef82-cbe3-4d56-bce0-1ce32b352e8a', '2c5ecfc1-560a-4a49-8b89-c0042b705575', 'branding', 'Personalização da identidade visual', true, null, '2026-07-18T20:41:37.980014+00:00') on conflict do nothing;
insert into public.plan_features ("id", "plan_id", "feature_key", "feature_name", "enabled", "limit_value", "created_at") values ('1d6c43ba-6923-4b3e-9016-387739d5b444', '2c5ecfc1-560a-4a49-8b89-c0042b705575', 'email_notifications', 'Notificações por e-mail', true, null, '2026-07-18T20:41:37.980014+00:00') on conflict do nothing;
insert into public.plan_features ("id", "plan_id", "feature_key", "feature_name", "enabled", "limit_value", "created_at") values ('8dd941de-c972-4e0c-8ab5-5f2f8c1f49e7', '2c5ecfc1-560a-4a49-8b89-c0042b705575', 'history', 'Histórico completo', true, null, '2026-07-18T20:41:37.980014+00:00') on conflict do nothing;
insert into public.plan_features ("id", "plan_id", "feature_key", "feature_name", "enabled", "limit_value", "created_at") values ('19ac9e9a-205a-41c7-9790-7671338a985e', '2c5ecfc1-560a-4a49-8b89-c0042b705575', 'support_ticket', 'Suporte por ticket', true, null, '2026-07-18T20:41:37.980014+00:00') on conflict do nothing;
insert into public.plan_features ("id", "plan_id", "feature_key", "feature_name", "enabled", "limit_value", "created_at") values ('f0f8c920-c785-494d-b8cc-faa14acd2313', '3a95c4ed-75c1-4e77-8d90-69b8c9dd3939', 'employees', 'Funcionários ilimitados', true, null, '2026-07-18T20:41:37.980014+00:00') on conflict do nothing;
insert into public.plan_features ("id", "plan_id", "feature_key", "feature_name", "enabled", "limit_value", "created_at") values ('800a6f8b-d7c9-48b4-89cd-8df6535d079e', '3a95c4ed-75c1-4e77-8d90-69b8c9dd3939', 'custom_domain', 'Domínio personalizado', true, null, '2026-07-18T20:41:37.980014+00:00') on conflict do nothing;
insert into public.plan_features ("id", "plan_id", "feature_key", "feature_name", "enabled", "limit_value", "created_at") values ('db1a51b9-401b-4bb2-bb63-cdf8f99dd1b3', '3a95c4ed-75c1-4e77-8d90-69b8c9dd3939', 'auto_campaigns', 'Campanhas automáticas', true, null, '2026-07-18T20:41:37.980014+00:00') on conflict do nothing;
insert into public.plan_features ("id", "plan_id", "feature_key", "feature_name", "enabled", "limit_value", "created_at") values ('8958d0e6-f6a4-432f-a916-50d9d255ac1f', '3a95c4ed-75c1-4e77-8d90-69b8c9dd3939', 'multi_units', 'Múltiplas unidades', true, null, '2026-07-18T20:41:37.980014+00:00') on conflict do nothing;
insert into public.plan_features ("id", "plan_id", "feature_key", "feature_name", "enabled", "limit_value", "created_at") values ('281a4f39-c551-4a64-bafd-b92d04659c31', '3a95c4ed-75c1-4e77-8d90-69b8c9dd3939', 'custom_permissions', 'Permissões personalizadas', true, null, '2026-07-18T20:41:37.980014+00:00') on conflict do nothing;
insert into public.plan_features ("id", "plan_id", "feature_key", "feature_name", "enabled", "limit_value", "created_at") values ('56f7704b-f2ac-4e3d-b745-5ce2469694d5', '3a95c4ed-75c1-4e77-8d90-69b8c9dd3939', 'audit', 'Auditoria', true, null, '2026-07-18T20:41:37.980014+00:00') on conflict do nothing;
insert into public.plan_features ("id", "plan_id", "feature_key", "feature_name", "enabled", "limit_value", "created_at") values ('3fb96702-788e-4639-9731-64a6073de128', '3a95c4ed-75c1-4e77-8d90-69b8c9dd3939', 'api', 'API', true, null, '2026-07-18T20:41:37.980014+00:00') on conflict do nothing;
insert into public.plan_features ("id", "plan_id", "feature_key", "feature_name", "enabled", "limit_value", "created_at") values ('8592dec1-4ef8-45f6-b870-ff56e6d2c944', '3a95c4ed-75c1-4e77-8d90-69b8c9dd3939', 'webhooks', 'Webhooks', true, null, '2026-07-18T20:41:37.980014+00:00') on conflict do nothing;
insert into public.plan_features ("id", "plan_id", "feature_key", "feature_name", "enabled", "limit_value", "created_at") values ('eb7b6a30-4c40-4e3b-b663-12ab00333a93', '3a95c4ed-75c1-4e77-8d90-69b8c9dd3939', 'integrations', 'Integrações', true, null, '2026-07-18T20:41:37.980014+00:00') on conflict do nothing;
insert into public.plan_features ("id", "plan_id", "feature_key", "feature_name", "enabled", "limit_value", "created_at") values ('6d3b772f-6a0d-4592-bcee-a6cffae77b65', '3a95c4ed-75c1-4e77-8d90-69b8c9dd3939', 'priority_support', 'Suporte prioritário', true, null, '2026-07-18T20:41:37.980014+00:00') on conflict do nothing;
insert into public.plan_features ("id", "plan_id", "feature_key", "feature_name", "enabled", "limit_value", "created_at") values ('624a7880-5e47-4aec-b623-7cd58b9ce4c6', '2c5ecfc1-560a-4a49-8b89-c0042b705575', 'loyalty_cards', 'Cartões de fidelidade digitais', true, null, '2026-07-18T21:04:13.97616+00:00') on conflict do nothing;
insert into public.plan_features ("id", "plan_id", "feature_key", "feature_name", "enabled", "limit_value", "created_at") values ('1f011573-a660-419a-a776-d39fa93de28b', '2c5ecfc1-560a-4a49-8b89-c0042b705575', 'custom_branding', 'Marca e cores personalizadas', true, null, '2026-07-18T21:04:27.560587+00:00') on conflict do nothing;
insert into public.plan_features ("id", "plan_id", "feature_key", "feature_name", "enabled", "limit_value", "created_at") values ('4eb43f1c-7422-48eb-9f39-6d7e41e2fb1f', '2c5ecfc1-560a-4a49-8b89-c0042b705575', 'custom_stamp_icons', 'Ícones de carimbo personalizados', true, null, '2026-07-18T21:04:32.914624+00:00') on conflict do nothing;
insert into public.plan_features ("id", "plan_id", "feature_key", "feature_name", "enabled", "limit_value", "created_at") values ('7cc31604-ceec-40b5-ac4e-0c9b8bcf1fa9', '2c5ecfc1-560a-4a49-8b89-c0042b705575', 'multi_unit', 'Multi-unidades / filiais', true, null, '2026-07-18T21:04:34.701281+00:00') on conflict do nothing;
insert into public.plan_features ("id", "plan_id", "feature_key", "feature_name", "enabled", "limit_value", "created_at") values ('e8687aa4-0f57-4022-86af-84d617559baf', '2c5ecfc1-560a-4a49-8b89-c0042b705575', 'email_marketing', 'E-mail marketing', true, null, '2026-07-18T21:04:41.340814+00:00') on conflict do nothing;
insert into public.plan_features ("id", "plan_id", "feature_key", "feature_name", "enabled", "limit_value", "created_at") values ('3398ea1b-f2ed-4443-a8a4-b6343a1bebf8', '2c5ecfc1-560a-4a49-8b89-c0042b705575', 'whatsapp_notifications', 'Notificações via WhatsApp', true, null, '2026-07-18T21:04:57.423679+00:00') on conflict do nothing;
insert into public.plan_features ("id", "plan_id", "feature_key", "feature_name", "enabled", "limit_value", "created_at") values ('137bd8f0-61ab-4a1d-ab46-2b422934a915', '2c5ecfc1-560a-4a49-8b89-c0042b705575', 'qr_generator', 'Gerador de QR Code / material impresso', true, null, '2026-07-18T21:04:58.55402+00:00') on conflict do nothing;
insert into public.plan_features ("id", "plan_id", "feature_key", "feature_name", "enabled", "limit_value", "created_at") values ('2bc34fb7-52a8-4d30-8e93-2c0957df349c', '2c5ecfc1-560a-4a49-8b89-c0042b705575', 'customer_crm', 'CRM de clientes', true, null, '2026-07-18T21:05:13.329214+00:00') on conflict do nothing;
insert into public.plan_features ("id", "plan_id", "feature_key", "feature_name", "enabled", "limit_value", "created_at") values ('96e79ae1-8964-4004-9bff-38c35500ae53', '2c5ecfc1-560a-4a49-8b89-c0042b705575', 'customer_export', 'Exportação de clientes', true, null, '2026-07-18T21:05:14.55954+00:00') on conflict do nothing;
insert into public.plan_features ("id", "plan_id", "feature_key", "feature_name", "enabled", "limit_value", "created_at") values ('053a66ad-e35b-46db-9a69-e11654085e0d', '2c5ecfc1-560a-4a49-8b89-c0042b705575', 'customer_import', 'Importação de clientes (CSV)', true, null, '2026-07-18T21:05:16.910926+00:00') on conflict do nothing;
insert into public.plan_features ("id", "plan_id", "feature_key", "feature_name", "enabled", "limit_value", "created_at") values ('3b6c1cf7-5423-47e3-88c3-09ebccd3cf83', '2c5ecfc1-560a-4a49-8b89-c0042b705575', 'customer_segments', 'Segmentação avançada', true, null, '2026-07-18T21:05:18.613022+00:00') on conflict do nothing;
insert into public.plan_features ("id", "plan_id", "feature_key", "feature_name", "enabled", "limit_value", "created_at") values ('1a0e4783-d1d9-4d03-8fa4-01315ed95015', '2c5ecfc1-560a-4a49-8b89-c0042b705575', 'dashboard_realtime', 'Dashboard em tempo real', true, null, '2026-07-18T21:05:20.525011+00:00') on conflict do nothing;
insert into public.plan_features ("id", "plan_id", "feature_key", "feature_name", "enabled", "limit_value", "created_at") values ('a4b7273f-568c-4f5d-a7e0-be9c92ff66e8', '2c5ecfc1-560a-4a49-8b89-c0042b705575', 'advanced_reports', 'Relatórios avançados', true, null, '2026-07-18T21:05:22.079209+00:00') on conflict do nothing;
insert into public.plan_features ("id", "plan_id", "feature_key", "feature_name", "enabled", "limit_value", "created_at") values ('1f93eee6-bc29-418a-b3e9-17b8bcad7ce2', '2c5ecfc1-560a-4a49-8b89-c0042b705575', 'csv_pdf_export', 'Exportação CSV / PDF', true, null, '2026-07-18T21:05:23.327416+00:00') on conflict do nothing;
insert into public.plan_features ("id", "plan_id", "feature_key", "feature_name", "enabled", "limit_value", "created_at") values ('fe335618-5efc-4b78-a9a8-94059233ad62', '2c5ecfc1-560a-4a49-8b89-c0042b705575', 'support_email', 'Suporte por e-mail', true, null, '2026-07-18T21:06:17.303384+00:00') on conflict do nothing;
insert into public.plan_features ("id", "plan_id", "feature_key", "feature_name", "enabled", "limit_value", "created_at") values ('959f4dd1-bd3e-4c2f-91e0-40d331d9579f', '2c5ecfc1-560a-4a49-8b89-c0042b705575', 'knowledge_base', 'Base de conhecimento', true, null, '2026-07-18T21:06:19.634283+00:00') on conflict do nothing;
insert into public.plan_features ("id", "plan_id", "feature_key", "feature_name", "enabled", "limit_value", "created_at") values ('7e192ea5-4c6a-4dc0-b802-a265b70b1bef', '2c5ecfc1-560a-4a49-8b89-c0042b705575', 'support_dedicated', 'Gerente de conta dedicado', true, null, '2026-07-18T21:06:25.930539+00:00') on conflict do nothing;
insert into public.plan_features ("id", "plan_id", "feature_key", "feature_name", "enabled", "limit_value", "created_at") values ('257779cc-8600-4dc0-a820-9ce2247af7a4', '2c5ecfc1-560a-4a49-8b89-c0042b705575', 'support_priority', 'Suporte prioritário', true, null, '2026-07-18T21:06:32.725934+00:00') on conflict do nothing;
insert into public.plan_features ("id", "plan_id", "feature_key", "feature_name", "enabled", "limit_value", "created_at") values ('3ee5b5c7-5950-41dd-95c6-d0ccc5481e17', '4fce6d1e-5c5f-43af-92c8-d0ce85f405d4', 'loyalty_cards', 'Cartões de fidelidade digitais', true, null, '2026-07-18T21:07:51.885668+00:00') on conflict do nothing;
insert into public.plan_features ("id", "plan_id", "feature_key", "feature_name", "enabled", "limit_value", "created_at") values ('c91ed202-9a6c-482d-b63b-248481625ce2', '4fce6d1e-5c5f-43af-92c8-d0ce85f405d4', 'custom_branding', 'Marca e cores personalizadas', true, null, '2026-07-18T21:07:52.108551+00:00') on conflict do nothing;
insert into public.plan_features ("id", "plan_id", "feature_key", "feature_name", "enabled", "limit_value", "created_at") values ('8ebccffa-a776-4504-b160-b43f688aadc8', '4fce6d1e-5c5f-43af-92c8-d0ce85f405d4', 'custom_stamp_icons', 'Ícones de carimbo personalizados', true, null, '2026-07-18T21:07:54.303269+00:00') on conflict do nothing;
insert into public.plan_features ("id", "plan_id", "feature_key", "feature_name", "enabled", "limit_value", "created_at") values ('fbfcef11-2643-4bf0-933a-1f36c647c5ec', '4fce6d1e-5c5f-43af-92c8-d0ce85f405d4', 'email_marketing', 'E-mail marketing', true, null, '2026-07-18T21:07:59.07296+00:00') on conflict do nothing;
insert into public.plan_features ("id", "plan_id", "feature_key", "feature_name", "enabled", "limit_value", "created_at") values ('ed8196a5-6821-46d9-b07b-494425f56cee', '4fce6d1e-5c5f-43af-92c8-d0ce85f405d4', 'whatsapp_notifications', 'Notificações via WhatsApp', true, null, '2026-07-18T21:08:01.889657+00:00') on conflict do nothing;
insert into public.plan_features ("id", "plan_id", "feature_key", "feature_name", "enabled", "limit_value", "created_at") values ('4fbdc02f-7c63-4322-94d1-6dbbba6bf897', '4fce6d1e-5c5f-43af-92c8-d0ce85f405d4', 'qr_generator', 'Gerador de QR Code / material impresso', true, null, '2026-07-18T21:08:03.195325+00:00') on conflict do nothing;
insert into public.plan_features ("id", "plan_id", "feature_key", "feature_name", "enabled", "limit_value", "created_at") values ('792dbcfd-4268-4d0c-92c4-1da0feaee4ee', '4fce6d1e-5c5f-43af-92c8-d0ce85f405d4', 'customer_crm', 'CRM de clientes', true, null, '2026-07-18T21:08:04.640587+00:00') on conflict do nothing;
insert into public.plan_features ("id", "plan_id", "feature_key", "feature_name", "enabled", "limit_value", "created_at") values ('8f9bdfa3-e81d-4ccf-b070-95480e3432b8', '4fce6d1e-5c5f-43af-92c8-d0ce85f405d4', 'customer_export', 'Exportação de clientes', true, null, '2026-07-18T21:08:06.003539+00:00') on conflict do nothing;
insert into public.plan_features ("id", "plan_id", "feature_key", "feature_name", "enabled", "limit_value", "created_at") values ('acdb3aa1-8fc8-4a00-b49b-edd9e0c7d211', '4fce6d1e-5c5f-43af-92c8-d0ce85f405d4', 'customer_import', 'Importação de clientes (CSV)', true, null, '2026-07-18T21:08:11.511307+00:00') on conflict do nothing;
insert into public.plan_features ("id", "plan_id", "feature_key", "feature_name", "enabled", "limit_value", "created_at") values ('a6a80018-e2d8-4dc5-9b44-6f9245fbfbc6', '4fce6d1e-5c5f-43af-92c8-d0ce85f405d4', 'customer_segments', 'Segmentação avançada', true, null, '2026-07-18T21:08:13.999928+00:00') on conflict do nothing;
insert into public.plan_features ("id", "plan_id", "feature_key", "feature_name", "enabled", "limit_value", "created_at") values ('3e1ca096-5286-46d7-b410-b6f35c9f1d4f', '4fce6d1e-5c5f-43af-92c8-d0ce85f405d4', 'advanced_reports', 'Relatórios avançados', true, null, '2026-07-18T21:08:27.690673+00:00') on conflict do nothing;
insert into public.plan_features ("id", "plan_id", "feature_key", "feature_name", "enabled", "limit_value", "created_at") values ('ab92abe2-0329-433b-95f6-65e88f068fae', '4fce6d1e-5c5f-43af-92c8-d0ce85f405d4', 'dashboard_realtime', 'Dashboard em tempo real', true, null, '2026-07-18T21:08:30.753214+00:00') on conflict do nothing;
insert into public.plan_features ("id", "plan_id", "feature_key", "feature_name", "enabled", "limit_value", "created_at") values ('9cc75031-3019-4281-b809-553515f54b0f', '4fce6d1e-5c5f-43af-92c8-d0ce85f405d4', 'reviews', 'Avaliações de atendimento', true, null, '2026-07-19T20:50:57.333134+00:00') on conflict do nothing;
insert into public.plan_features ("id", "plan_id", "feature_key", "feature_name", "enabled", "limit_value", "created_at") values ('9358fa38-b2f1-4cde-aeb7-eb6ea6ab3121', '2c5ecfc1-560a-4a49-8b89-c0042b705575', 'push_notifications', 'Notificações push', true, 1000, '2026-07-18T21:04:40.03978+00:00') on conflict do nothing;
insert into public.plan_features ("id", "plan_id", "feature_key", "feature_name", "enabled", "limit_value", "created_at") values ('40552e88-0de3-4a49-9c4b-302874ad2500', '3a95c4ed-75c1-4e77-8d90-69b8c9dd3939', 'dashboard', 'Dashboard', true, null, '2026-07-18T20:41:37.980014+00:00') on conflict do nothing;
insert into public.plan_features ("id", "plan_id", "feature_key", "feature_name", "enabled", "limit_value", "created_at") values ('b30d184a-9ebd-4a0a-97c8-4541cd5db467', '4fce6d1e-5c5f-43af-92c8-d0ce85f405d4', 'reviews_nps', 'NPS', false, null, '2026-07-19T20:50:57.333134+00:00') on conflict do nothing;
insert into public.plan_features ("id", "plan_id", "feature_key", "feature_name", "enabled", "limit_value", "created_at") values ('f209abb5-776f-460e-8208-770705dcd037', '4fce6d1e-5c5f-43af-92c8-d0ce85f405d4', 'reviews_export', 'Exportar avaliações', false, null, '2026-07-19T20:50:57.333134+00:00') on conflict do nothing;
insert into public.plan_features ("id", "plan_id", "feature_key", "feature_name", "enabled", "limit_value", "created_at") values ('5c127676-e85b-45ef-b1ba-9c0a9dd3de1c', '4fce6d1e-5c5f-43af-92c8-d0ce85f405d4', 'reviews_google', 'Redirecionar para Google Reviews', false, null, '2026-07-19T20:50:57.333134+00:00') on conflict do nothing;
insert into public.plan_features ("id", "plan_id", "feature_key", "feature_name", "enabled", "limit_value", "created_at") values ('1b757934-fcdc-4c67-8a2a-b4e1aaff3fbe', '2c5ecfc1-560a-4a49-8b89-c0042b705575', 'reviews', 'Avaliações de atendimento', true, null, '2026-07-19T20:50:57.333134+00:00') on conflict do nothing;
insert into public.plan_features ("id", "plan_id", "feature_key", "feature_name", "enabled", "limit_value", "created_at") values ('9a5210ca-267b-4e1a-8db7-20886c16d7d7', '2c5ecfc1-560a-4a49-8b89-c0042b705575', 'reviews_reply', 'Responder avaliações', true, null, '2026-07-19T20:50:57.333134+00:00') on conflict do nothing;
insert into public.plan_features ("id", "plan_id", "feature_key", "feature_name", "enabled", "limit_value", "created_at") values ('df4e515a-91fb-47ea-9531-d9b289130c71', '2c5ecfc1-560a-4a49-8b89-c0042b705575', 'reviews_categories', 'Categorias de avaliação', true, null, '2026-07-19T20:50:57.333134+00:00') on conflict do nothing;
insert into public.plan_features ("id", "plan_id", "feature_key", "feature_name", "enabled", "limit_value", "created_at") values ('5effb162-77ff-4045-bc7a-e1f1a86f08d0', '2c5ecfc1-560a-4a49-8b89-c0042b705575', 'reviews_export', 'Exportar avaliações', true, null, '2026-07-19T20:50:57.333134+00:00') on conflict do nothing;
insert into public.plan_features ("id", "plan_id", "feature_key", "feature_name", "enabled", "limit_value", "created_at") values ('b774476e-3516-41a2-80f9-adb2f92194af', '2c5ecfc1-560a-4a49-8b89-c0042b705575', 'reviews_public_page', 'Página pública de avaliações', true, null, '2026-07-19T20:50:57.333134+00:00') on conflict do nothing;
insert into public.plan_features ("id", "plan_id", "feature_key", "feature_name", "enabled", "limit_value", "created_at") values ('d310f429-cda1-4f03-9c7d-7cea1674c01b', '4fce6d1e-5c5f-43af-92c8-d0ce85f405d4', 'public_reviews', 'Avaliações públicas de atendimento (QR + página)', false, null, '2026-07-19T21:37:42.568681+00:00') on conflict do nothing;
insert into public.plan_features ("id", "plan_id", "feature_key", "feature_name", "enabled", "limit_value", "created_at") values ('e5491b83-1a75-42c0-afcc-ac669a285300', '40a18a80-4bc6-45c1-9a77-9657d630818b', 'public_reviews', 'Avaliações públicas de atendimento (QR + página)', false, null, '2026-07-19T21:37:42.568681+00:00') on conflict do nothing;
insert into public.plan_features ("id", "plan_id", "feature_key", "feature_name", "enabled", "limit_value", "created_at") values ('aee35dbd-f070-48d0-b7f6-7c7c2685e82c', '2c5ecfc1-560a-4a49-8b89-c0042b705575', 'public_reviews', 'Avaliações públicas de atendimento (QR + página)', true, null, '2026-07-19T21:37:42.568681+00:00') on conflict do nothing;
insert into public.plan_features ("id", "plan_id", "feature_key", "feature_name", "enabled", "limit_value", "created_at") values ('c686d68e-5eb9-4ef0-8be2-a02afdd016f2', '3a95c4ed-75c1-4e77-8d90-69b8c9dd3939', 'remove_branding', 'Remover marca Fidelize', true, null, '2026-07-28T00:35:11.46118+00:00') on conflict do nothing;
insert into public.plan_features ("id", "plan_id", "feature_key", "feature_name", "enabled", "limit_value", "created_at") values ('91d8dc37-4460-44be-9078-aae3515975b4', '4fce6d1e-5c5f-43af-92c8-d0ce85f405d4', 'reviews_categories', 'Categorias de avaliação', true, null, '2026-07-19T20:50:57.333134+00:00') on conflict do nothing;
insert into public.plan_features ("id", "plan_id", "feature_key", "feature_name", "enabled", "limit_value", "created_at") values ('f04f4515-1ece-40c3-9baf-e65a1efe2551', '4fce6d1e-5c5f-43af-92c8-d0ce85f405d4', 'reviews_reply', 'Responder avaliações', true, null, '2026-07-19T20:50:57.333134+00:00') on conflict do nothing;
insert into public.plan_features ("id", "plan_id", "feature_key", "feature_name", "enabled", "limit_value", "created_at") values ('48cca60f-3bdb-4e5b-9a0b-0d9fee757692', '4fce6d1e-5c5f-43af-92c8-d0ce85f405d4', 'reviews_public_page', 'Página pública de avaliações', true, null, '2026-07-19T20:50:57.333134+00:00') on conflict do nothing;
insert into public.plan_features ("id", "plan_id", "feature_key", "feature_name", "enabled", "limit_value", "created_at") values ('487b6494-8bf2-4f99-8695-6e75ac84c014', '40a18a80-4bc6-45c1-9a77-9657d630818b', 'push_notifications', 'Notificações push', false, 0, '2026-07-22T01:54:01.613922+00:00') on conflict do nothing;
insert into public.plan_features ("id", "plan_id", "feature_key", "feature_name", "enabled", "limit_value", "created_at") values ('3195d079-137d-482b-ad69-f5d11e164c98', '4fce6d1e-5c5f-43af-92c8-d0ce85f405d4', 'digital_menu', 'Cardápio digital (vitrine + QR)', false, null, '2026-07-25T17:06:06.064976+00:00') on conflict do nothing;
insert into public.plan_features ("id", "plan_id", "feature_key", "feature_name", "enabled", "limit_value", "created_at") values ('8207e48d-df1b-471e-ae0b-6dc62d4cd4ab', '40a18a80-4bc6-45c1-9a77-9657d630818b', 'digital_menu', 'Cardápio digital (vitrine + QR)', false, null, '2026-07-25T17:06:06.064976+00:00') on conflict do nothing;
insert into public.plan_features ("id", "plan_id", "feature_key", "feature_name", "enabled", "limit_value", "created_at") values ('de4c239f-7a5b-4c92-bfe3-8b239a6f0647', '2c5ecfc1-560a-4a49-8b89-c0042b705575', 'digital_menu', 'Cardápio digital (vitrine + QR)', true, null, '2026-07-25T17:06:06.064976+00:00') on conflict do nothing;
insert into public.plan_features ("id", "plan_id", "feature_key", "feature_name", "enabled", "limit_value", "created_at") values ('bf519ddc-a1e1-446e-a5b0-0526665b697b', '4fce6d1e-5c5f-43af-92c8-d0ce85f405d4', 'digital_catalog', 'Catálogo digital', false, null, '2026-07-26T22:36:07.982489+00:00') on conflict do nothing;
insert into public.plan_features ("id", "plan_id", "feature_key", "feature_name", "enabled", "limit_value", "created_at") values ('b895a94e-da54-4dd7-9f8f-0a19b31a0a56', '40a18a80-4bc6-45c1-9a77-9657d630818b', 'digital_catalog', 'Catálogo digital', false, null, '2026-07-26T22:36:07.982489+00:00') on conflict do nothing;
insert into public.plan_features ("id", "plan_id", "feature_key", "feature_name", "enabled", "limit_value", "created_at") values ('a9d55f16-8bab-4790-bfb9-682110648091', '2c5ecfc1-560a-4a49-8b89-c0042b705575', 'digital_catalog', 'Catálogo digital', true, null, '2026-07-26T22:36:07.982489+00:00') on conflict do nothing;
insert into public.plan_features ("id", "plan_id", "feature_key", "feature_name", "enabled", "limit_value", "created_at") values ('5438691a-f0b8-495d-96d7-bfca704a9642', '4fce6d1e-5c5f-43af-92c8-d0ce85f405d4', 'push_notifications', 'Notificações push', true, 300, '2026-07-22T01:54:01.613922+00:00') on conflict do nothing;
insert into public.plan_features ("id", "plan_id", "feature_key", "feature_name", "enabled", "limit_value", "created_at") values ('88467496-754e-4721-a8dc-871296dcd4a4', '40a18a80-4bc6-45c1-9a77-9657d630818b', 'remove_branding', 'Remover marca Fidelize', false, null, '2026-07-28T00:35:11.46118+00:00') on conflict do nothing;
insert into public.plan_features ("id", "plan_id", "feature_key", "feature_name", "enabled", "limit_value", "created_at") values ('df1ac399-ab9e-4bf1-8763-90400a65a53a', '4fce6d1e-5c5f-43af-92c8-d0ce85f405d4', 'remove_branding', 'Remover marca Fidelize', false, null, '2026-07-28T00:35:11.46118+00:00') on conflict do nothing;
insert into public.plan_features ("id", "plan_id", "feature_key", "feature_name", "enabled", "limit_value", "created_at") values ('f5f9efab-b148-443a-8fb9-ceaa1fd0ab96', '2c5ecfc1-560a-4a49-8b89-c0042b705575', 'reviews_google', 'Redirecionar para Google Reviews', true, null, '2026-07-19T20:50:57.333134+00:00') on conflict do nothing;
insert into public.plan_features ("id", "plan_id", "feature_key", "feature_name", "enabled", "limit_value", "created_at") values ('eac7d8ce-e01c-41cb-9d89-b6ca11ee7a9e', '2c5ecfc1-560a-4a49-8b89-c0042b705575', 'reviews_nps', 'NPS', true, null, '2026-07-19T20:50:57.333134+00:00') on conflict do nothing;
insert into public.plan_features ("id", "plan_id", "feature_key", "feature_name", "enabled", "limit_value", "created_at") values ('ab98a20c-2f80-4ba3-a300-230960ea3124', '3a95c4ed-75c1-4e77-8d90-69b8c9dd3939', 'customers', 'Clientes ilimitados', true, null, '2026-07-18T20:41:37.980014+00:00') on conflict do nothing;
insert into public.plan_features ("id", "plan_id", "feature_key", "feature_name", "enabled", "limit_value", "created_at") values ('d4e5ff20-fdc9-4f4b-b02b-d30e089d0fc1', '3a95c4ed-75c1-4e77-8d90-69b8c9dd3939', 'loyalty_card', 'Cartão fidelidade digital', true, null, '2026-07-18T20:41:37.980014+00:00') on conflict do nothing;
insert into public.plan_features ("id", "plan_id", "feature_key", "feature_name", "enabled", "limit_value", "created_at") values ('a12250f8-1f1f-4d39-b714-7150dabb0e9b', '3a95c4ed-75c1-4e77-8d90-69b8c9dd3939', 'qrcode', 'QR Code', true, null, '2026-07-18T20:41:37.980014+00:00') on conflict do nothing;
insert into public.plan_features ("id", "plan_id", "feature_key", "feature_name", "enabled", "limit_value", "created_at") values ('0ffb689d-2e5f-475f-a6ff-75a7cce23895', '3a95c4ed-75c1-4e77-8d90-69b8c9dd3939', 'stamps', 'Carimbos', true, null, '2026-07-18T20:41:37.980014+00:00') on conflict do nothing;
insert into public.plan_features ("id", "plan_id", "feature_key", "feature_name", "enabled", "limit_value", "created_at") values ('344e1c6b-a455-46a6-9fc6-a867e8a5f361', '3a95c4ed-75c1-4e77-8d90-69b8c9dd3939', 'rewards', 'Recompensas', true, null, '2026-07-18T20:41:37.980014+00:00') on conflict do nothing;
insert into public.plan_features ("id", "plan_id", "feature_key", "feature_name", "enabled", "limit_value", "created_at") values ('24ccda9f-eadd-4bed-9e6e-68922acb71c3', '3a95c4ed-75c1-4e77-8d90-69b8c9dd3939', 'campaigns', 'Campanhas ilimitadas', true, null, '2026-07-18T20:41:37.980014+00:00') on conflict do nothing;
insert into public.plan_features ("id", "plan_id", "feature_key", "feature_name", "enabled", "limit_value", "created_at") values ('0dc145b4-56a7-46ec-acd2-91c6c2012f13', '3a95c4ed-75c1-4e77-8d90-69b8c9dd3939', 'reports', 'Relatórios', true, null, '2026-07-18T20:41:37.980014+00:00') on conflict do nothing;
insert into public.plan_features ("id", "plan_id", "feature_key", "feature_name", "enabled", "limit_value", "created_at") values ('78a8a0a5-6de7-4a36-b078-f2bd3b8989c5', '3a95c4ed-75c1-4e77-8d90-69b8c9dd3939', 'export', 'Exportação de dados', true, null, '2026-07-18T20:41:37.980014+00:00') on conflict do nothing;
insert into public.plan_features ("id", "plan_id", "feature_key", "feature_name", "enabled", "limit_value", "created_at") values ('84677d9b-99da-4616-9053-dd499a2992eb', '3a95c4ed-75c1-4e77-8d90-69b8c9dd3939', 'branding', 'Personalização da identidade visual', true, null, '2026-07-18T20:41:37.980014+00:00') on conflict do nothing;
insert into public.plan_features ("id", "plan_id", "feature_key", "feature_name", "enabled", "limit_value", "created_at") values ('9f3c0c4a-ffbb-4e1d-af4e-f762f989f9c1', '3a95c4ed-75c1-4e77-8d90-69b8c9dd3939', 'email_notifications', 'Notificações por e-mail', true, null, '2026-07-18T20:41:37.980014+00:00') on conflict do nothing;
insert into public.plan_features ("id", "plan_id", "feature_key", "feature_name", "enabled", "limit_value", "created_at") values ('c8af082d-e46e-4253-8a74-0a533692e280', '3a95c4ed-75c1-4e77-8d90-69b8c9dd3939', 'history', 'Histórico completo', true, null, '2026-07-29T18:32:25.816747+00:00') on conflict do nothing;
insert into public.plan_features ("id", "plan_id", "feature_key", "feature_name", "enabled", "limit_value", "created_at") values ('48c5345e-ca1f-4757-92c6-a96948b432a9', '3a95c4ed-75c1-4e77-8d90-69b8c9dd3939', 'support_ticket', 'Suporte por ticket', true, null, '2026-07-29T18:32:25.816747+00:00') on conflict do nothing;
insert into public.plan_features ("id", "plan_id", "feature_key", "feature_name", "enabled", "limit_value", "created_at") values ('69ccf36c-c2e5-4720-bfc7-7bce0cc3ca9d', '3a95c4ed-75c1-4e77-8d90-69b8c9dd3939', 'loyalty_cards', 'Cartões de fidelidade digitais', true, null, '2026-07-29T18:32:25.816747+00:00') on conflict do nothing;
insert into public.plan_features ("id", "plan_id", "feature_key", "feature_name", "enabled", "limit_value", "created_at") values ('c3ce6924-f9ad-404c-9b3f-bfc5206e2046', '3a95c4ed-75c1-4e77-8d90-69b8c9dd3939', 'custom_branding', 'Marca e cores personalizadas', true, null, '2026-07-29T18:32:25.816747+00:00') on conflict do nothing;
insert into public.plan_features ("id", "plan_id", "feature_key", "feature_name", "enabled", "limit_value", "created_at") values ('1002b84e-3bf6-4148-a90b-665fbcc2ad45', '3a95c4ed-75c1-4e77-8d90-69b8c9dd3939', 'custom_stamp_icons', 'Ícones de carimbo personalizados', true, null, '2026-07-29T18:32:25.816747+00:00') on conflict do nothing;
insert into public.plan_features ("id", "plan_id", "feature_key", "feature_name", "enabled", "limit_value", "created_at") values ('1e9ec897-7fc8-44bb-8e1f-64cd731f7cb4', '3a95c4ed-75c1-4e77-8d90-69b8c9dd3939', 'multi_unit', 'Multi-unidades / filiais', true, null, '2026-07-29T18:32:25.816747+00:00') on conflict do nothing;
insert into public.plan_features ("id", "plan_id", "feature_key", "feature_name", "enabled", "limit_value", "created_at") values ('e8dc9824-3602-4150-8b19-dfa65fca66bb', '3a95c4ed-75c1-4e77-8d90-69b8c9dd3939', 'email_marketing', 'E-mail marketing', true, null, '2026-07-29T18:32:25.816747+00:00') on conflict do nothing;
insert into public.plan_features ("id", "plan_id", "feature_key", "feature_name", "enabled", "limit_value", "created_at") values ('1f845c87-37f8-45a2-bd03-ddd19419ac81', '3a95c4ed-75c1-4e77-8d90-69b8c9dd3939', 'whatsapp_notifications', 'Notificações via WhatsApp', true, null, '2026-07-29T18:32:25.816747+00:00') on conflict do nothing;
insert into public.plan_features ("id", "plan_id", "feature_key", "feature_name", "enabled", "limit_value", "created_at") values ('0a5e41df-50f4-4c84-b179-0519d9a0f685', '3a95c4ed-75c1-4e77-8d90-69b8c9dd3939', 'qr_generator', 'Gerador de QR Code / material impresso', true, null, '2026-07-29T18:32:25.816747+00:00') on conflict do nothing;
insert into public.plan_features ("id", "plan_id", "feature_key", "feature_name", "enabled", "limit_value", "created_at") values ('ad2c8378-ffbc-46be-9d1b-96127bfccfbd', '3a95c4ed-75c1-4e77-8d90-69b8c9dd3939', 'customer_crm', 'CRM de clientes', true, null, '2026-07-29T18:32:25.816747+00:00') on conflict do nothing;
insert into public.plan_features ("id", "plan_id", "feature_key", "feature_name", "enabled", "limit_value", "created_at") values ('1dd38bf5-f6be-4df5-a2ef-30167b5657f0', '3a95c4ed-75c1-4e77-8d90-69b8c9dd3939', 'customer_export', 'Exportação de clientes', true, null, '2026-07-29T18:32:25.816747+00:00') on conflict do nothing;
insert into public.plan_features ("id", "plan_id", "feature_key", "feature_name", "enabled", "limit_value", "created_at") values ('376779b4-7511-4e68-9789-2d859a397be9', '3a95c4ed-75c1-4e77-8d90-69b8c9dd3939', 'customer_import', 'Importação de clientes (CSV)', true, null, '2026-07-29T18:32:25.816747+00:00') on conflict do nothing;
insert into public.plan_features ("id", "plan_id", "feature_key", "feature_name", "enabled", "limit_value", "created_at") values ('63e236e5-1e4c-4f1f-b27a-cceca64a48c2', '3a95c4ed-75c1-4e77-8d90-69b8c9dd3939', 'customer_segments', 'Segmentação avançada', true, null, '2026-07-29T18:32:25.816747+00:00') on conflict do nothing;
insert into public.plan_features ("id", "plan_id", "feature_key", "feature_name", "enabled", "limit_value", "created_at") values ('8a3aedcf-490f-434f-a763-511c0e725920', '3a95c4ed-75c1-4e77-8d90-69b8c9dd3939', 'dashboard_realtime', 'Dashboard em tempo real', true, null, '2026-07-29T18:32:25.816747+00:00') on conflict do nothing;
insert into public.plan_features ("id", "plan_id", "feature_key", "feature_name", "enabled", "limit_value", "created_at") values ('9c6a1ef0-d6c1-4247-86c9-06ee8ee4db02', '3a95c4ed-75c1-4e77-8d90-69b8c9dd3939', 'advanced_reports', 'Relatórios avançados', true, null, '2026-07-18T20:41:37.980014+00:00') on conflict do nothing;
insert into public.plan_features ("id", "plan_id", "feature_key", "feature_name", "enabled", "limit_value", "created_at") values ('bbecc776-bdba-43b0-a665-1aa23a24c3cc', '3a95c4ed-75c1-4e77-8d90-69b8c9dd3939', 'csv_pdf_export', 'Exportação CSV / PDF', true, null, '2026-07-29T18:32:25.816747+00:00') on conflict do nothing;
insert into public.plan_features ("id", "plan_id", "feature_key", "feature_name", "enabled", "limit_value", "created_at") values ('a24283c7-d05b-44f1-a4a4-0dbd3785181b', '3a95c4ed-75c1-4e77-8d90-69b8c9dd3939', 'support_email', 'Suporte por e-mail', true, null, '2026-07-29T18:32:25.816747+00:00') on conflict do nothing;
insert into public.plan_features ("id", "plan_id", "feature_key", "feature_name", "enabled", "limit_value", "created_at") values ('0a5b7a40-5ff7-4d4a-8083-45cbbcee71b0', '2c5ecfc1-560a-4a49-8b89-c0042b705575', 'remove_branding', 'Remover marca Fidelize', false, null, '2026-07-28T00:35:11.46118+00:00') on conflict do nothing;
insert into public.plan_features ("id", "plan_id", "feature_key", "feature_name", "enabled", "limit_value", "created_at") values ('8fc4c62f-34bc-42fc-a87b-5e6eb05b547a', '3a95c4ed-75c1-4e77-8d90-69b8c9dd3939', 'knowledge_base', 'Base de conhecimento', true, null, '2026-07-29T18:32:25.816747+00:00') on conflict do nothing;
insert into public.plan_features ("id", "plan_id", "feature_key", "feature_name", "enabled", "limit_value", "created_at") values ('0bacfde5-73e9-4da8-8cd4-1f750a911a0b', '3a95c4ed-75c1-4e77-8d90-69b8c9dd3939', 'support_dedicated', 'Gerente de conta dedicado', true, null, '2026-07-29T18:32:25.816747+00:00') on conflict do nothing;
insert into public.plan_features ("id", "plan_id", "feature_key", "feature_name", "enabled", "limit_value", "created_at") values ('ab8a0a80-39b0-4d82-8aa2-9bd7dc5a7abf', '3a95c4ed-75c1-4e77-8d90-69b8c9dd3939', 'support_priority', 'Suporte prioritário', true, null, '2026-07-29T18:32:25.816747+00:00') on conflict do nothing;
insert into public.plan_features ("id", "plan_id", "feature_key", "feature_name", "enabled", "limit_value", "created_at") values ('95ea5ba8-5076-4fe5-acb8-af0039d1f4b0', '3a95c4ed-75c1-4e77-8d90-69b8c9dd3939', 'push_notifications', 'Notificações push', true, null, '2026-07-22T01:54:01.613922+00:00') on conflict do nothing;
insert into public.plan_features ("id", "plan_id", "feature_key", "feature_name", "enabled", "limit_value", "created_at") values ('5d794223-a9a2-4280-b1ce-9ed6e33fba1f', '3a95c4ed-75c1-4e77-8d90-69b8c9dd3939', 'reviews', 'Avaliações de atendimento', true, null, '2026-07-19T20:50:57.333134+00:00') on conflict do nothing;
insert into public.plan_features ("id", "plan_id", "feature_key", "feature_name", "enabled", "limit_value", "created_at") values ('d0addef3-d4f3-429c-9aad-6c2353b344b7', '3a95c4ed-75c1-4e77-8d90-69b8c9dd3939', 'reviews_reply', 'Responder avaliações', true, null, '2026-07-19T20:50:57.333134+00:00') on conflict do nothing;
insert into public.plan_features ("id", "plan_id", "feature_key", "feature_name", "enabled", "limit_value", "created_at") values ('72f83acd-1f1a-4b7a-b2cb-f9952b867a3e', '3a95c4ed-75c1-4e77-8d90-69b8c9dd3939', 'reviews_categories', 'Categorias de avaliação', true, null, '2026-07-19T20:50:57.333134+00:00') on conflict do nothing;
insert into public.plan_features ("id", "plan_id", "feature_key", "feature_name", "enabled", "limit_value", "created_at") values ('00e7081a-e3d4-4b53-b36a-17932ba309e1', '3a95c4ed-75c1-4e77-8d90-69b8c9dd3939', 'reviews_export', 'Exportar avaliações', true, null, '2026-07-19T20:50:57.333134+00:00') on conflict do nothing;
insert into public.plan_features ("id", "plan_id", "feature_key", "feature_name", "enabled", "limit_value", "created_at") values ('fc2f5097-6464-4b54-b4ac-6d2bed919251', '3a95c4ed-75c1-4e77-8d90-69b8c9dd3939', 'reviews_public_page', 'Página pública de avaliações', true, null, '2026-07-19T20:50:57.333134+00:00') on conflict do nothing;
insert into public.plan_features ("id", "plan_id", "feature_key", "feature_name", "enabled", "limit_value", "created_at") values ('ce9190ad-9178-4895-a69f-5fae774b7abd', '3a95c4ed-75c1-4e77-8d90-69b8c9dd3939', 'public_reviews', 'Avaliações públicas de atendimento (QR + página)', true, null, '2026-07-19T21:37:42.568681+00:00') on conflict do nothing;
insert into public.plan_features ("id", "plan_id", "feature_key", "feature_name", "enabled", "limit_value", "created_at") values ('77f59d98-b811-48a8-8f84-a4e175f99770', '3a95c4ed-75c1-4e77-8d90-69b8c9dd3939', 'digital_menu', 'Cardápio digital (vitrine + QR)', true, null, '2026-07-25T17:06:06.064976+00:00') on conflict do nothing;
insert into public.plan_features ("id", "plan_id", "feature_key", "feature_name", "enabled", "limit_value", "created_at") values ('dc01da54-9cfe-4406-8fde-3f01648a3582', '3a95c4ed-75c1-4e77-8d90-69b8c9dd3939', 'digital_catalog', 'Catálogo digital', true, null, '2026-07-26T22:36:07.982489+00:00') on conflict do nothing;
insert into public.plan_features ("id", "plan_id", "feature_key", "feature_name", "enabled", "limit_value", "created_at") values ('80ba6b94-23f6-4e52-b85b-4684bedc1a64', '3a95c4ed-75c1-4e77-8d90-69b8c9dd3939', 'reviews_google', 'Redirecionar para Google Reviews', true, null, '2026-07-19T20:50:57.333134+00:00') on conflict do nothing;
insert into public.plan_features ("id", "plan_id", "feature_key", "feature_name", "enabled", "limit_value", "created_at") values ('d904ce64-b988-4ab0-b7aa-eaad5010aa03', '3a95c4ed-75c1-4e77-8d90-69b8c9dd3939', 'reviews_nps', 'NPS', true, null, '2026-07-19T20:50:57.333134+00:00') on conflict do nothing;
insert into public.plan_features ("id", "plan_id", "feature_key", "feature_name", "enabled", "limit_value", "created_at") values ('e1a5dba9-c956-4c88-8029-14cc679b002a', '3a95c4ed-75c1-4e77-8d90-69b8c9dd3939', 'menu.ai', 'Inteligência de Cardápio com IA', true, null, '2026-07-29T19:18:15.56976+00:00') on conflict do nothing;
insert into public.plan_features ("id", "plan_id", "feature_key", "feature_name", "enabled", "limit_value", "created_at") values ('a0aff803-2cc0-40a6-98b6-bdf5b743aa6a', '3a95c4ed-75c1-4e77-8d90-69b8c9dd3939', 'catalog.ai', 'Inteligência de Catálogo com IA', true, null, '2026-07-29T19:18:15.56976+00:00') on conflict do nothing;
insert into public.plan_features ("id", "plan_id", "feature_key", "feature_name", "enabled", "limit_value", "created_at") values ('9a01e2b0-54be-47a1-8ab5-066f83b89216', '2c5ecfc1-560a-4a49-8b89-c0042b705575', 'menu.ai', 'Inteligência de Cardápio com IA', true, null, '2026-07-29T19:18:15.56976+00:00') on conflict do nothing;
insert into public.plan_features ("id", "plan_id", "feature_key", "feature_name", "enabled", "limit_value", "created_at") values ('6e4f7298-7775-4bea-aad7-38eb6f84c4ab', '2c5ecfc1-560a-4a49-8b89-c0042b705575', 'catalog.ai', 'Inteligência de Catálogo com IA', true, null, '2026-07-29T19:18:15.56976+00:00') on conflict do nothing;
insert into public.plan_features ("id", "plan_id", "feature_key", "feature_name", "enabled", "limit_value", "created_at") values ('95b56a42-9005-4ec6-8da2-d90fbaa2f086', '40a18a80-4bc6-45c1-9a77-9657d630818b', 'menu.ai', 'Inteligência de Cardápio com IA', false, null, '2026-07-29T19:18:15.56976+00:00') on conflict do nothing;
insert into public.plan_features ("id", "plan_id", "feature_key", "feature_name", "enabled", "limit_value", "created_at") values ('1c71cde9-3072-476a-b2af-4784fdec976c', '40a18a80-4bc6-45c1-9a77-9657d630818b', 'catalog.ai', 'Inteligência de Catálogo com IA', false, null, '2026-07-29T19:18:15.56976+00:00') on conflict do nothing;
insert into public.plan_features ("id", "plan_id", "feature_key", "feature_name", "enabled", "limit_value", "created_at") values ('a66370bf-80c2-4544-8acb-92c3200979aa', '4fce6d1e-5c5f-43af-92c8-d0ce85f405d4', 'menu.ai', 'Inteligência de Cardápio com IA', false, null, '2026-07-29T19:18:15.56976+00:00') on conflict do nothing;
insert into public.plan_features ("id", "plan_id", "feature_key", "feature_name", "enabled", "limit_value", "created_at") values ('71efc32e-9e5a-4f93-83c8-573f41d4eea7', '4fce6d1e-5c5f-43af-92c8-d0ce85f405d4', 'catalog.ai', 'Inteligência de Catálogo com IA', false, null, '2026-07-29T19:18:15.56976+00:00') on conflict do nothing;
insert into public.plan_features ("id", "plan_id", "feature_key", "feature_name", "enabled", "limit_value", "created_at") values ('43ca7dca-37a9-4546-b586-07cc6bb10698', 'd1fd179b-4efc-4f4d-ac18-26fee75e3922', 'employees', 'Funcionários ilimitados', true, null, '2026-07-30T19:01:17.240267+00:00') on conflict do nothing;
insert into public.plan_features ("id", "plan_id", "feature_key", "feature_name", "enabled", "limit_value", "created_at") values ('6528afec-289c-42b1-b5ee-705722c059f6', 'd1fd179b-4efc-4f4d-ac18-26fee75e3922', 'custom_domain', 'Domínio personalizado', true, null, '2026-07-30T19:01:17.240267+00:00') on conflict do nothing;
insert into public.plan_features ("id", "plan_id", "feature_key", "feature_name", "enabled", "limit_value", "created_at") values ('9f9b1f22-b3b0-4736-b08c-8588f2e5b7e1', 'd1fd179b-4efc-4f4d-ac18-26fee75e3922', 'auto_campaigns', 'Campanhas automáticas', true, null, '2026-07-30T19:01:17.240267+00:00') on conflict do nothing;
insert into public.plan_features ("id", "plan_id", "feature_key", "feature_name", "enabled", "limit_value", "created_at") values ('77f84a2a-c88a-4620-aa31-828d5e47d4ab', 'd1fd179b-4efc-4f4d-ac18-26fee75e3922', 'multi_units', 'Múltiplas unidades', true, null, '2026-07-30T19:01:17.240267+00:00') on conflict do nothing;
insert into public.plan_features ("id", "plan_id", "feature_key", "feature_name", "enabled", "limit_value", "created_at") values ('3c98e98b-8518-4a85-b4a2-7506f0df85c3', 'd1fd179b-4efc-4f4d-ac18-26fee75e3922', 'custom_permissions', 'Permissões personalizadas', true, null, '2026-07-30T19:01:17.240267+00:00') on conflict do nothing;
insert into public.plan_features ("id", "plan_id", "feature_key", "feature_name", "enabled", "limit_value", "created_at") values ('0ce1056f-0c81-4b3e-9323-1ae124d9456a', 'd1fd179b-4efc-4f4d-ac18-26fee75e3922', 'audit', 'Auditoria', true, null, '2026-07-30T19:01:17.240267+00:00') on conflict do nothing;
insert into public.plan_features ("id", "plan_id", "feature_key", "feature_name", "enabled", "limit_value", "created_at") values ('890878fe-7bfe-4c01-b889-002c546645a6', 'd1fd179b-4efc-4f4d-ac18-26fee75e3922', 'api', 'API', true, null, '2026-07-30T19:01:17.240267+00:00') on conflict do nothing;
insert into public.plan_features ("id", "plan_id", "feature_key", "feature_name", "enabled", "limit_value", "created_at") values ('c95ec6df-fe59-4caa-a141-c0e6fbcdc5bd', 'd1fd179b-4efc-4f4d-ac18-26fee75e3922', 'webhooks', 'Webhooks', true, null, '2026-07-30T19:01:17.240267+00:00') on conflict do nothing;
insert into public.plan_features ("id", "plan_id", "feature_key", "feature_name", "enabled", "limit_value", "created_at") values ('f690839f-5db8-4807-986b-f6f6ea2893ca', 'd1fd179b-4efc-4f4d-ac18-26fee75e3922', 'integrations', 'Integrações', true, null, '2026-07-30T19:01:17.240267+00:00') on conflict do nothing;
insert into public.plan_features ("id", "plan_id", "feature_key", "feature_name", "enabled", "limit_value", "created_at") values ('e02aed91-e5a0-4dd4-a5d7-f10e83d92fe3', 'd1fd179b-4efc-4f4d-ac18-26fee75e3922', 'priority_support', 'Suporte prioritário', true, null, '2026-07-30T19:01:17.240267+00:00') on conflict do nothing;
insert into public.plan_features ("id", "plan_id", "feature_key", "feature_name", "enabled", "limit_value", "created_at") values ('ee8816ec-7b7c-46cb-b2a5-b5f01bf8aac7', 'd1fd179b-4efc-4f4d-ac18-26fee75e3922', 'dashboard', 'Dashboard', true, null, '2026-07-30T19:01:17.240267+00:00') on conflict do nothing;
insert into public.plan_features ("id", "plan_id", "feature_key", "feature_name", "enabled", "limit_value", "created_at") values ('4ad70def-3358-4615-8edb-b65894236349', 'd1fd179b-4efc-4f4d-ac18-26fee75e3922', 'remove_branding', 'Remover marca Fidelize', true, null, '2026-07-30T19:01:17.240267+00:00') on conflict do nothing;
insert into public.plan_features ("id", "plan_id", "feature_key", "feature_name", "enabled", "limit_value", "created_at") values ('8c44247a-7a16-422e-ad5d-81df37ce7876', 'd1fd179b-4efc-4f4d-ac18-26fee75e3922', 'customers', 'Clientes ilimitados', true, null, '2026-07-30T19:01:17.240267+00:00') on conflict do nothing;
insert into public.plan_features ("id", "plan_id", "feature_key", "feature_name", "enabled", "limit_value", "created_at") values ('4cd2a739-2ea4-4c7f-bb7d-e061ab619aa2', 'd1fd179b-4efc-4f4d-ac18-26fee75e3922', 'loyalty_card', 'Cartão fidelidade digital', true, null, '2026-07-30T19:01:17.240267+00:00') on conflict do nothing;
insert into public.plan_features ("id", "plan_id", "feature_key", "feature_name", "enabled", "limit_value", "created_at") values ('c244c76c-5064-4b43-97d0-8f6bba775bb1', 'd1fd179b-4efc-4f4d-ac18-26fee75e3922', 'qrcode', 'QR Code', true, null, '2026-07-30T19:01:17.240267+00:00') on conflict do nothing;
insert into public.plan_features ("id", "plan_id", "feature_key", "feature_name", "enabled", "limit_value", "created_at") values ('46cb7655-e878-42e5-89d7-8ca8a2689e1c', 'd1fd179b-4efc-4f4d-ac18-26fee75e3922', 'stamps', 'Carimbos', true, null, '2026-07-30T19:01:17.240267+00:00') on conflict do nothing;
insert into public.plan_features ("id", "plan_id", "feature_key", "feature_name", "enabled", "limit_value", "created_at") values ('dc45fec6-f96a-4c2a-a711-64d802c670e2', 'd1fd179b-4efc-4f4d-ac18-26fee75e3922', 'rewards', 'Recompensas', true, null, '2026-07-30T19:01:17.240267+00:00') on conflict do nothing;
insert into public.plan_features ("id", "plan_id", "feature_key", "feature_name", "enabled", "limit_value", "created_at") values ('3ba79f3c-83be-4166-a711-21c8dd724079', 'd1fd179b-4efc-4f4d-ac18-26fee75e3922', 'campaigns', 'Campanhas ilimitadas', true, null, '2026-07-30T19:01:17.240267+00:00') on conflict do nothing;
insert into public.plan_features ("id", "plan_id", "feature_key", "feature_name", "enabled", "limit_value", "created_at") values ('d303fc1c-1ef5-416f-a64e-bb24acb79983', 'd1fd179b-4efc-4f4d-ac18-26fee75e3922', 'reports', 'Relatórios', true, null, '2026-07-30T19:01:17.240267+00:00') on conflict do nothing;
insert into public.plan_features ("id", "plan_id", "feature_key", "feature_name", "enabled", "limit_value", "created_at") values ('b53c0e20-2b77-4959-a0db-c05abe0dce9f', 'd1fd179b-4efc-4f4d-ac18-26fee75e3922', 'export', 'Exportação de dados', true, null, '2026-07-30T19:01:17.240267+00:00') on conflict do nothing;
insert into public.plan_features ("id", "plan_id", "feature_key", "feature_name", "enabled", "limit_value", "created_at") values ('b06e2f52-8392-43ac-a330-82f0d7fc99be', 'd1fd179b-4efc-4f4d-ac18-26fee75e3922', 'branding', 'Personalização da identidade visual', true, null, '2026-07-30T19:01:17.240267+00:00') on conflict do nothing;
insert into public.plan_features ("id", "plan_id", "feature_key", "feature_name", "enabled", "limit_value", "created_at") values ('0f696fd3-89df-4988-a214-1c7aa8cebd2d', 'd1fd179b-4efc-4f4d-ac18-26fee75e3922', 'email_notifications', 'Notificações por e-mail', true, null, '2026-07-30T19:01:17.240267+00:00') on conflict do nothing;
insert into public.plan_features ("id", "plan_id", "feature_key", "feature_name", "enabled", "limit_value", "created_at") values ('a32cf634-3ed0-4124-967b-0d08e725ca46', 'd1fd179b-4efc-4f4d-ac18-26fee75e3922', 'history', 'Histórico completo', true, null, '2026-07-30T19:01:17.240267+00:00') on conflict do nothing;
insert into public.plan_features ("id", "plan_id", "feature_key", "feature_name", "enabled", "limit_value", "created_at") values ('55c004ef-0617-4132-bc7a-0499672535c1', 'd1fd179b-4efc-4f4d-ac18-26fee75e3922', 'support_ticket', 'Suporte por ticket', true, null, '2026-07-30T19:01:17.240267+00:00') on conflict do nothing;
insert into public.plan_features ("id", "plan_id", "feature_key", "feature_name", "enabled", "limit_value", "created_at") values ('c81cf811-146d-41cd-b41f-c64937d30375', 'd1fd179b-4efc-4f4d-ac18-26fee75e3922', 'loyalty_cards', 'Cartões de fidelidade digitais', true, null, '2026-07-30T19:01:17.240267+00:00') on conflict do nothing;
insert into public.plan_features ("id", "plan_id", "feature_key", "feature_name", "enabled", "limit_value", "created_at") values ('babe9efc-9aad-4b02-89b0-361f61e636dc', 'd1fd179b-4efc-4f4d-ac18-26fee75e3922', 'custom_branding', 'Marca e cores personalizadas', true, null, '2026-07-30T19:01:17.240267+00:00') on conflict do nothing;
insert into public.plan_features ("id", "plan_id", "feature_key", "feature_name", "enabled", "limit_value", "created_at") values ('9df3ba9f-3444-49a5-8e36-dccfe43c7c3b', 'd1fd179b-4efc-4f4d-ac18-26fee75e3922', 'custom_stamp_icons', 'Ícones de carimbo personalizados', true, null, '2026-07-30T19:01:17.240267+00:00') on conflict do nothing;
insert into public.plan_features ("id", "plan_id", "feature_key", "feature_name", "enabled", "limit_value", "created_at") values ('f33811e2-bbf1-4f1a-b985-a3db2e766175', 'd1fd179b-4efc-4f4d-ac18-26fee75e3922', 'multi_unit', 'Multi-unidades / filiais', true, null, '2026-07-30T19:01:17.240267+00:00') on conflict do nothing;
insert into public.plan_features ("id", "plan_id", "feature_key", "feature_name", "enabled", "limit_value", "created_at") values ('8d65a750-db47-4e66-a235-15c973fc5250', 'd1fd179b-4efc-4f4d-ac18-26fee75e3922', 'email_marketing', 'E-mail marketing', true, null, '2026-07-30T19:01:17.240267+00:00') on conflict do nothing;
insert into public.plan_features ("id", "plan_id", "feature_key", "feature_name", "enabled", "limit_value", "created_at") values ('985aa09b-b5c6-4890-b5f5-09272e0b5e44', 'd1fd179b-4efc-4f4d-ac18-26fee75e3922', 'whatsapp_notifications', 'Notificações via WhatsApp', true, null, '2026-07-30T19:01:17.240267+00:00') on conflict do nothing;
insert into public.plan_features ("id", "plan_id", "feature_key", "feature_name", "enabled", "limit_value", "created_at") values ('7de27eb2-54de-4891-8c2b-ff5bdc4e097e', 'd1fd179b-4efc-4f4d-ac18-26fee75e3922', 'qr_generator', 'Gerador de QR Code / material impresso', true, null, '2026-07-30T19:01:17.240267+00:00') on conflict do nothing;
insert into public.plan_features ("id", "plan_id", "feature_key", "feature_name", "enabled", "limit_value", "created_at") values ('b7edf5cf-59ab-4410-90cb-471981f9187e', 'd1fd179b-4efc-4f4d-ac18-26fee75e3922', 'customer_crm', 'CRM de clientes', true, null, '2026-07-30T19:01:17.240267+00:00') on conflict do nothing;
insert into public.plan_features ("id", "plan_id", "feature_key", "feature_name", "enabled", "limit_value", "created_at") values ('7a1df1c4-77cf-492c-8fdb-6af423f90de2', 'd1fd179b-4efc-4f4d-ac18-26fee75e3922', 'customer_export', 'Exportação de clientes', true, null, '2026-07-30T19:01:17.240267+00:00') on conflict do nothing;
insert into public.plan_features ("id", "plan_id", "feature_key", "feature_name", "enabled", "limit_value", "created_at") values ('9fa8f365-8616-4295-abfa-58f468100de0', 'd1fd179b-4efc-4f4d-ac18-26fee75e3922', 'customer_import', 'Importação de clientes (CSV)', true, null, '2026-07-30T19:01:17.240267+00:00') on conflict do nothing;
insert into public.plan_features ("id", "plan_id", "feature_key", "feature_name", "enabled", "limit_value", "created_at") values ('dba02f08-5308-4643-b447-171248ef1211', 'd1fd179b-4efc-4f4d-ac18-26fee75e3922', 'customer_segments', 'Segmentação avançada', true, null, '2026-07-30T19:01:17.240267+00:00') on conflict do nothing;
insert into public.plan_features ("id", "plan_id", "feature_key", "feature_name", "enabled", "limit_value", "created_at") values ('eba9de42-e813-4f57-8328-99f568e8daf9', 'd1fd179b-4efc-4f4d-ac18-26fee75e3922', 'dashboard_realtime', 'Dashboard em tempo real', true, null, '2026-07-30T19:01:17.240267+00:00') on conflict do nothing;
insert into public.plan_features ("id", "plan_id", "feature_key", "feature_name", "enabled", "limit_value", "created_at") values ('92babf72-02e8-40bd-a851-c35aef919c69', 'd1fd179b-4efc-4f4d-ac18-26fee75e3922', 'advanced_reports', 'Relatórios avançados', true, null, '2026-07-30T19:01:17.240267+00:00') on conflict do nothing;
insert into public.plan_features ("id", "plan_id", "feature_key", "feature_name", "enabled", "limit_value", "created_at") values ('c580c585-d83c-4fd3-b95a-63b80b9d230e', 'd1fd179b-4efc-4f4d-ac18-26fee75e3922', 'csv_pdf_export', 'Exportação CSV / PDF', true, null, '2026-07-30T19:01:17.240267+00:00') on conflict do nothing;
insert into public.plan_features ("id", "plan_id", "feature_key", "feature_name", "enabled", "limit_value", "created_at") values ('5f445d18-f431-48c8-9deb-a95add417f90', 'd1fd179b-4efc-4f4d-ac18-26fee75e3922', 'support_email', 'Suporte por e-mail', true, null, '2026-07-30T19:01:17.240267+00:00') on conflict do nothing;
insert into public.plan_features ("id", "plan_id", "feature_key", "feature_name", "enabled", "limit_value", "created_at") values ('be73be77-0647-41b2-81ab-3b5d559244dc', 'd1fd179b-4efc-4f4d-ac18-26fee75e3922', 'knowledge_base', 'Base de conhecimento', true, null, '2026-07-30T19:01:17.240267+00:00') on conflict do nothing;
insert into public.plan_features ("id", "plan_id", "feature_key", "feature_name", "enabled", "limit_value", "created_at") values ('c23c23b2-9d08-4d91-b2f4-498097b732f7', 'd1fd179b-4efc-4f4d-ac18-26fee75e3922', 'support_dedicated', 'Gerente de conta dedicado', true, null, '2026-07-30T19:01:17.240267+00:00') on conflict do nothing;
insert into public.plan_features ("id", "plan_id", "feature_key", "feature_name", "enabled", "limit_value", "created_at") values ('82a584af-ee1d-4dc5-82f0-1f9728bfafbf', 'd1fd179b-4efc-4f4d-ac18-26fee75e3922', 'support_priority', 'Suporte prioritário', true, null, '2026-07-30T19:01:17.240267+00:00') on conflict do nothing;
insert into public.plan_features ("id", "plan_id", "feature_key", "feature_name", "enabled", "limit_value", "created_at") values ('784eaa53-de9f-4307-b0d3-67e51858785a', 'd1fd179b-4efc-4f4d-ac18-26fee75e3922', 'push_notifications', 'Notificações push', true, null, '2026-07-30T19:01:17.240267+00:00') on conflict do nothing;
insert into public.plan_features ("id", "plan_id", "feature_key", "feature_name", "enabled", "limit_value", "created_at") values ('a516c438-8ac4-41ec-98e0-fedd4e62e7fa', 'd1fd179b-4efc-4f4d-ac18-26fee75e3922', 'reviews', 'Avaliações de atendimento', true, null, '2026-07-30T19:01:17.240267+00:00') on conflict do nothing;
insert into public.plan_features ("id", "plan_id", "feature_key", "feature_name", "enabled", "limit_value", "created_at") values ('b7e92c8d-4afb-4a04-b6d2-28b02fcd75d7', 'd1fd179b-4efc-4f4d-ac18-26fee75e3922', 'reviews_reply', 'Responder avaliações', true, null, '2026-07-30T19:01:17.240267+00:00') on conflict do nothing;
insert into public.plan_features ("id", "plan_id", "feature_key", "feature_name", "enabled", "limit_value", "created_at") values ('ef05dd43-10f2-47a7-bdd6-cba4f31f92d5', 'd1fd179b-4efc-4f4d-ac18-26fee75e3922', 'reviews_categories', 'Categorias de avaliação', true, null, '2026-07-30T19:01:17.240267+00:00') on conflict do nothing;
insert into public.plan_features ("id", "plan_id", "feature_key", "feature_name", "enabled", "limit_value", "created_at") values ('8a664d20-4ba8-45bc-a10a-34357c74ed6c', 'd1fd179b-4efc-4f4d-ac18-26fee75e3922', 'reviews_export', 'Exportar avaliações', true, null, '2026-07-30T19:01:17.240267+00:00') on conflict do nothing;
insert into public.plan_features ("id", "plan_id", "feature_key", "feature_name", "enabled", "limit_value", "created_at") values ('fb36a2cc-c8af-4866-af8f-adc3c259febc', 'd1fd179b-4efc-4f4d-ac18-26fee75e3922', 'reviews_public_page', 'Página pública de avaliações', true, null, '2026-07-30T19:01:17.240267+00:00') on conflict do nothing;
insert into public.plan_features ("id", "plan_id", "feature_key", "feature_name", "enabled", "limit_value", "created_at") values ('6fb9181a-ed2c-4c49-9cb9-5a62bc917e6d', 'd1fd179b-4efc-4f4d-ac18-26fee75e3922', 'public_reviews', 'Avaliações públicas de atendimento (QR + página)', true, null, '2026-07-30T19:01:17.240267+00:00') on conflict do nothing;
insert into public.plan_features ("id", "plan_id", "feature_key", "feature_name", "enabled", "limit_value", "created_at") values ('d1b5a6c6-35fc-423f-834e-da0bc4ed67f0', 'd1fd179b-4efc-4f4d-ac18-26fee75e3922', 'digital_menu', 'Cardápio digital (vitrine + QR)', true, null, '2026-07-30T19:01:17.240267+00:00') on conflict do nothing;
insert into public.plan_features ("id", "plan_id", "feature_key", "feature_name", "enabled", "limit_value", "created_at") values ('db2e1567-312c-4d26-bb5e-589c731b36ea', 'd1fd179b-4efc-4f4d-ac18-26fee75e3922', 'digital_catalog', 'Catálogo digital', true, null, '2026-07-30T19:01:17.240267+00:00') on conflict do nothing;
insert into public.plan_features ("id", "plan_id", "feature_key", "feature_name", "enabled", "limit_value", "created_at") values ('8fb5493b-e588-468e-818d-3ad9f8147979', 'd1fd179b-4efc-4f4d-ac18-26fee75e3922', 'reviews_google', 'Redirecionar para Google Reviews', true, null, '2026-07-30T19:01:17.240267+00:00') on conflict do nothing;
insert into public.plan_features ("id", "plan_id", "feature_key", "feature_name", "enabled", "limit_value", "created_at") values ('df969125-6624-4b6e-9783-3acd6fdb8326', 'd1fd179b-4efc-4f4d-ac18-26fee75e3922', 'reviews_nps', 'NPS', true, null, '2026-07-30T19:01:17.240267+00:00') on conflict do nothing;
insert into public.plan_features ("id", "plan_id", "feature_key", "feature_name", "enabled", "limit_value", "created_at") values ('c7a5c030-6430-4665-bc57-41da4c15a668', 'd1fd179b-4efc-4f4d-ac18-26fee75e3922', 'menu.ai', 'Inteligência de Cardápio com IA', true, null, '2026-07-30T19:01:17.240267+00:00') on conflict do nothing;
insert into public.plan_features ("id", "plan_id", "feature_key", "feature_name", "enabled", "limit_value", "created_at") values ('362cb1fc-123c-4d10-89a2-51ccd5ff4818', 'd1fd179b-4efc-4f4d-ac18-26fee75e3922', 'catalog.ai', 'Inteligência de Catálogo com IA', true, null, '2026-07-30T19:01:17.240267+00:00') on conflict do nothing;

-- achievements (15 registros)
insert into public.achievements ("id", "code", "title", "description", "icon", "rarity", "criteria_type", "criteria_value", "sort_order", "is_active", "created_at") values ('a9576d80-59d5-4d11-87b5-a3880b9a00c2', 'first_stamp', 'Primeiro passo', 'Receba seu primeiro carimbo', 'Sparkles', 'common', 'first_stamp', 1, 10, true, '2026-07-22T03:47:33.630703+00:00') on conflict do nothing;
insert into public.achievements ("id", "code", "title", "description", "icon", "rarity", "criteria_type", "criteria_value", "sort_order", "is_active", "created_at") values ('248d11a8-d284-46e3-b54b-428b9de115ed', 'stamps_10', 'Cliente fiel', 'Acumule 10 carimbos', 'Stamp', 'common', 'stamps_total', 10, 20, true, '2026-07-22T03:47:33.630703+00:00') on conflict do nothing;
insert into public.achievements ("id", "code", "title", "description", "icon", "rarity", "criteria_type", "criteria_value", "sort_order", "is_active", "created_at") values ('f124e65f-3072-4263-9884-aeddb388b569', 'stamps_25', 'Frequentador', 'Acumule 25 carimbos', 'Stamp', 'rare', 'stamps_total', 25, 30, true, '2026-07-22T03:47:33.630703+00:00') on conflict do nothing;
insert into public.achievements ("id", "code", "title", "description", "icon", "rarity", "criteria_type", "criteria_value", "sort_order", "is_active", "created_at") values ('6bdcb09d-5a0c-4b35-95bb-4510ea5d612b', 'stamps_50', 'Fã de carteirinha', 'Acumule 50 carimbos', 'Medal', 'rare', 'stamps_total', 50, 40, true, '2026-07-22T03:47:33.630703+00:00') on conflict do nothing;
insert into public.achievements ("id", "code", "title", "description", "icon", "rarity", "criteria_type", "criteria_value", "sort_order", "is_active", "created_at") values ('2ebc5ddb-620a-474d-896e-6e94d7235c3e', 'stamps_100', 'Cliente lendário', 'Acumule 100 carimbos', 'Trophy', 'epic', 'stamps_total', 100, 50, true, '2026-07-22T03:47:33.630703+00:00') on conflict do nothing;
insert into public.achievements ("id", "code", "title", "description", "icon", "rarity", "criteria_type", "criteria_value", "sort_order", "is_active", "created_at") values ('b46ec311-ae52-47a9-a0d1-3059b8025b1f', 'stamps_500', 'Ícone da casa', 'Acumule 500 carimbos', 'Crown', 'legendary', 'stamps_total', 500, 60, true, '2026-07-22T03:47:33.630703+00:00') on conflict do nothing;
insert into public.achievements ("id", "code", "title", "description", "icon", "rarity", "criteria_type", "criteria_value", "sort_order", "is_active", "created_at") values ('93721438-d52a-48ab-82dd-45a9a65ccb07', 'first_reward', 'Primeiro prêmio', 'Resgate seu primeiro prêmio', 'Gift', 'common', 'first_reward', 1, 70, true, '2026-07-22T03:47:33.630703+00:00') on conflict do nothing;
insert into public.achievements ("id", "code", "title", "description", "icon", "rarity", "criteria_type", "criteria_value", "sort_order", "is_active", "created_at") values ('97311d46-e85f-4476-b779-72207cb8b3b4', 'rewards_5', 'Colecionador de prêmios', 'Resgate 5 prêmios', 'Gift', 'rare', 'rewards_total', 5, 80, true, '2026-07-22T03:47:33.630703+00:00') on conflict do nothing;
insert into public.achievements ("id", "code", "title", "description", "icon", "rarity", "criteria_type", "criteria_value", "sort_order", "is_active", "created_at") values ('9b05aea1-6915-4980-8f88-ebcc216dd55c', 'rewards_15', 'Caçador de recompensas', 'Resgate 15 prêmios', 'Trophy', 'epic', 'rewards_total', 15, 90, true, '2026-07-22T03:47:33.630703+00:00') on conflict do nothing;
insert into public.achievements ("id", "code", "title", "description", "icon", "rarity", "criteria_type", "criteria_value", "sort_order", "is_active", "created_at") values ('e2cb3ade-578a-4b21-8a42-fd89b74888c1', 'establishments_3', 'Explorador', 'Colecione cartões de 3 estabelecimentos', 'Compass', 'common', 'establishments_total', 3, 100, true, '2026-07-22T03:47:33.630703+00:00') on conflict do nothing;
insert into public.achievements ("id", "code", "title", "description", "icon", "rarity", "criteria_type", "criteria_value", "sort_order", "is_active", "created_at") values ('71b33523-6546-46f2-b155-f8a2f086f0a2', 'establishments_5', 'Aventureiro', 'Colecione cartões de 5 estabelecimentos', 'Map', 'rare', 'establishments_total', 5, 110, true, '2026-07-22T03:47:33.630703+00:00') on conflict do nothing;
insert into public.achievements ("id", "code", "title", "description", "icon", "rarity", "criteria_type", "criteria_value", "sort_order", "is_active", "created_at") values ('8335d1bd-c22f-48c0-b2af-fc04f9b854a2', 'establishments_10', 'Descobridor', 'Colecione cartões de 10 estabelecimentos', 'Globe', 'epic', 'establishments_total', 10, 120, true, '2026-07-22T03:47:33.630703+00:00') on conflict do nothing;
insert into public.achievements ("id", "code", "title", "description", "icon", "rarity", "criteria_type", "criteria_value", "sort_order", "is_active", "created_at") values ('01d3b6a1-9e8b-4201-af0d-e0a79a4d20dc', 'tier_prata', 'Cliente Prata', 'Alcance o tier Prata em qualquer estabelecimento', 'Award', 'common', 'tier_reached', 2, 200, true, '2026-07-22T03:47:33.630703+00:00') on conflict do nothing;
insert into public.achievements ("id", "code", "title", "description", "icon", "rarity", "criteria_type", "criteria_value", "sort_order", "is_active", "created_at") values ('7ee34d3b-0d3c-4b60-b47b-34e50b11772b', 'tier_ouro', 'Cliente Ouro', 'Alcance o tier Ouro em qualquer estabelecimento', 'Award', 'rare', 'tier_reached', 3, 210, true, '2026-07-22T03:47:33.630703+00:00') on conflict do nothing;
insert into public.achievements ("id", "code", "title", "description", "icon", "rarity", "criteria_type", "criteria_value", "sort_order", "is_active", "created_at") values ('c375edc4-20de-417a-9b8a-d1b23c5961ef', 'tier_diamante', 'Cliente Diamante', 'Alcance o tier Diamante em qualquer estabelecimento', 'Gem', 'legendary', 'tier_reached', 4, 220, true, '2026-07-22T03:47:33.630703+00:00') on conflict do nothing;

-- help_categories (14 registros)
insert into public.help_categories ("id", "slug", "name", "description", "icon", "sort_order", "active", "created_at", "updated_at") values ('a79a3b00-6e0e-4f7d-8290-0678837f57ba', 'primeiros-passos', 'Primeiros passos', 'Comece a usar o Fidelize e configure sua empresa em minutos.', 'Rocket', 1, true, '2026-07-18T21:51:18.039332+00:00', '2026-07-18T21:51:18.039332+00:00') on conflict do nothing;
insert into public.help_categories ("id", "slug", "name", "description", "icon", "sort_order", "active", "created_at", "updated_at") values ('8cb3dc10-b6e1-4fcf-823c-e35fede98306', 'clientes', 'Clientes', 'Gerencie sua base de clientes: cadastro, importação e exportação.', 'Users', 2, true, '2026-07-18T21:51:18.039332+00:00', '2026-07-18T21:51:18.039332+00:00') on conflict do nothing;
insert into public.help_categories ("id", "slug", "name", "description", "icon", "sort_order", "active", "created_at", "updated_at") values ('83a394b6-7164-4e61-9145-480516c7f59b', 'cartao-fidelidade', 'Cartão Fidelidade', 'Crie e personalize cartões digitais de fidelidade.', 'CreditCard', 3, true, '2026-07-18T21:51:18.039332+00:00', '2026-07-18T21:51:18.039332+00:00') on conflict do nothing;
insert into public.help_categories ("id", "slug", "name", "description", "icon", "sort_order", "active", "created_at", "updated_at") values ('2ccaec28-5b94-4705-9159-8b8851ee42d0', 'carimbos', 'Carimbos', 'Adicione, remova e escaneie carimbos com segurança.', 'Stamp', 4, true, '2026-07-18T21:51:18.039332+00:00', '2026-07-18T21:51:18.039332+00:00') on conflict do nothing;
insert into public.help_categories ("id", "slug", "name", "description", "icon", "sort_order", "active", "created_at", "updated_at") values ('21af10fb-a35c-4b7a-8193-0d5fdc47bbe9', 'campanhas', 'Campanhas', 'Planeje campanhas fidelidade e maximize resultados.', 'Megaphone', 5, true, '2026-07-18T21:51:18.039332+00:00', '2026-07-18T21:51:18.039332+00:00') on conflict do nothing;
insert into public.help_categories ("id", "slug", "name", "description", "icon", "sort_order", "active", "created_at", "updated_at") values ('b8593303-281b-4c24-87e2-593335a971bf', 'funcionarios', 'Funcionários', 'Equipe, papéis e permissões dentro da sua conta.', 'UsersRound', 6, true, '2026-07-18T21:51:18.039332+00:00', '2026-07-18T21:51:18.039332+00:00') on conflict do nothing;
insert into public.help_categories ("id", "slug", "name", "description", "icon", "sort_order", "active", "created_at", "updated_at") values ('151ca3d6-e36a-483b-b1d1-7f0fd8e2f044', 'relatorios', 'Relatórios', 'Interprete métricas, conversões e indicadores.', 'BarChart3', 7, true, '2026-07-18T21:51:18.039332+00:00', '2026-07-18T21:51:18.039332+00:00') on conflict do nothing;
insert into public.help_categories ("id", "slug", "name", "description", "icon", "sort_order", "active", "created_at", "updated_at") values ('5b91d24a-4b27-46ca-9bd1-d1de812ae48f', 'planos', 'Planos', 'Diferenças, upgrades e cancelamentos.', 'Package', 8, true, '2026-07-18T21:51:18.039332+00:00', '2026-07-18T21:51:18.039332+00:00') on conflict do nothing;
insert into public.help_categories ("id", "slug", "name", "description", "icon", "sort_order", "active", "created_at", "updated_at") values ('8cc31077-3dc2-406d-9b75-5445f435a8c1', 'pagamentos', 'Pagamentos', 'Assinatura, PIX, cartão e problemas de cobrança.', 'CreditCard', 9, true, '2026-07-18T21:51:18.039332+00:00', '2026-07-18T21:51:18.039332+00:00') on conflict do nothing;
insert into public.help_categories ("id", "slug", "name", "description", "icon", "sort_order", "active", "created_at", "updated_at") values ('3b0a7d85-aa21-4b0d-ae00-aef2f2ac6c03', 'qr-code', 'QR Code', 'Tudo sobre QR Codes de cartões e leitura.', 'QrCode', 10, true, '2026-07-18T21:51:18.039332+00:00', '2026-07-18T21:51:18.039332+00:00') on conflict do nothing;
insert into public.help_categories ("id", "slug", "name", "description", "icon", "sort_order", "active", "created_at", "updated_at") values ('3f3fd5b5-1293-4e81-95cd-c2fd3549e653', 'suporte', 'Suporte', 'Como usar o suporte da Fidelize.', 'LifeBuoy', 11, true, '2026-07-18T21:51:18.039332+00:00', '2026-07-18T21:51:18.039332+00:00') on conflict do nothing;
insert into public.help_categories ("id", "slug", "name", "description", "icon", "sort_order", "active", "created_at", "updated_at") values ('7044315e-af6c-4ee1-a45e-88e06a5368be', 'configuracoes', 'Configurações', 'Dados da empresa, identidade visual e notificações.', 'Settings', 12, true, '2026-07-18T21:51:18.039332+00:00', '2026-07-18T21:51:18.039332+00:00') on conflict do nothing;
insert into public.help_categories ("id", "slug", "name", "description", "icon", "sort_order", "active", "created_at", "updated_at") values ('f922c4a1-ac3d-4302-8247-5aea60c653b8', 'integracoes', 'Integrações', 'Mercado Pago, Resend, API e Webhooks.', 'Plug', 13, true, '2026-07-18T21:51:18.039332+00:00', '2026-07-18T21:51:18.039332+00:00') on conflict do nothing;
insert into public.help_categories ("id", "slug", "name", "description", "icon", "sort_order", "active", "created_at", "updated_at") values ('541aa532-35c3-4b49-9746-b943324c8441', 'seguranca', 'Segurança', 'Autenticação, LGPD, permissões e auditoria.', 'Shield', 14, true, '2026-07-18T21:51:18.039332+00:00', '2026-07-18T21:51:18.039332+00:00') on conflict do nothing;

-- kb_categories (157 registros)
insert into public.kb_categories ("id", "establishment_id", "name", "slug", "description", "icon", "sort_order", "created_at", "updated_at") values ('e28cae20-2d0e-45ba-837a-e4095b2bee97', '11111111-1111-1111-1111-111111111111', 'Cartão fidelidade', 'cartao', 'Como funciona seu cartão de carimbos', 'stamp', 1, '2026-07-18T17:01:10.905377+00:00', '2026-07-18T17:01:10.905377+00:00') on conflict do nothing;
insert into public.kb_categories ("id", "establishment_id", "name", "slug", "description", "icon", "sort_order", "created_at", "updated_at") values ('3440ed60-f8de-48a8-a21d-d8b85ffac317', '11111111-1111-1111-1111-111111111111', 'Conta e cadastro', 'conta', 'Cadastro, telefone e dados pessoais', 'user', 2, '2026-07-18T17:01:10.905377+00:00', '2026-07-18T17:01:10.905377+00:00') on conflict do nothing;
insert into public.kb_categories ("id", "establishment_id", "name", "slug", "description", "icon", "sort_order", "created_at", "updated_at") values ('d0485b4a-9d1b-4553-8fe0-a0d0d6318330', '11111111-1111-1111-1111-111111111111', 'Recompensas', 'recompensas', 'Como resgatar seus prêmios', 'gift', 3, '2026-07-18T17:01:10.905377+00:00', '2026-07-18T17:01:10.905377+00:00') on conflict do nothing;
insert into public.kb_categories ("id", "establishment_id", "name", "slug", "description", "icon", "sort_order", "created_at", "updated_at") values ('d133578f-a042-4eb8-a1eb-2b21170f4e29', 'b4b328c7-2385-4cb2-9ee0-6988cecdb205', 'Carimbos', 'carimbos', 'Adicione, remova e escaneie carimbos com segurança.', 'Stamp', 4, '2026-07-28T00:14:12.92027+00:00', '2026-07-28T00:14:12.92027+00:00') on conflict do nothing;
insert into public.kb_categories ("id", "establishment_id", "name", "slug", "description", "icon", "sort_order", "created_at", "updated_at") values ('cfb58f57-a7fe-4fb6-8311-ed3dbc834628', '7ee0e65f-852c-4bba-a0cb-ce18e2569782', 'Pagamentos', 'pagamentos', 'Assinatura, PIX, cartão e problemas de cobrança.', 'CreditCard', 9, '2026-07-28T00:14:12.92027+00:00', '2026-07-28T00:14:12.92027+00:00') on conflict do nothing;
insert into public.kb_categories ("id", "establishment_id", "name", "slug", "description", "icon", "sort_order", "created_at", "updated_at") values ('f33c3257-da5c-47a8-bcbe-00a33e3021f8', 'f406351f-487b-47db-b0d3-bd5cb918b6c3', 'Funcionários', 'funcionarios', 'Equipe, papéis e permissões dentro da sua conta.', 'UsersRound', 6, '2026-07-28T00:14:12.92027+00:00', '2026-07-28T00:14:12.92027+00:00') on conflict do nothing;
insert into public.kb_categories ("id", "establishment_id", "name", "slug", "description", "icon", "sort_order", "created_at", "updated_at") values ('c8e1a574-4d34-408a-9140-e82daca7dea2', '39ceb812-25db-4da1-90c3-80bbdf7e1b4d', 'Configurações', 'configuracoes', 'Dados da empresa, identidade visual e notificações.', 'Settings', 12, '2026-07-28T00:14:12.92027+00:00', '2026-07-28T00:14:12.92027+00:00') on conflict do nothing;
insert into public.kb_categories ("id", "establishment_id", "name", "slug", "description", "icon", "sort_order", "created_at", "updated_at") values ('4aadd53f-efdf-4294-834e-b94ffe30f71a', 'b4b328c7-2385-4cb2-9ee0-6988cecdb205', 'Clientes', 'clientes', 'Gerencie sua base de clientes: cadastro, importação e exportação.', 'Users', 2, '2026-07-28T00:14:12.92027+00:00', '2026-07-28T00:14:12.92027+00:00') on conflict do nothing;
insert into public.kb_categories ("id", "establishment_id", "name", "slug", "description", "icon", "sort_order", "created_at", "updated_at") values ('6cd26a1a-1f14-4d1a-a4e7-ce3a3a924aba', '3557f00b-d660-4682-a16f-65c3c0a5c959', 'Configurações', 'configuracoes', 'Dados da empresa, identidade visual e notificações.', 'Settings', 12, '2026-07-28T00:14:12.92027+00:00', '2026-07-28T00:14:12.92027+00:00') on conflict do nothing;
insert into public.kb_categories ("id", "establishment_id", "name", "slug", "description", "icon", "sort_order", "created_at", "updated_at") values ('f49461fa-49d2-46ec-b2dd-b41ae5348ab1', 'f406351f-487b-47db-b0d3-bd5cb918b6c3', 'Segurança', 'seguranca', 'Autenticação, LGPD, permissões e auditoria.', 'Shield', 14, '2026-07-28T00:14:12.92027+00:00', '2026-07-28T00:14:12.92027+00:00') on conflict do nothing;
insert into public.kb_categories ("id", "establishment_id", "name", "slug", "description", "icon", "sort_order", "created_at", "updated_at") values ('6ecbde9d-9f96-442f-bdba-e3046d592238', '384a0143-f8a5-4d1d-9165-f6033a078ce6', 'Primeiros passos', 'primeiros-passos', 'Comece a usar o Fidelize e configure sua empresa em minutos.', 'Rocket', 1, '2026-07-28T00:14:12.92027+00:00', '2026-07-28T00:14:12.92027+00:00') on conflict do nothing;
insert into public.kb_categories ("id", "establishment_id", "name", "slug", "description", "icon", "sort_order", "created_at", "updated_at") values ('35742201-aae8-4732-ad1b-8892df785cc0', '6f0bba49-cdc2-4dc8-b491-56250a653f12', 'Carimbos', 'carimbos', 'Adicione, remova e escaneie carimbos com segurança.', 'Stamp', 4, '2026-07-28T00:14:12.92027+00:00', '2026-07-28T00:14:12.92027+00:00') on conflict do nothing;
insert into public.kb_categories ("id", "establishment_id", "name", "slug", "description", "icon", "sort_order", "created_at", "updated_at") values ('af994910-b09a-454c-8950-fa824d98ab7e', '6f0bba49-cdc2-4dc8-b491-56250a653f12', 'Clientes', 'clientes', 'Gerencie sua base de clientes: cadastro, importação e exportação.', 'Users', 2, '2026-07-28T00:14:12.92027+00:00', '2026-07-28T00:14:12.92027+00:00') on conflict do nothing;
insert into public.kb_categories ("id", "establishment_id", "name", "slug", "description", "icon", "sort_order", "created_at", "updated_at") values ('83d90369-c97f-44f5-a843-2b1aeb35d3a9', 'c951fe78-6701-47aa-aabe-071ef963b59c', 'Pagamentos', 'pagamentos', 'Assinatura, PIX, cartão e problemas de cobrança.', 'CreditCard', 9, '2026-07-28T00:14:12.92027+00:00', '2026-07-28T00:14:12.92027+00:00') on conflict do nothing;
insert into public.kb_categories ("id", "establishment_id", "name", "slug", "description", "icon", "sort_order", "created_at", "updated_at") values ('16316b80-8cea-43af-a591-926ac1cbc6ed', '39ceb812-25db-4da1-90c3-80bbdf7e1b4d', 'Suporte', 'suporte', 'Como usar o suporte da Fidelize.', 'LifeBuoy', 11, '2026-07-28T00:14:12.92027+00:00', '2026-07-28T00:14:12.92027+00:00') on conflict do nothing;
insert into public.kb_categories ("id", "establishment_id", "name", "slug", "description", "icon", "sort_order", "created_at", "updated_at") values ('6ad078e5-5651-4718-9e94-e854fcd33b6e', 'dfbbe781-92e1-493f-88e1-d1fb74fd80ea', 'Planos', 'planos', 'Diferenças, upgrades e cancelamentos.', 'Package', 8, '2026-07-28T00:14:12.92027+00:00', '2026-07-28T00:14:12.92027+00:00') on conflict do nothing;
insert into public.kb_categories ("id", "establishment_id", "name", "slug", "description", "icon", "sort_order", "created_at", "updated_at") values ('86b527c1-ba16-497c-ae5e-b4b46acd558c', '39ceb812-25db-4da1-90c3-80bbdf7e1b4d', 'Integrações', 'integracoes', 'Mercado Pago, Resend, API e Webhooks.', 'Plug', 13, '2026-07-28T00:14:12.92027+00:00', '2026-07-28T00:14:12.92027+00:00') on conflict do nothing;
insert into public.kb_categories ("id", "establishment_id", "name", "slug", "description", "icon", "sort_order", "created_at", "updated_at") values ('cdac0c9a-812a-471c-8519-2f24c8d80ca0', '3557f00b-d660-4682-a16f-65c3c0a5c959', 'Integrações', 'integracoes', 'Mercado Pago, Resend, API e Webhooks.', 'Plug', 13, '2026-07-28T00:14:12.92027+00:00', '2026-07-28T00:14:12.92027+00:00') on conflict do nothing;
insert into public.kb_categories ("id", "establishment_id", "name", "slug", "description", "icon", "sort_order", "created_at", "updated_at") values ('af6708c7-8ba5-441a-9ef2-76e5285b3645', '11111111-1111-1111-1111-111111111111', 'Pagamentos', 'pagamentos', 'Assinatura, PIX, cartão e problemas de cobrança.', 'CreditCard', 9, '2026-07-28T00:14:12.92027+00:00', '2026-07-28T00:14:12.92027+00:00') on conflict do nothing;
insert into public.kb_categories ("id", "establishment_id", "name", "slug", "description", "icon", "sort_order", "created_at", "updated_at") values ('6253ff03-1d4c-417c-b4e2-0a7c454a583a', '3557f00b-d660-4682-a16f-65c3c0a5c959', 'Suporte', 'suporte', 'Como usar o suporte da Fidelize.', 'LifeBuoy', 11, '2026-07-28T00:14:12.92027+00:00', '2026-07-28T00:14:12.92027+00:00') on conflict do nothing;
insert into public.kb_categories ("id", "establishment_id", "name", "slug", "description", "icon", "sort_order", "created_at", "updated_at") values ('e21d3f67-ad22-4c54-89bf-fdc896f167d4', '7ee0e65f-852c-4bba-a0cb-ce18e2569782', 'Relatórios', 'relatorios', 'Interprete métricas, conversões e indicadores.', 'BarChart3', 7, '2026-07-28T00:14:12.92027+00:00', '2026-07-28T00:14:12.92027+00:00') on conflict do nothing;
insert into public.kb_categories ("id", "establishment_id", "name", "slug", "description", "icon", "sort_order", "created_at", "updated_at") values ('652c5b81-d66b-4818-a01a-fa1f3233040f', 'dfbbe781-92e1-493f-88e1-d1fb74fd80ea', 'Segurança', 'seguranca', 'Autenticação, LGPD, permissões e auditoria.', 'Shield', 14, '2026-07-28T00:14:12.92027+00:00', '2026-07-28T00:14:12.92027+00:00') on conflict do nothing;
insert into public.kb_categories ("id", "establishment_id", "name", "slug", "description", "icon", "sort_order", "created_at", "updated_at") values ('addb8062-26e3-4192-9b88-0e0b70539819', '7ee0e65f-852c-4bba-a0cb-ce18e2569782', 'Campanhas', 'campanhas', 'Planeje campanhas fidelidade e maximize resultados.', 'Megaphone', 5, '2026-07-28T00:14:12.92027+00:00', '2026-07-28T00:14:12.92027+00:00') on conflict do nothing;
insert into public.kb_categories ("id", "establishment_id", "name", "slug", "description", "icon", "sort_order", "created_at", "updated_at") values ('7f5ecacd-8019-4d94-bb88-c68782cbab5a', '384a0143-f8a5-4d1d-9165-f6033a078ce6', 'Clientes', 'clientes', 'Gerencie sua base de clientes: cadastro, importação e exportação.', 'Users', 2, '2026-07-28T00:14:12.92027+00:00', '2026-07-28T00:14:12.92027+00:00') on conflict do nothing;
insert into public.kb_categories ("id", "establishment_id", "name", "slug", "description", "icon", "sort_order", "created_at", "updated_at") values ('d6faaaef-a2db-4302-a498-9affad2b7d38', '384a0143-f8a5-4d1d-9165-f6033a078ce6', 'Carimbos', 'carimbos', 'Adicione, remova e escaneie carimbos com segurança.', 'Stamp', 4, '2026-07-28T00:14:12.92027+00:00', '2026-07-28T00:14:12.92027+00:00') on conflict do nothing;
insert into public.kb_categories ("id", "establishment_id", "name", "slug", "description", "icon", "sort_order", "created_at", "updated_at") values ('1ac87445-9c01-433d-9001-f02767c61467', '6f0bba49-cdc2-4dc8-b491-56250a653f12', 'Primeiros passos', 'primeiros-passos', 'Comece a usar o Fidelize e configure sua empresa em minutos.', 'Rocket', 1, '2026-07-28T00:14:12.92027+00:00', '2026-07-28T00:14:12.92027+00:00') on conflict do nothing;
insert into public.kb_categories ("id", "establishment_id", "name", "slug", "description", "icon", "sort_order", "created_at", "updated_at") values ('8744e025-14ab-4818-8666-813bd428d59a', 'dfbbe781-92e1-493f-88e1-d1fb74fd80ea', 'Funcionários', 'funcionarios', 'Equipe, papéis e permissões dentro da sua conta.', 'UsersRound', 6, '2026-07-28T00:14:12.92027+00:00', '2026-07-28T00:14:12.92027+00:00') on conflict do nothing;
insert into public.kb_categories ("id", "establishment_id", "name", "slug", "description", "icon", "sort_order", "created_at", "updated_at") values ('3eb13b70-03b2-4206-bff4-dc6349276e76', 'c951fe78-6701-47aa-aabe-071ef963b59c', 'Campanhas', 'campanhas', 'Planeje campanhas fidelidade e maximize resultados.', 'Megaphone', 5, '2026-07-28T00:14:12.92027+00:00', '2026-07-28T00:14:12.92027+00:00') on conflict do nothing;
insert into public.kb_categories ("id", "establishment_id", "name", "slug", "description", "icon", "sort_order", "created_at", "updated_at") values ('e92ce49d-ffb0-4461-b801-d3803612d958', 'c951fe78-6701-47aa-aabe-071ef963b59c', 'Relatórios', 'relatorios', 'Interprete métricas, conversões e indicadores.', 'BarChart3', 7, '2026-07-28T00:14:12.92027+00:00', '2026-07-28T00:14:12.92027+00:00') on conflict do nothing;
insert into public.kb_categories ("id", "establishment_id", "name", "slug", "description", "icon", "sort_order", "created_at", "updated_at") values ('5ac81308-9430-4e32-86da-afeb3cb4abe3', '11111111-1111-1111-1111-111111111111', 'QR Code', 'qr-code', 'Tudo sobre QR Codes de cartões e leitura.', 'QrCode', 10, '2026-07-28T00:14:12.92027+00:00', '2026-07-28T00:14:12.92027+00:00') on conflict do nothing;
insert into public.kb_categories ("id", "establishment_id", "name", "slug", "description", "icon", "sort_order", "created_at", "updated_at") values ('8636569d-31ac-4619-8d11-19606a7404a1', 'b4b328c7-2385-4cb2-9ee0-6988cecdb205', 'Primeiros passos', 'primeiros-passos', 'Comece a usar o Fidelize e configure sua empresa em minutos.', 'Rocket', 1, '2026-07-28T00:14:12.92027+00:00', '2026-07-28T00:14:12.92027+00:00') on conflict do nothing;
insert into public.kb_categories ("id", "establishment_id", "name", "slug", "description", "icon", "sort_order", "created_at", "updated_at") values ('6b41536c-5dc5-4099-854e-0a945aea2622', '7ee0e65f-852c-4bba-a0cb-ce18e2569782', 'QR Code', 'qr-code', 'Tudo sobre QR Codes de cartões e leitura.', 'QrCode', 10, '2026-07-28T00:14:12.92027+00:00', '2026-07-28T00:14:12.92027+00:00') on conflict do nothing;
insert into public.kb_categories ("id", "establishment_id", "name", "slug", "description", "icon", "sort_order", "created_at", "updated_at") values ('07531f86-f018-442c-a1d9-12f25a6e8454', '39ceb812-25db-4da1-90c3-80bbdf7e1b4d', 'Cartão Fidelidade', 'cartao-fidelidade', 'Crie e personalize cartões digitais de fidelidade.', 'CreditCard', 3, '2026-07-28T00:14:12.92027+00:00', '2026-07-28T00:14:12.92027+00:00') on conflict do nothing;
insert into public.kb_categories ("id", "establishment_id", "name", "slug", "description", "icon", "sort_order", "created_at", "updated_at") values ('75574c78-9da6-4839-9f8c-a51fd20d3e68', '11111111-1111-1111-1111-111111111111', 'Campanhas', 'campanhas', 'Planeje campanhas fidelidade e maximize resultados.', 'Megaphone', 5, '2026-07-28T00:14:12.92027+00:00', '2026-07-28T00:14:12.92027+00:00') on conflict do nothing;
insert into public.kb_categories ("id", "establishment_id", "name", "slug", "description", "icon", "sort_order", "created_at", "updated_at") values ('09ab176e-f8f3-4af0-89c9-f66626dc833c', 'c951fe78-6701-47aa-aabe-071ef963b59c', 'QR Code', 'qr-code', 'Tudo sobre QR Codes de cartões e leitura.', 'QrCode', 10, '2026-07-28T00:14:12.92027+00:00', '2026-07-28T00:14:12.92027+00:00') on conflict do nothing;
insert into public.kb_categories ("id", "establishment_id", "name", "slug", "description", "icon", "sort_order", "created_at", "updated_at") values ('94a8af90-4b73-4d29-be5f-cad586e4c8ea', 'f406351f-487b-47db-b0d3-bd5cb918b6c3', 'Planos', 'planos', 'Diferenças, upgrades e cancelamentos.', 'Package', 8, '2026-07-28T00:14:12.92027+00:00', '2026-07-28T00:14:12.92027+00:00') on conflict do nothing;
insert into public.kb_categories ("id", "establishment_id", "name", "slug", "description", "icon", "sort_order", "created_at", "updated_at") values ('bf3824bf-2662-4cee-9959-cd38ecd9df50', '11111111-1111-1111-1111-111111111111', 'Relatórios', 'relatorios', 'Interprete métricas, conversões e indicadores.', 'BarChart3', 7, '2026-07-28T00:14:12.92027+00:00', '2026-07-28T00:14:12.92027+00:00') on conflict do nothing;
insert into public.kb_categories ("id", "establishment_id", "name", "slug", "description", "icon", "sort_order", "created_at", "updated_at") values ('26d97923-7247-4b2f-bdc9-d1be976293b0', '3557f00b-d660-4682-a16f-65c3c0a5c959', 'Cartão Fidelidade', 'cartao-fidelidade', 'Crie e personalize cartões digitais de fidelidade.', 'CreditCard', 3, '2026-07-28T00:14:12.92027+00:00', '2026-07-28T00:14:12.92027+00:00') on conflict do nothing;
insert into public.kb_categories ("id", "establishment_id", "name", "slug", "description", "icon", "sort_order", "created_at", "updated_at") values ('f2c6ee31-aed8-4e64-aace-09f3f0db5cf9', '3557f00b-d660-4682-a16f-65c3c0a5c959', 'Campanhas', 'campanhas', 'Planeje campanhas fidelidade e maximize resultados.', 'Megaphone', 5, '2026-07-28T00:14:12.92027+00:00', '2026-07-28T00:14:12.92027+00:00') on conflict do nothing;
insert into public.kb_categories ("id", "establishment_id", "name", "slug", "description", "icon", "sort_order", "created_at", "updated_at") values ('4823104f-a509-446f-9758-d62e97872c41', '11111111-1111-1111-1111-111111111111', 'Cartão Fidelidade', 'cartao-fidelidade', 'Crie e personalize cartões digitais de fidelidade.', 'CreditCard', 3, '2026-07-28T00:14:12.92027+00:00', '2026-07-28T00:14:12.92027+00:00') on conflict do nothing;
insert into public.kb_categories ("id", "establishment_id", "name", "slug", "description", "icon", "sort_order", "created_at", "updated_at") values ('e280e870-97cb-4ba0-b5cb-7a726ae5b326', '6f0bba49-cdc2-4dc8-b491-56250a653f12', 'Planos', 'planos', 'Diferenças, upgrades e cancelamentos.', 'Package', 8, '2026-07-28T00:14:12.92027+00:00', '2026-07-28T00:14:12.92027+00:00') on conflict do nothing;
insert into public.kb_categories ("id", "establishment_id", "name", "slug", "description", "icon", "sort_order", "created_at", "updated_at") values ('47fbedf2-0dfe-42b3-a75a-7e924ba86543', '3557f00b-d660-4682-a16f-65c3c0a5c959', 'Relatórios', 'relatorios', 'Interprete métricas, conversões e indicadores.', 'BarChart3', 7, '2026-07-28T00:14:12.92027+00:00', '2026-07-28T00:14:12.92027+00:00') on conflict do nothing;
insert into public.kb_categories ("id", "establishment_id", "name", "slug", "description", "icon", "sort_order", "created_at", "updated_at") values ('0a69f467-3207-44b1-bb31-7a8b799e9df3', 'b4b328c7-2385-4cb2-9ee0-6988cecdb205', 'Planos', 'planos', 'Diferenças, upgrades e cancelamentos.', 'Package', 8, '2026-07-28T00:14:12.92027+00:00', '2026-07-28T00:14:12.92027+00:00') on conflict do nothing;
insert into public.kb_categories ("id", "establishment_id", "name", "slug", "description", "icon", "sort_order", "created_at", "updated_at") values ('057a1fdd-6c2a-4039-94ec-1a68613dd43c', '39ceb812-25db-4da1-90c3-80bbdf7e1b4d', 'Campanhas', 'campanhas', 'Planeje campanhas fidelidade e maximize resultados.', 'Megaphone', 5, '2026-07-28T00:14:12.92027+00:00', '2026-07-28T00:14:12.92027+00:00') on conflict do nothing;
insert into public.kb_categories ("id", "establishment_id", "name", "slug", "description", "icon", "sort_order", "created_at", "updated_at") values ('e76fbc82-1765-4fa4-aa8c-c01739a187db', '39ceb812-25db-4da1-90c3-80bbdf7e1b4d', 'Relatórios', 'relatorios', 'Interprete métricas, conversões e indicadores.', 'BarChart3', 7, '2026-07-28T00:14:12.92027+00:00', '2026-07-28T00:14:12.92027+00:00') on conflict do nothing;
insert into public.kb_categories ("id", "establishment_id", "name", "slug", "description", "icon", "sort_order", "created_at", "updated_at") values ('c7ac0e46-dceb-4d00-b236-ac21475f93e2', '384a0143-f8a5-4d1d-9165-f6033a078ce6', 'Funcionários', 'funcionarios', 'Equipe, papéis e permissões dentro da sua conta.', 'UsersRound', 6, '2026-07-28T00:14:12.92027+00:00', '2026-07-28T00:14:12.92027+00:00') on conflict do nothing;
insert into public.kb_categories ("id", "establishment_id", "name", "slug", "description", "icon", "sort_order", "created_at", "updated_at") values ('9ad69f4a-c391-4ff0-ac55-e414f45fda75', 'c951fe78-6701-47aa-aabe-071ef963b59c', 'Cartão Fidelidade', 'cartao-fidelidade', 'Crie e personalize cartões digitais de fidelidade.', 'CreditCard', 3, '2026-07-28T00:14:12.92027+00:00', '2026-07-28T00:14:12.92027+00:00') on conflict do nothing;
insert into public.kb_categories ("id", "establishment_id", "name", "slug", "description", "icon", "sort_order", "created_at", "updated_at") values ('34e24f2e-5a72-4bf2-8ab8-afd1ddb012bb', '3557f00b-d660-4682-a16f-65c3c0a5c959', 'QR Code', 'qr-code', 'Tudo sobre QR Codes de cartões e leitura.', 'QrCode', 10, '2026-07-28T00:14:12.92027+00:00', '2026-07-28T00:14:12.92027+00:00') on conflict do nothing;
insert into public.kb_categories ("id", "establishment_id", "name", "slug", "description", "icon", "sort_order", "created_at", "updated_at") values ('92e2eadf-9670-4b3a-bf31-184c793f19e5', '7ee0e65f-852c-4bba-a0cb-ce18e2569782', 'Cartão Fidelidade', 'cartao-fidelidade', 'Crie e personalize cartões digitais de fidelidade.', 'CreditCard', 3, '2026-07-28T00:14:12.92027+00:00', '2026-07-28T00:14:12.92027+00:00') on conflict do nothing;
insert into public.kb_categories ("id", "establishment_id", "name", "slug", "description", "icon", "sort_order", "created_at", "updated_at") values ('87ecee57-f96e-4640-9378-3197bde3a36b', '39ceb812-25db-4da1-90c3-80bbdf7e1b4d', 'QR Code', 'qr-code', 'Tudo sobre QR Codes de cartões e leitura.', 'QrCode', 10, '2026-07-28T00:14:12.92027+00:00', '2026-07-28T00:14:12.92027+00:00') on conflict do nothing;
insert into public.kb_categories ("id", "establishment_id", "name", "slug", "description", "icon", "sort_order", "created_at", "updated_at") values ('6e2c86ed-b583-4c4d-bdca-458ea5311a60', 'dfbbe781-92e1-493f-88e1-d1fb74fd80ea', 'Carimbos', 'carimbos', 'Adicione, remova e escaneie carimbos com segurança.', 'Stamp', 4, '2026-07-28T00:14:12.92027+00:00', '2026-07-28T00:14:12.92027+00:00') on conflict do nothing;
insert into public.kb_categories ("id", "establishment_id", "name", "slug", "description", "icon", "sort_order", "created_at", "updated_at") values ('61d58333-4588-4d3e-95e8-a8e9e97a3cf0', 'f406351f-487b-47db-b0d3-bd5cb918b6c3', 'Primeiros passos', 'primeiros-passos', 'Comece a usar o Fidelize e configure sua empresa em minutos.', 'Rocket', 1, '2026-07-28T00:14:12.92027+00:00', '2026-07-28T00:14:12.92027+00:00') on conflict do nothing;
insert into public.kb_categories ("id", "establishment_id", "name", "slug", "description", "icon", "sort_order", "created_at", "updated_at") values ('826a4de8-77c5-434c-9c95-7f7d8839785e', 'dfbbe781-92e1-493f-88e1-d1fb74fd80ea', 'Clientes', 'clientes', 'Gerencie sua base de clientes: cadastro, importação e exportação.', 'Users', 2, '2026-07-28T00:14:12.92027+00:00', '2026-07-28T00:14:12.92027+00:00') on conflict do nothing;
insert into public.kb_categories ("id", "establishment_id", "name", "slug", "description", "icon", "sort_order", "created_at", "updated_at") values ('d24e6add-04f1-4d3e-8b9d-13bd829d2e3f', '384a0143-f8a5-4d1d-9165-f6033a078ce6', 'Segurança', 'seguranca', 'Autenticação, LGPD, permissões e auditoria.', 'Shield', 14, '2026-07-28T00:14:12.92027+00:00', '2026-07-28T00:14:12.92027+00:00') on conflict do nothing;
insert into public.kb_categories ("id", "establishment_id", "name", "slug", "description", "icon", "sort_order", "created_at", "updated_at") values ('ee1b696c-dd32-423d-8fdd-308926094a80', '11111111-1111-1111-1111-111111111111', 'Integrações', 'integracoes', 'Mercado Pago, Resend, API e Webhooks.', 'Plug', 13, '2026-07-28T00:14:12.92027+00:00', '2026-07-28T00:14:12.92027+00:00') on conflict do nothing;
insert into public.kb_categories ("id", "establishment_id", "name", "slug", "description", "icon", "sort_order", "created_at", "updated_at") values ('72943dce-5822-4635-8334-8b7eb073ce6f', '3557f00b-d660-4682-a16f-65c3c0a5c959', 'Pagamentos', 'pagamentos', 'Assinatura, PIX, cartão e problemas de cobrança.', 'CreditCard', 9, '2026-07-28T00:14:12.92027+00:00', '2026-07-28T00:14:12.92027+00:00') on conflict do nothing;
insert into public.kb_categories ("id", "establishment_id", "name", "slug", "description", "icon", "sort_order", "created_at", "updated_at") values ('21de0f43-0096-4115-ba7e-2e977b0b5618', 'c951fe78-6701-47aa-aabe-071ef963b59c', 'Configurações', 'configuracoes', 'Dados da empresa, identidade visual e notificações.', 'Settings', 12, '2026-07-28T00:14:12.92027+00:00', '2026-07-28T00:14:12.92027+00:00') on conflict do nothing;
insert into public.kb_categories ("id", "establishment_id", "name", "slug", "description", "icon", "sort_order", "created_at", "updated_at") values ('58e46ffc-df4a-4fcf-a62c-92a78559dd99', '11111111-1111-1111-1111-111111111111', 'Suporte', 'suporte', 'Como usar o suporte da Fidelize.', 'LifeBuoy', 11, '2026-07-28T00:14:12.92027+00:00', '2026-07-28T00:14:12.92027+00:00') on conflict do nothing;
insert into public.kb_categories ("id", "establishment_id", "name", "slug", "description", "icon", "sort_order", "created_at", "updated_at") values ('ea48a0db-44fd-43af-9772-97d66e7d925c', '7ee0e65f-852c-4bba-a0cb-ce18e2569782', 'Configurações', 'configuracoes', 'Dados da empresa, identidade visual e notificações.', 'Settings', 12, '2026-07-28T00:14:12.92027+00:00', '2026-07-28T00:14:12.92027+00:00') on conflict do nothing;
insert into public.kb_categories ("id", "establishment_id", "name", "slug", "description", "icon", "sort_order", "created_at", "updated_at") values ('2fd243af-331f-41a8-9675-d7bd2b41f610', '384a0143-f8a5-4d1d-9165-f6033a078ce6', 'Planos', 'planos', 'Diferenças, upgrades e cancelamentos.', 'Package', 8, '2026-07-28T00:14:12.92027+00:00', '2026-07-28T00:14:12.92027+00:00') on conflict do nothing;
insert into public.kb_categories ("id", "establishment_id", "name", "slug", "description", "icon", "sort_order", "created_at", "updated_at") values ('3cb0f11c-0a87-4ee8-838a-9d08d8749afd', '39ceb812-25db-4da1-90c3-80bbdf7e1b4d', 'Pagamentos', 'pagamentos', 'Assinatura, PIX, cartão e problemas de cobrança.', 'CreditCard', 9, '2026-07-28T00:14:12.92027+00:00', '2026-07-28T00:14:12.92027+00:00') on conflict do nothing;
insert into public.kb_categories ("id", "establishment_id", "name", "slug", "description", "icon", "sort_order", "created_at", "updated_at") values ('e1a6fc92-9a2a-4cb8-a50d-ecda9e05e527', 'b4b328c7-2385-4cb2-9ee0-6988cecdb205', 'Funcionários', 'funcionarios', 'Equipe, papéis e permissões dentro da sua conta.', 'UsersRound', 6, '2026-07-28T00:14:12.92027+00:00', '2026-07-28T00:14:12.92027+00:00') on conflict do nothing;
insert into public.kb_categories ("id", "establishment_id", "name", "slug", "description", "icon", "sort_order", "created_at", "updated_at") values ('0c693251-1f27-446a-8e15-1c687c8de65b', '6f0bba49-cdc2-4dc8-b491-56250a653f12', 'Segurança', 'seguranca', 'Autenticação, LGPD, permissões e auditoria.', 'Shield', 14, '2026-07-28T00:14:12.92027+00:00', '2026-07-28T00:14:12.92027+00:00') on conflict do nothing;
insert into public.kb_categories ("id", "establishment_id", "name", "slug", "description", "icon", "sort_order", "created_at", "updated_at") values ('1b5f242c-57c5-4127-90e5-70d5f8c9b1bc', 'c951fe78-6701-47aa-aabe-071ef963b59c', 'Suporte', 'suporte', 'Como usar o suporte da Fidelize.', 'LifeBuoy', 11, '2026-07-28T00:14:12.92027+00:00', '2026-07-28T00:14:12.92027+00:00') on conflict do nothing;
insert into public.kb_categories ("id", "establishment_id", "name", "slug", "description", "icon", "sort_order", "created_at", "updated_at") values ('d19fa2e0-d314-4da9-a30a-48da3be41309', '11111111-1111-1111-1111-111111111111', 'Configurações', 'configuracoes', 'Dados da empresa, identidade visual e notificações.', 'Settings', 12, '2026-07-28T00:14:12.92027+00:00', '2026-07-28T00:14:12.92027+00:00') on conflict do nothing;
insert into public.kb_categories ("id", "establishment_id", "name", "slug", "description", "icon", "sort_order", "created_at", "updated_at") values ('0319bc14-e737-41ad-a1bc-68ab10557431', 'f406351f-487b-47db-b0d3-bd5cb918b6c3', 'Carimbos', 'carimbos', 'Adicione, remova e escaneie carimbos com segurança.', 'Stamp', 4, '2026-07-28T00:14:12.92027+00:00', '2026-07-28T00:14:12.92027+00:00') on conflict do nothing;
insert into public.kb_categories ("id", "establishment_id", "name", "slug", "description", "icon", "sort_order", "created_at", "updated_at") values ('068ecc1e-faa4-43ff-b7cc-76797d2a6bc8', 'f406351f-487b-47db-b0d3-bd5cb918b6c3', 'Clientes', 'clientes', 'Gerencie sua base de clientes: cadastro, importação e exportação.', 'Users', 2, '2026-07-28T00:14:12.92027+00:00', '2026-07-28T00:14:12.92027+00:00') on conflict do nothing;
insert into public.kb_categories ("id", "establishment_id", "name", "slug", "description", "icon", "sort_order", "created_at", "updated_at") values ('bb33f055-65f5-48f7-9be3-7d658fcb9583', 'c951fe78-6701-47aa-aabe-071ef963b59c', 'Integrações', 'integracoes', 'Mercado Pago, Resend, API e Webhooks.', 'Plug', 13, '2026-07-28T00:14:12.92027+00:00', '2026-07-28T00:14:12.92027+00:00') on conflict do nothing;
insert into public.kb_categories ("id", "establishment_id", "name", "slug", "description", "icon", "sort_order", "created_at", "updated_at") values ('7387eab9-10bb-4d5a-bc5a-73026dde0665', 'dfbbe781-92e1-493f-88e1-d1fb74fd80ea', 'Primeiros passos', 'primeiros-passos', 'Comece a usar o Fidelize e configure sua empresa em minutos.', 'Rocket', 1, '2026-07-28T00:14:12.92027+00:00', '2026-07-28T00:14:12.92027+00:00') on conflict do nothing;
insert into public.kb_categories ("id", "establishment_id", "name", "slug", "description", "icon", "sort_order", "created_at", "updated_at") values ('e7da310a-c0b1-427a-bbf9-2dfbaea9a0b1', '6f0bba49-cdc2-4dc8-b491-56250a653f12', 'Funcionários', 'funcionarios', 'Equipe, papéis e permissões dentro da sua conta.', 'UsersRound', 6, '2026-07-28T00:14:12.92027+00:00', '2026-07-28T00:14:12.92027+00:00') on conflict do nothing;
insert into public.kb_categories ("id", "establishment_id", "name", "slug", "description", "icon", "sort_order", "created_at", "updated_at") values ('2053986b-e2da-4abd-97a8-1f07f1c3cf21', 'b4b328c7-2385-4cb2-9ee0-6988cecdb205', 'Segurança', 'seguranca', 'Autenticação, LGPD, permissões e auditoria.', 'Shield', 14, '2026-07-28T00:14:12.92027+00:00', '2026-07-28T00:14:12.92027+00:00') on conflict do nothing;
insert into public.kb_categories ("id", "establishment_id", "name", "slug", "description", "icon", "sort_order", "created_at", "updated_at") values ('0c12ff6c-4e26-4ef1-ac2e-06d0340bf9fe', '7ee0e65f-852c-4bba-a0cb-ce18e2569782', 'Integrações', 'integracoes', 'Mercado Pago, Resend, API e Webhooks.', 'Plug', 13, '2026-07-28T00:14:12.92027+00:00', '2026-07-28T00:14:12.92027+00:00') on conflict do nothing;
insert into public.kb_categories ("id", "establishment_id", "name", "slug", "description", "icon", "sort_order", "created_at", "updated_at") values ('d5379cd3-2805-4f4a-a1c4-4f774484bd41', '7ee0e65f-852c-4bba-a0cb-ce18e2569782', 'Suporte', 'suporte', 'Como usar o suporte da Fidelize.', 'LifeBuoy', 11, '2026-07-28T00:14:12.92027+00:00', '2026-07-28T00:14:12.92027+00:00') on conflict do nothing;
insert into public.kb_categories ("id", "establishment_id", "name", "slug", "description", "icon", "sort_order", "created_at", "updated_at") values ('2cf9000a-cf76-452e-b029-349ae9c5ba9e', 'c951fe78-6701-47aa-aabe-071ef963b59c', 'Segurança', 'seguranca', 'Autenticação, LGPD, permissões e auditoria.', 'Shield', 14, '2026-07-28T00:14:12.92027+00:00', '2026-07-28T00:14:12.92027+00:00') on conflict do nothing;
insert into public.kb_categories ("id", "establishment_id", "name", "slug", "description", "icon", "sort_order", "created_at", "updated_at") values ('903d530a-ba7c-41c8-9f3f-10352ec32f3f', '6f0bba49-cdc2-4dc8-b491-56250a653f12', 'Suporte', 'suporte', 'Como usar o suporte da Fidelize.', 'LifeBuoy', 11, '2026-07-28T00:14:12.92027+00:00', '2026-07-28T00:14:12.92027+00:00') on conflict do nothing;
insert into public.kb_categories ("id", "establishment_id", "name", "slug", "description", "icon", "sort_order", "created_at", "updated_at") values ('6bd74f63-9fa0-408b-9e15-4148df8b39dc', 'f406351f-487b-47db-b0d3-bd5cb918b6c3', 'Pagamentos', 'pagamentos', 'Assinatura, PIX, cartão e problemas de cobrança.', 'CreditCard', 9, '2026-07-28T00:14:12.92027+00:00', '2026-07-28T00:14:12.92027+00:00') on conflict do nothing;
insert into public.kb_categories ("id", "establishment_id", "name", "slug", "description", "icon", "sort_order", "created_at", "updated_at") values ('24161bfe-23f0-4371-be2d-3995ad5f0c76', '6f0bba49-cdc2-4dc8-b491-56250a653f12', 'Integrações', 'integracoes', 'Mercado Pago, Resend, API e Webhooks.', 'Plug', 13, '2026-07-28T00:14:12.92027+00:00', '2026-07-28T00:14:12.92027+00:00') on conflict do nothing;
insert into public.kb_categories ("id", "establishment_id", "name", "slug", "description", "icon", "sort_order", "created_at", "updated_at") values ('f3e711a5-e207-4706-a98b-9c6ca275695b', '7ee0e65f-852c-4bba-a0cb-ce18e2569782', 'Funcionários', 'funcionarios', 'Equipe, papéis e permissões dentro da sua conta.', 'UsersRound', 6, '2026-07-28T00:14:12.92027+00:00', '2026-07-28T00:14:12.92027+00:00') on conflict do nothing;
insert into public.kb_categories ("id", "establishment_id", "name", "slug", "description", "icon", "sort_order", "created_at", "updated_at") values ('0833fb55-3ff6-47e5-8496-b0f5c0c88192', 'b4b328c7-2385-4cb2-9ee0-6988cecdb205', 'Suporte', 'suporte', 'Como usar o suporte da Fidelize.', 'LifeBuoy', 11, '2026-07-28T00:14:12.92027+00:00', '2026-07-28T00:14:12.92027+00:00') on conflict do nothing;
insert into public.kb_categories ("id", "establishment_id", "name", "slug", "description", "icon", "sort_order", "created_at", "updated_at") values ('6c62cb09-0cba-4fb6-8d73-e25c9fb3e2ac', 'c951fe78-6701-47aa-aabe-071ef963b59c', 'Funcionários', 'funcionarios', 'Equipe, papéis e permissões dentro da sua conta.', 'UsersRound', 6, '2026-07-28T00:14:12.92027+00:00', '2026-07-28T00:14:12.92027+00:00') on conflict do nothing;
insert into public.kb_categories ("id", "establishment_id", "name", "slug", "description", "icon", "sort_order", "created_at", "updated_at") values ('c425c699-04d1-439d-a722-9b0cd66c907c', '384a0143-f8a5-4d1d-9165-f6033a078ce6', 'Cartão Fidelidade', 'cartao-fidelidade', 'Crie e personalize cartões digitais de fidelidade.', 'CreditCard', 3, '2026-07-28T00:14:12.92027+00:00', '2026-07-28T00:14:12.92027+00:00') on conflict do nothing;
insert into public.kb_categories ("id", "establishment_id", "name", "slug", "description", "icon", "sort_order", "created_at", "updated_at") values ('22a7a66a-46a0-4314-81df-3ef36822faab', '7ee0e65f-852c-4bba-a0cb-ce18e2569782', 'Segurança', 'seguranca', 'Autenticação, LGPD, permissões e auditoria.', 'Shield', 14, '2026-07-28T00:14:12.92027+00:00', '2026-07-28T00:14:12.92027+00:00') on conflict do nothing;
insert into public.kb_categories ("id", "establishment_id", "name", "slug", "description", "icon", "sort_order", "created_at", "updated_at") values ('7e85aa71-17c4-49b7-b1bf-19b5253e019c', 'b4b328c7-2385-4cb2-9ee0-6988cecdb205', 'Integrações', 'integracoes', 'Mercado Pago, Resend, API e Webhooks.', 'Plug', 13, '2026-07-28T00:14:12.92027+00:00', '2026-07-28T00:14:12.92027+00:00') on conflict do nothing;
insert into public.kb_categories ("id", "establishment_id", "name", "slug", "description", "icon", "sort_order", "created_at", "updated_at") values ('19bdaa84-3aad-4569-afdc-185e160363c6', 'dfbbe781-92e1-493f-88e1-d1fb74fd80ea', 'Relatórios', 'relatorios', 'Interprete métricas, conversões e indicadores.', 'BarChart3', 7, '2026-07-28T00:14:12.92027+00:00', '2026-07-28T00:14:12.92027+00:00') on conflict do nothing;
insert into public.kb_categories ("id", "establishment_id", "name", "slug", "description", "icon", "sort_order", "created_at", "updated_at") values ('ddeace54-bdf4-4a5c-861d-b2dfee6ae0dd', 'dfbbe781-92e1-493f-88e1-d1fb74fd80ea', 'Campanhas', 'campanhas', 'Planeje campanhas fidelidade e maximize resultados.', 'Megaphone', 5, '2026-07-28T00:14:12.92027+00:00', '2026-07-28T00:14:12.92027+00:00') on conflict do nothing;
insert into public.kb_categories ("id", "establishment_id", "name", "slug", "description", "icon", "sort_order", "created_at", "updated_at") values ('0207cebc-ea9e-45a7-9fb0-72a088d594c4', '3557f00b-d660-4682-a16f-65c3c0a5c959', 'Clientes', 'clientes', 'Gerencie sua base de clientes: cadastro, importação e exportação.', 'Users', 2, '2026-07-28T00:14:12.92027+00:00', '2026-07-28T00:14:12.92027+00:00') on conflict do nothing;
insert into public.kb_categories ("id", "establishment_id", "name", "slug", "description", "icon", "sort_order", "created_at", "updated_at") values ('3efb71af-004c-4420-86f1-0a3c1e4c69e8', '3557f00b-d660-4682-a16f-65c3c0a5c959', 'Carimbos', 'carimbos', 'Adicione, remova e escaneie carimbos com segurança.', 'Stamp', 4, '2026-07-28T00:14:12.92027+00:00', '2026-07-28T00:14:12.92027+00:00') on conflict do nothing;
insert into public.kb_categories ("id", "establishment_id", "name", "slug", "description", "icon", "sort_order", "created_at", "updated_at") values ('52d14699-7b8a-4924-aae8-76ca669f365a', '6f0bba49-cdc2-4dc8-b491-56250a653f12', 'Configurações', 'configuracoes', 'Dados da empresa, identidade visual e notificações.', 'Settings', 12, '2026-07-28T00:14:12.92027+00:00', '2026-07-28T00:14:12.92027+00:00') on conflict do nothing;
insert into public.kb_categories ("id", "establishment_id", "name", "slug", "description", "icon", "sort_order", "created_at", "updated_at") values ('3cc39aa3-5ed8-41a8-8ab3-fde531c1e42b', '11111111-1111-1111-1111-111111111111', 'Segurança', 'seguranca', 'Autenticação, LGPD, permissões e auditoria.', 'Shield', 14, '2026-07-28T00:14:12.92027+00:00', '2026-07-28T00:14:12.92027+00:00') on conflict do nothing;
insert into public.kb_categories ("id", "establishment_id", "name", "slug", "description", "icon", "sort_order", "created_at", "updated_at") values ('98739658-84c7-48ab-8cd5-baf241fb1086', '39ceb812-25db-4da1-90c3-80bbdf7e1b4d', 'Carimbos', 'carimbos', 'Adicione, remova e escaneie carimbos com segurança.', 'Stamp', 4, '2026-07-28T00:14:12.92027+00:00', '2026-07-28T00:14:12.92027+00:00') on conflict do nothing;
insert into public.kb_categories ("id", "establishment_id", "name", "slug", "description", "icon", "sort_order", "created_at", "updated_at") values ('8e7168de-4c74-454e-8c80-384e94164b6d', 'dfbbe781-92e1-493f-88e1-d1fb74fd80ea', 'QR Code', 'qr-code', 'Tudo sobre QR Codes de cartões e leitura.', 'QrCode', 10, '2026-07-28T00:14:12.92027+00:00', '2026-07-28T00:14:12.92027+00:00') on conflict do nothing;
insert into public.kb_categories ("id", "establishment_id", "name", "slug", "description", "icon", "sort_order", "created_at", "updated_at") values ('7e5e49d1-e09f-49ce-9f1d-70bf92b8e2ee', 'b4b328c7-2385-4cb2-9ee0-6988cecdb205', 'Configurações', 'configuracoes', 'Dados da empresa, identidade visual e notificações.', 'Settings', 12, '2026-07-28T00:14:12.92027+00:00', '2026-07-28T00:14:12.92027+00:00') on conflict do nothing;
insert into public.kb_categories ("id", "establishment_id", "name", "slug", "description", "icon", "sort_order", "created_at", "updated_at") values ('6f74e5cc-10e7-4960-b663-b92789534322', '11111111-1111-1111-1111-111111111111', 'Funcionários', 'funcionarios', 'Equipe, papéis e permissões dentro da sua conta.', 'UsersRound', 6, '2026-07-28T00:14:12.92027+00:00', '2026-07-28T00:14:12.92027+00:00') on conflict do nothing;
insert into public.kb_categories ("id", "establishment_id", "name", "slug", "description", "icon", "sort_order", "created_at", "updated_at") values ('be669f1c-4588-432d-9e8b-1b8c7388abd8', '39ceb812-25db-4da1-90c3-80bbdf7e1b4d', 'Clientes', 'clientes', 'Gerencie sua base de clientes: cadastro, importação e exportação.', 'Users', 2, '2026-07-28T00:14:12.92027+00:00', '2026-07-28T00:14:12.92027+00:00') on conflict do nothing;
insert into public.kb_categories ("id", "establishment_id", "name", "slug", "description", "icon", "sort_order", "created_at", "updated_at") values ('1bff86bd-1f6e-4e25-9ab4-ad81001be8eb', '11111111-1111-1111-1111-111111111111', 'Planos', 'planos', 'Diferenças, upgrades e cancelamentos.', 'Package', 8, '2026-07-28T00:14:12.92027+00:00', '2026-07-28T00:14:12.92027+00:00') on conflict do nothing;
insert into public.kb_categories ("id", "establishment_id", "name", "slug", "description", "icon", "sort_order", "created_at", "updated_at") values ('f5593133-ffeb-46da-8ab9-856be06b12b6', 'f406351f-487b-47db-b0d3-bd5cb918b6c3', 'Relatórios', 'relatorios', 'Interprete métricas, conversões e indicadores.', 'BarChart3', 7, '2026-07-28T00:14:12.92027+00:00', '2026-07-28T00:14:12.92027+00:00') on conflict do nothing;
insert into public.kb_categories ("id", "establishment_id", "name", "slug", "description", "icon", "sort_order", "created_at", "updated_at") values ('3d7e9e2c-74d3-4271-b0ad-b8ccff6d0204', '6f0bba49-cdc2-4dc8-b491-56250a653f12', 'Cartão Fidelidade', 'cartao-fidelidade', 'Crie e personalize cartões digitais de fidelidade.', 'CreditCard', 3, '2026-07-28T00:14:12.92027+00:00', '2026-07-28T00:14:12.92027+00:00') on conflict do nothing;
insert into public.kb_categories ("id", "establishment_id", "name", "slug", "description", "icon", "sort_order", "created_at", "updated_at") values ('35b227f7-0440-4ae1-a1fc-6bbd46d305a9', 'f406351f-487b-47db-b0d3-bd5cb918b6c3', 'Campanhas', 'campanhas', 'Planeje campanhas fidelidade e maximize resultados.', 'Megaphone', 5, '2026-07-28T00:14:12.92027+00:00', '2026-07-28T00:14:12.92027+00:00') on conflict do nothing;
insert into public.kb_categories ("id", "establishment_id", "name", "slug", "description", "icon", "sort_order", "created_at", "updated_at") values ('64ba588d-545d-4043-b69c-54c3b88e90c1', '384a0143-f8a5-4d1d-9165-f6033a078ce6', 'Integrações', 'integracoes', 'Mercado Pago, Resend, API e Webhooks.', 'Plug', 13, '2026-07-28T00:14:12.92027+00:00', '2026-07-28T00:14:12.92027+00:00') on conflict do nothing;
insert into public.kb_categories ("id", "establishment_id", "name", "slug", "description", "icon", "sort_order", "created_at", "updated_at") values ('8ca880f4-fc0e-4c89-b050-d386633b5994', '384a0143-f8a5-4d1d-9165-f6033a078ce6', 'Suporte', 'suporte', 'Como usar o suporte da Fidelize.', 'LifeBuoy', 11, '2026-07-28T00:14:12.92027+00:00', '2026-07-28T00:14:12.92027+00:00') on conflict do nothing;
insert into public.kb_categories ("id", "establishment_id", "name", "slug", "description", "icon", "sort_order", "created_at", "updated_at") values ('c5dc0174-66dc-436c-b81a-7048916fca5d', 'dfbbe781-92e1-493f-88e1-d1fb74fd80ea', 'Pagamentos', 'pagamentos', 'Assinatura, PIX, cartão e problemas de cobrança.', 'CreditCard', 9, '2026-07-28T00:14:12.92027+00:00', '2026-07-28T00:14:12.92027+00:00') on conflict do nothing;
insert into public.kb_categories ("id", "establishment_id", "name", "slug", "description", "icon", "sort_order", "created_at", "updated_at") values ('2d64fe04-83b3-4813-9beb-1b078563ed85', 'b4b328c7-2385-4cb2-9ee0-6988cecdb205', 'Cartão Fidelidade', 'cartao-fidelidade', 'Crie e personalize cartões digitais de fidelidade.', 'CreditCard', 3, '2026-07-28T00:14:12.92027+00:00', '2026-07-28T00:14:12.92027+00:00') on conflict do nothing;
insert into public.kb_categories ("id", "establishment_id", "name", "slug", "description", "icon", "sort_order", "created_at", "updated_at") values ('7c54bea3-7150-47f2-8a03-1bb1317ec579', 'c951fe78-6701-47aa-aabe-071ef963b59c', 'Planos', 'planos', 'Diferenças, upgrades e cancelamentos.', 'Package', 8, '2026-07-28T00:14:12.92027+00:00', '2026-07-28T00:14:12.92027+00:00') on conflict do nothing;
insert into public.kb_categories ("id", "establishment_id", "name", "slug", "description", "icon", "sort_order", "created_at", "updated_at") values ('f9a497bf-676b-4b75-9174-84f9df745f05', 'f406351f-487b-47db-b0d3-bd5cb918b6c3', 'QR Code', 'qr-code', 'Tudo sobre QR Codes de cartões e leitura.', 'QrCode', 10, '2026-07-28T00:14:12.92027+00:00', '2026-07-28T00:14:12.92027+00:00') on conflict do nothing;
insert into public.kb_categories ("id", "establishment_id", "name", "slug", "description", "icon", "sort_order", "created_at", "updated_at") values ('22e0fdad-db23-4b0c-8547-0b735491fa6e', '39ceb812-25db-4da1-90c3-80bbdf7e1b4d', 'Primeiros passos', 'primeiros-passos', 'Comece a usar o Fidelize e configure sua empresa em minutos.', 'Rocket', 1, '2026-07-28T00:14:12.92027+00:00', '2026-07-28T00:14:12.92027+00:00') on conflict do nothing;
insert into public.kb_categories ("id", "establishment_id", "name", "slug", "description", "icon", "sort_order", "created_at", "updated_at") values ('2bc7cc8c-5144-4c34-a4dd-8a0850fec899', '384a0143-f8a5-4d1d-9165-f6033a078ce6', 'Configurações', 'configuracoes', 'Dados da empresa, identidade visual e notificações.', 'Settings', 12, '2026-07-28T00:14:12.92027+00:00', '2026-07-28T00:14:12.92027+00:00') on conflict do nothing;
insert into public.kb_categories ("id", "establishment_id", "name", "slug", "description", "icon", "sort_order", "created_at", "updated_at") values ('436db681-5542-417b-80b0-21cf720bd7af', '3557f00b-d660-4682-a16f-65c3c0a5c959', 'Primeiros passos', 'primeiros-passos', 'Comece a usar o Fidelize e configure sua empresa em minutos.', 'Rocket', 1, '2026-07-28T00:14:12.92027+00:00', '2026-07-28T00:14:12.92027+00:00') on conflict do nothing;
insert into public.kb_categories ("id", "establishment_id", "name", "slug", "description", "icon", "sort_order", "created_at", "updated_at") values ('8975501f-c39a-444a-9d1d-ceb7eb294b64', '7ee0e65f-852c-4bba-a0cb-ce18e2569782', 'Planos', 'planos', 'Diferenças, upgrades e cancelamentos.', 'Package', 8, '2026-07-28T00:14:12.92027+00:00', '2026-07-28T00:14:12.92027+00:00') on conflict do nothing;
insert into public.kb_categories ("id", "establishment_id", "name", "slug", "description", "icon", "sort_order", "created_at", "updated_at") values ('5d82c397-08ef-4050-aff3-be3086d20dad', '11111111-1111-1111-1111-111111111111', 'Primeiros passos', 'primeiros-passos', 'Comece a usar o Fidelize e configure sua empresa em minutos.', 'Rocket', 1, '2026-07-28T00:14:12.92027+00:00', '2026-07-28T00:14:12.92027+00:00') on conflict do nothing;
insert into public.kb_categories ("id", "establishment_id", "name", "slug", "description", "icon", "sort_order", "created_at", "updated_at") values ('3e566c79-f45b-4fb1-ae11-e9b25e23d23f', 'b4b328c7-2385-4cb2-9ee0-6988cecdb205', 'QR Code', 'qr-code', 'Tudo sobre QR Codes de cartões e leitura.', 'QrCode', 10, '2026-07-28T00:14:12.92027+00:00', '2026-07-28T00:14:12.92027+00:00') on conflict do nothing;
insert into public.kb_categories ("id", "establishment_id", "name", "slug", "description", "icon", "sort_order", "created_at", "updated_at") values ('d39382ae-7917-4c65-8871-a8fb06967ed8', 'dfbbe781-92e1-493f-88e1-d1fb74fd80ea', 'Configurações', 'configuracoes', 'Dados da empresa, identidade visual e notificações.', 'Settings', 12, '2026-07-28T00:14:12.92027+00:00', '2026-07-28T00:14:12.92027+00:00') on conflict do nothing;
insert into public.kb_categories ("id", "establishment_id", "name", "slug", "description", "icon", "sort_order", "created_at", "updated_at") values ('3e736f41-c9d6-4b1e-9e8d-7e7082e174ee', '6f0bba49-cdc2-4dc8-b491-56250a653f12', 'QR Code', 'qr-code', 'Tudo sobre QR Codes de cartões e leitura.', 'QrCode', 10, '2026-07-28T00:14:12.92027+00:00', '2026-07-28T00:14:12.92027+00:00') on conflict do nothing;
insert into public.kb_categories ("id", "establishment_id", "name", "slug", "description", "icon", "sort_order", "created_at", "updated_at") values ('9e5b4b23-f462-425f-b336-d79a9abfa682', '39ceb812-25db-4da1-90c3-80bbdf7e1b4d', 'Planos', 'planos', 'Diferenças, upgrades e cancelamentos.', 'Package', 8, '2026-07-28T00:14:12.92027+00:00', '2026-07-28T00:14:12.92027+00:00') on conflict do nothing;
insert into public.kb_categories ("id", "establishment_id", "name", "slug", "description", "icon", "sort_order", "created_at", "updated_at") values ('63c1b5b7-ce5c-431e-9fe4-350e8cec20c6', '384a0143-f8a5-4d1d-9165-f6033a078ce6', 'Pagamentos', 'pagamentos', 'Assinatura, PIX, cartão e problemas de cobrança.', 'CreditCard', 9, '2026-07-28T00:14:12.92027+00:00', '2026-07-28T00:14:12.92027+00:00') on conflict do nothing;
insert into public.kb_categories ("id", "establishment_id", "name", "slug", "description", "icon", "sort_order", "created_at", "updated_at") values ('ec6317b2-1da6-4ab5-bc47-a21abb2e2671', 'dfbbe781-92e1-493f-88e1-d1fb74fd80ea', 'Suporte', 'suporte', 'Como usar o suporte da Fidelize.', 'LifeBuoy', 11, '2026-07-28T00:14:12.92027+00:00', '2026-07-28T00:14:12.92027+00:00') on conflict do nothing;
insert into public.kb_categories ("id", "establishment_id", "name", "slug", "description", "icon", "sort_order", "created_at", "updated_at") values ('5ea02c7a-900f-43a1-a629-8623928453be', 'b4b328c7-2385-4cb2-9ee0-6988cecdb205', 'Campanhas', 'campanhas', 'Planeje campanhas fidelidade e maximize resultados.', 'Megaphone', 5, '2026-07-28T00:14:12.92027+00:00', '2026-07-28T00:14:12.92027+00:00') on conflict do nothing;
insert into public.kb_categories ("id", "establishment_id", "name", "slug", "description", "icon", "sort_order", "created_at", "updated_at") values ('6a48d4a8-1e82-41f9-a07c-7448e1827cfb', 'dfbbe781-92e1-493f-88e1-d1fb74fd80ea', 'Integrações', 'integracoes', 'Mercado Pago, Resend, API e Webhooks.', 'Plug', 13, '2026-07-28T00:14:12.92027+00:00', '2026-07-28T00:14:12.92027+00:00') on conflict do nothing;
insert into public.kb_categories ("id", "establishment_id", "name", "slug", "description", "icon", "sort_order", "created_at", "updated_at") values ('40e83fdb-4f6f-4bb9-9ec6-a0322514c93f', 'c951fe78-6701-47aa-aabe-071ef963b59c', 'Primeiros passos', 'primeiros-passos', 'Comece a usar o Fidelize e configure sua empresa em minutos.', 'Rocket', 1, '2026-07-28T00:14:12.92027+00:00', '2026-07-28T00:14:12.92027+00:00') on conflict do nothing;
insert into public.kb_categories ("id", "establishment_id", "name", "slug", "description", "icon", "sort_order", "created_at", "updated_at") values ('faf51c23-7b84-490e-a049-81b1b7cb308d', 'b4b328c7-2385-4cb2-9ee0-6988cecdb205', 'Relatórios', 'relatorios', 'Interprete métricas, conversões e indicadores.', 'BarChart3', 7, '2026-07-28T00:14:12.92027+00:00', '2026-07-28T00:14:12.92027+00:00') on conflict do nothing;
insert into public.kb_categories ("id", "establishment_id", "name", "slug", "description", "icon", "sort_order", "created_at", "updated_at") values ('2175c8e1-c2b5-4823-a2f2-16ff3142b0bc', '7ee0e65f-852c-4bba-a0cb-ce18e2569782', 'Primeiros passos', 'primeiros-passos', 'Comece a usar o Fidelize e configure sua empresa em minutos.', 'Rocket', 1, '2026-07-28T00:14:12.92027+00:00', '2026-07-28T00:14:12.92027+00:00') on conflict do nothing;
insert into public.kb_categories ("id", "establishment_id", "name", "slug", "description", "icon", "sort_order", "created_at", "updated_at") values ('9a0f8d40-8173-4158-8553-950bd24970ef', 'f406351f-487b-47db-b0d3-bd5cb918b6c3', 'Cartão Fidelidade', 'cartao-fidelidade', 'Crie e personalize cartões digitais de fidelidade.', 'CreditCard', 3, '2026-07-28T00:14:12.92027+00:00', '2026-07-28T00:14:12.92027+00:00') on conflict do nothing;
insert into public.kb_categories ("id", "establishment_id", "name", "slug", "description", "icon", "sort_order", "created_at", "updated_at") values ('68b2fa98-f607-4e05-8415-1020510dcc5b', '3557f00b-d660-4682-a16f-65c3c0a5c959', 'Planos', 'planos', 'Diferenças, upgrades e cancelamentos.', 'Package', 8, '2026-07-28T00:14:12.92027+00:00', '2026-07-28T00:14:12.92027+00:00') on conflict do nothing;
insert into public.kb_categories ("id", "establishment_id", "name", "slug", "description", "icon", "sort_order", "created_at", "updated_at") values ('cde36286-722d-4064-b403-215fe1db92de', '6f0bba49-cdc2-4dc8-b491-56250a653f12', 'Relatórios', 'relatorios', 'Interprete métricas, conversões e indicadores.', 'BarChart3', 7, '2026-07-28T00:14:12.92027+00:00', '2026-07-28T00:14:12.92027+00:00') on conflict do nothing;
insert into public.kb_categories ("id", "establishment_id", "name", "slug", "description", "icon", "sort_order", "created_at", "updated_at") values ('c149da2f-67cc-43c8-8cf7-84ff87dbe7a0', '6f0bba49-cdc2-4dc8-b491-56250a653f12', 'Campanhas', 'campanhas', 'Planeje campanhas fidelidade e maximize resultados.', 'Megaphone', 5, '2026-07-28T00:14:12.92027+00:00', '2026-07-28T00:14:12.92027+00:00') on conflict do nothing;
insert into public.kb_categories ("id", "establishment_id", "name", "slug", "description", "icon", "sort_order", "created_at", "updated_at") values ('18c1e677-f213-455e-9673-f8c3d4b6ba65', '39ceb812-25db-4da1-90c3-80bbdf7e1b4d', 'Segurança', 'seguranca', 'Autenticação, LGPD, permissões e auditoria.', 'Shield', 14, '2026-07-28T00:14:12.92027+00:00', '2026-07-28T00:14:12.92027+00:00') on conflict do nothing;
insert into public.kb_categories ("id", "establishment_id", "name", "slug", "description", "icon", "sort_order", "created_at", "updated_at") values ('45a78196-8dc0-4040-b65b-867f04f83440', '3557f00b-d660-4682-a16f-65c3c0a5c959', 'Funcionários', 'funcionarios', 'Equipe, papéis e permissões dentro da sua conta.', 'UsersRound', 6, '2026-07-28T00:14:12.92027+00:00', '2026-07-28T00:14:12.92027+00:00') on conflict do nothing;
insert into public.kb_categories ("id", "establishment_id", "name", "slug", "description", "icon", "sort_order", "created_at", "updated_at") values ('7ef76479-593c-4c13-a97d-68b2c69e498f', '384a0143-f8a5-4d1d-9165-f6033a078ce6', 'QR Code', 'qr-code', 'Tudo sobre QR Codes de cartões e leitura.', 'QrCode', 10, '2026-07-28T00:14:12.92027+00:00', '2026-07-28T00:14:12.92027+00:00') on conflict do nothing;
insert into public.kb_categories ("id", "establishment_id", "name", "slug", "description", "icon", "sort_order", "created_at", "updated_at") values ('4e73e477-5955-43c6-980b-3f90baf22cd2', '39ceb812-25db-4da1-90c3-80bbdf7e1b4d', 'Funcionários', 'funcionarios', 'Equipe, papéis e permissões dentro da sua conta.', 'UsersRound', 6, '2026-07-28T00:14:12.92027+00:00', '2026-07-28T00:14:12.92027+00:00') on conflict do nothing;
insert into public.kb_categories ("id", "establishment_id", "name", "slug", "description", "icon", "sort_order", "created_at", "updated_at") values ('8c84aa58-7bdf-4d67-a43f-ec63e618f07a', '11111111-1111-1111-1111-111111111111', 'Clientes', 'clientes', 'Gerencie sua base de clientes: cadastro, importação e exportação.', 'Users', 2, '2026-07-28T00:14:12.92027+00:00', '2026-07-28T00:14:12.92027+00:00') on conflict do nothing;
insert into public.kb_categories ("id", "establishment_id", "name", "slug", "description", "icon", "sort_order", "created_at", "updated_at") values ('df5282fe-b60f-4ae0-92ac-8acdc43fe9a0', '11111111-1111-1111-1111-111111111111', 'Carimbos', 'carimbos', 'Adicione, remova e escaneie carimbos com segurança.', 'Stamp', 4, '2026-07-28T00:14:12.92027+00:00', '2026-07-28T00:14:12.92027+00:00') on conflict do nothing;
insert into public.kb_categories ("id", "establishment_id", "name", "slug", "description", "icon", "sort_order", "created_at", "updated_at") values ('dfd2a0b0-b876-4394-b23a-0a4b3089a808', '3557f00b-d660-4682-a16f-65c3c0a5c959', 'Segurança', 'seguranca', 'Autenticação, LGPD, permissões e auditoria.', 'Shield', 14, '2026-07-28T00:14:12.92027+00:00', '2026-07-28T00:14:12.92027+00:00') on conflict do nothing;
insert into public.kb_categories ("id", "establishment_id", "name", "slug", "description", "icon", "sort_order", "created_at", "updated_at") values ('39ef88db-a11a-4a8f-8e22-5891eae1ac46', 'f406351f-487b-47db-b0d3-bd5cb918b6c3', 'Configurações', 'configuracoes', 'Dados da empresa, identidade visual e notificações.', 'Settings', 12, '2026-07-28T00:14:12.92027+00:00', '2026-07-28T00:14:12.92027+00:00') on conflict do nothing;
insert into public.kb_categories ("id", "establishment_id", "name", "slug", "description", "icon", "sort_order", "created_at", "updated_at") values ('3bf444e0-326f-4717-a14f-9dd5b07f64ba', '7ee0e65f-852c-4bba-a0cb-ce18e2569782', 'Clientes', 'clientes', 'Gerencie sua base de clientes: cadastro, importação e exportação.', 'Users', 2, '2026-07-28T00:14:12.92027+00:00', '2026-07-28T00:14:12.92027+00:00') on conflict do nothing;
insert into public.kb_categories ("id", "establishment_id", "name", "slug", "description", "icon", "sort_order", "created_at", "updated_at") values ('54cd9049-9638-4978-9a80-2c88b9f10fb3', '384a0143-f8a5-4d1d-9165-f6033a078ce6', 'Campanhas', 'campanhas', 'Planeje campanhas fidelidade e maximize resultados.', 'Megaphone', 5, '2026-07-28T00:14:12.92027+00:00', '2026-07-28T00:14:12.92027+00:00') on conflict do nothing;
insert into public.kb_categories ("id", "establishment_id", "name", "slug", "description", "icon", "sort_order", "created_at", "updated_at") values ('c0b02e49-24d1-4672-a400-db1d9e26fcd4', '384a0143-f8a5-4d1d-9165-f6033a078ce6', 'Relatórios', 'relatorios', 'Interprete métricas, conversões e indicadores.', 'BarChart3', 7, '2026-07-28T00:14:12.92027+00:00', '2026-07-28T00:14:12.92027+00:00') on conflict do nothing;
insert into public.kb_categories ("id", "establishment_id", "name", "slug", "description", "icon", "sort_order", "created_at", "updated_at") values ('5d902f6d-fd0d-403d-8f44-bcaf226098a3', 'dfbbe781-92e1-493f-88e1-d1fb74fd80ea', 'Cartão Fidelidade', 'cartao-fidelidade', 'Crie e personalize cartões digitais de fidelidade.', 'CreditCard', 3, '2026-07-28T00:14:12.92027+00:00', '2026-07-28T00:14:12.92027+00:00') on conflict do nothing;
insert into public.kb_categories ("id", "establishment_id", "name", "slug", "description", "icon", "sort_order", "created_at", "updated_at") values ('c822dc9e-6e8d-4298-b18f-f9c85b0a6386', '7ee0e65f-852c-4bba-a0cb-ce18e2569782', 'Carimbos', 'carimbos', 'Adicione, remova e escaneie carimbos com segurança.', 'Stamp', 4, '2026-07-28T00:14:12.92027+00:00', '2026-07-28T00:14:12.92027+00:00') on conflict do nothing;
insert into public.kb_categories ("id", "establishment_id", "name", "slug", "description", "icon", "sort_order", "created_at", "updated_at") values ('71d6fda4-3faa-4bf8-9453-1e2185a7fe6c', 'b4b328c7-2385-4cb2-9ee0-6988cecdb205', 'Pagamentos', 'pagamentos', 'Assinatura, PIX, cartão e problemas de cobrança.', 'CreditCard', 9, '2026-07-28T00:14:12.92027+00:00', '2026-07-28T00:14:12.92027+00:00') on conflict do nothing;
insert into public.kb_categories ("id", "establishment_id", "name", "slug", "description", "icon", "sort_order", "created_at", "updated_at") values ('916a3164-2467-4bbb-8ffb-eee25578eb9b', 'c951fe78-6701-47aa-aabe-071ef963b59c', 'Carimbos', 'carimbos', 'Adicione, remova e escaneie carimbos com segurança.', 'Stamp', 4, '2026-07-28T00:14:12.92027+00:00', '2026-07-28T00:14:12.92027+00:00') on conflict do nothing;
insert into public.kb_categories ("id", "establishment_id", "name", "slug", "description", "icon", "sort_order", "created_at", "updated_at") values ('65418242-d911-4336-abf7-0f7edb695804', 'f406351f-487b-47db-b0d3-bd5cb918b6c3', 'Suporte', 'suporte', 'Como usar o suporte da Fidelize.', 'LifeBuoy', 11, '2026-07-28T00:14:12.92027+00:00', '2026-07-28T00:14:12.92027+00:00') on conflict do nothing;
insert into public.kb_categories ("id", "establishment_id", "name", "slug", "description", "icon", "sort_order", "created_at", "updated_at") values ('9b8d3be7-cc7e-494d-a018-cdd555f9d501', '6f0bba49-cdc2-4dc8-b491-56250a653f12', 'Pagamentos', 'pagamentos', 'Assinatura, PIX, cartão e problemas de cobrança.', 'CreditCard', 9, '2026-07-28T00:14:12.92027+00:00', '2026-07-28T00:14:12.92027+00:00') on conflict do nothing;
insert into public.kb_categories ("id", "establishment_id", "name", "slug", "description", "icon", "sort_order", "created_at", "updated_at") values ('50dab5d8-2edb-44f0-8309-3dae1603afe3', 'c951fe78-6701-47aa-aabe-071ef963b59c', 'Clientes', 'clientes', 'Gerencie sua base de clientes: cadastro, importação e exportação.', 'Users', 2, '2026-07-28T00:14:12.92027+00:00', '2026-07-28T00:14:12.92027+00:00') on conflict do nothing;
insert into public.kb_categories ("id", "establishment_id", "name", "slug", "description", "icon", "sort_order", "created_at", "updated_at") values ('95e44424-9e53-4cfc-9415-6a64755e2c0e', 'f406351f-487b-47db-b0d3-bd5cb918b6c3', 'Integrações', 'integracoes', 'Mercado Pago, Resend, API e Webhooks.', 'Plug', 13, '2026-07-28T00:14:12.92027+00:00', '2026-07-28T00:14:12.92027+00:00') on conflict do nothing;
insert into public.kb_categories ("id", "establishment_id", "name", "slug", "description", "icon", "sort_order", "created_at", "updated_at") values ('a3dc99de-91ff-4508-ad21-30c9f1dae0aa', 'a5765513-096e-457b-a5c8-073a0e59249b', 'Primeiros passos', 'primeiros-passos', 'Comece a usar o Fidelize e configure sua empresa em minutos.', 'Rocket', 1, '2026-07-30T17:19:32.856819+00:00', '2026-07-30T17:19:32.856819+00:00') on conflict do nothing;
insert into public.kb_categories ("id", "establishment_id", "name", "slug", "description", "icon", "sort_order", "created_at", "updated_at") values ('917e84de-77d4-415e-9e39-00092df75541', 'a5765513-096e-457b-a5c8-073a0e59249b', 'Clientes', 'clientes', 'Gerencie sua base de clientes: cadastro, importação e exportação.', 'Users', 2, '2026-07-30T17:19:32.856819+00:00', '2026-07-30T17:19:32.856819+00:00') on conflict do nothing;
insert into public.kb_categories ("id", "establishment_id", "name", "slug", "description", "icon", "sort_order", "created_at", "updated_at") values ('58a9dce7-f729-4fa5-bb11-18d8571be3c2', 'a5765513-096e-457b-a5c8-073a0e59249b', 'Cartão Fidelidade', 'cartao-fidelidade', 'Crie e personalize cartões digitais de fidelidade.', 'CreditCard', 3, '2026-07-30T17:19:32.856819+00:00', '2026-07-30T17:19:32.856819+00:00') on conflict do nothing;
insert into public.kb_categories ("id", "establishment_id", "name", "slug", "description", "icon", "sort_order", "created_at", "updated_at") values ('56f1d620-ffcd-4e88-9e27-22e337484767', 'a5765513-096e-457b-a5c8-073a0e59249b', 'Carimbos', 'carimbos', 'Adicione, remova e escaneie carimbos com segurança.', 'Stamp', 4, '2026-07-30T17:19:32.856819+00:00', '2026-07-30T17:19:32.856819+00:00') on conflict do nothing;
insert into public.kb_categories ("id", "establishment_id", "name", "slug", "description", "icon", "sort_order", "created_at", "updated_at") values ('10c32886-db40-4beb-b24e-bd9f79c3cef4', 'a5765513-096e-457b-a5c8-073a0e59249b', 'Campanhas', 'campanhas', 'Planeje campanhas fidelidade e maximize resultados.', 'Megaphone', 5, '2026-07-30T17:19:32.856819+00:00', '2026-07-30T17:19:32.856819+00:00') on conflict do nothing;
insert into public.kb_categories ("id", "establishment_id", "name", "slug", "description", "icon", "sort_order", "created_at", "updated_at") values ('77248fd3-8e1e-4e33-a082-b44f8d6fa135', 'a5765513-096e-457b-a5c8-073a0e59249b', 'Funcionários', 'funcionarios', 'Equipe, papéis e permissões dentro da sua conta.', 'UsersRound', 6, '2026-07-30T17:19:32.856819+00:00', '2026-07-30T17:19:32.856819+00:00') on conflict do nothing;
insert into public.kb_categories ("id", "establishment_id", "name", "slug", "description", "icon", "sort_order", "created_at", "updated_at") values ('5237c1cf-16b9-4f55-b20b-dddc19ed3c4e', 'a5765513-096e-457b-a5c8-073a0e59249b', 'Relatórios', 'relatorios', 'Interprete métricas, conversões e indicadores.', 'BarChart3', 7, '2026-07-30T17:19:32.856819+00:00', '2026-07-30T17:19:32.856819+00:00') on conflict do nothing;
insert into public.kb_categories ("id", "establishment_id", "name", "slug", "description", "icon", "sort_order", "created_at", "updated_at") values ('40edd9f8-1169-42f7-a871-07b97bd8b869', 'a5765513-096e-457b-a5c8-073a0e59249b', 'Planos', 'planos', 'Diferenças, upgrades e cancelamentos.', 'Package', 8, '2026-07-30T17:19:32.856819+00:00', '2026-07-30T17:19:32.856819+00:00') on conflict do nothing;
insert into public.kb_categories ("id", "establishment_id", "name", "slug", "description", "icon", "sort_order", "created_at", "updated_at") values ('5742ce3f-6640-4ea3-a4fe-8ae1ed4465f0', 'a5765513-096e-457b-a5c8-073a0e59249b', 'Pagamentos', 'pagamentos', 'Assinatura, PIX, cartão e problemas de cobrança.', 'CreditCard', 9, '2026-07-30T17:19:32.856819+00:00', '2026-07-30T17:19:32.856819+00:00') on conflict do nothing;
insert into public.kb_categories ("id", "establishment_id", "name", "slug", "description", "icon", "sort_order", "created_at", "updated_at") values ('355a9c32-6d57-4114-be06-eeebb9368d15', 'a5765513-096e-457b-a5c8-073a0e59249b', 'QR Code', 'qr-code', 'Tudo sobre QR Codes de cartões e leitura.', 'QrCode', 10, '2026-07-30T17:19:32.856819+00:00', '2026-07-30T17:19:32.856819+00:00') on conflict do nothing;
insert into public.kb_categories ("id", "establishment_id", "name", "slug", "description", "icon", "sort_order", "created_at", "updated_at") values ('7d5ff994-69c2-4502-b429-3fdc7dadbb2d', 'a5765513-096e-457b-a5c8-073a0e59249b', 'Suporte', 'suporte', 'Como usar o suporte da Fidelize.', 'LifeBuoy', 11, '2026-07-30T17:19:32.856819+00:00', '2026-07-30T17:19:32.856819+00:00') on conflict do nothing;
insert into public.kb_categories ("id", "establishment_id", "name", "slug", "description", "icon", "sort_order", "created_at", "updated_at") values ('afa5ef60-c743-45e5-a62f-acb6dcc6e829', 'a5765513-096e-457b-a5c8-073a0e59249b', 'Configurações', 'configuracoes', 'Dados da empresa, identidade visual e notificações.', 'Settings', 12, '2026-07-30T17:19:32.856819+00:00', '2026-07-30T17:19:32.856819+00:00') on conflict do nothing;
insert into public.kb_categories ("id", "establishment_id", "name", "slug", "description", "icon", "sort_order", "created_at", "updated_at") values ('22f5f4b0-20fa-4e43-8948-a3104222721f', 'a5765513-096e-457b-a5c8-073a0e59249b', 'Integrações', 'integracoes', 'Mercado Pago, Resend, API e Webhooks.', 'Plug', 13, '2026-07-30T17:19:32.856819+00:00', '2026-07-30T17:19:32.856819+00:00') on conflict do nothing;
insert into public.kb_categories ("id", "establishment_id", "name", "slug", "description", "icon", "sort_order", "created_at", "updated_at") values ('d4a98c9b-9109-4648-b302-f1cb608eda64', 'a5765513-096e-457b-a5c8-073a0e59249b', 'Segurança', 'seguranca', 'Autenticação, LGPD, permissões e auditoria.', 'Shield', 14, '2026-07-30T17:19:32.856819+00:00', '2026-07-30T17:19:32.856819+00:00') on conflict do nothing;

-- sponsored_ad_packages (3 registros)
insert into public.sponsored_ad_packages ("id", "name", "description", "duration_days", "price_cents", "currency", "is_active", "display_order", "created_at", "updated_at", "created_by", "updated_by") values ('447b53a6-efc1-4b73-baa3-2d754dc2188d', 'Destaque 7 dias', 'Uma semana de destaque na vitrine Descobrir.', 7, 4900, 'BRL', true, 1, '2026-07-30T22:39:34.854519+00:00', '2026-07-30T22:39:34.854519+00:00', null, null) on conflict do nothing;
insert into public.sponsored_ad_packages ("id", "name", "description", "duration_days", "price_cents", "currency", "is_active", "display_order", "created_at", "updated_at", "created_by", "updated_by") values ('3863bb7f-32d4-4482-a06e-c86d4b5daae7', 'Destaque 15 dias', 'Quinze dias de destaque na vitrine Descobrir.', 15, 8900, 'BRL', true, 2, '2026-07-30T22:39:34.854519+00:00', '2026-07-30T22:39:34.854519+00:00', null, null) on conflict do nothing;
insert into public.sponsored_ad_packages ("id", "name", "description", "duration_days", "price_cents", "currency", "is_active", "display_order", "created_at", "updated_at", "created_by", "updated_by") values ('6f0a5fae-e736-47e7-a2a8-573c81f2cd24', 'Destaque 30 dias', 'Um mês inteiro de destaque na vitrine Descobrir.', 30, 14900, 'BRL', true, 3, '2026-07-30T22:39:34.854519+00:00', '2026-07-30T22:39:34.854519+00:00', null, null) on conflict do nothing;

-- sponsored_ad_settings (1 registros)
insert into public.sponsored_ad_settings ("id", "max_ads_per_category", "impression_dedupe_minutes", "click_dedupe_minutes", "max_impressions_per_session_24h", "allowed_categories", "default_gateway", "pix_expiration_minutes", "allow_self_pause", "self_pause_extends_period", "advertiser_terms", "advertiser_terms_version", "updated_at", "updated_by") values (true, 3, 30, 5, 3, '["alimentacao", "beleza", "saude", "moda", "fitness", "pet", "servicos", "lazer", "outros"]'::jsonb, 'mercadopago', 30, true, false, 'Ao enviar um anúncio você declara que o conteúdo é verdadeiro, próprio ou licenciado, e que não viola leis, direitos de terceiros ou a política de conteúdo da Fidelize. Anúncios enganosos, ofensivos, adultos, políticos, discriminatórios ou com ofertas inexistentes serão rejeitados sem reembolso.', 1, '2026-07-30T22:39:34.854519+00:00', null) on conflict do nothing;

-- email_templates (3 registros)
insert into public.email_templates ("id", "slug", "name", "description", "subject", "html", "text", "variables", "is_system", "active", "updated_by", "created_at", "updated_at") values ('a25383c1-c7c6-49ac-a7b6-b2d5e071e296', 'password_recovery', 'Recuperação de senha', 'E-mail enviado quando o usuário solicita redefinição de senha.', 'Redefina sua senha — Fidelize', '<div style="font-family:Inter,Arial,sans-serif;max-width:520px;margin:auto;padding:24px;color:#0f172a">
  <h2 style="margin:0 0 12px;font-size:20px">Olá {{name}},</h2>
  <p style="margin:0 0 16px;line-height:1.6">Recebemos um pedido para redefinir a senha da sua conta na Fidelize.</p>
  <p style="margin:0 0 24px"><a href="{{action_link}}" style="display:inline-block;background:#0ea5e9;color:#fff;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:600">Redefinir senha</a></p>
  <p style="margin:0 0 8px;color:#64748b;font-size:13px">Ou copie e cole este link no navegador:</p>
  <p style="margin:0 0 24px;word-break:break-all;font-size:12px;color:#0f172a"><a href="{{action_link}}">{{action_link}}</a></p>
  <p style="margin:0;color:#64748b;font-size:12px">Se você não solicitou, ignore este e-mail.</p>
 </div>', 'Olá {{name}},\n\nRedefina sua senha: {{action_link}}\n\nSe você não solicitou, ignore este e-mail.', '["name", "action_link"]'::jsonb, true, true, null, '2026-07-18T20:18:35.162936+00:00', '2026-07-18T20:18:35.162936+00:00') on conflict do nothing;
insert into public.email_templates ("id", "slug", "name", "description", "subject", "html", "text", "variables", "is_system", "active", "updated_by", "created_at", "updated_at") values ('a39e1912-10de-4703-afcd-039e9c17bf2f', 'team_invite', 'Convite de equipe', 'Enviado quando um lojista convida um novo membro para a equipe.', 'Você foi convidado para {{establishment_name}} — Fidelize', '<div style="font-family:Inter,Arial,sans-serif;max-width:520px;margin:auto;padding:24px;color:#0f172a">
  <h2 style="margin:0 0 12px;font-size:20px">{{inviter_name}} convidou você</h2>
  <p style="margin:0 0 16px;line-height:1.6">Você foi convidado para participar da equipe de <strong>{{establishment_name}}</strong> como <strong>{{role}}</strong> na plataforma Fidelize.</p>
  <p style="margin:0 0 24px"><a href="{{invite_url}}" style="display:inline-block;background:#0ea5e9;color:#fff;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:600">Aceitar convite</a></p>
  <p style="margin:0 0 8px;color:#64748b;font-size:13px">Ou copie e cole este link:</p>
  <p style="margin:0;word-break:break-all;font-size:12px"><a href="{{invite_url}}">{{invite_url}}</a></p>
 </div>', 'Você foi convidado para {{establishment_name}} como {{role}}.\n\nAceitar: {{invite_url}}', '["inviter_name", "establishment_name", "role", "invite_url"]'::jsonb, true, true, null, '2026-07-18T20:18:35.162936+00:00', '2026-07-18T20:18:35.162936+00:00') on conflict do nothing;
insert into public.email_templates ("id", "slug", "name", "description", "subject", "html", "text", "variables", "is_system", "active", "updated_by", "created_at", "updated_at") values ('202e841d-e99b-4c59-9819-1331097aa161', 'reviews_feature_unlocked', 'Recurso Avaliações liberado', 'Enviado ao dono da empresa quando o novo plano libera o módulo de Avaliações públicas.', 'Avaliações públicas liberadas para {{establishment_name}} 🎉', '<div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#0f172a">
    <h1 style="font-size:22px;margin:0 0 12px">Seu novo plano liberou as Avaliações públicas</h1>
    <p style="font-size:15px;line-height:1.5">Olá {{owner_name}}, o plano <strong>{{plan_name}}</strong> da empresa <strong>{{establishment_name}}</strong> já inclui o módulo <strong>Avaliações públicas de atendimento</strong>.</p>
    <p style="font-size:15px;line-height:1.5">Agora você pode:</p>
    <ul style="font-size:14px;line-height:1.6">
      <li>Publicar o formulário em <a href="{{public_review_url}}">{{public_review_url}}</a></li>
      <li>Gerar um QR Code dedicado para balcão, mesa ou recibo</li>
      <li>Receber alertas de nota baixa e responder publicamente</li>
    </ul>
    <p style="margin:24px 0">
      <a href="{{app_reviews_url}}" style="display:inline-block;background:#111827;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600">Configurar avaliações</a>
    </p>
    <p style="font-size:12px;color:#64748b">Você recebeu este e-mail porque é dono da empresa {{establishment_name}} no Fidelize.</p>
  </div>', 'Seu novo plano {{plan_name}} liberou o módulo de Avaliações públicas para {{establishment_name}}. Configure em {{app_reviews_url}} e compartilhe {{public_review_url}}.', '["owner_name", "establishment_name", "plan_name", "public_review_url", "app_reviews_url"]'::jsonb, true, true, null, '2026-07-19T21:52:39.010069+00:00', '2026-07-19T21:52:39.010069+00:00') on conflict do nothing;

-- log_retention_policies (18 registros)
insert into public.log_retention_policies ("table_name", "retention_days", "timestamp_column", "note", "updated_at") values ('pixel_events', 90, 'created_at', 'Telemetria de marketing', '2026-07-30T02:32:21.954621+00:00') on conflict do nothing;
insert into public.log_retention_policies ("table_name", "retention_days", "timestamp_column", "note", "updated_at") values ('channel_events', 90, 'created_at', 'Eventos de canais/analytics', '2026-07-30T02:32:21.954621+00:00') on conflict do nothing;
insert into public.log_retention_policies ("table_name", "retention_days", "timestamp_column", "note", "updated_at") values ('app_engagement_events', 90, 'created_at', 'Engajamento no app', '2026-07-30T02:32:21.954621+00:00') on conflict do nothing;
insert into public.log_retention_policies ("table_name", "retention_days", "timestamp_column", "note", "updated_at") values ('qr_scans', 90, 'created_at', 'Leituras de QR Code', '2026-07-30T02:32:21.954621+00:00') on conflict do nothing;
insert into public.log_retention_policies ("table_name", "retention_days", "timestamp_column", "note", "updated_at") values ('feature_gate_events', 90, 'created_at', 'Bloqueios por plano', '2026-07-30T02:32:21.954621+00:00') on conflict do nothing;
insert into public.log_retention_policies ("table_name", "retention_days", "timestamp_column", "note", "updated_at") values ('help_article_views', 90, 'created_at', 'Visualizações da central de ajuda', '2026-07-30T02:32:21.954621+00:00') on conflict do nothing;
insert into public.log_retention_policies ("table_name", "retention_days", "timestamp_column", "note", "updated_at") values ('review_events', 180, 'created_at', 'Eventos de avaliações', '2026-07-30T02:32:21.954621+00:00') on conflict do nothing;
insert into public.log_retention_policies ("table_name", "retention_days", "timestamp_column", "note", "updated_at") values ('push_events', 180, 'created_at', 'Eventos de push', '2026-07-30T02:32:21.954621+00:00') on conflict do nothing;
insert into public.log_retention_policies ("table_name", "retention_days", "timestamp_column", "note", "updated_at") values ('push_logs', 180, 'created_at', 'Entregas de push', '2026-07-30T02:32:21.954621+00:00') on conflict do nothing;
insert into public.log_retention_policies ("table_name", "retention_days", "timestamp_column", "note", "updated_at") values ('email_logs', 180, 'created_at', 'Entregas de e-mail', '2026-07-30T02:32:21.954621+00:00') on conflict do nothing;
insert into public.log_retention_policies ("table_name", "retention_days", "timestamp_column", "note", "updated_at") values ('email_queue', 180, 'created_at', 'Fila de e-mail processada', '2026-07-30T02:32:21.954621+00:00') on conflict do nothing;
insert into public.log_retention_policies ("table_name", "retention_days", "timestamp_column", "note", "updated_at") values ('webhook_deliveries', 180, 'created_at', 'Entregas de webhook', '2026-07-30T02:32:21.954621+00:00') on conflict do nothing;
insert into public.log_retention_policies ("table_name", "retention_days", "timestamp_column", "note", "updated_at") values ('retention_events', 365, 'created_at', 'Eventos de retenção/níveis', '2026-07-30T02:32:21.954621+00:00') on conflict do nothing;
insert into public.log_retention_policies ("table_name", "retention_days", "timestamp_column", "note", "updated_at") values ('ai_usage', 365, 'created_at', 'Consumo de IA', '2026-07-30T02:32:21.954621+00:00') on conflict do nothing;
insert into public.log_retention_policies ("table_name", "retention_days", "timestamp_column", "note", "updated_at") values ('audit_logs', 1825, 'created_at', 'Auditoria — prazo legal 5 anos', '2026-07-30T02:32:21.954621+00:00') on conflict do nothing;
insert into public.log_retention_policies ("table_name", "retention_days", "timestamp_column", "note", "updated_at") values ('payment_logs', 1825, 'created_at', 'Financeiro — prazo legal 5 anos', '2026-07-30T02:32:21.954621+00:00') on conflict do nothing;
insert into public.log_retention_policies ("table_name", "retention_days", "timestamp_column", "note", "updated_at") values ('subscription_events', 1825, 'created_at', 'Assinaturas — prazo legal 5 anos', '2026-07-30T02:32:21.954621+00:00') on conflict do nothing;
insert into public.log_retention_policies ("table_name", "retention_days", "timestamp_column", "note", "updated_at") values ('auth_attempts', 30, 'created_at', null, '2026-07-30T18:31:05.791934+00:00') on conflict do nothing;

-- landing_content (2 registros)
insert into public.landing_content ("key", "data", "updated_at", "updated_by") values ('hero', '{"copy": {"badge": "1 plataforma · 10 ferramentas de retenção", "bullets": ["Sem cartão de crédito", "Configure em 5 minutos", "Planos a partir de {preco}/mês"], "subtitle": "Fidelidade digital, cardápio, catálogo, avaliações, QR Code, push e CRM — num só painel. Sem app, sem cartão de papel.", "primaryCta": {"href": "#precos", "label": "Escolher meu plano"}, "titlePrefix": "Tudo que seu negócio precisa para o", "secondaryCta": {"href": "#ecossistema", "label": "Ver como funciona"}, "titleHighlight": "cliente voltar"}, "menu": {"title": "Cardápio em stories", "dishes": [{"img": "/__l5e/assets-v1/7223428b-3b09-49de-871c-0a7f29efa722/burgers-especiais.jpg", "desc": "Blend 180g, cheddar e trufa", "name": "Burger Trufado", "price": "R$ 38,90"}, {"img": "/__l5e/assets-v1/6b9a2832-b1d1-40de-a0f3-a95e08bb7544/pizzas-salgadas.jpg", "desc": "Mussarela de búfala e nduja", "name": "Pizza Nduja", "price": "R$ 64,00"}, {"img": "/__l5e/assets-v1/ad51b51e-668b-4e90-a074-88aa382d2e61/acai-especial.jpg", "desc": "Banana, granola e leite ninho", "name": "Açaí 500g", "price": "R$ 24,50"}]}, "catalog": {"title": "Catálogo digital", "products": [{"img": "/__l5e/assets-v1/9ea1babb-f89b-4ebd-aac9-c94ab07a0451/eletronicos-audio.jpg", "name": "Fone Bluetooth", "price": "R$ 189"}, {"img": "/__l5e/assets-v1/d4ad7d8a-33bd-4a5f-97f0-5e6483f1bfef/cosmeticos-skincare.jpg", "name": "Kit Skincare", "price": "R$ 129"}, {"img": "/__l5e/assets-v1/cd5f371f-d6e0-4cb8-9b89-dfe358b9bf3c/moda-calcados.jpg", "name": "Tênis Runner", "price": "R$ 299"}, {"img": "/__l5e/assets-v1/125625d1-a1aa-45cc-8c9b-45914111edd6/otica-oculos-sol.jpg", "name": "Óculos Solar", "price": "R$ 459"}]}}'::jsonb, '2026-07-31T00:14:25.33624+00:00', 'c7fd0e83-424e-40ec-8c28-48d4998e58a0') on conflict do nothing;
insert into public.landing_content ("key", "data", "updated_at", "updated_by") values ('brands', '{"title": "As marcas que mais crescem no mundo já descobriram o poder da fidelização.", "brands": [{"name": "Cimed"}, {"name": "Mansão Maromba"}, {"name": "Renner"}, {"name": "Nike"}, {"name": "Adidas"}, {"name": "WePink"}, {"name": "Ray-Ban"}, {"name": "Apple"}], "subtitle": "Agora, é a sua vez."}'::jsonb, '2026-07-31T00:14:25.33624+00:00', 'c7fd0e83-424e-40ec-8c28-48d4998e58a0') on conflict do nothing;

-- system_email_settings (1 registros)
insert into public.system_email_settings ("id", "resend_api_key", "sender_email", "sender_name", "reply_to", "singleton", "created_at", "updated_at") values ('259a8372-2487-4710-8217-94e6292b6a41', 're_EB2k8rpX_M71NycSudm18fspLiskxnJQw', 'fidelize@afidelize.app', 'Fidelize', null, true, '2026-07-18T20:28:48.365831+00:00', '2026-07-22T03:52:21.857283+00:00') on conflict do nothing;

-- support_quick_replies (5 registros)
insert into public.support_quick_replies ("id", "shortcut", "title", "body", "created_by", "created_at", "updated_at") values ('3bc678a6-d6b9-419d-ad31-a265eb8522dd', '/recebido', 'Recebemos seu chamado', 'Olá! Recebemos seu chamado e nossa equipe já está analisando. Em breve retornaremos com uma resposta.', null, '2026-07-18T20:26:58.779647+00:00', '2026-07-18T20:26:58.779647+00:00') on conflict do nothing;
insert into public.support_quick_replies ("id", "shortcut", "title", "body", "created_by", "created_at", "updated_at") values ('cc361c92-c946-4425-a7ea-5d3c14661627', '/detalhes', 'Mais detalhes', 'Poderia nos enviar mais detalhes sobre o ocorrido (prints, horário, passos que reproduzem o problema)? Isso agiliza a resolução.', null, '2026-07-18T20:26:58.779647+00:00', '2026-07-18T20:26:58.779647+00:00') on conflict do nothing;
insert into public.support_quick_replies ("id", "shortcut", "title", "body", "created_by", "created_at", "updated_at") values ('6f9415a5-d878-4396-aafc-158b44090c6e', '/testar', 'Corrigido — testar', 'O problema foi corrigido. Poderia testar novamente e nos confirmar se está tudo certo?', null, '2026-07-18T20:26:58.779647+00:00', '2026-07-18T20:26:58.779647+00:00') on conflict do nothing;
insert into public.support_quick_replies ("id", "shortcut", "title", "body", "created_by", "created_at", "updated_at") values ('df834caa-74b8-4c7b-8041-bd96a3954486', '/concluido', 'Chamado concluído', 'Seu chamado foi concluído com sucesso. Se precisar de mais alguma coisa, é só abrir um novo ticket.', null, '2026-07-18T20:26:58.779647+00:00', '2026-07-18T20:26:58.779647+00:00') on conflict do nothing;
insert into public.support_quick_replies ("id", "shortcut", "title", "body", "created_by", "created_at", "updated_at") values ('cdb1bc66-e6e8-4ce5-8946-669dd43b7fe2', '/encaminhado', 'Encaminhado ao setor', 'Estamos encaminhando seu chamado para o setor responsável. Assim que houver retorno, avisamos por aqui.', null, '2026-07-18T20:26:58.779647+00:00', '2026-07-18T20:26:58.779647+00:00') on conflict do nothing;

-- FIM DO SCHEMA
