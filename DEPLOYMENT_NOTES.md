# DEPLOYMENT_NOTES.md

_Updated for: Merge of Phase 3/4 (Audited Release) + Phase 5/6 (Audited Release)_

## Vercel Readiness

- `vercel.json` present with `framework: nextjs` and a `crons` entry for Automatic Backup (daily, `0 2 * * *`). Vercel Cron on the Hobby plan supports at most one run/day — this schedule is compatible.
- `.eslintrc.json` present (Phase 6.11) — `next build` will now run lint checks.

## Supabase Readiness

**Migrations must be run in order.** If the Phase 3/4 migrations (18-21) are already applied to your database, only run 22-28. If starting fresh, run the full sequence 01-28 in order, skipping the two `.DEPRECATED.sql` files:

```
18_leave_requests.sql
19_rent_extension_requests.sql
20_move_out_requests.sql
21_deposit_deduction_items.sql
22_visitor_management.sql
23_parcel_management.sql
24_waiting_list.sql
25_room_change_log.sql
26_automatic_backup.sql
27_archive_restore.sql
28_database_optimization.sql
```

**Do not run** `09_electricity_bills.DEPRECATED.sql` or `09_utility_bills.DEPRECATED.sql` — both superseded by `utility_bills` (created in `09_CATCH_UP_ALL.sql`), kept only for history.

New private storage bucket `automatic-backups` is created by migration 26 — confirm it exists in the Supabase dashboard after running migrations.

## Required Environment Variables

See `.env.local.example` for the full documented list. New since the Phase 5/6 track:

| Variable | Required for | Notes |
|---|---|---|
| `CRON_SECRET` | Automatic Backup | Any random string; Vercel sends it automatically as `Authorization: Bearer $CRON_SECRET`. Generate with `openssl rand -hex 32`. |
| `SUPABASE_SERVICE_ROLE_KEY` | Automatic Backup cron route, Push send route | Pre-existing. Confirmed server-only — never referenced from a `'use client'` file. |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | Push notifications | Pre-existing, unchanged. |

`NEXT_PUBLIC_SUPER_ADMIN_EMAIL` is documented but not currently read by the app (see the corrected comment in `.env.local.example`) — don't rely on it for access control.

## Deployment Steps

1. Run the pending migrations against the target Supabase project (see above — the exact set depends on whether Phase 3/4's migrations are already applied).
2. Set/confirm all environment variables listed above and in `.env.local.example`.
3. Deploy to Vercel (or `npm install && npm run build && npm start` elsewhere — the `crons` entry only fires on Vercel; Automatic Backup would need a different scheduler on another host).
4. After first deploy, verify:
   - The cron job appears in Vercel's Cron Jobs tab.
   - `/api/push/vapid-public-key` returns a real key.
   - A real push notification still sends end-to-end (the `/api/push/send` auth fix changed this endpoint's behavior — confirm a real owner/tenant action still triggers a notification correctly, for both a Phase 3/4 flow like a leave-request decision and a Phase 5 flow like a resolved complaint or parcel log).
5. Run `npm install && npm run build && npm run lint` as the first real verification step. Neither this merge nor either of the two source audits could run these in their respective environments (no network access) — static analysis (import cross-referencing, brace-balance sweeps, JSON validation) was as thorough as possible without one, but it is not a substitute for a real build.
