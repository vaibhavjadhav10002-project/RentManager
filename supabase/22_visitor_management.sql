-- ============================================================================
-- VISITOR MANAGEMENT (Phase 5.8)
-- Run this in Supabase Dashboard → SQL Editor → New Query → Run
-- ============================================================================

create table if not exists visitors (
  id uuid primary key default uuid_generate_v4(),
  property_id uuid not null references properties(id) on delete cascade,
  tenant_id uuid references tenants(id) on delete set null, -- who they're visiting; nullable (e.g. a delivery person, or the tenant has since left)
  visitor_name text not null,
  visitor_phone text,
  purpose text,
  check_in_time timestamptz not null default now(),
  check_out_time timestamptz,
  logged_by text, -- free-text name of whoever recorded the entry (owner/manager/security) — no separate staff-accounts feature exists yet
  created_at timestamptz default now()
);

alter table visitors enable row level security;

drop policy if exists "Owners manage visitors for own properties" on visitors;
create policy "Owners manage visitors for own properties" on visitors for all
  using (owns_property(property_id) or get_my_role() = 'super_admin');

create index if not exists idx_visitors_property on visitors(property_id);
create index if not exists idx_visitors_tenant on visitors(tenant_id);
create index if not exists idx_visitors_check_in on visitors(check_in_time);

-- ============================================================================
-- DONE
-- ============================================================================
