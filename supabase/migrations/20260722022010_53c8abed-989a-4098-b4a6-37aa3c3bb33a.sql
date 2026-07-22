
-- Global external links (fixed per company) — reuses existing establishments row
ALTER TABLE public.establishments
  ADD COLUMN IF NOT EXISTS external_links jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Promotions table
CREATE TABLE IF NOT EXISTS public.promotions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id uuid NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text,
  media jsonb NOT NULL DEFAULT '[]'::jsonb,
  external_links jsonb NOT NULL DEFAULT '[]'::jsonb,
  active boolean NOT NULL DEFAULT true,
  starts_at timestamptz,
  ends_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT promotions_media_max_5 CHECK (jsonb_array_length(media) <= 5),
  CONSTRAINT promotions_links_max_10 CHECK (jsonb_array_length(external_links) <= 10),
  CONSTRAINT promotions_title_len CHECK (char_length(title) BETWEEN 1 AND 120)
);

CREATE INDEX IF NOT EXISTS idx_promotions_est_active
  ON public.promotions (establishment_id, active, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.promotions TO authenticated;
GRANT SELECT ON public.promotions TO anon;
GRANT ALL ON public.promotions TO service_role;

ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;

-- Public read: active promotions belonging to active establishments,
-- inside display window.
CREATE POLICY "Public reads active promotions"
  ON public.promotions FOR SELECT
  TO anon, authenticated
  USING (
    active = true
    AND (starts_at IS NULL OR starts_at <= now())
    AND (ends_at IS NULL OR ends_at >= now())
    AND EXISTS (
      SELECT 1 FROM public.establishments e
      WHERE e.id = establishment_id AND e.active = true
    )
  );

-- Members read all their own establishment's promotions (including inactive)
CREATE POLICY "Members read own promotions"
  ON public.promotions FOR SELECT
  TO authenticated
  USING (public.has_establishment_access(auth.uid(), establishment_id));

CREATE POLICY "Managers insert promotions"
  ON public.promotions FOR INSERT
  TO authenticated
  WITH CHECK (public.has_establishment_role(auth.uid(), establishment_id, 'manager'));

CREATE POLICY "Managers update promotions"
  ON public.promotions FOR UPDATE
  TO authenticated
  USING (public.has_establishment_role(auth.uid(), establishment_id, 'manager'))
  WITH CHECK (public.has_establishment_role(auth.uid(), establishment_id, 'manager'));

CREATE POLICY "Managers delete promotions"
  ON public.promotions FOR DELETE
  TO authenticated
  USING (public.has_establishment_role(auth.uid(), establishment_id, 'manager'));

CREATE TRIGGER promotions_set_updated_at
  BEFORE UPDATE ON public.promotions
  FOR EACH ROW EXECUTE FUNCTION public.tg_updated_at();

-- Storage policies for private "promotions" bucket.
-- Path convention: "<establishment_id>/<uuid>.<ext>"
CREATE POLICY "Members write own est promotions media"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'promotions'
    AND public.has_establishment_role(
      auth.uid(),
      (regexp_split_to_array(name, '/'))[1]::uuid,
      'manager'
    )
  );

CREATE POLICY "Members update own est promotions media"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'promotions'
    AND public.has_establishment_role(
      auth.uid(),
      (regexp_split_to_array(name, '/'))[1]::uuid,
      'manager'
    )
  );

CREATE POLICY "Members delete own est promotions media"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'promotions'
    AND public.has_establishment_role(
      auth.uid(),
      (regexp_split_to_array(name, '/'))[1]::uuid,
      'manager'
    )
  );

-- Read: any signed-in user can read (we serve via signed URLs anyway,
-- but this allows the merchant preview to load the media directly).
CREATE POLICY "Authenticated read promotions media"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'promotions');
