-- ============================================================================
-- HARDENING (low severity): QR-join agreement insert didn't restrict `status`
--
-- "Public can submit agreement with QR join" (10_pg_agreements.sql) only
-- checked that tenant_id belonged to a pending_approval, QR-joined tenant —
-- it never restricted the `status` column being inserted. The app's own
-- insert (src/app/(auth)/join/[slug]/page.tsx) never sets status explicitly
-- (relies on the 'pending' default), so this was never reachable through
-- normal use, but a direct API call could insert status: 'signed' or
-- 'active' without actually completing the real signing flow.
--
-- Checked actual impact before fixing: agreement.status only gates a
-- tenant-side renewal-reminder banner (src/app/(tenant)/portal/page.tsx) —
-- no owner-side code treats status='signed' as "already verified, skip
-- review" — so this was never a serious vulnerability the way the
-- payments/bills ones were. Fixing anyway for defense in depth, same as
-- every other insert policy touched this session.
--
-- Run in Supabase Dashboard -> SQL Editor. Idempotent.
-- ============================================================================

drop policy if exists "Public can submit agreement with QR join" on agreements;
create policy "Public can submit agreement with QR join" on agreements for insert
  with check (
    tenant_id in (select id from tenants where status = 'pending_approval' and submitted_via = 'qr_link')
    and status = 'pending'
  );

-- ============================================================================
-- DONE
-- ============================================================================
