-- ============================================================================
-- FIX: "Invalid join link" appearing after some time, even though the
-- property/QR link was never changed or deleted.
--
-- ROOT CAUSE: get_property_by_slug() and has_pending_join_request() were
-- marked STABLE, which tells Postgres it's safe to cache their result
-- across calls. Combined with Supabase's PgBouncer/PostgREST connection
-- pooling, this could make a newly-created (or recently-changed)
-- property's qr_slug appear "not found" on some pooled connections for a
-- while, before eventually resolving correctly again — matching exactly
-- the "works at first, then fails for a bit" symptom.
--
-- This migration just re-defines both functions WITHOUT the stable
-- marker. It's safe to run on your existing live project — it doesn't
-- touch any table data, only these two function definitions.
--
-- HOW TO RUN: paste this whole file into Supabase SQL Editor and run it,
-- once. No need to re-run the full schema.sql.
-- ============================================================================

create or replace function get_property_by_slug(slug text)
returns table (id uuid, name text) as $$
  select id, name from properties where qr_slug = slug limit 1;
$$ language sql security definer;

grant execute on function get_property_by_slug(text) to anon, authenticated;

create or replace function has_pending_join_request(p_property_id uuid, p_phone text)
returns boolean as $$
  select exists (
    select 1 from tenants
    where property_id = p_property_id
      and phone = p_phone
      and status = 'pending_approval'
      and submitted_via = 'qr_link'
  );
$$ language sql security definer;

grant execute on function has_pending_join_request(uuid, text) to anon, authenticated;

-- Done — your existing QR/join links for every property will keep working
-- exactly as they already do (nothing about the link URL itself changes),
-- this only fixes the intermittent lookup failure.
