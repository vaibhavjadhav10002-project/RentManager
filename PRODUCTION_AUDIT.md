# PRODUCTION_AUDIT.md

Senior-engineer audit of this specific codebase (the authoritative
`RentManager-main` project provided for final merge), performed by
actually inspecting files and testing logic — not by assumption. Every
item below is either a verified finding with a fix, or an explicit
"checked, no issue found" — nothing here is invented.

## Critical — found and fixed

**Brand icon files were fully transparent.** The rounded/circle app
icon, favicon, and apple-touch-icon (derived from the Rentivo brand
identity work) were blank at every pixel — a masking bug where the
"keep" shape was drawn in black with the mask's *alpha* channel doing
the work, but ImageMagick's `-compose CopyOpacity` reads *luminance*,
not alpha, for the new alpha channel. Black-on-black meant every pixel
resolved to alpha=0. Found via direct pixel sampling (`center: srgba(0,0,0,0)`
where it should have been opaque), fixed by redrawing the masks
white-on-black, and reverified with pixel checks on every regenerated
file before and after. This would have shipped as an invisible home
screen icon and browser tab icon.

**Explore Mode nested-embed bug.** `getPayments()` uses
`tenant:tenants(..., room:rooms(room_number))` — a nested embed — but
the mock query builder only resolved one level, silently dropping
`tenant.room`. Fixed with a recursive resolver and verified with a
direct reproduction test against real seed data (confirmed
`payment.tenant.room.room_number` resolves correctly after the fix).

**Update checker had no platform scope.** It would have shown an
"Update Now → download APK" prompt on iOS, where APK sideloading
doesn't exist. Fixed to check `getPlatform() === 'android'` explicitly.

## High — found and fixed

**Stale branding across 6 files.** "PG Manager" text remained in
`Sidebar.tsx`, `AdminSidebar.tsx`, the login heading, the restore-page
error message, the downloaded backup filename, and generated PDF
content (agreements/receipts/ID cards). All updated to "Rentivo".

**Two identifiers deliberately left unchanged, and why.** The
`@pgmanager.local` synthetic email domain (used to log phone-based
tenants into Supabase Auth, which requires an email) and the
`pg-manager-saas-v1` backup-format version string are functional
identifiers, not display text. Renaming either would break login for
every existing phone-based account and break restore for every
existing backup file. Left untouched on purpose — see
`KNOWN_LIMITATIONS.md`.

## Medium — found, minor fixes applied

- Join/onboarding form's mobile validation accepted 11+ digit numbers
  (`digits.length < 10` instead of `!== 10`) — fixed.
- Join form's name field had no maximum length guard — added (80 chars).
- `AddPropertyModal`'s UPI ID field had no format validation at all —
  added (see `VALIDATION_REPORT.md`).

## Reviewed, no change needed

- **Unused imports:** fresh sweep across the entire current `src/`
  tree — zero found.
- **Console logs / debugger statements / TODO / FIXME:** zero found
  across the whole codebase.
- **XSS surface:** no `dangerouslySetInnerHTML` anywhere in the app.
- **`eval`/`new Function`:** none found.
- **Hardcoded secrets:** none found outside `process.env.*` references.
- **`push/send` API route's manual ownership check:** re-verified
  intact and correctly gated behind the Node runtime with the
  service-role key never exposed to the client — unaffected by
  everything else changed in this or prior sessions.
- **React hooks in all newly-merged components** (`ExploreLockSheet`,
  `AppUpdateChecker`, `context.tsx`): dependency arrays checked by
  hand — all correct (empty arrays for genuine mount-once effects,
  correctly-returned cleanup functions where a subscription exists).
- **Duplicate submission prevention:** already present on the
  highest-risk form checked (join/onboarding's final submit button is
  disabled while saving).
- **Explore Mode security model:** re-verified — the mock client has
  zero network configuration (no URL, no key), a real session is
  always checked before the explore-cookie branch in every gate
  (middleware, layout, root page), and Explore Mode cannot reach
  `/admin` or `/portal`.

## Not fully covered — scope and reasoning

**`any` usage (212 occurrences across 41 files).** `tsconfig.json`
already has `strict: true`, so every one of these was a deliberate
opt-out, not an accidental gap — this is pre-existing debt, not
something introduced recently. Roughly 87 are `catch (e: any)` (a very
common, low-severity pattern; TypeScript itself defaulted catch
bindings to `any` for years). The remainder are mostly inline callback
parameters (`payments: any[]`, etc.) where a proper type likely already
exists in `src/types/index.ts` and just wasn't wired up. **Deliberately
not mass-edited in this pass:** with no `npm install`/`tsc` available in
this environment to verify a change across 41 files doesn't introduce a
type mismatch, a blind sweep of this size is a bigger risk to stability
than the debt itself — exactly the kind of change a senior engineer
would refuse to do without a compiler in the loop. Recommended as a
prioritized, file-by-file post-launch cleanup (catch-blocks first,
lowest risk) — see `KNOWN_LIMITATIONS.md`.

**"Audit every form."** Time/effort-boxed to the highest-value, most
field-heavy forms (tenant onboarding/join, property creation) rather
than all ~40 pages with a form. See `VALIDATION_REPORT.md` for exactly
what was checked and what wasn't.

**Legacy/duplicate SQL files.** `supabase/` contains both
`09_electricity_bills.sql`/`09_utility_bills.sql` (live) and their
`.DEPRECATED.sql` twins, plus several loose, unnumbered setup scripts
(`schema.sql`, `seed-test-data.sql`, `create-user.sql`,
`fix-join-link-cache-bug.sql`, etc.) alongside the numbered migration
series. Flagged, not deleted — I can't confirm from this environment
which of these has actually been run against the real production
database, and deleting the wrong one is a much worse outcome than
leaving a stale file in the repo. Needs a human check against the real
Supabase project before cleanup.

## Not verified in this environment

- No `npm install && npm run build` was run (no network access in this
  sandbox) — the standing caveat on every pass touching this codebase.
- No Android Studio / Xcode build, no APK/AAB compile, no Play
  Store/App Store upload.
- No Lighthouse run, no real device testing (small/large phones,
  tablets, landscape/portrait) — layout correctness for these was
  reviewed by reading the CSS/breakpoints, not by rendering on an
  actual device.
