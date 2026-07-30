CREATE OR REPLACE FUNCTION public.dashboard_summary(_est uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path TO 'public'
AS $$
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
$$;

REVOKE ALL ON FUNCTION public.dashboard_summary(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dashboard_summary(uuid) TO authenticated, service_role;
