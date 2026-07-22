
CREATE TABLE public.achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT 'Award',
  rarity TEXT NOT NULL DEFAULT 'common' CHECK (rarity IN ('common','rare','epic','legendary')),
  criteria_type TEXT NOT NULL CHECK (criteria_type IN ('stamps_total','rewards_total','establishments_total','tier_reached','weekly_streak','first_stamp','first_reward','referrals_total')),
  criteria_value INT NOT NULL DEFAULT 1,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.achievements TO anon, authenticated;
GRANT ALL ON public.achievements TO service_role;
ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "achievements_public_read"
  ON public.achievements FOR SELECT
  USING (is_active = true);

CREATE TABLE public.customer_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  achievement_code TEXT NOT NULL REFERENCES public.achievements(code) ON DELETE CASCADE,
  establishment_id UUID REFERENCES public.establishments(id) ON DELETE SET NULL,
  unlocked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  seen_at TIMESTAMPTZ,
  UNIQUE (user_id, achievement_code)
);

CREATE INDEX idx_customer_achievements_user ON public.customer_achievements(user_id, unlocked_at DESC);

GRANT SELECT, INSERT, UPDATE ON public.customer_achievements TO authenticated;
GRANT ALL ON public.customer_achievements TO service_role;
ALTER TABLE public.customer_achievements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "customer_achievements_owner_read"
  ON public.customer_achievements FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "customer_achievements_owner_update_seen"
  ON public.customer_achievements FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.check_and_unlock_achievements(_user_id UUID)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stamps_total INT := 0;
  v_rewards_total INT := 0;
  v_establishments_total INT := 0;
  v_max_tier_rank INT := 1;
  v_unlocked_count INT := 0;
  ach RECORD;
  v_match BOOLEAN;
BEGIN
  IF _user_id IS NULL THEN RETURN 0; END IF;

  SELECT COUNT(*)::int INTO v_stamps_total
    FROM public.stamps s
    JOIN public.loyalty_cards lc ON lc.id = s.card_id
    JOIN public.customers c ON c.id = lc.customer_id
   WHERE c.user_id = _user_id
     AND s.reverted_at IS NULL;

  SELECT COUNT(*)::int INTO v_rewards_total
    FROM public.rewards r
    JOIN public.loyalty_cards lc ON lc.id = r.card_id
    JOIN public.customers c ON c.id = lc.customer_id
   WHERE c.user_id = _user_id
     AND r.redeemed_at IS NOT NULL;

  SELECT COUNT(DISTINCT c.establishment_id)::int INTO v_establishments_total
    FROM public.customers c
   WHERE c.user_id = _user_id;

  SELECT COALESCE(MAX(
    CASE tier::text
      WHEN 'diamante' THEN 4
      WHEN 'ouro' THEN 3
      WHEN 'prata' THEN 2
      WHEN 'bronze' THEN 1
      ELSE 0
    END
  ), 1) INTO v_max_tier_rank
    FROM public.customers WHERE user_id = _user_id;

  FOR ach IN
    SELECT a.* FROM public.achievements a
    WHERE a.is_active = true
      AND NOT EXISTS (
        SELECT 1 FROM public.customer_achievements ca
        WHERE ca.user_id = _user_id AND ca.achievement_code = a.code
      )
  LOOP
    v_match := false;
    CASE ach.criteria_type
      WHEN 'first_stamp' THEN v_match := v_stamps_total >= 1;
      WHEN 'stamps_total' THEN v_match := v_stamps_total >= ach.criteria_value;
      WHEN 'first_reward' THEN v_match := v_rewards_total >= 1;
      WHEN 'rewards_total' THEN v_match := v_rewards_total >= ach.criteria_value;
      WHEN 'establishments_total' THEN v_match := v_establishments_total >= ach.criteria_value;
      WHEN 'tier_reached' THEN v_match := v_max_tier_rank >= ach.criteria_value;
      ELSE v_match := false;
    END CASE;

    IF v_match THEN
      INSERT INTO public.customer_achievements (user_id, achievement_code)
      VALUES (_user_id, ach.code)
      ON CONFLICT DO NOTHING;
      v_unlocked_count := v_unlocked_count + 1;
    END IF;
  END LOOP;

  RETURN v_unlocked_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_and_unlock_achievements(UUID) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.tg_stamps_check_achievements()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_user UUID;
