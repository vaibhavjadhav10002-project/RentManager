-- ============================================================================
-- COMBINED MIGRATION — run this ONE file to catch up on everything from
-- 05, 06, 07, 08 in one go. Safe to re-run (uses IF NOT EXISTS / OR REPLACE
-- everywhere), so it won't break anything if you've already run some of them.
-- ============================================================================

-- ---- 05: first-login forced password change ----
alter table profiles add column if not exists must_change_password boolean not null default true;

-- ---- 08: deposit refund + rent-paid-at-joining tracking ----
alter table tenants add column if not exists deposit_refunded numeric(10,2) not null default 0;
alter table tenants add column if not exists deposit_refund_date date;
alter table tenants add column if not exists deposit_deduction_notes text;
alter table tenants add column if not exists rent_paid_at_joining numeric(10,2) not null default 0;

-- ---- 09: electricity / utility bills (new) ----
do $$ begin
  create type utility_bill_status as enum ('pending', 'paid', 'pending_approval');
exception when duplicate_object then null; end $$;

create table if not exists utility_bills (
  id uuid primary key default uuid_generate_v4(),
  property_id uuid not null references properties(id) on delete cascade,
  tenant_id uuid not null references tenants(id) on delete cascade,
  bill_type text not null default 'Electricity',
  for_month text not null,
  amount numeric(10,2) not null,
  due_date date,
  status utility_bill_status not null default 'pending',
  paid_date date,
  method payment_method,
  submitted_by_tenant boolean default false,
  tenant_note text,
  created_at timestamptz default now()
);

alter table utility_bills enable row level security;
alter table utility_bills add column if not exists tenant_note text;

drop policy if exists "View utility bills of own property or self" on utility_bills;
create policy "View utility bills of own property or self" on utility_bills for select
  using (
    get_my_role() = 'super_admin' or owns_property(property_id)
    or tenant_id in (select id from tenants where auth_user_id = auth.uid())
  );

drop policy if exists "Owners manage utility bills" on utility_bills;
create policy "Owners manage utility bills" on utility_bills for all
  using (owns_property(property_id) or get_my_role() = 'super_admin');

drop policy if exists "Tenants submit own bill payment claims" on utility_bills;
create policy "Tenants submit own bill payment claims" on utility_bills for update
  using (tenant_id in (select id from tenants where auth_user_id = auth.uid()))
  with check (tenant_id in (select id from tenants where auth_user_id = auth.uid()));

create index if not exists idx_utility_bills_property on utility_bills(property_id);
create index if not exists idx_utility_bills_tenant on utility_bills(tenant_id);

-- ---- 06: fix "Add PG Owner" (bypasses broken GoTrue signup) ----
create or replace function create_owner_login(
  p_email text, p_password text, p_full_name text, p_phone text default null
) returns uuid
language plpgsql security definer
set search_path = public, auth, extensions
as $$
declare
  new_user_id uuid;
  caller_role user_role;
begin
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
    '00000000-0000-0000-0000-000000000000', new_user_id, 'authenticated', 'authenticated',
    p_email, crypt(p_password, gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}',
    jsonb_build_object('full_name', p_full_name, 'role', 'pg_owner'),
    now(), now(), '', '', '', ''
  );
  insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (gen_random_uuid(), new_user_id, new_user_id::text,
    jsonb_build_object('sub', new_user_id::text, 'email', p_email, 'email_verified', true),
    'email', now(), now(), now());
  if p_phone is not null then update profiles set phone = p_phone where id = new_user_id; end if;
  return new_user_id;
end;
$$;
grant execute on function create_owner_login(text, text, text, text) to authenticated;

-- ---- 07: CRITICAL security fix — privilege escalation ----
create or replace function prevent_profile_privilege_escalation() returns trigger as $$
begin
  if new.role is distinct from old.role and get_my_role() <> 'super_admin' then
    raise exception 'You are not allowed to change your own role';
  end if;
  if new.is_active is distinct from old.is_active and get_my_role() <> 'super_admin' then
    raise exception 'You are not allowed to change your own active status';
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_prevent_profile_privilege_escalation on profiles;
create trigger trg_prevent_profile_privilege_escalation
  before update on profiles for each row execute function prevent_profile_privilege_escalation();

drop policy if exists "Owners update tenants, tenants update own row" on tenants;
drop policy if exists "Owners update tenants" on tenants;
create policy "Owners update tenants" on tenants for update
  using (owns_property(property_id) or get_my_role() = 'super_admin');

-- ---- 10: allow anonymous QR-join submissions to also record their initial
-- rent-paid-at-joining payment claim (previously only the tenant row itself
-- could be inserted anonymously; the payment record was silently blocked
-- by RLS, so "rent paid at joining" never reduced pending rent) ----
drop policy if exists "Public can submit initial payment with QR join" on payments;
create policy "Public can submit initial payment with QR join" on payments for insert
  with check (
    submitted_by_tenant = true
    and approval_status = 'pending_approval'
    and tenant_id in (select id from tenants where status = 'pending_approval' and submitted_via = 'qr_link')
  );

-- ============================================================================
-- DONE — you're now fully caught up
-- ============================================================================
