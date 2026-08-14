import ApkInstaller from '@/lib/native/apkInstaller'
import { isNative } from '@/lib/native/platform'
import { downloadUpdateInBackground, getDownloadedApkPath } from './download'
import type { AppVersionConfig } from './types'

/**
 * Starts the update. If the APK already finished downloading in the
 * background (AppUpdateChecker kicks that off the moment an update is
 * detected — see download.ts), this jumps straight to Android's install
 * confirmation screen via the native ApkInstaller plugin: no browser tab,
 * no notification-tray download, no manually opening a file. If the
 * background download hasn't finished yet (slow network, or this is
 * called moments after launch), it's awaited here instead of falling
 * back immediately, so the common case still ends in the fast in-app
 * install path rather than skipping straight to the fallback.
 *
 * Falls back to opening the APK URL in the system browser (the original
 * behaviour, and the only option on web/PWA) if the native install path
 * fails for any reason — this button must never end up doing nothing.
 *
 * FUTURE PLAY STORE MIGRATION: once this app is on Google Play, replace
 * the native-install branch below with the Play Core In-App Update API
 * (e.g. `@capacitor-community/app-update`'s `startFlexibleUpdate()` /
 * `startImmediateUpdate()` for force vs optional). Nothing else in this
 * feature needs to change — `check.ts`'s comparison logic and
 * `AppUpdateDialog`'s UI are both update-mechanism-agnostic; they only
 * know "an update is available," not how it gets installed. See
 * APP_UPDATE_SYSTEM.md's "Future Play Store Migration Plan".
 */
export async function startUpdate(config: AppVersionConfig) {
  if (isNative()) {
    try {
      const path = getDownloadedApkPath(config.versionCode) ?? await downloadUpdateInBackground(config)
      if (path) {
        await ApkInstaller.install({ path })
        return
      }
    } catch {
      // fall through to the browser-download fallback below
    }
  }
  window.open(config.apkDownloadUrl, '_blank')
}
