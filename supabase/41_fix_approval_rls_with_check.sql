-- ============================================================================
-- PHASE 10: Fix "permission denied" on Approve / Reject
-- Run this in Supabase Dashboard → SQL Editor → New Query → Run
-- ============================================================================
--
-- ROOT CAUSE:
-- Migration 39 (39_production_approval_fixes.sql) added `and status =
-- 'pending'` (or `approval_status = 'pending_approval'`) to five "Owners
-- decide ___" UPDATE policies, but only supplied a `using (...)` clause —
-- it never supplied a separate `with check (...)`.
--
-- In Postgres, an UPDATE policy with no explicit WITH CHECK reuses its
-- USING expression as the WITH CHECK expression too. USING is evaluated
-- against the OLD row (fine — the row *was* pending), but WITH CHECK is
-- evaluated against the NEW row *after* the update is applied. The whole
-- point of clicking Approve/Reject is to change the status away from
-- pending — so the new row's status is 'approved'/'rejected', the reused
-- "... and status = 'pending'" condition fails against it, and Postgres
-- reports this to the client as "new row violates row-level security
-- policy" → the app shows "You don't have permission to do that."
--
-- This affects every decide/approve action in the app: payment approvals,
-- leave requests, rent extension requests, move-out requests, and profile
-- update requests.
--
-- FIX: give each of these five policies its own explicit WITH CHECK that
-- only re-verifies ownership (not the old "must still be pending" state,
-- which no longer holds true for the row being written) — the same
-- pattern already used correctly elsewhere in this schema (see
-- schema.sql:231). USING still gates *which* rows can be touched (must be
-- pending), WITH CHECK gates *who* can write the result (must own the
-- property) — the two clauses are no longer conflated.
-- ============================================================================

drop policy if exists "Owners update payments (approve/reject)" on payments;
create policy "Owners update payments (approve/reject)" on payments for update
  using (
    (owns_property(property_id) or get_my_role() = 'super_admin')
    and approval_status = 'pending_approval'
  )
  with check (
    owns_property(property_id) or get_my_role() = 'super_admin'
  );

drop policy if exists "Owners decide leave requests" on leave_requests;
create policy "Owners decide leave requests" on leave_requests for update
  using (
    (owns_property(property_id) or get_my_role() = 'super_admin')
    and status = 'pending'
  )
  with check (
    owns_property(property_id) or get_my_role() = 'super_admin'
  );

drop policy if exists "Owners decide rent extension requests" on rent_extension_requests;
create policy "Owners decide rent extension requests" on rent_extension_requests for update
  using (
    (owns_property(property_id) or get_my_role() = 'super_admin')
    and status = 'pending'
  )
  with check (
    owns_property(property_id) or get_my_role() = 'super_admin'
  );

drop policy if exists "Owners decide move-out requests" on move_out_requests;
create policy "Owners decide move-out requests" on move_out_requests for update
  using (
    (owns_property(property_id) or get_my_role() = 'super_admin')
    and status = 'pending'
  )
  with check (
    owns_property(property_id) or get_my_role() = 'super_admin'
  );

drop policy if exists "Owners decide profile update requests" on profile_update_requests;
create policy "Owners decide profile update requests" on profile_update_requests for update
  using (
    (owns_property(property_id) or get_my_role() = 'super_admin')
    and status = 'pending'
  )
  with check (
    owns_property(property_id) or get_my_role() = 'super_admin'
  );

-- ============================================================================
-- DONE — after running this, Approve/Reject on payments, leave requests,
-- rent extensions, move-out requests, and profile updates will all work
-- again. The "can't re-decide an already-decided request" protection from
-- migration 39 is untouched (still enforced via USING).
-- ============================================================================
