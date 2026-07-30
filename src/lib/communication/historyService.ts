import { getCommunicationLogs, addCommunicationLog } from '@/lib/supabase/queries'
import type { CommunicationChannel, CommunicationStatus } from '@/types'

/**
 * HistoryService — permanent communication history, distinct from both the
 * Notification Bell (real-time alerts, unaffected by this module) and the
 * Communication Queue (working set of pending/sent/failed items, which can
 * be cleaned up over time). This is the durable record that powers the
 * Inbox "History" tab.
 */
export const HistoryService = {
  async list(propertyId: string, limit = 100) {
    return getCommunicationLogs(propertyId, limit)
  },

  async record(input: {
    propertyId: string
    tenantId?: string | null
    templateId?: string | null
    channel: CommunicationChannel
    renderedMessage: string
    status?: CommunicationStatus
    sentBy?: string
  }) {
    return addCommunicationLog({
      property_id: input.propertyId,
      tenant_id: input.tenantId,
      template_id: input.templateId,
      channel: input.channel,
      rendered_message: input.renderedMessage,
      status: input.status ?? 'sent',
      sent_by: input.sentBy,
    })
  },
}
