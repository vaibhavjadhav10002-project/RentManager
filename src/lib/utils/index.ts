import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, differenceInDays, setDate } from 'date-fns'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
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
