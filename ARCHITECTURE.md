# ARCHITECTURE.md

## Stack
- **Framework:** Next.js 15 (App Router), TypeScript, React 18
- **Database/Auth/Storage:** Supabase (Postgres + RLS, Supabase Auth, Storage buckets)
- **Styling:** Tailwind CSS + `class-variance-authority` (two parallel design systems — see below)
- **Mobile:** Capacitor 6 (Android + iOS), same codebase, remote-URL shell — see `MOBILE_GUIDE.md`
- **Hosting:** Vercel (see `DEPLOYMENT_GUIDE.md`)

## Application shape

Three role-based areas under Next.js route groups, each with its own auth guard in `src/middleware.ts`:

```
src/app/
  (admin)/admin/          — super_admin only
  (owner)/                — owner role: dashboard, rooms, tenants, payments,
                            approvals, expenses, notices, reports, visitors,
                            parcels, waiting-list, room-change, backup/restore,
                            archive, settings, documents, inbox
  (tenant)/portal/        — tenant role: single-page portal (payments, requests,
                            documents, notices)
  (auth)/login, /join     — public
  api/                    — the only real server endpoints (see API_DOCUMENTATION.md)
```

`profiles.role` (`super_admin | owner | tenant`) is the single source of truth
for access control, enforced in two places that must agree: `middleware.ts`
(route-level redirect) and Postgres RLS policies (row-level, the real
security boundary — middleware is UX, not the security guarantee).

## Two design systems, on purpose

Owner and Tenant portals each have their own component library
(`src/components/owner/ui/`, `src/components/tenant/ui/`) with separate
Tailwind token sets (`owner-theme.css`, `tenant-theme.css`) and separate
`ThemeProvider`/dark-mode state. This was a deliberate product decision
(Owner = dense admin dashboard, Tenant = simpler consumer-style portal),
not duplicate code — confirmed during the RC audit that the two
component sets differ meaningfully in tokens/behavior, not just naming.
`src/components/shared/` holds the handful of components genuinely
common to both (error boundaries, status timeline, PWA/native bootstrap).

## Data layer

All Supabase reads/writes go through `src/lib/supabase/queries.ts`
(~1500 lines, one exported function per operation) — pages never call
`supabase.from(...)` directly. This is the layer to extend for any new
feature and the layer to read first to understand what the app can do.

`src/lib/utils/index.ts` holds pure business-logic helpers shared across
owner/tenant views (rent proration, late fee calculation, advance-balance
application) — these exist specifically so the tenant portal and owner
dashboard can never disagree on a number.

## Cross-cutting engines
- **Communication Engine** (`src/lib/communication/`) — templates, queue, retry, WhatsApp click-to-chat, reminder scheduling. See `API_DOCUMENTATION.md` / `PROJECT_STATE.md`.
- **Push Notifications** (`src/lib/push.ts` + `src/lib/native/push.ts`) — Web Push (VAPID) for browser/PWA, native FCM/APNs tokens for the mobile app, same `push_subscriptions` table.
- **PDF/Documents** (`src/lib/pdf.ts`) — agreements, receipts, tenant ID cards; native-aware save via `src/lib/native/share.ts`.
- **Offline** (`public/sw.js`, `src/lib/offlineQueue.ts`) — network-first service worker with an offline fallback page, plus an action queue for a couple of specific mutations (visitor check-in, parcel logging) that make sense to queue.

## Why the mobile app doesn't fork the codebase
See `MOBILE_GUIDE.md` for the full reasoning — short version: the app has
real server routes (push send, cron, WhatsApp) that a static export can't
serve, so the Android/iOS app is a Capacitor shell pointed at the live
production URL rather than a separately-built bundle. One codebase, one
deploy target, native capabilities (camera/share/push/back-button)
layered on top via `src/lib/native/`.

## Further reading
`PROJECT_STATE.md` and `CHANGELOG.md` are the authoritative history of
*what* was built and *why*, phase by phase — read those before this file
if you need the reasoning behind a specific feature, not just its shape.
