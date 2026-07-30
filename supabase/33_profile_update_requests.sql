-- ============================================================================
-- PHASE 8.7: Profile Update Requests
-- Run this in Supabase Dashboard → SQL Editor → New Query → Run
-- ============================================================================
-- After approval (Phase 8.4), a tenant can no longer edit their profile
-- directly. This table is the Request → Owner Review → Approve/Reject →
-- Live Update flow's audit trail — every request a tenant ever raised,
-- kept permanently (never deleted, only status-updated), which doubles as
-- the "maintain full audit history" requirement without needing a second
-- history table: the row's own requested_at / decided_at / status IS the
-- history.
--
-- Only "personal profile information" fields are ever eligible here — the
-- same set the Onboarding Wizard (Phase 8.3) already collects. Owner-
-- controlled fields (room, bed, rent, deposit, joining date, agreement
-- dates, tenant status) are never part of requested_changes and are never
-- touched by decideProfileUpdateRequest().
--
-- RLS shape mirrors leave_requests (supabase/18_leave_requests.sql) exactly:
-- combined owner-or-self select policy, tenant-only insert, owner-only
-- update. No delete policy for anyone — this table is append/update-only,
-- by design, so the audit trail can never be erased.

create table if not exists profile_update_requests (
  id uuid primary key default uuid_generate_v4(),
  property_id uuid not null references properties(id) on delete cascade,
  tenant_id uuid not null references tenants(id) on delete cascade,
  requested_changes jsonb not null, -- { field: new_value, ... } — personal fields only
  reason text,
  status text not null default 'pending', -- 'pending' | 'approved' | 'rejected'
  owner_note text,
  decided_at timestamptz,
  decided_by uuid references profiles(id) on delete set null,
  created_at timestamptz default now()
);

alter table profile_update_requests enable row level security;

drop policy if exists "View profile update requests of own properties or self" on profile_update_requests;
create policy "View profile update requests of own properties or self" on profile_update_requests for select
  using (
    get_my_role() = 'super_admin' or owns_property(property_id)
    or tenant_id in (select id from tenants where auth_user_id = auth.uid())
  );

drop policy if exists "Tenants create own profile update requests" on profile_update_requests;
create policy "Tenants create own profile update requests" on profile_update_requests for insert
  with check (
    tenant_id in (select id from tenants where auth_user_id = auth.uid())
    or owns_property(property_id) or get_my_role() = 'super_admin'
  );

drop policy if exists "Owners decide profile update requests" on profile_update_requests;
create policy "Owners decide profile update requests" on profile_update_requests for update
  using (owns_property(property_id) or get_my_role() = 'super_admin');

create index if not exists idx_profile_update_requests_property on profile_update_requests(property_id, status);
create index if not exists idx_profile_update_requests_tenant on profile_update_requests(tenant_id, created_at);

-- ============================================================================
-- DONE
-- ============================================================================
