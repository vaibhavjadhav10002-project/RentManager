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
  download.ts                   — silently downloads the APK to the device in the background as soon as an update is found
  dismissal.ts                  — "Later" persistence (localStorage)
  trigger.ts                    — the one function that actually starts an update
src/lib/native/
  apkInstaller.ts                — TS wrapper for the native ApkInstaller Capacitor plugin
android/app/src/main/java/com/rentivo/app/
  ApkInstallerPlugin.java        — native plugin: hands a local APK straight to Android's package installer
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
`AppUpdateDialog` in optional or force mode, or renders nothing. If an
update is available, `download.ts`'s `downloadUpdateInBackground()` is
kicked off immediately (fire-and-forget, silent) so the APK is usually
already on-device by the time the person taps "Update Now" — see
"Background download + one-tap install" below.

**Why versionCode, not the "1.2.0" string:** Android's versionCode is a
plain monotonically-increasing integer designed exactly for this
comparison — using it avoids semver edge cases (e.g. "1.10.0" sorting
before "1.9.0" under naive string comparison). The human-readable version
string is kept only for display in the dialog.

## Background download + one-tap install
Android will never let a non-Play-Store app install/replace itself
completely silently — the OS requires an explicit user confirmation on
the final install screen no matter what, even for an app updating
itself. That one tap can't be removed. Everything *before* it can be,
though, and that's what this does:

1. The moment `checkForUpdate()` finds a newer version, `download.ts`
   fetches the APK and writes it to the app's private cache directory via
   `@capacitor/filesystem` — silently, no dialog, no browser tab, often
   finished before the person has even noticed the update dialog.
2. Tapping "Update Now" calls `trigger.ts`'s `startUpdate()`, which hands
   that local file straight to `ApkInstallerPlugin.install()` — a small
   custom native plugin that builds a `FileProvider` URI for the file and
   fires `Intent.ACTION_VIEW` with the APK mime type, landing directly on
   Android's install/replace confirmation screen.
3. If the background download hasn't finished yet (slow network) or
   fails for any reason, `startUpdate()` falls back to the original
   behaviour — opening `apkDownloadUrl` in the system browser — so the
   button can never end up doing nothing.

Requires `android.permission.REQUEST_INSTALL_PACKAGES` in
`AndroidManifest.xml` (added) and reuses the `FileProvider` already
configured there for `@capacitor/share`.

## Files modified
- `src/app/layout.tsx` — one new import + one new mounted component,
  identical pattern to the existing `PWARegister`/`NativeBootstrap`/
  `ExploreBadge` lines already there.
- `android/app/src/main/java/com/rentivo/app/MainActivity.java` — one line
  registering `ApkInstallerPlugin`.
- `android/app/src/main/AndroidManifest.xml` — added the
  `REQUEST_INSTALL_PACKAGES` permission.

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
3. `download.ts` and the native `ApkInstallerPlugin` become unnecessary
   (Play handles both delivery and install) and can be deleted; likewise
   `app-version.json`'s `apkDownloadUrl` — though both can stay for a
   transition period / any sideload channel kept alongside the Play
   listing.
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
