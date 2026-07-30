# DEPLOYMENT_CHECKLIST.md

## Before first deploy
- [ ] Run `npm install && npm run build && npm run lint` locally — not
      possible in the environment that produced this audit (no
      network/npm access); this is the first real compiler/lint pass
      this code will get.
- [ ] Run every migration in `supabase/` numerically (skip
      `.DEPRECATED.sql` files) — see `DATABASE_SCHEMA.md`.
- [ ] Resolve the legacy/loose SQL files flagged in
      `PRODUCTION_AUDIT.md` against your actual Supabase project before
      relying on this repo as the single source of truth for schema.
- [ ] Set every variable in `.env.local.example` in your host's
      environment settings (Vercel, etc.) — especially
      `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
      `SUPABASE_SERVICE_ROLE_KEY`, VAPID keys, `CRON_SECRET`.
- [ ] Confirm `CAPACITOR_SERVER_URL` (or the hardcoded fallback in
      `capacitor.config.ts`) points at your real production domain
      before building the native app.

## Branding
- [ ] Update `public/app-version.json`'s `apkDownloadUrl` placeholder
      to your real APK hosting URL before Android users can act on an
      update prompt.
- [ ] Confirm the `capacitor.config.ts` `appId` change
      (`com.pgmanager.app` → `com.rentivo.app`) is intentional — see
      `KNOWN_LIMITATIONS.md`; this affects existing installs if any
      exist under the old ID.

## Explore Mode
- [ ] Click through: `/welcome` → Explore Rentivo → browse
      Dashboard/Properties/Tenants/Payments/Complaints/Notices → attempt
      an Add/Edit/Delete action → confirm the lock sheet appears →
      Login/Create Account → confirm you land on the real login screen
      and the explore cookie is cleared.
- [ ] Confirm a real login always works identically whether or not a
      stale explore cookie is present in the browser.

## App Update System
- [ ] Bump `versionCode` in `app-version.json` above your test device's
      installed build → confirm the optional dialog appears.
- [ ] Set `forceUpdate: true` → confirm no "Later" button, confirm the
      required-update message shows.
- [ ] Confirm no dialog appears on web/PWA or on iOS (Android-only by
      design).

## Mobile build (Android)
- [ ] `npm install`, then `npx cap add android`, then
      `npx @capacitor/assets generate` (see `MOBILE_BUILD_REPORT.md`).
- [ ] Apply the manifest edits in `POST_BUILD_ANDROID.md`.
- [ ] Build a signed AAB/APK per `MOBILE_BUILD_REPORT.md` §4 — not done
      in this environment (no Android SDK here).

## Final sanity pass on Vercel/GitHub
- [ ] Confirm the deployed favicon/app icons actually render (this
      audit found and fixed a real bug where these were fully
      transparent — verify visually on the real deployed site, not just
      by trusting this fix).
- [ ] Confirm `/app-version.json` is reachable at your production
      domain (`curl https://yourdomain.com/app-version.json`).
- [ ] Confirm `/welcome`, `/login`, `/dashboard` (as an explorer),
      `/portal`, and `/admin` all load without a redirect loop.
