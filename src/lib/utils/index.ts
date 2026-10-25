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
// language, while leaving already-friendly messages (including this app's
// own custom errors, like "This payment has already been decided") passed
// straight through unchanged — it only replaces things that would
// otherwise look like a stack trace.
export function friendlyErrorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : typeof error === 'string' ? error : ''

  if (/coerce the result to a single JSON object|PGRST116/i.test(raw)) {
    return 'Something went wrong saving that — please try again.'
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

  // Anything that already reads like a normal sentence (this app's own
  // hand-written error messages, e.g. "Enter a valid email address") is
  // left exactly as-is — only intercept text that looks like raw
  // database/technical output.
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

// Parses a Postgres `date` column (a plain "YYYY-MM-DD" string) into a
// **local-midnight** Date, unlike `new Date("YYYY-MM-DD")` which the JS spec
// parses as *UTC* midnight — the two disagree by a calendar day for anyone
// on a negative UTC-offset timezone. Every date-only column in this app
// (joining_date, leaving_date, start_date/end_date, requested_until, etc.)
// should be read through this helper so rent-cycle, leave, move-out,
// extension, and settlement calculations never drift against each other
// depending on the viewer's device timezone. Falls back to a plain `new
// Date()` for anything that isn't a bare date string (already a Date, or a
// full timestamp, which carries its own explicit offset).
export function parseDateOnly(value: string | Date): Date {
  if (value instanceof Date) return value
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!m) return new Date(value)
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
}

/**
 * Compute the current cycle's due date for a tenant.
 * Rule: due date = same day-of-month as joining date, for current month.
 * If that date is in the future, go back one month.
 */
