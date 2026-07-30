import { App } from '@capacitor/app'
import { validateAppVersionConfig, type AppVersionConfig } from './types'
import { wasRecentlyDismissed } from './dismissal'

export type UpdateCheckResult =
  | { status: 'none' } // nothing to show — up to date, check failed, or recently-dismissed optional update
  | {
      status: 'available'
      mode: 'optional' | 'force'
      installedVersion: string
      config: AppVersionConfig
    }

// A session-lifetime cache so navigating between pages/re-mounting the
// checker doesn't refetch on every route change — this only ever runs
// once per app launch (module-level state resets on a real relaunch,
// which is exactly when a fresh check should happen anyway).
let cachedResult: UpdateCheckResult | null = null
let inFlight: Promise<UpdateCheckResult> | null = null

const FETCH_TIMEOUT_MS = 6000

/**
 * Fetches the same production origin's /app-version.json — the native
 * shell already loads the live site (see capacitor.config.ts), so this
 * is a same-origin request, no CORS/config needed. On web/PWA this
 * function is never called at all (see AppUpdateChecker) since there's
 * no APK to be behind — deploying updates the web app instantly.
 */
export async function checkForUpdate(): Promise<UpdateCheckResult> {
  if (cachedResult) return cachedResult
  if (inFlight) return inFlight

  inFlight = (async (): Promise<UpdateCheckResult> => {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

      let json: unknown
      try {
        const res = await fetch('/app-version.json', { cache: 'no-store', signal: controller.signal })
        if (!res.ok) return { status: 'none' } // server unavailable / 404 / etc. — fail silently
        json = await res.json()
      } catch {
        return { status: 'none' } // offline, timeout, invalid JSON body — fail silently
      } finally {
        clearTimeout(timeout)
      }

      const config = validateAppVersionConfig(json)
      if (!config) return { status: 'none' } // malformed response — never trust it, never crash on it

      const info = await App.getInfo().catch(() => null)
      if (!info) return { status: 'none' }

      // Android's `build` field is the versionCode (a plain integer as a
      // string) — the one authoritative, monotonically increasing value
      // this comparison should key off, rather than parsing the
      // human-readable "1.2.0" version name (semver edge cases, "1.10"
      // vs "1.9" ordering bugs, etc.).
      const installedVersionCode = parseInt(info.build, 10)
      if (!Number.isFinite(installedVersionCode)) return { status: 'none' }

      if (installedVersionCode < config.minimumSupportedVersionCode) {
        return { status: 'available', mode: 'force', installedVersion: info.version, config }
      }
      if (config.forceUpdate && installedVersionCode < config.versionCode) {
        return { status: 'available', mode: 'force', installedVersion: info.version, config }
      }
      if (installedVersionCode < config.versionCode) {
        if (wasRecentlyDismissed(config.versionCode)) return { status: 'none' }
        return { status: 'available', mode: 'optional', installedVersion: info.version, config }
      }
      return { status: 'none' }
    } catch {
      // Absolute last-resort catch-all — this function must never throw
      // and must never block app startup.
      return { status: 'none' }
    }
  })()

  cachedResult = await inFlight
  inFlight = null
  return cachedResult
}
