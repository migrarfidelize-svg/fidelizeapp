-- ============================================================
-- ETAPA 1: índices para os caminhos quentes + remoção de duplicados
-- ============================================================

-- 1) RLS / permissões: has_establishment_access, member_can, is_establishment_user
--    filtram por user_id, mas só existia índice com establishment_id na frente.
CREATE INDEX IF NOT EXISTS idx_establishment_members_user_active
  ON public.establishment_members (user_id, establishment_id)
  WHERE active = true;

CREATE INDEX IF NOT EXISTS idx_helpdesk_members_user_active
  ON public.helpdesk_members (user_id, establishment_id)
  WHERE active = true;

CREATE INDEX IF NOT EXISTS idx_member_permissions_member
  ON public.member_permissions (member_id);

-- 2) Carimbos válidos por cartão (voucher, conquistas, contagem de visitas)
CREATE INDEX IF NOT EXISTS idx_stamps_card_active
  ON public.stamps (card_id, created_at DESC)
  WHERE reverted_at IS NULL;

-- 3) Recompensas resgatadas por cartão
CREATE INDEX IF NOT EXISTS idx_rewards_card_redeemed
  ON public.rewards (card_id)
  WHERE redeemed_at IS NOT NULL;

-- 4) Busca de clientes por nome dentro da empresa (CRM / carimbar)
CREATE INDEX IF NOT EXISTS idx_customers_est_name
  ON public.customers (establishment_id, name);

-- 5) Analytics de funil e pixel por empresa/data
CREATE INDEX IF NOT EXISTS idx_plan_funnel_events_plan_created
  ON public.plan_funnel_events (plan_slug, created_at DESC);

-- ============================================================
-- Índices duplicados: cada INSERT/UPDATE precisava manter os dois.
-- ============================================================
DROP INDEX IF EXISTS public.audit_est_idx;              -- == idx_audit_logs_est_created
DROP INDEX IF EXISTS public.tickets_est_status_idx;     -- == idx_tickets_est_status
DROP INDEX IF EXISTS public.support_tickets_status_idx; -- == idx_support_tickets_status
DROP INDEX IF EXISTS public.stamps_card_idx;            -- coberto por idx_stamps_card_created
DROP INDEX IF EXISTS public.rewards_card_idx;           -- == idx_rewards_card
DROP INDEX IF EXISTS public.customers_est_phone;        -- coberto por customers_establishment_id_phone_key

ANALYZE public.establishment_members;
ANALYZE public.stamps;
ANALYZE public.customers;
ANALYZE public.rewards;
