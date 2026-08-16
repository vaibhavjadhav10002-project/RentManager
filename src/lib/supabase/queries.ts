import { createClient } from '@/lib/supabase/client'
import { formatINR, DEFAULT_MOVE_OUT_CHECKLIST, getRentOutstandingSummary } from '@/lib/utils'
import type {
  AddRoomInput, AddTenantInput, RecordPaymentInput,
  AddExpenseInput, AddComplaintInput, AddLeaveRequestInput, AddRentExtensionRequestInput, AddMoveOutRequestInput,
  AddVisitorInput, AddParcelInput, AddWaitingListInput, AddRoomChangeInput, Property, Tenant
} from '@/types'
import { generateSlug } from '@/lib/utils'

// ─── Properties ───────────────────────────────────────────────────────────────
export async function getProperties() {
  const sb = createClient()
  const { data, error } = await sb
    .from('properties')
    .select('*')
    .order('created_at', { ascending: true })
  if (error) throw error
  return data
}

export async function addProperty(input: {
  name: string; address?: string; city?: string; upi_id?: string
}) {
  const sb = createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  const { data, error } = await sb.from('properties').insert({
    ...input,
    owner_id: user.id,
    qr_slug: generateSlug(input.name),
  }).select().single()
  if (error) throw error
  return data
}

export async function updateProperty(id: string, updates: Partial<Property>) {
  const sb = createClient()
  const { data, error } = await sb.from('properties').update(updates).eq('id', id).select().single()
  if (error) throw error
  return data
}

// ─── Rooms ────────────────────────────────────────────────────────────────────
export async function getRooms(propertyId: string) {
  const sb = createClient()
  const { data, error } = await sb
    .from('rooms')
    .select('*')
    .eq('property_id', propertyId)
    .order('room_number')
  if (error) throw error
  return data
}

export async function addRoom(input: AddRoomInput) {
  const sb = createClient()
  const { data, error } = await sb.from('rooms').insert(input).select().single()
  if (error) throw error
  return data
}

export async function updateRoom(id: string, updates: Partial<AddRoomInput>) {
  const sb = createClient()
  const { data, error } = await sb.from('rooms').update(updates).eq('id', id).select().single()
  if (error) throw error
  return data
}

export async function deleteRoom(id: string) {
  const sb = createClient()
  const { error } = await sb.from('rooms').delete().eq('id', id)
  if (error) throw error
}

// ─── Tenants ──────────────────────────────────────────────────────────────────
export async function getTenants(propertyId: string) {
  const sb = createClient()
  const { data, error } = await sb
    .from('tenants')
    .select('*, room:rooms(*)')
    .eq('property_id', propertyId)
    .order('name')
  if (error) throw error
  return data
}

export async function getAllTenants() {
  const sb = createClient()
  const { data, error } = await sb
    .from('tenants')
    .select('*, room:rooms(*), property:properties(name)')
    .order('name')
  if (error) throw error
  return data
}

export async function addTenantByOwner(input: AddTenantInput) {
  const sb = createClient()
  const { password, rent_paid_now, ...tenantData } = input
  const normalizedPhone = input.phone.replace(/\D/g, '')
  if (normalizedPhone.length < 10) throw new Error('Enter a valid 10-digit mobile number')

  // 1. Create tenant login via SQL RPC (bypasses GoTrue signup endpoint)
  // Phone is normalized to digits-only so it always matches how the login
  // page builds the synthetic email at sign-in time.
  const { data: newUserId, error: authError } = await sb.rpc('create_tenant_login', {
    p_phone: normalizedPhone,
    p_password: password,
    p_full_name: input.name,
  })
  if (authError) throw authError

  // 2. Insert tenant row linked to the new auth user
  const { data, error } = await sb.from('tenants').insert({
    ...tenantData,
    phone: normalizedPhone,
    auth_user_id: newUserId ?? null,
    status: 'active',
    submitted_via: 'owner_added',
  }).select().single()
  if (error) throw error

  // 3. If rent was collected at joining, record it as a payment
  if (rent_paid_now && rent_paid_now > 0) {
    const forMonth = new Date(input.joining_date).toLocaleString('en-IN', { month: 'long', year: 'numeric' })
    const { error: payError } = await sb.from('payments').insert({
      tenant_id: data.id,
      property_id: data.property_id,
      type: 'rent',
      for_month: forMonth,
      total_due: input.monthly_rent,
      amount_received: rent_paid_now,
      method: 'cash',
      approval_status: 'approved',
      submitted_by_tenant: false,
      payment_date: input.joining_date,
    })
    if (payError) throw payError
  }

  return data
}

// ─── Tenant Invitations (Phase 8.1) ──────────────────────────────────────────
// Minimal-entry alternative to addTenantByOwner: the owner supplies only a
// name and phone number, and the system creates the login immediately via
// the same create_tenant_login RPC every other tenant-creation path already
// uses — reusing it rather than adding a second way to create a login.
// Room, rent, deposit, and joining date are deliberately NOT collected here;
// they're set later by the owner during Review, once the tenant has logged
// in (using the temporary password returned below) and completed their own
// side of onboarding.
function generateTempPassword(): string {
  // Unambiguous alphabet (no 0/O/1/I/l) — this password gets read aloud or
  // typed in by hand far more often than a normal one, since the owner is
  // relaying it to the tenant directly.
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  let pw = ''
  for (let i = 0; i < 10; i++) pw += alphabet[Math.floor(Math.random() * alphabet.length)]
  return pw
}

export async function inviteTenant(input: import('@/types').InviteTenantInput) {
  const sb = createClient()
  const normalizedPhone = input.phone.replace(/\D/g, '')
  if (normalizedPhone.length < 10) throw new Error('Enter a valid 10-digit mobile number')
  if (!input.name.trim()) throw new Error('Enter the tenant\'s name')

  const tempPassword = generateTempPassword()

  const { data: newUserId, error: authError } = await sb.rpc('create_tenant_login', {
    p_phone: normalizedPhone,
    p_password: tempPassword,
    p_full_name: input.name.trim(),
  })
  if (authError) throw authError

  const { data, error } = await sb.from('tenants').insert({
    property_id: input.property_id,
    name: input.name.trim(),
    phone: normalizedPhone,
    auth_user_id: newUserId ?? null,
    status: 'invited',
    onboarding_status: 'invitation_created',
    submitted_via: 'owner_invited',
  }).select().single()
  if (error) throw error

  await logProfileStatusChange(data.id, data.property_id, null, 'invitation_created', 'owner')

  return { tenant: data as import('@/types').Tenant, tempPassword }
}

// ─── Profile Status History (Phase 8.5) ──────────────────────────────────────
// Append-only log backing the Owner Timeline and Tenant Timeline. Every
// function below that advances tenants.onboarding_status writes one row
// here in the same step, so the ladder's current value (unchanged from
// Phase 8.1–8.4) and its history never drift apart.
async function logProfileStatusChange(
  tenantId: string,
  propertyId: string,
  fromStatus: string | null,
  toStatus: string,
  changedBy: 'tenant' | 'owner',
  note?: string | null
) {
  const sb = createClient()
  // Best-effort — a logging failure should never block the actual status
  // transition the tenant or owner is waiting on.
  try {
    await sb.from('profile_status_history').insert({
      tenant_id: tenantId, property_id: propertyId,
      from_status: fromStatus, to_status: toStatus,
      changed_by: changedBy, note: note ?? null,
    })
  } catch { /* non-critical, see comment above */ }
}

