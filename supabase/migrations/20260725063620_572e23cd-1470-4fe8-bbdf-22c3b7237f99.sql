ALTER TABLE public.merchant_messages
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','push','system')),
  ADD COLUMN IF NOT EXISTS push_log_id uuid REFERENCES public.push_logs(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_merchant_messages_source_pub
  ON public.merchant_messages(source, published_at DESC);

DROP TRIGGER IF EXISTS trg_merchant_messages_rate_limit ON public.merchant_messages;

CREATE OR REPLACE FUNCTION public.tg_merchant_messages_rate_limit()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE last_at timestamptz;
BEGIN
  IF COALESCE(NEW.source, 'manual') <> 'manual' THEN
    RETURN NEW;
  END IF;

  SELECT MAX(published_at) INTO last_at
    FROM public.merchant_messages
    WHERE establishment_id = NEW.establishment_id
      AND source = 'manual';

  IF last_at IS NOT NULL AND last_at > now() - interval '7 days' THEN
    RAISE EXCEPTION 'Limite atingido: 1 mensagem por semana. Próxima em %', (last_at + interval '7 days')
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_merchant_messages_rate_limit
  BEFORE INSERT ON public.merchant_messages
  FOR EACH ROW EXECUTE FUNCTION public.tg_merchant_messages_rate_limit();

REVOKE EXECUTE ON FUNCTION public.tg_merchant_messages_rate_limit() FROM PUBLIC, anon, authenticated;