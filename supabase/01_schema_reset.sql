-- ============================================================================
-- PG MANAGEMENT SAAS — SCHEMA (SAFE RESET + CREATE)
-- Run this ENTIRE file in Supabase Dashboard → SQL Editor → New Query → Run
-- Safe to run even if a previous attempt partially failed — it drops
-- anything that might already exist before recreating everything fresh.
-- ============================================================================

-- ---- 0. CLEAN SLATE (drops nothing in auth.users — only this app's tables) ----
drop table if exists expenses cascade;
drop table if exists complaints cascade;
drop table if exists payments cascade;
drop table if exists collectors cascade;
drop table if exists tenants cascade;
drop table if exists rooms cascade;
drop table if exists properties cascade;
drop table if exists profiles cascade;

drop function if exists handle_new_user cascade;
drop function if exists get_my_role cascade;
drop function if exists owns_property cascade;
drop function if exists tenant_belongs_to_property cascade;

drop type if exists user_role cascade;
drop type if exists tenant_status cascade;
drop type if exists kyc_status cascade;
drop type if exists payment_type cascade;
drop type if exists payment_method cascade;
drop type if exists payment_approval_status cascade;
drop type if exists complaint_priority cascade;
drop type if exists complaint_status cascade;

create extension if not exists "uuid-ossp";

-- ============================================================================
-- 1. PROFILES
-- ============================================================================
create type user_role as enum ('super_admin', 'pg_owner', 'tenant');

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role user_role not null default 'pg_owner',
  full_name text not null,
  phone text,
  email text,
  is_active boolean default true,
  created_at timestamptz default now()
);

-- ============================================================================
-- 2. PROPERTIES
-- ============================================================================
create table properties (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid not null references profiles(id) on delete cascade,
  name text not null,
  address text,
  city text,
  state text default 'Karnataka',
  qr_slug text unique not null,
  bank_account_name text,
  bank_account_number text,
  bank_ifsc text,
  upi_id text,
  created_at timestamptz default now()
);

-- ============================================================================
-- 3. ROOMS
-- ============================================================================
create table rooms (
  id uuid primary key default uuid_generate_v4(),
  property_id uuid not null references properties(id) on delete cascade,
  room_number text not null,
  floor int default 1,
  sharing_type text not null,
  total_beds int not null,
  monthly_rent numeric(10,2) not null,
  notes text,
  photo_urls text[],
  created_at timestamptz default now(),
  unique(property_id, room_number)
);

-- ============================================================================
-- 4. TENANTS
-- ============================================================================
create type tenant_status as enum ('active', 'leaving', 'left', 'pending_approval');
create type kyc_status as enum ('pending', 'verified', 'rejected');

create table tenants (
  id uuid primary key default uuid_generate_v4(),
  auth_user_id uuid references auth.users(id) on delete set null,
  property_id uuid not null references properties(id) on delete cascade,
  room_id uuid references rooms(id) on delete set null,
  bed_label text,
  name text not null,
  phone text not null,
  email text,
  emergency_contact text,
  photo_url text,
  aadhaar_url text,
  aadhaar_status kyc_status default 'pending',
  pan_url text,
  pan_status kyc_status default 'pending',
  agreement_url text,
  notice_period_days int default 30,
  joining_date date not null,
  leaving_date date,
  monthly_rent numeric(10,2) not null,
  deposit_amount numeric(10,2) not null default 0,
  deposit_paid numeric(10,2) not null default 0,
  deposit_refunded numeric(10,2) not null default 0,
  deposit_refund_date date,
  deposit_deduction_notes text,
  rent_paid_at_joining numeric(10,2) not null default 0,
  status tenant_status not null default 'pending_approval',
  submitted_via text default 'owner_added',
  approved_by uuid references profiles(id),
  approved_at timestamptz,
  created_at timestamptz default now()
);

-- ============================================================================
-- 5. COLLECTORS
-- ============================================================================
create table collectors (
  id uuid primary key default uuid_generate_v4(),
  property_id uuid not null references properties(id) on delete cascade,
  name text not null,
  created_at timestamptz default now()
);

