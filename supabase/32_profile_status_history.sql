-- ============================================================================
-- PHASE 8.5: Profile Status System — Persistent Status History
-- Run this in Supabase Dashboard → SQL Editor → New Query → Run
-- ============================================================================
-- tenants.onboarding_status (Phase 8.1, supabase/29_tenant_invitations.sql)
-- already holds the CURRENT step of the ladder. This table adds the missing
-- piece for Phase 8.5: a persistent, append-only record of every step a
-- tenant's profile has moved through, so both the Owner Timeline and Tenant
-- Timeline can render full history instead of just the current status.
--
-- Follows the exact same shape/pattern as `room_changes`
-- (supabase/25_room_change_log.sql) — the established audit-log convention
-- in this project. Nothing about the existing onboarding_status column,
-- pending_profile column, or correction_note column changes.

create table if not exists profile_status_history (
  id uuid primary key default uuid_generate_v4(),
  property_id uuid not null references properties(id) on delete cascade,
  tenant_id uuid not null references tenants(id) on delete cascade,
  from_status text,
  to_status text not null,
  note text,
  changed_by text, -- 'tenant' or 'owner', same free-text convention as room_changes.changed_by
  changed_at timestamptz default now()
);

alter table profile_status_history enable row level security;

drop policy if exists "Owners manage profile status history for own properties" on profile_status_history;
create policy "Owners manage profile status history for own properties" on profile_status_history for all
  using (owns_property(property_id) or get_my_role() = 'super_admin');

-- Tenants may read (not write) their own profile's history, so the Tenant
-- Timeline can render it directly from the client the same way the owner's
-- view does.
drop policy if exists "Tenants read own profile status history" on profile_status_history;
create policy "Tenants read own profile status history" on profile_status_history for select
  using (tenant_id in (select id from tenants where auth_user_id = auth.uid()));

create index if not exists idx_profile_status_history_tenant on profile_status_history(tenant_id, changed_at);
create index if not exists idx_profile_status_history_property on profile_status_history(property_id);

-- ============================================================================
-- DONE
-- ============================================================================
