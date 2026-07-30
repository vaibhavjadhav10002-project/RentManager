# Mobile Build Report — PG Manager (Android + iOS via Capacitor)

## 1. Architecture decision (read this first)

This app has real server-side routes: `api/push/send` (VAPID web-push),
`api/cron/automatic-backup` (Vercel Cron), `api/whatsapp`. A static
`next export` can't serve those, and moving them to edge/serverless
functions elsewhere would be a business-logic change outside this
task's scope.

**Chosen approach: Capacitor "remote URL" mode.** The Android/iOS shell
loads your live production URL (Vercel) inside a WebView with
Capacitor's native bridge injected into it. This is Capacitor's
documented, supported configuration for apps whose backend must keep
running as a real server — not a workaround, and not a fallback. One
consequence worth knowing: the app requires network connectivity to
load initially (same as any hybrid app in this mode); the existing
service worker (`public/sw.js`) still provides the offline fallback
page once loaded.

## 2. What changed in the codebase

See `CHANGELOG.md` ("Mobile App" entry, top) for the full file list.
Summary: nothing touched auth/routing/business logic. All additions
live under `src/lib/native/`, plus small branch-points in `push.ts`,
`pdf.ts`, and the backup page's download call, plus one additive
Supabase migration.

## 3. What I could not do in this environment

This chat environment has no internet access and no Android
SDK/Xcode, so the following need to happen on your machine (or a CI
runner with those toolchains) — they are standard commands, not
open-ended work:

```bash
# 1. Install the new dependencies (Capacitor + plugins added to package.json)
npm install

# 2. Set your real deployed URL
#    in .env.local or as an env var when running the commands below:
export CAPACITOR_SERVER_URL=https://your-app.vercel.app

# 3. Generate the native projects (creates android/ and ios/ folders —
#    these are gitignored by default; add them to git once generated
#    if you want them version-controlled)
npx cap add android
npx cap add ios      # macOS only — Xcode requires a Mac

# 4. Generate icons/splash screens from your existing maskable icon
npx @capacitor/assets generate --iconBackgroundColor '#2563EB' \
    --splashBackgroundColor '#2563EB'
#    (uses public/icons/icon-maskable-512.png as the source by default;
#     pass --android/--ios flags to target one platform, see
#     https://github.com/ionic-team/capacitor-assets)

# 5. Sync web config into the native projects (re-run after any
#    capacitor.config.ts change)
npx cap sync
```

## 3a. File picker and Material You — confirmed already covered

**File Picker:** the app's existing `<input type="file">` elements (the
JSON upload in `(owner)/restore`, the gov-ID photo inputs in the join
flow) need no Capacitor plugin at all — both Android's and iOS's
Capacitor WebViews natively trigger the system file/photo picker for
standard HTML file inputs, including non-image types
(`accept="application/json"` on the restore page works as-is). Adding a
dedicated file-picker plugin here would be unnecessary complexity for
something that already works; confirmed by inspecting every file input
in the codebase before concluding this.

