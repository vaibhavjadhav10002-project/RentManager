// Realistic Explore Mode sample data — column shapes match the real
// production schema (supabase/01_schema_reset.sql etc.) exactly, so every
// existing query function and UI component receives data shaped the way
// it already expects. Nothing here ever touches Supabase; this is the
// entire dataset Explore Mode reads from and writes (ephemerally) to.

const EXPLORE_OWNER_ID = 'explore-owner-0000-0000-000000000001'

const P1 = 'explore-prop-0000-0000-000000000001'
const P2 = 'explore-prop-0000-0000-000000000002'

export const EXPLORE_PROFILE = {
  id: EXPLORE_OWNER_ID,
  role: 'pg_owner' as const,
  full_name: 'Explorer',
  phone: '9800000000',
  email: 'explore@rentivo.app',
  is_active: true,
  must_change_password: false,
  created_at: '2025-01-01T00:00:00Z',
}

export const properties = [
  {
    id: P1, owner_id: EXPLORE_OWNER_ID, name: 'Sunrise PG for Men',
    address: '14th Cross, Indiranagar', city: 'Bengaluru', state: 'Karnataka',
    qr_slug: 'sunrise-pg-explore', bank_account_name: 'Explorer Properties',
    bank_account_number: '000000000000', bank_ifsc: 'HDFC0000001',
    upi_id: 'sunrisepg@upi', created_at: '2025-01-10T00:00:00Z',
  },
  {
    id: P2, owner_id: EXPLORE_OWNER_ID, name: 'Maple Residency (Co-ed)',
    address: 'Sector 5, HSR Layout', city: 'Bengaluru', state: 'Karnataka',
    qr_slug: 'maple-residency-explore', bank_account_name: 'Explorer Properties',
    bank_account_number: '000000000001', bank_ifsc: 'HDFC0000001',
    upi_id: 'mapleresidency@upi', created_at: '2025-02-15T00:00:00Z',
  },
]

export const rooms = [
  { id: 'room-1', property_id: P1, room_number: '101', floor: 1, sharing_type: 'double', total_beds: 2, monthly_rent: 9500, notes: null, photo_urls: [], created_at: '2025-01-10T00:00:00Z' },
  { id: 'room-2', property_id: P1, room_number: '102', floor: 1, sharing_type: 'triple', total_beds: 3, monthly_rent: 8000, notes: null, photo_urls: [], created_at: '2025-01-10T00:00:00Z' },
  { id: 'room-3', property_id: P1, room_number: '201', floor: 2, sharing_type: 'single', total_beds: 1, monthly_rent: 14000, notes: 'Attached bathroom', photo_urls: [], created_at: '2025-01-10T00:00:00Z' },
  { id: 'room-4', property_id: P1, room_number: '202', floor: 2, sharing_type: 'double', total_beds: 2, monthly_rent: 9500, notes: null, photo_urls: [], created_at: '2025-01-10T00:00:00Z' },
  { id: 'room-5', property_id: P2, room_number: 'A1', floor: 1, sharing_type: 'double', total_beds: 2, monthly_rent: 11000, notes: null, photo_urls: [], created_at: '2025-02-15T00:00:00Z' },
  { id: 'room-6', property_id: P2, room_number: 'A2', floor: 1, sharing_type: 'single', total_beds: 1, monthly_rent: 16000, notes: null, photo_urls: [], created_at: '2025-02-15T00:00:00Z' },
  { id: 'room-7', property_id: P2, room_number: 'B1', floor: 2, sharing_type: 'triple', total_beds: 3, monthly_rent: 9000, notes: null, photo_urls: [], created_at: '2025-02-15T00:00:00Z' },
]

const T = (id: string, overrides: Record<string, unknown>) => ({
  id, auth_user_id: null, bed_label: null, email: null,
  emergency_contact: null, photo_url: null,
  aadhaar_url: null, aadhaar_status: 'verified', pan_url: null, pan_status: 'verified',
  agreement_url: null, notice_period_days: 30, leaving_date: null,
  deposit_paid: overrides.deposit_amount, deposit_refunded: 0,
  deposit_refund_date: null, deposit_deduction_notes: null,
  rent_paid_at_joining: 0, status: 'active', submitted_via: 'owner_added',
  created_at: '2025-03-01T00:00:00Z',
  ...overrides,
})

