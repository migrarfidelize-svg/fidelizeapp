BEGIN;

-- 1. Hardening: Revogação com assinatura real
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname = 'get_sponsored_ads_for_discovery') THEN
        REVOKE ALL ON FUNCTION public.get_sponsored_ads_for_discovery(text, text, integer) FROM PUBLIC, anon, authenticated;
    END IF;

    IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname = 'sponsored_ads_admin_overview') THEN
        REVOKE ALL ON FUNCTION public.sponsored_ads_admin_overview() FROM PUBLIC, anon, authenticated;
    END IF;
END $$;

-- 2. Colunas
ALTER TABLE public.sponsored_ad_campaigns ALTER COLUMN establishment_id DROP NOT NULL;

ALTER TABLE public.sponsored_ad_campaigns 
    ADD COLUMN IF NOT EXISTS origin TEXT DEFAULT 'merchant',
    ADD COLUMN IF NOT EXISTS campaign_type TEXT DEFAULT 'establishment',
    ADD COLUMN IF NOT EXISTS slot_id TEXT DEFAULT 'discover_feed',
    ADD COLUMN IF NOT EXISTS display_model TEXT DEFAULT 'sponsored_feed',
    ADD COLUMN IF NOT EXISTS theme TEXT DEFAULT 'premium_dark',
    ADD COLUMN IF NOT EXISTS offer_type TEXT DEFAULT 'benefit',
    ADD COLUMN IF NOT EXISTS original_price_cents INTEGER,
    ADD COLUMN IF NOT EXISTS fidelize_price_cents INTEGER,
    ADD COLUMN IF NOT EXISTS discount_label TEXT,
    ADD COLUMN IF NOT EXISTS discount_value INTEGER,
    ADD COLUMN IF NOT EXISTS benefit_text TEXT,
    ADD COLUMN IF NOT EXISTS video_path TEXT,
    ADD COLUMN IF NOT EXISTS hide_title BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS hide_description BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS hide_merchant_name BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS hide_prices BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS hide_logo BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS hide_cta BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS full_bleed_mode BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS priority INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0;

UPDATE public.sponsored_ad_campaigns SET 
    origin = COALESCE(origin, 'merchant'),
    campaign_type = COALESCE(campaign_type, 'establishment'),
    slot_id = COALESCE(slot_id, 'discover_feed'),
    display_model = COALESCE(display_model, 'sponsored_feed'),
    theme = COALESCE(theme, 'premium_dark'),
    offer_type = COALESCE(offer_type, 'benefit'),
    hide_title = COALESCE(hide_title, false),
    hide_description = COALESCE(hide_description, false),
    hide_merchant_name = COALESCE(hide_merchant_name, false),
    hide_prices = COALESCE(hide_prices, false),
    hide_logo = COALESCE(hide_logo, false),
    hide_cta = COALESCE(hide_cta, false),
    full_bleed_mode = COALESCE(full_bleed_mode, false),
    priority = COALESCE(priority, 0),
    display_order = COALESCE(display_order, 0);

ALTER TABLE public.sponsored_ad_campaigns 
    ALTER COLUMN origin SET NOT NULL,
    ALTER COLUMN campaign_type SET NOT NULL,
    ALTER COLUMN slot_id SET NOT NULL,
    ALTER COLUMN display_model SET NOT NULL,
    ALTER COLUMN theme SET NOT NULL,
    ALTER COLUMN offer_type SET NOT NULL,
    ALTER COLUMN hide_title SET NOT NULL,
    ALTER COLUMN hide_description SET NOT NULL,
    ALTER COLUMN hide_merchant_name SET NOT NULL,
    ALTER COLUMN hide_prices SET NOT NULL,
    ALTER COLUMN hide_logo SET NOT NULL,
    ALTER COLUMN hide_cta SET NOT NULL,
    ALTER COLUMN full_bleed_mode SET NOT NULL,
    ALTER COLUMN priority SET NOT NULL,
    ALTER COLUMN display_order SET NOT NULL;

-- 3. Reviews
CREATE TABLE IF NOT EXISTS public.sponsored_ad_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID REFERENCES public.sponsored_ad_campaigns(id) ON DELETE CASCADE,
    admin_user_id UUID REFERENCES auth.users(id),
    action TEXT NOT NULL,
    from_status TEXT,
    to_status TEXT,
    reason TEXT,
    internal_notes TEXT,
    creative_snapshot JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

REVOKE ALL ON public.sponsored_ad_reviews FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.sponsored_ad_reviews TO service_role;
ALTER TABLE public.sponsored_ad_reviews ENABLE ROW LEVEL SECURITY;

-- 4. Constraints
ALTER TABLE public.sponsored_ad_campaigns 
    DROP CONSTRAINT IF EXISTS ads_origin_check,
    DROP CONSTRAINT IF EXISTS ads_type_check,
    DROP CONSTRAINT IF EXISTS ads_slot_check,
    DROP CONSTRAINT IF EXISTS ads_model_check,
    DROP CONSTRAINT IF EXISTS ads_offer_check,
    DROP CONSTRAINT IF EXISTS ads_price_check,
    DROP CONSTRAINT IF EXISTS ads_consistency_check;

