import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, differenceInDays, setDate } from 'date-fns'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// ─── Friendly error messages ────────────────────────────────────────────────
// Raw Supabase/PostgREST/Postgres errors are written for developers, not
// tenants or owners — e.g. "Cannot coerce the result to a single JSON
// object" or "duplicate key value violates unique constraint" mean nothing
// to a non-technical person and just look like the app is broken. This
// intercepts known cryptic technical error signatures and swaps in plain
// language, while leaving already-friendly messages (this app's own custom
// errors) passed straight through unchanged.
export function friendlyErrorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : typeof error === 'string' ? error : ''

  if (/coerce the result to a single JSON object|PGRST116/i.test(raw)) {
    return 'Something went wrong loading that — please try again.'
  }
  if (/JWT expired|invalid JWT|refresh_token_not_found|session.*expired/i.test(raw)) {
    return 'Your session has expired — please log in again.'
  }
  if (/Failed to fetch|NetworkError|network request failed|ERR_INTERNET_DISCONNECTED/i.test(raw)) {
    return 'No internet connection — please check your network and try again.'
  }
  if (/duplicate key value violates unique constraint/i.test(raw)) {
    return "This already exists — please check and try again."
  }
  if (/violates foreign key constraint/i.test(raw)) {
    return "This can't be completed right now — a related item may be missing."
  }
  if (/violates row-level security policy|permission denied/i.test(raw)) {
    return "You don't have permission to do that."
  }

  // Anything that already reads like a normal sentence is left as-is —
  // only intercept text that looks like raw database/technical output.
  if (raw && raw.length < 150 && !/[{}[\]<>]|violates|constraint|relation "|column "|PGRST\d/i.test(raw)) {
    return raw
  }

  return 'Something went wrong — please try again.'
}

// ─── Money ───────────────────────────────────────────────────────────────────
export function formatINR(amount: number) {
  return `₹${amount.toLocaleString('en-IN')}`
}

// ─── Date helpers ─────────────────────────────────────────────────────────────
export function formatDate(date: string | Date) {
  return format(new Date(date), 'dd MMM yyyy')
}

export function formatMonth(date: string | Date) {
  return format(new Date(date), 'MMMM yyyy')
}

/**
 * Compute the current cycle's due date for a tenant.
 * Rule: due date = same day-of-month as joining date, for current month.
 * If that date is in the future, go back one month.
 */
export function computeDueDate(joiningDate: string, today = new Date()): Date {
  const joined = new Date(joiningDate)
  const dueDay = joined.getDate()

  // Try this month's due date
  let due = setDate(new Date(today.getFullYear(), today.getMonth(), 1), dueDay)

  // If it's upcoming (tenant hasn't hit their due date yet this month), use last month
  if (due > today) {
    due = setDate(new Date(today.getFullYear(), today.getMonth() - 1, 1), dueDay)
  }
  return due
}

export function getOverdueDays(joiningDate: string, today = new Date()): number {
  const due = computeDueDate(joiningDate, today)
  return Math.max(0, differenceInDays(today, due))
}

// ─── Late fee auto-calculation ────────────────────────────────────────────────
// Property-level policy (not per-agreement) so it applies to every tenant
// regardless of how they joined. Returns 0 if the property hasn't
// configured a late fee (never fabricates a charge that wasn't set up).
export function calculateLateFee(overdueDays: number, feePerDay: number, graceDays: number): number {
  if (!feePerDay || feePerDay <= 0) return 0
  const chargeableDays = Math.max(0, overdueDays - graceDays)
  return chargeableDays * feePerDay
}

// ─── Smart Rent Adjustment (approved leave) ───────────────────────────────────
// Prorates a billing month's rent down for any *approved* leave days that
// fall inside it. Per-day rate = monthlyRent / calendar days in that month,
// so shorter/longer months are charged fairly. Only ever reduces rent —
// never increases it — and never below zero for the month.
export interface ApprovedLeave { start_date: string; end_date: string }

export function calculateLeaveRentAdjustment(monthLabel: string, monthlyRent: number, approvedLeaves: ApprovedLeave[]): number {
  if (!approvedLeaves.length || !monthlyRent) return 0
  const monthDate = new Date(`1 ${monthLabel}`)
  const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1)
  const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0)
  const daysInMonth = monthEnd.getDate()
  const perDay = monthlyRent / daysInMonth

  let leaveDays = 0
  for (const l of approvedLeaves) {
    const start = new Date(l.start_date)
    const end = new Date(l.end_date)
    const overlapStart = start > monthStart ? start : monthStart
    const overlapEnd = end < monthEnd ? end : monthEnd
    if (overlapEnd >= overlapStart) {
      leaveDays += Math.floor((overlapEnd.getTime() - overlapStart.getTime()) / 86400000) + 1
    }
  }
  return Math.min(monthlyRent, Math.round(leaveDays * perDay))
}

