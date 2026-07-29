-- ============================================================================
-- PHASE 3.4: Move-Out Request + Move-Out Checklist
-- Run this in Supabase Dashboard → SQL Editor → New Query → Run
-- ============================================================================

create type move_out_status as enum ('pending', 'approved', 'rejected');

create table if not exists move_out_requests (
  id uuid primary key default uuid_generate_v4(),
  property_id uuid not null references properties(id) on delete cascade,
  tenant_id uuid not null references tenants(id) on delete cascade,
  requested_date date not null,      -- tenant's intended move-out date
  reason text,
  status move_out_status not null default 'pending',
  owner_note text,
  decided_at timestamptz,
  created_at timestamptz default now()
);

alter table move_out_requests enable row level security;

-- Same shape as leave_requests / rent_extension_requests / complaints.
drop policy if exists "View move-out requests of own properties or self" on move_out_requests;
create policy "View move-out requests of own properties or self" on move_out_requests for select
  using (
    get_my_role() = 'super_admin' or owns_property(property_id)
    or tenant_id in (select id from tenants where auth_user_id = auth.uid())
  );

drop policy if exists "Tenants create own move-out requests" on move_out_requests;
create policy "Tenants create own move-out requests" on move_out_requests for insert
  with check (
    tenant_id in (select id from tenants where auth_user_id = auth.uid())
    or owns_property(property_id) or get_my_role() = 'super_admin'
  );

drop policy if exists "Owners decide move-out requests" on move_out_requests;
create policy "Owners decide move-out requests" on move_out_requests for update
  using (owns_property(property_id) or get_my_role() = 'super_admin');

create index if not exists idx_move_out_requests_property on move_out_requests(property_id);
create index if not exists idx_move_out_requests_tenant on move_out_requests(tenant_id);

-- ── Move-Out Checklist ──────────────────────────────────────────────────────
-- One checklist per tenant's move-out. Owner-managed (checks items off);
-- the tenant can only view progress, not edit it — matches the existing
-- deposit-settlement fields on `tenants`, which are also owner-only.
create table if not exists move_out_checklists (
  id uuid primary key default uuid_generate_v4(),
  property_id uuid not null references properties(id) on delete cascade,
  tenant_id uuid not null references tenants(id) on delete cascade,
  move_out_request_id uuid references move_out_requests(id) on delete set null,
  items jsonb not null default '[]'::jsonb,   -- [{ label, checked, checked_at }]
  completed boolean not null default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table move_out_checklists enable row level security;

drop policy if exists "View move-out checklists of own properties or self" on move_out_checklists;
create policy "View move-out checklists of own properties or self" on move_out_checklists for select
  using (
    get_my_role() = 'super_admin' or owns_property(property_id)
    or tenant_id in (select id from tenants where auth_user_id = auth.uid())
  );

drop policy if exists "Owners manage move-out checklists" on move_out_checklists;
create policy "Owners manage move-out checklists" on move_out_checklists for insert
  with check (owns_property(property_id) or get_my_role() = 'super_admin');

drop policy if exists "Owners update move-out checklists" on move_out_checklists;
create policy "Owners update move-out checklists" on move_out_checklists for update
  using (owns_property(property_id) or get_my_role() = 'super_admin');

create index if not exists idx_move_out_checklists_tenant on move_out_checklists(tenant_id);

-- ============================================================================
-- DONE
-- ============================================================================
