import { initializeApp, getApps, cert, type App } from 'firebase-admin/app'
import { getMessaging } from 'firebase-admin/messaging'

// The same channel id the client creates in src/lib/native/push.ts —
// MUST match exactly, or Android silently falls back to its own default
// channel (importance: DEFAULT), which shows in the notification shade
// but never pops up as a heads-up banner. This is what makes native
// notifications behave like WhatsApp's instead of sitting silently in
// the tray.
export const FCM_ANDROID_CHANNEL_ID = 'rentivo_default'

let app: App | null = null

function getFirebaseApp(): App | null {
  if (app) return app
  const existing = getApps()[0]
  if (existing) { app = existing; return app }

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON
  if (!raw) return null

  try {
    const serviceAccount = JSON.parse(raw)
    app = initializeApp({ credential: cert(serviceAccount) })
    return app
  } catch (e) {
    console.error('[fcm] FIREBASE_SERVICE_ACCOUNT_JSON is set but invalid JSON:', (e as Error).message)
    return null
  }
}

export function isFcmConfigured(): boolean {
  return !!process.env.FIREBASE_SERVICE_ACCOUNT_JSON
}

interface FcmNotificationInput {
  title: string
  body: string
  url?: string
  tag?: string
}

/**
 * Sends one push to each Android FCM token, high-priority + routed to the
 * heads-up-capable channel created client-side. Returns which tokens are
 * dead (unregistered/invalid) so the caller can clean up
 * push_subscriptions — same pattern already used for expired Web Push
 * endpoints just above this in route.ts.
 */
export async function sendFcmNotifications(
  tokens: string[],
  { title, body, url = '/', tag }: FcmNotificationInput
): Promise<{ sent: number; deadTokens: string[] }> {
  const firebaseApp = getFirebaseApp()
  if (!firebaseApp || tokens.length === 0) return { sent: 0, deadTokens: [] }

  const messaging = getMessaging(firebaseApp)
  const res = await messaging.sendEachForMulticast({
    tokens,
    notification: { title, body },
    data: { url, tag: tag ?? '' },
    android: {
      // HIGH priority (not NORMAL) is what makes FCM wake the device and
      // deliver immediately instead of batching for later — the other
      // half of "shows up like WhatsApp," alongside the channel's own
      // importance setting.
      priority: 'high',
      notification: {
        channelId: FCM_ANDROID_CHANNEL_ID,
        priority: 'high',
        visibility: 'public',
        clickAction: 'FLUTTER_NOTIFICATION_CLICK',
      },
    },
  })

  const deadTokens: string[] = []
  res.responses.forEach((r, i) => {
    if (!r.success) {
      const code = r.error?.code
      if (code === 'messaging/registration-token-not-registered' || code === 'messaging/invalid-registration-token') {
        deadTokens.push(tokens[i])
      }
    }
  })

  return { sent: res.successCount, deadTokens }
}
