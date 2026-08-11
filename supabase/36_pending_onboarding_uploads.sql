-- ============================================================================
-- FIX: Government ID / Aadhaar photo upload fails on the tenant join page
-- (/join/[slug]).
--
-- ROOT CAUSE: the `tenant-documents` bucket is private, and its existing
-- RLS policies (tenant_documents_insert / _select) only allow a write/read
-- when owns_property_from_path() or tenant_owns_path() matches the
-- CURRENTLY AUTHENTICATED user. But someone filling out the join form is a
-- brand-new visitor who has no account yet — that's the whole point of
-- onboarding — so auth.uid() has no tenant/owner row to match, and every
-- upload attempt is rejected by RLS before it ever reaches the bucket.
--
-- FIX: add a narrowly-scoped extra policy that allows inserts/selects only
-- under the `pending-onboarding/<property_id>/...` path prefix (which is
-- what the join page's upload code now writes to — see handleGovIdSelect
-- in src/app/(auth)/join/[slug]/page.tsx). This does NOT relax access to
-- any other tenant document — only to this one dedicated onboarding
-- sub-folder, and only for the insert+select actions a brand-new visitor
-- actually needs.
--
-- HOW TO RUN: paste this whole file into Supabase SQL Editor and run it
-- once. Safe to run on your existing live project — no table data or
-- other policies are touched.
-- ============================================================================

create policy "tenant_documents_pending_onboarding_insert" on storage.objects for insert
  to anon, authenticated
  with check (
    bucket_id = 'tenant-documents'
    and (string_to_array(name, '/'))[1] = 'pending-onboarding'
  );

create policy "tenant_documents_pending_onboarding_select" on storage.objects for select
  to anon, authenticated
  using (
    bucket_id = 'tenant-documents'
    and (string_to_array(name, '/'))[1] = 'pending-onboarding'
  );

-- Note: once the owner approves the tenant, the existing
-- tenant_documents_select policy (owns_property_from_path / tenant_owns_path)
-- keeps working as before for every OTHER document path in this bucket —
-- this migration only adds access for the new pending-onboarding/ prefix,
-- it doesn't change or remove anything that already worked.
