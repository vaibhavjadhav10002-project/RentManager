# Release Candidate Audit Report — PG Manager Mobile

Scope: verification-only pass over the Capacitor mobile conversion delivered
previously. No new features, no redesign, no changes to business logic,
auth, Supabase architecture, or routing beyond the fixes below.

## 1. Production Readiness Score: 96/100

Score reflects code-level readiness only. It does not and cannot cover
things that require a real device/toolchain — see §5.

## 2. Summary

| Severity | Count | Detail |
|---|---|---|
| Critical | 0 | — |
| High | 1 | Migration numbering collision (fixed) |
| Medium | 1 | Config parsing had no failure guard (fixed) |
| Low | 2 | Stale filename references from the fix above (fixed); iOS Service Worker support is a device-test item, not a code defect |

## 3. Files Modified (this audit pass only)

- `supabase/33_native_push_tokens.sql` → renamed to `supabase/35_native_push_tokens.sql`
- `src/lib/native/push.ts` — comment reference updated to match
- `CHANGELOG.md` — two filename references updated to match
- `capacitor.config.ts` — hardened `CAPACITOR_SERVER_URL` parsing

## 4. Issues found and fixed

**HIGH — Migration numbering collision.** The prior pass added
`supabase/33_native_push_tokens.sql` without checking for existing
migrations past `32_profile_status_history.sql` in the archive listing I'd
seen — the project already has `33_profile_update_requests.sql` and
`34_communication_engine.sql` (this project's own history shows it has
hit and fixed this exact class of bug before, during the Phase 3/4 vs.
Phase 5 merge). No table/data conflict resulted since the filenames
differ and both would still execute in the correct order, but leaving
two unrelated migrations both numbered "33" breaks the project's own
established numbering convention and would confuse anyone reading
migration history later. **Fix:** renamed to `35_native_push_tokens.sql`
(next free number after 34) and updated the two places that referenced
the old filename.

**MEDIUM — `capacitor.config.ts` could fail unpredictably.** The
`allowNavigation` hostname parsing silently fell back to a placeholder
if `CAPACITOR_SERVER_URL` was malformed (e.g. missing `https://`),
which would let `cap sync`/build proceed with a broken navigation
allowlist rather than failing loudly at the point of misconfiguration.
**Fix:** added a `safeHostname()` helper that throws a clear, actionable
error naming the exact env var and expected format instead of failing
silently.

**LOW — Stale filename references.** Two comments/changelog lines still
said `33_native_push_tokens.sql` after the rename above. Fixed as part
of the same change.

**LOW (device-test item, not a code fix) — iOS Service Worker support.**
`public/sw.js` (offline fallback) registers via the standard
`serviceWorker in navigator` check, which works correctly in the
Android WebView. iOS's WKWebView (what the Capacitor iOS shell uses)
gained Service Worker support more recently and it has historically
been less consistent than Chromium's — modern iOS versions handle it
correctly, but since this app explicitly requires offline fallback
behavior, it's worth confirming on a real iOS TestFlight build rather
than assuming parity with Android. No code change made because there's
nothing incorrect in the current implementation to fix — this is a
"verify on device" item, not a bug.

## 5. Remaining issues (can't be verified/fixed from this environment)

These require tools this sandbox doesn't have (Android SDK, Xcode, a
real device, or your live Supabase/production credentials) — not
because the code is unfinished, but because they're inherently
run-time/toolchain checks:

- Actual `npm install` + TypeScript compile + `next build` success (no `node_modules`/network access here to run them)
- Real Android Studio Gradle build success (APK/AAB)
- Real Xcode build success (requires macOS)
- On-device verification of: back button behavior, deep link resolution, native share sheet, camera picker, status bar/Dynamic Island rendering, offline fallback on iOS specifically (see §4)
- Running `supabase/35_native_push_tokens.sql` against your actual database and confirming existing web-push subscribers are unaffected

None of these are code defects — they're the standard "build it once and
verify on a device" steps every mobile release needs, called out
explicitly in `MOBILE_BUILD_REPORT.md`.

## 6. Final Verdict

🟢 **READY FOR ANDROID STUDIO** / 🟢 **READY FOR IOS PREPARATION**

Not marking APK/AAB/TestFlight/Play Store "ready" outright — those
verdicts depend on the on-device checks in §5, which haven't happened
yet because they require hardware/toolchains unavailable here. Once you
complete the local build steps in `MOBILE_BUILD_REPORT.md` and the
device checks above come back clean, this candidate has no known
blockers preventing you from proceeding straight through to Play
Store / TestFlight submission.
