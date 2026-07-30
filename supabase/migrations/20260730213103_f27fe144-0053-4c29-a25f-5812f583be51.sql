-- customer_reviews: anon só enxerga colunas públicas
REVOKE SELECT ON public.customer_reviews FROM anon;
GRANT SELECT (
  id, establishment_id, review_form_id, rating, comment, customer_name,
  anonymous, status, submitted_at, created_at,
  merchant_reply, merchant_reply_at, public_hidden
) ON public.customer_reviews TO anon;

-- establishments: anon não enxerga dados cadastrais sensíveis
REVOKE SELECT ON public.establishments FROM anon;
GRANT SELECT (
  id, slug, name, description, address, phone, whatsapp, instagram,
  business_hours, logo_url, cover_url, primary_color, accent_color, theme,
  plan, active, website, city, state, cep, facebook, tiktok, google_maps_url,
  timezone, segment, external_links, qr_destination, created_at, updated_at
) ON public.establishments TO anon;