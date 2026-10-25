-- ============================================================================
-- FIX: Owner approve/reject fails with "You don't have permission to do that"
--
-- ROOT CAUSE: 39_production_approval_fixes.sql created the five owner-decide
-- UPDATE policies with only a USING clause that included the pending-state
-- check (e.g. `and approval_status = 'pending_approval'`). For UPDATE
-- policies, when no WITH CHECK is given Postgres reuses the USING expression
-- to validate the NEW row too. The new row has status 'approved'/'rejected',
-- so it can never satisfy "status = pending" and every approve/reject was
-- rejected by RLS — the exact error owners saw.
--
-- FIX: keep USING (only a still-pending row can be decided — this is what
-- blocks re-deciding an already-decided request) and add an explicit
-- WITH CHECK that only verifies ownership, so the row is allowed to move
-- OUT of pending. Run in Supabase Dashboard -> SQL Editor. Idempotent.
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
-- DONE
-- ============================================================================
