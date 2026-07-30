# BACKUP_RESTORE_GUIDE.md

## Two ways a backup gets made
1. **Automatic** — `api/cron/automatic-backup` runs daily (02:00 UTC on Vercel) for every owner with backup enabled in `backup_settings`, storing the export in the private `automatic-backups` Supabase Storage bucket and logging a row in `backup_runs`.
2. **Manual** — an owner visits `(owner)/backup` and downloads a JSON file directly (routes through the native share sheet inside the mobile app, a normal browser download on web).

Both produce the identical shape: `{ backup_format: 'pg-manager-saas-v1', exported_at, properties: [...] }` — every property the owner has, in full, never scoped to "currently selected property" (a partial backup would be worse than no backup).

## Restoring
1. Owner goes to `(owner)/restore` and uploads a previously exported JSON file.
2. The app **upserts by `id`** into each table (`onConflict: 'id'`) — it never deletes or truncates first. This means restoring is always safe to run, even against a database that already has some of the data: existing rows with matching IDs get overwritten with the backup's values, rows that don't exist in the backup are left untouched.
3. The restore screen reports per-table upserted/failed counts — check for any `failed` entries before considering a restore complete.

## What restore does NOT do
- Does not delete rows that exist in the database but aren't in the backup file (by design — see `DISASTER_RECOVERY.md`'s reasoning).
- Does not restore Supabase Auth users/passwords — those live in Supabase Auth, not in the exported tables. A restore assumes the owner/tenant accounts already exist; it's for data, not identity.
- Does not restore uploaded files (gov ID photos, etc.) stored in Supabase Storage — only database rows. If a storage bucket is lost, that's a separate recovery (Supabase Storage doesn't currently have automated backup in this project).

## Checking backup health
`(owner)/backup` shows recent `backup_runs` history (success/failure per day) for the automatic backup — an owner or support person can check this without needing database access.

## Retention
This project does not currently implement automatic deletion of old
backups — `backup_runs`/storage objects accumulate. If storage cost
becomes a concern, add a retention policy (e.g. keep last 30 daily
backups) as a follow-up; not implemented as part of this pass since it
would be a new feature, not a fix.
