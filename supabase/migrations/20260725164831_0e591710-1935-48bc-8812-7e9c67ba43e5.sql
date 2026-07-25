
CREATE TABLE public.qr_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id uuid NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  code text NOT NULL UNIQUE,
  label text NOT NULL,
  location text,
  destination text CHECK (destination IN ('reviews','linktree','landing')),
  active boolean NOT NULL DEFAULT true,
  scans_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT qr_tags_code_format CHECK (code ~ '^[a-z0-9]{4,16}$'),
  CONSTRAINT qr_tags_label_len CHECK (char_length(label) BETWEEN 1 AND 80),
  CONSTRAINT qr_tags_location_len CHECK (location IS NULL OR char_length(location) <= 80)
);

CREATE INDEX qr_tags_est_idx ON public.qr_tags(establishment_id, created_at DESC);
CREATE INDEX qr_tags_code_idx ON public.qr_tags(code);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.qr_tags TO authenticated;
GRANT ALL ON public.qr_tags TO service_role;

ALTER TABLE public.qr_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "qr_tags select by members"
ON public.qr_tags FOR SELECT
TO authenticated
USING (
  public.has_establishment_role(auth.uid(), qr_tags.establishment_id, 'staff'::member_role)
  OR public.is_super_admin(auth.uid())
);

CREATE POLICY "qr_tags insert by staff+"
ON public.qr_tags FOR INSERT
TO authenticated
WITH CHECK (
  public.has_establishment_role(auth.uid(), qr_tags.establishment_id, 'staff'::member_role)
  OR public.is_super_admin(auth.uid())
);

CREATE POLICY "qr_tags update by staff+"
ON public.qr_tags FOR UPDATE
TO authenticated
USING (
  public.has_establishment_role(auth.uid(), qr_tags.establishment_id, 'staff'::member_role)
  OR public.is_super_admin(auth.uid())
)
WITH CHECK (
  public.has_establishment_role(auth.uid(), qr_tags.establishment_id, 'staff'::member_role)
  OR public.is_super_admin(auth.uid())
);

CREATE POLICY "qr_tags delete by manager+"
ON public.qr_tags FOR DELETE
TO authenticated
USING (
  public.has_establishment_role(auth.uid(), qr_tags.establishment_id, 'manager'::member_role)
  OR public.is_super_admin(auth.uid())
);

CREATE TRIGGER qr_tags_updated_at
BEFORE UPDATE ON public.qr_tags
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