**Material You (Android 12+ dynamic color):** PG Manager's UI is
entirely WebView content, not native Android Views, so OS-level dynamic
color theming doesn't apply to in-app screens (there's nothing for
Android to retheme — the WebView renders its own CSS regardless of
wallpaper). The one place Material You actually reaches this app is the
**themed/monochrome app icon** (Android 13+ tints a monochrome icon
layer to match the user's wallpaper). If you want that: supply a
monochrome (single-color, transparent-background) version of
`public/icons/icon-maskable-512.png` and pass it to the asset generator:
```bash
npx @capacitor/assets generate --android --iconBackgroundColor '#2563EB' \
  --androidAdaptiveIconMonochrome path/to/monochrome-icon.png
```
Not done here since no monochrome source asset exists in the uploaded
project — this is a design asset you'd need to provide, not a code gap.

## 3b. Validation actually performed vs. not possible here

Per this project's own rule ("never fake successful builds"), to be
explicit about what "TypeScript / ESLint / Capacitor compatibility"
validation actually means coming out of this environment:
- **Performed:** brace-balance sweep across every `.ts`/`.tsx` file in
  `src/` (120 files, zero genuine mismatches — one flagged case was a
  confirmed false positive, a comment containing literal `{{...}}`
  text, not a code defect); manual review of every new/changed file;
  cross-referencing of every behavioral claim in the docs against
  actual source (e.g. restore's upsert-only behavior, the exact API
  route list, the exact table list).
- **NOT performed, and not claimed:** an actual `tsc --noEmit`, `next
  lint`, or `next build` run — this sandbox has no installed
  dependencies and no network access to install them. Run `npm install
  && npm run build && npm run lint` locally before treating this as
  final; that is the real TypeScript/ESLint/build-blocker check.
- **NOT performed, and not claimed:** any actual Android Studio or
  Xcode compilation, or an APK/AAB/IPA build — this environment has
  neither toolchain. No build artifact is claimed to exist.



```bash
npx cap open android     # opens Android Studio
```
In Android Studio:
- **Debug APK (quick test on a device/emulator):** Build → Build Bundle(s)/APK(s) → Build APK(s). Output: `android/app/build/outputs/apk/debug/app-debug.apk`
- **Release AAB (for Play Store):** first set up signing — Build → Generate Signed Bundle/APK → Android App Bundle → create/select a keystore → release build variant. Output: `android/app/build/outputs/bundle/release/app-release.aab`
- Requires `compileSdkVersion`/`targetSdkVersion` 34 (Android 14) for current Play Store submission requirements — Capacitor 6's default template already targets this.
- Edge-to-edge + Android 13/14 behavior is handled by `StatusBar.setOverlaysWebView` in `src/lib/native/bootstrap.ts` plus the `.native-app` safe-area CSS in `globals.css`.

See `POST_BUILD_ANDROID.md` for the exact `AndroidManifest.xml` edits (permissions, deep link intent-filter) to apply after `cap add android` generates that file.

## 5. iOS — Xcode project / TestFlight

```bash
npx cap open ios          # opens Xcode (macOS only)
```
In Xcode:
- Set your Team/Signing under the target's "Signing & Capabilities" tab (requires an active Apple Developer account for device builds/TestFlight — free accounts can't submit to TestFlight).
- Bump the version/build number under General.
- **Archive for TestFlight:** Product → Archive → Distribute App → App Store Connect → Upload. Requires an App Store Connect app record already created for the bundle ID `com.pgmanager.app` (or whatever you change it to in `capacitor.config.ts`).
- Dynamic Island / safe area is handled automatically via `contentInset: 'automatic'` in `capacitor.config.ts` plus the same `.native-app` CSS.
- Dark Mode: the app already toggles a `.dark` class; `bootstrap.ts` syncs the iOS status bar style to match automatically.

See `POST_BUILD_IOS.md` for the exact `Info.plist` edits (permission usage strings, associated domains for universal links) to apply after `cap add ios` generates that file.

## 6. Play Store / App Store submission — high level

**Play Store:** Create app in Play Console → complete Data Safety form (this app collects: account info via Supabase auth, payment records, documents/photos for gov ID uploads — list these truthfully) → upload signed AAB → complete store listing using existing `manifest.json` name/description/icons as a starting point → submit for review (internal testing track first is strongly recommended).

**App Store:** Create app in App Store Connect with bundle ID `com.pgmanager.app` → complete App Privacy questionnaire (same data categories as above) → upload build via Xcode Archive or Transporter → add TestFlight testers → submit for review after TestFlight validation. Apple review commonly flags "WebView-wrapped website" apps that don't feel native — the native-feel CSS/back-button/status-bar/share-sheet work in this change is specifically aimed at reducing that risk, but a human design pass is still worth doing before submitting.

## 7. Push notification setup (native) — account-level work required

Native push (FCM/APNs) is wired up client-side (`src/lib/native/push.ts`,
the additive `push_subscriptions` columns) but the server-side relay is
intentionally a stub — see the "FCM/APNs RELAY" comment in
`src/app/api/push/send/route.ts`. To make it live:
- **Android:** create a Firebase project, add the Android app (package `com.pgmanager.app`), download `google-services.json` into `android/app/`, generate a service account key, set `FIREBASE_SERVICE_ACCOUNT_JSON` in your server env, and implement the Firebase Admin SDK call at the marked integration point.
- **iOS:** create an APNs Auth Key in your Apple Developer account, set `APNS_KEY_ID`/`APNS_TEAM_ID`/`APNS_PRIVATE_KEY`, and implement the APNs HTTP/2 call at the same integration point.

Until then, existing browser/PWA Web Push (unchanged) keeps working exactly as before; native app installs simply won't receive push until this relay is added.

## 8. Remaining recommendations (not done, in priority order)
1. Add native "Take Photo" buttons where useful (e.g. gov-ID upload) using `src/lib/native/camera.ts` — the existing `<input type="file">` flows still work as-is, so this is additive polish, not a fix.
2. Implement the FCM/APNs relay above once you have the credentials.
3. Visual QA pass on a real Android 14 and iOS 17+ device for the native-feel checklist (touch targets, bottom sheets, transitions) — CSS-level groundwork is in place; a designer/developer eye on the actual rendered app will catch anything device-specific.
4. Consider code-signing CI (Fastlane/EAS-style) once you're doing this more than once — manual Xcode/Android Studio builds are fine for now but don't scale to frequent releases.
