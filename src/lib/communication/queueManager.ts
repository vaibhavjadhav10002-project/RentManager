import {
  getCommunicationQueue,
  addToCommunicationQueue,
  updateQueueItemStatus,
} from '@/lib/supabase/queries'
import type { CommunicationChannel } from '@/types'

/**
 * QueueManager — the layer between the Inbox UI and the
 * `communication_queue` table. All actual Supabase access lives in
 * `@/lib/supabase/queries.ts` (matching how every other feature in this
 * app is structured); this module just gives the rest of the
 * Communication Engine a stable, higher-level API to call instead of
 * importing query functions directly everywhere.
 *
 * Phase 9.1 scope: enqueue and list only. Phase 9.2 (Manual Send) is what
 * actually transitions a row from 'pending' to 'sent' when the owner
 * presses the WhatsApp button. Phase 9.3 added the Reminder Engine
 * (`reminderEngine.ts`) and the Retry Queue on top of `markFailed` below
 * — both are still owner-triggered: the Reminder Engine only *suggests*
 * candidates in the Reminders tab, and a Retry only happens when the
 * owner presses the Retry button on a failed item. Nothing in this
 * module runs on a schedule or without a click.
 */
export const QueueManager = {
  async list(propertyId: string) {
    return getCommunicationQueue(propertyId)
  },

  async enqueue(input: {
    propertyId: string
    tenantId?: string | null
    templateId?: string | null
    channel: CommunicationChannel
    renderedMessage: string
    scheduledFor?: string
  }) {
    return addToCommunicationQueue({
      property_id: input.propertyId,
      tenant_id: input.tenantId,
      template_id: input.templateId,
      channel: input.channel,
      rendered_message: input.renderedMessage,
      scheduled_for: input.scheduledFor,
    })
  },

  async markSent(queueId: string) {
    await updateQueueItemStatus(queueId, 'sent')
  },

  async markFailed(queueId: string, error: string) {
    await updateQueueItemStatus(queueId, 'failed', { last_error: error })
  },

  async cancel(queueId: string) {
    await updateQueueItemStatus(queueId, 'cancelled')
  },
}
