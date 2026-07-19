ALTER TABLE public.customer_reviews
  ADD COLUMN IF NOT EXISTS merchant_reply text,
  ADD COLUMN IF NOT EXISTS merchant_reply_at timestamptz,
  ADD COLUMN IF NOT EXISTS merchant_reply_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS public_hidden boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_customer_reviews_public_recent
  ON public.customer_reviews (establishment_id, created_at DESC)
  WHERE public_hidden = false;