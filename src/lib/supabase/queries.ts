import { createClient } from '@/lib/supabase/client'
import { formatINR } from '@/lib/utils'
import type {
  AddRoomInput, AddTenantInput, RecordPaymentInput,
  AddExpenseInput, AddComplaintInput, Property, Tenant
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
  const { data, error } = await sb
    .from('payments').update({ approval_status: 'approved' })
    .eq('id', paymentId).select().single()
  if (error) throw error
  return data
}

export async function rejectPayment(paymentId: string) {
  const sb = createClient()
  const { data, error } = await sb
    .from('payments').update({ approval_status: 'rejected' })
    .eq('id', paymentId).select().single()
  if (error) throw error
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
  const [rooms, tenants, payments, complaints] = await Promise.all([
    sb.from('rooms').select('*').eq('property_id', propertyId),
    sb.from('tenants').select('*').eq('property_id', propertyId).eq('status', 'active'),
    sb.from('payments').select('*').eq('property_id', propertyId),
    sb.from('complaints').select('*').eq('property_id', propertyId).neq('status', 'resolved'),
  ])

  const totalBeds = (rooms.data ?? []).reduce((s, r) => s + r.total_beds, 0)
  const occupiedBeds = (tenants.data ?? []).filter(t => t.room_id).length
  const thisMonth = new Date().toLocaleString('en-IN', { month: 'long', year: 'numeric' })
  const monthlyRevenue = (payments.data ?? [])
    .filter(p => p.for_month === thisMonth && p.approval_status === 'approved' && p.type === 'rent')
    .reduce((s, p) => s + p.amount_received, 0)
  const pendingRent = (tenants.data ?? [])
    .reduce((sum, t) => {
      const paidThisMonth = (payments.data ?? [])
        .filter(p => p.tenant_id === t.id && p.for_month === thisMonth && p.approval_status === 'approved' && p.type === 'rent')
        .reduce((s, p) => s + p.amount_received, 0)
      const advanceBalance = (payments.data ?? [])
        .filter(p => p.tenant_id === t.id && p.type === 'advance' && p.approval_status === 'approved')
        .reduce((s, p) => s + p.amount_received, 0)
      return sum + Math.max(0, t.monthly_rent - paidThisMonth - advanceBalance)
    }, 0)

  return {
    totalRooms: rooms.data?.length ?? 0,
    totalBeds,
    occupiedBeds,
    vacantBeds: totalBeds - occupiedBeds,
    monthlyRevenue,
    pendingRent,
    openComplaints: complaints.data?.length ?? 0,
    totalTenants: tenants.data?.length ?? 0,
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
  const { data, error } = await sb.from('agreements').select('*, tenant:tenants(name, phone)').eq('property_id', propertyId).order('created_at', { ascending: false })
  if (error) throw error
  return data
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
