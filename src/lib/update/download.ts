import { Filesystem, Directory } from '@capacitor/filesystem'
import type { AppVersionConfig } from './types'

// Module-level (not persisted) — a fresh app launch re-checks and
// re-downloads if needed, which is exactly what should happen since a
// newer update may have shipped since the last session anyway.
const inFlightDownloads = new Map<number, Promise<string | null>>()
const downloadedPaths = new Map<number, string>()

function fileNameFor(versionCode: number) {
  return `rentivo-update-${versionCode}.apk`
}

/** The local file URI for this version, if the background download already finished. */
export function getDownloadedApkPath(versionCode: number): string | null {
  return downloadedPaths.get(versionCode) ?? null
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      const result = reader.result as string
      // reader.result is a data: URL — Filesystem.writeFile wants just the
      // base64 payload, so strip the "data:...;base64," prefix.
      resolve(result.split(',')[1] ?? '')
    }
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

/**
 * Downloads the update APK to the app's private cache directory, silently,
 * as soon as an update is detected — well before the user has tapped
 * anything. By the time they open the update dialog and tap "Update Now"
 * (see trigger.ts), the file is usually already sitting on-device, so
 * that tap jumps straight to Android's install confirmation instead of
 * waiting on a multi-MB download first.
 *
 * Safe to call more than once for the same version — de-duplicates via
 * the module-level caches above, and any failure here is silent/non-fatal
 * since trigger.ts falls back to the original browser-download flow if
 * this never completes.
 */
export async function downloadUpdateInBackground(config: AppVersionConfig): Promise<string | null> {
  const existing = downloadedPaths.get(config.versionCode)
  if (existing) return existing

  const inFlight = inFlightDownloads.get(config.versionCode)
  if (inFlight) return inFlight

  const promise = (async (): Promise<string | null> => {
    try {
      const res = await fetch(config.apkDownloadUrl)
      if (!res.ok) return null
      const blob = await res.blob()
      const base64 = await blobToBase64(blob)
      const fileName = fileNameFor(config.versionCode)
      await Filesystem.writeFile({ path: fileName, data: base64, directory: Directory.Cache })
      const { uri } = await Filesystem.getUri({ path: fileName, directory: Directory.Cache })
      downloadedPaths.set(config.versionCode, uri)
      return uri
    } catch {
      return null
    } finally {
      inFlightDownloads.delete(config.versionCode)
    }
  })()

  inFlightDownloads.set(config.versionCode, promise)
  return promise
}
