-- ============================================================================
-- FIX: Tenant onboarding form submission fails with
--   "Cannot coerce the result to a single JSON object"
--
-- ROOT CAUSE: `07_critical_security_fix.sql` removed the tenants UPDATE
-- policy's "tenants can update own row" clause entirely, on the stated
-- assumption that "the app never legitimately needs this." That assumption
-- was wrong: three functions in src/lib/supabase/queries.ts —
-- markOnboardingPasswordChanged, markOnboardingDraftStarted, and
-- submitOnboardingProfile — are all called BY the tenant themselves
-- (from the onboarding wizard shown in the screenshot) and all update the
-- tenant's own `tenants` row (`onboarding_status`, `pending_profile`).
-- Since 07_critical_security_fix.sql, that UPDATE has matched zero rows
-- under RLS every time; the subsequent `.select().single()` then finds
-- zero rows and PostgREST throws exactly the error in the screenshot
-- (PGRST116 — "Cannot coerce the result to a single JSON object").
--
-- FIX: restore the tenant's ability to update their own row, but — unlike
-- the pre-07 version, which had NO column restriction and was the actual
-- security hole — lock it down with a trigger that allows a
-- tenant-initiated update to touch ONLY `pending_profile` and
-- `onboarding_status`, and only ever move `onboarding_status` to a value
-- a tenant is legitimately allowed to set themselves
-- (password_changed / draft / submitted / resubmitted) — never
-- `approved`, `correction_requested`, or `invitation_created`, all of
-- which stay owner-only. This closes the same self-approval class of bug
-- fixed elsewhere in this round (payments/leave/extension/move-out),
-- applied here to the one place it was missed, while actually restoring
-- the broken feature instead of leaving it broken.
--
-- Run this in Supabase Dashboard → SQL Editor → New Query → Run
-- ============================================================================

-- ---- Column-level lock: tenant self-updates may only touch the two
-- onboarding-wizard fields, and onboarding_status only to a tenant-legal
-- value. Robust to future columns — allowlists by key, not blocklists. ----
create or replace function prevent_tenant_self_update_overreach() returns trigger as $$
declare
  old_j jsonb := to_jsonb(old);
  new_j jsonb := to_jsonb(new);
  allowed_keys text[] := array['pending_profile', 'onboarding_status'];
  k text;
begin
  -- Only constrains updates performed as the tenant themselves (their own
  -- row, matched by auth_user_id). Owner/super_admin updates continue to
  -- go through the same policy's owns_property()/super_admin clause below
  -- and are untouched by this trigger.
  if old.auth_user_id is not null and old.auth_user_id = auth.uid() then
    for k in select jsonb_object_keys(old_j) loop
      if k <> all(allowed_keys) and old_j->k is distinct from new_j->k then
        raise exception 'You are not allowed to change % yourself — ask your owner', k;
      end if;
    end loop;

    if new.onboarding_status is distinct from old.onboarding_status
       and new.onboarding_status not in ('password_changed', 'draft', 'submitted', 'resubmitted') then
      raise exception 'You are not allowed to set onboarding status to %', new.onboarding_status;
    end if;
  end if;

  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_prevent_tenant_self_update_overreach on tenants;
create trigger trg_prevent_tenant_self_update_overreach
  before update on tenants
  for each row execute function prevent_tenant_self_update_overreach();

-- ---- RLS: restore the tenant's own-row UPDATE grant ----
drop policy if exists "Owners update tenants" on tenants;
create policy "Owners update tenants, tenants update own row" on tenants for update
  using (owns_property(property_id) or get_my_role() = 'super_admin' or auth_user_id = auth.uid());

-- ============================================================================
-- DONE
-- ============================================================================
