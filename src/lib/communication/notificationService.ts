import { sendPushNotification } from '@/lib/push'

/**
 * NotificationService — wraps the EXISTING push-notification system
 * (`@/lib/push`'s `sendPushNotification`) for use by the Communication
 * Engine. This file does not reimplement push delivery, does not touch
 * `src/lib/push.ts`, and does not change how the Notification Bell or
 * outside-the-app push notifications behave in any way.
 *
 * Why this thin layer exists at all: so `CommunicationService` (and later,
 * the Reminder Engine in 9.3) can trigger "notify this tenant" without
 * needing to know it's specifically a push notification under the hood —
 * same reasoning as `ClickToChatProvider` abstracting WhatsApp. If a future
 * phase adds email/SMS notification delivery, it plugs in here without
 * every call site changing.
 */
export const NotificationService = {
  async notifyTenant(input: { authUserId: string; title: string; body: string; url?: string; tag?: string }) {
    await sendPushNotification({
      user_ids: [input.authUserId],
      title: input.title,
      body: input.body,
      url: input.url ?? '/portal',
      tag: input.tag ?? 'communication',
    })
  },

  async notifyTenants(input: { authUserIds: string[]; title: string; body: string; url?: string; tag?: string }) {
    if (input.authUserIds.length === 0) return
    await sendPushNotification({
      user_ids: input.authUserIds,
      title: input.title,
      body: input.body,
      url: input.url ?? '/portal',
      tag: input.tag ?? 'communication',
    })
  },
}
