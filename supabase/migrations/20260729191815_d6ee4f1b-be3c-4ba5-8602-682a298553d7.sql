
CREATE TABLE public.ai_analyses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  establishment_id UUID NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  surface TEXT NOT NULL CHECK (surface IN ('menu','catalog')),
  target_id UUID,
  overall_score INTEGER NOT NULL DEFAULT 0 CHECK (overall_score BETWEEN 0 AND 100),
  scores_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  findings_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  tokens_used INTEGER NOT NULL DEFAULT 0,
  model TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_ai_analyses_est_surface ON public.ai_analyses(establishment_id, surface, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_analyses TO authenticated;
GRANT ALL ON public.ai_analyses TO service_role;
ALTER TABLE public.ai_analyses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ai_analyses_select" ON public.ai_analyses FOR SELECT TO authenticated
  USING (public.has_establishment_access(auth.uid(), establishment_id));
CREATE POLICY "ai_analyses_insert" ON public.ai_analyses FOR INSERT TO authenticated
  WITH CHECK (public.has_establishment_access(auth.uid(), establishment_id));
CREATE POLICY "ai_analyses_update" ON public.ai_analyses FOR UPDATE TO authenticated
  USING (public.has_establishment_access(auth.uid(), establishment_id));
CREATE POLICY "ai_analyses_delete" ON public.ai_analyses FOR DELETE TO authenticated
  USING (public.has_establishment_role(auth.uid(), establishment_id, 'manager'));

CREATE TABLE public.ai_findings_state (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  analysis_id UUID NOT NULL REFERENCES public.ai_analyses(id) ON DELETE CASCADE,
  establishment_id UUID NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  finding_key TEXT NOT NULL,
  target_type TEXT,
  target_id UUID,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','applied','ignored','edited')),
  applied_payload JSONB,
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(analysis_id, finding_key)
);
CREATE INDEX idx_ai_findings_est ON public.ai_findings_state(establishment_id, status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_findings_state TO authenticated;
GRANT ALL ON public.ai_findings_state TO service_role;
ALTER TABLE public.ai_findings_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ai_findings_state_all" ON public.ai_findings_state FOR ALL TO authenticated
  USING (public.has_establishment_access(auth.uid(), establishment_id))
  WITH CHECK (public.has_establishment_access(auth.uid(), establishment_id));
CREATE TRIGGER trg_ai_findings_state_updated
  BEFORE UPDATE ON public.ai_findings_state
  FOR EACH ROW EXECUTE FUNCTION public.tg_updated_at();

CREATE TABLE public.ai_usage (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  establishment_id UUID NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  surface TEXT NOT NULL CHECK (surface IN ('menu','catalog')),
  kind TEXT NOT NULL CHECK (kind IN ('analysis','import','describe','combo','image')),
  units INTEGER NOT NULL DEFAULT 1,
  tokens INTEGER NOT NULL DEFAULT 0,
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_ai_usage_est_month ON public.ai_usage(establishment_id, surface, created_at DESC);
GRANT SELECT, INSERT ON public.ai_usage TO authenticated;
GRANT ALL ON public.ai_usage TO service_role;
ALTER TABLE public.ai_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ai_usage_select" ON public.ai_usage FOR SELECT TO authenticated
  USING (public.has_establishment_access(auth.uid(), establishment_id));
CREATE POLICY "ai_usage_insert" ON public.ai_usage FOR INSERT TO authenticated
  WITH CHECK (public.has_establishment_access(auth.uid(), establishment_id));

ALTER TABLE public.menu_items ADD COLUMN IF NOT EXISTS ai_hash TEXT;
ALTER TABLE public.menu_items ADD COLUMN IF NOT EXISTS ai_analyzed_at TIMESTAMPTZ;

INSERT INTO public.plan_features (plan_id, feature_key, feature_name, enabled)
SELECT p.id, k.feature_key, k.feature_name, true
FROM public.plans p
CROSS JOIN (VALUES
  ('menu.ai', 'Inteligência de Cardápio com IA'),
  ('catalog.ai', 'Inteligência de Catálogo com IA')
) AS k(feature_key, feature_name)
WHERE p.tier IN ('pro','enterprise')
ON CONFLICT DO NOTHING;

INSERT INTO public.plan_features (plan_id, feature_key, feature_name, enabled)
SELECT p.id, k.feature_key, k.feature_name, false
FROM public.plans p
CROSS JOIN (VALUES
  ('menu.ai', 'Inteligência de Cardápio com IA'),
  ('catalog.ai', 'Inteligência de Catálogo com IA')
) AS k(feature_key, feature_name)
WHERE p.tier IN ('free','starter')
ON CONFLICT DO NOTHING;
