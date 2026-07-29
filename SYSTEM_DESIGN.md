# SYSTEM_DESIGN.md

Complements `ARCHITECTURE.md` (the map) with the *flows* — how a request
actually moves through the system. Read `ARCHITECTURE.md` first.

## Request flow (typical page load)

1. Browser/WebView requests a route → `src/middleware.ts` runs first: refreshes the Supabase session from cookies, redirects unauthenticated users to `/login`, redirects authenticated users away from `/login` to their role's home, and blocks `/admin` and `/portal` from the wrong roles.
2. The Server Component for that route runs, calling `src/lib/supabase/server.ts`'s server-side Supabase client (cookie-based session) to fetch data via `queries.ts`.
3. Client Components hydrate and take over for interactivity, using `src/lib/supabase/client.ts`'s browser client for any further mutations.
4. RLS policies re-check every query at the database level regardless of what the middleware already allowed — this is the actual security boundary, not a formality.

## Auth & session model

- Supabase Auth issues a session; `@supabase/ssr` keeps it in cookies so both server and client can read it.
- Role lives on `profiles.role`, not in the JWT — every role check queries `profiles` rather than trusting a cached claim, so a role change takes effect on the next request, not just the next login.
- Tenants log in through the same Supabase Auth as owners/admins; `tenants.auth_user_id` links a tenant record to its auth identity.

## Multi-tenancy model

"Tenant" here means two things — don't confuse them:
- **Multi-tenant SaaS sense:** each `owner` owns one or more `properties`; RLS scopes almost every table by `owner_id`/`property_id` so one owner's data is invisible to another's, enforced at the database level.
- **Domain sense:** a `tenants` row is a paying guest renting a room — the app's actual subject matter.

## Communication engine flow

`message_templates` (per-property, seeded defaults + owner customizations) → `communication_queue` (pending sends) → `CommunicationService`/`ReminderEngine` process the queue → `communication_logs` records the outcome (sent/failed/cancelled) regardless of channel (WhatsApp click-to-chat today; push always fires in parallel via `sendPushNotification`). The Inbox page reads `communication_logs` for history — it's an outcome log, not a live message store.

## Push notification flow (two independent delivery paths, one storage table)

- **Web (browser/PWA):** `enablePushNotifications()` → browser `PushManager.subscribe()` → row in `push_subscriptions` with `p256dh`/`auth_key` → `/api/push/send` calls `web-push` with the VAPID keys.
- **Native (Android/iOS app):** `registerNativePush()` → FCM/APNs device token → row in the *same* `push_subscriptions` table with `native_token`/`native_platform` instead → `/api/push/send` currently logs-but-skips these rows (relay not yet implemented — see `MOBILE_GUIDE.md`).
- Both paths write to `notification_log` regardless of delivery outcome, so the in-app notification bell always has history even if a push was blocked/undelivered.

## Payments & money-calculation flow

Every derived number (late fee, prorated rent for a leave period, advance-balance application, deposit refund) is computed by a single shared function in `src/lib/utils/index.ts`, called identically from the tenant portal and the owner dashboard/payments list. This is intentional and should never be forked — if a number needs to change, change the one function, not each call site, or the two views will silently disagree.

## Offline design

`public/sw.js` is deliberately network-first for everything except a
small, explicit static asset list (icons, manifest, offline page) —
this app shows live financial data, so caching pages/API responses was
rejected as a strategy; the service worker only ever serves something
locally when the network request itself failed. `offlineQueue.ts`
queues exactly two mutation types (visitor check-in, parcel logging)
where "record it now, sync when back online" is safe and useful —
it is not a general-purpose offline-write layer for the whole app.

## Backup/restore flow

Manual export (`(owner)/backup`) and scheduled export (`api/cron/automatic-backup`, Vercel Cron, daily) both produce the same JSON shape (`backup_format: 'pg-manager-saas-v1'`) — one property's full record set per bundle entry. Restore (`(owner)/restore`) is merge-only by design: it upserts by ID rather than truncating tables first, so a bad restore can't silently delete data that existed after the backup was taken. See `BACKUP_RESTORE_GUIDE.md` for operational steps.

## Key architectural decisions and why

| Decision | Why |
|---|---|
| Capacitor "remote URL" mode, not static export | Real server routes (push send, cron, WhatsApp) can't run in a static bundle |
| Two separate design systems (owner/tenant) | Deliberate product differentiation, not duplication — see `ARCHITECTURE.md` |
| One shared calculation layer for money | Prevents tenant/owner views from disagreeing on a number |
| Merge-only restore | A bad restore should never be able to delete data |
| Network-first service worker | Financial data must never be served stale from cache |