export const tenants = [
  T('tenant-1', { property_id: P1, room_id: 'room-1', name: 'Rahul Sharma', phone: '9811100001', joining_date: '2025-03-01', monthly_rent: 9500, deposit_amount: 9500 }),
  T('tenant-2', { property_id: P1, room_id: 'room-1', name: 'Aman Verma', phone: '9811100002', joining_date: '2025-03-05', monthly_rent: 9500, deposit_amount: 9500 }),
  T('tenant-3', { property_id: P1, room_id: 'room-2', name: 'Saurav Singh', phone: '9811100003', joining_date: '2025-04-01', monthly_rent: 8000, deposit_amount: 8000 }),
  T('tenant-4', { property_id: P1, room_id: 'room-3', name: 'Vikas Yadav', phone: '9811100004', joining_date: '2025-02-20', monthly_rent: 14000, deposit_amount: 14000 }),
  T('tenant-5', { property_id: P1, room_id: 'room-4', name: 'Karan Mehta', phone: '9811100005', joining_date: '2025-05-10', monthly_rent: 9500, deposit_amount: 9500 }),
  T('tenant-6', { property_id: P2, room_id: 'room-5', name: 'Priya Nair', phone: '9811100006', joining_date: '2025-03-15', monthly_rent: 11000, deposit_amount: 11000 }),
  T('tenant-7', { property_id: P2, room_id: 'room-5', name: 'Sneha Iyer', phone: '9811100007', joining_date: '2025-03-20', monthly_rent: 11000, deposit_amount: 11000 }),
  T('tenant-8', { property_id: P2, room_id: 'room-6', name: 'Ananya Rao', phone: '9811100008', joining_date: '2025-02-25', monthly_rent: 16000, deposit_amount: 16000 }),
  T('tenant-9', { property_id: P2, room_id: 'room-7', name: 'Devika Menon', phone: '9811100009', joining_date: '2025-06-01', monthly_rent: 9000, deposit_amount: 9000 }),
  T('tenant-10', { property_id: P2, room_id: 'room-7', name: 'Ritika Bose', phone: '9811100010', joining_date: '2025-06-05', monthly_rent: 9000, deposit_amount: 9000 }),
]

function monthsBack(n: number) {
  const d = new Date()
  d.setDate(1)
  d.setMonth(d.getMonth() - n)
  return d.toLocaleString('en-IN', { month: 'long', year: 'numeric' })
}

let paymentSeq = 1
function pay(tenantId: string, propertyId: string, rent: number, monthsAgo: number, opts: Partial<{ received: number; status: string }> = {}) {
  const id = `payment-${paymentSeq++}`
  const received = opts.received ?? rent
  return {
    id, tenant_id: tenantId, property_id: propertyId, type: 'rent',
    for_month: monthsBack(monthsAgo), total_due: rent, amount_received: received,
    method: 'upi', collected_by: null,
    approval_status: opts.status ?? 'approved', submitted_by_tenant: false,
    tenant_note: null, screenshot_url: null,
    payment_date: `2026-0${Math.max(1, 7 - monthsAgo)}-05`,
    created_at: '2026-01-01T00:00:00Z',
  }
}

export const payments = [
  pay('tenant-1', P1, 9500, 0), pay('tenant-1', P1, 9500, 1), pay('tenant-1', P1, 9500, 2),
  pay('tenant-2', P1, 9500, 0, { received: 5000, status: 'approved' }), pay('tenant-2', P1, 9500, 1),
  pay('tenant-3', P1, 8000, 0), pay('tenant-3', P1, 8000, 1),
  pay('tenant-4', P1, 14000, 0), pay('tenant-4', P1, 14000, 1), pay('tenant-4', P1, 14000, 2),
  pay('tenant-5', P1, 9500, 0, { status: 'pending' }),
  pay('tenant-6', P2, 11000, 0), pay('tenant-6', P2, 11000, 1),
  pay('tenant-7', P2, 11000, 0),
  pay('tenant-8', P2, 16000, 0), pay('tenant-8', P2, 16000, 1), pay('tenant-8', P2, 16000, 2),
  pay('tenant-9', P2, 9000, 0),
  pay('tenant-10', P2, 9000, 0, { status: 'pending' }),
]

