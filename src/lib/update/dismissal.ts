const STORAGE_KEY = 'rentivo_update_dismissed'
const REMIND_AFTER_MS = 3 * 24 * 60 * 60 * 1000 // 3 days

interface Dismissal {
  versionCode: number
  dismissedAt: number
}

function read(): Dismissal | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (typeof parsed?.versionCode !== 'number' || typeof parsed?.dismissedAt !== 'number') return null
    return parsed
  } catch {
    // Corrupted localStorage entry — treat as "never dismissed" rather
    // than letting a JSON.parse error bubble up and block the app.
    return null
  }
}

export function recordDismissal(versionCode: number) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ versionCode, dismissedAt: Date.now() }))
  } catch {
    // Storage full/unavailable (private browsing, etc.) — worst case the
    // dialog shows again next launch, which is safe, just mildly
    // repetitive; never worth crashing over.
  }
}

/**
 * True if an optional update for this exact versionCode was already
 * dismissed recently. A force update never consults this — callers
 * check `forceUpdate` before calling this at all.
 */
export function wasRecentlyDismissed(latestVersionCode: number): boolean {
  const d = read()
  if (!d) return false
  if (d.versionCode !== latestVersionCode) return false // a newer version shipped since — show again immediately
  return Date.now() - d.dismissedAt < REMIND_AFTER_MS
}
