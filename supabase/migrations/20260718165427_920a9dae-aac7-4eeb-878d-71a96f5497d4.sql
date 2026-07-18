
-- Enums
CREATE TYPE public.ticket_status AS ENUM ('open','pending','on_hold','solved','closed');
CREATE TYPE public.ticket_priority AS ENUM ('low','normal','high','urgent');
CREATE TYPE public.ticket_channel AS ENUM ('form','email','chat','agent');
CREATE TYPE public.ticket_author_type AS ENUM ('customer','agent','system');
CREATE TYPE public.helpdesk_role AS ENUM ('hd_admin','hd_agent');

-- Helpdesk role table (separate from Fidelize member roles)
CREATE TABLE public.helpdesk_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id uuid NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role helpdesk_role NOT NULL DEFAULT 'hd_agent',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(establishment_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.helpdesk_members TO authenticated;
GRANT ALL ON public.helpdesk_members TO service_role;
ALTER TABLE public.helpdesk_members ENABLE ROW LEVEL SECURITY;

-- Security definer: is user an agent (or admin) of establishment?
CREATE OR REPLACE FUNCTION public.is_helpdesk_agent(_user uuid, _est uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.helpdesk_members
    WHERE user_id = _user AND establishment_id = _est AND active = true
  ) OR EXISTS (
    SELECT 1 FROM public.establishment_members
    WHERE user_id = _user AND establishment_id = _est AND active = true AND role IN ('owner','manager')
  );
$$;
REVOKE EXECUTE ON FUNCTION public.is_helpdesk_agent(uuid,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_helpdesk_agent(uuid,uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.is_helpdesk_admin(_user uuid, _est uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.helpdesk_members
    WHERE user_id = _user AND establishment_id = _est AND active = true AND role = 'hd_admin'
  ) OR EXISTS (
    SELECT 1 FROM public.establishment_members
    WHERE user_id = _user AND establishment_id = _est AND active = true AND role IN ('owner','manager')
  );
$$;
REVOKE EXECUTE ON FUNCTION public.is_helpdesk_admin(uuid,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_helpdesk_admin(uuid,uuid) TO authenticated, service_role;

CREATE POLICY hm_select ON public.helpdesk_members FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_helpdesk_admin(auth.uid(), establishment_id));
CREATE POLICY hm_insert ON public.helpdesk_members FOR INSERT TO authenticated
  WITH CHECK (public.is_helpdesk_admin(auth.uid(), establishment_id));
CREATE POLICY hm_update ON public.helpdesk_members FOR UPDATE TO authenticated
  USING (public.is_helpdesk_admin(auth.uid(), establishment_id));
CREATE POLICY hm_delete ON public.helpdesk_members FOR DELETE TO authenticated
  USING (public.is_helpdesk_admin(auth.uid(), establishment_id));

-- KB Categories
CREATE TABLE public.kb_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id uuid NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL,
  description text,
  icon text,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(establishment_id, slug)
);
GRANT SELECT ON public.kb_categories TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kb_categories TO authenticated;
GRANT ALL ON public.kb_categories TO service_role;
ALTER TABLE public.kb_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY kbc_public_select ON public.kb_categories FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY kbc_manage ON public.kb_categories FOR ALL TO authenticated
  USING (public.is_helpdesk_agent(auth.uid(), establishment_id))
  WITH CHECK (public.is_helpdesk_agent(auth.uid(), establishment_id));

-- KB Articles
CREATE TABLE public.kb_articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id uuid NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  category_id uuid REFERENCES public.kb_categories(id) ON DELETE SET NULL,
  title text NOT NULL,
  slug text NOT NULL,
  excerpt text,
  body_html text NOT NULL DEFAULT '',
  body_text text NOT NULL DEFAULT '',
  tags text[] NOT NULL DEFAULT '{}',
  published boolean NOT NULL DEFAULT false,
  views int NOT NULL DEFAULT 0,
  helpful_count int NOT NULL DEFAULT 0,
  not_helpful_count int NOT NULL DEFAULT 0,
  author_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  search_tsv tsvector GENERATED ALWAYS AS (
    setweight(to_tsvector('portuguese', coalesce(title,'')), 'A') ||
    setweight(to_tsvector('portuguese', coalesce(excerpt,'')), 'B') ||
    setweight(to_tsvector('portuguese', coalesce(body_text,'')), 'C')
  ) STORED,
  UNIQUE(establishment_id, slug)
);
CREATE INDEX kb_articles_search_idx ON public.kb_articles USING gin(search_tsv);
CREATE INDEX kb_articles_est_pub_idx ON public.kb_articles(establishment_id, published);
GRANT SELECT ON public.kb_articles TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kb_articles TO authenticated;
GRANT ALL ON public.kb_articles TO service_role;
ALTER TABLE public.kb_articles ENABLE ROW LEVEL SECURITY;
CREATE POLICY kba_public_select ON public.kb_articles FOR SELECT TO anon, authenticated
  USING (published = true);
CREATE POLICY kba_agent_select ON public.kb_articles FOR SELECT TO authenticated
  USING (public.is_helpdesk_agent(auth.uid(), establishment_id));
CREATE POLICY kba_manage ON public.kb_articles FOR ALL TO authenticated
  USING (public.is_helpdesk_agent(auth.uid(), establishment_id))
  WITH CHECK (public.is_helpdesk_agent(auth.uid(), establishment_id));

-- KB Feedback
CREATE TABLE public.kb_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id uuid NOT NULL REFERENCES public.kb_articles(id) ON DELETE CASCADE,
  helpful boolean NOT NULL,
  comment text,
  visitor_hash text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT INSERT ON public.kb_feedback TO anon, authenticated;
GRANT SELECT, DELETE ON public.kb_feedback TO authenticated;
GRANT ALL ON public.kb_feedback TO service_role;
ALTER TABLE public.kb_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY kbf_insert ON public.kb_feedback FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY kbf_agent_select ON public.kb_feedback FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.kb_articles a
                 WHERE a.id = article_id AND public.is_helpdesk_agent(auth.uid(), a.establishment_id)));

