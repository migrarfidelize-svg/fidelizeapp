
CREATE OR REPLACE FUNCTION public.compute_tier(_visits int, _thresholds jsonb)
RETURNS public.customer_tier
LANGUAGE plpgsql IMMUTABLE
SET search_path = public
AS $$
DECLARE
  t public.customer_tier := 'bronze';
BEGIN
  IF _visits >= COALESCE((_thresholds->>'diamante')::int, 50) THEN RETURN 'diamante'; END IF;
  IF _visits >= COALESCE((_thresholds->>'ouro')::int, 25) THEN RETURN 'ouro'; END IF;
  IF _visits >= COALESCE((_thresholds->>'prata')::int, 10) THEN RETURN 'prata'; END IF;
  RETURN 'bronze';
END; $$;

REVOKE EXECUTE ON FUNCTION public.compute_tier(int, jsonb) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.tg_recompute_tier_after_stamp() FROM PUBLIC, anon;