export async function getProfileStatusHistory(tenantId: string) {
  const sb = createClient()
  const { data, error } = await sb
    .from('profile_status_history')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('changed_at', { ascending: true })
  if (error) throw error
  return data
}

/** Password-change step of the invitation ladder (Phase 8.1 → 8.2 handoff). */
export async function markOnboardingPasswordChanged(tenant: Pick<Tenant, 'id' | 'property_id' | 'onboarding_status'>) {
  const sb = createClient()
  const { data, error } = await sb.from('tenants')
    .update({ onboarding_status: 'password_changed' })
    .eq('id', tenant.id).select().single()
  if (error) throw error
  await logProfileStatusChange(tenant.id, tenant.property_id, tenant.onboarding_status ?? null, 'password_changed', 'tenant')
  return data
}

/** First-edit step of the wizard — 'password_changed' → 'draft'. A no-op if
 * the tenant is already past this point (draft/submitted/etc.), so it's
 * safe to call on every wizard mount without creating duplicate rows. */
export async function markOnboardingDraftStarted(tenant: Pick<Tenant, 'id' | 'property_id' | 'onboarding_status'>) {
  if (tenant.onboarding_status !== 'password_changed') return null
  const sb = createClient()
  const { data, error } = await sb.from('tenants')
    .update({ onboarding_status: 'draft' })
    .eq('id', tenant.id).select().single()
  if (error) throw error
  await logProfileStatusChange(tenant.id, tenant.property_id, 'password_changed', 'draft', 'tenant')
  return data
}

