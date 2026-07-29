import { differenceInDays } from 'date-fns'
import { getOverdueDays } from '@/lib/utils'

/**
 * ReminderEngine — Phase 9.3. Identifies which active tenants currently
 * need a rent reminder, without inventing new due-date math or
 * duplicating Payments' pending-rent logic:
 *
 * - Overdue/due-today status comes from the EXISTING `getOverdueDays()`
 *   utility (same one Dashboard and Payments already use) — reused, not
 *   reimplemented.
 * - "Already paid this month" sums already-fetched `payments` (approved
 *   rent payments for the current month) and compares against the
 *   tenant's monthly rent — a partial payment does NOT clear a tenant
 *   off the reminder list, only a payment that covers the full amount
 *   does. (Fixed post-audit: the first version only checked for the
 *   *existence* of an approved payment, which incorrectly silenced
 *   reminders for tenants who'd only paid part of what they owed.)
 * - "Already reminded recently" comes from already-fetched
 *   `communication_logs`, filtered to logs sent using a reminder-category
 *   template (`rent_reminder` / `due_today` / `overdue`) — this is what
 *   makes `default_reminder_days` meaningful without being thrown off by
 *   an unrelated message (a Welcome note, a general notice) sent to the
 *   same tenant. (Fixed post-audit: the first version counted *any*
 *   communication as a "reminder," so an unrelated message could
 *   silently suppress a genuinely-needed rent reminder.)
 *
 * This module only ever *identifies* candidates. It never sends anything
 * and never queues anything by itself — the Inbox UI decides what to do
 * with the candidate list, still going through the same Manual Send flow
 * as the rest of the Inbox (owner presses the button, WhatsApp opens,
 * owner presses Send).
 */

export interface ReminderCandidate {
  tenantId: string
  overdueDays: number
  lastRemindedAt: string | null
}

const REMINDER_TEMPLATE_CATEGORIES = new Set(['rent_reminder', 'due_today', 'overdue'])

/**
 * Matches the exact method + options used by Payments and Dashboard for
 * their own `thisMonth` label (`toLocaleString`, not `toLocaleDateString`)
 * so the string this function produces is guaranteed to line up with
 * `payments.for_month` values written by that existing code — rather
 * than relying on two different Date methods happening to agree.
 */
function currentMonthLabel(date: Date): string {
  return date.toLocaleString('en-IN', { month: 'long', year: 'numeric' })
}

export const ReminderEngine = {
  /**
   * True when a tenant hasn't been sent a reminder-category message
   * within the configured lead time. Pure function — no I/O.
   */
  shouldRemind(input: { lastRemindedAt: string | null; reminderLeadDays: number; today?: Date }): boolean {
    if (!input.lastRemindedAt) return true
    const today = input.today ?? new Date()
    const daysSince = differenceInDays(today, new Date(input.lastRemindedAt))
    return daysSince >= input.reminderLeadDays
  },

  /**
   * Builds the full candidate list for a property. All four input arrays
   * are exactly what the Inbox page already fetches for its other tabs —
   * no additional query is introduced by this function.
   */
  findCandidates(input: {
    tenants: { id: string; joining_date: string; status: string; monthly_rent: number }[]
    payments: { tenant_id: string | null; for_month: string | null; approval_status: string; type: string; amount_received: number }[]
    logs: { tenant_id: string | null; created_at: string; template_id: string | null }[]
    templates: { id: string; category: string }[]
    reminderLeadDays: number
    today?: Date
  }): ReminderCandidate[] {
    const today = input.today ?? new Date()
    const thisMonth = currentMonthLabel(today)

    // Sum approved rent payments per tenant for the current month, rather
    // than just checking whether any approved payment exists at all.
    const paidAmountByTenant = new Map<string, number>()
    for (const p of input.payments) {
      if (!p.tenant_id || p.type !== 'rent' || p.approval_status !== 'approved' || p.for_month !== thisMonth) continue
      paidAmountByTenant.set(p.tenant_id, (paidAmountByTenant.get(p.tenant_id) ?? 0) + p.amount_received)
    }

    const reminderTemplateIds = new Set(
      input.templates.filter(t => REMINDER_TEMPLATE_CATEGORIES.has(t.category)).map(t => t.id)
    )

    const lastRemindedByTenant = new Map<string, string>()
    for (const log of input.logs) {
      if (!log.tenant_id) continue
      if (!log.template_id || !reminderTemplateIds.has(log.template_id)) continue
      const existing = lastRemindedByTenant.get(log.tenant_id)
      if (!existing || new Date(log.created_at) > new Date(existing)) {
        lastRemindedByTenant.set(log.tenant_id, log.created_at)
      }
    }

    return input.tenants
      .filter(t => t.status === 'active')
      .filter(t => (paidAmountByTenant.get(t.id) ?? 0) < t.monthly_rent)
      .map(t => ({
        tenantId: t.id,
        overdueDays: getOverdueDays(t.joining_date, today),
        lastRemindedAt: lastRemindedByTenant.get(t.id) ?? null,
      }))
      .filter(c => ReminderEngine.shouldRemind({ lastRemindedAt: c.lastRemindedAt, reminderLeadDays: input.reminderLeadDays, today }))
      .sort((a, b) => b.overdueDays - a.overdueDays)
  },
}
