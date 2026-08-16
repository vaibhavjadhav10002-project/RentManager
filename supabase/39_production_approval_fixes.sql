-- ============================================================================
-- PHASE 9: Production Approval + Calculation Forensic Fix Round
-- Fixes confirmed findings from APPROVAL_CALCULATION_AUDIT.md (v1, score 61/100)
-- Run this in Supabase Dashboard → SQL Editor → New Query → Run
-- ============================================================================

-- ----------------------------------------------------------------------------
-- FIX 1 (🔴 CRITICAL): Tenants could self-approve by inserting an approval-
-- status column directly instead of it defaulting to pending. Every insert
-- policy below is tightened to require the neutral/pending value; the
-- existing "Owners …" insert/update policies are untouched (owners still
-- record/approve payments and requests exactly as before). Every decide/
-- update policy is also tightened to only allow acting on a row that is
-- still in its pending state, closing the "re-decide an already-decided
-- request" gap (approved→rejected, rejected→approved, duplicate approval).
-- ----------------------------------------------------------------------------

-- payments: tenant-submitted claims must land as pending_approval
drop policy if exists "Tenants submit own paid claims" on payments;
create policy "Tenants submit own paid claims" on payments for insert
  with check (
    submitted_by_tenant = true
    and approval_status = 'pending_approval'
    and tenant_id in (select id from tenants where auth_user_id = auth.uid())
  );

-- payments: owner can only decide a payment that is still pending
-- (prevents duplicate-approval and approved<->rejected flips)
drop policy if exists "Owners update payments (approve/reject)" on payments;
create policy "Owners update payments (approve/reject)" on payments for update
  using (
    (owns_property(property_id) or get_my_role() = 'super_admin')
    and approval_status = 'pending_approval'
  );

-- leave_requests: tenant-submitted requests must land as pending
drop policy if exists "Tenants create own leave requests" on leave_requests;
create policy "Tenants create own leave requests" on leave_requests for insert
  with check (
    (
      tenant_id in (select id from tenants where auth_user_id = auth.uid())
      and status = 'pending'
    )
    or owns_property(property_id) or get_my_role() = 'super_admin'
  );

drop policy if exists "Owners decide leave requests" on leave_requests;
create policy "Owners decide leave requests" on leave_requests for update
  using (
    (owns_property(property_id) or get_my_role() = 'super_admin')
    and status = 'pending'
  );

-- rent_extension_requests: same shape
drop policy if exists "Tenants create own rent extension requests" on rent_extension_requests;
create policy "Tenants create own rent extension requests" on rent_extension_requests for insert
  with check (
    (
      tenant_id in (select id from tenants where auth_user_id = auth.uid())
      and status = 'pending'
    )
    or owns_property(property_id) or get_my_role() = 'super_admin'
  );

drop policy if exists "Owners decide rent extension requests" on rent_extension_requests;
create policy "Owners decide rent extension requests" on rent_extension_requests for update
  using (
    (owns_property(property_id) or get_my_role() = 'super_admin')
    and status = 'pending'
  );

-- move_out_requests: same shape. Owner-controlled downstream states
-- ('approved' triggers setTenantLeaving in app code) can now only ever be
-- reached by an owner, never by the tenant's own insert.
drop policy if exists "Tenants create own move-out requests" on move_out_requests;
create policy "Tenants create own move-out requests" on move_out_requests for insert
  with check (
    (
      tenant_id in (select id from tenants where auth_user_id = auth.uid())
      and status = 'pending'
    )
    or owns_property(property_id) or get_my_role() = 'super_admin'
  );

drop policy if exists "Owners decide move-out requests" on move_out_requests;
create policy "Owners decide move-out requests" on move_out_requests for update
  using (
    (owns_property(property_id) or get_my_role() = 'super_admin')
    and status = 'pending'
  );

-- profile_update_requests: same shape
drop policy if exists "Tenants create own profile update requests" on profile_update_requests;
create policy "Tenants create own profile update requests" on profile_update_requests for insert
  with check (
    (
      tenant_id in (select id from tenants where auth_user_id = auth.uid())
      and status = 'pending'
    )
    or owns_property(property_id) or get_my_role() = 'super_admin'
  );

drop policy if exists "Owners decide profile update requests" on profile_update_requests;
create policy "Owners decide profile update requests" on profile_update_requests for update
  using (
    (owns_property(property_id) or get_my_role() = 'super_admin')
    and status = 'pending'
  );

-- ----------------------------------------------------------------------------
-- FIX 2 (🟠 HIGH): Deposit refund + deductions could together exceed the
-- deposit actually held (only refund-vs-paid was ever checked). Enforced
-- here at the database level as a trigger (in addition to the client-side
-- check added in the Owner Tenants page), since deduction items live in a
-- jsonb column and can't be expressed as a plain CHECK constraint.
-- ----------------------------------------------------------------------------
create or replace function prevent_deposit_over_settlement() returns trigger as $$
declare
  deduction_total numeric := 0;
begin
  select coalesce(sum((item->>'amount')::numeric), 0)
    into deduction_total
    from jsonb_array_elements(coalesce(new.deposit_deduction_items, '[]'::jsonb)) as item;

  if new.deposit_refunded + deduction_total > new.deposit_paid then
    raise exception 'Deposit refund (%) + deductions (%) cannot exceed deposit paid (%)',
      new.deposit_refunded, deduction_total, new.deposit_paid;
  end if;

  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_prevent_deposit_over_settlement on tenants;
create trigger trg_prevent_deposit_over_settlement
  before insert or update on tenants
  for each row execute function prevent_deposit_over_settlement();

-- ----------------------------------------------------------------------------
-- FIX 3 (🟡 MEDIUM): Late fee was folded into the rent amount with no way
-- to distinguish it in income reports. Additive, nullable column — existing
-- rows are unaffected (defaults to 0), no existing calculation changes.
-- ----------------------------------------------------------------------------
alter table payments add column if not exists late_fee_amount numeric(10,2) not null default 0;

-- ============================================================================
-- DONE
-- ============================================================================
