// Phase 8.5 — Profile Status System
//
// Single source of truth for the onboarding profile lifecycle, shared by
// the Owner Timeline (approvals/reviews tab) and the Tenant Timeline
// (portal + onboarding wizard). Built on top of the `onboarding_status`
// values already written by Phase 8.1–8.4 (supabase/29_tenant_invitations.sql,
// src/lib/supabase/queries.ts) — no status values are renamed, only 'draft'
// is newly introduced between 'password_changed' and 'submitted'.

import type { Tenant } from '@/types'

export type ProfileStatus =
  | 'invitation_created'
  | 'password_changed'
  | 'draft'
  | 'submitted'
  | 'correction_requested'
  | 'resubmitted'
  | 'approved'

export interface ProfileStatusStep {
  key: ProfileStatus
  label: string
  ownerLabel: string
}

// The canonical ladder order. 'correction_requested' and 'resubmitted' are
// a branch off the main line (a tenant may loop through them more than
// once), so they're kept adjacent to 'submitted' rather than after 'approved'.
export const PROFILE_STATUS_STEPS: ProfileStatusStep[] = [
  { key: 'invitation_created', label: 'Invitation Sent', ownerLabel: 'Invitation Created' },
  { key: 'password_changed', label: 'Account Activated', ownerLabel: 'Password Changed' },
  { key: 'draft', label: 'Filling Profile', ownerLabel: 'Draft In Progress' },
  { key: 'submitted', label: 'Submitted for Review', ownerLabel: 'Submitted' },
  { key: 'correction_requested', label: 'Correction Requested', ownerLabel: 'Correction Requested' },
  { key: 'resubmitted', label: 'Resubmitted', ownerLabel: 'Resubmitted' },
  { key: 'approved', label: 'Profile Approved', ownerLabel: 'Approved & Activated' },
]

const STATUS_LABELS: Record<string, string> = Object.fromEntries(
  PROFILE_STATUS_STEPS.map(s => [s.key, s.label])
)

export function profileStatusLabel(status: string | null | undefined, variant: 'owner' | 'tenant' = 'tenant'): string {
  if (!status) return 'Not Started'
  const step = PROFILE_STATUS_STEPS.find(s => s.key === status)
  if (!step) return status
  return variant === 'owner' ? step.ownerLabel : step.label
}

// For a linear progress bar / step index. 'correction_requested' and
// 'resubmitted' map to the same visual position as 'submitted' (step 4 of
// the main line) since they're a detour, not forward progress.
export function profileStatusStepIndex(status: string | null | undefined): number {
  if (!status) return 0
  if (status === 'correction_requested' || status === 'resubmitted') return 3
  const idx = PROFILE_STATUS_STEPS.findIndex(s => s.key === status)
  return idx === -1 ? 0 : idx > 3 ? idx - 2 : idx // collapse the branch out of the main-line count
}

export const PROFILE_STATUS_MAIN_LINE_COUNT = 5 // invitation, activated, draft/filling, submitted, approved

const REQUIRED_FIELDS: { key: keyof Tenant; label: string }[] = [
  { key: 'name', label: 'Full Name' },
  { key: 'photo_url', label: 'Profile Photo' },
  { key: 'aadhaar_number', label: 'Aadhaar Number' },
  { key: 'aadhaar_front_url', label: 'Aadhaar Front' },
  { key: 'aadhaar_back_url', label: 'Aadhaar Back' },
  { key: 'permanent_address', label: 'Permanent Address' },
  { key: 'emergency_contact_name', label: 'Emergency Contact Name' },
  { key: 'emergency_contact', label: 'Emergency Contact Number' },
]

/**
 * Profile completion percentage, checked against whichever values are
 * currently "live" for the tenant to see — pending_profile while they're
 * still filling in the wizard (matches OnboardingWizard's own draft
 * pre-fill logic), falling back to the live tenant columns once approved.
 */
export function calculateProfileCompletion(tenant: Partial<Tenant> | null | undefined): number {
  if (!tenant) return 0
  const draft = (tenant as any).pending_profile ?? {}
  let filled = 0
  for (const field of REQUIRED_FIELDS) {
    const value = draft[field.key] ?? (tenant as any)[field.key]
    if (value !== null && value !== undefined && String(value).trim() !== '') filled++
  }
  return Math.round((filled / REQUIRED_FIELDS.length) * 100)
}

export function missingProfileFields(tenant: Partial<Tenant> | null | undefined): string[] {
  if (!tenant) return REQUIRED_FIELDS.map(f => f.label)
  const draft = (tenant as any).pending_profile ?? {}
  return REQUIRED_FIELDS.filter(field => {
    const value = draft[field.key] ?? (tenant as any)[field.key]
    return value === null || value === undefined || String(value).trim() === ''
  }).map(f => f.label)
}

export { STATUS_LABELS as profileStatusLabels }
