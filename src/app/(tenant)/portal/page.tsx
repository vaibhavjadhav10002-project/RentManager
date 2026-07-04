'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatINR, formatDate, upiPaymentLink } from '@/lib/utils'
import { generateAgreementPDF, generateReceiptPDF } from '@/lib/pdf'
import { getBillsForTenant, claimBillPaid } from '@/lib/supabase/queries'
import { toast } from 'sonner'
import {
  LogOut, Loader2, CheckCircle, Clock, FileText, MessageCircle, Lock, Download,
  AlertCircle, LayoutDashboard, Home, ShieldCheck, User as UserIcon, Bell,
  ChevronRight, Phone, Headset, ChevronDown,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import ForcePasswordChangeModal from '@/components/shared/ForcePasswordChangeModal'

type Tab = 'dashboard' | 'rent' | 'deposit' | 'documents' | 'complaints' | 'profile'

export default function TenantPortal() {
  const router = useRouter()
  const [tenant, setTenant] = useState<any>(null)
  const [payments, setPayments] = useState<any[]>([])
  const [complaints, setComplaints] = useState<any[]>([])
  const [bills, setBills] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('dashboard')
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const [payModal, setPayModal] = useState(false)
  const [pwModal, setPwModal] = useState(false)
  const [complaintModal, setComplaintModal] = useState(false)
  const [method, setMethod] = useState('upi')
  const [note, setNote] = useState('')
  const [pwForm, setPwForm] = useState({ newPw: '', confirm: '' })
  const [complaint, setComplaint] = useState({ issue_type: 'Plumbing', description: '', priority: 'medium' })
  const [saving, setSaving] = useState(false)
  const [claimed, setClaimed] = useState(false)
  const [depositClaimed, setDepositClaimed] = useState(false)
  const [mustChangePw, setMustChangePw] = useState(false)

  useEffect(() => {
    async function load() {
      const sb = createClient()
      const { data: { user } } = await sb.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: prof } = await sb.from('profiles').select('must_change_password').eq('id', user.id).single()
      setMustChangePw(!!prof?.must_change_password)

      const { data: t } = await sb.from('tenants').select('*, room:rooms(*), property:properties(name, address, upi_id)').eq('auth_user_id', user.id).single()
      if (!t) { router.push('/login'); return }
      setTenant(t)

      const { data: p } = await sb.from('payments').select('*').eq('tenant_id', t.id).order('payment_date', { ascending: false })
      setPayments(p ?? [])

      const { data: c } = await sb.from('complaints').select('*').eq('tenant_id', t.id).order('created_at', { ascending: false })
      setComplaints(c ?? [])

      getBillsForTenant(t.id).then(setBills).catch(() => setBills([]))

      setLoading(false)
    }
    load()
  }, [])

  const thisMonth = new Date().toLocaleString('en-IN', { month: 'long', year: 'numeric' })
  const thisMonthPaid = payments.some(p => p.for_month === thisMonth && p.approval_status === 'approved')
  const nextDueDate = new Date(new Date().getFullYear(), new Date().getMonth(), new Date(tenant?.joining_date ?? Date.now()).getDate())
  const daysLeft = tenant ? Math.ceil((nextDueDate.getTime() - Date.now()) / 86400000) : 0
  const depositDue = tenant ? tenant.deposit_amount - tenant.deposit_paid : 0
  const openComplaints = complaints.filter(c => c.status !== 'resolved').length

  const monthlyLedger = (() => {
    if (!tenant?.joining_date) return []
    const months: { label: string; status: 'paid' | 'pending' | 'partial'; amount: number; paidOn?: string }[] = []
    const start = new Date(tenant.joining_date)
    const cursor = new Date(start.getFullYear(), start.getMonth(), 1)
    const today = new Date()
    const end = tenant.leaving_date && new Date(tenant.leaving_date) < today ? new Date(tenant.leaving_date) : today
    while (cursor <= end) {
      const label = cursor.toLocaleString('en-IN', { month: 'long', year: 'numeric' })
      const monthPayments = payments.filter(p => p.for_month === label && p.type === 'rent' && p.approval_status === 'approved')
      const totalPaid = monthPayments.reduce((s, p) => s + p.amount_received, 0)
      const status = totalPaid >= tenant.monthly_rent ? 'paid' : totalPaid > 0 ? 'partial' : 'pending'
      months.push({ label, status, amount: tenant.monthly_rent, paidOn: monthPayments[0]?.payment_date })
      cursor.setMonth(cursor.getMonth() + 1)
    }
    return months.reverse()
  })()

  const [payKind, setPayKind] = useState<'rent' | 'deposit'>('rent')
  function payAmountFor(kind: 'rent' | 'deposit') {
    if (kind === 'rent') {
      const paidThisMonth = payments.filter(p => p.for_month === thisMonth && p.type === 'rent' && p.approval_status === 'approved').reduce((s, p) => s + p.amount_received, 0)
      return Math.max(0, (tenant?.monthly_rent ?? 0) - paidThisMonth)
    }
    return Math.max(0, (tenant?.deposit_amount ?? 0) - (tenant?.deposit_paid ?? 0))
  }
  const payAmount = payAmountFor(payKind)

  function openPay(kind: 'rent' | 'deposit') {
    setPayKind(kind)
    setPayModal(true)
  }

  async function submitPayment() {
    setSaving(true)
    try {
      const sb = createClient()
      await sb.from('payments').insert({
        tenant_id: tenant.id, property_id: tenant.property_id,
        type: payKind, for_month: payKind === 'rent' ? thisMonth : null,
        total_due: payAmount, amount_received: payAmount,
        method, tenant_note: note, submitted_by_tenant: true,
        approval_status: 'pending_approval', payment_date: new Date().toISOString().slice(0, 10),
      })
      toast.success('Marked as paid — waiting for owner approval')
      if (payKind === 'rent') setClaimed(true)
      else setDepositClaimed(true)
      setPayModal(false)
    } catch (e: any) { toast.error(e.message) }
    setSaving(false)
  }

  async function handlePayBill(billId: string) {
    try {
      await claimBillPaid(billId)
      setBills(prev => prev.map(b => b.id === billId ? { ...b, status: 'pending_approval' } : b))
      toast.success('Marked as paid — waiting for owner approval')
    } catch (e: any) { toast.error(e.message) }
  }

  async function submitComplaint() {
    setSaving(true)
    try {
      const sb = createClient()
      const { data, error } = await sb.from('complaints').insert({ property_id: tenant.property_id, tenant_id: tenant.id, room_id: tenant.room_id, ...complaint }).select().single()
      if (error) throw error
      setComplaints(prev => [data, ...prev])
      toast.success('Complaint submitted!'); setComplaintModal(false)
      setComplaint({ issue_type: 'Plumbing', description: '', priority: 'medium' })
    } catch (e: any) { toast.error(e.message) }
    setSaving(false)
  }

  async function changePassword() {
    if (pwForm.newPw !== pwForm.confirm) { toast.error('Passwords do not match'); return }
    if (pwForm.newPw.length < 6) { toast.error('Min 6 characters'); return }
    const sb = createClient()
    const { error } = await sb.auth.updateUser({ password: pwForm.newPw })
    if (error) { toast.error(error.message); return }
    if (tenant?.auth_user_id) await sb.from('profiles').update({ must_change_password: false }).eq('id', tenant.auth_user_id)
    setMustChangePw(false)
    toast.success('Password updated!'); setPwModal(false); setPwForm({ newPw: '', confirm: '' })
  }

  function downloadAgreement() {
    generateAgreementPDF({
      tenantName: tenant.name, tenantPhone: tenant.phone,
      propertyName: tenant.property?.name ?? 'PG', propertyAddress: tenant.property?.address,
      roomNumber: tenant.room?.room_number, bedLabel: tenant.bed_label,
      joiningDate: tenant.joining_date, monthlyRent: tenant.monthly_rent,
      depositAmount: tenant.deposit_amount, noticePeriodDays: tenant.notice_period_days,
    })
    toast.success('Agreement downloaded')
  }

  function downloadReceipt(p: any) {
    generateReceiptPDF({
      tenantName: tenant.name, propertyName: tenant.property?.name ?? 'PG',
      roomNumber: tenant.room?.room_number, forMonth: p.for_month ?? undefined, type: p.type,
      totalDue: p.total_due, amountReceived: p.amount_received, method: p.method,
      paymentDate: p.payment_date, approvalStatus: p.approval_status,
      receiptNo: p.id.slice(0, 8).toUpperCase(),
    })
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
    </div>
  )

  const initials = (tenant.name || '?').split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()

  const navItems: { key: Tab; label: string; icon: any }[] = [
    { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { key: 'rent', label: 'Rent', icon: Home },
    { key: 'deposit', label: 'Deposit', icon: ShieldCheck },
    { key: 'documents', label: 'Documents', icon: FileText },
    { key: 'complaints', label: 'Complaints', icon: MessageCircle },
    { key: 'profile', label: 'Profile', icon: UserIcon },
  ]

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {mustChangePw && (
        <ForcePasswordChangeModal userId={tenant.auth_user_id} onDone={() => setMustChangePw(false)} />
      )}

      {/* Sidebar */}
      <aside className={`fixed lg:static inset-y-0 left-0 w-60 bg-white border-r border-gray-100 flex flex-col z-40 transition-transform ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="px-5 h-16 flex items-center gap-2.5 border-b border-gray-100">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-600 to-green-600 flex items-center justify-center text-white font-extrabold text-sm">PG</div>
          <div>
            <div className="text-sm font-extrabold text-gray-900">PG MANAGER</div>
            <div className="text-[11px] text-gray-400">Tenant Portal</div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => { setTab(key); setSidebarOpen(false) }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition ${
                tab === key ? 'bg-emerald-50 text-emerald-700' : 'text-gray-500 hover:bg-gray-50'
              }`}>
              <Icon className="w-4 h-4" /> {label}
            </button>
          ))}
          <div className="h-px bg-gray-100 my-3" />
          <button onClick={() => setPwModal(true)}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-gray-500 hover:bg-gray-50 transition">
            <Lock className="w-4 h-4" /> Change Password
          </button>
          <button onClick={async () => { const sb = createClient(); await sb.auth.signOut(); router.push('/login') }}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-red-500 hover:bg-red-50 transition">
            <LogOut className="w-4 h-4" /> Logout
          </button>
        </nav>

        <div className="p-3">
          <div className="bg-emerald-50 rounded-2xl p-4">
            <div className="w-9 h-9 rounded-xl bg-white flex items-center justify-center mb-2 shadow-sm">
              <Headset className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-xs font-bold text-gray-900">Need Help?</div>
            <div className="text-[11px] text-gray-500 mb-2">Contact your PG owner</div>
            {tenant.property && (
              <a href={`tel:`} className="flex items-center justify-center gap-1.5 text-xs font-semibold text-emerald-700 bg-white rounded-xl py-1.5 shadow-sm hover:bg-emerald-50 transition">
                <Phone className="w-3.5 h-3.5" /> Contact Owner
              </a>
            )}
          </div>
        </div>
      </aside>

      {sidebarOpen && <div onClick={() => setSidebarOpen(false)} className="fixed inset-0 bg-black/30 z-30 lg:hidden" />}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-white border-b border-gray-100 px-4 lg:px-8 h-16 flex items-center justify-between sticky top-0 z-20">
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden text-gray-500">☰</button>
          <div className="hidden lg:block" />
          <div className="flex items-center gap-4">
            <button aria-label="Notifications" className="relative p-2 rounded-xl bg-gray-50 hover:bg-gray-100 transition text-gray-500">
              <Bell className="w-4 h-4" />
              {openComplaints > 0 && <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />}
            </button>
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-600 to-green-600 flex items-center justify-center text-white font-bold text-xs">
                {initials}
              </div>
              <div className="hidden sm:block">
                <div className="text-sm font-bold text-gray-900 leading-tight">{tenant.name}</div>
                <div className="text-xs text-gray-400 leading-tight">Room {tenant.room?.room_number ?? '—'}</div>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-8 max-w-6xl w-full mx-auto">

          {tab === 'dashboard' && (
            <div className="space-y-5">
              <div>
                <h1 className="text-xl font-extrabold text-gray-900">Hello, {tenant.name.split(' ')[0]} 👋</h1>
                <p className="text-sm text-gray-500">Here's an overview of your stay.</p>
              </div>

              {/* Overview cards */}
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center mb-3"><Home className="w-4 h-4 text-emerald-600" /></div>
                  <div className="text-xs font-semibold text-gray-500">Next Rent Due</div>
                  <div className="text-2xl font-extrabold text-gray-900 mt-0.5">{formatINR(tenant.monthly_rent)}</div>
                  {thisMonthPaid ? (
                    <span className="inline-block mt-2 text-xs font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700">Paid</span>
                  ) : (
                    <>
                      <div className={`text-xs mt-1 ${daysLeft <= 3 ? 'text-red-500' : 'text-gray-400'}`}>Due on {formatDate(nextDueDate.toISOString())}</div>
                      <span className={`inline-block mt-1.5 text-xs font-bold px-2 py-0.5 rounded-full ${daysLeft <= 3 ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}`}>
                        {daysLeft > 0 ? `${daysLeft} Days Left` : 'Overdue'}
                      </span>
                    </>
                  )}
                </div>

                <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                  <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center mb-3"><ShieldCheck className="w-4 h-4 text-purple-600" /></div>
                  <div className="text-xs font-semibold text-gray-500">Deposit</div>
                  <div className="text-2xl font-extrabold text-gray-900 mt-0.5">{formatINR(tenant.deposit_amount)}</div>
                  <span className={`inline-block mt-2 text-xs font-bold px-2 py-0.5 rounded-full ${depositDue <= 0 ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                    {depositDue <= 0 ? 'Paid' : `${formatINR(depositDue)} pending`}
                  </span>
                  <div className="text-xs text-gray-400 mt-1">Refundable</div>
                </div>

                <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                  <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center mb-3"><MessageCircle className="w-4 h-4 text-red-500" /></div>
                  <div className="text-xs font-semibold text-gray-500">Open Complaints</div>
                  <div className="text-2xl font-extrabold text-gray-900 mt-0.5">{openComplaints}</div>
                  <button onClick={() => setTab('complaints')} className="text-xs font-semibold text-red-500 mt-2 flex items-center gap-1 hover:underline">
                    View Details <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {/* Amount Due — actionable pending items, each with its own Pay Now */}
              {(!thisMonthPaid || (depositDue > 0 && !depositClaimed) || bills.some(b => b.status === 'pending')) && tenant.status === 'active' && (
                <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <div className="font-bold text-sm text-gray-900">Amount Due</div>
                    <div className="text-sm font-extrabold text-red-600">
                      Total: {formatINR((!thisMonthPaid ? payAmountFor('rent') : 0) + (depositDue > 0 && !depositClaimed ? depositDue : 0) + bills.filter(b => b.status === 'pending').reduce((s, b) => s + b.amount, 0))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    {!thisMonthPaid && (
                      <div className="flex items-center justify-between gap-3 p-3 bg-gray-50 rounded-xl">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0"><Home className="w-4 h-4 text-emerald-600" /></div>
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-gray-900">Rent — {thisMonth}</div>
                            <div className="text-xs text-gray-400">Due {formatDate(nextDueDate.toISOString())} · {formatINR(payAmountFor('rent'))}</div>
                          </div>
                        </div>
                        <button onClick={() => openPay('rent')} className="flex-shrink-0 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition">Pay Now</button>
                      </div>
                    )}
                    {bills.filter(b => b.status === 'pending').map(b => (
                      <div key={b.id} className="flex items-center justify-between gap-3 p-3 bg-gray-50 rounded-xl">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-9 h-9 rounded-xl bg-yellow-100 flex items-center justify-center flex-shrink-0"><AlertCircle className="w-4 h-4 text-yellow-600" /></div>
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-gray-900">{b.bill_type} — {b.for_month}</div>
                            <div className="text-xs text-gray-400">{b.due_date ? `Due ${formatDate(b.due_date)} · ` : ''}{formatINR(b.amount)}</div>
                          </div>
                        </div>
                        <div className="flex gap-1.5 flex-shrink-0">
                          {tenant.property?.upi_id && (
                            <a href={upiPaymentLink(tenant.property.upi_id, tenant.property.name ?? 'PG Owner', b.amount, `${b.bill_type} - ${tenant.name}`)}
                              className="px-3 py-1.5 bg-purple-100 hover:bg-purple-200 text-purple-700 rounded-xl text-xs font-bold transition">UPI</a>
                          )}
                          <button onClick={() => handlePayBill(b.id)} className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition">Pay Now</button>
                        </div>
                      </div>
                    ))}
                    {depositDue > 0 && !depositClaimed && (
                      <div className="flex items-center justify-between gap-3 p-3 bg-gray-50 rounded-xl">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-9 h-9 rounded-xl bg-purple-100 flex items-center justify-center flex-shrink-0"><ShieldCheck className="w-4 h-4 text-purple-600" /></div>
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-gray-900">Security Deposit</div>
                            <div className="text-xs text-gray-400">Refundable · {formatINR(depositDue)} pending</div>
                          </div>
                        </div>
                        <button onClick={() => openPay('deposit')} className="flex-shrink-0 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition">Pay Now</button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Rent overview */}
                <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <div className="font-bold text-sm text-gray-900 flex items-center gap-2"><FileText className="w-4 h-4 text-gray-400" /> Rent Overview</div>
                    <button onClick={() => setTab('rent')} className="text-xs font-semibold text-blue-600 hover:underline">View All</button>
                  </div>
                  <div className="space-y-1">
                    {monthlyLedger.slice(0, 3).map(m => (
                      <div key={m.label} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                        <div>
                          <div className="text-sm font-semibold text-gray-900">{m.label}</div>
                          <div className="text-xs text-gray-400">{m.paidOn ? `Paid on ${formatDate(m.paidOn)}` : 'Not yet paid'}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-bold text-gray-900">{formatINR(m.amount)}</div>
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${m.status === 'paid' ? 'bg-green-100 text-green-700' : m.status === 'partial' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                            {m.status === 'paid' ? 'Paid' : m.status === 'partial' ? 'Partial' : 'Pending'}
                          </span>
                        </div>
                      </div>
                    ))}
                    {!thisMonthPaid && !claimed && tenant.status === 'active' && (
                      <button onClick={() => openPay('rent')} className="w-full mt-2 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition">
                        Pay {thisMonth} Rent
                      </button>
                    )}
                  </div>
                </div>

                {/* Recent complaints */}
                <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <div className="font-bold text-sm text-gray-900 flex items-center gap-2"><MessageCircle className="w-4 h-4 text-gray-400" /> Recent Complaints</div>
                    <button onClick={() => setTab('complaints')} className="text-xs font-semibold text-blue-600 hover:underline">View All</button>
                  </div>
                  {complaints.length === 0 ? (
                    <div className="text-xs text-gray-400 text-center py-8">No complaints raised yet</div>
                  ) : (
                    <div className="space-y-1">
                      {complaints.slice(0, 3).map(c => (
                        <div key={c.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-gray-900 truncate">{c.issue_type}</div>
                            <div className="text-xs text-gray-400">#{c.id.slice(0, 8).toUpperCase()}</div>
                          </div>
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${c.status === 'resolved' ? 'bg-green-100 text-green-700' : c.status === 'in_progress' ? 'bg-blue-100 text-blue-700' : 'bg-yellow-100 text-yellow-700'}`}>
                            {c.status.replace('_', ' ')}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Quick actions */}
              <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                <div className="font-bold text-sm text-gray-900 mb-3">Quick Actions</div>
                <div className="grid grid-cols-3 gap-3">
                  <button onClick={() => openPay('rent')} className="flex flex-col items-center gap-2 py-4 bg-gray-50 hover:bg-gray-100 rounded-2xl transition">
                    <div className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center"><Home className="w-4 h-4 text-green-600" /></div>
                    <span className="text-xs font-semibold text-gray-700">Pay Rent</span>
                  </button>
                  <button onClick={downloadAgreement} className="flex flex-col items-center gap-2 py-4 bg-gray-50 hover:bg-gray-100 rounded-2xl transition">
                    <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center"><FileText className="w-4 h-4 text-blue-600" /></div>
                    <span className="text-xs font-semibold text-gray-700">Agreement</span>
                  </button>
                  <button onClick={() => setComplaintModal(true)} className="flex flex-col items-center gap-2 py-4 bg-gray-50 hover:bg-gray-100 rounded-2xl transition">
                    <div className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center"><MessageCircle className="w-4 h-4 text-red-600" /></div>
                    <span className="text-xs font-semibold text-gray-700">Raise Complaint</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {tab === 'rent' && (
            <div className="space-y-5">
              <div>
                <h1 className="text-xl font-extrabold text-gray-900">Rent</h1>
                <p className="text-sm text-gray-500">Your full monthly rent history.</p>
              </div>
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                {monthlyLedger.map(m => (
                  <div key={m.label} className="flex items-center justify-between px-5 py-4 border-b border-gray-50 last:border-0">
                    <div>
                      <div className="text-sm font-semibold text-gray-900">{m.label}</div>
                      <div className="text-xs text-gray-400">{m.paidOn ? `Paid on ${formatDate(m.paidOn)}` : 'Not yet paid'}</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <div className="text-sm font-bold text-gray-900">{formatINR(m.amount)}</div>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${m.status === 'paid' ? 'bg-green-100 text-green-700' : m.status === 'partial' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                          {m.status === 'paid' ? 'Paid' : m.status === 'partial' ? 'Partial' : 'Pending'}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {!thisMonthPaid && !claimed && tenant.status === 'active' && (
                <button onClick={() => openPay('rent')} className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold transition">
                  Mark {thisMonth} as Paid
                </button>
              )}
            </div>
          )}

          {tab === 'deposit' && (
            <div className="space-y-5">
              <div>
                <h1 className="text-xl font-extrabold text-gray-900">Deposit</h1>
                <p className="text-sm text-gray-500">Your security deposit details.</p>
              </div>
              <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm space-y-4">
                {[
                  ['Total Deposit', formatINR(tenant.deposit_amount)],
                  ['Amount Paid', formatINR(tenant.deposit_paid)],
                  ['Pending', formatINR(Math.max(0, depositDue))],
                  ['Status', depositDue <= 0 ? 'Fully Paid' : 'Partially Paid'],
                  ['Refundable', 'Yes, on vacating (subject to deductions)'],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between border-b border-gray-50 pb-3 last:border-0 last:pb-0">
                    <span className="text-sm text-gray-500">{label}</span>
                    <span className="text-sm font-bold text-gray-900">{value}</span>
                  </div>
                ))}
                {tenant.deposit_refunded > 0 && (
                  <div className="bg-green-50 rounded-xl p-4 space-y-2 mt-2">
                    <div className="text-xs font-bold text-green-800">Refund Processed</div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Amount Refunded</span>
                      <span className="font-bold text-green-700">{formatINR(tenant.deposit_refunded)}</span>
                    </div>
                    {tenant.deposit_refund_date && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Refund Date</span>
                        <span className="font-bold text-gray-900">{formatDate(tenant.deposit_refund_date)}</span>
                      </div>
                    )}
                    {tenant.deposit_deduction_notes && (
                      <div className="text-xs text-gray-500 mt-1">Note: {tenant.deposit_deduction_notes}</div>
                    )}
                  </div>
                )}
              </div>
              {depositDue > 0 && !depositClaimed && tenant.status === 'active' && (
                <button onClick={() => openPay('deposit')} className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold transition">
                  Pay {formatINR(depositDue)} Deposit
                </button>
              )}
            </div>
          )}

          {tab === 'documents' && (
            <div className="space-y-5">
              <div>
                <h1 className="text-xl font-extrabold text-gray-900">Documents</h1>
                <p className="text-sm text-gray-500">Your KYC and agreement status.</p>
              </div>
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-50">
                <div className="flex items-center justify-between px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center"><FileText className="w-4 h-4 text-blue-500" /></div>
                    <div>
                      <div className="text-sm font-semibold text-gray-900">Rent Agreement</div>
                      <div className="text-xs text-gray-400">System-generated from your tenant record</div>
                    </div>
                  </div>
                  <button onClick={downloadAgreement} aria-label="Download rent agreement" className="p-2 hover:bg-gray-100 rounded-lg transition"><Download className="w-4 h-4 text-gray-500" /></button>
                </div>
                <div className="flex items-center justify-between px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-orange-50 flex items-center justify-center"><FileText className="w-4 h-4 text-orange-500" /></div>
                    <div>
                      <div className="text-sm font-semibold text-gray-900">Aadhaar Card</div>
                      <div className="text-xs text-gray-400">KYC verification status</div>
                    </div>
                  </div>
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full capitalize ${tenant.aadhaar_status === 'verified' ? 'bg-green-100 text-green-700' : tenant.aadhaar_status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
                    {tenant.aadhaar_status}
                  </span>
                </div>
                <div className="flex items-center justify-between px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-purple-50 flex items-center justify-center"><FileText className="w-4 h-4 text-purple-500" /></div>
                    <div>
                      <div className="text-sm font-semibold text-gray-900">PAN Card</div>
                      <div className="text-xs text-gray-400">KYC verification status</div>
                    </div>
                  </div>
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full capitalize ${tenant.pan_status === 'verified' ? 'bg-green-100 text-green-700' : tenant.pan_status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
                    {tenant.pan_status}
                  </span>
                </div>
              </div>
              <p className="text-xs text-gray-400">Document upload isn't available yet — ask your PG owner if they need physical/digital copies of your KYC documents.</p>
            </div>
          )}

          {tab === 'complaints' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-xl font-extrabold text-gray-900">Complaints</h1>
                  <p className="text-sm text-gray-500">Track issues you've raised.</p>
                </div>
                <button onClick={() => setComplaintModal(true)} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold transition">
                  <MessageCircle className="w-4 h-4" /> Raise New
                </button>
              </div>
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-50">
                {complaints.length === 0 ? (
                  <div className="text-center py-12 text-gray-400 text-sm">No complaints raised yet</div>
                ) : complaints.map(c => (
                  <div key={c.id} className="flex items-start justify-between gap-3 px-5 py-4">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
                        <AlertCircle className="w-3.5 h-3.5 text-orange-400 flex-shrink-0" /> {c.issue_type}
                        <span className="text-xs text-gray-400 font-normal">#{c.id.slice(0, 8).toUpperCase()}</span>
                      </div>
                      {c.description && <div className="text-xs text-gray-500 mt-1">{c.description}</div>}
                      <div className="text-xs text-gray-400 mt-1">{formatDate(c.created_at)}</div>
                    </div>
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full flex-shrink-0 ${c.status === 'resolved' ? 'bg-green-100 text-green-700' : c.status === 'in_progress' ? 'bg-blue-100 text-blue-700' : 'bg-yellow-100 text-yellow-700'}`}>
                      {c.status.replace('_', ' ')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === 'profile' && (
            <div className="space-y-5">
              <div>
                <h1 className="text-xl font-extrabold text-gray-900">Profile</h1>
                <p className="text-sm text-gray-500">Your account details.</p>
              </div>
              <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-600 to-green-600 flex items-center justify-center text-white font-extrabold text-xl">
                    {initials}
                  </div>
                  <div>
                    <div className="text-lg font-extrabold text-gray-900">{tenant.name}</div>
                    <div className="text-sm text-gray-500">Room {tenant.room?.room_number ?? '—'} · Bed {tenant.bed_label ?? '—'}</div>
                  </div>
                </div>
                <div className="space-y-3">
                  {[
                    ['Mobile Number', tenant.phone],
                    ['Email', tenant.email || '—'],
                    ['Emergency Contact', tenant.emergency_contact || '—'],
                    ['Property', tenant.property?.name],
                    ['Joining Date', formatDate(tenant.joining_date)],
                    ['Notice Period', `${tenant.notice_period_days} days`],
                    ['Status', tenant.status.replace('_', ' ')],
                  ].map(([label, value]) => (
                    <div key={label} className="flex justify-between border-b border-gray-50 pb-3 last:border-0 last:pb-0">
                      <span className="text-sm text-gray-500">{label}</span>
                      <span className="text-sm font-bold text-gray-900 capitalize">{value}</span>
                    </div>
                  ))}
                </div>
                <button onClick={() => setPwModal(true)} className="w-full mt-6 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition">
                  <Lock className="w-4 h-4" /> Change Password
                </button>
              </div>
            </div>
          )}

        </main>
      </div>

      {/* Mark as Paid Modal */}
      {payModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-base font-bold">Pay {payKind === 'rent' ? `Rent — ${thisMonth}` : 'Security Deposit'}</h2>
              <button onClick={() => setPayModal(false)} className="text-gray-400 text-xl font-bold">×</button>
            </div>
            <div className="p-5 space-y-4">
              <div className="bg-blue-50 rounded-xl p-3 text-xs text-blue-700">
                Amount: <span className="font-bold">{formatINR(payAmount)}</span>. This notifies your owner that you've paid. No real payment is made here — the owner will verify and approve.
              </div>
              {tenant.property?.upi_id && (
                <a href={upiPaymentLink(tenant.property.upi_id, tenant.property.name ?? 'PG Owner', payAmount, `${payKind === 'rent' ? 'Rent' : 'Deposit'} - ${tenant.name}`)}
                  className="w-full py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 hover:opacity-90 transition">
                  Pay {formatINR(payAmount)} via UPI
                </a>
              )}
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-2">Payment Method</label>
                <div className="flex gap-2">
                  {['upi', 'cash', 'bank_transfer'].map(m => (
                    <button key={m} onClick={() => setMethod(m)}
                      className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition ${method === m ? 'border-blue-500 bg-blue-50 text-blue-600' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                      {m.replace('_', ' ').toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1">Note (optional)</label>
                <textarea rows={2} value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. Paid via GPay this morning" className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-500 resize-none" />
              </div>
            </div>
            <div className="px-5 py-4 border-t border-gray-100">
              <button onClick={submitPayment} disabled={saving} className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50 transition">
                {saving && <Loader2 className="w-4 h-4 animate-spin" />} Submit for Approval
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Complaint Modal */}
      {complaintModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-base font-bold">Raise Complaint</h2>
              <button onClick={() => setComplaintModal(false)} className="text-gray-400 text-xl font-bold">×</button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1">Issue Type</label>
                <select value={complaint.issue_type} onChange={e => setComplaint(c => ({ ...c, issue_type: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-500">
                  {['Plumbing', 'Electrical', 'WiFi', 'Cleaning', 'AC', 'Maintenance', 'Other'].map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1">Priority</label>
                <div className="flex gap-2">
                  {['low', 'medium', 'high'].map(p => (
                    <button key={p} onClick={() => setComplaint(c => ({ ...c, priority: p }))}
                      className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition capitalize ${complaint.priority === p ? 'border-blue-500 bg-blue-50 text-blue-600' : 'border-gray-200 text-gray-600'}`}>{p}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1">Description</label>
                <textarea rows={3} value={complaint.description} onChange={e => setComplaint(c => ({ ...c, description: e.target.value }))} placeholder="Describe the issue…" className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-500 resize-none" />
              </div>
            </div>
            <div className="px-5 py-4 border-t border-gray-100">
              <button onClick={submitComplaint} disabled={saving} className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50 transition">
                {saving && <Loader2 className="w-4 h-4 animate-spin" />} Submit Complaint
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Change Password Modal */}
      {pwModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-base font-bold">Change Password</h2>
              <button onClick={() => setPwModal(false)} className="text-gray-400 text-xl font-bold">×</button>
            </div>
            <div className="p-5 space-y-4">
              {[['New Password', 'newPw'], ['Confirm Password', 'confirm']].map(([l, k]) => (
                <div key={k}>
                  <label className="text-xs font-semibold text-gray-600 block mb-1">{l}</label>
                  <input type="password" value={(pwForm as any)[k]} onChange={e => setPwForm(f => ({ ...f, [k]: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-500" />
                </div>
              ))}
            </div>
            <div className="px-5 py-4 border-t border-gray-100">
              <button onClick={changePassword} className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition">Update Password</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
