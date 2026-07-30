-- 1) Auditoria imutável ------------------------------------------------
CREATE OR REPLACE FUNCTION public.tg_block_mutation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'Registro de auditoria é imutável (% não permitido em %)', TG_OP, TG_TABLE_NAME
    USING ERRCODE = 'insufficient_privilege';
END;
$$;

DROP TRIGGER IF EXISTS audit_logs_immutable ON public.audit_logs;
CREATE TRIGGER audit_logs_immutable
BEFORE UPDATE OR DELETE ON public.audit_logs
FOR EACH ROW EXECUTE FUNCTION public.tg_block_mutation();

DROP TRIGGER IF EXISTS payment_logs_immutable ON public.payment_logs;
CREATE TRIGGER payment_logs_immutable
BEFORE UPDATE OR DELETE ON public.payment_logs
FOR EACH ROW EXECUTE FUNCTION public.tg_block_mutation();

DROP TRIGGER IF EXISTS subscription_events_immutable ON public.subscription_events;
CREATE TRIGGER subscription_events_immutable
BEFORE UPDATE OR DELETE ON public.subscription_events
FOR EACH ROW EXECUTE FUNCTION public.tg_block_mutation();

-- 2) Consentimento com contexto probatório -------------------------------
ALTER TABLE public.consents
  ADD COLUMN IF NOT EXISTS user_agent text,
  ADD COLUMN IF NOT EXISTS privacy_version text,
  ADD COLUMN IF NOT EXISTS source text;

-- 3) Política de retenção -------------------------------------------------
CREATE TABLE IF NOT EXISTS public.log_retention_policies (
  table_name text PRIMARY KEY,
  retention_days integer NOT NULL CHECK (retention_days > 0),
  timestamp_column text NOT NULL DEFAULT 'created_at',
  note text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.log_retention_policies TO authenticated;
GRANT ALL ON public.log_retention_policies TO service_role;
ALTER TABLE public.log_retention_policies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "super admin reads retention policies" ON public.log_retention_policies;
CREATE POLICY "super admin reads retention policies"
ON public.log_retention_policies FOR SELECT TO authenticated
USING (public.is_super_admin(auth.uid()));

CREATE TABLE IF NOT EXISTS public.log_purge_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ran_at timestamptz NOT NULL DEFAULT now(),
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  total_deleted integer NOT NULL DEFAULT 0
);

GRANT SELECT ON public.log_purge_runs TO authenticated;
GRANT ALL ON public.log_purge_runs TO service_role;
ALTER TABLE public.log_purge_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "super admin reads purge runs" ON public.log_purge_runs;
CREATE POLICY "super admin reads purge runs"
ON public.log_purge_runs FOR SELECT TO authenticated
USING (public.is_super_admin(auth.uid()));

INSERT INTO public.log_retention_policies (table_name, retention_days, timestamp_column, note) VALUES
  ('pixel_events', 90, 'created_at', 'Telemetria de marketing'),
  ('channel_events', 90, 'created_at', 'Eventos de canais/analytics'),
  ('app_engagement_events', 90, 'created_at', 'Engajamento no app'),
  ('qr_scans', 90, 'created_at', 'Leituras de QR Code'),
  ('feature_gate_events', 90, 'created_at', 'Bloqueios por plano'),
  ('help_article_views', 90, 'created_at', 'Visualizações da central de ajuda'),
  ('review_events', 180, 'created_at', 'Eventos de avaliações'),
  ('push_events', 180, 'created_at', 'Eventos de push'),
  ('push_logs', 180, 'created_at', 'Entregas de push'),
  ('email_logs', 180, 'created_at', 'Entregas de e-mail'),
  ('email_queue', 180, 'created_at', 'Fila de e-mail processada'),
  ('webhook_deliveries', 180, 'created_at', 'Entregas de webhook'),
  ('retention_events', 365, 'created_at', 'Eventos de retenção/níveis'),
  ('ai_usage', 365, 'created_at', 'Consumo de IA'),
  ('audit_logs', 1825, 'created_at', 'Auditoria — prazo legal 5 anos'),
  ('payment_logs', 1825, 'created_at', 'Financeiro — prazo legal 5 anos'),
  ('subscription_events', 1825, 'created_at', 'Assinaturas — prazo legal 5 anos')
ON CONFLICT (table_name) DO NOTHING;

CREATE OR REPLACE FUNCTION public.purge_expired_logs()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pol RECORD;
  removed bigint;
  result jsonb := '{}'::jsonb;
  total bigint := 0;
BEGIN
  FOR pol IN SELECT * FROM public.log_retention_policies LOOP
    CONTINUE WHEN to_regclass('public.' || quote_ident(pol.table_name)) IS NULL;
    CONTINUE WHEN NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = pol.table_name
        AND column_name = pol.timestamp_column
    );

    BEGIN
      EXECUTE format(
        'DELETE FROM public.%I WHERE %I < now() - ($1 || '' days'')::interval',
        pol.table_name, pol.timestamp_column
      ) USING pol.retention_days;
      GET DIAGNOSTICS removed = ROW_COUNT;
    EXCEPTION WHEN OTHERS THEN
      removed := -1; -- tabela protegida (auditoria imutável) ou erro pontual
    END;

    IF removed <> 0 THEN
      result := result || jsonb_build_object(pol.table_name, removed);
      IF removed > 0 THEN total := total + removed; END IF;
    END IF;
  END LOOP;

  INSERT INTO public.log_purge_runs (details, total_deleted) VALUES (result, total);
  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.purge_expired_logs() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purge_expired_logs() TO service_role;