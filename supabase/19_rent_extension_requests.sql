-- ============================================================================
-- PHASE 3.3: Rent Extension Request + Approval Workflow
-- Run this in Supabase Dashboard → SQL Editor → New Query → Run
-- ============================================================================

create type rent_extension_status as enum ('pending', 'approved', 'rejected');

create table if not exists rent_extension_requests (
  id uuid primary key default uuid_generate_v4(),
  property_id uuid not null references properties(id) on delete cascade,
  tenant_id uuid not null references tenants(id) on delete cascade,
  for_month text not null,           -- billing month label, e.g. "January 2026" — matches the tenant portal ledger's month labels
  requested_until date not null,     -- the new date the tenant is asking to pay by
  reason text,
  status rent_extension_status not null default 'pending',
  owner_note text,
  decided_at timestamptz,
  created_at timestamptz default now()
);

alter table rent_extension_requests enable row level security;

-- Same shape as the leave_requests / complaints policies: owner sees their
-- own-property requests, tenant sees only their own, only the owner decides.
drop policy if exists "View rent extension requests of own properties or self" on rent_extension_requests;
create policy "View rent extension requests of own properties or self" on rent_extension_requests for select
  using (
    get_my_role() = 'super_admin' or owns_property(property_id)
    or tenant_id in (select id from tenants where auth_user_id = auth.uid())
  );

drop policy if exists "Tenants create own rent extension requests" on rent_extension_requests;
create policy "Tenants create own rent extension requests" on rent_extension_requests for insert
  with check (
    tenant_id in (select id from tenants where auth_user_id = auth.uid())
    or owns_property(property_id) or get_my_role() = 'super_admin'
  );

drop policy if exists "Owners decide rent extension requests" on rent_extension_requests;
create policy "Owners decide rent extension requests" on rent_extension_requests for update
  using (owns_property(property_id) or get_my_role() = 'super_admin');

create index if not exists idx_rent_extension_requests_property on rent_extension_requests(property_id);
create index if not exists idx_rent_extension_requests_tenant on rent_extension_requests(tenant_id);

-- ============================================================================
-- DONE
-- ============================================================================
