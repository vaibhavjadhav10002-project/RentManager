import { createClient } from '@/lib/supabase/client'
import { getPlatform } from './platform'

/**
 * Native push works completely differently from the existing Web Push
 * flow (VAPID + PushManager): iOS WKWebView has no Push API at all, and
 * Android WebView push is unreliable, so native apps register a device
 * token with FCM (Android) / APNs (iOS) instead, via this plugin.
 *
 * This REUSES the existing `push_subscriptions` table (see
 * supabase/35_native_push_tokens.sql for the additive, nullable columns)
 * rather than creating a parallel system, so `sendPushNotification` in
 * src/lib/push.ts has one place to look up a user's destinations.
 *
 * Requires a Firebase project (Android) and an APNs key (iOS) — see
 * MOBILE_BUILD_REPORT.md "Push Notification Setup" for the account-level
 * steps that can't be done from inside this codebase.
 */
export async function registerNativePush(): Promise<boolean> {
  const { PushNotifications } = await import('@capacitor/push-notifications')

  const permission = await PushNotifications.requestPermissions()
  if (permission.receive !== 'granted') return false

  return new Promise((resolve) => {
    PushNotifications.addListener('registration', async (token) => {
      const sb = createClient()
      const { data: { user } } = await sb.auth.getUser()
      if (!user) return resolve(false)

      const { error } = await sb.from('push_subscriptions').upsert(
        {
          user_id: user.id,
          endpoint: `native:${getPlatform()}:${token.value}`,
          native_token: token.value,
          native_platform: getPlatform(),
        },
        { onConflict: 'user_id,endpoint' }
      )
      resolve(!error)
    })

    PushNotifications.addListener('registrationError', () => resolve(false))

    PushNotifications.register()
  })
}