export const complaints = [
  { id: 'complaint-1', property_id: P1, tenant_id: 'tenant-1', room_id: 'room-1', issue_type: 'Electrical', description: 'Fan not working in the room.', priority: 'medium', status: 'open', assigned_to: null, attachment_url: null, resolved_at: null, created_at: '2026-07-20T09:00:00Z' },
  { id: 'complaint-2', property_id: P1, tenant_id: 'tenant-3', room_id: 'room-2', issue_type: 'Plumbing', description: 'Bathroom tap leaking.', priority: 'high', status: 'in_progress', assigned_to: 'Ramesh (plumber)', attachment_url: null, resolved_at: null, created_at: '2026-07-22T14:00:00Z' },
  { id: 'complaint-3', property_id: P2, tenant_id: 'tenant-8', room_id: 'room-6', issue_type: 'Wi-Fi', description: 'Internet very slow in the evenings.', priority: 'low', status: 'resolved', assigned_to: 'ISP support', attachment_url: null, resolved_at: '2026-07-18T18:00:00Z', created_at: '2026-07-15T11:00:00Z' },
  { id: 'complaint-4', property_id: P2, tenant_id: 'tenant-9', room_id: 'room-7', issue_type: 'Cleaning', description: 'Common washroom needs cleaning.', priority: 'medium', status: 'open', assigned_to: null, attachment_url: null, resolved_at: null, created_at: '2026-07-27T08:00:00Z' },
]

export const notices = [
  { id: 'notice-1', property_id: P1, title: 'Water supply maintenance', body: 'Water will be unavailable on 30th July from 10am-2pm for tank cleaning.', created_at: '2026-07-25T10:00:00Z' },
  { id: 'notice-2', property_id: P1, title: 'Rent due reminder', body: 'Please clear this month\'s rent by the 5th to avoid late fees.', created_at: '2026-07-01T09:00:00Z' },
  { id: 'notice-3', property_id: P2, title: 'New washing machine installed', body: 'A new washing machine is now available on the 1st floor.', created_at: '2026-07-10T12:00:00Z' },
]

export const expenses = [
  { id: 'expense-1', property_id: P1, category: 'Electricity', amount: 4200, notes: 'July bill', expense_date: '2026-07-05', created_at: '2026-07-05T00:00:00Z' },
  { id: 'expense-2', property_id: P1, category: 'Maintenance', amount: 1500, notes: 'Plumber visit', expense_date: '2026-07-22', created_at: '2026-07-22T00:00:00Z' },
  { id: 'expense-3', property_id: P2, category: 'Wi-Fi', amount: 1999, notes: 'Monthly broadband', expense_date: '2026-07-01', created_at: '2026-07-01T00:00:00Z' },
]

export const visitors = [
  { id: 'visitor-1', property_id: P1, tenant_id: 'tenant-1', visitor_name: 'Suresh Sharma', purpose: 'Family visit', check_in: '2026-07-27T17:00:00Z', check_out: null, created_at: '2026-07-27T17:00:00Z' },
]

export const parcels = [
  { id: 'parcel-1', property_id: P1, tenant_id: 'tenant-2', courier_name: 'Amazon', received_at: '2026-07-28T13:00:00Z', collected_at: null, created_at: '2026-07-28T13:00:00Z' },
  { id: 'parcel-2', property_id: P2, tenant_id: 'tenant-8', courier_name: 'Flipkart', received_at: '2026-07-26T11:00:00Z', collected_at: '2026-07-27T09:00:00Z', created_at: '2026-07-26T11:00:00Z' },
]

export const EXPLORE_TABLES: Record<string, Record<string, any>[]> = {
  profiles: [EXPLORE_PROFILE],
  properties, rooms, tenants, payments, complaints, notices, expenses, visitors, parcels,
}