ALTER TABLE public.sponsored_ad_campaigns
    ADD CONSTRAINT ads_origin_check CHECK (origin IN ('merchant', 'admin')),
    ADD CONSTRAINT ads_type_check CHECK (campaign_type IN ('establishment', 'institutional')),
    ADD CONSTRAINT ads_slot_check CHECK (slot_id IN ('discover_feed', 'premium_hero', 'sidebar_rail', 'home_featured')),
    ADD CONSTRAINT ads_model_check CHECK (display_model IN ('premium_banner', 'sponsored_feed', 'carousel')),
    ADD CONSTRAINT ads_offer_check CHECK (offer_type IN ('discount', 'percentage', 'savings', 'benefit', 'loyalty', 'reward', 'institutional')),
    ADD CONSTRAINT ads_price_check CHECK (
        (original_price_cents IS NULL OR original_price_cents >= 0) AND 
        (fidelize_price_cents IS NULL OR fidelize_price_cents >= 0) AND
        (
            (offer_type = 'discount' AND original_price_cents IS NOT NULL AND fidelize_price_cents IS NOT NULL AND fidelize_price_cents <= original_price_cents) OR
            (offer_type != 'discount')
        )
    ),
    ADD CONSTRAINT ads_consistency_check CHECK (
        (campaign_type = 'establishment' AND establishment_id IS NOT NULL) OR
        (campaign_type = 'institutional' AND establishment_id IS NULL AND origin = 'admin')
    );

-- 5. Novas RPCs
CREATE OR REPLACE FUNCTION public.get_sponsored_ads_public_v2(
    _slot_id text,
    _category text DEFAULT NULL,
    _session_hash text DEFAULT NULL,
    _limit integer DEFAULT 3
)
RETURNS TABLE (
    campaign_id uuid,
    tracking_token text,
    title text,
    description text,
    cta_label text,
    destination_type text,
    destination_slug text,
    category_id text,
    establishment_name text,
    establishment_slug text,
    establishment_logo_url text,
    establishment_primary_color text,
    display_model text,
    theme text,
    offer_type text,
    original_price_cents integer,
    fidelize_price_cents integer,
    discount_label text,
    discount_value integer,
    benefit_text text,
    video_path text,
    hide_title boolean,
    hide_description boolean,
    hide_merchant_name boolean,
    hide_prices boolean,
    hide_logo boolean,
    hide_cta boolean,
    full_bleed_mode boolean
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    final_limit integer;
    inst_name text;
    inst_logo text;
    inst_color text;
BEGIN
    final_limit := LEAST(GREATEST(COALESCE(_limit, 3), 1), 50);

    SELECT value INTO inst_name FROM system_settings WHERE namespace = 'branding' AND key = 'brand_name' AND enabled = true LIMIT 1;
    SELECT value INTO inst_logo FROM system_settings WHERE namespace = 'branding' AND key = 'brand_logo_url' AND enabled = true LIMIT 1;
    SELECT value INTO inst_color FROM system_settings WHERE namespace = 'branding' AND key = 'brand_primary_color' AND enabled = true LIMIT 1;

    RETURN QUERY
    SELECT 
        c.id,
        encode(digest(c.id::text || COALESCE(_session_hash, 'anon') || now()::date::text, 'sha256'), 'hex'),
        c.title,
        c.description,
        c.cta_label,
        c.destination_type,
        c.destination_slug,
        c.category_id,
        COALESCE(e.name, inst_name),
        COALESCE(e.slug, 'afidelize'),
        COALESCE(e.logo_url, inst_logo),
        COALESCE(e.primary_color, inst_color, '#6366f1'),
        c.display_model,
        c.theme,
        c.offer_type,
        c.original_price_cents,
        c.fidelize_price_cents,
        c.discount_label,
        c.discount_value,
        c.benefit_text,
        c.video_path,
        c.hide_title,
        c.hide_description,
        c.hide_merchant_name,
        c.hide_prices,
        c.hide_logo,
        c.hide_cta,
        c.full_bleed_mode
    FROM sponsored_ad_campaigns c
    LEFT JOIN establishments e ON c.establishment_id = e.id
    WHERE c.status = 'active'
      AND c.slot_id = _slot_id
      AND (c.starts_at IS NULL OR c.starts_at <= now())
      AND (c.ends_at IS NULL OR c.ends_at >= now())
      AND c.paused_at IS NULL
      AND (_category IS NULL OR _category = '' OR c.category_id = _category)
    ORDER BY c.priority DESC, c.display_order ASC, c.created_at DESC
    LIMIT final_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.get_sponsored_ads_public_v2(text, text, text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_sponsored_ads_public_v2(text, text, text, integer) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.sponsored_ads_admin_overview_v3()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    result jsonb;
BEGIN
    SELECT jsonb_build_object(
        'stats', (
            SELECT jsonb_build_object(
                'active', count(*) FILTER (WHERE status = 'active'),
                'pending', count(*) FILTER (WHERE status = 'pending_review'),
                'paused', count(*) FILTER (WHERE status = 'paused'),
                'revenue_cents', COALESCE((SELECT sum(amount_cents) FROM sponsored_ad_orders WHERE status = 'paid'), 0)
            ) FROM sponsored_ad_campaigns
        ),
        'recent_reviews', (
            SELECT jsonb_agg(r) FROM (
                SELECT 
                    rv.id, rv.action, rv.from_status, rv.to_status, rv.reason, rv.created_at,
                    c.title as campaign_title,
                    e.name as merchant_name
                FROM sponsored_ad_reviews rv
                JOIN sponsored_ad_campaigns c ON rv.campaign_id = c.id
                LEFT JOIN establishments e ON c.establishment_id = e.id
                ORDER BY rv.created_at DESC
                LIMIT 10
            ) r
        )
    ) INTO result;
    RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.sponsored_ads_admin_overview_v3() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sponsored_ads_admin_overview_v3() TO service_role;

-- 6. Índice
CREATE INDEX IF NOT EXISTS idx_ads_delivery_v3
ON public.sponsored_ad_campaigns (slot_id, status, category_id, priority, display_order)
WHERE status = 'active' AND paused_at IS NULL;

COMMIT;