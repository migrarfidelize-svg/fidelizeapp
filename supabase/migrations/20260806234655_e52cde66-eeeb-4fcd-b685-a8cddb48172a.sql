-- 1. Views Públicas v2
CREATE OR REPLACE VIEW public.view_public_establishments_v2 AS
SELECT 
    id, slug, name, description, address, whatsapp, instagram, 
    business_hours, logo_url, cover_url, primary_color, accent_color, 
    theme, active, segment, website, city, state, timezone, updated_at
FROM public.establishments
WHERE active = true;

CREATE OR REPLACE VIEW public.view_public_restaurant_menus_v2 AS
SELECT 
    id, establishment_id, kind, status, display_name, tagline, 
    cover_url, logo_url, theme, hours, closed_message, published_at, updated_at
FROM public.restaurant_menus
WHERE status = 'published';

CREATE OR REPLACE VIEW public.view_public_menu_categories_v2 AS
SELECT 
    c.id, c.menu_id, c.establishment_id, c.name, c.description, 
    c.image_url, c.position, c.active, c.featured, 
    c.available_days, c.available_start, c.available_end, c.updated_at, c.created_at
FROM public.menu_categories c
JOIN public.restaurant_menus m ON c.menu_id = m.id
WHERE c.active = true AND m.status = 'published';

CREATE OR REPLACE VIEW public.view_public_menu_items_v2 AS
SELECT 
    i.id, i.menu_id, i.category_id, i.establishment_id, i.name, i.short_desc, 
    i.long_desc, i.price, i.promo_price, i.currency, i.image_url, i.video_url, 
    i.video_poster_url, i.prep_minutes, i.active, i.badges, i.position,
    i.stock_status, i.gallery, i.updated_at, i.created_at
FROM public.menu_items i
JOIN public.restaurant_menus m ON i.menu_id = m.id
WHERE i.active = true AND m.status = 'published';

-- 2. Revogação de acesso direto
REVOKE ALL ON public.view_public_establishments_v2 FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.view_public_restaurant_menus_v2 FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.view_public_menu_categories_v2 FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.view_public_menu_items_v2 FROM PUBLIC, anon, authenticated;

-- 3. Índice Único parcial
CREATE UNIQUE INDEX IF NOT EXISTS establishments_active_slug_unique
ON public.establishments (pg_catalog.lower(slug))
WHERE active = true;

-- 4. RPC get_public_catalogo_v2
CREATE OR REPLACE FUNCTION public.get_public_catalogo_v2(p_slug text, p_kind text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_slug text;
    v_kind text;
    v_est_id uuid;
    v_menu_id uuid;
    v_result jsonb;
BEGIN
    IF p_slug IS NULL OR p_kind IS NULL THEN
        RETURN NULL;
    END IF;

    v_slug := pg_catalog.lower(pg_catalog.btrim(p_slug));
    v_kind := pg_catalog.lower(pg_catalog.btrim(p_kind));

    IF v_slug = '' OR pg_catalog.length(v_slug) > 100 OR v_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' THEN
        RETURN NULL;
    END IF;

    IF v_kind NOT IN ('menu', 'catalog') THEN
        RETURN NULL;
    END IF;

    SELECT e.id INTO v_est_id
    FROM public.establishments e
    WHERE pg_catalog.lower(e.slug) = v_slug AND e.active = true;
    
    IF NOT FOUND THEN
        RETURN NULL;
    END IF;

    SELECT m.id INTO v_menu_id
    FROM public.view_public_restaurant_menus_v2 m
    WHERE m.establishment_id = v_est_id AND m.kind::pg_catalog.text = v_kind
    ORDER BY 
      m.published_at DESC NULLS LAST, 
      m.updated_at DESC NULLS LAST, 
      m.id DESC
    LIMIT 1;

    IF NOT FOUND THEN
        RETURN NULL;
    END IF;

    SELECT pg_catalog.jsonb_build_object(
        'establishment', (
            SELECT pg_catalog.jsonb_build_object(
                'id', e.id, 'slug', e.slug, 'name', e.name, 'description', e.description,
                'address', e.address, 'whatsapp', e.whatsapp, 'instagram', e.instagram,
                'business_hours', e.business_hours, 'logo_url', e.logo_url, 'cover_url', e.cover_url,
                'primary_color', e.primary_color, 'accent_color', e.accent_color, 'theme', e.theme,
                'city', e.city, 'state', e.state, 'timezone', e.timezone
            ) FROM public.view_public_establishments_v2 e WHERE e.id = v_est_id
        ),
        'menu', (
            SELECT pg_catalog.jsonb_build_object(
                'id', m.id, 'kind', m.kind, 'status', m.status, 'display_name', m.display_name,
                'tagline', m.tagline, 'cover_url', m.cover_url, 'logo_url', m.logo_url,
                'theme', m.theme, 'hours', m.hours, 'closed_message', m.closed_message
            ) FROM public.view_public_restaurant_menus_v2 m WHERE m.id = v_menu_id
        ),
        'categories', (
            SELECT COALESCE(pg_catalog.jsonb_agg(
                pg_catalog.jsonb_build_object(
                    'id', c.id,
                    'name', c.name,
                    'description', c.description,
                    'image_url', c.image_url,
                    'position', c.position,
                    'featured', c.featured,
                    'available_days', c.available_days,
                    'available_start', c.available_start,
                    'available_end', c.available_end
                ) ORDER BY c.position ASC NULLS LAST, c.created_at ASC NULLS LAST, c.id ASC
            ), '[]'::pg_catalog.jsonb)
            FROM public.view_public_menu_categories_v2 c
            WHERE c.menu_id = v_menu_id
        ),
        'items', (
            SELECT COALESCE(pg_catalog.jsonb_agg(
                pg_catalog.jsonb_build_object(
                    'id', i.id,
                    'category_id', i.category_id,
                    'name', i.name,
                    'short_desc', i.short_desc,
                    'long_desc', i.long_desc,
                    'price', i.price,
                    'promo_price', i.promo_price,
                    'currency', i.currency,
                    'image_url', i.image_url,
                    'video_url', i.video_url,
                    'video_poster_url', i.video_poster_url,
                    'prep_minutes', i.prep_minutes,
                    'badges', i.badges,
                    'stock_status', i.stock_status,
                    'gallery', i.gallery,
                    'position', i.position
                ) ORDER BY i.position ASC NULLS LAST, i.created_at ASC NULLS LAST, i.id ASC
            ), '[]'::pg_catalog.jsonb)
            FROM public.view_public_menu_items_v2 i
            WHERE i.menu_id = v_menu_id
        )
    ) INTO v_result;

    RETURN v_result;
END;
$$;

-- 5. Permissões e Owner
REVOKE ALL ON FUNCTION public.get_public_catalogo_v2(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_catalogo_v2(text, text) TO anon, authenticated;
ALTER FUNCTION public.get_public_catalogo_v2(text, text) OWNER TO postgres;

-- 6. Reload schema PostgREST (Opcional, mas garante visibilidade imediata)
NOTIFY pgrst, 'reload schema';