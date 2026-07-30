# DISASTER_RECOVERY.md

Scenario-based recovery steps. For routine backup/restore (not a
disaster), see `BACKUP_RESTORE_GUIDE.md` instead.

## Scenario: bad deploy (app broken after a code push)
1. Vercel dashboard → Deployments → find the last known-good deployment → "Promote to Production". This is instant and doesn't touch the database.
2. Investigate the broken commit separately; no rush once rolled back.

## Scenario: bad migration (schema change broke something)
1. Migrations in this project are additive by convention (new nullable columns/tables, not destructive alters) specifically so this scenario is rare — check `DATABASE_SCHEMA.md`'s "Adding a migration" note for why.
2. If a migration did drop/alter something destructively: restore from the most recent Supabase point-in-time backup (Supabase Dashboard → Database → Backups) rather than attempting a manual reverse-migration, unless you're certain of the exact reverse SQL.
3. Re-deploy the app version from before the migration was required, if the code and schema are now out of sync.

## Scenario: data loss / corruption for one owner's data
1. Check `backup_runs` for that owner's most recent successful automatic backup, and/or ask if they have a manual export downloaded from `(owner)/backup`.
2. Use `(owner)/restore` to merge the backup back in — this is additive/upsert-only by design (see `SYSTEM_DESIGN.md`), so it's safe to run even if some data still exists; it won't delete anything.
3. If no backup exists and this is a database-level issue (not user error), fall back to Supabase's own point-in-time recovery.

## Scenario: Supabase project-wide outage
- The app has no local fallback for auth/data — this is a genuine dependency. Check https://status.supabase.com. Nothing to do on the app side except wait and communicate to users; the service worker's offline page will at least show a friendly message instead of a raw network error.

## Scenario: lost/rotated Supabase service role key or VAPID keys
- Service role key: rotate in Supabase Dashboard → Settings → API, update `SUPABASE_SERVICE_ROLE_KEY` in Vercel env vars, redeploy. No data impact.
- VAPID keys: rotating these invalidates every existing browser Web Push subscription (users will silently stop receiving push until they revisit the app and it re-subscribes, since `NEXT_PUBLIC_VAPID_PUBLIC_KEY` changing means old subscriptions are cryptographically tied to the old key). Native app push tokens are unaffected (different mechanism). Plan for a support message if you ever rotate these.

## Scenario: `CRON_SECRET` compromised
- Rotate the value in Vercel env vars — Vercel automatically sends the new value as the `Authorization` header on the next cron invocation, no other change needed.

## What is NOT covered here
Anything requiring a reverse-engineered SQL migration to undo a
destructive schema change — this project's own convention is to avoid
destructive migrations specifically so this never comes up (see
`DATABASE_SCHEMA.md`). If you're ever tempted to write `drop column` or
`truncate` in a migration, that's the moment to write a manual backup
first and consider whether it can be additive instead.
