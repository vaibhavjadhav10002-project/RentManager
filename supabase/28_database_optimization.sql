-- ============================================================================
-- DATABASE OPTIMIZATION (Phase 6.7)
-- Run this in Supabase Dashboard → SQL Editor → New Query → Run
-- ============================================================================
-- Every index below is justified by an actual query pattern already present in
-- src/lib/supabase/queries.ts — not a speculative "might help someday" index.
-- get_my_role()/owns_property() (used in nearly every RLS policy) were already
-- correctly marked `stable`, so no RLS-performance fix was needed there.

-- Reports (5.2/5.4) filter+sort payments by property and date constantly, and the
-- dashboard/notifications/P&L logic repeatedly filters on approval_status.
create index if not exists idx_payments_payment_date on payments(payment_date desc);
create index if not exists idx_payments_property_approval on payments(property_id, approval_status);

-- Same reasoning as payments, for the Expense Report (5.3) and P&L (5.4).
create index if not exists idx_expenses_expense_date on expenses(expense_date desc);

-- getDashboardStats and getOwnerNotifications both filter tenants by
-- (property_id, status) directly — this composite index serves that exact
-- combination instead of relying on the property_id index alone.
create index if not exists idx_tenants_property_status on tenants(property_id, status);

-- ============================================================================
-- DONE
-- ============================================================================
