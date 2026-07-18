
-- ================= ENUMS =================
DO $$ BEGIN CREATE TYPE public.support_status AS ENUM ('open','in_progress','waiting_customer','answered','resolved','closed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.support_priority AS ENUM ('low','normal','high','urgent'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.support_category AS ENUM ('duvidas','tecnico','carimbos','clientes','qrcode','campanhas','pagamentos','conta','sugestao','outro'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.support_author_type AS ENUM ('customer','admin','system'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ================= SEQUENCE (protocolo) =================
CREATE SEQUENCE IF NOT EXISTS public.support_ticket_seq START 1000;

-- ================= support_tickets =================
CREATE TABLE IF NOT EXISTS public.support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  protocol TEXT NOT NULL UNIQUE DEFAULT ('SPT-' || lpad(nextval('public.support_ticket_seq')::text, 6, '0')),
  establishment_id UUID REFERENCES public.establishments(id) ON DELETE SET NULL,
  requester_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  requester_name TEXT,
  requester_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  category public.support_category NOT NULL DEFAULT 'outro',
  priority public.support_priority NOT NULL DEFAULT 'normal',
  status public.support_status NOT NULL DEFAULT 'open',
  assigned_admin_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  has_unread_customer BOOLEAN NOT NULL DEFAULT false, -- há resposta admin não lida pelo cliente
  has_unread_admin BOOLEAN NOT NULL DEFAULT true,     -- há resposta cliente não lida pelo admin
  first_response_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS support_tickets_requester_idx ON public.support_tickets(requester_user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS support_tickets_status_idx ON public.support_tickets(status, updated_at DESC);
CREATE INDEX IF NOT EXISTS support_tickets_establishment_idx ON public.support_tickets(establishment_id);

GRANT SELECT, INSERT, UPDATE ON public.support_tickets TO authenticated;
GRANT ALL ON public.support_tickets TO service_role;
GRANT USAGE ON SEQUENCE public.support_ticket_seq TO authenticated, service_role;

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "support_tickets_requester_select"
  ON public.support_tickets FOR SELECT TO authenticated
  USING (requester_user_id = auth.uid());
CREATE POLICY "support_tickets_admin_select"
  ON public.support_tickets FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()));

CREATE POLICY "support_tickets_requester_insert"
  ON public.support_tickets FOR INSERT TO authenticated
  WITH CHECK (
    requester_user_id = auth.uid()
    AND assigned_admin_id IS NULL
    AND status = 'open'
    AND priority IN ('low','normal','high')
    AND first_response_at IS NULL AND resolved_at IS NULL AND closed_at IS NULL
  );

-- cliente pode atualizar somente flags de leitura (has_unread_customer -> false)
CREATE POLICY "support_tickets_requester_update"
  ON public.support_tickets FOR UPDATE TO authenticated
  USING (requester_user_id = auth.uid())
  WITH CHECK (
    requester_user_id = auth.uid()
    AND assigned_admin_id IS NOT DISTINCT FROM assigned_admin_id -- placeholder
  );

CREATE POLICY "support_tickets_admin_update"
  ON public.support_tickets FOR UPDATE TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

-- ================= support_messages =================
CREATE TABLE IF NOT EXISTS public.support_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  sender_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  sender_type public.support_author_type NOT NULL,
  sender_name TEXT,
  message TEXT NOT NULL,
  is_internal BOOLEAN NOT NULL DEFAULT false,
  attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  read_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS support_messages_ticket_idx ON public.support_messages(ticket_id, created_at);

GRANT SELECT, INSERT, UPDATE ON public.support_messages TO authenticated;
GRANT ALL ON public.support_messages TO service_role;

ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "support_msg_requester_select"
  ON public.support_messages FOR SELECT TO authenticated
  USING (
    is_internal = false
    AND EXISTS (SELECT 1 FROM public.support_tickets t
                WHERE t.id = ticket_id AND t.requester_user_id = auth.uid())
  );
CREATE POLICY "support_msg_admin_select"
  ON public.support_messages FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()));

-- cliente pode inserir SOMENTE mensagens não internas em seus próprios tickets ainda abertos
CREATE POLICY "support_msg_requester_insert"
  ON public.support_messages FOR INSERT TO authenticated
  WITH CHECK (
    sender_type = 'customer'
    AND is_internal = false
    AND sender_user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.support_tickets t
      WHERE t.id = ticket_id
        AND t.requester_user_id = auth.uid()
        AND t.status NOT IN ('closed')
    )
  );

CREATE POLICY "support_msg_admin_insert"
  ON public.support_messages FOR INSERT TO authenticated
  WITH CHECK (
    public.is_super_admin(auth.uid())
    AND sender_type IN ('admin','system')
  );

