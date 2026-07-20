
ALTER TABLE public.payment_logs
  ADD COLUMN IF NOT EXISTS mode text,
  ADD COLUMN IF NOT EXISTS reason text,
  ADD COLUMN IF NOT EXISTS response_status integer,
  ADD COLUMN IF NOT EXISTS retry_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS next_retry_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_retry_at timestamptz;

CREATE INDEX IF NOT EXISTS payment_logs_retry_idx
  ON public.payment_logs (next_retry_at)
  WHERE error IS NOT NULL AND processed = false;
