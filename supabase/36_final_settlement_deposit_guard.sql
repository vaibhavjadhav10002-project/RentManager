-- ============================================================================
-- PHASE: Final Settlement — deposit over-allocation guard
-- Run this in Supabase Dashboard → SQL Editor → New Query → Run
-- ============================================================================

-- Refund + itemized deductions together can never exceed the deposit
-- actually held. Client-side validation already checks this on save
-- (src/app/(owner)/tenants/page.tsx), added alongside the new Final
-- Settlement calculator — this trigger is a second line of defense at the
-- database level, so the same rule holds even for a direct API call that
-- bypasses the app's own UI.
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

-- ============================================================================
-- DONE
-- ============================================================================
