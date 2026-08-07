-- Fix dashboard_summary to use unlocked_at instead of created_at for rewards table
-- This column was incorrectly referenced as r.created_at in the previous migration.

BEGIN;

CREATE OR REPLACE FUNCTION public.dashboard_summary(_est uuid, _cutoff timestamptz)
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
  -- Strict cutoff enforcement.
  IF _cutoff IS NULL THEN
    RAISE EXCEPTION 'Production cutoff timestamp is required';
  END IF;

  SELECT jsonb_build_object(
    -- Novos clientes desde o marco zero
    'customersCount', (SELECT count(*) FROM customers c WHERE c.establishment_id = _est AND c.created_at >= _cutoff),
    
    -- Métricas operacionais pós-lançamento
    'stampsCount',    (SELECT count(*) FROM stamps s WHERE s.establishment_id = _est AND s.reverted_at IS NULL AND s.created_at >= _cutoff),
    'rewardsCount',   (SELECT count(*) FROM rewards r WHERE r.establishment_id = _est AND r.unlocked_at >= _cutoff),
    'redeemedCount',  (SELECT count(*) FROM rewards r WHERE r.establishment_id = _est AND r.redeemed_at IS NOT NULL AND r.redeemed_at >= _cutoff),
    
    'mom', jsonb_build_object(
      'customers', jsonb_build_object(
        'current',  (SELECT count(*) FROM customers c WHERE c.establishment_id = _est AND c.created_at >= GREATEST(v_month_start, _cutoff)),
        'previous', (SELECT count(*) FROM customers c WHERE c.establishment_id = _est AND c.created_at >= GREATEST(v_prev_start, _cutoff) AND c.created_at < v_month_start)
      ),
      'stamps', jsonb_build_object(
        'current',  (SELECT count(*) FROM stamps s WHERE s.establishment_id = _est AND s.reverted_at IS NULL AND s.created_at >= GREATEST(v_month_start, _cutoff)),
        'previous', (SELECT count(*) FROM stamps s WHERE s.establishment_id = _est AND s.reverted_at IS NULL AND s.created_at >= GREATEST(v_prev_start, _cutoff) AND s.created_at < v_month_start)
      ),
      'rewards', jsonb_build_object(
        'current',  (SELECT count(*) FROM rewards r WHERE r.establishment_id = _est AND r.redeemed_at >= GREATEST(v_month_start, _cutoff)),
        'previous', (SELECT count(*) FROM rewards r WHERE r.establishment_id = _est AND r.redeemed_at >= GREATEST(v_prev_start, _cutoff) AND r.redeemed_at < v_month_start)
      )
    ),
    
    -- TOP CUSTOMERS: Baseado em atividade REAL pós-cutoff
    'topCustomers', COALESCE((
      SELECT jsonb_agg(t) FROM (
        SELECT c.id, c.name, count(s.id) as visits_count, max(s.created_at) as last_visit_at
        FROM customers c
        JOIN stamps s ON s.customer_id = c.id
        WHERE c.establishment_id = _est 
          AND s.establishment_id = _est
          AND s.reverted_at IS NULL
          AND s.created_at >= _cutoff
        GROUP BY c.id, c.name
        ORDER BY count(s.id) DESC
        LIMIT 6
      ) t
    ), '[]'::jsonb),
    
    'daily', COALESCE((
      SELECT jsonb_object_agg(d, n) FROM (
        SELECT to_char(s.created_at, 'YYYY-MM-DD') AS d, count(*) AS n
        FROM stamps s
        WHERE s.establishment_id = _est AND s.reverted_at IS NULL AND s.created_at >= GREATEST(v_since, _cutoff)
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

-- Ensure grants are correct (already service_role only, but reapplying to be sure)
REVOKE ALL ON FUNCTION public.dashboard_summary(uuid, timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.dashboard_summary(uuid, timestamptz) FROM anon;
REVOKE ALL ON FUNCTION public.dashboard_summary(uuid, timestamptz) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.dashboard_summary(uuid, timestamptz) TO service_role;

COMMIT;
