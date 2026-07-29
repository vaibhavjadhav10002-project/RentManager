-- ============================================================================
-- ARCHIVE & RESTORE (Phase 5.15)
-- Run this in Supabase Dashboard → SQL Editor → New Query → Run
-- ============================================================================
-- Scoped deliberately to the three operational tables added earlier in this same
-- phase (Visitors 5.8, Parcels 5.9, Waiting List 5.10) — not to any table owned
-- by an earlier or parallel phase, so there's no risk of conflicting with them.

alter table visitors add column if not exists archived_at timestamptz;
alter table parcels add column if not exists archived_at timestamptz;
alter table waiting_list add column if not exists archived_at timestamptz;

create index if not exists idx_visitors_archived on visitors(archived_at);
create index if not exists idx_parcels_archived on parcels(archived_at);
create index if not exists idx_waiting_list_archived on waiting_list(archived_at);

-- ============================================================================
-- DONE
-- ============================================================================