-- ============================================================================
-- 6. PAYMENTS
-- ============================================================================
create type payment_type as enum ('rent', 'deposit', 'advance');
create type payment_method as enum ('upi', 'cash', 'bank_transfer');
create type payment_approval_status as enum ('approved', 'pending_approval', 'rejected');

create table payments (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  property_id uuid not null references properties(id) on delete cascade,
  type payment_type not null default 'rent',
  for_month text,
  total_due numeric(10,2) not null,
  amount_received numeric(10,2) not null,
  method payment_method,
  collected_by uuid references collectors(id),
  approval_status payment_approval_status not null default 'approved',
  submitted_by_tenant boolean default false,
  tenant_note text,
  screenshot_url text,
  payment_date date not null default current_date,
  created_at timestamptz default now()
);

-- ============================================================================
-- 7. COMPLAINTS
-- ============================================================================
create type complaint_priority as enum ('low', 'medium', 'high');
create type complaint_status as enum ('open', 'in_progress', 'resolved');

create table complaints (
  id uuid primary key default uuid_generate_v4(),
  property_id uuid not null references properties(id) on delete cascade,
  tenant_id uuid references tenants(id) on delete set null,
  room_id uuid references rooms(id) on delete set null,
  issue_type text not null,
  description text,
  priority complaint_priority default 'medium',
  status complaint_status default 'open',
  assigned_to text,
  attachment_url text,
  resolved_at timestamptz,
  created_at timestamptz default now()
);

-- ============================================================================
-- 8. EXPENSES
-- ============================================================================
create table expenses (
  id uuid primary key default uuid_generate_v4(),
  property_id uuid not null references properties(id) on delete cascade,
  category text not null,
  amount numeric(10,2) not null,
  notes text,
  expense_date date not null default current_date,
  created_at timestamptz default now()
);

-- ============================================================================
-- 9. INDEXES
-- ============================================================================
create index idx_rooms_property on rooms(property_id);
create index idx_tenants_property on tenants(property_id);
create index idx_payments_property on payments(property_id);
create index idx_payments_tenant on payments(tenant_id);
create index idx_complaints_property on complaints(property_id);
create index idx_expenses_property on expenses(property_id);
create index idx_properties_owner on properties(owner_id);

-- ============================================================================
-- 10. ROW LEVEL SECURITY
-- ============================================================================
alter table profiles enable row level security;
alter table properties enable row level security;
alter table rooms enable row level security;
alter table tenants enable row level security;
alter table collectors enable row level security;
alter table payments enable row level security;
alter table complaints enable row level security;
alter table expenses enable row level security;

create or replace function get_my_role() returns user_role as $$
  select role from profiles where id = auth.uid();
$$ language sql security definer stable;

create or replace function owns_property(prop_id uuid) returns boolean as $$
  select exists (
    select 1 from properties
    where id = prop_id and owner_id = auth.uid()
  );
$$ language sql security definer stable;

create or replace function tenant_belongs_to_property(prop_id uuid) returns boolean as $$
  select exists (
    select 1 from tenants
    where property_id = prop_id and auth_user_id = auth.uid()
  );
$$ language sql security definer stable;

-- ---- PROFILES policies ----
create policy "Super admin sees all profiles" on profiles for select
  using (get_my_role() = 'super_admin' or id = auth.uid());
create policy "Users update own profile" on profiles for update
  using (id = auth.uid());
create policy "Super admin creates profiles" on profiles for insert
  with check (get_my_role() = 'super_admin' or id = auth.uid());

-- ---- PROPERTIES policies ----
create policy "Super admin sees all properties" on properties for select
  using (get_my_role() = 'super_admin' or owner_id = auth.uid() or tenant_belongs_to_property(id));
create policy "Owners manage own properties" on properties for insert
  with check (owner_id = auth.uid() or get_my_role() = 'super_admin');
create policy "Owners update own properties" on properties for update
  using (owner_id = auth.uid() or get_my_role() = 'super_admin');
create policy "Owners delete own properties" on properties for delete
  using (owner_id = auth.uid() or get_my_role() = 'super_admin');

