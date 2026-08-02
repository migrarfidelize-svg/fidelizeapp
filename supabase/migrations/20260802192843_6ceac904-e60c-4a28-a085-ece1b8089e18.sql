-- 1) customer_reviews: no PII for anonymous visitors
DROP POLICY IF EXISTS "Public can read non-hidden reviews of active establishments" ON public.customer_reviews;
CREATE POLICY "Anon can read non-hidden reviews of active establishments"
ON public.customer_reviews FOR SELECT TO anon
USING (
  public_hidden = false
  AND EXISTS (SELECT 1 FROM public.establishments e WHERE e.id = customer_reviews.establishment_id AND e.active = true)
);

REVOKE SELECT ON public.customer_reviews FROM anon;
GRANT SELECT (id, establishment_id, review_form_id, rating, comment, anonymous, source, status,
              submitted_at, created_at, merchant_reply, merchant_reply_at, public_hidden)
  ON public.customer_reviews TO anon;

-- 2) establishments: hide legal/contact PII from anonymous visitors
REVOKE SELECT ON public.establishments FROM anon;
GRANT SELECT (id, slug, name, description, address, whatsapp, instagram, business_hours,
              logo_url, cover_url, primary_color, accent_color, theme, active, segment,
              website, city, state, cep, facebook, tiktok, google_maps_url, timezone,
              external_links, qr_destination, created_at)
  ON public.establishments TO anon;

-- 3) SECURITY DEFINER functions must not be callable by anonymous visitors
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig, p.proname
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', r.sig);
    -- trigger functions stay owner-only; they run inside triggers regardless of grants
    IF r.proname LIKE 'tg\_%' OR r.proname IN ('handle_new_user','purge_expired_logs','mark_past_due_subscriptions','sponsored_ads_admin_overview','get_sponsored_ads_for_discovery','register_sponsored_ad_event') THEN
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM authenticated', r.sig);
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', r.sig);
    ELSE
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', r.sig);
    END IF;
  END LOOP;
END $$;