-- Tickets
CREATE TABLE public.tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id uuid NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  number serial,
  subject text NOT NULL,
  status ticket_status NOT NULL DEFAULT 'open',
  priority ticket_priority NOT NULL DEFAULT 'normal',
  channel ticket_channel NOT NULL DEFAULT 'form',
  tags text[] NOT NULL DEFAULT '{}',
  requester_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  requester_email text NOT NULL,
  requester_name text,
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  first_response_at timestamptz,
  solved_at timestamptz,
  due_first_response_at timestamptz,
  due_resolution_at timestamptz,
  csat int,
  csat_comment text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX tickets_est_status_idx ON public.tickets(establishment_id, status);
CREATE INDEX tickets_requester_idx ON public.tickets(requester_user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tickets TO authenticated;
GRANT ALL ON public.tickets TO service_role;
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY tk_requester_select ON public.tickets FOR SELECT TO authenticated
  USING (requester_user_id = auth.uid());
CREATE POLICY tk_agent_select ON public.tickets FOR SELECT TO authenticated
  USING (public.is_helpdesk_agent(auth.uid(), establishment_id));
CREATE POLICY tk_requester_insert ON public.tickets FOR INSERT TO authenticated
  WITH CHECK (requester_user_id = auth.uid());
CREATE POLICY tk_agent_insert ON public.tickets FOR INSERT TO authenticated
  WITH CHECK (public.is_helpdesk_agent(auth.uid(), establishment_id));
CREATE POLICY tk_agent_update ON public.tickets FOR UPDATE TO authenticated
  USING (public.is_helpdesk_agent(auth.uid(), establishment_id));
CREATE POLICY tk_requester_update ON public.tickets FOR UPDATE TO authenticated
  USING (requester_user_id = auth.uid())
  WITH CHECK (requester_user_id = auth.uid());

-- Ticket messages
CREATE TABLE public.ticket_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  author_type ticket_author_type NOT NULL,
  author_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  author_name text,
  body text NOT NULL,
  internal boolean NOT NULL DEFAULT false,
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX tm_ticket_idx ON public.ticket_messages(ticket_id, created_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ticket_messages TO authenticated;
GRANT ALL ON public.ticket_messages TO service_role;
ALTER TABLE public.ticket_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY tm_requester_select ON public.ticket_messages FOR SELECT TO authenticated
  USING (internal = false AND EXISTS (
    SELECT 1 FROM public.tickets t WHERE t.id = ticket_id AND t.requester_user_id = auth.uid()
  ));
CREATE POLICY tm_agent_select ON public.ticket_messages FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.tickets t
    WHERE t.id = ticket_id AND public.is_helpdesk_agent(auth.uid(), t.establishment_id)
  ));
