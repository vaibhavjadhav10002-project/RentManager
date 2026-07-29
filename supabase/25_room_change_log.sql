-- ============================================================================
-- ROOM CHANGE LOG (Phase 5.11)
-- Run this in Supabase Dashboard → SQL Editor → New Query → Run
-- ============================================================================
-- This does NOT alter the tenants or rooms tables — the actual move just
-- updates tenants.room_id / tenants.bed_label via the existing updateTenant()
-- function. This table only records that it happened, for an audit trail.

create table if not exists room_changes (
  id uuid primary key default uuid_generate_v4(),
  property_id uuid not null references properties(id) on delete cascade,
  tenant_id uuid references tenants(id) on delete set null,
  from_room_id uuid references rooms(id) on delete set null,
  to_room_id uuid references rooms(id) on delete set null,
  reason text,
  changed_by text, -- free-text, same convention as visitors.logged_by / parcels.received_by
  changed_at timestamptz default now()
);

alter table room_changes enable row level security;

drop policy if exists "Owners manage room changes for own properties" on room_changes;
create policy "Owners manage room changes for own properties" on room_changes for all
  using (owns_property(property_id) or get_my_role() = 'super_admin');

create index if not exists idx_room_changes_property on room_changes(property_id);
create index if not exists idx_room_changes_tenant on room_changes(tenant_id);

-- ============================================================================
-- DONE
-- ============================================================================
