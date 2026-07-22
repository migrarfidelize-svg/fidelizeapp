
CREATE TABLE public.scheduled_pushes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  establishment_id uuid NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text,
  url text,
  segment jsonb NOT NULL DEFAULT '{}'::jsonb,
  scheduled_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','canceled','failed')),
  sent_at timestamptz,
  result jsonb,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_scheduled_pushes_due
  ON public.scheduled_pushes (scheduled_at)
  WHERE status = 'pending';
CREATE INDEX idx_scheduled_pushes_est
  ON public.scheduled_pushes (establishment_id, scheduled_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.scheduled_pushes TO authenticated;
GRANT ALL ON public.scheduled_pushes TO service_role;

ALTER TABLE public.scheduled_pushes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "scheduled_push_manager_read"
  ON public.scheduled_pushes FOR SELECT
  TO authenticated
  USING (public.has_establishment_role(auth.uid(), establishment_id, 'manager'));

CREATE POLICY "scheduled_push_manager_insert"
  ON public.scheduled_pushes FOR INSERT
  TO authenticated
  WITH CHECK (public.has_establishment_role(auth.uid(), establishment_id, 'manager'));

CREATE POLICY "scheduled_push_manager_update"
  ON public.scheduled_pushes FOR UPDATE
  TO authenticated
  USING (public.has_establishment_role(auth.uid(), establishment_id, 'manager'))
  WITH CHECK (public.has_establishment_role(auth.uid(), establishment_id, 'manager'));

CREATE POLICY "scheduled_push_manager_delete"
  ON public.scheduled_pushes FOR DELETE
  TO authenticated
  USING (public.has_establishment_role(auth.uid(), establishment_id, 'manager'));

CREATE TRIGGER trg_scheduled_pushes_updated
  BEFORE UPDATE ON public.scheduled_pushes
  FOR EACH ROW EXECUTE FUNCTION public.tg_updated_at();
