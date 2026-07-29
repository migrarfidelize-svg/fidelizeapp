-- Swap enum labels pro <-> enterprise so Premium=enterprise, Profissional=pro
ALTER TYPE plan_tier RENAME VALUE 'pro' TO 'pro_tmp';
ALTER TYPE plan_tier RENAME VALUE 'enterprise' TO 'pro';
ALTER TYPE plan_tier RENAME VALUE 'pro_tmp' TO 'enterprise';

-- Fix display order: Premium last (highest), Profissional middle
UPDATE public.plans SET display_order = 3 WHERE name = 'Premium';
UPDATE public.plans SET display_order = 2 WHERE name = 'Profissional';