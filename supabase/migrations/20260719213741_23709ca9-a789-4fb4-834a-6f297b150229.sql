
-- Seed the "public_reviews" plan feature so Super Admin can toggle it per plan.
-- Default: enabled on 'pro' and 'enterprise'; disabled on 'free' and 'starter'.
INSERT INTO public.plan_features (plan_id, feature_key, feature_name, enabled)
SELECT p.id, 'public_reviews', 'Avaliações públicas de atendimento (QR + página)',
       CASE WHEN p.tier IN ('pro','enterprise') THEN true ELSE false END
FROM public.plans p
ON CONFLICT (plan_id, feature_key) DO NOTHING;
