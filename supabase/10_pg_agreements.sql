-- ============================================================================
-- PG RENTAL AGREEMENT SYSTEM
-- Run this in Supabase Dashboard → SQL Editor → New Query → Run
-- ============================================================================

create type agreement_status as enum ('pending', 'signed', 'active', 'expired');

create table if not exists agreements (
  id uuid primary key default uuid_generate_v4(),
  agreement_number text unique not null,
  tenant_id uuid references tenants(id) on delete cascade,
  property_id uuid not null references properties(id) on delete cascade,
  room_id uuid references rooms(id) on delete set null,

  start_date date not null,
  end_date date not null,
  duration_months int not null default 11,
  rent_cycle text not null default 'Monthly',

  monthly_rent numeric(10,2) not null,
  security_deposit numeric(10,2) not null default 0,
  electricity_charges text not null default 'As per meter reading',
  maintenance_charges numeric(10,2) not null default 0,
  other_charges numeric(10,2) not null default 0,
  other_charges_note text,
  due_day int not null default 5,
  late_fee_policy text not null default '₹50 per day after the due date',

  government_id text,
  terms_version text not null default 'v1.0',

  tenant_accepted boolean not null default false,
  tenant_signature text,
  tenant_signed_name text,
  tenant_signed_at timestamptz,

  owner_signature text,
  owner_signed_name text,
  owner_signed_at timestamptz,

  status agreement_status not null default 'pending',
  created_at timestamptz default now()
);

alter table agreements enable row level security;

-- Owners see/manage agreements for their own properties
drop policy if exists "Owners manage agreements" on agreements;
create policy "Owners manage agreements" on agreements for all
  using (owns_property(property_id) or get_my_role() = 'super_admin');

-- Tenants can view their own agreement
drop policy if exists "Tenants view own agreement" on agreements;
create policy "Tenants view own agreement" on agreements for select
  using (tenant_id in (select id from tenants where auth_user_id = auth.uid()));

-- Anonymous QR-join submissions can create their own agreement at signup time
drop policy if exists "Public can submit agreement with QR join" on agreements;
create policy "Public can submit agreement with QR join" on agreements for insert
  with check (
    tenant_id in (select id from tenants where status = 'pending_approval' and submitted_via = 'qr_link')
  );

create index if not exists idx_agreements_tenant on agreements(tenant_id);
create index if not exists idx_agreements_property on agreements(property_id);

-- Lets an anonymous QR-join visitor see just the owner's display name
-- (for the agreement's "Owner/Manager Name" field) without exposing the
-- full profiles table, which RLS otherwise correctly locks down.
create or replace function get_property_owner_name(p_property_id uuid) returns text
language sql security definer stable
as $$
  select p.full_name from properties pr join profiles p on p.id = pr.owner_id where pr.id = p_property_id;
$$;
grant execute on function get_property_owner_name(uuid) to anon, authenticated;

-- ---- Storage bucket for tenant Government ID photos ----
insert into storage.buckets (id, name, public)
values ('tenant-documents', 'tenant-documents', true)
on conflict (id) do nothing;

drop policy if exists "Public can upload tenant documents" on storage.objects;
create policy "Public can upload tenant documents" on storage.objects for insert
  with check (bucket_id = 'tenant-documents');

drop policy if exists "Public can view tenant documents" on storage.objects;
create policy "Public can view tenant documents" on storage.objects for select
  using (bucket_id = 'tenant-documents');

-- ============================================================================
-- DONE
-- ============================================================================
