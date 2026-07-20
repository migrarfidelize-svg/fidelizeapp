ALTER TABLE public.payment_settings
  ADD COLUMN IF NOT EXISTS account_email text,
  ADD COLUMN IF NOT EXISTS account_nickname text,
  ADD COLUMN IF NOT EXISTS account_id text;