
CREATE INDEX IF NOT EXISTS idx_stamps_card_created ON public.stamps(card_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stamps_est_created ON public.stamps(establishment_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_loyalty_cards_customer ON public.loyalty_cards(customer_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_cards_est_campaign ON public.loyalty_cards(establishment_id, campaign_id);
CREATE INDEX IF NOT EXISTS idx_customers_est_created ON public.customers(establishment_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_customers_est_last_visit ON public.customers(establishment_id, last_visit_at DESC);
CREATE INDEX IF NOT EXISTS idx_rewards_card ON public.rewards(card_id);
CREATE INDEX IF NOT EXISTS idx_payments_est_status ON public.payments(establishment_id, status);
CREATE INDEX IF NOT EXISTS idx_payments_status_created ON public.payments(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tickets_est_status ON public.tickets(establishment_id, status);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON public.support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_est_status ON public.subscriptions(establishment_id, status);
CREATE INDEX IF NOT EXISTS idx_audit_logs_est_created ON public.audit_logs(establishment_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_logs_created ON public.email_logs(created_at DESC);

CREATE OR REPLACE FUNCTION public.mark_past_due_subscriptions()
RETURNS TABLE(marked_past_due int, blocked int)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_past_due int := 0; v_blocked int := 0;
BEGIN
  WITH upd AS (
    UPDATE public.subscriptions
       SET status = 'past_due', updated_at = now()
     WHERE status = 'active'
       AND current_period_end IS NOT NULL
       AND current_period_end < (now() - interval '3 days')
     RETURNING id
  )
  SELECT count(*) INTO v_past_due FROM upd;

  WITH blk AS (
    UPDATE public.establishments e
       SET active = false, updated_at = now()
      FROM public.subscriptions s
     WHERE s.establishment_id = e.id
       AND s.status = 'past_due'
       AND s.current_period_end IS NOT NULL
       AND s.current_period_end < (now() - interval '10 days')
       AND e.active = true
     RETURNING e.id
  )
  SELECT count(*) INTO v_blocked FROM blk;

  RETURN QUERY SELECT v_past_due, v_blocked;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.mark_past_due_subscriptions() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_past_due_subscriptions() TO service_role;

CREATE OR REPLACE FUNCTION public.delete_my_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  DELETE FROM public.establishment_members WHERE user_id = uid;
  DELETE FROM public.helpdesk_members WHERE user_id = uid;
  DELETE FROM public.app_roles WHERE user_id = uid;
  DELETE FROM public.profiles WHERE id = uid;
  DELETE FROM auth.users WHERE id = uid;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.delete_my_account() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_my_account() TO authenticated;
