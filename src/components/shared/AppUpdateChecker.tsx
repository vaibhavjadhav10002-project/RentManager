'use client'
import { useEffect, useState } from 'react'
import { isNative, getPlatform } from '@/lib/native/platform'
import { checkForUpdate, type UpdateCheckResult } from '@/lib/update/check'
import { downloadUpdateInBackground } from '@/lib/update/download'
import AppUpdateDialog from './AppUpdateDialog'

/**
 * Android-only. This is an APK-sideload update prompt — there's no such
 * thing as sideloading an APK on iOS, and prompting an iPhone user to
 * "Update Now" to a download link would be actively wrong (iOS app
 * updates belong to the App Store, a different system entirely). Web
 * and the installed PWA are also skipped: deploying to production
 * already updates every browser tab/PWA instance the moment they next
 * load, so there's no "installed version" to fall behind there either.
 */
export default function AppUpdateChecker() {
  const [result, setResult] = useState<UpdateCheckResult>({ status: 'none' })

  useEffect(() => {
    if (!isNative() || getPlatform() !== 'android') return
    // Fire-and-forget — never awaited by anything that blocks rendering,
    // so a slow/failed check can never delay app startup.
    checkForUpdate().then(res => {
      setResult(res)
      if (res.status === 'available') {
        // Start pulling the APK down in the background the moment we
        // know one exists, well before the user has tapped anything —
        // by the time they see this dialog and tap "Update Now", the
        // file is usually already on-device (see trigger.ts).
        downloadUpdateInBackground(res.config)
      }
    })
  }, [])

  if (result.status !== 'available') return null

  return (
    <AppUpdateDialog
      mode={result.mode}
      installedVersion={result.installedVersion}
      config={result.config}
      onDismiss={() => setResult({ status: 'none' })}
    />
  )
}