CREATE POLICY tm_requester_insert ON public.ticket_messages FOR INSERT TO authenticated
  WITH CHECK (
    author_type = 'customer' AND internal = false AND author_user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.tickets t WHERE t.id = ticket_id AND t.requester_user_id = auth.uid())
  );
CREATE POLICY tm_agent_insert ON public.ticket_messages FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.tickets t
    WHERE t.id = ticket_id AND public.is_helpdesk_agent(auth.uid(), t.establishment_id)
  ));

-- Quick replies (canned responses)
CREATE TABLE public.ticket_quick_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id uuid NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  shortcut text NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(establishment_id, shortcut)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ticket_quick_replies TO authenticated;
GRANT ALL ON public.ticket_quick_replies TO service_role;
ALTER TABLE public.ticket_quick_replies ENABLE ROW LEVEL SECURITY;
CREATE POLICY qr_agent_all ON public.ticket_quick_replies FOR ALL TO authenticated
  USING (public.is_helpdesk_agent(auth.uid(), establishment_id))
  WITH CHECK (public.is_helpdesk_agent(auth.uid(), establishment_id));

-- Triggers: updated_at
CREATE TRIGGER trg_kbc_updated BEFORE UPDATE ON public.kb_categories
  FOR EACH ROW EXECUTE FUNCTION public.tg_updated_at();
CREATE TRIGGER trg_kba_updated BEFORE UPDATE ON public.kb_articles
  FOR EACH ROW EXECUTE FUNCTION public.tg_updated_at();
CREATE TRIGGER trg_tk_updated BEFORE UPDATE ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION public.tg_updated_at();

-- Trigger: SLA defaults on insert based on priority
CREATE OR REPLACE FUNCTION public.tg_ticket_defaults()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.due_first_response_at IS NULL THEN
    NEW.due_first_response_at := NEW.created_at + CASE NEW.priority
      WHEN 'urgent' THEN interval '1 hour'
      WHEN 'high' THEN interval '4 hours'
      WHEN 'normal' THEN interval '8 hours'
      ELSE interval '24 hours' END;
  END IF;
  IF NEW.due_resolution_at IS NULL THEN
    NEW.due_resolution_at := NEW.created_at + CASE NEW.priority
      WHEN 'urgent' THEN interval '8 hours'
      WHEN 'high' THEN interval '1 day'
      WHEN 'normal' THEN interval '3 days'
      ELSE interval '5 days' END;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_ticket_defaults BEFORE INSERT ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION public.tg_ticket_defaults();

-- Trigger: mark first_response_at when first agent message arrives
CREATE OR REPLACE FUNCTION public.tg_ticket_first_response()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.author_type = 'agent' AND NEW.internal = false THEN
    UPDATE public.tickets
      SET first_response_at = COALESCE(first_response_at, NEW.created_at),
          status = CASE WHEN status = 'open' THEN 'pending' ELSE status END,
          updated_at = now()
      WHERE id = NEW.ticket_id;
  ELSIF NEW.author_type = 'customer' AND NEW.internal = false THEN
    UPDATE public.tickets
      SET status = CASE WHEN status IN ('solved','closed') THEN 'open' ELSE status END,
          updated_at = now()
      WHERE id = NEW.ticket_id;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_ticket_first_response AFTER INSERT ON public.ticket_messages
  FOR EACH ROW EXECUTE FUNCTION public.tg_ticket_first_response();
