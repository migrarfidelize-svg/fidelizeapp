-- 1. Remoção de políticas públicas antigas ou permissivas para garantir um estado limpo
DROP POLICY IF EXISTS est_public_read ON establishments;
DROP POLICY IF EXISTS restaurant_menus_public_read_published ON restaurant_menus;
DROP POLICY IF EXISTS menu_categories_public_read ON menu_categories;
DROP POLICY IF EXISTS menu_items_public_read ON menu_items;

-- 2. Criação de Views Públicas Restritas (Expondo apenas colunas seguras)
CREATE OR REPLACE VIEW public.view_establishments AS
SELECT 
    id, slug, name, description, address, phone, whatsapp, instagram, 
    logo_url, cover_url, primary_color, accent_color, active, updated_at
FROM public.establishments
WHERE active = true;

CREATE OR REPLACE VIEW public.view_restaurant_menus AS
SELECT 
    id, establishment_id, kind, status, display_name, tagline, 
    cover_url, logo_url, theme, hours, updated_at
FROM public.restaurant_menus
WHERE status = 'published';

CREATE OR REPLACE VIEW public.view_menu_categories AS
SELECT 
    c.id, c.menu_id, c.establishment_id, c.name, c.description, 
    c.image_url, c.position, c.active, c.featured, c.updated_at
FROM public.menu_categories c
JOIN public.restaurant_menus m ON c.menu_id = m.id
WHERE c.active = true AND m.status = 'published';

CREATE OR REPLACE VIEW public.view_menu_items AS
SELECT 
    i.id, i.menu_id, i.category_id, i.establishment_id, i.name, i.short_desc, 
    i.long_desc, i.price, i.promo_price, i.currency, i.image_url, i.video_url, 
    i.video_poster_url, i.prep_minutes, i.active, i.badges, i.ingredients, 
    i.allergens, i.variants, i.sku, i.brand, i.stock_status, i.gallery, i.updated_at
FROM public.menu_items i
JOIN public.restaurant_menus m ON i.menu_id = m.id
WHERE i.active = true AND m.status = 'published';

-- 3. Concessão de Acesso (GRANT) apenas nas Views para o papel 'anon'
-- As tabelas base permanecem protegidas por RLS para o papel 'anon' (sem políticas de SELECT)
GRANT SELECT ON public.view_establishments TO anon, authenticated;
GRANT SELECT ON public.view_restaurant_menus TO anon, authenticated;
GRANT SELECT ON public.view_menu_categories TO anon, authenticated;
GRANT SELECT ON public.view_menu_items TO anon, authenticated;

-- 4. RPC Segura com SECURITY DEFINER para busca atômica (Opcional mas recomendada)
CREATE OR REPLACE FUNCTION public.get_public_catalogo_v1(p_slug text, p_kind text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_est_id uuid;
    v_result json;
BEGIN
    -- Validar kind
    IF p_kind NOT IN ('menu', 'catalog') THEN
        RETURN NULL;
    END IF;

    -- Buscar ID do estabelecimento ativo
    SELECT id INTO v_est_id FROM establishments WHERE slug = p_slug AND active = true;
    
    IF v_est_id IS NULL THEN
        RETURN NULL;
    END IF;

    WITH menu_data AS (
        SELECT * FROM view_restaurant_menus 
        WHERE establishment_id = v_est_id AND kind = p_kind::menu_kind
        LIMIT 1
    ),
    categories_data AS (
        SELECT * FROM view_menu_categories 
        WHERE menu_id IN (SELECT id FROM menu_data)
        ORDER BY position ASC
    ),
    items_data AS (
        SELECT * FROM view_menu_items 
        WHERE menu_id IN (SELECT id FROM menu_data)
        ORDER BY position ASC
    )
    SELECT json_build_object(
        'establishment', (SELECT row_to_json(e) FROM (SELECT * FROM view_establishments WHERE id = v_est_id) e),
        'menu', (SELECT row_to_json(m) FROM menu_data m),
        'categories', (SELECT json_agg(c) FROM categories_data c),
        'items', (SELECT json_agg(i) FROM items_data i)
    ) INTO v_result;

    RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_catalogo_v1(text, text) TO anon, authenticated;