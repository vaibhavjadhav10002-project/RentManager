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

  // Android 8+ requires a notification channel; if the app never creates
  // one, incoming pushes fall back to Android's own default channel
  // (importance: DEFAULT) — delivered silently into the shade instead of
  // popping up as a heads-up banner like WhatsApp. `importance: 5` is
  // IMPORTANCE_HIGH, the setting that actually enables that heads-up
  // behavior. Must match FCM_ANDROID_CHANNEL_ID in src/lib/fcm.ts exactly,
  // or the server's channelId won't route to this channel.
  if (getPlatform() === 'android') {
    await PushNotifications.createChannel({
      id: 'rentivo_default',
      name: 'Rentivo Notifications',
      description: 'Payment reminders, approvals, messages, and other updates from your PG',
      importance: 5,
      visibility: 1,
      vibration: true,
      lights: true,
    })
  }

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
