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

---

# Changelog — Property Switcher: Occupancy Badge

## Checked
- `PropertySwitcherCard` (reference zip) vs my existing Topbar property switcher: same functionality (switch property, "All Properties" view, Add Property modal) — already present, not recreated.

## Added
- Per-property **occupancy % badge** in the switcher dropdown (green ≥90%, red <50%, gray otherwise), matching the reference. Fetched via existing `getDashboardStats`, only when the dropdown is opened (not on every render) to avoid unnecessary calls.

## Files Modified
- `src/components/shared/Topbar.tsx`

---

# Changelog — Phase 1: Professional Documents

## Added
- **Premium Rent Agreement PDF** (`generateFullAgreementPDF`, now async): logo badge, "DIGITALLY GENERATED" diagonal watermark, tenant photo (from `tenants.photo_url`, if set), creation date, lock-in period (optional, shown only if provided), owner + tenant signature lines, and a QR code that encodes a verification summary (agreement no., tenant, property, room, dates, status) so a scanned copy can be cross-checked against the printed page.
- **Premium Payment Receipt PDF** (`generateReceiptPDF`, now async): receipt date & time, computed billing period (e.g. "01 Jul 2026 – 31 Jul 2026", parsed from the existing `for_month` label), previous due / late fee / discount / advance adjustment / deposit adjustment (all optional — only rendered when a caller actually provides a non-zero value, never fabricated), remaining balance, transaction/UPI reference, owner signature line, "PAID" watermark, QR verification code.
- **`reference_number`** column added to `payments` (`supabase/16_payment_reference_number.sql`) + a matching optional field in the "Record Payment" form (shown only for UPI/Bank Transfer), so the receipt's "Transaction/UPI Reference" line has something real to display.
- `qrcode` + `@types/qrcode` added as dependencies (separate from the existing `qrcode.react`, which is a React-only renderer and can't produce a data URL for embedding in a PDF).

## Scope notes (kept honest, nothing fabricated)
- **PG Logo**: no property-logo-upload feature exists yet, so a styled monogram badge (property initials on a colored square) is used instead of a real image. Real logo upload would be a separate feature.
- **Government ID Number**: the app captures a *photo* of the ID (not a typed number) — the PDF shows "Verified — photo on file" rather than inventing a number.
- **QR "Verification"**: encodes a data summary for manual cross-checking, not a link to a public verification webpage (none exists) — avoids implying a feature that isn't built.
- **Late fee / discount / advance & deposit adjustments** on the receipt are accepted as optional inputs but nothing in the app currently *calculates* them (that's Phase 2 — "Late Fee Auto Calculation" — by design). They'll start appearing automatically on receipts once Phase 2 wires real values in.

## Required action
Run `supabase/16_payment_reference_number.sql` in the Supabase SQL Editor.

## Files Modified
- `src/lib/pdf.ts` (major rewrite of both PDF generators)
- `src/app/(tenant)/portal/page.tsx`, `src/app/(owner)/payments/page.tsx` (await + new fields)
- `src/types/index.ts` (`reference_number` on `Payment`/`RecordPaymentInput`)
- `package.json` (`qrcode`, `@types/qrcode`)

