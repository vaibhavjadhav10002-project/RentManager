import { createClient } from '@/lib/supabase/client'

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i++) outputArray[i] = rawData.charCodeAt(i)
  return outputArray
}

export function isPushSupported() {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window
}

export async function registerServiceWorker() {
  if (!isPushSupported()) return null
  try {
    return await navigator.serviceWorker.register('/sw.js')
  } catch {
    return null
  }
}

export async function getNotificationPermissionState(): Promise<NotificationPermission | 'unsupported'> {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported'
  return Notification.permission
}

/** Requests permission (if needed), subscribes to push, and saves the
 * subscription to Supabase for the currently logged-in user. */
export async function enablePushNotifications(): Promise<boolean> {
  if (!isPushSupported()) return false

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return false

  const registration = await registerServiceWorker()
  if (!registration) return false

  const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  if (!vapidKey) return false

  let subscription = await registration.pushManager.getSubscription()
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey),
    })
  }

  const sb = createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return false

  const json = subscription.toJSON()
  const { error } = await sb.from('push_subscriptions').upsert({
    user_id: user.id,
    endpoint: json.endpoint!,
    p256dh: json.keys!.p256dh,
    auth_key: json.keys!.auth,
  }, { onConflict: 'user_id,endpoint' })

  return !error
}

export async function disablePushNotifications(): Promise<void> {
  if (!isPushSupported()) return
  const registration = await navigator.serviceWorker.getRegistration()
  const subscription = await registration?.pushManager.getSubscription()
  if (!subscription) return

  const sb = createClient()
  await sb.from('push_subscriptions').delete().eq('endpoint', subscription.endpoint)
  await subscription.unsubscribe()
}

/** Fire-and-forget push notification trigger — call this right after a
 * mutation succeeds (notice created, complaint updated, reminder sent).
 * Never throws — a failed push should never block the action that
 * triggered it. */
export async function sendPushNotification(input: {
  user_ids: string[]; title: string; body: string; url?: string; tag?: string
}) {
  try {
    await fetch('/api/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    })
  } catch {
    // Silently ignore — push delivery is best-effort and shouldn't
    // interrupt the user's flow.
  }
}