// ─── Rent Extension lookup ─────────────────────────────────────────────────
// Finds an *approved* extension for a given billing month, if one exists.
// Used to push out the effective due date used for late-fee calculation and
// to show owner-side "extension granted" badges instead of a false overdue
// flag. Extension never changes the rent amount owed — only its timing.
export interface RentExtension { for_month: string; requested_until: string; status: string }

export function getApprovedExtensionFor(monthLabel: string, extensions: RentExtension[]): RentExtension | null {
  return extensions.find(e => e.for_month === monthLabel && e.status === 'approved') ?? null
}

// ─── Move-Out Checklist ─────────────────────────────────────────────────────
// Standard PG move-out items. Fixed for now (not owner-configurable) —
// keeps this sub-phase scoped; a per-property custom checklist can be a
// future improvement if owners ask for one.
export const DEFAULT_MOVE_OUT_CHECKLIST: string[] = [
  'Room keys returned',
  'No pending rent or bill dues',
  'Room & furniture inspected for damage',
  'Electricity meter reading noted',
  'Personal belongings removed',
  'Deposit settlement discussed with tenant',
]

// ─── Advance payment application ──────────────────────────────────────────────
// Applies a lump advance-payment balance across unpaid/partial months in
// chronological order (oldest first), same logic used everywhere this
// calculation happens so owner and tenant views can never disagree.
export interface LedgerMonth { label: string; amount: number; paid: number; status: 'paid' | 'partial' | 'pending' }

export function applyAdvanceBalance<T extends LedgerMonth>(monthsOldestFirst: T[], advanceBalance: number): { months: T[]; remainingAdvance: number } {
  let remaining = advanceBalance
  const months = monthsOldestFirst.map(m => {
    if (m.status === 'paid' || remaining <= 0) return m
    const gap = m.amount - m.paid
    const applied = Math.min(gap, remaining)
    if (applied <= 0) return m
    remaining -= applied
    const newPaid = m.paid + applied
    return { ...m, paid: newPaid, status: (newPaid >= m.amount ? 'paid' : 'partial') as T['status'] }
  })
  return { months, remainingAdvance: remaining }
}

// ─── Monthly rent ledger (shared — Owner Final Settlement + anywhere else
// that needs "how much rent does this tenant actually still owe") ─────────
// Same walk the Tenant Portal already does inline for its own ledger view,
// pulled out here so the Owner side can compute the same number without
// duplicating (and risking drifting out of sync with) that logic.
export interface LedgerPayment { for_month: string | null; type: string; approval_status: string; amount_received: number; payment_date?: string }
export interface LedgerTenant { joining_date: string; leaving_date?: string | null; monthly_rent: number }

export function buildMonthlyLedger(tenant: LedgerTenant, payments: LedgerPayment[], approvedLeaves: ApprovedLeave[]): (LedgerMonth & { paidOn?: string; adjustment: number })[] {
  if (!tenant?.joining_date) return []
  const months: (LedgerMonth & { paidOn?: string; adjustment: number })[] = []
  const start = new Date(tenant.joining_date)
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1)
  const today = new Date()
  const end = tenant.leaving_date && new Date(tenant.leaving_date) < today ? new Date(tenant.leaving_date) : today
  while (cursor <= end) {
    const label = cursor.toLocaleString('en-IN', { month: 'long', year: 'numeric' })
    const monthPayments = payments.filter(p => p.for_month === label && p.type === 'rent' && p.approval_status === 'approved')
    const totalPaid = monthPayments.reduce((s, p) => s + p.amount_received, 0)
    const adjustment = calculateLeaveRentAdjustment(label, tenant.monthly_rent, approvedLeaves)
    const amount = tenant.monthly_rent - adjustment
    const status: LedgerMonth['status'] = totalPaid >= amount ? 'paid' : totalPaid > 0 ? 'partial' : 'pending'
    months.push({ label, status, amount, paid: totalPaid, paidOn: monthPayments[0]?.payment_date, adjustment })
    cursor.setMonth(cursor.getMonth() + 1)
  }
  return months
}

