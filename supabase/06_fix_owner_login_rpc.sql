-- ============================================================================
-- FIX: "Add PG Owner" (Super Admin panel) was calling supabase.auth.signUp()
-- — the same broken GoTrue signup path fixed for tenants in
-- 04_fix_tenant_login_rpc.sql. This creates the equivalent for PG owners.
--
-- Run this in Supabase Dashboard → SQL Editor → New Query → Run
-- ============================================================================

create or replace function create_owner_login(
  p_email text,
  p_password text,
  p_full_name text,
  p_phone text default null
) returns uuid
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  new_user_id uuid;
  caller_role user_role;
begin
  -- only super admins may create PG owner logins
  select role into caller_role from profiles where id = auth.uid();
  if caller_role is null or caller_role <> 'super_admin' then
    raise exception 'Not authorized to create owner logins';
  end if;

  new_user_id := gen_random_uuid();

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, confirmation_token, recovery_token,
    email_change_token_new, email_change
  ) values (
    '00000000-0000-0000-0000-000000000000',
    new_user_id, 'authenticated', 'authenticated',
    p_email,
    crypt(p_password, gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    jsonb_build_object('full_name', p_full_name, 'role', 'pg_owner'),
    now(), now(), '', '', '', ''
  );

  insert into auth.identities (
    id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
  ) values (
    gen_random_uuid(), new_user_id, new_user_id::text,
    jsonb_build_object('sub', new_user_id::text, 'email', p_email, 'email_verified', true),
    'email', now(), now(), now()
  );

  if p_phone is not null then
    update profiles set phone = p_phone where id = new_user_id;
  end if;

  return new_user_id;
end;
$$;

grant execute on function create_owner_login(text, text, text, text) to authenticated;

-- ============================================================================
-- DONE
-- ============================================================================
