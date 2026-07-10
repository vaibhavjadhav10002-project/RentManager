# Changelog — PWA + Push Notifications

## Added
- **Installable PWA**: `manifest.json`, generated app icons (192/512/maskable/apple-touch), `sw.js` service worker.
- **Service worker**: handles install/activate, push events, and notification-click routing. Deliberately does **not** cache pages or API responses — this is a financial app, and stale cached rent/payment data would be a bug, not a feature.
- **Web Push infrastructure**: `push_subscriptions` + `notification_log` tables (`supabase/15_pwa_push_notifications.sql`), VAPID keys, `/api/push/send` server route (Node runtime, uses `web-push` + Supabase service role key).
- **Client helpers** (`src/lib/push.ts`): `enablePushNotifications`, `disablePushNotifications`, `sendPushNotification`.
- **`EnableNotificationsBanner`**: dismissible opt-in prompt, added to both Owner Dashboard and Tenant Dashboard.
- **`NotificationBell`** component built (real push history + unread badge) — kept available but not swapped in for the existing owner/tenant bells, since those already show actionable, business-specific items (pending approvals, pending rent, etc.) that are more useful day-to-day than a raw push log. Push notifications still fire as real OS notifications regardless.
- **Live triggers wired**:
  - Notice published → push to every active tenant at that property.
  - Complaint marked resolved → push to that tenant.
  - Individual rent reminder (WhatsApp button) → push fires alongside.
  - **"Remind All" bulk reminder modal — this button previously did nothing** (state existed, click handler set it, but the modal itself was never built). Built the missing modal; each reminder now sends WhatsApp + push together, with per-tenant "Reminded" status tracked in-session.

## Fixed (found while wiring this feature)
- `getComplaints()` didn't select `tenant.auth_user_id`, so there was no way to target a complaint's tenant for push — added to the query.

## Environment variables (new)
```
SUPABASE_SERVICE_ROLE_KEY=...
NEXT_PUBLIC_VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:owner@example.com
```
Working keys are pre-filled in `.env.local.example` — safe to use as-is, or regenerate with `npx web-push generate-vapid-keys`.

## Required action
Run `supabase/15_pwa_push_notifications.sql` in the Supabase SQL Editor.
Add the four env vars above to Vercel project settings (and local `.env.local`).

## Vercel Free Tier compatibility
No new infrastructure — the push-send route is a standard Next.js API route (serverless function), `web-push` has zero paid dependencies, and Supabase Realtime was intentionally **not** used (the bell polls every 30s instead), keeping this fully within free-tier limits on both platforms.