-- ---- ROOMS policies ----
create policy "View rooms of own/all properties" on rooms for select
  using (get_my_role() = 'super_admin' or owns_property(property_id) or tenant_belongs_to_property(property_id));
create policy "Manage rooms of own properties" on rooms for insert
  with check (owns_property(property_id) or get_my_role() = 'super_admin');
create policy "Update rooms of own properties" on rooms for update
  using (owns_property(property_id) or get_my_role() = 'super_admin');
create policy "Delete rooms of own properties" on rooms for delete
  using (owns_property(property_id) or get_my_role() = 'super_admin');

-- ---- TENANTS policies ----
create policy "View tenants of own properties or self" on tenants for select
  using (get_my_role() = 'super_admin' or owns_property(property_id) or auth_user_id = auth.uid());
create policy "Owners add tenants" on tenants for insert
  with check (owns_property(property_id) or get_my_role() = 'super_admin');
create policy "Owners update tenants" on tenants for update
  using (owns_property(property_id) or get_my_role() = 'super_admin');
create policy "Owners delete tenants" on tenants for delete
  using (owns_property(property_id) or get_my_role() = 'super_admin');

create policy "Public can submit pending tenant requests" on tenants for insert
  with check (status = 'pending_approval' and submitted_via = 'qr_link');

create policy "Public can submit initial payment with QR join" on payments for insert
  with check (
    submitted_by_tenant = true
    and approval_status = 'pending_approval'
    and tenant_id in (select id from tenants where status = 'pending_approval' and submitted_via = 'qr_link')
  );

-- ---- COLLECTORS policies ----
create policy "View collectors of own properties" on collectors for select
  using (get_my_role() = 'super_admin' or owns_property(property_id) or tenant_belongs_to_property(property_id));
create policy "Manage collectors of own properties" on collectors for all
  using (owns_property(property_id) or get_my_role() = 'super_admin');

-- ---- PAYMENTS policies ----
create policy "View payments of own properties or self" on payments for select
  using (
    get_my_role() = 'super_admin' or owns_property(property_id)
    or tenant_id in (select id from tenants where auth_user_id = auth.uid())
  );
create policy "Owners record payments" on payments for insert
  with check (owns_property(property_id) or get_my_role() = 'super_admin');
create policy "Tenants submit own paid claims" on payments for insert
  with check (
    submitted_by_tenant = true
    and tenant_id in (select id from tenants where auth_user_id = auth.uid())
  );
create policy "Owners update payments (approve/reject)" on payments for update
  using (owns_property(property_id) or get_my_role() = 'super_admin');

-- ---- COMPLAINTS policies ----
create policy "View complaints of own properties or self" on complaints for select
  using (
    get_my_role() = 'super_admin' or owns_property(property_id)
    or tenant_id in (select id from tenants where auth_user_id = auth.uid())
  );
create policy "Owners and tenants create complaints" on complaints for insert
  with check (
    owns_property(property_id) or get_my_role() = 'super_admin'
    or tenant_belongs_to_property(property_id)
  );
create policy "Owners update complaints" on complaints for update
  using (owns_property(property_id) or get_my_role() = 'super_admin');

-- ---- EXPENSES policies ----
create policy "View expenses of own properties" on expenses for select
  using (get_my_role() = 'super_admin' or owns_property(property_id));
create policy "Owners manage expenses" on expenses for all
  using (owns_property(property_id) or get_my_role() = 'super_admin');

-- ============================================================================
-- 11. AUTO-CREATE PROFILE ON SIGNUP (trigger)
-- ============================================================================
create or replace function handle_new_user() returns trigger as $$
begin
  insert into public.profiles (id, full_name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', 'New User'),
    new.email,
    coalesce((new.raw_user_meta_data->>'role')::user_role, 'pg_owner')
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ============================================================================
-- 12. PREVENT SELF PRIVILEGE ESCALATION (trigger)
-- Blocks a non-super-admin from changing their own `role` or `is_active`
-- even though they're otherwise allowed to update their own profile row.
-- ============================================================================
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

create trigger trg_prevent_profile_privilege_escalation
  before update on profiles
  for each row execute function prevent_profile_privilege_escalation();

-- ============================================================================
-- DONE — schema created successfully
-- ============================================================================
