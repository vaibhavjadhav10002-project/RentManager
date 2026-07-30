# API_DOCUMENTATION.md

This app is mostly Server/Client Components calling Supabase directly
through `src/lib/supabase/queries.ts` (see below) — it is **not** a
traditional REST API app. There are exactly four real HTTP routes.

## HTTP API routes

### `GET /api/push/vapid-public-key`
Returns the public VAPID key so the browser can call `PushManager.subscribe()`. No auth required (it's a public key by design).

### `POST /api/push/resubscribe`
Body: `{ old_endpoint, new_endpoint, p256dh, auth_key }`. Rotates a browser's push subscription when the browser itself changes the endpoint (this happens periodically — browsers are allowed to do this). Requires an authenticated session.

### `POST /api/push/send`
Body: `{ user_ids: string[], title, body, url?, tag? }`. Requires an authenticated session; non-`super_admin` callers are restricted server-side to `user_ids` that are tenants of a property they own (RLS-equivalent check done manually here since this route uses the service-role key). Sends via `web-push` to Web Push subscriptions; native (FCM/APNs) rows are currently logged and skipped — see `MOBILE_GUIDE.md`. Always logs to `notification_log` regardless of delivery outcome. Runtime: `nodejs` (required — `web-push` needs Node's `crypto`).

### `GET /api/cron/automatic-backup`
Triggered by Vercel Cron (`vercel.json`, daily at 02:00 UTC) with `Authorization: Bearer $CRON_SECRET`. Not meant to be called by the app itself. Exports every owner's full data set to the private `automatic-backups` storage bucket and records a row in `backup_runs`.

**Note:** an `api/whatsapp` route directory existed in the codebase but contained no route file — WhatsApp is implemented as client-side click-to-chat (`wa.me` links via `clickToChatProvider.ts`), not a server endpoint. The empty directory was removed as unused (see `PRODUCTION_POLISH_REPORT.md`).

## The real "API" — `src/lib/supabase/queries.ts`

Every other piece of data access in the app goes through this file —
~1500 lines, one exported async function per operation (e.g.
`getTenants(propertyId)`, `addPayment(...)`, `resolveComplaint(...)`).
Pages call these functions; they never call `supabase.from(...)`
directly. If you're adding a feature, add the query function here first,
then call it from the page — this keeps every data-access pattern (and
its error handling) in one place instead of scattered across ~40 pages.

Types for every query's input/output live in `src/types/index.ts`.

## Authentication for all of the above

Both HTTP routes and query functions rely on the Supabase session
(cookie-based via `@supabase/ssr`). Server-side calls use
`src/lib/supabase/server.ts`'s client (reads the session from request
cookies); client-side calls use `src/lib/supabase/client.ts`'s browser
client. The service-role key (`SUPABASE_SERVICE_ROLE_KEY`) is used only
in `api/push/send` and `api/cron/automatic-backup`, is never exposed to
the client, and both routes manually re-implement the ownership check
RLS would otherwise provide, since the service-role key bypasses RLS by
design.
