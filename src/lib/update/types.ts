export interface AppVersionConfig {
  latestVersion: string
  versionCode: number
  minimumSupportedVersion: string
  minimumSupportedVersionCode: number
  forceUpdate: boolean
  releaseDate: string
  apkDownloadUrl: string
  apkSizeMB?: number
  releaseNotes: string[]
}

/**
 * Validates a fetched payload before anything else in the app touches
 * it. A malformed or malicious response (wrong types, missing fields,
 * someone's misconfigured CDN returning an HTML error page as 200)
 * must never reach the comparison logic or the UI — this is the one
 * place that's checked, so every caller downstream can assume a valid
 * shape.
 */
export function validateAppVersionConfig(input: unknown): AppVersionConfig | null {
  if (!input || typeof input !== 'object') return null
  const c = input as Record<string, unknown>

  const isNonEmptyString = (v: unknown) => typeof v === 'string' && v.length > 0
  const isFiniteNumber = (v: unknown) => typeof v === 'number' && Number.isFinite(v)

  if (!isNonEmptyString(c.latestVersion)) return null
  if (!isFiniteNumber(c.versionCode)) return null
  if (!isNonEmptyString(c.minimumSupportedVersion)) return null
  if (!isFiniteNumber(c.minimumSupportedVersionCode)) return null
  if (typeof c.forceUpdate !== 'boolean') return null
  if (!isNonEmptyString(c.releaseDate)) return null
  if (!isNonEmptyString(c.apkDownloadUrl)) return null
  if (!Array.isArray(c.releaseNotes) || !c.releaseNotes.every(n => typeof n === 'string')) return null
  if (c.apkSizeMB !== undefined && !isFiniteNumber(c.apkSizeMB)) return null

  // Belt-and-suspenders: a download URL must be a real absolute URL, not
  // an empty string or a relative path someone typo'd into the JSON.
  try {
    new URL(c.apkDownloadUrl as string)
  } catch {
    return null
  }

  return {
    latestVersion: c.latestVersion as string,
    versionCode: c.versionCode as number,
    minimumSupportedVersion: c.minimumSupportedVersion as string,
    minimumSupportedVersionCode: c.minimumSupportedVersionCode as number,
    forceUpdate: c.forceUpdate as boolean,
    releaseDate: c.releaseDate as string,
    apkDownloadUrl: c.apkDownloadUrl as string,
    apkSizeMB: c.apkSizeMB as number | undefined,
    releaseNotes: c.releaseNotes as string[],
  }
}
