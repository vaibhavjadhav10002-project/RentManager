-- ============================================================================
-- SECURITY: tenant could self-approve a utility bill AND tamper with its
-- amount — the same self-approval bug class already fixed for payments,
-- leave, extension, and move-out requests in 39_production_approval_fixes.sql
-- and 41_fix_approval_update_with_check.sql, but this table was never
-- audited and had an even worse version of the same gap.
--
-- ROOT CAUSE: "Tenants submit own bill payment claims" (09_CATCH_UP_ALL.sql)
-- only checked row ownership (tenant_id matches the caller) on UPDATE — it
-- never restricted which columns could change or what `status` could be set
-- to. A tenant could call:
--   update utility_bills set status = 'paid', amount = 0 where id = <own bill>
-- and it would pass RLS, since ownership never changes. This both bypasses
-- owner approval AND lets a tenant reduce the amount they owe.
--
-- FIX (two layers, same pattern used for the other approval tables):
-- 1. RLS: USING now also requires the row still be 'pending' (blocks
--    re-claiming an already-decided bill); WITH CHECK only re-verifies
--    ownership, not status — written this way deliberately (not reusing
--    USING as the implicit check) to avoid the exact mistake fixed in
--    migration 41.
-- 2. A column-allowlist trigger (mirrors prevent_tenant_self_update_overreach
--    from 40_fix_tenant_onboarding_self_update.sql): a tenant-initiated
--    update may only touch status/submitted_by_tenant/tenant_note/method,
--    and status may only move to 'pending_approval' — never 'paid'. Owner
--    updates (via approveBill, a different auth.uid()) are untouched by
--    this trigger.
--
-- Run in Supabase Dashboard -> SQL Editor. Idempotent.
-- ============================================================================

drop policy if exists "Tenants submit own bill payment claims" on utility_bills;
create policy "Tenants submit own bill payment claims" on utility_bills for update
  using (
    tenant_id in (select id from tenants where auth_user_id = auth.uid())
    and status = 'pending'
  )
  with check (
    tenant_id in (select id from tenants where auth_user_id = auth.uid())
  );

create or replace function prevent_tenant_bill_overreach() returns trigger as $$
declare
  old_j jsonb := to_jsonb(old);
  new_j jsonb := to_jsonb(new);
  allowed_keys text[] := array['status', 'submitted_by_tenant', 'tenant_note', 'method'];
  k text;
begin
  -- Only constrains updates performed as the tenant who owns this bill.
  -- Owner updates (approveBill, etc.) go through the separate "Owners
  -- manage utility bills" policy and a different auth.uid(), so they never
  -- match this condition and are untouched by this trigger.
  if old.tenant_id in (select id from tenants where auth_user_id = auth.uid()) then
    for k in select jsonb_object_keys(old_j) loop
      if k <> all(allowed_keys) and old_j->k is distinct from new_j->k then
        raise exception 'You are not allowed to change % yourself — ask your owner', k;
      end if;
    end loop;

    if new.status is distinct from old.status and new.status::text <> 'pending_approval' then
      raise exception 'You are not allowed to set this bill''s status to %', new.status;
    end if;
  end if;

  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_prevent_tenant_bill_overreach on utility_bills;
create trigger trg_prevent_tenant_bill_overreach
  before update on utility_bills
  for each row execute function prevent_tenant_bill_overreach();

-- ============================================================================
-- DONE
-- ============================================================================
