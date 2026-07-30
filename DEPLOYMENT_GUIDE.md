# DEPLOYMENT_GUIDE.md

Canonical deployment reference. `DEPLOYMENT_NOTES.md` is kept alongside
this as the dated, pass-by-pass history of deployment-relevant changes —
read this file for "how do I deploy today," read that one for "why does
this env var/migration exist."

## 1. Prerequisites
- Supabase project (Postgres + Auth + Storage)
- Vercel account (or any Node host — see note on cron below)
- Web push VAPID keypair (`npx web-push generate-vapid-keys`)

## 2. Database
Run every file in `supabase/` numerically, skipping `.DEPRECATED.sql`
files — see `DATABASE_SCHEMA.md` for the exact order and which numbers
are safe to skip if migrating an existing database forward.

## 3. Environment variables
Copy `.env.local.example` → `.env.local` (local dev) and set the same
keys in Vercel's Project Settings → Environment Variables (production).
Every variable the app reads is documented with an inline comment in
that file — treat it as the single source of truth, not this list.

## 4. Deploy
```bash
npm install
npm run build   # do this locally at least once before first deploy —
                 # confirms no TypeScript/build errors before Vercel does
```
Then either connect the repo to Vercel (recommended — picks up
`vercel.json`'s cron config automatically) or `vercel --prod`.

**If not hosting on Vercel:** the `crons` entry in `vercel.json` only
fires on Vercel. On another host, trigger `GET /api/cron/automatic-backup`
(with the `Authorization: Bearer $CRON_SECRET` header) from your own
scheduler (e.g. a system cron job calling `curl`) once daily instead.

## 5. Post-deploy verification
- `/api/push/vapid-public-key` returns a real key
- A real push notification sends end-to-end for both an owner action (e.g. approving a leave request) and a tenant-facing one (e.g. a resolved complaint)
- The cron job appears in Vercel's Cron Jobs tab (or your external scheduler fires correctly)
- Log in as each role (super_admin, owner, tenant) and confirm the correct area loads and no other role's data is visible

## 6. Mobile app deployment
The Android/iOS app is a Capacitor shell pointed at this same deployed
URL — there's no separate mobile deployment, just a native build
pointed at whatever URL you deployed in steps 1-5. See `MOBILE_GUIDE.md`
for the native build steps, which happen on your local machine
(Android Studio / Xcode), not as part of this web deployment.

## 7. Rolling back
Vercel keeps previous deployments — use "Promote to Production" on a
prior deployment in the dashboard for an immediate code rollback.
Database migrations are not automatically reversible — see
`DISASTER_RECOVERY.md` before running anything destructive.
