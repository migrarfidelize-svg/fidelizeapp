-- Retorna anúncios elegíveis para a vitrine (projeção pública apenas).
CREATE OR REPLACE FUNCTION public.get_sponsored_ads_for_discovery(
  _category text,
  _session_hash text,
  _limit integer DEFAULT 3
)
RETURNS TABLE (
  campaign_id uuid,
  tracking_token text,
  title text,
  description text,
  image_path text,
  image_source text,
  cta_label text,
  destination_type text,
  destination_slug text,
  category_id text,
  establishment_name text,
  establishment_slug text,
  establishment_logo_url text,
  establishment_primary_color text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
$$;

REVOKE EXECUTE ON FUNCTION public.get_sponsored_ads_for_discovery(text, text, integer) FROM PUBLIC, anon, authenticated;

-- Registra evento com deduplicação e atualiza métrica diária atomicamente.
CREATE OR REPLACE FUNCTION public.register_sponsored_ad_event(
  _token text,
  _event_type text,
  _session_hash text,
  _placement text DEFAULT 'wallet_discover',
  _viewer_user_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
$$;

REVOKE EXECUTE ON FUNCTION public.register_sponsored_ad_event(text, text, text, text, uuid) FROM PUBLIC, anon, authenticated;

-- Métricas globais para o Super Admin.
CREATE OR REPLACE FUNCTION public.sponsored_ads_admin_overview()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
$$;

REVOKE EXECUTE ON FUNCTION public.sponsored_ads_admin_overview() FROM PUBLIC, anon, authenticated;
