-- ============================================================================
-- FIX: Tenant login creation via app (Add Tenant / Approve Tenant) was
-- calling supabase.auth.signUp() which hits GoTrue's public signup endpoint
-- — same broken path as the Dashboard "Add User" button (500 errors).
--
-- This creates a safe SQL function that inserts directly into auth.users +
-- auth.identities (same reliable technique as 03_manual_create_users.sql),
-- fully bypassing GoTrue's signup endpoint. Only PG Owners / Super Admins
-- can call it (enforced inside the function), and it can ONLY create
-- 'tenant' role logins — it cannot be used to escalate privileges.
--
-- Run this ONCE in Supabase Dashboard → SQL Editor → New Query → Run
-- ============================================================================

create or replace function create_tenant_login(
  p_phone text,
  p_password text,
  p_full_name text
) returns uuid
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  new_user_id uuid;
  caller_role user_role;
  synthetic_email text := p_phone || '@pgmanager.local';
begin
  -- only PG owners / super admins may create tenant logins
  select role into caller_role from profiles where id = auth.uid();
  if caller_role is null or caller_role not in ('pg_owner', 'super_admin') then
    raise exception 'Not authorized to create tenant logins';
  end if;

  -- if a login already exists for this phone, just return its id
  select id into new_user_id from auth.users where email = synthetic_email;
  if new_user_id is not null then
    return new_user_id;
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
    synthetic_email,
    crypt(p_password, gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    jsonb_build_object('full_name', p_full_name, 'role', 'tenant'),
    now(), now(), '', '', '', ''
  );

  insert into auth.identities (
    id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
  ) values (
    gen_random_uuid(), new_user_id, new_user_id::text,
    jsonb_build_object('sub', new_user_id::text, 'email', synthetic_email, 'email_verified', true),
    'email', now(), now(), now()
  );

  return new_user_id;
end;
$$;

grant execute on function create_tenant_login(text, text, text) to authenticated;

-- ============================================================================
-- DONE
-- ============================================================================
