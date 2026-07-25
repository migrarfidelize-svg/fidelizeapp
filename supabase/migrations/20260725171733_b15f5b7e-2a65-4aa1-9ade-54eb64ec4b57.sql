ALTER TABLE public.establishments DROP CONSTRAINT IF EXISTS establishments_qr_destination_check;
ALTER TABLE public.establishments
  ADD CONSTRAINT establishments_qr_destination_check
  CHECK (qr_destination IN ('reviews','linktree','landing','menu'));

ALTER TABLE public.qr_tags DROP CONSTRAINT IF EXISTS qr_tags_destination_check;
ALTER TABLE public.qr_tags
  ADD CONSTRAINT qr_tags_destination_check
  CHECK (destination IN ('reviews','linktree','landing','menu'));