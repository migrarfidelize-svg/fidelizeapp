
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'mercadopago',
  ADD COLUMN IF NOT EXISTS provider_payment_id text;

CREATE INDEX IF NOT EXISTS payments_provider_ppid_idx
  ON public.payments (provider, provider_payment_id);

-- Backfill: mp_payment_id → provider_payment_id para linhas existentes
UPDATE public.payments
   SET provider_payment_id = mp_payment_id
 WHERE provider_payment_id IS NULL AND mp_payment_id IS NOT NULL;

ALTER TABLE public.payment_logs
  ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'mercadopago';

CREATE INDEX IF NOT EXISTS payment_logs_provider_created_idx
  ON public.payment_logs (provider, created_at DESC);
