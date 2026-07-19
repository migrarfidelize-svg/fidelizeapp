
-- Monthly goals per establishment for MoM tracking
CREATE TABLE public.establishment_goals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  establishment_id UUID NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  month DATE NOT NULL, -- first day of month (yyyy-mm-01)
  stamps_goal INT NOT NULL DEFAULT 0,
  customers_goal INT NOT NULL DEFAULT 0,
  rewards_goal INT NOT NULL DEFAULT 0,
  revenue_goal NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (establishment_id, month)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.establishment_goals TO authenticated;
GRANT ALL ON public.establishment_goals TO service_role;

ALTER TABLE public.establishment_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read goals"
  ON public.establishment_goals FOR SELECT TO authenticated
  USING (public.has_establishment_access(auth.uid(), establishment_id));

CREATE POLICY "managers manage goals"
  ON public.establishment_goals FOR ALL TO authenticated
  USING (public.has_establishment_role(auth.uid(), establishment_id, 'manager'))
  WITH CHECK (public.has_establishment_role(auth.uid(), establishment_id, 'manager'));

CREATE TRIGGER trg_goals_updated_at BEFORE UPDATE ON public.establishment_goals
  FOR EACH ROW EXECUTE FUNCTION public.tg_updated_at();

CREATE INDEX idx_goals_est_month ON public.establishment_goals (establishment_id, month DESC);
