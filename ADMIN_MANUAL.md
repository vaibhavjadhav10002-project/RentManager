# ADMIN_MANUAL.md

For the `super_admin` role — the single admin area at `/admin`.

## What Super Admin does
The Super Admin area is intentionally small: its job is to create and
manage PG **owner** accounts, not to operate any property's day-to-day
data (rooms, tenants, payments, etc. — that's the owner's job, and
RLS prevents even a super_admin account from casually browsing a
specific owner's tenant data outside this page's own admin-scoped
queries).

## Adding a PG Owner
From `/admin`, use "Add PG Owner" to create a new owner account. This
creates both a Supabase Auth user and a matching `profiles` row with
`role = 'owner'` — the owner then logs in with the credentials you set
and completes their own property setup independently.

## What to check if an owner reports a problem
1. Confirm their `profiles.role` is actually `owner` (not accidentally `tenant` — this is the #1 cause of "I can't see my dashboard" reports).
2. Confirm they're logging in with the correct email (Supabase Auth is case-sensitive on some configurations — check for typos before assuming a deeper bug).
3. For anything beyond account existence/role, you'll need direct Supabase Dashboard access (Table Editor) — the Super Admin UI doesn't expose property-level data by design.

## What Super Admin does NOT do
- Does not view/edit tenant, payment, or property data directly — see `OWNER_MANUAL.md` for that; escalate to the owner or use Supabase Dashboard directly if genuinely necessary.
- Does not handle billing/subscription management for owners — this project doesn't currently implement a subscription/billing layer for owner accounts themselves (only the owner's own rent-collection features for their tenants).

## Security note
Give super_admin credentials to as few people as necessary — the role
has no additional UI restriction beyond "can create owner accounts,"
but whoever holds it also necessarily has full Supabase Dashboard access
in most real deployments (the two tend to be held by the same person/team).
