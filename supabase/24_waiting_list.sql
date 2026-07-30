-- ============================================================================
-- WAITING LIST (Phase 5.10)
-- Run this in Supabase Dashboard → SQL Editor → New Query → Run
-- ============================================================================

create type waiting_list_status as enum ('waiting', 'contacted', 'converted', 'expired');

create table if not exists waiting_list (
  id uuid primary key default uuid_generate_v4(),
  property_id uuid not null references properties(id) on delete cascade,
  name text not null,
  phone text not null,
  preferred_sharing text, -- free-text match against room.sharing_type (e.g. '2 Sharing') or 'Any'
  budget numeric,
  notes text,
  status waiting_list_status not null default 'waiting',
  created_at timestamptz default now()
);

alter table waiting_list enable row level security;

drop policy if exists "Owners manage waiting list for own properties" on waiting_list;
create policy "Owners manage waiting list for own properties" on waiting_list for all
  using (owns_property(property_id) or get_my_role() = 'super_admin');

create index if not exists idx_waiting_list_property on waiting_list(property_id);
create index if not exists idx_waiting_list_status on waiting_list(status);

-- ============================================================================
-- DONE
-- ============================================================================
