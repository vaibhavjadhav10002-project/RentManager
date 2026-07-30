# KNOWN_LIMITATIONS.md

Consolidates every deliberate scope decision and every "not verified
here" item from this final merge/audit pass, in one place, so nothing
is buried in a longer report.

## Deliberately unchanged (would break real users if touched)
- **`@pgmanager.local` email domain** (`(auth)/login/page.tsx`) — used
  to construct a Supabase Auth email for phone-based logins. Changing
  it would lock out every existing phone-based account on their next
  login. Cosmetic branding elsewhere was updated; this was not.
- **`pg-manager-saas-v1` backup format string** (backup/restore/cron
  files) — an internal version tag checked on restore. Changing it
  would break restoring any backup file created before this change.
- **`pg-manager-offline-queue` localStorage key** (`offlineQueue.ts`) —
  internal, never shown to users. Renaming risks silently orphaning any
  queued offline action already sitting in an existing user's browser.
  Left as-is; zero user-visible benefit to changing it.
- **`com.pgmanager.app` → `com.rentivo.app` Capacitor appId** — this
  ONE was changed (unlike the three above) because the brand identity
  and app name are genuinely moving to Rentivo. Flagging it here
  because it has a real consequence: Android treats a different
  `applicationId` as a completely different app — any existing install
  under the old ID will not receive future builds as an "update," and
  Play Store listings are tied to the package name. Confirm this is
  the intended clean break before building a release AAB.

## Known technical debt (not fixed, scoped deliberately)
- **212 `any`-typed values across 41 files**, `strict: true` already
  on. See `PRODUCTION_AUDIT.md` for the full reasoning — not mass-edited
  without a compiler available to verify against.
- **Legacy/loose SQL files** in `supabase/` alongside the numbered
  migration series — flagged, not deleted, pending a human check
  against the real database.
- **Validation utility (`src/lib/validation.ts`) rolled out to 2
  forms, not all of them.** See `VALIDATION_REPORT.md`.

## Not verified in this environment
- No `npm install`/`npm run build`/`npm run lint` — no network access
  in this sandbox.
- No Android Studio, Xcode, or actual APK/AAB/IPA compilation.
- No Play Store / App Store submission.
- No Lighthouse audit, no real-device testing (phones, tablets,
  landscape/portrait) — reviewed by reading breakpoints/CSS, not by
  rendering on hardware.
- No load/performance testing under real traffic.

## Explore Mode coverage limits
- Read data covers the core entities (properties, rooms, tenants,
  payments, complaints, notices, expenses, visitors, parcels) — screens
  reading tables outside that set render an empty state, not a crash,
  but also not populated sample data.
- No self-serve signup exists in this app (Super-Admin provisioned
  accounts only) — "Create Account" currently opens the ordinary login
  screen. A real product decision, not a bug.

## App Update System
- Android only, by design — see `APP_UPDATE_SYSTEM.md`. iOS has no APK
  sideload concept; web/PWA update automatically on deploy.
- Play Store migration is scoped to one function
  (`src/lib/update/trigger.ts`) but the actual Play Core integration
  code has not been written — see the migration plan in
  `APP_UPDATE_SYSTEM.md`.