export async function getInvitedTenants(propertyId: string) {
  const sb = createClient()
  const { data, error } = await sb
    .from('tenants')
    .select('*')
    .eq('property_id', propertyId)
    .eq('status', 'invited')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

// ─── Owner Review (Phase 8.4) ────────────────────────────────────────────────
// Deliberately NOT reusing approveTenant() here — that function always
// calls create_tenant_login again (harmless no-op if the login already
// exists, since Phase 8.1 already created it) and then WhatsApps a
// default QR-flow password the tenant never actually has, since they set
// their own in Phase 8.2. A dedicated function avoids that mismatch and
// handles committing pending_profile, which approveTenant knows nothing
// about.
export async function approveOnboardingProfile(
  tenantId: string,
  profile: Record<string, any>,
  assignment: { room_id: string | null; bed_label?: string; monthly_rent: number; deposit_amount: number; deposit_paid?: number; joining_date: string; notice_period_days?: number }
) {
  const sb = createClient()
  const { data: { user: me } } = await sb.auth.getUser()
  const { data: existing } = await sb.from('tenants').select('onboarding_status').eq('id', tenantId).single()
  const { data, error } = await sb.from('tenants').update({
    // Commit the (possibly owner-edited) submitted profile into the live record.
    name: profile.name, email: profile.email || null, photo_url: profile.photo_url,
    aadhaar_number: profile.aadhaar_number, aadhaar_front_url: profile.aadhaar_front_url,
    aadhaar_back_url: profile.aadhaar_back_url, pan_url: profile.pan_url,
    permanent_address: profile.permanent_address, emergency_contact_name: profile.emergency_contact_name,
    emergency_contact: profile.emergency_contact,
    pending_profile: null, onboarding_status: 'approved', correction_note: null,
    // Owner-controlled fields, finalized as part of this same approval.
    room_id: assignment.room_id, bed_label: assignment.bed_label || null,
    monthly_rent: assignment.monthly_rent, deposit_amount: assignment.deposit_amount,
    deposit_paid: assignment.deposit_paid ?? 0, joining_date: assignment.joining_date,
    notice_period_days: assignment.notice_period_days ?? 30,
    status: 'active', approved_by: me?.id, approved_at: new Date().toISOString(),
  }).eq('id', tenantId).select().single()
  if (error) throw error
  await logProfileStatusChange(data.id, data.property_id, existing?.onboarding_status ?? null, 'approved', 'owner')
  return data
}

/** Tenant-side submit / resubmit step, called from OnboardingWizard.
 * Replaces a raw updateTenant() call so every wizard submission is logged
 * to profile_status_history the same way every other transition is. */
export async function submitOnboardingProfile(tenant: Pick<Tenant, 'id' | 'property_id' | 'onboarding_status'>, profile: Record<string, any>) {
  const sb = createClient()
  const toStatus = tenant.onboarding_status === 'correction_requested' ? 'resubmitted' : 'submitted'
  const { data, error } = await sb.from('tenants')
    .update({ pending_profile: profile, onboarding_status: toStatus })
    .eq('id', tenant.id).select().single()
  if (error) throw error
  await logProfileStatusChange(tenant.id, tenant.property_id, tenant.onboarding_status ?? null, toStatus, 'tenant')
  return data
}

export async function requestOnboardingCorrection(tenantId: string, note: string) {
  const sb = createClient()
  const { data: existing } = await sb.from('tenants').select('onboarding_status').eq('id', tenantId).single()
  const { data, error } = await sb.from('tenants')
    .update({ onboarding_status: 'correction_requested', correction_note: note })
    .eq('id', tenantId).select().single()
  if (error) throw error
  await logProfileStatusChange(data.id, data.property_id, existing?.onboarding_status ?? null, 'correction_requested', 'owner', note)
  return data
}

export async function getSubmittedOnboardingProfiles(propertyId: string) {
  const sb = createClient()
  const { data, error } = await sb
    .from('tenants')
    .select('*')
    .eq('property_id', propertyId)
    .eq('status', 'invited')
    .in('onboarding_status', ['submitted', 'resubmitted'])
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

// ─── Profile Update Requests (Phase 8.7) ─────────────────────────────────────
// Once a tenant is approved, they can no longer edit their profile directly
// (business rule from Phase 8). Every request — pending, approved, or
// rejected — is kept permanently in profile_update_requests as the audit
// trail; nothing here is ever deleted, only status-updated.
//
// Only "personal" fields are ever eligible — the same set the Onboarding
// Wizard already collects as text. This whitelist is enforced again at
// approval time (not just trusted from the request payload), so an
// owner-controlled field (room, bed, rent, deposit, joining date,
// agreement dates, tenant status) can never be smuggled through this path.
export const PROFILE_UPDATE_EDITABLE_FIELDS = [
  'name', 'email', 'aadhaar_number', 'permanent_address', 'emergency_contact_name', 'emergency_contact',
] as const

export async function addProfileUpdateRequest(
  tenant: Pick<Tenant, 'id' | 'property_id'>,
  requestedChanges: Record<string, any>,
  reason?: string
) {
  const sb = createClient()
  const changes = Object.fromEntries(
    Object.entries(requestedChanges).filter(([key]) => (PROFILE_UPDATE_EDITABLE_FIELDS as readonly string[]).includes(key))
  )
  if (Object.keys(changes).length === 0) throw new Error('No changes to submit')
  const { data, error } = await sb.from('profile_update_requests').insert({
    tenant_id: tenant.id, property_id: tenant.property_id,
    requested_changes: changes, reason: reason?.trim() || null,
  }).select().single()
  if (error) throw error
  return data
}

export async function getTenantProfileUpdateRequests(tenantId: string) {
  const sb = createClient()
  const { data, error } = await sb
    .from('profile_update_requests')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function getPendingProfileUpdateRequests(propertyId: string) {
  const sb = createClient()
  const { data, error } = await sb
    .from('profile_update_requests')
    .select('*, tenant:tenants(name, phone, email, aadhaar_number, permanent_address, emergency_contact_name, emergency_contact, auth_user_id, room:rooms(room_number))')
    .eq('property_id', propertyId)
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
  if (error) throw error
  return data
}

export async function decideProfileUpdateRequest(requestId: string, decision: 'approved' | 'rejected', ownerNote?: string) {
  const sb = createClient()
  const { data: { user: me } } = await sb.auth.getUser()
  const { data: request, error: fetchError } = await sb.from('profile_update_requests').select('*').eq('id', requestId).single()
  if (fetchError) throw fetchError
  if (request.status !== 'pending') throw new Error('This profile update request has already been decided')

  if (decision === 'approved') {
    const changes = Object.fromEntries(
      Object.entries(request.requested_changes ?? {}).filter(([key]) => (PROFILE_UPDATE_EDITABLE_FIELDS as readonly string[]).includes(key))
    )
    const { error: tenantError } = await sb.from('tenants').update(changes).eq('id', request.tenant_id)
    if (tenantError) throw tenantError
  }

  const { data, error } = await sb.from('profile_update_requests')
    .update({ status: decision, owner_note: ownerNote?.trim() || null, decided_at: new Date().toISOString(), decided_by: me?.id })
    .eq('id', requestId).eq('status', 'pending').select().single()
  if (error) throw new Error(error.code === 'PGRST116' ? 'This profile update request has already been decided' : error.message)
  return data
}

export async function approveTenant(tenantId: string, password: string, tenantData: Tenant) {
  const sb = createClient()
  const normalizedPhone = tenantData.phone.replace(/\D/g, '')
  if (normalizedPhone.length < 10) throw new Error('This tenant\'s phone number looks invalid — edit it before approving')

  // Create auth login for the approved QR-submitted tenant via SQL RPC
  const { data: newUserId, error: authError } = await sb.rpc('create_tenant_login', {
    p_phone: normalizedPhone,
    p_password: password,
    p_full_name: tenantData.name,
  })
  if (authError) throw authError

  const { data: { user: me } } = await sb.auth.getUser()
  const { data, error } = await sb.from('tenants').update({
    status: 'active',
    phone: normalizedPhone,
    auth_user_id: newUserId,
    approved_by: me?.id,
    approved_at: new Date().toISOString(),
  }).eq('id', tenantId).select().single()
  if (error) throw error

  // If the tenant self-declared rent already paid at joining (QR flow),
  // record it as a real approved payment now so "pending rent" reflects
  // only what's actually still owed.
  if (tenantData.rent_paid_at_joining && tenantData.rent_paid_at_joining > 0) {
    const forMonth = new Date(data.joining_date).toLocaleString('en-IN', { month: 'long', year: 'numeric' })
    const { error: payError } = await sb.from('payments').insert({
      tenant_id: data.id,
      property_id: data.property_id,
      type: 'rent',
      for_month: forMonth,
      total_due: data.monthly_rent,
      amount_received: tenantData.rent_paid_at_joining,
      method: 'cash',
      approval_status: 'approved',
      submitted_by_tenant: false,
      payment_date: data.joining_date,
    })
    if (payError) throw payError
  }

  return data
}

export async function updateTenant(id: string, updates: Partial<Tenant>) {
  const sb = createClient()
  const { data, error } = await sb.from('tenants').update(updates).eq('id', id).select().single()
  if (error) throw error
  return data
}

export async function setTenantLeaving(tenantId: string, leavingDate: string) {
  const sb = createClient()
  const { data, error } = await sb.from('tenants')
    .update({ leaving_date: leavingDate, status: 'leaving' })
    .eq('id', tenantId).select().single()
  if (error) throw error
  return data
}

export async function markTenantLeft(tenantId: string) {
  const sb = createClient()
  const { data, error } = await sb.from('tenants')
    .update({ status: 'left' })
    .eq('id', tenantId).select().single()
  if (error) throw error
  return data
}

export async function deleteTenant(id: string) {
  const sb = createClient()
  const { error } = await sb.from('tenants').delete().eq('id', id)
  if (error) throw error
}

// ─── Collectors ───────────────────────────────────────────────────────────────
export async function getCollectors(propertyId: string) {
  const sb = createClient()
  const { data, error } = await sb.from('collectors').select('*').eq('property_id', propertyId)
  if (error) throw error
  return data
}

export async function addCollector(propertyId: string, name: string) {
  const sb = createClient()
  const { data, error } = await sb.from('collectors').insert({ property_id: propertyId, name }).select().single()
  if (error) throw error
  return data
}

export async function deleteCollector(id: string) {
  const sb = createClient()
  const { error } = await sb.from('collectors').delete().eq('id', id)
  if (error) throw error
}

// ─── Payments ─────────────────────────────────────────────────────────────────
export async function getPayments(propertyId: string) {
  const sb = createClient()
  const { data, error } = await sb
    .from('payments')
    .select('*, tenant:tenants(name, phone, room:rooms(room_number)), collector:collectors(name)')
    .eq('property_id', propertyId)
    .order('payment_date', { ascending: false })
  if (error) throw error
  return data
}

export async function getPaymentsForTenant(tenantId: string) {
  const sb = createClient()
  const { data, error } = await sb
    .from('payments')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('payment_date', { ascending: false })
  if (error) throw error
  return data
}

export async function getPendingApprovals(propertyId: string) {
  const sb = createClient()
  const { data, error } = await sb
    .from('payments')
    .select('*, tenant:tenants(name, phone, room:rooms(room_number))')
    .eq('property_id', propertyId)
    .eq('approval_status', 'pending_approval')
    .order('created_at', { ascending: true })
  if (error) throw error
  return data
}

// ─── Notifications (computed from existing data — no separate table) ─────────
export async function getOwnerNotifications(propertyIds: string[]) {
  const sb = createClient()
  if (propertyIds.length === 0) return []

  const [payments, tenants, complaints] = await Promise.all([
    sb.from('payments').select('id, amount_received, for_month, created_at, tenant:tenants(name)').in('property_id', propertyIds).eq('approval_status', 'pending_approval').order('created_at', { ascending: false }),
    sb.from('tenants').select('id, name, created_at').in('property_id', propertyIds).eq('status', 'pending_approval').order('created_at', { ascending: false }),
    sb.from('complaints').select('id, issue_type, created_at, tenant:tenants(name)').in('property_id', propertyIds).neq('status', 'resolved').order('created_at', { ascending: false }),
  ])

  const items = [
    ...(payments.data ?? []).map((p: any) => ({
      id: `payment-${p.id}`, type: 'payment', link: '/approvals',
      title: `Payment claim from ${p.tenant?.name ?? 'a tenant'}`,
      subtitle: `${formatINR(p.amount_received)} for ${p.for_month ?? 'a bill'}`,
      createdAt: p.created_at,
    })),
    ...(tenants.data ?? []).map((t: any) => ({
      id: `tenant-${t.id}`, type: 'tenant', link: '/approvals',
      title: `New tenant request: ${t.name}`,
      subtitle: 'Waiting for your approval',
      createdAt: t.created_at,
    })),
    ...(complaints.data ?? []).map((c: any) => ({
      id: `complaint-${c.id}`, type: 'complaint', link: '/complaints',
      title: `Complaint: ${c.issue_type}`,
      subtitle: c.tenant?.name ? `From ${c.tenant.name}` : 'Open complaint',
      createdAt: c.created_at,
    })),
  ]

  return items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
}

export async function recordPayment(input: RecordPaymentInput) {
  const sb = createClient()
  const { data, error } = await sb.from('payments').insert({
    ...input,
    approval_status: 'approved',
    submitted_by_tenant: false,
  }).select().single()
  if (error) throw error
  return data
}

export async function approvePayment(paymentId: string) {
  const sb = createClient()
  // .eq('approval_status','pending_approval') is a state-transition guard —
  // a payment that's already been decided (approved or rejected) cannot be
  // re-decided; this also matches the RLS policy's own precondition, so a
  // stale/double-click request fails cleanly here instead of silently
  // re-applying downstream effects (like the deposit_paid sync below).
  const { data, error } = await sb
    .from('payments').update({ approval_status: 'approved' })
    .eq('id', paymentId).eq('approval_status', 'pending_approval').select().single()
  if (error) throw new Error(error.code === 'PGRST116' ? 'This payment has already been decided' : error.message)

  // A tenant-submitted *deposit* payment being approved must flow through
  // to tenants.deposit_paid — otherwise the tenant keeps showing the
  // deposit as outstanding even after the owner approves it. (Rent/advance
  // payments need no extra step: monthlyLedger/getRentOutstandingSummary
  // already derive directly from the payments table.)
  if (data.type === 'deposit') {
    const { data: tenantRow, error: tErr } = await sb.from('tenants').select('deposit_paid').eq('id', data.tenant_id).single()
    if (!tErr && tenantRow) {
      const { error: updErr } = await sb.from('tenants')
        .update({ deposit_paid: (tenantRow.deposit_paid ?? 0) + data.amount_received })
        .eq('id', data.tenant_id)
      if (updErr) throw updErr
    }
  }
  return data
}

export async function rejectPayment(paymentId: string) {
  const sb = createClient()
  const { data, error } = await sb
    .from('payments').update({ approval_status: 'rejected' })
    .eq('id', paymentId).eq('approval_status', 'pending_approval').select().single()
  if (error) throw new Error(error.code === 'PGRST116' ? 'This payment has already been decided' : error.message)
  return data
}

// ─── Expenses ─────────────────────────────────────────────────────────────────
export async function getExpenses(propertyId: string) {
  const sb = createClient()
  const { data, error } = await sb
    .from('expenses')
    .select('*')
    .eq('property_id', propertyId)
    .order('expense_date', { ascending: false })
  if (error) throw error
  return data
}

export async function addExpense(input: AddExpenseInput) {
  const sb = createClient()
  const { data, error } = await sb.from('expenses').insert(input).select().single()
  if (error) throw error
  return data
}

export async function deleteExpense(id: string) {
  const sb = createClient()
  const { error } = await sb.from('expenses').delete().eq('id', id)
  if (error) throw error
}

// ─── Complaints ───────────────────────────────────────────────────────────────
export async function getComplaints(propertyId: string) {
  const sb = createClient()
  const { data, error } = await sb
    .from('complaints')
    .select('*, tenant:tenants(name, auth_user_id), room:rooms(room_number)')
    .eq('property_id', propertyId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function addComplaint(input: AddComplaintInput) {
  const sb = createClient()
  const { data, error } = await sb.from('complaints').insert(input).select().single()
  if (error) throw error
  return data
}

export async function resolveComplaint(id: string) {
  const sb = createClient()
  const { data, error } = await sb
    .from('complaints')
    .update({ status: 'resolved', resolved_at: new Date().toISOString() })
    .eq('id', id).select().single()
  if (error) throw error
  return data
}

export async function updateComplaint(id: string, updates: { status?: string; assigned_to?: string }) {
  const sb = createClient()
  const { data, error } = await sb.from('complaints').update(updates).eq('id', id).select().single()
  if (error) throw error
  return data
}

// ─── Leave Requests ──────────────────────────────────────────────────────────
export async function getLeaveRequests(propertyId: string) {
  const sb = createClient()
  const { data, error } = await sb
    .from('leave_requests')
    .select('*, tenant:tenants(name, phone, auth_user_id, room:rooms(room_number))')
    .eq('property_id', propertyId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function getTenantLeaveRequests(tenantId: string) {
  const sb = createClient()
  const { data, error } = await sb
    .from('leave_requests')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function addLeaveRequest(input: AddLeaveRequestInput) {
  const sb = createClient()
  const { data, error } = await sb.from('leave_requests').insert(input).select().single()
  if (error) throw error
  return data
}

export async function decideLeaveRequest(id: string, status: 'approved' | 'rejected', ownerNote?: string) {
  const sb = createClient()
  // .eq('status','pending') guards against re-deciding an already-decided
  // request (approved→rejected, rejected→approved, duplicate approval) —
  // matches the RLS policy's own precondition.
  const { data, error } = await sb
    .from('leave_requests')
    .update({ status, owner_note: ownerNote || null, decided_at: new Date().toISOString() })
    .eq('id', id).eq('status', 'pending').select().single()
  if (error) throw new Error(error.code === 'PGRST116' ? 'This leave request has already been decided' : error.message)
  return data
}

// ─── Rent Extension Requests ─────────────────────────────────────────────────
export async function getRentExtensionRequests(propertyId: string) {
  const sb = createClient()
  const { data, error } = await sb
    .from('rent_extension_requests')
    .select('*, tenant:tenants(name, phone, auth_user_id, room:rooms(room_number))')
    .eq('property_id', propertyId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function getTenantRentExtensionRequests(tenantId: string) {
  const sb = createClient()
  const { data, error } = await sb
    .from('rent_extension_requests')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function addRentExtensionRequest(input: AddRentExtensionRequestInput) {
  const sb = createClient()
  const { data, error } = await sb.from('rent_extension_requests').insert(input).select().single()
  if (error) throw error
  return data
}

export async function decideRentExtensionRequest(id: string, status: 'approved' | 'rejected', ownerNote?: string) {
  const sb = createClient()
  const { data, error } = await sb
    .from('rent_extension_requests')
    .update({ status, owner_note: ownerNote || null, decided_at: new Date().toISOString() })
    .eq('id', id).eq('status', 'pending').select().single()
  if (error) throw new Error(error.code === 'PGRST116' ? 'This extension request has already been decided' : error.message)
  return data
}

// ─── Move-Out Requests ───────────────────────────────────────────────────────
export async function getMoveOutRequests(propertyId: string) {
  const sb = createClient()
  const { data, error } = await sb
    .from('move_out_requests')
    .select('*, tenant:tenants(name, phone, auth_user_id, room:rooms(room_number))')
    .eq('property_id', propertyId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function getTenantMoveOutRequests(tenantId: string) {
  const sb = createClient()
  const { data, error } = await sb
    .from('move_out_requests')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function addMoveOutRequest(input: AddMoveOutRequestInput) {
  const sb = createClient()
  const { data, error } = await sb.from('move_out_requests').insert(input).select().single()
  if (error) throw error
  return data
}

export async function decideMoveOutRequest(id: string, status: 'approved' | 'rejected', ownerNote?: string) {
  const sb = createClient()
  const { data, error } = await sb
    .from('move_out_requests')
    .update({ status, owner_note: ownerNote || null, decided_at: new Date().toISOString() })
    .eq('id', id).eq('status', 'pending').select().single()
  if (error) throw new Error(error.code === 'PGRST116' ? 'This move-out request has already been decided' : error.message)
  // Reuse the existing tenant offboarding flow — an approved move-out
  // request simply puts the tenant on notice with their requested date,
  // same as the owner manually setting notice on the Tenants page.
  if (status === 'approved') {
    await setTenantLeaving(data.tenant_id, data.requested_date)
  }
  return data
}

// ─── Move-Out Checklist ──────────────────────────────────────────────────────
export async function getMoveOutChecklist(tenantId: string) {
  const sb = createClient()
  const { data, error } = await sb.from('move_out_checklists').select('*').eq('tenant_id', tenantId).maybeSingle()
  if (error) throw error
  return data
}

export async function startMoveOutChecklist(tenantId: string, propertyId: string, moveOutRequestId?: string) {
  const sb = createClient()
  const existing = await getMoveOutChecklist(tenantId)
  if (existing) return existing
  const items = DEFAULT_MOVE_OUT_CHECKLIST.map(label => ({ label, checked: false, checked_at: null }))
  const { data, error } = await sb
    .from('move_out_checklists')
    .insert({ tenant_id: tenantId, property_id: propertyId, move_out_request_id: moveOutRequestId || null, items })
    .select().single()
  if (error) throw error
  return data
}

export async function updateMoveOutChecklist(id: string, items: { label: string; checked: boolean; checked_at: string | null }[]) {
  const sb = createClient()
  const completed = items.length > 0 && items.every(i => i.checked)
  const { data, error } = await sb
    .from('move_out_checklists')
    .update({ items, completed, updated_at: new Date().toISOString() })
    .eq('id', id).select().single()
  if (error) throw error
  return data
}

// ─── Financial history (real revenue/expenses by month, for charts) ──────────
export async function getFinancialHistory(propertyIds: string[], monthsBack = 6) {
  const sb = createClient()
  if (propertyIds.length === 0) return []

  const since = new Date()
  since.setMonth(since.getMonth() - (monthsBack - 1))
  since.setDate(1)
  const sinceStr = since.toISOString().slice(0, 10)

  const [paymentsRes, expensesRes] = await Promise.all([
    sb.from('payments').select('amount_received, payment_date')
      .in('property_id', propertyIds).gte('payment_date', sinceStr)
      .eq('approval_status', 'approved').eq('type', 'rent'),
    sb.from('expenses').select('amount, expense_date')
      .in('property_id', propertyIds).gte('expense_date', sinceStr),
  ])
  if (paymentsRes.error) throw paymentsRes.error
  if (expensesRes.error) throw expensesRes.error

  const buckets: { key: string; month: string; revenue: number; expenses: number }[] = []
  const cursor = new Date(since)
  for (let i = 0; i < monthsBack; i++) {
    buckets.push({ key: `${cursor.getFullYear()}-${cursor.getMonth()}`, month: cursor.toLocaleString('en-IN', { month: 'short' }), revenue: 0, expenses: 0 })
    cursor.setMonth(cursor.getMonth() + 1)
  }
  const bucketMap = new Map(buckets.map(b => [b.key, b]))

  ;(paymentsRes.data ?? []).forEach(p => {
    const d = new Date(p.payment_date)
    const b = bucketMap.get(`${d.getFullYear()}-${d.getMonth()}`)
    if (b) b.revenue += p.amount_received
  })
  ;(expensesRes.data ?? []).forEach(e => {
    const d = new Date(e.expense_date)
    const b = bucketMap.get(`${d.getFullYear()}-${d.getMonth()}`)
    if (b) b.expenses += e.amount
  })

  return buckets.map(b => ({ month: b.month, revenue: b.revenue, expenses: b.expenses, profit: b.revenue - b.expenses }))
}

// ─── Dashboard stats (single property) ───────────────────────────────────────
export async function getDashboardStats(propertyId: string) {
  const sb = createClient()
  const [rooms, tenants, payments, complaints, approvedLeaves] = await Promise.all([
    sb.from('rooms').select('*').eq('property_id', propertyId),
    sb.from('tenants').select('*').eq('property_id', propertyId).eq('status', 'active'),
    sb.from('payments').select('*').eq('property_id', propertyId),
    sb.from('complaints').select('*').eq('property_id', propertyId).neq('status', 'resolved'),
    sb.from('leave_requests').select('tenant_id, start_date, end_date').eq('property_id', propertyId).eq('status', 'approved'),
  ])

  const totalBeds = (rooms.data ?? []).reduce((s, r) => s + r.total_beds, 0)
  const occupiedBeds = (tenants.data ?? []).filter(t => t.room_id).length
  const today = new Date()
  const thisMonth = today.toLocaleString('en-IN', { month: 'long', year: 'numeric' })
  const lastMonthDate = new Date(today.getFullYear(), today.getMonth() - 1, 1)
  const lastMonth = lastMonthDate.toLocaleString('en-IN', { month: 'long', year: 'numeric' })
  const monthlyRevenue = (payments.data ?? [])
    .filter(p => p.for_month === thisMonth && p.approval_status === 'approved' && p.type === 'rent')
    .reduce((s, p) => s + p.amount_received, 0)
  const lastMonthRevenue = (payments.data ?? [])
    .filter(p => p.for_month === lastMonth && p.approval_status === 'approved' && p.type === 'rent')
    .reduce((s, p) => s + p.amount_received, 0)
  // null (not 0%/−100%) when there's no prior-month data to compare against —
  // a brand-new property shouldn't show a misleading "down 100%".
  const revenueTrendPct = lastMonthRevenue > 0 ? Math.round(((monthlyRevenue - lastMonthRevenue) / lastMonthRevenue) * 100) : null
  // Full oldest-first ledger per tenant (shared with the Tenant Portal via
  // getRentOutstandingSummary) — not just this month's gap. A tenant who
  // skipped an old month but has since paid a later one must still surface
  // here; the owner's headline "pending rent" figure must never disagree
  // with what the tenant's own portal shows them as owing.
  const pendingRent = (tenants.data ?? [])
    .reduce((sum, t) => {
      const tenantPayments = (payments.data ?? []).filter(p => p.tenant_id === t.id)
      const tenantLeaves = (approvedLeaves.data ?? []).filter(l => l.tenant_id === t.id)
      const { totalPending } = getRentOutstandingSummary(t, tenantPayments, tenantLeaves)
      return sum + totalPending
    }, 0)
  // Collection rate = what's been collected vs. what was expected this
  // month (collected + still pending) for active tenants.
  const expectedRent = monthlyRevenue + pendingRent
  const collectionRatePct = expectedRent > 0 ? Math.round((monthlyRevenue / expectedRent) * 100) : 100
  const avgRentPerBed = occupiedBeds > 0
    ? Math.round((tenants.data ?? []).reduce((s, t) => s + (t.room_id ? t.monthly_rent : 0), 0) / occupiedBeds)
    : 0
  const activeRentSum = (tenants.data ?? []).reduce((s, t) => s + (t.room_id ? t.monthly_rent : 0), 0)

  return {
    totalRooms: rooms.data?.length ?? 0,
    totalBeds,
    occupiedBeds,
    vacantBeds: totalBeds - occupiedBeds,
    monthlyRevenue,
    pendingRent,
    openComplaints: complaints.data?.length ?? 0,
    totalTenants: tenants.data?.length ?? 0,
    lastMonthRevenue,
    activeRentSum,
    revenueTrendPct,
    collectionRatePct,
    avgRentPerBed,
  }
}

// ─── Electricity bills ─────────────────────────────────────────────────────
export async function getElectricityBills(propertyId: string) {
  const sb = createClient()
  const { data, error } = await sb
    .from('utility_bills')
    .select('*, tenant:tenants(name, phone, room:rooms(room_number))')
    .eq('property_id', propertyId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function getBillsForTenant(tenantId: string) {
  const sb = createClient()
  const { data, error } = await sb
    .from('utility_bills')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function addElectricityBill(input: {
  property_id: string; tenant_id: string
  for_month: string; amount: number; due_date?: string
}) {
  const sb = createClient()
  const { data, error } = await sb.from('utility_bills').insert(input).select().single()
  if (error) throw error
  return data
}

export async function deleteElectricityBill(id: string) {
  const sb = createClient()
  const { error } = await sb.from('utility_bills').delete().eq('id', id)
  if (error) throw error
}

// Owner confirms a bill is paid (whether self-collected or tenant-claimed)
export async function approveBill(id: string) {
  const sb = createClient()
  const { data, error } = await sb.from('utility_bills')
    .update({ status: 'paid', paid_date: new Date().toISOString().slice(0, 10) })
    .eq('id', id).select().single()
  if (error) throw error
  return data
}

// Tenant self-reports a bill as paid — owner must still confirm via approveBill
export async function claimBillPaid(id: string, note?: string) {
  const sb = createClient()
  const { data, error } = await sb.from('utility_bills')
    .update({ status: 'pending_approval', submitted_by_tenant: true, tenant_note: note ?? null })
    .eq('id', id).select().single()
  if (error) throw error
  return data
}

// ─── Rental agreements ────────────────────────────────────────────────────────
export function generateAgreementNumber() {
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase()
  return `AGR-${Date.now().toString(36).toUpperCase()}-${rand}`
}

export async function createAgreement(input: Partial<import('@/types').Agreement> & {
  tenant_id: string; property_id: string; start_date: string; end_date: string
  monthly_rent: number
}) {
  const sb = createClient()
  const { data, error } = await sb.from('agreements').insert({
    agreement_number: generateAgreementNumber(),
    status: 'signed',
    tenant_accepted: true,
    tenant_signed_at: new Date().toISOString(),
    ...input,
  }).select().single()
  if (error) throw error
  return data
}

export async function getAgreementForTenant(tenantId: string) {
  const sb = createClient()
  const { data, error } = await sb.from('agreements').select('*').eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(1).maybeSingle()
  if (error) throw error
  return data
}

export async function getAgreementsForProperty(propertyId: string) {
  const sb = createClient()
  const { data, error } = await sb.from('agreements').select('*, tenant:tenants(name, phone, auth_user_id, room:rooms(room_number))').eq('property_id', propertyId).order('created_at', { ascending: false })
  if (error) throw error
  return data
}

// Renews an agreement — creates a fresh row carrying over the old one's
// terms (reusing createAgreement, not duplicating its logic) and marks
// the old one 'expired' so it's no longer the tenant's "current" one.
export async function renewAgreement(old: import('@/types').Agreement, newStartDate: string, newEndDate: string, monthlyRent?: number) {
  const sb = createClient()
  await sb.from('agreements').update({ status: 'expired' }).eq('id', old.id)
  return createAgreement({
    tenant_id: old.tenant_id, property_id: old.property_id, room_id: old.room_id,
    start_date: newStartDate, end_date: newEndDate, duration_months: old.duration_months,
    rent_cycle: old.rent_cycle, monthly_rent: monthlyRent ?? old.monthly_rent,
    security_deposit: old.security_deposit, electricity_charges: old.electricity_charges,
    maintenance_charges: old.maintenance_charges, other_charges: old.other_charges,
    other_charges_note: old.other_charges_note, due_day: old.due_day,
    late_fee_policy: old.late_fee_policy, terms_version: old.terms_version,
    status: 'active',
  })
}

// Owner counter-signs the agreement, activating it (typically done alongside tenant approval)
export async function ownerSignAgreement(agreementId: string, ownerName: string, signatureDataUrl?: string) {
  const sb = createClient()
  const { data, error } = await sb.from('agreements').update({
    status: 'active',
    owner_signed_name: ownerName,
    owner_signature: signatureDataUrl ?? null,
    owner_signed_at: new Date().toISOString(),
  }).eq('id', agreementId).select().single()
  if (error) throw error
  return data
}

// ─── Messages (tenant ↔ owner) ─────────────────────────────────────────────────
export async function getMessagesForTenant(tenantId: string) {
  const sb = createClient()
  const { data, error } = await sb.from('messages').select('*').eq('tenant_id', tenantId).order('created_at', { ascending: true })
  if (error) throw error
  return data
}

export async function sendMessageAsTenant(tenantId: string, propertyId: string, body: string) {
  const sb = createClient()
  const { data, error } = await sb.from('messages').insert({
    tenant_id: tenantId, property_id: propertyId, sender: 'tenant', body, read_by_owner: false, read_by_tenant: true,
  }).select().single()
  if (error) throw error
  return data
}

export async function sendMessageAsOwner(tenantId: string, propertyId: string, body: string) {
  const sb = createClient()
  const { data, error } = await sb.from('messages').insert({
    tenant_id: tenantId, property_id: propertyId, sender: 'owner', body, read_by_owner: true, read_by_tenant: false,
  }).select().single()
  if (error) throw error
  return data
}

export async function markMessagesReadByTenant(tenantId: string) {
  const sb = createClient()
  await sb.from('messages').update({ read_by_tenant: true }).eq('tenant_id', tenantId).eq('read_by_tenant', false)
}

export async function markMessagesReadByOwner(tenantId: string) {
  const sb = createClient()
  await sb.from('messages').update({ read_by_owner: true }).eq('tenant_id', tenantId).eq('read_by_owner', false)
}

export async function getUnreadMessageCountsForProperty(propertyIds: string[]) {
  const sb = createClient()
  if (propertyIds.length === 0) return []
  const { data, error } = await sb.from('messages').select('tenant_id').in('property_id', propertyIds).eq('sender', 'tenant').eq('read_by_owner', false)
  if (error) throw error
  return data ?? []
}

// ─── Notice Board ──────────────────────────────────────────────────────────
const PRIORITY_RANK: Record<string, number> = { Urgent: 0, Important: 1, Normal: 2 }

export async function getNoticesForProperty(propertyId: string) {
  const sb = createClient()
  const { data, error } = await sb.from('notices').select('*').eq('property_id', propertyId).order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function addNotice(input: {
  property_id: string; title: string; description: string
  category: string; priority: string; publish_date: string
  expiry_date?: string | null; attachment_url?: string | null; attachment_name?: string | null
  created_by?: string
}) {
  const sb = createClient()
  const { data, error } = await sb.from('notices').insert(input).select().single()
  if (error) throw error
  return data
}

export async function deleteNotice(id: string) {
  const sb = createClient()
  const { error } = await sb.from('notices').delete().eq('id', id)
  if (error) throw error
}

// Active, unread notices for a tenant — sorted Urgent → Important → Normal,
// most recent first within each priority tier.
export async function getUnreadNoticesForTenant(tenantId: string, propertyId: string) {
  const sb = createClient()
  const today = new Date().toISOString().slice(0, 10)

  const [noticesRes, readsRes] = await Promise.all([
    sb.from('notices').select('*').eq('property_id', propertyId)
      .lte('publish_date', today)
      .or(`expiry_date.is.null,expiry_date.gte.${today}`),
    sb.from('notice_reads').select('notice_id').eq('tenant_id', tenantId),
  ])
  if (noticesRes.error) throw noticesRes.error
  if (readsRes.error) throw readsRes.error

  const readIds = new Set((readsRes.data ?? []).map(r => r.notice_id))
  return (noticesRes.data ?? [])
    .filter(n => !readIds.has(n.id))
    .sort((a, b) => {
      const p = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]
      return p !== 0 ? p : new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })
}

export async function getAllActiveNoticesForTenant(tenantId: string, propertyId: string) {
  const sb = createClient()
  const today = new Date().toISOString().slice(0, 10)

  const [noticesRes, readsRes] = await Promise.all([
    sb.from('notices').select('*').eq('property_id', propertyId)
      .lte('publish_date', today)
      .or(`expiry_date.is.null,expiry_date.gte.${today}`)
      .order('created_at', { ascending: false }),
    sb.from('notice_reads').select('notice_id').eq('tenant_id', tenantId),
  ])
  if (noticesRes.error) throw noticesRes.error
  if (readsRes.error) throw readsRes.error

  const readIds = new Set((readsRes.data ?? []).map(r => r.notice_id))
  return (noticesRes.data ?? []).map(n => ({ ...n, isRead: readIds.has(n.id) }))
}

export async function markNoticeRead(noticeId: string, tenantId: string) {
  const sb = createClient()
  const { error } = await sb.from('notice_reads').upsert({ notice_id: noticeId, tenant_id: tenantId }, { onConflict: 'notice_id,tenant_id' })
  if (error) throw error
}

// ─── Co-tenant birthdays (Tenant Portal widget) ───────────────────────────────
export async function getCotenantBirthdays(propertyId: string) {
  const sb = createClient()
  const { data, error } = await sb.rpc('get_cotenant_birthdays', { p_property_id: propertyId })
  if (error) throw error
  return (data ?? []) as { name: string; date_of_birth: string }[]
}
// ─── Visitor Management (Phase 5.8) ──────────────────────────────────────────
export async function getVisitors(propertyId: string, includeArchived = false) {
  const sb = createClient()
  let query = sb
    .from('visitors')
    .select('*, tenant:tenants(name, room:rooms(room_number))')
    .eq('property_id', propertyId)
  if (!includeArchived) query = query.is('archived_at', null)
  const { data, error } = await query.order('check_in_time', { ascending: false })
  if (error) throw error
  return data
}

export async function checkInVisitor(input: AddVisitorInput) {
  const sb = createClient()
  const { data, error } = await sb.from('visitors').insert(input).select().single()
  if (error) throw error
  return data
}

export async function checkOutVisitor(id: string) {
  const sb = createClient()
  const { data, error } = await sb
    .from('visitors')
    .update({ check_out_time: new Date().toISOString() })
    .eq('id', id).select().single()
  if (error) throw error
  return data
}

export async function deleteVisitor(id: string) {
  const sb = createClient()
  const { error } = await sb.from('visitors').delete().eq('id', id)
  if (error) throw error
}

// ─── Parcel Management (Phase 5.9) ───────────────────────────────────────────
export async function getParcels(propertyId: string, includeArchived = false) {
  const sb = createClient()
  let query = sb
    .from('parcels')
    .select('*, tenant:tenants(name, auth_user_id, room:rooms(room_number))')
    .eq('property_id', propertyId)
  if (!includeArchived) query = query.is('archived_at', null)
  const { data, error } = await query.order('received_at', { ascending: false })
  if (error) throw error
  return data
}

export async function logParcel(input: AddParcelInput) {
  const sb = createClient()
  const { data, error } = await sb.from('parcels').insert(input)
    .select('*, tenant:tenants(name, auth_user_id, room:rooms(room_number))').single()
  if (error) throw error
  return data
}

export async function collectParcel(id: string) {
  const sb = createClient()
  const { data, error } = await sb
    .from('parcels')
    .update({ collected_at: new Date().toISOString() })
    .eq('id', id).select().single()
  if (error) throw error
  return data
}

export async function deleteParcel(id: string) {
  const sb = createClient()
  const { error } = await sb.from('parcels').delete().eq('id', id)
  if (error) throw error
}

// ─── Waiting List (Phase 5.10) ───────────────────────────────────────────────
export async function getWaitingList(propertyId: string, includeArchived = false) {
  const sb = createClient()
  let query = sb
    .from('waiting_list')
    .select('*')
    .eq('property_id', propertyId)
  if (!includeArchived) query = query.is('archived_at', null)
  const { data, error } = await query.order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function addWaitingListEntry(input: AddWaitingListInput) {
  const sb = createClient()
  const { data, error } = await sb.from('waiting_list').insert(input).select().single()
  if (error) throw error
  return data
}

export async function updateWaitingListStatus(id: string, status: 'waiting' | 'contacted' | 'converted' | 'expired') {
  const sb = createClient()
  const { data, error } = await sb.from('waiting_list').update({ status }).eq('id', id).select().single()
  if (error) throw error
  return data
}

export async function deleteWaitingListEntry(id: string) {
  const sb = createClient()
  const { error } = await sb.from('waiting_list').delete().eq('id', id)
  if (error) throw error
}

// ─── Archive & Restore (Phase 5.15) ──────────────────────────────────────────
// Soft-hide clutter (old visitors, collected parcels, converted/expired waiting-
// list entries) without deleting it — an archived row can always be restored.
export async function archiveVisitor(id: string) {
  const sb = createClient()
  const { error } = await sb.from('visitors').update({ archived_at: new Date().toISOString() }).eq('id', id)
  if (error) throw error
}
export async function restoreVisitor(id: string) {
  const sb = createClient()
  const { error } = await sb.from('visitors').update({ archived_at: null }).eq('id', id)
  if (error) throw error
}

export async function archiveParcel(id: string) {
  const sb = createClient()
  const { error } = await sb.from('parcels').update({ archived_at: new Date().toISOString() }).eq('id', id)
  if (error) throw error
}
export async function restoreParcel(id: string) {
  const sb = createClient()
  const { error } = await sb.from('parcels').update({ archived_at: null }).eq('id', id)
  if (error) throw error
}

export async function archiveWaitingListEntry(id: string) {
  const sb = createClient()
  const { error } = await sb.from('waiting_list').update({ archived_at: new Date().toISOString() }).eq('id', id)
  if (error) throw error
}
export async function restoreWaitingListEntry(id: string) {
  const sb = createClient()
  const { error } = await sb.from('waiting_list').update({ archived_at: null }).eq('id', id)
  if (error) throw error
}

// ─── Room Change Workflow (Phase 5.11) ───────────────────────────────────────
// The move itself reuses the existing updateTenant() below — this only adds
// the audit-log half (room_changes) plus a helper that does both together.
export async function getRoomChanges(propertyId: string) {
  const sb = createClient()
  const { data, error } = await sb
    .from('room_changes')
    .select('*, tenant:tenants(name), from_room:rooms!room_changes_from_room_id_fkey(room_number), to_room:rooms!room_changes_to_room_id_fkey(room_number)')
    .eq('property_id', propertyId)
    .order('changed_at', { ascending: false })
  if (error) throw error
  return data
}

export async function changeTenantRoom(input: AddRoomChangeInput) {
  const sb = createClient()
  // Reuses the existing generic tenant-update function — no new tenant mutation logic.
  await updateTenant(input.tenant_id, { room_id: input.to_room_id, bed_label: null } as Partial<Tenant>)
  const { data, error } = await sb.from('room_changes').insert({
    property_id: input.property_id,
    tenant_id: input.tenant_id,
    from_room_id: input.from_room_id,
    to_room_id: input.to_room_id,
    reason: input.reason,
    changed_by: input.changed_by,
  }).select().single()
  if (error) throw error
  return data
}

// ─── Automatic Backup (Phase 5.13) ───────────────────────────────────────────
// The cron job itself lives server-side in src/app/api/cron/automatic-backup —
// these are just the owner-facing reads/writes for the settings UI.
export async function getBackupSettings(ownerId: string) {
  const sb = createClient()
  const { data, error } = await sb.from('backup_settings').select('*').eq('owner_id', ownerId).maybeSingle()
  if (error) throw error
  return data
}

export async function upsertBackupSettings(ownerId: string, updates: { enabled?: boolean; frequency?: 'daily' | 'weekly'; retention_count?: number }) {
  const sb = createClient()
  const { data, error } = await sb
    .from('backup_settings')
    .upsert({ owner_id: ownerId, ...updates, updated_at: new Date().toISOString() }, { onConflict: 'owner_id' })
    .select().single()
  if (error) throw error
  return data
}

export async function getBackupRuns(ownerId: string, limit = 20) {
  const sb = createClient()
  const { data, error } = await sb
    .from('backup_runs')
    .select('*')
    .eq('owner_id', ownerId)
    .order('started_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data
}

export async function getBackupFileUrl(filePath: string) {
  const sb = createClient()
  const { data, error } = await sb.storage.from('automatic-backups').createSignedUrl(filePath, 60)
  if (error) throw error
  return data.signedUrl
}

// ─── Communication Engine (Phase 9.1) ──────────────────────────────────────
// New, additive query functions only — nothing above this line was changed.

const SYSTEM_DEFAULT_TEMPLATES: { name: string; category: import('@/types').TemplateCategory; body: string }[] = [
  { name: 'Rent Reminder', category: 'rent_reminder', body: 'Hi {{Tenant Name}}, this is a reminder that your rent of {{Amount}} for {{Property Name}} is due on {{Due Date}}. Please pay at your earliest convenience. — {{Owner Name}}' },
  { name: 'Rent Due Today', category: 'due_today', body: 'Hi {{Tenant Name}}, your rent of {{Amount}} for {{Property Name}}, Room {{Room Number}} is due today. Thank you! — {{Owner Name}}' },
  { name: 'Overdue Rent', category: 'overdue', body: 'Hi {{Tenant Name}}, your rent payment of {{Amount}} for {{Property Name}} is now overdue. Please clear it soon to avoid late fees. — {{Owner Name}}' },
  { name: 'Welcome Message', category: 'welcome', body: "Welcome to {{Property Name}}, {{Tenant Name}}! You've been assigned Room {{Room Number}}. Reach out anytime if you need anything. — {{Owner Name}}" },
]

export async function getMessageTemplates(propertyId: string) {
  const sb = createClient()
  const { data, error } = await sb.from('message_templates').select('*').eq('property_id', propertyId).order('created_at', { ascending: true })
  if (error) throw error
  return data
}

/** Seeds the standard template set for a property the first time its Inbox > Templates tab is opened. No-ops if templates already exist. */
export async function ensureDefaultTemplates(propertyId: string) {
  const sb = createClient()
  const { count, error: countError } = await sb.from('message_templates').select('id', { count: 'exact', head: true }).eq('property_id', propertyId)
  if (countError) throw countError
  if (count && count > 0) return
  const { error } = await sb.from('message_templates').insert(
    SYSTEM_DEFAULT_TEMPLATES.map(t => ({ property_id: propertyId, name: t.name, category: t.category, channel: 'whatsapp', body: t.body, is_system_default: true }))
  )
  if (error) throw error
}

export async function addMessageTemplate(input: { property_id: string; name: string; category: import('@/types').TemplateCategory; channel: import('@/types').CommunicationChannel; body: string }) {
  const sb = createClient()
  const { data, error } = await sb.from('message_templates').insert(input).select().single()
  if (error) throw error
  return data
}

export async function updateMessageTemplate(id: string, input: Partial<{ name: string; category: import('@/types').TemplateCategory; body: string }>) {
  const sb = createClient()
  const { data, error } = await sb.from('message_templates').update({ ...input, updated_at: new Date().toISOString() }).eq('id', id).select().single()
  if (error) throw error
  return data
}

export async function deleteMessageTemplate(id: string) {
  const sb = createClient()
  const { error } = await sb.from('message_templates').delete().eq('id', id)
  if (error) throw error
}

export async function getCommunicationQueue(propertyId: string) {
  const sb = createClient()
  const { data, error } = await sb
    .from('communication_queue')
    .select('*, tenant:tenants(name, phone)')
    .eq('property_id', propertyId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function addToCommunicationQueue(input: {
  property_id: string; tenant_id?: string | null; template_id?: string | null
  channel: import('@/types').CommunicationChannel; rendered_message: string; scheduled_for?: string
}) {
  const sb = createClient()
  const { data, error } = await sb.from('communication_queue').insert(input).select().single()
  if (error) throw error
  return data
}

export async function updateQueueItemStatus(id: string, status: import('@/types').CommunicationStatus, extra?: { last_error?: string }) {
  const sb = createClient()
  const patch: Record<string, unknown> = { status }
  if (status === 'sent') patch.sent_at = new Date().toISOString()
  if (status === 'failed') {
    // Read-then-write to increment attempt_count — this table sees owner-
    // triggered writes only (a handful of clicks per session, never a hot
    // path), so the extra round trip is a fine tradeoff for not needing a
    // Postgres RPC just to do `attempt_count = attempt_count + 1`.
    const { data: current } = await sb.from('communication_queue').select('attempt_count').eq('id', id).single()
    patch.attempt_count = (current?.attempt_count ?? 0) + 1
    if (extra?.last_error) patch.last_error = extra.last_error
  }
  const { error } = await sb.from('communication_queue').update(patch).eq('id', id)
  if (error) throw error
}

export async function getCommunicationLogs(propertyId: string, limit = 100) {
  const sb = createClient()
  const { data, error } = await sb
    .from('communication_logs')
    .select('*, tenant:tenants(name, phone)')
    .eq('property_id', propertyId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data
}

export async function addCommunicationLog(input: {
  property_id: string; tenant_id?: string | null; template_id?: string | null
  channel: import('@/types').CommunicationChannel; rendered_message: string
  status?: import('@/types').CommunicationStatus; sent_by?: string
}) {
  const sb = createClient()
  const { data, error } = await sb.from('communication_logs').insert(input).select().single()
  if (error) throw error
  return data
}

export async function getCommunicationSettings(propertyId: string) {
  const sb = createClient()
  const { data, error } = await sb.from('communication_settings').select('*').eq('property_id', propertyId).maybeSingle()
  if (error) throw error
  return data
}

export async function upsertCommunicationSettings(propertyId: string, input: Partial<{ whatsapp_enabled: boolean; push_enabled: boolean; default_reminder_days: number }>) {
  const sb = createClient()
  const { data, error } = await sb
    .from('communication_settings')
    .upsert({ property_id: propertyId, ...input, updated_at: new Date().toISOString() }, { onConflict: 'property_id' })
    .select()
    .single()
  if (error) throw error
  return data
}
