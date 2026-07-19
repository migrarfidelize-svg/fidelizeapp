
-- 1) feature_gate_events: log de tentativas de uso de recursos bloqueados por plano
CREATE TABLE public.feature_gate_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id uuid NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  feature_key text NOT NULL,
  action text NOT NULL,
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  plan_tier text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_feature_gate_events_est ON public.feature_gate_events(establishment_id, created_at DESC);
CREATE INDEX idx_feature_gate_events_feature ON public.feature_gate_events(feature_key, created_at DESC);

GRANT SELECT, INSERT ON public.feature_gate_events TO authenticated;
GRANT ALL ON public.feature_gate_events TO service_role;

ALTER TABLE public.feature_gate_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members insert own establishment gate events"
  ON public.feature_gate_events FOR INSERT TO authenticated
  WITH CHECK (public.has_establishment_access(auth.uid(), establishment_id));

CREATE POLICY "super admin reads all gate events"
  ON public.feature_gate_events FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()));

CREATE POLICY "members read own establishment gate events"
  ON public.feature_gate_events FOR SELECT TO authenticated
  USING (public.has_establishment_role(auth.uid(), establishment_id, 'manager'));

-- 2) Template de e-mail para desbloqueio de avaliações
INSERT INTO public.email_templates (slug, name, description, subject, html, text, variables, is_system, active)
VALUES (
  'reviews_feature_unlocked',
  'Recurso Avaliações liberado',
  'Enviado ao dono da empresa quando o novo plano libera o módulo de Avaliações públicas.',
  'Avaliações públicas liberadas para {{establishment_name}} 🎉',
  '<div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#0f172a">
    <h1 style="font-size:22px;margin:0 0 12px">Seu novo plano liberou as Avaliações públicas</h1>
    <p style="font-size:15px;line-height:1.5">Olá {{owner_name}}, o plano <strong>{{plan_name}}</strong> da empresa <strong>{{establishment_name}}</strong> já inclui o módulo <strong>Avaliações públicas de atendimento</strong>.</p>
    <p style="font-size:15px;line-height:1.5">Agora você pode:</p>
    <ul style="font-size:14px;line-height:1.6">
      <li>Publicar o formulário em <a href="{{public_review_url}}">{{public_review_url}}</a></li>
      <li>Gerar um QR Code dedicado para balcão, mesa ou recibo</li>
      <li>Receber alertas de nota baixa e responder publicamente</li>
    </ul>
    <p style="margin:24px 0">
      <a href="{{app_reviews_url}}" style="display:inline-block;background:#111827;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600">Configurar avaliações</a>
    </p>
    <p style="font-size:12px;color:#64748b">Você recebeu este e-mail porque é dono da empresa {{establishment_name}} no Fidelize.</p>
  </div>',
  'Seu novo plano {{plan_name}} liberou o módulo de Avaliações públicas para {{establishment_name}}. Configure em {{app_reviews_url}} e compartilhe {{public_review_url}}.',
  '["owner_name","establishment_name","plan_name","public_review_url","app_reviews_url"]'::jsonb,
  true,
  true
) ON CONFLICT (slug) DO NOTHING;
