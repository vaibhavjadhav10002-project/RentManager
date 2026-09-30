/**
 * Starts the update. Today: opens the APK download URL in the system
 * browser (Capacitor's WebView automatically hands off navigation to a
 * domain outside capacitor.config.ts's `server.allowNavigation` list to
 * the system browser — no extra plugin needed).
 *
 * FUTURE PLAY STORE MIGRATION: once this app is on Google Play, replace
 * the body of this one function with the Play Core In-App Update API
 * (e.g. `@capacitor-community/app-update`'s `startFlexibleUpdate()` /
 * `startImmediateUpdate()` for force vs optional). Nothing else in this
 * feature needs to change — `check.ts`'s comparison logic and
 * `AppUpdateDialog`'s UI are both update-mechanism-agnostic; they only
 * know "an update is available," not how it gets installed. See
 * APP_UPDATE_SYSTEM.md's "Future Play Store Migration Plan".
 */
export function startUpdate(apkDownloadUrl: string) {
  window.open(apkDownloadUrl, '_blank')
}