-- ================= support_status_history =================
CREATE TABLE IF NOT EXISTS public.support_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  from_status public.support_status,
  to_status public.support_status NOT NULL,
  changed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS support_status_history_ticket_idx ON public.support_status_history(ticket_id, created_at);

GRANT SELECT, INSERT ON public.support_status_history TO authenticated;
GRANT ALL ON public.support_status_history TO service_role;

ALTER TABLE public.support_status_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "support_history_requester_select"
  ON public.support_status_history FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.support_tickets t
                 WHERE t.id = ticket_id AND t.requester_user_id = auth.uid()));
CREATE POLICY "support_history_admin_all"
  ON public.support_status_history FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

-- ================= support_quick_replies =================
CREATE TABLE IF NOT EXISTS public.support_quick_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shortcut TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.support_quick_replies TO authenticated;
GRANT ALL ON public.support_quick_replies TO service_role;
ALTER TABLE public.support_quick_replies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "support_qr_admin_all"
  ON public.support_quick_replies FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

-- ================= TRIGGERS =================
CREATE TRIGGER trg_support_tickets_updated
  BEFORE UPDATE ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.tg_updated_at();

CREATE TRIGGER trg_support_quick_replies_updated
  BEFORE UPDATE ON public.support_quick_replies
  FOR EACH ROW EXECUTE FUNCTION public.tg_updated_at();

-- registrar mudanças de status
CREATE OR REPLACE FUNCTION public.tg_support_status_history()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.support_status_history (ticket_id, from_status, to_status, changed_by, reason)
    VALUES (NEW.id, NULL, NEW.status, NEW.requester_user_id, 'Ticket criado');
  ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.support_status_history (ticket_id, from_status, to_status, changed_by, reason)
    VALUES (NEW.id, OLD.status, NEW.status, auth.uid(), NULL);
    IF NEW.status = 'resolved' AND NEW.resolved_at IS NULL THEN NEW.resolved_at := now(); END IF;
    IF NEW.status = 'closed' AND NEW.closed_at IS NULL THEN NEW.closed_at := now(); END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_support_status_history_ins
  AFTER INSERT ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.tg_support_status_history();

CREATE TRIGGER trg_support_status_history_upd
  BEFORE UPDATE ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.tg_support_status_history();

-- ao inserir mensagem, ajustar flags e status
CREATE OR REPLACE FUNCTION public.tg_support_message_after_insert()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.is_internal THEN RETURN NEW; END IF;

  IF NEW.sender_type = 'admin' THEN
    UPDATE public.support_tickets
      SET has_unread_customer = true,
          has_unread_admin    = false,
          first_response_at   = COALESCE(first_response_at, NEW.created_at),
          status              = CASE WHEN status IN ('closed','resolved') THEN status
                                     ELSE 'waiting_customer' END,
          updated_at          = now()
      WHERE id = NEW.ticket_id;
  ELSIF NEW.sender_type = 'customer' THEN
    UPDATE public.support_tickets
      SET has_unread_admin    = true,
          has_unread_customer = false,
          status              = CASE WHEN status IN ('closed') THEN status
                                     WHEN status IN ('resolved') THEN 'open'
                                     ELSE 'in_progress' END,
          updated_at          = now()
      WHERE id = NEW.ticket_id;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_support_message_after_insert
  AFTER INSERT ON public.support_messages
  FOR EACH ROW EXECUTE FUNCTION public.tg_support_message_after_insert();

-- ================= REALTIME =================
ALTER PUBLICATION supabase_realtime ADD TABLE public.support_tickets;
ALTER PUBLICATION supabase_realtime ADD TABLE public.support_messages;

-- ================= Modelos padrão =================
INSERT INTO public.support_quick_replies (shortcut, title, body) VALUES
  ('/recebido', 'Recebemos seu chamado', 'Olá! Recebemos seu chamado e nossa equipe já está analisando. Em breve retornaremos com uma resposta.'),
  ('/detalhes', 'Mais detalhes',        'Poderia nos enviar mais detalhes sobre o ocorrido (prints, horário, passos que reproduzem o problema)? Isso agiliza a resolução.'),
  ('/testar',   'Corrigido — testar',   'O problema foi corrigido. Poderia testar novamente e nos confirmar se está tudo certo?'),
  ('/concluido','Chamado concluído',    'Seu chamado foi concluído com sucesso. Se precisar de mais alguma coisa, é só abrir um novo ticket.'),
  ('/encaminhado','Encaminhado ao setor','Estamos encaminhando seu chamado para o setor responsável. Assim que houver retorno, avisamos por aqui.')
ON CONFLICT DO NOTHING;
