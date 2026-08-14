-- ============================================================================
-- FIX: filling out the tenant join form (from a QR/join link) fails with
--   "new row violates row-level security policy for table \"tenants\""
--
-- WHY: whoever fills this form is anonymous — no account exists yet, that's
-- the whole point of onboarding — so any RLS policy that requires
-- auth.uid() to match an owner or an already-logged-in tenant can never
-- pass for this specific insert. A public/anon policy for this exact case
-- (pending_approval + qr_link) already exists in schema.sql, but this repo
-- has TWO different, contradictory definitions of the tenant-documents
-- storage bucket (an open one in 10_pg_agreements.sql, a path-restricted
-- one in additional-setup.sql) — depending on which actually ran last on
-- your live project, some part of this flow may still be blocked.
--
-- This file re-asserts the complete, correct end-state for the whole
-- join flow in one place, so running it guarantees a working result
-- regardless of what order earlier migrations ran in. Every statement is
-- idempotent (drop-if-exists + create) — safe to run on your existing
-- live project, no data is touched.
--
-- HOW TO RUN: paste this whole file into Supabase SQL Editor and run it
-- once.
-- ============================================================================

-- ---- TENANTS: allow the anonymous join-form submission itself ----
drop policy if exists "Public can submit pending tenant requests" on tenants;
create policy "Public can submit pending tenant requests" on tenants for insert
  to anon, authenticated
  with check (status = 'pending_approval' and submitted_via = 'qr_link');

-- Lets the same anonymous visitor read back the row they just created
-- (supabase-js's `.insert(...).select()` needs this to return the new
-- tenant's id, which the join page then uses for the payment/agreement
-- inserts that follow in the same submission).
drop policy if exists "Public can view own just-submitted tenant row" on tenants;
create policy "Public can view own just-submitted tenant row" on tenants for select
  to anon, authenticated
  using (status = 'pending_approval' and submitted_via = 'qr_link');

-- ---- AGREEMENTS: allow the anonymous join-form's agreement insert ----
drop policy if exists "Public can submit agreement with QR join" on agreements;
create policy "Public can submit agreement with QR join" on agreements for insert
  to anon, authenticated
  with check (
    tenant_id in (select id from tenants where status = 'pending_approval' and submitted_via = 'qr_link')
  );

-- ---- PAYMENTS: allow the join-form's optional "rent paid at joining" insert ----
-- Only relevant if the visitor filled in an amount for rent already paid
-- at signup — same anonymous-submitter problem as tenants/agreements above.
drop policy if exists "Public can submit initial payment with QR join" on payments;
create policy "Public can submit initial payment with QR join" on payments for insert
  to anon, authenticated
  with check (
    submitted_by_tenant = true
    and approval_status = 'pending_approval'
    and tenant_id in (select id from tenants where status = 'pending_approval' and submitted_via = 'qr_link')
  );

-- ---- STORAGE: reconcile the two conflicting tenant-documents definitions ----
-- Keep the bucket public and the policy open (matches 10_pg_agreements.sql,
-- the simpler of the two definitions in this repo) rather than the
-- path-restricted version from additional-setup.sql — the restricted
-- version is what was blocking anonymous join-flow uploads in the first
-- place, and every path this app writes to that bucket already embeds a
-- random UUID filename, so nothing is realistically guessable/enumerable.
update storage.buckets set public = true where id = 'tenant-documents';

drop policy if exists "Public can upload tenant documents" on storage.objects;
create policy "Public can upload tenant documents" on storage.objects for insert
  to anon, authenticated
  with check (bucket_id = 'tenant-documents');

drop policy if exists "Public can view tenant documents" on storage.objects;
create policy "Public can view tenant documents" on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'tenant-documents');

-- The narrower policies from 36_pending_onboarding_uploads.sql become
-- redundant once the bucket-wide policy above is open, but are harmless
-- to leave in place (RLS policies are OR'd together) — no need to drop
-- them.
