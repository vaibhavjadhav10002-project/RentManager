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
  const { password, ...tenantData } = input

  // 1. Create auth account for tenant using admin-style invite
  const { data: { user }, error: authError } = await sb.auth.signUp({
    email: `${input.phone}@pgmanager.local`,   // synthetic email using phone
    password,
    options: {
      data: { full_name: input.name, role: 'tenant' },
    },
  })
  if (authError) throw authError

  // 2. Insert tenant row linked to the new auth user
  const { data, error } = await sb.from('tenants').insert({
    ...tenantData,
    auth_user_id: user?.id ?? null,
    status: 'active',
    submitted_via: 'owner_added',
  }).select().single()
  if (error) throw error
  return data
}

export async function approveTenant(tenantId: string, password: string, tenantData: Tenant) {
  const sb = createClient()

  // Create auth login for the approved QR-submitted tenant
  const { data: { user }, error: authError } = await sb.auth.signUp({
    email: `${tenantData.phone}@pgmanager.local`,
    password,
    options: { data: { full_name: tenantData.name, role: 'tenant' } },
  })
  if (authError) throw authError

  const { data: { user: me } } = await sb.auth.getUser()
  const { data, error } = await sb.from('tenants').update({
    status: 'active',
    auth_user_id: user?.id,
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
  const occupiedBeds = (tenants.data ?? []).length
  const thisMonth = new Date().toLocaleString('en-IN', { month: 'long', year: 'numeric' })
  const monthlyRevenue = (payments.data ?? [])
    .filter(p => p.for_month === thisMonth && p.approval_status === 'approved')
    .reduce((s, p) => s + p.amount_received, 0)
  const pendingRent = (tenants.data ?? [])
    .filter(t => {
      const paid = (payments.data ?? []).some(
        p => p.tenant_id === t.id && p.for_month === thisMonth && p.approval_status === 'approved'
      )
      return !paid
    })
    .reduce((s, t) => s + t.monthly_rent, 0)

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
