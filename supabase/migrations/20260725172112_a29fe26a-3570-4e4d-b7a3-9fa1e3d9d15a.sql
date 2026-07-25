CREATE TABLE IF NOT EXISTS public.establishment_feature_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id uuid NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  feature_key text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  note text,
  granted_by uuid,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (establishment_id, feature_key)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.establishment_feature_overrides TO authenticated;
GRANT ALL ON public.establishment_feature_overrides TO service_role;

ALTER TABLE public.establishment_feature_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins manage feature overrides"
  ON public.establishment_feature_overrides FOR ALL
  TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "Members can view their overrides"
  ON public.establishment_feature_overrides FOR SELECT
  TO authenticated
  USING (public.has_establishment_access(auth.uid(), establishment_id));

CREATE TRIGGER trg_feature_overrides_updated_at
  BEFORE UPDATE ON public.establishment_feature_overrides
  FOR EACH ROW EXECUTE FUNCTION public.tg_updated_at();

-- Strict plan-only check (publishing keeps using this)
CREATE OR REPLACE FUNCTION public.has_plan_feature_strict(_est uuid, _feature text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((
    SELECT pf.enabled FROM public.plan_features pf
    JOIN public.plans p ON p.id = pf.plan_id
    JOIN public.establishments e ON e.id = _est
    WHERE p.tier = e.plan AND pf.feature_key = _feature
    LIMIT 1
  ), false)
$$;

-- Access check: plan feature OR a valid manual override
CREATE OR REPLACE FUNCTION public.has_plan_feature(_est uuid, _feature text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_plan_feature_strict(_est, _feature)
      OR EXISTS (
        SELECT 1 FROM public.establishment_feature_overrides o
        WHERE o.establishment_id = _est
          AND o.feature_key = _feature
          AND o.enabled = true
          AND (o.expires_at IS NULL OR o.expires_at > now())
      )
$$;

REVOKE EXECUTE ON FUNCTION public.has_plan_feature_strict(uuid, text) FROM anon;