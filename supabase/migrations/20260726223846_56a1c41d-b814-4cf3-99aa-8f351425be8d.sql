ALTER TABLE public.establishments DROP CONSTRAINT IF EXISTS establishments_qr_destination_check;
ALTER TABLE public.establishments ADD CONSTRAINT establishments_qr_destination_check
  CHECK (qr_destination = ANY (ARRAY['reviews'::text,'linktree'::text,'landing'::text,'menu'::text,'catalog'::text]));