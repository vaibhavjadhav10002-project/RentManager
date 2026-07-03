-- ============================================================================
-- CRITICAL SECURITY FIX — Privilege escalation via RLS gaps
--
-- ISSUE 1: The "Users update own profile" policy on `profiles` only checked
-- `id = auth.uid()` with no column restriction. Any logged-in tenant or
-- owner could run:
--   supabase.from('profiles').update({ role: 'super_admin' }).eq('id', myId)
-- ...and instantly grant themselves full admin access to every property,
-- owner, and tenant in the system.
--
-- ISSUE 2: The tenants UPDATE policy allowed a tenant to modify their OWN
-- tenant row via `auth_user_id = auth.uid()` with no column restriction —
-- they could set monthly_rent to 0, mark deposit as fully paid, or move
-- themselves to a different room, with no owner approval. The app never
-- legitimately needs this (tenants only ever INSERT into payments/
-- complaints, never UPDATE their own tenants row), so this clause is
-- removed entirely.
--
-- Run this in Supabase Dashboard → SQL Editor → New Query → Run
-- ============================================================================

-- ---- FIX 1: lock down which profile columns a non-admin can change ----
create or replace function prevent_profile_privilege_escalation() returns trigger as $$
begin
  if new.role is distinct from old.role and get_my_role() <> 'super_admin' then
    raise exception 'You are not allowed to change your own role';
  end if;
  if new.is_active is distinct from old.is_active and get_my_role() <> 'super_admin' then
    raise exception 'You are not allowed to change your own active status';
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_prevent_profile_privilege_escalation on profiles;
create trigger trg_prevent_profile_privilege_escalation
  before update on profiles
  for each row execute function prevent_profile_privilege_escalation();

-- ---- FIX 2: tenants can no longer update their own tenant row ----
drop policy if exists "Owners update tenants, tenants update own row" on tenants;
create policy "Owners update tenants" on tenants for update
  using (owns_property(property_id) or get_my_role() = 'super_admin');

-- ============================================================================
-- DONE
-- ============================================================================
