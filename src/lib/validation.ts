// Shared validation helpers. Each function returns a user-friendly error
// string, or `null` when the value is valid — designed to drop into an
// existing `if (!ok) { toast.error(...); return }`-style validator
// without needing to restructure the surrounding form.

export function validateName(value: string, opts: { label?: string; min?: number; max?: number } = {}): string | null {
  const label = opts.label ?? 'Name'
  const trimmed = value.trim()
  if (!trimmed) return `${label} is required`
  if (trimmed.length < (opts.min ?? 2)) return `${label} is too short`
  if (trimmed.length > (opts.max ?? 80)) return `${label} is too long`
  if (!/[a-zA-Z]/.test(trimmed)) return `${label} can't be only spaces or symbols`
  return null
}

export function validateMobile(value: string, opts: { label?: string; required?: boolean } = {}): string | null {
  const label = opts.label ?? 'Mobile number'
  const digits = value.replace(/\D/g, '')
  if (!digits) return opts.required === false ? null : `${label} is required`
  if (digits.length !== 10) return `${label} must be exactly 10 digits`
  return null
}

export function validateEmail(value: string, opts: { required?: boolean } = {}): string | null {
  const trimmed = value.trim()
  if (!trimmed) return opts.required ? 'Email is required' : null
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return 'Enter a valid email address'
  return null
}

const PAN_PATTERN = /^[A-Z]{5}[0-9]{4}[A-Z]$/
export function validatePAN(value: string, opts: { required?: boolean } = {}): string | null {
  const v = value.trim().toUpperCase()
  if (!v) return opts.required ? 'PAN is required' : null
  if (!PAN_PATTERN.test(v)) return 'Enter a valid PAN (e.g. ABCDE1234F)'
  return null
}

export function validateAadhaar(value: string, opts: { required?: boolean } = {}): string | null {
  const digits = value.replace(/\D/g, '')
  if (!digits) return opts.required ? 'Aadhaar number is required' : null
  if (digits.length !== 12) return 'Aadhaar number must be exactly 12 digits'
  return null
}

const IFSC_PATTERN = /^[A-Z]{4}0[A-Z0-9]{6}$/
export function validateIFSC(value: string, opts: { required?: boolean } = {}): string | null {
  const v = value.trim().toUpperCase()
  if (!v) return opts.required ? 'IFSC code is required' : null
  if (!IFSC_PATTERN.test(v)) return 'Enter a valid IFSC code (e.g. HDFC0001234)'
  return null
}

export function validateAccountNumber(value: string, opts: { required?: boolean } = {}): string | null {
  const digits = value.replace(/\D/g, '')
  if (!digits) return opts.required ? 'Account number is required' : null
  if (digits.length < 6 || digits.length > 18) return 'Enter a valid account number'
  return null
}

/** Loosely validated — most Indian UPI IDs are `name@bank`; kept permissive since providers vary widely. */
export function validateUPI(value: string, opts: { required?: boolean } = {}): string | null {
  const v = value.trim()
  if (!v) return opts.required ? 'UPI ID is required' : null
  if (!/^[\w.\-]{2,}@[a-zA-Z][\w.\-]{1,}$/.test(v)) return 'Enter a valid UPI ID (e.g. name@bank)'
  return null
}

export function validatePositiveAmount(value: string | number, opts: { label?: string; allowZero?: boolean } = {}): string | null {
  const label = opts.label ?? 'Amount'
  if (value === '' || value === null || value === undefined) return `${label} is required`
  const n = Number(value)
  if (!Number.isFinite(n)) return `Enter a valid ${label.toLowerCase()}`
  if (opts.allowZero ? n < 0 : n <= 0) return `${label} must be greater than ${opts.allowZero ? 'or equal to ' : ''}0`
  return null
}

export function validateRequiredDate(value: string, opts: { label?: string; notBefore?: string; notAfter?: string } = {}): string | null {
  const label = opts.label ?? 'Date'
  if (!value) return `${label} is required`
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return `Enter a valid ${label.toLowerCase()}`
  if (opts.notBefore && value < opts.notBefore) return `${label} can't be before ${opts.notBefore}`
  if (opts.notAfter && value > opts.notAfter) return `${label} can't be after ${opts.notAfter}`
  return null
}

export function validateRequiredSelection(value: string | null | undefined, label = 'Selection'): string | null {
  if (!value) return `Please select a ${label.toLowerCase()}`
  return null
}

export function validateUpload(
  file: File | null | undefined,
  opts: { required?: boolean; maxSizeMB?: number; acceptedTypes?: string[]; label?: string } = {}
): string | null {
  const label = opts.label ?? 'File'
  if (!file) return opts.required ? `${label} is required` : null
  const maxBytes = (opts.maxSizeMB ?? 8) * 1024 * 1024
  if (file.size > maxBytes) return `${label} must be under ${opts.maxSizeMB ?? 8}MB`
  if (opts.acceptedTypes && !opts.acceptedTypes.includes(file.type)) return `${label} must be one of: ${opts.acceptedTypes.join(', ')}`
  return null
}

/** A friendly fallback for any caught error, so raw technical messages never reach the user. */
export function friendlyError(e: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (e instanceof Error && e.message && !/^(PGRST|JWT|invalid input syntax)/i.test(e.message)) {
    return e.message
  }
  return fallback
}