export function computeDueDate(joiningDate: string, today = new Date()): Date {
  const joined = parseDateOnly(joiningDate)
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

  // Clip every approved leave to this month's bounds, then merge overlapping/
  // adjacent ranges before counting days — two approved leaves that share
  // any days (e.g. 5–9 Sep and 7–9 Sep) must only ever count those shared
  // days once, otherwise the tenant is refunded rent for days they weren't
  // actually on leave twice over.
  const intervals: Array<[number, number]> = []
  for (const l of approvedLeaves) {
    const start = parseDateOnly(l.start_date)
    const end = parseDateOnly(l.end_date)
    const overlapStart = start > monthStart ? start : monthStart
    const overlapEnd = end < monthEnd ? end : monthEnd
    if (overlapEnd >= overlapStart) {
      intervals.push([overlapStart.getTime(), overlapEnd.getTime()])
    }
  }
  intervals.sort((a, b) => a[0] - b[0])

  let leaveDays = 0
  let mergedStart: number | null = null
  let mergedEnd: number | null = null
  for (const [s, e] of intervals) {
    if (mergedStart === null) {
      mergedStart = s
      mergedEnd = e
    } else if (s <= (mergedEnd as number) + 86400000) {
      // overlapping or back-to-back (adjacent day) — extend the merged range
      mergedEnd = Math.max(mergedEnd as number, e)
    } else {
      leaveDays += Math.floor(((mergedEnd as number) - mergedStart) / 86400000) + 1
      mergedStart = s
      mergedEnd = e
    }
  }
  if (mergedStart !== null) {
    leaveDays += Math.floor(((mergedEnd as number) - mergedStart) / 86400000) + 1
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

// ─── Rent-cycle-based notice period (Move-Out eligibility) ────────────────────
// The tenant's joining-date day-of-month is the recurring "cycle day" every
// subsequent rent cycle runs on (e.g. joined 5 Aug → cycles run 5th-to-4th
// every month, same convention `computeDueDate` already uses for rent). A
// move-out notice must be given *before* a cycle's start date to be honoured
// at the end of that same cycle; notice given on-or-after a cycle's start
// date (the tenant has already "entered" that cycle, same >= convention as
// computeDueDate) means that cycle is unavoidably payable in full, and the
// tenant becomes eligible to leave only at the start of the cycle *after*
// next — i.e. one full extra cycle beyond the one they missed the cutoff
// for. This is the single authoritative calculation for notice eligibility;
// every screen (tenant move-out form, owner approval, dashboards) must call
// this function rather than re-deriving its own date.
//
// Worked example (matches the confirmed production rule):
//   joiningDate = 5 Aug, requestDate = 6 Sep
//   → the 5 Sep cycle boundary has already passed relative to the request
//   → next boundary (5 Oct) is unavoidably payable
//   → eligible move-out date = 5 Nov
export function computeEligibleMoveOutDate(joiningDate: string, requestDate: string): Date {
  const cycleDay = parseDateOnly(joiningDate).getDate()
  const req = parseDateOnly(requestDate)

  // Most recent cycle boundary that has started on-or-before the request
  // date (same "due date already arrived" convention as computeDueDate).
  let currentCycleStart = new Date(req.getFullYear(), req.getMonth(), 1)
  currentCycleStart = setDate(currentCycleStart, cycleDay)
  if (currentCycleStart > req) {
    currentCycleStart = setDate(new Date(req.getFullYear(), req.getMonth() - 1, 1), cycleDay)
  }

  // Eligible date = two cycle-boundaries after the one currently in
  // progress — the tenant pays out the current cycle in full (missed
  // cutoff) plus is on the hook for one further full cycle of notice.
  return setDate(new Date(currentCycleStart.getFullYear(), currentCycleStart.getMonth() + 2, 1), cycleDay)
}

// ─── Joining Payment Balance ───────────────────────────────────────────────
// Deposit and first-month ("joining") rent are two separate financial
// components collected at onboarding. Both Owner and Tenant portals must
// call this single function so they can never disagree on what's still
// owed. Reuses the existing tenant columns — no new required/paid fields
// were invented: `deposit_amount`/`deposit_paid` and `monthly_rent`/
// `rent_paid_at_joining` already carry this data, they were just never
// combined into one authoritative, deadline-aware view before.
export interface JoiningPaymentTenant {
  joining_date: string
  deposit_amount: number
  deposit_paid: number
  monthly_rent: number
  rent_paid_at_joining: number
}

export interface JoiningPaymentStatus {
  depositRequired: number
  depositPaid: number
  depositOutstanding: number
  rentRequired: number
  rentPaid: number
  rentOutstanding: number
  totalOutstanding: number
  deadline: Date
  status: 'paid' | 'outstanding' | 'overdue'
}

export function computeJoiningPaymentStatus(tenant: JoiningPaymentTenant, today = new Date()): JoiningPaymentStatus {
  const depositRequired = tenant.deposit_amount || 0
  const depositPaid = tenant.deposit_paid || 0
  const depositOutstanding = Math.max(0, depositRequired - depositPaid)

  const rentRequired = tenant.monthly_rent || 0
  const rentPaid = tenant.rent_paid_at_joining || 0
  const rentOutstanding = Math.max(0, rentRequired - rentPaid)

  const totalOutstanding = depositOutstanding + rentOutstanding

  // 5 calendar days from the joining date, inclusive of the joining date
  // itself as Day 1 (5 Aug → 6 Aug → 7 Aug → 8 Aug → 9 Aug = deadline).
  const joined = parseDateOnly(tenant.joining_date)
  const deadline = new Date(joined.getFullYear(), joined.getMonth(), joined.getDate() + 4)

  let status: JoiningPaymentStatus['status'] = 'paid'
  if (totalOutstanding > 0) {
    status = today > deadline ? 'overdue' : 'outstanding'
  }

  return { depositRequired, depositPaid, depositOutstanding, rentRequired, rentPaid, rentOutstanding, totalOutstanding, deadline, status }
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

// ─── Monthly Rent Ledger (single authoritative source) ────────────────────────
// Builds the full month-by-month rent ledger from the tenant's joining date
// up to today (or leaving date), walking every month in between — not just
// the current one. This used to live only inline in the Tenant Portal;
// Owner-side "pending rent" screens computed their own simplified
// current-month-only view instead, which meant a backlog month could be
// paid up-to-date on one screen and still show ₹0 pending on the other.
// Both sides must now call this same function so they can never disagree.
export interface LedgerPayment { for_month: string | null; type: string; approval_status: string; amount_received: number; payment_date?: string }
export interface LedgerTenant { joining_date: string; leaving_date?: string | null; monthly_rent: number }

export function buildMonthlyLedger(tenant: LedgerTenant, payments: LedgerPayment[], approvedLeaves: ApprovedLeave[]): LedgerMonth[] {
  if (!tenant?.joining_date) return []
  const months: LedgerMonth[] = []
  const start = parseDateOnly(tenant.joining_date)
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1)
  const today = new Date()
  const end = tenant.leaving_date && parseDateOnly(tenant.leaving_date) < today ? parseDateOnly(tenant.leaving_date) : today
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

// Convenience wrapper: full ledger + advance balance applied + the derived
// totals every "pending rent" screen needs (oldest unpaid month, total
// pending). This is what Owner Dashboard/Payments and the Tenant Portal
// should both call instead of each re-deriving their own subset.
export function getRentOutstandingSummary(tenant: LedgerTenant, payments: LedgerPayment[], approvedLeaves: ApprovedLeave[]) {
  const ledger = buildMonthlyLedger(tenant, payments, approvedLeaves)
  const advanceBalance = payments.filter(p => p.type === 'advance' && p.approval_status === 'approved').reduce((s, p) => s + p.amount_received, 0)
  const { months, remainingAdvance } = applyAdvanceBalance(ledger, advanceBalance)
  const oldestUnpaidMonth = months.find(m => m.status !== 'paid') ?? null
  const totalPending = months.reduce((s, m) => s + Math.max(0, m.amount - m.paid), 0)
  return { months, remainingAdvance, oldestUnpaidMonth, totalPending }
}

// ─── Advance payment application ──────────────────────────────────────────────
// Applies a lump advance-payment balance across unpaid/partial months in
// chronological order (oldest first), same logic used everywhere this
// calculation happens so owner and tenant views can never disagree.
export interface LedgerMonth { label: string; amount: number; paid: number; status: 'paid' | 'partial' | 'pending'; paidOn?: string; adjustment?: number }

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
