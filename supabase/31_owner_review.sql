-- ============================================================================
-- PHASE 8.4: Smart Tenant Onboarding — Owner Review
-- Run this in Supabase Dashboard → SQL Editor → New Query → Run
-- ============================================================================

-- Staging area for what the tenant submits in the Onboarding Wizard. This
-- is the piece that makes a genuine "Previous Value / New Value / Source"
-- review possible: the wizard (Phase 8.3) writes here instead of directly
-- overwriting the live tenant columns, so at review time the owner can see
-- the original owner-entered values (live columns, Source = Owner) next to
-- what the tenant submitted (this column, Source = Tenant) before either
-- one becomes the tenant's actual record.
alter table tenants add column if not exists pending_profile jsonb;

-- Owner's note when using "Send Back For Correction", shown to the tenant
-- when they return to the wizard so they know what to fix.
alter table tenants add column if not exists correction_note text;

-- ============================================================================
-- DONE
-- ============================================================================
