
DO $$
DECLARE
  new_uid uuid := gen_random_uuid();
BEGIN
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data, is_super_admin, confirmation_token,
    email_change, email_change_token_new, recovery_token
  ) VALUES (
    '00000000-0000-0000-0000-000000000000', new_uid, 'authenticated', 'authenticated',
    'pinhodsg@gmail.com', crypt('@Salmos2300', gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Admin Pinho"}'::jsonb,
    false, '', '', '', ''
  );

  INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
  VALUES (gen_random_uuid(), new_uid,
    jsonb_build_object('sub', new_uid::text, 'email', 'pinhodsg@gmail.com', 'email_verified', true),
    'email', new_uid::text, now(), now(), now());

  INSERT INTO public.profiles (id, full_name) VALUES (new_uid, 'Admin Pinho') ON CONFLICT DO NOTHING;
  INSERT INTO public.app_roles (user_id, role) VALUES (new_uid, 'super_admin') ON CONFLICT DO NOTHING;
END $$;
