
-- Email templates
CREATE TABLE public.email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  subject TEXT NOT NULL,
  html TEXT NOT NULL,
  text TEXT,
  variables JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_system BOOLEAN NOT NULL DEFAULT false,
  active BOOLEAN NOT NULL DEFAULT true,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.email_templates TO service_role;
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_email_templates_updated_at BEFORE UPDATE ON public.email_templates
  FOR EACH ROW EXECUTE FUNCTION public.tg_updated_at();

-- Email queue
CREATE TABLE public.email_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  to_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  html TEXT NOT NULL,
  text TEXT,
  template TEXT,
  variables JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','sent','failed')),
  attempts INT NOT NULL DEFAULT 0,
  max_attempts INT NOT NULL DEFAULT 5,
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_error TEXT,
  resend_id TEXT,
  actor_id UUID,
  establishment_id UUID,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.email_queue TO service_role;
ALTER TABLE public.email_queue ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_email_queue_pending ON public.email_queue (status, next_attempt_at) WHERE status IN ('pending','processing');
CREATE TRIGGER trg_email_queue_updated_at BEFORE UPDATE ON public.email_queue
  FOR EACH ROW EXECUTE FUNCTION public.tg_updated_at();

-- Seed built-in system templates
INSERT INTO public.email_templates (slug, name, description, subject, html, text, variables, is_system) VALUES
('password_recovery', 'Recuperação de senha', 'E-mail enviado quando o usuário solicita redefinição de senha.',
 'Redefina sua senha — Fidelize',
 '<div style="font-family:Inter,Arial,sans-serif;max-width:520px;margin:auto;padding:24px;color:#0f172a">
  <h2 style="margin:0 0 12px;font-size:20px">Olá {{name}},</h2>
  <p style="margin:0 0 16px;line-height:1.6">Recebemos um pedido para redefinir a senha da sua conta na Fidelize.</p>
  <p style="margin:0 0 24px"><a href="{{action_link}}" style="display:inline-block;background:#0ea5e9;color:#fff;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:600">Redefinir senha</a></p>
  <p style="margin:0 0 8px;color:#64748b;font-size:13px">Ou copie e cole este link no navegador:</p>
  <p style="margin:0 0 24px;word-break:break-all;font-size:12px;color:#0f172a"><a href="{{action_link}}">{{action_link}}</a></p>
  <p style="margin:0;color:#64748b;font-size:12px">Se você não solicitou, ignore este e-mail.</p>
 </div>',
 'Olá {{name}},\n\nRedefina sua senha: {{action_link}}\n\nSe você não solicitou, ignore este e-mail.',
 '["name","action_link"]'::jsonb, true),

('team_invite', 'Convite de equipe', 'Enviado quando um lojista convida um novo membro para a equipe.',
 'Você foi convidado para {{establishment_name}} — Fidelize',
 '<div style="font-family:Inter,Arial,sans-serif;max-width:520px;margin:auto;padding:24px;color:#0f172a">
  <h2 style="margin:0 0 12px;font-size:20px">{{inviter_name}} convidou você</h2>
  <p style="margin:0 0 16px;line-height:1.6">Você foi convidado para participar da equipe de <strong>{{establishment_name}}</strong> como <strong>{{role}}</strong> na plataforma Fidelize.</p>
  <p style="margin:0 0 24px"><a href="{{invite_url}}" style="display:inline-block;background:#0ea5e9;color:#fff;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:600">Aceitar convite</a></p>
  <p style="margin:0 0 8px;color:#64748b;font-size:13px">Ou copie e cole este link:</p>
  <p style="margin:0;word-break:break-all;font-size:12px"><a href="{{invite_url}}">{{invite_url}}</a></p>
 </div>',
 'Você foi convidado para {{establishment_name}} como {{role}}.\n\nAceitar: {{invite_url}}',
 '["inviter_name","establishment_name","role","invite_url"]'::jsonb, true);
