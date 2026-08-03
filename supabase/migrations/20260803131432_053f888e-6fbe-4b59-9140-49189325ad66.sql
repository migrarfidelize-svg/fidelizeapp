
-- =========================================================
-- 1. ENUMS
-- =========================================================
DO $$ BEGIN
  ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'out_for_delivery';
EXCEPTION WHEN others THEN NULL; END $$;

CREATE TYPE public.order_payment_status AS ENUM (
  'unpaid','pending','approved','rejected','expired','cancelled',
  'partially_refunded','refunded','chargeback'
);

CREATE TYPE public.order_settlement_mode AS ENUM ('online_platform','on_delivery_direct');

CREATE TYPE public.ledger_entry_type AS ENUM (
  'sale','platform_fee','gateway_fee','delivery_fee','refund','partial_refund',
  'chargeback','adjustment_credit','adjustment_debit','withdrawal_reserved',
  'withdrawal_paid','withdrawal_reversed','offline_sale_info'
);
CREATE TYPE public.ledger_direction AS ENUM ('credit','debit');
CREATE TYPE public.ledger_status AS ENUM ('pending','available','reserved','settled','cancelled');

CREATE TYPE public.est_withdrawal_status AS ENUM (
  'requested','under_review','approved','payment_processing','paid','rejected','cancelled'
);

CREATE TYPE public.customer_link_status AS ENUM ('active','paused','removed');

