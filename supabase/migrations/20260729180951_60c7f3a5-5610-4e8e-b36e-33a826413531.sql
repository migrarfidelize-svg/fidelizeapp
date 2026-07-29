BEGIN;

-- 1) Inverter ordem de exibição: Profissional (id=2c5e...) vira ordem 2, Premium (id=3a95...) vira ordem 3
UPDATE public.plans SET display_order = CASE id
  WHEN '2c5ecfc1-560a-4a49-8b89-c0042b705575' THEN 2
  WHEN '3a95c4ed-75c1-4e77-8d90-69b8c9dd3939' THEN 3
  ELSE display_order
END WHERE id IN ('2c5ecfc1-560a-4a49-8b89-c0042b705575', '3a95c4ed-75c1-4e77-8d90-69b8c9dd3939');

-- 2) Trocar os rótulos do enum plan_tier entre 'pro' e 'enterprise' via nome temporário
ALTER TYPE plan_tier RENAME VALUE 'pro' TO '__temp_swap';
ALTER TYPE plan_tier RENAME VALUE 'enterprise' TO 'pro';
ALTER TYPE plan_tier RENAME VALUE '__temp_swap' TO 'enterprise';

COMMIT;