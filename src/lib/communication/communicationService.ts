import { renderTemplate } from './templateEngine'
import { ClickToChatProvider } from './clickToChatProvider'
import { QueueManager } from './queueManager'
import { HistoryService } from './historyService'
import type { MessageTemplate, TemplateVariables } from '@/types'

/**
 * CommunicationService — the entry point the Inbox UI (and later, Phase
 * 8/11) calls for anything WhatsApp-related. Composes the layers below it:
 *
 *   CommunicationService
 *     → TemplateEngine      (renderTemplate — pure string substitution)
 *     → QueueManager         (communication_queue)
 *     → HistoryService       (communication_logs)
 *     → ClickToChatProvider  (wraps the existing whatsappLink() util)
 *
 * `ReminderEngine` and `NotificationService` are siblings of this module,
 * not composed through it — the Inbox page imports `ReminderEngine`
 * directly (see `reminderEngine.ts`), and `NotificationService` is kept
 * as reusable, correctly-wrapping infrastructure around the existing push
 * system for a future phase to use (per the brief's own "future versions
 * may reuse the same engine for Email, Push Notifications, SMS") — it
 * intentionally isn't wired into a live call path yet, since a WhatsApp
 * send doesn't also need a duplicate in-app push about itself.
 *
 * Every send in this file requires the caller to have already opened the
 * chat link themselves (`window.open`) before recording it — nothing here
 * transmits a WhatsApp message on the owner's behalf.
 */
export const CommunicationService = {
  /** Renders a template against variables — read-only, no side effects. */
  render(template: MessageTemplate, variables: TemplateVariables): string {
    return renderTemplate(template.body, variables)
  },

  /**
   * Manual Send (9.2). Renders the template, builds the wa.me click-to-
   * chat link, and returns it for the caller to open — this function
   * never opens a window itself, so the side effect stays explicit at the
   * call site. Once the caller has opened the link, it should call
   * `confirmSent` below.
   */
  prepareWhatsAppSend(input: { template: MessageTemplate; variables: TemplateVariables; phone: string }) {
    const message = renderTemplate(input.template.body, input.variables)
    const chatLink = ClickToChatProvider.buildChatLink(input.phone, message)
    return { message, chatLink }
  },

  /**
   * Records that a Manual Send happened — called right after the caller
   * opens the chat link returned by `prepareWhatsAppSend`. This is an
   * optimistic log entry: like every click-to-chat integration (there's
   * no paid API here to confirm delivery), "sent" means "WhatsApp was
   * opened with this message ready to go," not "WhatsApp confirmed
   * delivery." That distinction matters and is worth keeping honest
   * rather than implying a delivery guarantee this free architecture
   * can't actually make.
   */
  async confirmSent(input: {
    propertyId: string
    tenantId: string
    templateId: string
    message: string
    sentBy?: string
  }) {
    return HistoryService.record({
      propertyId: input.propertyId,
      tenantId: input.tenantId,
      templateId: input.templateId,
      channel: 'whatsapp',
      renderedMessage: input.message,
      status: 'sent',
      sentBy: input.sentBy,
    })
  },

  async getHistory(propertyId: string) {
    return HistoryService.list(propertyId)
  },

  async getQueue(propertyId: string) {
    return QueueManager.list(propertyId)
  },

  /**
   * Reminder Engine's send path (9.3). Unlike `confirmSent` (Manual Send,
   * which goes straight to History), a reminder candidate is first
   * written to the Communication Queue as 'pending' so it's visible there
   * before the owner acts on it, then transitions to 'sent' (with a
   * matching History entry) once the owner actually opens WhatsApp. If
   * the tenant has no phone on file, it's marked 'failed' immediately
   * instead — surfaced in the Retry Queue rather than silently dropped.
   * The owner still presses Send themselves, inside WhatsApp, every time
   * — nothing here is scheduled or automatic.
   */
  async sendReminder(input: {
    propertyId: string
    tenantId: string
    phone: string | null | undefined
    template: MessageTemplate
    variables: TemplateVariables
    sentBy?: string
  }) {
    const message = renderTemplate(input.template.body, input.variables)
    const queued = await QueueManager.enqueue({
      propertyId: input.propertyId,
      tenantId: input.tenantId,
      templateId: input.template.id,
      channel: 'whatsapp',
      renderedMessage: message,
    })

    if (!input.phone) {
      await QueueManager.markFailed(queued.id, 'No phone number on file')
      return { queued, opened: false }
    }

    const chatLink = ClickToChatProvider.buildChatLink(input.phone, message)
    window.open(chatLink, '_blank', 'noopener,noreferrer')
    await QueueManager.markSent(queued.id)
    await HistoryService.record({
      propertyId: input.propertyId,
      tenantId: input.tenantId,
      templateId: input.template.id,
      channel: 'whatsapp',
      renderedMessage: message,
      status: 'sent',
      sentBy: input.sentBy,
    })
    return { queued, opened: true }
  },

  /**
   * Retry Queue — re-attempts a previously-failed queue item using its
   * already-rendered message (no re-render needed; the template
   * variables at the time it was queued are preserved in
   * `rendered_message`). If it still can't be sent (still no phone),
   * `attempt_count` increments again via `QueueManager.markFailed`
   * rather than silently looping. Owner-triggered only, like every other
   * send path here.
   */
  async retryQueueItem(input: { queueId: string; propertyId: string; tenantId: string; phone: string | null | undefined; message: string; templateId: string | null; sentBy?: string }) {
    if (!input.phone) {
      await QueueManager.markFailed(input.queueId, 'No phone number on file')
      return { opened: false }
    }
    const chatLink = ClickToChatProvider.buildChatLink(input.phone, input.message)
    window.open(chatLink, '_blank', 'noopener,noreferrer')
    await QueueManager.markSent(input.queueId)
    await HistoryService.record({
      propertyId: input.propertyId,
      tenantId: input.tenantId,
      templateId: input.templateId,
      channel: 'whatsapp',
      renderedMessage: input.message,
      status: 'sent',
      sentBy: input.sentBy,
    })
    return { opened: true }
  },
}
