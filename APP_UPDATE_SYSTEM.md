# APP_UPDATE_SYSTEM.md

## Architecture

Native-only feature (Android/iOS APK sideload). Web and PWA are
deliberately excluded — deploying to production already updates every
browser tab and installed PWA instantly, so there's no "installed
version" concept to check there; this scoping decision is enforced by
one `isNative()` check in `AppUpdateChecker`, not scattered across the
codebase.

```
public/app-version.json         — editable config, fetched at runtime (no rebuild needed)
src/lib/update/
  types.ts                      — config shape + strict runtime validation
  check.ts                      — fetch (with timeout) → validate → compare → decide
  dismissal.ts                  — "Later" persistence (localStorage)
  trigger.ts                    — the one function that actually starts an update
src/components/shared/
  AppUpdateChecker.tsx           — mounted in root layout, orchestrates the above
  AppUpdateDialog.tsx            — the premium dialog UI
```

**Flow:** `AppUpdateChecker` mounts once (root layout, same pattern as
`NativeBootstrap`/`ExploreBadge`) → on native only, fire-and-forget calls
`checkForUpdate()` → fetches `/app-version.json` from the same origin the
Capacitor shell already loads (no CORS setup needed, it's the live
production site) → validates the shape → compares the installed
`versionCode` (from `@capacitor/app`'s `App.getInfo()`) against the
config's `versionCode`/`minimumSupportedVersionCode` → renders
`AppUpdateDialog` in optional or force mode, or renders nothing.

**Why versionCode, not the "1.2.0" string:** Android's versionCode is a
plain monotonically-increasing integer designed exactly for this
comparison — using it avoids semver edge cases (e.g. "1.10.0" sorting
before "1.9.0" under naive string comparison). The human-readable version
string is kept only for display in the dialog.

## Files modified
- `src/app/layout.tsx` — one new import + one new mounted component,
  identical pattern to the existing `PWARegister`/`NativeBootstrap`/
  `ExploreBadge` lines already there. Nothing else changed.

## Files created
See the tree above — all new, nothing overlaps with or duplicates
existing components. `AppUpdateDialog` intentionally reuses the exact
bottom-sheet visual pattern already established by `ExploreLockSheet`
(same backdrop, same `rounded-t-3xl`, same `animate-owner-sheet-up`
entrance) rather than inventing a second modal style.

## Explore Mode & login-state independence
This feature does not read `profiles`, auth state, or the explore
cookie at all — it only calls `App.getInfo()` (native OS/app metadata)
and fetches a public static JSON file. It behaves identically whether
the person is in Explore Mode, logged in, or (in principle) sitting on
the pre-auth `/welcome` screen, exactly as the brief requires — not
because of special-case handling, but because there is no login-state
branch in this code at all to get wrong.

## Future Play Store migration plan
When this app moves to Google Play, only `src/lib/update/trigger.ts`
needs to change:
1. Add `@capacitor-community/app-update` (or equivalent) to
   `package.json`.
2. Replace `startUpdate()`'s body with
   `AppUpdate.startFlexibleUpdate()` (optional) /
   `AppUpdate.performImmediateUpdate()` (force), keyed off the same
   `mode` the dialog already computes.
3. `app-version.json`'s `apkDownloadUrl` becomes unnecessary (Play
   handles delivery) but can stay for a transition period / any
   sideload channel kept alongside the Play listing.
4. `check.ts`'s comparison logic and `AppUpdateDialog`'s UI need **zero**
   changes — they were written to be update-mechanism-agnostic from the
   start.

## Testing checklist
- [ ] Bump `versionCode` in `app-version.json` above the installed
      build → optional dialog appears
- [ ] Set `forceUpdate: true` → dialog appears with no "Later" button
      and the required-update message
- [ ] Set `minimumSupportedVersionCode` above installed → force mode
      even if `forceUpdate` is `false`
- [ ] Tap "Later" on an optional update → dialog doesn't reappear this
      session; reappears after 3 days or immediately if `versionCode`
      changes again
- [ ] Airplane mode / kill the network → app starts normally, no dialog,
      no error surfaced to the user
- [ ] Replace `app-version.json` with invalid JSON / missing fields →
      same graceful no-op, confirmed via `validateAppVersionConfig`
      rejecting it
- [ ] Confirm check fires identically in Explore Mode and when logged in
- [ ] Confirm "Update Now" opens the APK URL in the system browser, not
      inside the app's own WebView
- [ ] Confirm no dialog ever appears on web or the installed PWA
