-- ============================================================================
-- FIX: scanning a tenant's QR / join link always shows "Invalid join link",
-- even for a link that was never changed or deleted.
--
-- ROOT CAUSE: the `properties` table's only SELECT policy is "Super admin
-- sees all properties" (see schema.sql). A brand-new visitor scanning the
-- QR code is anonymous — they have no account yet — so when the join page
-- (src/app/(auth)/join/[slug]/page.tsx) runs
--   supabase.from('properties').select(...).eq('qr_slug', params.slug)
-- RLS silently returns zero rows for every single slug, regardless of
-- whether it's valid. The page then shows "Invalid or expired join link".
--
-- This project already has a `get_property_by_slug()` RPC function (see
-- fix-join-link-cache-bug.sql) built exactly to solve this safely — it's
-- SECURITY DEFINER (bypasses RLS) and only ever returns the one property
-- matching the exact slug you pass in, so anonymous visitors can never
-- enumerate or dump the full properties table. But the join page was later
-- refactored to query the table directly and stopped calling it, so the
-- RPC has been sitting unused while the direct query is silently blocked.
--
-- FIX: widen get_property_by_slug() to return the same 4 columns the join
-- page needs (id, name, address, upi_id), and update the join page to call
-- it instead of querying `properties` directly. No RLS policy is loosened
-- on the properties table itself — anonymous visitors still cannot list or
-- browse properties, only look up the one exact slug they were given.
--
-- HOW TO RUN: paste this whole file into Supabase SQL Editor and run it
-- once. Safe to run on your existing live project.
-- ============================================================================

-- `create or replace` cannot change a function's return columns in
-- Postgres, so drop first in case the earlier 2-column version (from
-- fix-join-link-cache-bug.sql) was already applied to your project.
drop function if exists get_property_by_slug(text);

create function get_property_by_slug(slug text)
returns table (id uuid, name text, address text, upi_id text) as $$
  select id, name, address, upi_id from properties where qr_slug = slug limit 1;
$$ language sql security definer;

grant execute on function get_property_by_slug(text) to anon, authenticated;
