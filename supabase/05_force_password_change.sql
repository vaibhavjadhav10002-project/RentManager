-- ============================================================================
-- FIRST-TIME LOGIN: force password change for owners, tenants & admin
-- Run this in Supabase Dashboard → SQL Editor → New Query → Run
-- ============================================================================

alter table profiles add column if not exists must_change_password boolean not null default true;

-- Since this column is new, ALL existing accounts (including the ones you
-- manually created via SQL, e.g. Pass@123) will now be asked to set a new
-- password on their next login. This is intentional — those were shared/
-- known passwords. If you want a specific account to skip this, run:
--   update profiles set must_change_password = false where email = 'someone@example.com';

-- ============================================================================
-- DONE
-- ============================================================================
