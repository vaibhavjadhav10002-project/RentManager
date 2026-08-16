'use client'
import { useCallback, useEffect, useRef, useState } from 'react'

export interface ApkDownloadGate {
  /** True only for an Android *mobile browser* visitor — never for iOS
   * (can't install an APK at all), desktop (not how a tenant reaches this
   * flow), or someone already inside the installed native app. This is
   * the one flag that decides whether the gate applies at all. */
  isAndroidWeb: boolean
  /** The production APK URL from /app-version.json, once fetched. Stays
   * `null` while the fetch is still in flight — check `checked` to tell
   * "still loading" apart from "confirmed unavailable". */
  apkUrl: string | null
  /** True once the /app-version.json fetch has settled (succeeded,
   * failed, or returned no usable URL) — lets the UI avoid a false
   * "download unavailable" flash while the very first fetch is still
   * in flight. */
  checked: boolean
  /** A download attempt has been fired (auto on mount, or a manual
   * re-tap of the download button). See the caveat below — this tracks
   * that a download was *started*, not confirmed complete. */
  triggered: boolean
  /** Whether the calling form's submit button should be enabled.
   * `true` immediately for anyone the gate doesn't apply to. */
  satisfied: boolean
  /** Manually (re-)trigger the download — used by the fallback button
   * for anyone whose auto-download didn't visibly start. */
  triggerDownload: () => void
}

/**
 * Gates tenant-onboarding submission behind starting an APK download, on
 * Android mobile browsers only. Auto-fires the download once on mount so
 * it runs in the background while the tenant fills in the rest of the
 * form — by the time they reach Submit, the browser's own download
 * manager has usually already finished.
 *
 * Known limitation, documented rather than glossed over: there is no
 * cross-browser JS API that confirms a same-tab file download actually
 * *completed* (the same limitation already documented in
 * src/lib/update/download.ts for the in-app updater). "Gate satisfied"
 * here means the browser download was *started*, which is the strongest
 * signal available from a web page — not a guarantee the APK finished
 * downloading or was installed.
 */
export function useApkDownloadGate(): ApkDownloadGate {
  const [apkUrl, setApkUrl] = useState<string | null>(null)
  const [checked, setChecked] = useState(false)
  const [triggered, setTriggered] = useState(false)
  const [isAndroidWeb, setIsAndroidWeb] = useState(false)
  // Guards the auto-fire effect against React 18 Strict Mode's
  // dev-only double-invoke of mount effects — without this, a fast
  // apkUrl resolution could fire two real download attempts in dev.
  // (Doesn't affect production, which never double-invokes, but this is
  // free insurance either way and makes the behavior deterministic.)
  const autoFired = useRef(false)

  useEffect(() => {
    // Capacitor's native shell injects window.Capacitor; if it's present
    // and reports a native platform, the tenant already has the app
    // installed and is using it right now — never gate someone already
    // inside the app.
    const isNativeApp = typeof window !== 'undefined' && !!(window as any).Capacitor?.isNativePlatform?.()
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''
    setIsAndroidWeb(!isNativeApp && /Android/i.test(ua))
  }, [])

  useEffect(() => {
    let cancelled = false
    // A hard timeout is mandatory here, not optional — without one, a
    // tenant on a flaky/dead network would see the gate stay blocked
    // forever (checked never becomes true), which would defeat the
    // entire "never actually break onboarding" principle this gate is
    // built around. Mirrors the same timeout already used for the
    // in-app updater's own /app-version.json fetch (src/lib/update/check.ts).
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)
    fetch('/app-version.json', { cache: 'no-store', signal: controller.signal })
      .then(res => (res.ok ? res.json() : null))
      .then(json => {
        if (cancelled) return
        const url = json?.apkDownloadUrl
        if (typeof url === 'string' && url && !url.includes('REPLACE-WITH')) {
          setApkUrl(url)
        }
      })
      .catch(() => {}) // offline, timeout/abort, invalid JSON — fail silently, never block onboarding on this
      .finally(() => {
        clearTimeout(timeout)
        if (!cancelled) setChecked(true)
      })
    return () => { cancelled = true; clearTimeout(timeout) }
  }, [])

  const triggerDownload = useCallback(() => {
    if (!apkUrl) return
    const a = document.createElement('a')
    a.href = apkUrl
    a.download = ''
    a.rel = 'noopener'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTriggered(true)
  }, [apkUrl])

  // Auto-fire exactly once, as soon as both conditions are known.
  useEffect(() => {
    if (isAndroidWeb && apkUrl && !autoFired.current) {
      autoFired.current = true
      triggerDownload()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAndroidWeb, apkUrl])

  // If the gate doesn't apply (not Android web), never block. On Android
  // web, wait for the /app-version.json check to actually settle before
  // concluding "no URL, don't block" — otherwise there's a brief window
  // where apkUrl is still null just because the fetch hasn't resolved
  // yet, which would incorrectly report satisfied=true and then flip
  // back to false a moment later once the URL loads.
  const satisfied = !isAndroidWeb || (checked && !apkUrl) || triggered

  return { isAndroidWeb, apkUrl, checked, triggered, satisfied, triggerDownload }
}

