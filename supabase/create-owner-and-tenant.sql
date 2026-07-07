-- ============================================================================
-- CREATE ONE TEST OWNER + ONE TEST TENANT — ready to log in immediately
-- Run this whole file once in Supabase SQL Editor.
--
-- Creates:
--   1. A PG Owner login (email + password you set below)
--   2. One property + one room owned by them
--   3. A Tenant login (phone number + password you set below) already
--      linked to that room, with rent/deposit filled in, so the Tenant
--      Portal has real data to show immediately.
--
-- ⚠️ Same caveat as create-user.sql: this writes directly into Supabase's
-- internal auth.users/auth.identities tables. If it errors with a column
-- mismatch, use the normal signup UI instead and just update the
-- `tenants` row manually afterward.
-- ============================================================================

create extension if not exists pgcrypto;

do $$
declare
  -- ── EDIT THESE ────────────────────────────────────────────────────────
  owner_email     text := 'owner@example.com';
  owner_password  text := 'ChangeMe123!';
  owner_name      text := 'Test Owner';
  owner_phone     text := '9876500000';

  property_name   text := 'Test PG';
  property_city   text := 'Bangalore';
  room_number     text := '101';
  room_rent       numeric := 8000;

  tenant_name       text := 'Test Tenant';
  tenant_phone      text := '9876511111';   -- becomes their login username
  tenant_password   text := 'Tenant123!';   -- min 6 chars
  tenant_deposit    numeric := 16000;
  tenant_deposit_paid numeric := 16000;
  -- ─────────────────────────────────────────────────────────────────────

  owner_user_id uuid;
  tenant_user_id uuid;
  tenant_login_email text;
  prop_id uuid;
  room_id uuid;
  encrypted_pw text;
begin
  if length(owner_password) < 6 or length(tenant_password) < 6 then
    raise exception 'Passwords must be at least 6 characters';
  end if;

  tenant_login_email := tenant_phone || '@pgmanager.local';

  if exists (select 1 from auth.users where email = owner_email) then
    raise exception 'A user with email % already exists.', owner_email;
  end if;
  if exists (select 1 from auth.users where email = tenant_login_email) then
    raise exception 'A tenant login for phone % already exists.', tenant_phone;
  end if;

  -- ── 1. Create the Owner login ──────────────────────────────────────────
  owner_user_id := uuid_generate_v4();
  encrypted_pw := crypt(owner_password, gen_salt('bf'));

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, confirmation_token, recovery_token,
    email_change_token_new, email_change
  ) values (
    '00000000-0000-0000-0000-000000000000', owner_user_id, 'authenticated', 'authenticated',
    owner_email, encrypted_pw, now(),
    '{"provider":"email","providers":["email"]}',
    jsonb_build_object('full_name', owner_name, 'role', 'pg_owner'),
    now(), now(), '', '', '', ''
  );

  insert into auth.identities (
    id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
  ) values (
    uuid_generate_v4(), owner_user_id,
    jsonb_build_object('sub', owner_user_id::text, 'email', owner_email),
    'email', owner_user_id::text, now(), now(), now()
  );

  -- The on_auth_user_created trigger already created a matching `profiles`
  -- row automatically — just fill in the phone number.
  update public.profiles set phone = owner_phone where id = owner_user_id;

  -- ── 2. Create a property + room for this owner ─────────────────────────
  insert into properties (owner_id, name, city, state, qr_slug)
  values (owner_user_id, property_name, property_city, 'Karnataka', 'test-pg-' || substr(owner_user_id::text, 1, 8))
  returning id into prop_id;

  insert into rooms (property_id, room_number, floor, sharing_type, total_beds, monthly_rent, notes)
  values (prop_id, room_number, 1, '2 Sharing', 2, room_rent, 'Seeded test room')
  returning id into room_id;

  -- ── 3. Create the Tenant login ──────────────────────────────────────────
  tenant_user_id := uuid_generate_v4();
  encrypted_pw := crypt(tenant_password, gen_salt('bf'));

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, confirmation_token, recovery_token,
    email_change_token_new, email_change
  ) values (
    '00000000-0000-0000-0000-000000000000', tenant_user_id, 'authenticated', 'authenticated',
    tenant_login_email, encrypted_pw, now(),
    '{"provider":"email","providers":["email"]}',
    jsonb_build_object('full_name', tenant_name, 'role', 'tenant'),
    now(), now(), '', '', '', ''
  );

  insert into auth.identities (
    id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
  ) values (
    uuid_generate_v4(), tenant_user_id,
    jsonb_build_object('sub', tenant_user_id::text, 'email', tenant_login_email),
    'email', tenant_user_id::text, now(), now(), now()
  );

  update public.profiles set phone = tenant_phone where id = tenant_user_id;

  -- ── 4. Create the actual tenants table row, linked to the room ─────────
  -- This is what makes the Tenant Portal show real rent/room/deposit info —
  -- the auth login alone isn't enough.
  insert into tenants (
    auth_user_id, property_id, room_id, bed_label, name, phone,
    joining_date, monthly_rent, deposit_amount, deposit_paid,
    status, submitted_via, notice_period_days
  ) values (
    tenant_user_id, prop_id, room_id, 'A', tenant_name, tenant_phone,
    current_date, room_rent, tenant_deposit, tenant_deposit_paid,
    'active', 'owner_added', 30
  );

  raise notice '─────────────────────────────────────────────';
  raise notice 'Owner login  → email: %  |  password: %', owner_email, owner_password;
  raise notice 'Tenant login → phone: %  |  password: %', tenant_phone, tenant_password;
  raise notice 'Both can log in at /login on your app.';
  raise notice '─────────────────────────────────────────────';
end $$;
