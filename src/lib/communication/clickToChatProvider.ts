import { whatsappLink } from '@/lib/utils'

/**
 * ClickToChatProvider — the ONLY thing in this entire engine that knows
 * about WhatsApp specifically. Everything above this layer (Communication
 * Service, Inbox UI) just calls `buildChatLink()` and never touches wa.me
 * URL construction directly.
 *
 * Deliberately reuses the existing `whatsappLink()` helper from
 * `@/lib/utils` (already used by the Payments/Tenants pages for one-off
 * reminders) rather than reimplementing it — one wa.me URL builder for the
 * whole app.
 *
 * Per the "free only" requirement: this is click-to-chat via wa.me only.
 * There is no server-side send, no webhook, no paid WhatsApp Business API
 * integration anywhere in this module, and there must never be — adding a
 * paid provider here would be exactly the "automatic WhatsApp sending"
 * this project explicitly rules out.
 */
export interface ChatProvider {
  channel: 'whatsapp'
  /** Builds a URL that, when opened, pre-fills a chat with `message` — the person still has to press Send themselves. */
  buildChatLink(phone: string, message: string): string
}

export const ClickToChatProvider: ChatProvider = {
  channel: 'whatsapp',
  buildChatLink(phone: string, message: string): string {
    return whatsappLink(phone, message)
  },
}
