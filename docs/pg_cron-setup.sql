-- ══════════════════════════════════════════════════════════════════════════
-- FIDELIZE — Setup Completo de Cron Jobs (pg_cron)
-- ══════════════════════════════════════════════════════════════════════════
-- Cole tudo no SQL Editor do seu Supabase próprio e execute.
-- Requer permissão de superuser (funciona no Supabase padrão).
--
-- Após executar, verifique:
--   SELECT jobname, schedule, active FROM cron.job;
-- ══════════════════════════════════════════════════════════════════════════

-- ────────── 0. Extensões necessárias ──────────
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- ══════════════════════════════════════════════════════════════════════════
-- JOB 1 — Marcar assinaturas atrasadas e bloquear estabelecimentos
-- Roda todo dia às 03:00 (UTC). Usa a função já existente no schema.
-- ══════════════════════════════════════════════════════════════════════════
SELECT cron.schedule(
    'fidelize-mark-past-due',
    '0 3 * * *',
    $$SELECT public.mark_past_due_subscriptions();$$
);

-- ══════════════════════════════════════════════════════════════════════════
-- JOB 2 — Recalcular tier de todos os clientes (bronze/prata/ouro/diamante)
-- Roda todo domingo às 04:00. Reprocessa em caso de mudança de thresholds
-- ou de correções manuais em visits_count.
-- ══════════════════════════════════════════════════════════════════════════
SELECT cron.schedule(
    'fidelize-recompute-tiers',
    '0 4 * * 0',
    $$
    UPDATE public.customers c
    SET tier = public.compute_tier(
                    COALESCE(c.visits_count, 0),
                    COALESCE(rs.tier_thresholds,
                             '{"bronze":0,"prata":10,"ouro":25,"diamante":50}'::jsonb)
                ),
        updated_at = now()
    FROM public.retention_settings rs
    WHERE rs.establishment_id = c.establishment_id
      AND c.tier IS DISTINCT FROM public.compute_tier(
                    COALESCE(c.visits_count, 0),
                    COALESCE(rs.tier_thresholds,
                             '{"bronze":0,"prata":10,"ouro":25,"diamante":50}'::jsonb));
    $$
);

-- ══════════════════════════════════════════════════════════════════════════
-- JOB 3 — Detectar clientes inativos (30+ dias sem carimbo)
-- Roda toda segunda às 09:00. Registra evento pra dashboards + campanhas
-- de reengajamento automatizadas dispararem depois.
-- ══════════════════════════════════════════════════════════════════════════
SELECT cron.schedule(
    'fidelize-detect-inactive-customers',
    '0 9 * * 1',
    $$
    INSERT INTO public.retention_events (establishment_id, customer_id, event_type, to_value)
    SELECT c.establishment_id, c.id, 'inactive_30d', '30'
      FROM public.customers c
     WHERE c.last_visit_at IS NOT NULL
       AND c.last_visit_at < now() - interval '30 days'
       AND c.last_visit_at > now() - interval '60 days'
       AND NOT EXISTS (
           SELECT 1 FROM public.retention_events re
            WHERE re.customer_id = c.id
              AND re.event_type = 'inactive_30d'
              AND re.created_at > now() - interval '30 days'
       );
    $$
);

-- ══════════════════════════════════════════════════════════════════════════
-- JOB 4 — Registrar aniversariantes do dia
-- Roda todo dia às 08:00. Cria eventos que a UI/campanha usa pra parabenizar.
-- Requer coluna customers.birth_date (opcional; job só age se houver dados).
-- ══════════════════════════════════════════════════════════════════════════
SELECT cron.schedule(
    'fidelize-daily-birthdays',
    '0 8 * * *',
    $$
    INSERT INTO public.retention_events (establishment_id, customer_id, event_type, to_value)
    SELECT c.establishment_id, c.id, 'birthday', to_char(now(), 'YYYY-MM-DD')
      FROM public.customers c
     WHERE c.birth_date IS NOT NULL
       AND EXTRACT(MONTH FROM c.birth_date) = EXTRACT(MONTH FROM now())
       AND EXTRACT(DAY   FROM c.birth_date) = EXTRACT(DAY   FROM now())
       AND NOT EXISTS (
           SELECT 1 FROM public.retention_events re
            WHERE re.customer_id = c.id
              AND re.event_type = 'birthday'
              AND re.created_at::date = current_date
       );
    $$
);

-- ══════════════════════════════════════════════════════════════════════════
-- JOB 5 — Limpar tokens de resgate expirados
-- Roda a cada 10 minutos. Tokens vivem 60s; qualquer registro > 5 min é lixo.
-- Ajuste o nome da tabela se seu schema usar outro.
-- ══════════════════════════════════════════════════════════════════════════
SELECT cron.schedule(
    'fidelize-cleanup-redemption-tokens',
    '*/10 * * * *',
    $$
    DELETE FROM public.redemption_tokens
     WHERE expires_at < now() - interval '5 minutes';
    $$
);

-- ══════════════════════════════════════════════════════════════════════════
-- JOB 6 — Purgar logs antigos (auditoria > 180 dias, emails > 90 dias)
-- Roda todo primeiro dia do mês às 02:00.
-- ══════════════════════════════════════════════════════════════════════════
SELECT cron.schedule(
    'fidelize-purge-old-logs',
    '0 2 1 * *',
    $$
    DELETE FROM public.audit_logs   WHERE created_at < now() - interval '180 days';
    DELETE FROM public.email_logs   WHERE created_at < now() - interval '90 days';
    $$
);

-- ══════════════════════════════════════════════════════════════════════════
-- Verificação final
-- ══════════════════════════════════════════════════════════════════════════
SELECT jobname, schedule, active
  FROM cron.job
 WHERE jobname LIKE 'fidelize-%'
 ORDER BY jobname;

-- ══════════════════════════════════════════════════════════════════════════
-- COMANDOS ÚTEIS
-- ══════════════════════════════════════════════════════════════════════════
-- Desativar um job temporariamente:
--     UPDATE cron.job SET active = false WHERE jobname = 'fidelize-daily-birthdays';
--
-- Remover um job:
--     SELECT cron.unschedule('fidelize-daily-birthdays');
--
-- Ver últimas 20 execuções:
--     SELECT jobname, status, start_time, end_time, return_message
--       FROM cron.job_run_details
--      ORDER BY start_time DESC LIMIT 20;
--
-- Ver apenas falhas:
--     SELECT jobname, start_time, return_message
--       FROM cron.job_run_details
--      WHERE status = 'failed'
--      ORDER BY start_time DESC LIMIT 20;
-- ══════════════════════════════════════════════════════════════════════════
