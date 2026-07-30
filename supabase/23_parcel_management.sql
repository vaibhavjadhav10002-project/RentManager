-- ============================================================================
-- PARCEL MANAGEMENT (Phase 5.9)
-- Run this in Supabase Dashboard → SQL Editor → New Query → Run
-- ============================================================================

create table if not exists parcels (
  id uuid primary key default uuid_generate_v4(),
  property_id uuid not null references properties(id) on delete cascade,
  tenant_id uuid references tenants(id) on delete set null,
  courier_name text,
  tracking_number text,
  description text,
  received_at timestamptz not null default now(),
  received_by text, -- free-text, same "no staff-accounts feature yet" caveat as visitors.logged_by
  collected_at timestamptz,
  created_at timestamptz default now()
);

alter table parcels enable row level security;

drop policy if exists "Owners manage parcels for own properties" on parcels;
create policy "Owners manage parcels for own properties" on parcels for all
  using (owns_property(property_id) or get_my_role() = 'super_admin');

drop policy if exists "Tenants view own parcels" on parcels;
create policy "Tenants view own parcels" on parcels for select
  using (tenant_id in (select id from tenants where auth_user_id = auth.uid()));

create index if not exists idx_parcels_property on parcels(property_id);
create index if not exists idx_parcels_tenant on parcels(tenant_id);
create index if not exists idx_parcels_received_at on parcels(received_at);

-- ============================================================================
-- DONE
-- ============================================================================
