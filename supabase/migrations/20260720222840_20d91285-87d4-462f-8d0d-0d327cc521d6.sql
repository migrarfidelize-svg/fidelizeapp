
DO $$
DECLARE
  v_pay_id text := 'pay_4w60hdb6qysiiaug';
  v_est uuid;
  v_plan_slug text;
  v_plan_id uuid;
  v_tier text;
BEGIN
  UPDATE public.payments
     SET status = 'approved', status_detail = 'RECEIVED',
         approved_at = COALESCE(approved_at, now()), updated_at = now()
   WHERE provider = 'asaas' AND provider_payment_id = v_pay_id
  RETURNING establishment_id, plan_slug INTO v_est, v_plan_slug;

  IF v_est IS NULL OR v_plan_slug IS NULL THEN RETURN; END IF;
  SELECT id, tier::text INTO v_plan_id, v_tier FROM public.plans WHERE slug = v_plan_slug;
  IF v_plan_id IS NULL THEN RETURN; END IF;

  UPDATE public.establishments SET plan = v_tier::plan_tier WHERE id = v_est;

  INSERT INTO public.subscriptions (establishment_id, plan_id, tier, status, provider, external_id,
                                    current_period_start, current_period_end, next_billing_date, cancel_at_period_end)
  VALUES (v_est, v_plan_id, v_tier::plan_tier, 'active', 'asaas', v_pay_id,
          now(), now() + interval '1 month', now() + interval '1 month', false)
  ON CONFLICT (establishment_id) DO UPDATE
     SET plan_id = EXCLUDED.plan_id, tier = EXCLUDED.tier, status = 'active',
         provider = 'asaas', external_id = EXCLUDED.external_id,
         current_period_start = EXCLUDED.current_period_start,
         current_period_end = EXCLUDED.current_period_end,
         next_billing_date = EXCLUDED.next_billing_date,
         cancel_at_period_end = false, updated_at = now();
END $$;
