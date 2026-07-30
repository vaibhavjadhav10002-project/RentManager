-- ============================================================================
-- PHASE 2: Late Fee Auto Calculation — property-level policy
-- Run this in Supabase Dashboard → SQL Editor → New Query → Run
-- ============================================================================

-- Applied at the property level (not per-agreement) so it works for every
-- tenant regardless of how they joined — owner-added tenants never get an
-- `agreements` row today, only QR-joined ones do.
alter table properties add column if not exists late_fee_per_day numeric(10,2) not null default 0;
alter table properties add column if not exists late_fee_grace_days int not null default 0;

-- ============================================================================
-- DONE
-- ============================================================================
