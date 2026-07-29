UPDATE public.plans SET display_order = CASE id
  WHEN '3a95c4ed-75c1-4e77-8d90-69b8c9dd3939' THEN 3
  WHEN '2c5ecfc1-560a-4a49-8b89-c0042b705575' THEN 2
  ELSE display_order
END WHERE id IN ('3a95c4ed-75c1-4e77-8d90-69b8c9dd3939', '2c5ecfc1-560a-4a49-8b89-c0042b705575');