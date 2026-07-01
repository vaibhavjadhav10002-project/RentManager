-- ============================================================================
-- MANUALLY CREATE USERS (bypasses the Supabase Dashboard "Add User" button,
-- which uses the Admin/Management API — this instead inserts directly into
-- the database, which is not affected by Admin API issues)
--
-- BEFORE RUNNING: replace 'CHANGE_ME_PASSWORD_1' and 'CHANGE_ME_PASSWORD_2'
-- below with the actual passwords you want to use.
--
-- Run this in Supabase Dashboard → SQL Editor → New Query → Run
-- ============================================================================

-- ---- USER 1: Super Admin ----
do $$
declare
  new_user_id uuid := gen_random_uuid();
begin
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, confirmation_token, recovery_token,
    email_change_token_new, email_change
  ) values (
    '00000000-0000-0000-0000-000000000000',
    new_user_id,
    'authenticated',
    'authenticated',
    'vaibhavjadhav10002@gmail.com',
    crypt('CHANGE_ME_PASSWORD_1', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Vaibhav Jadhav","role":"super_admin"}',
    now(), now(), '', '', '', ''
  );

  insert into auth.identities (
    id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
  ) values (
    gen_random_uuid(), new_user_id, new_user_id::text,
    jsonb_build_object('sub', new_user_id::text, 'email', 'vaibhavjadhav10002@gmail.com', 'email_verified', true),
    'email', now(), now(), now()
  );
end $$;

-- ---- USER 2: Demo PG Owner ----
do $$
declare
  new_user_id uuid := gen_random_uuid();
begin
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, confirmation_token, recovery_token,
    email_change_token_new, email_change
  ) values (
    '00000000-0000-0000-0000-000000000000',
    new_user_id,
    'authenticated',
    'authenticated',
    'demo2@gmail.com',
    crypt('CHANGE_ME_PASSWORD_2', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Demo Owner","role":"pg_owner"}',
    now(), now(), '', '', '', ''
  );

  insert into auth.identities (
    id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
  ) values (
    gen_random_uuid(), new_user_id, new_user_id::text,
    jsonb_build_object('sub', new_user_id::text, 'email', 'demo2@gmail.com', 'email_verified', true),
    'email', now(), now(), now()
  );
end $$;

-- ---- VERIFY ----
-- The on_auth_user_created trigger fires automatically on insert above,
-- so profiles rows should already exist with the correct roles. Confirm:
select id, email, full_name, role from profiles
where email in ('vaibhavjadhav10002@gmail.com', 'demo2@gmail.com');
