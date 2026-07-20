DO $$ BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.payment_logs;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;
ALTER TABLE public.payment_logs REPLICA IDENTITY FULL;
CREATE INDEX IF NOT EXISTS idx_payment_logs_error_created ON public.payment_logs (error, created_at DESC) WHERE error IS NOT NULL;