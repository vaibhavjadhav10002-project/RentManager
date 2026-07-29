-- ============================================================================
-- PHASE 8.1: Smart Tenant Onboarding — Invitation Foundation
-- Run this in Supabase Dashboard → SQL Editor → New Query → Run
-- ============================================================================

-- 'invited' is deliberately a NEW, separate status from 'pending_approval'.
-- 'pending_approval' already means something specific in this app: a
-- fully self-submitted QR-join application awaiting the owner's approve/
-- reject decision (see approvals page's "New Tenant Requests" tab, and
-- getPendingApprovals()). An invitation-stage tenant hasn't logged in or
-- submitted anything yet — reusing 'pending_approval' for it would make
-- these bare, mostly-empty rows show up in that existing UI, which is
-- built to render a complete application (rent, joining date, payment
-- claim). Keeping them distinct avoids that collision entirely.
alter type tenant_status add value if not exists 'invited';

-- Onboarding progress (Phase 8's status ladder — Invitation Created,
-- Password Changed, Draft, Submitted, ...) is tracked separately from
-- tenant_status on purpose: it's a different concern (profile completeness
-- / verification) from tenancy lifecycle (occupancy, billing, active vs
-- left). Nullable and only populated for tenants created through the
-- invitation flow — existing owner_added/qr_link tenants are already fully
-- onboarded and don't need it.
alter table tenants add column if not exists onboarding_status text;

-- An invitation-stage tenant has no room/rent/joining-date yet (those are
-- Owner-controlled fields set later, during Review). Rather than making
-- monthly_rent/joining_date nullable — which would ripple `| null` through
-- every rent calculation across the dashboard, payments, and tenant portal
-- that assumes a real number/date, none of which is this sub-phase's
-- concern — these get a harmless default that's simply overwritten once
-- the owner completes Review. NOT NULL stays intact; nothing about the
-- existing column contracts changes for any other tenant-creation path.
alter table tenants alter column monthly_rent set default 0;
alter table tenants alter column joining_date set default current_date;

-- ============================================================================
-- DONE
-- ============================================================================
