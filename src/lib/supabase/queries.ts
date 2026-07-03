import { createClient } from '@/lib/supabase/client'
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
  return data
}

export async function updateTenant(id: string, updates: Partial<Tenant>) {
  const sb = createClient()
  const { data, error } = await sb.from('tenants').update(updates).eq('id', id).select().single()
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
    .select('*, tenant:tenants(name), room:rooms(room_number)')
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
      return sum + Math.max(0, t.monthly_rent - paidThisMonth)
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
