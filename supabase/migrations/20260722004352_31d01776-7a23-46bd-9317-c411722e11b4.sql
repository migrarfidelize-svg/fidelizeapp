
-- 1) Tabela de mensagens da loja
CREATE TABLE public.merchant_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id uuid NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  author_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  kind text NOT NULL DEFAULT 'novidade' CHECK (kind IN ('promo','novidade','aviso')),
  title text NOT NULL CHECK (char_length(title) BETWEEN 3 AND 120),
  body text NOT NULL CHECK (char_length(body) BETWEEN 3 AND 2000),
  image_url text,
  link_url text,
  published_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_merchant_messages_est_pub ON public.merchant_messages(establishment_id, published_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.merchant_messages TO authenticated;
GRANT ALL ON public.merchant_messages TO service_role;

ALTER TABLE public.merchant_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Managers manage own establishment messages"
  ON public.merchant_messages FOR ALL TO authenticated
  USING (public.has_establishment_role(auth.uid(), establishment_id, 'manager'))
  WITH CHECK (public.has_establishment_role(auth.uid(), establishment_id, 'manager'));

CREATE POLICY "Customers read their establishment messages"
  ON public.merchant_messages FOR SELECT TO authenticated
  USING (
    published_at > now() - interval '90 days' AND
    EXISTS (
      SELECT 1 FROM public.customers c
      WHERE c.establishment_id = merchant_messages.establishment_id
        AND c.user_id = auth.uid()
    )
  );

CREATE TRIGGER trg_merchant_messages_updated_at
  BEFORE UPDATE ON public.merchant_messages
  FOR EACH ROW EXECUTE FUNCTION public.tg_updated_at();

-- 2) Marcações de leitura por cliente
CREATE TABLE public.merchant_message_reads (
  message_id uuid NOT NULL REFERENCES public.merchant_messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (message_id, user_id)
);
CREATE INDEX idx_msg_reads_user ON public.merchant_message_reads(user_id);

GRANT SELECT, INSERT, DELETE ON public.merchant_message_reads TO authenticated;
GRANT ALL ON public.merchant_message_reads TO service_role;

ALTER TABLE public.merchant_message_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own reads"
  ON public.merchant_message_reads FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- 3) Rate limit: 1 mensagem por estabelecimento a cada 7 dias
CREATE OR REPLACE FUNCTION public.tg_merchant_messages_rate_limit()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE last_at timestamptz;
BEGIN
  SELECT MAX(published_at) INTO last_at
    FROM public.merchant_messages
    WHERE establishment_id = NEW.establishment_id;
  IF last_at IS NOT NULL AND last_at > now() - interval '7 days' THEN
    RAISE EXCEPTION 'Limite atingido: 1 mensagem por semana. Próxima em %', (last_at + interval '7 days')
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_merchant_messages_rate_limit
  BEFORE INSERT ON public.merchant_messages
  FOR EACH ROW EXECUTE FUNCTION public.tg_merchant_messages_rate_limit();