// Total rent still outstanding as of today (or the tenant's leaving date,
// whichever the ledger walk above already stops at) — advance payments
// applied oldest-first first, same as the Tenant Portal.
export function getRentOutstanding(tenant: LedgerTenant, payments: LedgerPayment[], approvedLeaves: ApprovedLeave[]): number {
  const ledger = buildMonthlyLedger(tenant, payments, approvedLeaves)
  const advanceBalance = payments.filter(p => p.type === 'advance' && p.approval_status === 'approved').reduce((s, p) => s + p.amount_received, 0)
  const { months } = applyAdvanceBalance(ledger, advanceBalance)
  return months.reduce((s, m) => s + Math.max(0, m.amount - m.paid), 0)
}

// ─── Final Settlement (Move-Out) ───────────────────────────────────────────
// Combines deposit held, itemized deductions the owner has already entered,
// and outstanding rent pulled live from the ledger — into one suggested net
// refund. This is a *suggestion*: the owner can still freely edit the
// deposit-refund amount and deduction items exactly as before; this just
// makes sure "how much rent is still owed" is visible and easy to fold in
// as a deduction line instead of the owner having to work it out by hand
// or check a separate screen.
export interface FinalSettlementTenant extends LedgerTenant {
  deposit_paid: number
}

export interface FinalSettlementResult {
  depositPaid: number
  outstandingRent: number
  deductionTotal: number
  suggestedRefund: number
}

export function computeFinalSettlement(
  tenant: FinalSettlementTenant,
  payments: LedgerPayment[],
  approvedLeaves: ApprovedLeave[],
  deductionItems: { amount: number }[]
): FinalSettlementResult {
  const depositPaid = tenant.deposit_paid || 0
  const outstandingRent = getRentOutstanding(tenant, payments, approvedLeaves)
  const deductionTotal = deductionItems.reduce((s, it) => s + (it.amount || 0), 0)
  const suggestedRefund = Math.max(0, depositPaid - deductionTotal - outstandingRent)
  return { depositPaid, outstandingRent, deductionTotal, suggestedRefund }
}

// ─── UPI payment deep link ───────────────────────────────────────────────────
// Built manually with encodeURIComponent (not URLSearchParams) because
// URLSearchParams encodes spaces as "+" (form-encoding), which several UPI
// apps fail to parse correctly in a upi:// deep link — they expect strict
// percent-encoding ("%20").
// ─── UPI payment deep-links ────────────────────────────────────────────────
// A single generic `upi://` link doesn't reliably launch payment apps on
// every device — iOS doesn't support the generic scheme at all, and some
// Android setups need the app's own scheme to trigger correctly. This
// returns one link per major app so the user can tap whichever they have
// installed. All of these are free, standard URI deep-links — no payment
// gateway or subscription involved.
export function upiPaymentLinks(upiId: string, payeeName: string, amount: number, note: string) {
  const params = new URLSearchParams({
    pa: upiId, pn: payeeName, am: amount.toFixed(2), cu: 'INR', tn: note,
  }).toString()
  return {
    generic: `upi://pay?${params}`,
    gpay: `tez://upi/pay?${params}`,
    phonepe: `phonepe://pay?${params}`,
    paytm: `paytmmp://pay?${params}`,
  }
}

// Kept for existing callers — returns the generic link.
export function upiPaymentLink(upiId: string, payeeName: string, amount: number, note: string) {
  return upiPaymentLinks(upiId, payeeName, amount, note).generic
}

// ─── QR slug generator ────────────────────────────────────────────────────────
export function generateSlug(pgName: string) {
  return pgName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') +
    '-' + Math.random().toString(36).slice(2, 6)
}

// ─── WhatsApp deep-link ───────────────────────────────────────────────────────
export function whatsappLink(phone: string, message: string) {
  const cleaned = phone.replace(/\D/g, '')
  const num = cleaned.startsWith('91') ? cleaned : `91${cleaned}`
  return `https://wa.me/${num}?text=${encodeURIComponent(message)}`
}

export function rentReminderMsg(tenantName: string, amount: number, pgName: string) {
  return `Hi ${tenantName} 👋,\n\nThis is a friendly reminder that your rent of ${formatINR(amount)} is due for ${pgName}.\n\nPlease make the payment at your earliest convenience.\n\nThank you! 🙏`
}

// ─── Occupancy calc ───────────────────────────────────────────────────────────
export function occupancyPercent(occupied: number, total: number) {
  if (total === 0) return 0
  return Math.round((occupied / total) * 100)
}
