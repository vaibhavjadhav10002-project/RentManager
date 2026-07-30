-- ============================================================================
-- PHASE 8.3: Smart Tenant Onboarding — Onboarding Wizard
-- Run this in Supabase Dashboard → SQL Editor → New Query → Run
-- ============================================================================

-- Existing fields already reused as-is by the wizard, no change needed:
--   photo_url               → Profile Photo
--   email                    → Email (optional)
--   pan_url / pan_status     → PAN (optional)
--   emergency_contact        → Emergency Contact Number (already a phone
--                              number field from the QR-join flow; the
--                              wizard just adds the missing "name" half)
--   aadhaar_url / aadhaar_status → left untouched, still used by the
--                              existing QR-join flow's single-photo
--                              government ID upload. The wizard's front/
--                              back/number fields below are new and
--                              additive, not a replacement.

alter table tenants add column if not exists aadhaar_number text;
alter table tenants add column if not exists aadhaar_front_url text;
alter table tenants add column if not exists aadhaar_back_url text;
alter table tenants add column if not exists permanent_address text;
alter table tenants add column if not exists emergency_contact_name text;

-- ============================================================================
-- DONE
-- ============================================================================