BEGIN
  IF NEW.reverted_at IS NOT NULL THEN RETURN NEW; END IF;
  SELECT c.user_id INTO v_user
    FROM public.loyalty_cards lc
    JOIN public.customers c ON c.id = lc.customer_id
   WHERE lc.id = NEW.card_id;
  IF v_user IS NOT NULL THEN
    PERFORM public.check_and_unlock_achievements(v_user);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_stamps_check_achievements ON public.stamps;
CREATE TRIGGER trg_stamps_check_achievements
  AFTER INSERT ON public.stamps
  FOR EACH ROW EXECUTE FUNCTION public.tg_stamps_check_achievements();

CREATE OR REPLACE FUNCTION public.tg_rewards_check_achievements()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_user UUID;
BEGIN
  IF NEW.redeemed_at IS NULL OR OLD.redeemed_at IS NOT NULL THEN RETURN NEW; END IF;
  SELECT c.user_id INTO v_user
    FROM public.loyalty_cards lc
    JOIN public.customers c ON c.id = lc.customer_id
   WHERE lc.id = NEW.card_id;
  IF v_user IS NOT NULL THEN
    PERFORM public.check_and_unlock_achievements(v_user);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_rewards_check_achievements ON public.rewards;
CREATE TRIGGER trg_rewards_check_achievements
  AFTER UPDATE OF redeemed_at ON public.rewards
  FOR EACH ROW EXECUTE FUNCTION public.tg_rewards_check_achievements();

INSERT INTO public.achievements (code, title, description, icon, rarity, criteria_type, criteria_value, sort_order) VALUES
  ('first_stamp',        'Primeiro passo',           'Receba seu primeiro carimbo',                        'Sparkles', 'common',    'first_stamp',           1,  10),
  ('stamps_10',          'Cliente fiel',             'Acumule 10 carimbos',                                'Stamp',    'common',    'stamps_total',         10,  20),
  ('stamps_25',          'Frequentador',             'Acumule 25 carimbos',                                'Stamp',    'rare',      'stamps_total',         25,  30),
  ('stamps_50',          'Fã de carteirinha',        'Acumule 50 carimbos',                                'Medal',    'rare',      'stamps_total',         50,  40),
  ('stamps_100',         'Cliente lendário',         'Acumule 100 carimbos',                               'Trophy',   'epic',      'stamps_total',        100,  50),
  ('stamps_500',         'Ícone da casa',            'Acumule 500 carimbos',                               'Crown',    'legendary', 'stamps_total',        500,  60),
  ('first_reward',       'Primeiro prêmio',          'Resgate seu primeiro prêmio',                        'Gift',     'common',    'first_reward',          1,  70),
  ('rewards_5',          'Colecionador de prêmios',  'Resgate 5 prêmios',                                  'Gift',     'rare',      'rewards_total',         5,  80),
  ('rewards_15',         'Caçador de recompensas',   'Resgate 15 prêmios',                                 'Trophy',   'epic',      'rewards_total',        15,  90),
  ('establishments_3',   'Explorador',               'Colecione cartões de 3 estabelecimentos',            'Compass',  'common',    'establishments_total',  3, 100),
  ('establishments_5',   'Aventureiro',              'Colecione cartões de 5 estabelecimentos',            'Map',      'rare',      'establishments_total',  5, 110),
  ('establishments_10',  'Descobridor',              'Colecione cartões de 10 estabelecimentos',           'Globe',    'epic',      'establishments_total', 10, 120),
  ('tier_prata',         'Cliente Prata',            'Alcance o tier Prata em qualquer estabelecimento',   'Award',    'common',    'tier_reached',          2, 200),
  ('tier_ouro',          'Cliente Ouro',             'Alcance o tier Ouro em qualquer estabelecimento',    'Award',    'rare',      'tier_reached',          3, 210),
  ('tier_diamante',      'Cliente Diamante',         'Alcance o tier Diamante em qualquer estabelecimento','Gem',      'legendary', 'tier_reached',          4, 220);