-- =========================================================
-- 2. ORDERS
-- =========================================================
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS customer_profile_id uuid,
  ADD COLUMN IF NOT EXISTS customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS payment_status public.order_payment_status NOT NULL DEFAULT 'unpaid',
  ADD COLUMN IF NOT EXISTS settlement_mode public.order_settlement_mode NOT NULL DEFAULT 'on_delivery_direct',
  ADD COLUMN IF NOT EXISTS discount_total numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS delivery_fee numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS platform_fee_total numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS gateway_fee_total numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS net_to_establishment numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS refunded_total numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS stamp_granted_at timestamptz,
  ADD COLUMN IF NOT EXISTS idempotency_key text,
  ADD COLUMN IF NOT EXISTS delivery_address_id uuid REFERENCES public.customer_addresses(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS delivery_latitude double precision,
  ADD COLUMN IF NOT EXISTS delivery_longitude double precision,
  ADD COLUMN IF NOT EXISTS minimum_order_validated_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS orders_idempotency_key_uidx ON public.orders(idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS orders_customer_profile_idx ON public.orders(customer_profile_id, created_at DESC);
CREATE INDEX IF NOT EXISTS orders_customer_idx ON public.orders(customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS orders_est_status_idx ON public.orders(establishment_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS orders_est_payment_status_idx ON public.orders(establishment_id, payment_status, created_at DESC);

-- =========================================================
-- 3. AFILIAÇÃO
-- =========================================================
CREATE TABLE public.customer_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  establishment_id uuid NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  status public.customer_link_status NOT NULL DEFAULT 'active',
  joined_via text NOT NULL DEFAULT 'discover',
  consent_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX customer_links_unique ON public.customer_links(profile_id, establishment_id);
CREATE INDEX customer_links_est_idx ON public.customer_links(establishment_id, status);

GRANT SELECT, INSERT, UPDATE ON public.customer_links TO authenticated;
GRANT ALL ON public.customer_links TO service_role;
ALTER TABLE public.customer_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cl_owner_select" ON public.customer_links FOR SELECT TO authenticated
  USING (profile_id = auth.uid() OR public.has_establishment_access(auth.uid(), establishment_id) OR public.is_super_admin(auth.uid()));
CREATE POLICY "cl_owner_insert" ON public.customer_links FOR INSERT TO authenticated
  WITH CHECK (profile_id = auth.uid());
CREATE POLICY "cl_owner_update" ON public.customer_links FOR UPDATE TO authenticated
  USING (profile_id = auth.uid()) WITH CHECK (profile_id = auth.uid());

CREATE TRIGGER customer_links_updated_at BEFORE UPDATE ON public.customer_links
  FOR EACH ROW EXECUTE FUNCTION public.tg_updated_at();

-- =========================================================
-- 4. CONFIG DE CHECKOUT POR ESTABELECIMENTO
-- =========================================================
CREATE TABLE public.establishment_checkout_settings (
  establishment_id uuid PRIMARY KEY REFERENCES public.establishments(id) ON DELETE CASCADE,
  pix_online_enabled boolean NOT NULL DEFAULT false,
  card_online_enabled boolean NOT NULL DEFAULT false,
  pay_on_delivery_enabled boolean NOT NULL DEFAULT true,
  pay_on_pickup_enabled boolean NOT NULL DEFAULT true,
  cash_enabled boolean NOT NULL DEFAULT true,
  card_on_delivery_enabled boolean NOT NULL DEFAULT true,
  pix_on_delivery_enabled boolean NOT NULL DEFAULT true,
  delivery_enabled boolean NOT NULL DEFAULT true,
  pickup_enabled boolean NOT NULL DEFAULT true,
  minimum_order numeric NOT NULL DEFAULT 0,
  delivery_fee_flat numeric NOT NULL DEFAULT 0,
  delivery_fee_per_km numeric NOT NULL DEFAULT 0,
  delivery_radius_km numeric NOT NULL DEFAULT 10,
  eta_minutes integer NOT NULL DEFAULT 45,
  platform_fee_percent numeric NOT NULL DEFAULT 5,
  gateway_fee_percent numeric NOT NULL DEFAULT 0.99,
  release_days_pix integer NOT NULL DEFAULT 1,
  release_days_card integer NOT NULL DEFAULT 14,
  affiliate_discount_percent numeric NOT NULL DEFAULT 0,
  paused boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.establishment_checkout_settings TO authenticated;
GRANT SELECT ON public.establishment_checkout_settings TO anon;
GRANT ALL ON public.establishment_checkout_settings TO service_role;
ALTER TABLE public.establishment_checkout_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ecs_public_read" ON public.establishment_checkout_settings FOR SELECT USING (true);
CREATE POLICY "ecs_manage" ON public.establishment_checkout_settings FOR ALL TO authenticated
  USING (public.has_establishment_role(auth.uid(), establishment_id, 'manager') OR public.is_super_admin(auth.uid()))
  WITH CHECK (public.has_establishment_role(auth.uid(), establishment_id, 'manager') OR public.is_super_admin(auth.uid()));
CREATE TRIGGER ecs_updated_at BEFORE UPDATE ON public.establishment_checkout_settings
  FOR EACH ROW EXECUTE FUNCTION public.tg_updated_at();

-- =========================================================
-- 5. CARRINHO PERSISTENTE
-- =========================================================
CREATE TABLE public.carts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL,
  establishment_id uuid NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX carts_open_unique ON public.carts(profile_id, establishment_id) WHERE status = 'open';

CREATE TABLE public.cart_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cart_id uuid NOT NULL REFERENCES public.carts(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.menu_items(id) ON DELETE CASCADE,
  variant_label text,
  qty integer NOT NULL DEFAULT 1 CHECK (qty > 0 AND qty <= 99),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX cart_items_unique ON public.cart_items(cart_id, item_id, COALESCE(variant_label,''));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.carts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cart_items TO authenticated;
GRANT ALL ON public.carts TO service_role;
GRANT ALL ON public.cart_items TO service_role;
ALTER TABLE public.carts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "carts_own" ON public.carts FOR ALL TO authenticated
  USING (profile_id = auth.uid()) WITH CHECK (profile_id = auth.uid());
CREATE POLICY "cart_items_own" ON public.cart_items FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.carts c WHERE c.id = cart_id AND c.profile_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.carts c WHERE c.id = cart_id AND c.profile_id = auth.uid()));
CREATE TRIGGER carts_updated_at BEFORE UPDATE ON public.carts FOR EACH ROW EXECUTE FUNCTION public.tg_updated_at();
CREATE TRIGGER cart_items_updated_at BEFORE UPDATE ON public.cart_items FOR EACH ROW EXECUTE FUNCTION public.tg_updated_at();

-- =========================================================
-- 6. ORDER EVENTS (imutável)
-- =========================================================
CREATE TABLE public.order_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  previous_status text,
  new_status text,
  event_type text NOT NULL,
  actor_user_id uuid,
  actor_type text NOT NULL DEFAULT 'system',
  reason text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX order_events_order_idx ON public.order_events(order_id, created_at DESC);
GRANT SELECT ON public.order_events TO authenticated;
GRANT ALL ON public.order_events TO service_role;
ALTER TABLE public.order_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "oe_read" ON public.order_events FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id
    AND (o.customer_profile_id = auth.uid() OR public.has_establishment_access(auth.uid(), o.establishment_id) OR public.is_super_admin(auth.uid()))));
CREATE TRIGGER order_events_immutable BEFORE UPDATE OR DELETE ON public.order_events
  FOR EACH ROW EXECUTE FUNCTION public.tg_block_mutation();

-- =========================================================
-- 7. ORDER PAYMENTS
-- =========================================================
CREATE TABLE public.order_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  establishment_id uuid NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  customer_profile_id uuid,
  provider text NOT NULL,
  provider_payment_id text,
  payment_method text NOT NULL,
  status public.order_payment_status NOT NULL DEFAULT 'pending',
  amount numeric NOT NULL CHECK (amount > 0),
  currency text NOT NULL DEFAULT 'BRL',
  external_reference text,
  idempotency_key text,
  raw_status text,
  qr_code text,
  qr_code_base64 text,
  ticket_url text,
  expires_at timestamptz,
  paid_at timestamptz,
  failed_at timestamptz,
  expired_at timestamptz,
  cancelled_at timestamptz,
  refunded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX order_payments_provider_uidx ON public.order_payments(provider, provider_payment_id) WHERE provider_payment_id IS NOT NULL;
CREATE UNIQUE INDEX order_payments_idem_uidx ON public.order_payments(idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX order_payments_order_idx ON public.order_payments(order_id, created_at DESC);
CREATE INDEX order_payments_est_idx ON public.order_payments(establishment_id, status, created_at DESC);

GRANT SELECT ON public.order_payments TO authenticated;
GRANT ALL ON public.order_payments TO service_role;
ALTER TABLE public.order_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "op_read" ON public.order_payments FOR SELECT TO authenticated
  USING (customer_profile_id = auth.uid() OR public.has_establishment_access(auth.uid(), establishment_id) OR public.is_super_admin(auth.uid()));
CREATE TRIGGER order_payments_updated_at BEFORE UPDATE ON public.order_payments
  FOR EACH ROW EXECUTE FUNCTION public.tg_updated_at();

-- =========================================================
-- 8. LEDGER IMUTÁVEL
-- =========================================================
CREATE TABLE public.establishment_ledger_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id uuid NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  payment_id uuid REFERENCES public.order_payments(id) ON DELETE SET NULL,
  withdrawal_id uuid,
  entry_type public.ledger_entry_type NOT NULL,
  direction public.ledger_direction NOT NULL,
  status public.ledger_status NOT NULL DEFAULT 'pending',
  amount numeric NOT NULL CHECK (amount >= 0),
  currency text NOT NULL DEFAULT 'BRL',
  settles_to_platform boolean NOT NULL DEFAULT true,
  description text,
  available_at timestamptz,
  idempotency_key text,
  created_by uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX ledger_idem_uidx ON public.establishment_ledger_entries(idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX ledger_est_idx ON public.establishment_ledger_entries(establishment_id, status, created_at DESC);
CREATE INDEX ledger_release_idx ON public.establishment_ledger_entries(status, available_at) WHERE status = 'pending';

GRANT SELECT ON public.establishment_ledger_entries TO authenticated;
GRANT ALL ON public.establishment_ledger_entries TO service_role;
ALTER TABLE public.establishment_ledger_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ledger_read" ON public.establishment_ledger_entries FOR SELECT TO authenticated
  USING (public.has_establishment_access(auth.uid(), establishment_id) OR public.is_super_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.tg_ledger_immutable()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Livro financeiro é imutável: exclusão não permitida.';
  END IF;
  IF NEW.establishment_id IS DISTINCT FROM OLD.establishment_id
     OR NEW.amount IS DISTINCT FROM OLD.amount
     OR NEW.direction IS DISTINCT FROM OLD.direction
     OR NEW.entry_type IS DISTINCT FROM OLD.entry_type
     OR NEW.order_id IS DISTINCT FROM OLD.order_id
     OR NEW.payment_id IS DISTINCT FROM OLD.payment_id
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Livro financeiro é imutável: campos de origem não podem ser alterados.';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER ledger_immutable BEFORE UPDATE OR DELETE ON public.establishment_ledger_entries
  FOR EACH ROW EXECUTE FUNCTION public.tg_ledger_immutable();

-- =========================================================
-- 9. CHAVE PIX
-- =========================================================
CREATE TABLE public.establishment_payout_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id uuid NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  pix_key_type text NOT NULL,
  pix_key text NOT NULL,
  holder_name text NOT NULL,
  holder_document text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  verified_at timestamptz,
  verified_by uuid,
  last_changed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX epa_est_uidx ON public.establishment_payout_accounts(establishment_id);
GRANT SELECT, INSERT, UPDATE ON public.establishment_payout_accounts TO authenticated;
GRANT ALL ON public.establishment_payout_accounts TO service_role;
ALTER TABLE public.establishment_payout_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "epa_read" ON public.establishment_payout_accounts FOR SELECT TO authenticated
  USING (public.has_establishment_role(auth.uid(), establishment_id, 'manager') OR public.is_super_admin(auth.uid()));
CREATE POLICY "epa_write" ON public.establishment_payout_accounts FOR INSERT TO authenticated
  WITH CHECK (public.has_establishment_role(auth.uid(), establishment_id, 'owner'));
CREATE POLICY "epa_update" ON public.establishment_payout_accounts FOR UPDATE TO authenticated
  USING (public.has_establishment_role(auth.uid(), establishment_id, 'owner'))
  WITH CHECK (public.has_establishment_role(auth.uid(), establishment_id, 'owner'));
CREATE TRIGGER epa_updated_at BEFORE UPDATE ON public.establishment_payout_accounts
  FOR EACH ROW EXECUTE FUNCTION public.tg_updated_at();

-- =========================================================
-- 10. SAQUES
-- =========================================================
CREATE TABLE public.establishment_withdrawals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id uuid NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  requested_by uuid NOT NULL,
  gross_amount numeric NOT NULL CHECK (gross_amount > 0),
  fee_amount numeric NOT NULL DEFAULT 0 CHECK (fee_amount >= 0),
  net_amount numeric NOT NULL CHECK (net_amount > 0),
  pix_key_type_snapshot text NOT NULL,
  pix_key_snapshot text NOT NULL,
  pix_recipient_name_snapshot text NOT NULL,
  status public.est_withdrawal_status NOT NULL DEFAULT 'requested',
  requested_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid,
  paid_at timestamptz,
  paid_by uuid,
  rejected_at timestamptz,
  rejected_by uuid,
  rejection_reason text,
  admin_notes text,
  proof_file_path text,
  transaction_reference text,
  idempotency_key text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX ew_idem_uidx ON public.establishment_withdrawals(idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE UNIQUE INDEX ew_one_active_uidx ON public.establishment_withdrawals(establishment_id)
  WHERE status IN ('requested','under_review','approved','payment_processing');
CREATE INDEX ew_status_idx ON public.establishment_withdrawals(status, requested_at DESC);

GRANT SELECT, INSERT ON public.establishment_withdrawals TO authenticated;
GRANT ALL ON public.establishment_withdrawals TO service_role;
ALTER TABLE public.establishment_withdrawals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ew_read" ON public.establishment_withdrawals FOR SELECT TO authenticated
  USING (public.has_establishment_access(auth.uid(), establishment_id) OR public.is_super_admin(auth.uid()));

ALTER TABLE public.establishment_ledger_entries
  ADD CONSTRAINT ledger_withdrawal_fk FOREIGN KEY (withdrawal_id)
  REFERENCES public.establishment_withdrawals(id) ON DELETE SET NULL;

CREATE TABLE public.withdrawal_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  withdrawal_id uuid NOT NULL REFERENCES public.establishment_withdrawals(id) ON DELETE CASCADE,
  previous_status text,
  new_status text NOT NULL,
  actor_user_id uuid,
  actor_role text NOT NULL DEFAULT 'system',
  reason text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX we_wd_idx ON public.withdrawal_events(withdrawal_id, created_at DESC);
GRANT SELECT ON public.withdrawal_events TO authenticated;
GRANT ALL ON public.withdrawal_events TO service_role;
ALTER TABLE public.withdrawal_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "we_read" ON public.withdrawal_events FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.establishment_withdrawals w WHERE w.id = withdrawal_id
    AND (public.has_establishment_access(auth.uid(), w.establishment_id) OR public.is_super_admin(auth.uid()))));
CREATE TRIGGER we_immutable BEFORE UPDATE OR DELETE ON public.withdrawal_events
  FOR EACH ROW EXECUTE FUNCTION public.tg_block_mutation();

CREATE TRIGGER ew_updated_at BEFORE UPDATE ON public.establishment_withdrawals
  FOR EACH ROW EXECUTE FUNCTION public.tg_updated_at();

-- =========================================================
-- 11. CARIMBO VINCULADO AO PEDIDO
-- =========================================================
ALTER TABLE public.stamps ADD COLUMN IF NOT EXISTS order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS stamps_order_uidx ON public.stamps(order_id) WHERE order_id IS NOT NULL;

-- =========================================================
-- 12. RESUMO FINANCEIRO (calculado pelo ledger)
-- =========================================================
CREATE OR REPLACE FUNCTION public.get_establishment_financial_summary(_est uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE r jsonb;
BEGIN
  IF NOT (public.has_establishment_access(auth.uid(), _est) OR public.is_super_admin(auth.uid())) THEN
    RAISE EXCEPTION 'Sem permissão para consultar o financeiro deste estabelecimento.';
  END IF;

  SELECT jsonb_build_object(
    'gross_sales', COALESCE(SUM(amount) FILTER (WHERE entry_type='sale' AND status <> 'cancelled'), 0),
    'online_sales', COALESCE(SUM(amount) FILTER (WHERE entry_type='sale' AND settles_to_platform AND status <> 'cancelled'), 0),
    'offline_sales', COALESCE(SUM(amount) FILTER (WHERE entry_type='offline_sale_info'), 0),
    'platform_fees', COALESCE(SUM(amount) FILTER (WHERE entry_type='platform_fee' AND status <> 'cancelled'), 0),
    'gateway_fees', COALESCE(SUM(amount) FILTER (WHERE entry_type='gateway_fee' AND status <> 'cancelled'), 0),
    'refunds', COALESCE(SUM(amount) FILTER (WHERE entry_type IN ('refund','partial_refund')), 0),
    'chargebacks', COALESCE(SUM(amount) FILTER (WHERE entry_type='chargeback'), 0),
    'withdrawn_total', COALESCE(SUM(amount) FILTER (WHERE entry_type='withdrawal_paid'), 0),
    'pending_balance', COALESCE(SUM(CASE WHEN status='pending' AND settles_to_platform THEN (CASE WHEN direction='credit' THEN amount ELSE -amount END) ELSE 0 END), 0),
    'available_balance', COALESCE(SUM(CASE WHEN status='available' AND settles_to_platform THEN (CASE WHEN direction='credit' THEN amount ELSE -amount END) ELSE 0 END), 0),
    'reserved_balance', COALESCE(SUM(CASE WHEN status='reserved' AND settles_to_platform THEN (CASE WHEN direction='credit' THEN amount ELSE -amount END) ELSE 0 END), 0),
    'net_total', COALESCE(SUM(CASE WHEN settles_to_platform AND status <> 'cancelled' THEN (CASE WHEN direction='credit' THEN amount ELSE -amount END) ELSE 0 END), 0)
  ) INTO r
  FROM public.establishment_ledger_entries WHERE establishment_id = _est;

  r := r || jsonb_build_object(
    'reserved_balance', ABS((r->>'reserved_balance')::numeric),
    'negative_balance', GREATEST(0, -1 * ((r->>'available_balance')::numeric)),
    'withdrawals_in_review', (SELECT COALESCE(SUM(gross_amount),0) FROM public.establishment_withdrawals
       WHERE establishment_id=_est AND status IN ('requested','under_review','approved','payment_processing'))
  );
  RETURN r;
END $$;

REVOKE ALL ON FUNCTION public.get_establishment_financial_summary(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_establishment_financial_summary(uuid) TO authenticated, service_role;

-- =========================================================
-- 13. SOLICITAÇÃO DE SAQUE (transacional, com lock)
-- =========================================================
CREATE OR REPLACE FUNCTION public.request_establishment_withdrawal(_est uuid, _amount numeric, _idem text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_available numeric;
  v_acc public.establishment_payout_accounts%ROWTYPE;
  v_id uuid;
BEGIN
  IF NOT public.has_establishment_role(auth.uid(), _est, 'owner') THEN
    RAISE EXCEPTION 'Apenas o proprietário pode solicitar saque.';
  END IF;
  IF _amount IS NULL OR _amount <= 0 THEN RAISE EXCEPTION 'Valor inválido.'; END IF;

  PERFORM 1 FROM public.establishments WHERE id = _est FOR UPDATE;

  SELECT * INTO v_acc FROM public.establishment_payout_accounts WHERE establishment_id = _est;
  IF v_acc.id IS NULL THEN RAISE EXCEPTION 'Cadastre uma chave Pix antes de solicitar saque.'; END IF;

  IF EXISTS (SELECT 1 FROM public.establishment_withdrawals
             WHERE establishment_id=_est AND status IN ('requested','under_review','approved','payment_processing')) THEN
    RAISE EXCEPTION 'Já existe um saque em andamento.';
  END IF;

  SELECT COALESCE(SUM(CASE WHEN direction='credit' THEN amount ELSE -amount END),0) INTO v_available
  FROM public.establishment_ledger_entries
  WHERE establishment_id=_est AND status='available' AND settles_to_platform;

  IF _amount > v_available THEN RAISE EXCEPTION 'Saldo disponível insuficiente.'; END IF;

  INSERT INTO public.establishment_withdrawals
    (establishment_id, requested_by, gross_amount, fee_amount, net_amount,
     pix_key_type_snapshot, pix_key_snapshot, pix_recipient_name_snapshot, idempotency_key)
  VALUES (_est, auth.uid(), _amount, 0, _amount,
     v_acc.pix_key_type, v_acc.pix_key, v_acc.holder_name, _idem)
  RETURNING id INTO v_id;

  INSERT INTO public.establishment_ledger_entries
    (establishment_id, withdrawal_id, entry_type, direction, status, amount, description, idempotency_key, created_by)
  VALUES (_est, v_id, 'withdrawal_reserved', 'debit', 'reserved', _amount,
          'Reserva de saldo para saque', 'wd_reserve:'||v_id::text, auth.uid());

  INSERT INTO public.withdrawal_events (withdrawal_id, previous_status, new_status, actor_user_id, actor_role, reason)
  VALUES (v_id, NULL, 'requested', auth.uid(), 'establishment', 'Solicitação criada pelo lojista');

  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.request_establishment_withdrawal(uuid, numeric, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_establishment_withdrawal(uuid, numeric, text) TO authenticated;

-- =========================================================
-- 14. LIBERAÇÃO DE SALDO (job idempotente)
-- =========================================================
CREATE OR REPLACE FUNCTION public.release_due_ledger_entries()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n integer;
BEGIN
  UPDATE public.establishment_ledger_entries
     SET status = 'available'
   WHERE status = 'pending' AND available_at IS NOT NULL AND available_at <= now();
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.release_due_ledger_entries() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.release_due_ledger_entries() TO service_role;
