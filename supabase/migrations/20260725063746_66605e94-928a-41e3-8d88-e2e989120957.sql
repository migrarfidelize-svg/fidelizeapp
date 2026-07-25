CREATE TABLE public.user_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  customer_id uuid REFERENCES public.customers(id) ON DELETE CASCADE,
  establishment_id uuid REFERENCES public.establishments(id) ON DELETE CASCADE,
  push_log_id uuid REFERENCES public.push_logs(id) ON DELETE SET NULL,
  audience text NOT NULL DEFAULT 'user' CHECK (audience IN ('user','customer','operator','admin')),
  kind text NOT NULL DEFAULT 'aviso' CHECK (kind IN ('promo','novidade','aviso','push')),
  title text NOT NULL CHECK (char_length(title) BETWEEN 2 AND 120),
  body text,
  url text,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_notifications_owner_chk CHECK (user_id IS NOT NULL OR customer_id IS NOT NULL)
);

GRANT SELECT, UPDATE, DELETE ON public.user_notifications TO authenticated;
GRANT ALL ON public.user_notifications TO service_role;

ALTER TABLE public.user_notifications ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_user_notifications_user_date
  ON public.user_notifications(user_id, created_at DESC)
  WHERE user_id IS NOT NULL;
CREATE INDEX idx_user_notifications_customer_date
  ON public.user_notifications(customer_id, created_at DESC)
  WHERE customer_id IS NOT NULL;
CREATE INDEX idx_user_notifications_unread
  ON public.user_notifications(user_id, created_at DESC)
  WHERE read_at IS NULL AND user_id IS NOT NULL;

CREATE POLICY "Users read own app notifications"
  ON public.user_notifications
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.customers c
      WHERE c.id = user_notifications.customer_id
        AND c.user_id = auth.uid()
    )
  );

CREATE POLICY "Users update own app notifications"
  ON public.user_notifications
  FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.customers c
      WHERE c.id = user_notifications.customer_id
        AND c.user_id = auth.uid()
    )
  )
  WITH CHECK (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.customers c
      WHERE c.id = user_notifications.customer_id
        AND c.user_id = auth.uid()
    )
  );

CREATE TRIGGER trg_user_notifications_updated_at
  BEFORE UPDATE ON public.user_notifications
  FOR EACH ROW EXECUTE FUNCTION public.tg_updated_at();