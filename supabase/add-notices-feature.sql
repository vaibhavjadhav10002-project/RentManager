-- ============================================================================
-- ADD: Notices feature (owner → tenant announcements) + tenant birthday field
-- Safe to run once on your existing live Supabase project — only adds new
-- things, doesn't touch any existing data.
-- ============================================================================

-- ── 1. Birthday field on tenants ─────────────────────────────────────────────
alter table tenants add column if not exists date_of_birth date;

-- ── 2. Notices table ──────────────────────────────────────────────────────────
do $$ begin
  create type notice_category as enum ('rent', 'deposit', 'electricity', 'water', 'maintenance', 'general');
exception
  when duplicate_object then null;
end $$;

create table if not exists notices (
  id uuid primary key default uuid_generate_v4(),
  property_id uuid not null references properties(id) on delete cascade,
  created_by uuid not null references profiles(id),
  category notice_category not null default 'general',
  title text not null,
  message text not null,
  tenant_ids uuid[],
  created_at timestamptz default now()
);

create index if not exists idx_notices_property on notices(property_id);

alter table notices enable row level security;

create or replace function notice_targets_me(notice_tenant_ids uuid[]) returns boolean as $$
  select notice_tenant_ids is null or exists (
    select 1 from tenants
    where auth_user_id = auth.uid()
      and id = any(notice_tenant_ids)
  );
$$ language sql security definer;

drop policy if exists "Owners manage notices for own properties" on notices;
create policy "Owners manage notices for own properties" on notices for all
  using (owns_property(property_id) or get_my_role() = 'super_admin');

drop policy if exists "Tenants view notices addressed to them" on notices;
create policy "Tenants view notices addressed to them" on notices for select
  using (
    get_my_role() = 'super_admin'
    or owns_property(property_id)
    or (tenant_belongs_to_property(property_id) and notice_targets_me(tenant_ids))
  );

-- Done. Your app can now:
--  - let owners send a notice (rent/deposit/electricity/water/maintenance/general)
--    to all tenants at a property, or a specific subset
--  - let tenants see only notices for their own property (enforced by RLS,
--    same as everything else in this app)
--  - collect each tenant's date of birth at joining time
