-- ============================================================================
-- PHASE 3.1: Temporary Leave Request + Leave History
-- Run this in Supabase Dashboard → SQL Editor → New Query → Run
-- ============================================================================

create type leave_status as enum ('pending', 'approved', 'rejected');

create table if not exists leave_requests (
  id uuid primary key default uuid_generate_v4(),
  property_id uuid not null references properties(id) on delete cascade,
  tenant_id uuid not null references tenants(id) on delete cascade,
  start_date date not null,
  end_date date not null,
  reason text,
  status leave_status not null default 'pending',
  owner_note text,
  decided_at timestamptz,
  created_at timestamptz default now()
);

alter table leave_requests enable row level security;

-- Mirrors the existing "complaints" policy shape: owner (own properties) or
-- the tenant themselves can see a request; only the owner can decide on it.
drop policy if exists "View leave requests of own properties or self" on leave_requests;
create policy "View leave requests of own properties or self" on leave_requests for select
  using (
    get_my_role() = 'super_admin' or owns_property(property_id)
    or tenant_id in (select id from tenants where auth_user_id = auth.uid())
  );

drop policy if exists "Tenants create own leave requests" on leave_requests;
create policy "Tenants create own leave requests" on leave_requests for insert
  with check (
    tenant_id in (select id from tenants where auth_user_id = auth.uid())
    or owns_property(property_id) or get_my_role() = 'super_admin'
  );

drop policy if exists "Owners decide leave requests" on leave_requests;
create policy "Owners decide leave requests" on leave_requests for update
  using (owns_property(property_id) or get_my_role() = 'super_admin');

create index if not exists idx_leave_requests_property on leave_requests(property_id);
create index if not exists idx_leave_requests_tenant on leave_requests(tenant_id);

-- ============================================================================
-- DONE
-- ============================================================================
