# DATABASE_SCHEMA.md

Postgres via Supabase. This document is a map of what exists and how it
fits together — the migration files in `supabase/*.sql` are the source
of truth for exact column definitions; read this first to know which
file to open.

## Migration order

Run numerically, **skipping `.DEPRECATED.sql` files**:
```
01–17   baseline (auth, properties, rooms, tenants, payments, expenses,
        complaints, notices, messages, agreements, utility bills, PWA push)
18–21   Leave/Extension/Move-Out requests, deposit deduction items
22–28   Visitor/Parcel/Waiting-List management, room-change log,
        automatic backup, archive/restore, database indexes
29–32   Tenant invitations, onboarding wizard, owner review,
        profile status history
33–34   Profile update requests, communication engine
35      Native (FCM/APNs) push token columns — mobile app support
```
`09_electricity_bills.DEPRECATED.sql` and `09_utility_bills.DEPRECATED.sql`
are superseded by `utility_bills` (created in `09_CATCH_UP_ALL.sql`) —
kept for history only, never run these.

If you're setting up a fresh database, run `schema.sql` first if present,
otherwise run 01 through 35 in order. If migrating an existing database
forward, run only whatever numbers haven't been applied yet.

## Table groups

**Identity & properties:** `profiles` (role: super_admin/owner/tenant), `properties`, `rooms`, `tenants` (links to `profiles` via `auth_user_id`)

**Money:** `payments`, `expenses`, `agreements`

**Tenant-initiated requests** (one consistent shape each: own table, matching RLS, owner approval, push both directions): `leave_requests`, `rent_extension_requests`, `move_out_requests`, `move_out_checklists`, `profile_update_requests`

**Operations:** `complaints`, `notices`, `notice_reads`, `visitors`, `parcels`, `waiting_list`, `room_changes`, `profile_status_history`

**Communication:** `message_templates`, `communication_queue`, `communication_logs`, `communication_settings`, `messages`

**Push/notifications:** `push_subscriptions` (Web Push + native tokens, same table), `notification_log`

**Backup:** `backup_settings`, `backup_runs`

**Billing (legacy/superseded — check which is actually live before touching):** `bills`, `utility_bills`, `electricity_bills`, `collectors`

## RLS conventions

Every table has RLS enabled with a consistent shape:
- Owners see rows scoped to properties they own (`owner_id = auth.uid()` or a join through `property_id`)
- Tenants see only their own rows (`auth_user_id = auth.uid()` or equivalent)
- `super_admin` bypasses via a role check in the policy or, for cross-tenant server operations (push send, cron), a service-role key that intentionally bypasses RLS from a trusted server context only

When adding a new table, match the RLS shape of the most similar existing table (e.g. any new tenant-request table should mirror `leave_requests`) rather than inventing a new pattern.

## `push_subscriptions` — the one table with two subscription types

```
user_id        -- always required
endpoint       -- unique per (user_id, endpoint); native rows use "native:{platform}:{token}"
p256dh         -- Web Push only, nullable
auth_key       -- Web Push only, nullable
native_token   -- native app only, nullable
native_platform -- 'ios' | 'android', native app only, nullable
```
A check constraint (`push_subscriptions_web_or_native_check`, added in migration 35) enforces that every row is a valid one or the other — never neither, never a partial mix.

## Storage buckets
- `automatic-backups` (private) — created by migration 26, holds scheduled JSON backup exports

## Adding a migration
Follow the existing numbered-file convention (`NN_description.sql`), check the highest existing number first (`ls supabase/ | sort`), write additive changes where possible (new nullable columns, new tables) rather than altering existing constraints, and update this file's "Migration order" section.
