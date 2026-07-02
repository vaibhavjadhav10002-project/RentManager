'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatINR, formatDate, whatsappLink } from '@/lib/utils'
import { toast } from 'sonner'
import { LogOut, Loader2, CheckCircle, Clock, FileText, MessageCircle, Lock, Download, AlertCircle } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { generateAgreementPDF, generateReceiptPDF } from '@/lib/pdf'

export default function TenantPortal() {
  const router = useRouter()
  const [tenant, setTenant] = useState<any>(null)
  const [payments, setPayments] = useState<any[]>([])
  const [complaints, setComplaints] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [payModal, setPayModal] = useState(false)
  const [pwModal, setPwModal] = useState(false)
  const [complaintModal, setComplaintModal] = useState(false)
  const [method, setMethod] = useState('upi')
  const [note, setNote] = useState('')
  const [pwForm, setPwForm] = useState({ newPw: '', confirm: '' })
  const [complaint, setComplaint] = useState({ issue_type: 'Plumbing', description: '', priority: 'medium' })
  const [saving, setSaving] = useState(false)
  const [claimed, setClaimed] = useState(false)

  useEffect(() => {
    async function load() {
      const sb = createClient()
      const { data: { user } } = await sb.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: t } = await sb.from('tenants').select('*, room:rooms(*), property:properties(name, address, upi_id)').eq('auth_user_id', user.id).single()
      if (!t) { router.push('/login'); return }
      setTenant(t)

      const { data: p } = await sb.from('payments').select('*').eq('tenant_id', t.id).order('payment_date', { ascending: false })
      setPayments(p ?? [])

      const { data: c } = await sb.from('complaints').select('*').eq('tenant_id', t.id).order('created_at', { ascending: false })
      setComplaints(c ?? [])

      setLoading(false)
    }
    load()
  }, [])

  const thisMonth = new Date().toLocaleString('en-IN', { month: 'long', year: 'numeric' })
  const thisMonthPaid = payments.some(p => p.for_month === thisMonth && p.approval_status === 'approved')

  // Build a month-by-month rent ledger from joining date to the current month
  const monthlyLedger = (() => {
    if (!tenant?.joining_date) return []
    const months: { label: string; status: 'paid' | 'pending' | 'partial' }[] = []
    const start = new Date(tenant.joining_date)
    const cursor = new Date(start.getFullYear(), start.getMonth(), 1)
    const end = new Date()
    while (cursor <= end) {
      const label = cursor.toLocaleString('en-IN', { month: 'long', year: 'numeric' })
      const monthPayments = payments.filter(p => p.for_month === label && p.type === 'rent' && p.approval_status === 'approved')
      const totalPaid = monthPayments.reduce((s, p) => s + p.amount_received, 0)
      const status = totalPaid >= tenant.monthly_rent ? 'paid' : totalPaid > 0 ? 'partial' : 'pending'
      months.push({ label, status })
      cursor.setMonth(cursor.getMonth() + 1)
    }
    return months.reverse()
  })()

  function downloadAgreement() {
    generateAgreementPDF({
      tenantName: tenant.name,
      tenantPhone: tenant.phone,
      propertyName: tenant.property?.name ?? 'PG',
      propertyAddress: tenant.property?.address,
      roomNumber: tenant.room?.room_number,
      bedLabel: tenant.bed_label,
      joiningDate: tenant.joining_date,
      monthlyRent: tenant.monthly_rent,
      depositAmount: tenant.deposit_amount,
      noticePeriodDays: tenant.notice_period_days,
    })
    toast.success('Agreement downloaded')
  }

  function downloadReceipt(p: any) {
    generateReceiptPDF({
      tenantName: tenant.name,
      propertyName: tenant.property?.name ?? 'PG',
      roomNumber: tenant.room?.room_number,
      forMonth: p.for_month,
      type: p.type,
      totalDue: p.total_due,
      amountReceived: p.amount_received,
      method: p.method,
      paymentDate: p.payment_date,
      approvalStatus: p.approval_status,
      receiptNo: p.id.slice(0, 8).toUpperCase(),
    })
  }

  async function submitPayment() {
    setSaving(true)
    try {
      const sb = createClient()
      await sb.from('payments').insert({
        tenant_id: tenant.id, property_id: tenant.property_id,
        type: 'rent', for_month: thisMonth,
        total_due: tenant.monthly_rent, amount_received: tenant.monthly_rent,
        method, tenant_note: note, submitted_by_tenant: true,
        approval_status: 'pending_approval', payment_date: new Date().toISOString().slice(0, 10),
      })
      toast.success('Marked as paid — waiting for owner approval'); setClaimed(true); setPayModal(false)
    } catch (e: any) { toast.error(e.message) }
    setSaving(false)
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
    toast.success('Password updated!'); setPwModal(false); setPwForm({ newPw: '', confirm: '' })
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
    </div>
  )

  const depositDue = tenant.deposit_amount - tenant.deposit_paid

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 px-4 h-14 flex items-center justify-between sticky top-0 z-30 shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center text-white font-bold text-xs">
            {(tenant.name || '?').split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
          </div>
          <div>
            <div className="text-sm font-bold text-gray-900">{tenant.property?.name}</div>
            <div className="text-xs text-gray-400">Tenant Portal</div>
          </div>
        </div>
        <button onClick={async () => { const sb = createClient(); await sb.auth.signOut(); router.push('/login') }}
          className="p-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-500 transition">
          <LogOut className="w-4 h-4" />
        </button>
      </header>

      <main className="p-4 max-w-lg mx-auto space-y-4 pb-10">
        {/* Greeting */}
        <div className="flex items-center gap-3 mt-2">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center text-white font-extrabold text-xl flex-shrink-0">
            {(tenant.name || '?').split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
          </div>
          <div>
            <div className="text-lg font-extrabold text-gray-900">Hi, {(tenant.name || 'there').split(' ')[0]} 👋</div>
            <div className="text-sm text-gray-500">Room {tenant.room?.room_number} · Bed {tenant.bed_label}</div>
          </div>
        </div>

        {/* Rent Status Card */}
        <div className={`rounded-2xl p-5 text-white ${(claimed || thisMonthPaid) ? 'bg-gradient-to-br from-green-500 to-emerald-600' : 'bg-gradient-to-br from-blue-600 to-purple-600'}`}>
          <div className="text-xs opacity-80 font-semibold uppercase tracking-wide">{thisMonth} Rent</div>
          <div className="text-3xl font-extrabold mt-1">{formatINR(tenant.monthly_rent)}</div>
          <div className="mt-3">
            {thisMonthPaid ? (
              <div className="flex items-center gap-2 text-sm font-semibold"><CheckCircle className="w-4 h-4" /> Approved by owner</div>
            ) : claimed ? (
              <div className="flex items-center gap-2 text-sm font-semibold"><Clock className="w-4 h-4" /> Submitted — awaiting owner approval</div>
            ) : (
              <button onClick={() => setPayModal(true)} className="mt-1 bg-white text-blue-600 font-bold text-sm px-5 py-2 rounded-xl hover:bg-blue-50 transition">
                Mark as Paid
              </button>
            )}
          </div>
        </div>

        {/* Info Grid */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Deposit Paid', value: formatINR(tenant.deposit_paid), sub: depositDue > 0 ? `₹${depositDue.toLocaleString('en-IN')} pending` : 'Fully paid', subColor: depositDue > 0 ? 'text-yellow-600' : 'text-green-600' },
            { label: 'Notice Period', value: `${tenant.notice_period_days} days`, sub: 'Before vacating', subColor: 'text-gray-400' },
            { label: 'Joining Date', value: formatDate(tenant.joining_date), sub: '', subColor: '' },
            { label: 'Aadhaar / PAN', value: tenant.aadhaar_status === 'verified' ? '✓ Verified' : '⏳ Pending', sub: '', subColor: '' },
          ].map(item => (
            <div key={item.label} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
              <div className="text-xs text-gray-400 font-semibold uppercase tracking-wide">{item.label}</div>
              <div className="text-sm font-bold text-gray-900 mt-1">{item.value}</div>
              {item.sub && <div className={`text-xs font-semibold mt-0.5 ${item.subColor}`}>{item.sub}</div>}
            </div>
          ))}
        </div>

        {/* Agreement */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <FileText className="w-4 h-4 text-blue-500" />
            <span className="font-bold text-sm text-gray-900">My Agreement</span>
          </div>
          <p className="text-xs text-gray-500 leading-relaxed">
            Monthly rent of {formatINR(tenant.monthly_rent)}, deposit {formatINR(tenant.deposit_amount)}, with a {tenant.notice_period_days}-day notice period required before vacating.
          </p>
          <button onClick={downloadAgreement} className="mt-3 flex items-center gap-1.5 text-xs text-blue-600 font-semibold hover:underline">
            <Download className="w-3.5 h-3.5" /> Download Agreement
          </button>
        </div>

        {/* Payment History */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
          <div className="font-bold text-sm text-gray-900 mb-3">Payment History</div>
          <div className="space-y-3">
            {payments.length === 0 ? (
              <div className="text-xs text-gray-400 text-center py-4">No payment history yet</div>
            ) : payments.map(p => (
              <div key={p.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                <div>
                  <div className="text-sm font-semibold text-gray-900">{p.for_month}</div>
                  <div className="text-xs text-gray-400">{formatDate(p.payment_date)} · {p.method?.replace('_', ' ')}</div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-right">
                    <div className="text-sm font-bold text-gray-900">{formatINR(p.amount_received)}</div>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${p.approval_status === 'approved' ? 'bg-green-100 text-green-700' : p.approval_status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
                      {p.approval_status.replace('_', ' ')}
                    </span>
                  </div>
                  {p.approval_status === 'approved' && (
                    <button onClick={() => downloadReceipt(p)} className="p-1.5 hover:bg-gray-100 rounded-lg transition flex-shrink-0" title="Download receipt">
                      <Download className="w-3.5 h-3.5 text-gray-400" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Monthly Rent Ledger */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
          <div className="font-bold text-sm text-gray-900 mb-1">Monthly Rent Status</div>
          <p className="text-xs text-gray-400 mb-3">Every month since you joined, at a glance</p>
          <div className="space-y-2">
            {monthlyLedger.map(m => (
              <div key={m.label} className="flex items-center justify-between py-1.5">
                <span className="text-sm text-gray-700">{m.label}</span>
                <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                  m.status === 'paid' ? 'bg-green-100 text-green-700'
                  : m.status === 'partial' ? 'bg-yellow-100 text-yellow-700'
                  : 'bg-red-100 text-red-700'
                }`}>
                  {m.status === 'paid' ? '✓ Paid' : m.status === 'partial' ? 'Partially Paid' : 'Pending'}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* My Complaints */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
          <div className="font-bold text-sm text-gray-900 mb-3">My Complaints</div>
          <div className="space-y-3">
            {complaints.length === 0 ? (
              <div className="text-xs text-gray-400 text-center py-4">No complaints raised yet</div>
            ) : complaints.map(c => (
              <div key={c.id} className="flex items-start justify-between gap-3 py-2 border-b border-gray-50 last:border-0">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 text-orange-400 flex-shrink-0" /> {c.issue_type}
                  </div>
                  {c.description && <div className="text-xs text-gray-500 mt-0.5">{c.description}</div>}
                  <div className="text-xs text-gray-400 mt-1">{formatDate(c.created_at)}</div>
                </div>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${
                  c.status === 'resolved' ? 'bg-green-100 text-green-700'
                  : c.status === 'in_progress' ? 'bg-blue-100 text-blue-700'
                  : 'bg-yellow-100 text-yellow-700'
                }`}>
                  {c.status.replace('_', ' ')}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => setComplaintModal(true)} className="flex items-center justify-center gap-2 py-3 bg-white border border-gray-200 hover:bg-gray-50 rounded-2xl text-sm font-semibold text-gray-700 transition shadow-sm">
            <MessageCircle className="w-4 h-4 text-blue-500" /> Raise Complaint
          </button>
          <button onClick={() => setPwModal(true)} className="flex items-center justify-center gap-2 py-3 bg-white border border-gray-200 hover:bg-gray-50 rounded-2xl text-sm font-semibold text-gray-700 transition shadow-sm">
            <Lock className="w-4 h-4 text-purple-500" /> Change Password
          </button>
        </div>
      </main>

      {/* Mark as Paid Modal */}
      {payModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-base font-bold">Mark Rent as Paid</h2>
              <button onClick={() => setPayModal(false)} className="text-gray-400 text-xl font-bold">×</button>
            </div>
            <div className="p-5 space-y-4">
              <div className="bg-blue-50 rounded-xl p-3 text-xs text-blue-700">This notifies your owner that you've paid. No real payment is made here. Owner will verify and approve.</div>
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
