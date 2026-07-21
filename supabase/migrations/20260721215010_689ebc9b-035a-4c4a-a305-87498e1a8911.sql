
-- 1. account_type enum + column on profiles
DO $$ BEGIN
  CREATE TYPE public.account_type AS ENUM ('customer','establishment','super_admin');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS account_type public.account_type NOT NULL DEFAULT 'customer';

-- 2. customers.user_id (self-claim link)
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS customers_est_user_unique
  ON public.customers(establishment_id, user_id)
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS customers_user_id_idx
  ON public.customers(user_id)
  WHERE user_id IS NOT NULL;

-- 3. helper: is the user a member of ANY establishment (admin surface)
CREATE OR REPLACE FUNCTION public.is_establishment_user(_user uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.establishment_members
    WHERE user_id = _user AND active = true
  );
$$;
REVOKE EXECUTE ON FUNCTION public.is_establishment_user(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_establishment_user(uuid) TO authenticated, service_role;

-- 4. helper: current account type (for post-login redirect)
CREATE OR REPLACE FUNCTION public.my_account_type()
RETURNS public.account_type
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RETURN NULL; END IF;
  IF EXISTS (SELECT 1 FROM public.app_roles WHERE user_id = uid AND role = 'super_admin') THEN
    RETURN 'super_admin';
  END IF;
  IF EXISTS (SELECT 1 FROM public.establishment_members WHERE user_id = uid AND active = true) THEN
    RETURN 'establishment';
  END IF;
  RETURN 'customer';
END; $$;
REVOKE EXECUTE ON FUNCTION public.my_account_type() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_account_type() TO authenticated, service_role;

-- 5. Backfill profiles.account_type from existing data (safe, does not remove anything)
UPDATE public.profiles p
   SET account_type = CASE
     WHEN EXISTS (SELECT 1 FROM public.app_roles r WHERE r.user_id = p.id AND r.role = 'super_admin') THEN 'super_admin'::public.account_type
     WHEN EXISTS (SELECT 1 FROM public.establishment_members m WHERE m.user_id = p.id AND m.active = true) THEN 'establishment'::public.account_type
     ELSE 'customer'::public.account_type
   END;

-- 6. RLS: customer self-read on their own customer rows / cards / stamps / rewards
DROP POLICY IF EXISTS "cust_self_read" ON public.customers;
CREATE POLICY "cust_self_read" ON public.customers
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "cust_self_update" ON public.customers;
CREATE POLICY "cust_self_update" ON public.customers
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "card_self_read" ON public.loyalty_cards;
CREATE POLICY "card_self_read" ON public.loyalty_cards
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.customers c WHERE c.id = customer_id AND c.user_id = auth.uid()));

DROP POLICY IF EXISTS "stamps_self_read" ON public.stamps;
CREATE POLICY "stamps_self_read" ON public.stamps
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.loyalty_cards lc
    JOIN public.customers c ON c.id = lc.customer_id
    WHERE lc.id = stamps.card_id AND c.user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "rewards_self_read" ON public.rewards;
CREATE POLICY "rewards_self_read" ON public.rewards
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.loyalty_cards lc
    JOIN public.customers c ON c.id = lc.customer_id
    WHERE lc.id = rewards.card_id AND c.user_id = auth.uid()
  ));
