'use client'
import { useEffect, useState, useCallback } from 'react'
import { useProperty } from '@/components/shared/PropertyContext'
import { getPayments, recordPayment, approvePayment, rejectPayment, getCollectors, getTenants, getElectricityBills, addElectricityBill, approveBill, deleteElectricityBill, getLeaveRequests, getRentExtensionRequests } from '@/lib/supabase/queries'
import { generateReceiptPDF } from '@/lib/pdf'
import { formatINR, formatDate, whatsappLink, rentReminderMsg, computeDueDate, getOverdueDays, cn, calculateLeaveRentAdjustment, getApprovedExtensionFor } from '@/lib/utils'
import { toast } from 'sonner'
import { Plus, Check, MessageCircle, Phone, FileText, Zap, Trash2, X } from 'lucide-react'
import type { Payment, Collector, Tenant, ElectricityBill } from '@/types'
import { sendPushNotification } from '@/lib/push'
import {
  OwnerButton, OwnerIconButton, OwnerBadge, OwnerCard, OwnerEmptyState, OwnerInput, OwnerSelect,
  OwnerTable, OwnerTableHead, OwnerTableBody, OwnerTableRow, OwnerTableHeadCell, OwnerTableCell, OwnerTableEmptyRow,
} from '@/components/owner/ui'

type Tab = 'all' | 'paid' | 'pending' | 'overdue' | 'bydue' | 'ledger'

const TONE_FG = {
  success: 'text-owner-success', warning: 'text-owner-warning', info: 'text-owner-info', danger: 'text-owner-danger',
} as const

export default function PaymentsPage() {
  const { activeId, active, properties } = useProperty()
  const [payments, setPayments] = useState<Payment[]>([])
  const [collectors, setCollectors] = useState<Collector[]>([])
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [approvedLeaves, setApprovedLeaves] = useState<any[]>([])
  const [approvedExtensions, setApprovedExtensions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('all')
  const [bills, setBills] = useState<ElectricityBill[]>([])
  const [billModal, setBillModal] = useState(false)
  const [billSaving, setBillSaving] = useState(false)
  const [billForm, setBillForm] = useState({ tenant_id: '', for_month: '', amount: '', due_date: '' })
  const [recordModal, setRecordModal] = useState(false)
  const [bulkReminderModal, setBulkReminderModal] = useState(false)
  const [remindedPhones, setRemindedPhones] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    tenant_id: '', type: 'rent', for_month: '', total_due: '', amount_received: '',
    method: 'cash', collected_by: '', payment_date: new Date().toISOString().slice(0, 10), reference_number: '',
  })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const propIds = activeId === 'all' ? properties.map(p => p.id) : [activeId]
      const [pList, tList, leaveLists, extensionLists] = await Promise.all([
        Promise.all(propIds.map(id => getPayments(id))).then(r => r.flat()),
        Promise.all(propIds.map(id => getTenants(id))).then(r => r.flat()),
        Promise.all(propIds.map(id => getLeaveRequests(id))).then(r => r.flat()),
        Promise.all(propIds.map(id => getRentExtensionRequests(id))).then(r => r.flat()),
      ])
      setPayments(pList)
      setTenants(tList)
      setApprovedLeaves(leaveLists.filter((l: any) => l.status === 'approved'))
      setApprovedExtensions(extensionLists.filter((x: any) => x.status === 'approved'))
      if (propIds.length === 1) {
        const cols = await getCollectors(propIds[0])
        setCollectors(cols)
      }
      const billLists = await Promise.all(propIds.map(id => getElectricityBills(id)))
      setBills(billLists.flat())
    } catch { toast.error('Failed to load payments') }
    setLoading(false)
  }, [activeId, properties])

  useEffect(() => { load() }, [load])

  // Pending rent sorted by due date — accounts for partial payments and
  // only counts actual rent payments (not deposit/advance) toward "paid"
  const today = new Date()
  const thisMonth = today.toLocaleString('en-IN', { month: 'long', year: 'numeric' })
  const rentPaidThisMonthByTenant = new Map<string, number>()
  payments.forEach(p => {
    if (p.for_month === thisMonth && p.approval_status === 'approved' && p.type === 'rent') {
      rentPaidThisMonthByTenant.set(p.tenant_id, (rentPaidThisMonthByTenant.get(p.tenant_id) ?? 0) + p.amount_received)
    }
  })
  const effectiveRentFor = (t: Tenant) => {
    const tenantLeaves = approvedLeaves.filter(l => l.tenant_id === t.id)
    const adjustment = calculateLeaveRentAdjustment(thisMonth, t.monthly_rent, tenantLeaves)
    return { rent: t.monthly_rent - adjustment, adjustment }
  }
  const paidTenantIds = new Set(
    [...rentPaidThisMonthByTenant.entries()].filter(([tid, amt]) => {
      const t = tenants.find(x => x.id === tid)
      return t && amt >= effectiveRentFor(t).rent
    }).map(([tid]) => tid)
  )
  const pendingRentSorted = tenants
    .filter(t => t.status === 'active' && (rentPaidThisMonthByTenant.get(t.id) ?? 0) < effectiveRentFor(t).rent)
    .map(t => {
      const { rent, adjustment } = effectiveRentFor(t)
      const tenantExtensions = approvedExtensions.filter(x => x.tenant_id === t.id)
      const activeExtension = getApprovedExtensionFor(thisMonth, tenantExtensions)
      return {
        ...t,
        dueDate: computeDueDate(t.joining_date, today).toISOString().slice(0, 10),
        overdueDays: getOverdueDays(t.joining_date, today),
        remainingDue: rent - (rentPaidThisMonthByTenant.get(t.id) ?? 0),
        leaveAdjustment: adjustment,
        effectiveRent: rent,
        activeExtension,
      }
    })
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())

  const tabFiltered = {
    all: payments,
    paid: payments.filter(p => p.approval_status === 'approved'),
    pending: payments.filter(p => p.approval_status === 'pending_approval'),
    overdue: payments.filter(p => p.approval_status === 'pending_approval'),
    bydue: [],
    ledger: payments,
  }[tab]

  const totalCollected = payments.filter(p => p.approval_status === 'approved' && p.for_month === thisMonth && p.type === 'rent').reduce((s, p) => s + p.amount_received, 0)
  const totalPending = pendingRentSorted.reduce((s, t) => s + t.remainingDue, 0)

  async function handleRaiseBill() {
    const propertyId = activeId === 'all' ? tenants.find(t => t.id === billForm.tenant_id)?.property_id : activeId
    if (!billForm.tenant_id) { toast.error('Select a tenant'); return }
    if (!billForm.for_month) { toast.error('Enter the billing month'); return }
    if (!billForm.amount || Number(billForm.amount) <= 0) { toast.error('Enter a valid amount'); return }
    if (!propertyId) { toast.error('Select a property'); return }
    setBillSaving(true)
    try {
      await addElectricityBill({
        property_id: propertyId,
        tenant_id: billForm.tenant_id,
        for_month: billForm.for_month,
        amount: Number(billForm.amount),
        due_date: billForm.due_date || undefined,
      })
      toast.success('Bill raised!')
      setBillModal(false)
      setBillForm({ tenant_id: '', for_month: '', amount: '', due_date: '' })
      load()
    } catch (e: any) { toast.error(e.message) }
    setBillSaving(false)
  }

  async function handleApproveBill(id: string) {
    try { await approveBill(id); toast.success('Bill marked paid'); load() }
    catch (e: any) { toast.error(e.message) }
  }

  async function handleDeleteBill(id: string) {
    if (!confirm('Delete this bill?')) return
    try { await deleteElectricityBill(id); toast.success('Bill deleted'); load() }
    catch (e: any) { toast.error(e.message) }
  }

  async function handleRecord() {
    if (!form.tenant_id || !form.amount_received) { toast.error('Fill required fields'); return }
    if (Number(form.amount_received) <= 0) { toast.error('Amount must be greater than 0'); return }
    if (!form.payment_date) { toast.error('Select a payment date'); return }
    setSaving(true)
    try {
      const propId = activeId === 'all'
        ? tenants.find(t => t.id === form.tenant_id)?.property_id ?? ''
        : activeId
      await recordPayment({
        tenant_id: form.tenant_id,
        property_id: propId,
        type: form.type as any,
        for_month: form.for_month || undefined,
        total_due: Number(form.total_due),
        amount_received: Number(form.amount_received),
        method: form.method as any,
        collected_by: form.collected_by || undefined,
        payment_date: form.payment_date,
        reference_number: form.reference_number || undefined,
      })
      toast.success('Payment recorded!')
      setRecordModal(false)
      load()
    } catch (e: any) { toast.error(e.message) }
    setSaving(false)
  }

  const TABS: [Tab, string][] = [['all', 'All'], ['paid', 'Paid'], ['pending', 'Pending'], ['bydue', 'Pending (by due date)'], ['ledger', 'Ledger']]

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-extrabold text-owner-fg">Payments</h1>
          <p className="text-sm text-owner-muted">Rent collection &amp; ledger</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <OwnerButton
            onClick={() => { if (pendingRentSorted.length === 0) { toast.error('No pending rent to remind about'); return } setBulkReminderModal(true) }}
            variant="secondary" icon={<MessageCircle className="w-4 h-4 text-owner-success" />}
          >
            Remind All
          </OwnerButton>
          <OwnerButton onClick={() => setBillModal(true)} variant="secondary" icon={<Zap className="w-4 h-4 text-owner-warning" />}>
            Raise Electricity Bill
          </OwnerButton>
          <OwnerButton onClick={() => setRecordModal(true)} icon={<Plus className="w-4 h-4" />}>
            Record Payment
          </OwnerButton>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Collected', value: formatINR(totalCollected), tone: 'success' as const },
          { label: 'Pending Rent', value: formatINR(totalPending), tone: 'warning' as const },
          { label: 'Collection Rate', value: `${Math.round((totalCollected / (totalCollected + totalPending || 1)) * 100)}%`, tone: 'info' as const },
          { label: 'Pending Tenants', value: String(pendingRentSorted.length), tone: 'danger' as const },
        ].map(s => (
          <OwnerCard key={s.label}>
            <div className="text-xs text-owner-muted font-semibold uppercase tracking-wide">{s.label}</div>
            <div className={cn('text-xl font-extrabold mt-1 owner-numeric', TONE_FG[s.tone])}>{s.value}</div>
          </OwnerCard>
        ))}
      </div>

      {/* Electricity Bills */}
      {bills.length > 0 && (
        <OwnerCard>
          <div className="flex items-center gap-2 mb-3">
            <Zap className="w-4 h-4 text-owner-warning" />
            <div className="font-bold text-sm text-owner-fg">Electricity Bills</div>
          </div>
          <div className="space-y-2">
            {bills.map(b => (
              <div key={b.id} className="flex items-center justify-between gap-3 p-3 bg-owner-bg-subtle rounded-owner-lg">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-owner-fg">{b.tenant?.name ?? 'Tenant'} · {b.for_month}</div>
                  <div className="text-xs text-owner-muted-subtle">
                    Room {b.tenant?.room?.room_number ?? '—'} · {formatINR(b.amount)}
                    {b.due_date && ` · Due ${formatDate(b.due_date)}`}
                    {b.tenant_note && ` · "${b.tenant_note}"`}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <OwnerBadge tone={b.status === 'paid' ? 'success' : b.status === 'pending_approval' ? 'info' : 'warning'}>
                    {b.status === 'paid' ? 'Paid' : b.status === 'pending_approval' ? 'Awaiting Confirmation' : 'Unpaid'}
                  </OwnerBadge>
                  {b.status === 'pending_approval' && (
                    <OwnerIconButton aria-label="Confirm paid" variant="ghost" size="sm" onClick={() => handleApproveBill(b.id)} className="hover:text-owner-success">
                      <Check />
                    </OwnerIconButton>
                  )}
                  {b.status !== 'paid' && (
                    <OwnerIconButton aria-label="Delete bill" variant="ghost" size="sm" onClick={() => handleDeleteBill(b.id)} className="hover:text-owner-danger">
                      <Trash2 />
                    </OwnerIconButton>
                  )}
                </div>
              </div>
            ))}
          </div>
        </OwnerCard>
      )}

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-owner-surface-hover rounded-owner-lg w-fit flex-wrap">
        {TABS.map(([v, l]) => (
          <button key={v} onClick={() => setTab(v)}
            className={cn(
              'px-4 py-1.5 rounded-owner-md text-xs font-semibold transition-colors',
              tab === v ? 'bg-owner-surface shadow-owner-xs text-owner-fg' : 'text-owner-muted hover:text-owner-fg'
            )}>
            {l}
          </button>
        ))}
      </div>

      {tab === 'bydue' ? (
        <div className="space-y-2">
          <p className="text-xs text-owner-muted px-1">
            Sorted by due date — oldest overdue first. Due date = same day-of-month as joining date.
          </p>
          <OwnerTable>
          <OwnerTableHead>
            <tr>
              {['Tenant', 'Due Date', 'Overdue By', 'Amount', 'Remind', 'Action'].map(h => <OwnerTableHeadCell key={h}>{h}</OwnerTableHeadCell>)}
            </tr>
          </OwnerTableHead>
          <OwnerTableBody>
            {pendingRentSorted.length === 0 ? (
              <OwnerTableEmptyRow colSpan={6}><OwnerEmptyState icon={Check} title="No pending rent!" /></OwnerTableEmptyRow>
            ) : pendingRentSorted.map(t => (
              <OwnerTableRow key={t.id}>
                <OwnerTableCell>
                  <div className="font-semibold text-owner-fg">{t.name}</div>
                  <div className="text-xs text-owner-muted-subtle">Room {t.room?.room_number}</div>
                </OwnerTableCell>
                <OwnerTableCell className="font-mono text-xs font-bold">{t.dueDate}</OwnerTableCell>
                <OwnerTableCell>
                  <OwnerBadge tone={t.overdueDays > 5 ? 'danger' : 'warning'}>{t.overdueDays}d overdue</OwnerBadge>
                </OwnerTableCell>
                <OwnerTableCell className="font-bold owner-numeric">
                  {formatINR(t.remainingDue)}
                  {t.remainingDue < t.monthly_rent && <span className="block text-xs font-normal text-owner-muted-subtle">of {formatINR(t.monthly_rent)}</span>}
                </OwnerTableCell>
                <OwnerTableCell>
                  <div className="flex gap-1.5">
                    <a href={whatsappLink(t.phone, rentReminderMsg(t.name, t.remainingDue, t.property?.name ?? 'PG'))}
                      onClick={() => { if (t.auth_user_id) sendPushNotification({ user_ids: [t.auth_user_id], title: '💰 Rent Reminder', body: `${formatINR(t.remainingDue)} rent is due. Please pay soon.`, url: '/portal', tag: 'rent-reminder' }) }}
                      target="_blank" rel="noreferrer" className="p-1.5 bg-owner-success/15 hover:bg-owner-success/25 rounded-owner-md transition-colors">
                      <MessageCircle className="w-3.5 h-3.5 text-owner-success" />
                    </a>
                    <a href={`tel:${t.phone}`} className="p-1.5 bg-owner-info/15 hover:bg-owner-info/25 rounded-owner-md transition-colors">
                      <Phone className="w-3.5 h-3.5 text-owner-info" />
                    </a>
                  </div>
                </OwnerTableCell>
                <OwnerTableCell>
                  <OwnerButton
                    onClick={() => { setForm(f => ({ ...f, tenant_id: t.id, total_due: String(t.remainingDue), type: 'rent', for_month: thisMonth })); setRecordModal(true) }}
                    size="sm" icon={<Check className="w-3.5 h-3.5" />}
                  >
                    Record
                  </OwnerButton>
                </OwnerTableCell>
              </OwnerTableRow>
            ))}
          </OwnerTableBody>
        </OwnerTable>
        </div>
      ) : (
        <div className="space-y-2">
          {tab === 'ledger' && (
            <p className="text-xs text-owner-muted px-1">
              Every partial payment is logged separately with the collector&apos;s name. Past entries are never changed.
            </p>
          )}
          <OwnerTable>
          {loading ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-11 rounded-owner-lg bg-owner-surface-hover animate-pulse" />)}
            </div>
          ) : (
            <>
              <OwnerTableHead>
                <tr>
                  {['Tenant', 'Month', 'Type', 'Due', 'Received', 'Mode', tab === 'ledger' ? 'Collected By' : 'Status', 'Date', 'Actions'].map(h => (
                    <OwnerTableHeadCell key={h}>{h}</OwnerTableHeadCell>
                  ))}
                </tr>
              </OwnerTableHead>
              <OwnerTableBody>
                {tabFiltered.length === 0 ? (
                  <OwnerTableEmptyRow colSpan={9}><OwnerEmptyState icon={FileText} title="No payments found" /></OwnerTableEmptyRow>
                ) : tabFiltered.map(p => (
                  <OwnerTableRow key={p.id}>
                    <OwnerTableCell>
                      <div className="font-semibold text-owner-fg">{p.tenant?.name ?? '—'}</div>
                      <div className="text-xs text-owner-muted-subtle">Room {p.tenant?.room?.room_number}</div>
                    </OwnerTableCell>
                    <OwnerTableCell className="text-xs">{p.for_month ?? '—'}</OwnerTableCell>
                    <OwnerTableCell><OwnerBadge tone="info" className="capitalize">{p.type}</OwnerBadge></OwnerTableCell>
                    <OwnerTableCell className="text-xs text-owner-muted owner-numeric">{formatINR(p.total_due)}</OwnerTableCell>
                    <OwnerTableCell className="font-bold text-owner-success owner-numeric">{formatINR(p.amount_received)}</OwnerTableCell>
                    <OwnerTableCell><OwnerBadge tone="neutral" className="capitalize">{p.method?.replace('_', ' ') ?? '—'}</OwnerBadge></OwnerTableCell>
                    <OwnerTableCell>
                      {tab === 'ledger'
                        ? <OwnerBadge tone="purple">{p.collector?.name ?? '—'}</OwnerBadge>
                        : <OwnerBadge tone={p.approval_status === 'approved' ? 'success' : p.approval_status === 'rejected' ? 'danger' : 'warning'} className="capitalize">
                            {p.approval_status.replace('_', ' ')}
                          </OwnerBadge>
                      }
                    </OwnerTableCell>
                    <OwnerTableCell className="text-xs text-owner-muted">{formatDate(p.payment_date)}</OwnerTableCell>
                    <OwnerTableCell>
                      <div className="flex gap-1">
                        {p.approval_status === 'pending_approval' && (
                          <>
                            <OwnerIconButton aria-label="Approve payment" variant="ghost" size="sm" onClick={async () => { await approvePayment(p.id); toast.success('Approved'); load() }} className="hover:text-owner-success">
                              <Check />
                            </OwnerIconButton>
                            <OwnerIconButton aria-label="Reject payment" variant="ghost" size="sm" onClick={async () => { await rejectPayment(p.id); toast.error('Rejected'); load() }} className="hover:text-owner-danger">
                              <X />
                            </OwnerIconButton>
                          </>
                        )}
                        <OwnerIconButton aria-label="Download receipt" variant="ghost" size="sm" onClick={() => generateReceiptPDF({
                          tenantName: p.tenant?.name ?? 'Tenant',
                          propertyName: active?.name ?? properties.find(pr => pr.id === p.property_id)?.name ?? 'PG',
                          roomNumber: p.tenant?.room?.room_number,
                          forMonth: p.for_month ?? undefined,
                          type: p.type,
                          totalDue: p.total_due,
                          amountReceived: p.amount_received,
                          method: p.method ?? undefined,
                          referenceNumber: p.reference_number ?? undefined,
                          paymentDate: p.payment_date,
                          approvalStatus: p.approval_status,
                          receiptNo: p.id.slice(0, 8).toUpperCase(),
                        })}>
                          <FileText />
                        </OwnerIconButton>
                      </div>
                    </OwnerTableCell>
                  </OwnerTableRow>
                ))}
              </OwnerTableBody>
            </>
          )}
        </OwnerTable>
        </div>
      )}

      {/* Record Payment Modal */}
      {recordModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-owner-surface-elevated rounded-owner-2xl w-full max-w-md shadow-owner-lg border border-owner-border animate-owner-scale-in">
            <div className="px-6 py-4 border-b border-owner-border flex items-center justify-between">
              <h2 className="text-base font-bold text-owner-fg">Record Payment</h2>
              <OwnerIconButton aria-label="Close" variant="ghost" size="sm" onClick={() => setRecordModal(false)}>
                <X />
              </OwnerIconButton>
            </div>
            <div className="p-6 space-y-4">
              <OwnerSelect label="Tenant *" value={form.tenant_id} onChange={e => setForm(f => ({ ...f, tenant_id: e.target.value }))}>
                <option value="">Select Tenant</option>
                {tenants.filter(t => t.status === 'active').map(t => (
                  <option key={t.id} value={t.id}>{t.name} — Room {t.room?.room_number}</option>
                ))}
              </OwnerSelect>
              <div className="grid grid-cols-2 gap-3">
                <OwnerSelect
                  label="Type"
                  value={form.type}
                  onChange={e => setForm(f => ({ ...f, type: e.target.value, for_month: e.target.value === 'advance' ? '' : f.for_month }))}
                >
                  {['rent', 'deposit', 'advance'].map(t => <option key={t} value={t} className="capitalize">{t}</option>)}
                </OwnerSelect>
                {form.type !== 'advance' && (
                  <OwnerInput label="For Month" value={form.for_month} onChange={e => setForm(f => ({ ...f, for_month: e.target.value }))} placeholder="e.g. June 2024" />
                )}
                {form.type === 'advance' && (
                  <p className="text-xs text-owner-muted-subtle -mt-2 col-span-1 self-end pb-2">Advance payments auto-apply to the tenant&apos;s next unpaid month(s) — no need to pick a month.</p>
                )}
                <OwnerInput label="Total Due (₹)" type="number" value={form.total_due} onChange={e => setForm(f => ({ ...f, total_due: e.target.value }))} />
                <OwnerInput label="Amount Received (₹) *" type="number" value={form.amount_received} onChange={e => setForm(f => ({ ...f, amount_received: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-semibold text-owner-muted block mb-1.5">Payment Mode</label>
                <div className="flex gap-2">
                  {['cash', 'upi', 'bank_transfer'].map(m => (
                    <button key={m} onClick={() => setForm(f => ({ ...f, method: m }))}
                      className={cn('flex-1 py-2 rounded-owner-lg text-xs font-semibold border transition-colors', form.method === m ? 'border-owner-primary bg-owner-primary/10 text-owner-primary' : 'border-owner-border text-owner-muted hover:bg-owner-surface-hover')}>
                      {m.replace('_', ' ').toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
              <OwnerSelect
                label="Collected By *"
                value={form.collected_by}
                onChange={e => setForm(f => ({ ...f, collected_by: e.target.value }))}
                hint="Add collectors in Settings if list is empty"
              >
                <option value="">Select Collector</option>
                {collectors.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </OwnerSelect>
              <OwnerInput label="Payment Date" type="date" value={form.payment_date} onChange={e => setForm(f => ({ ...f, payment_date: e.target.value }))} />
              {(form.method === 'upi' || form.method === 'bank_transfer') && (
                <OwnerInput
                  label="Transaction / UPI Reference (optional)"
                  value={form.reference_number}
                  onChange={e => setForm(f => ({ ...f, reference_number: e.target.value }))}
                  placeholder="e.g. UPI Ref No."
                  hint="Shown on the payment receipt"
                />
              )}
              <p className="text-xs text-owner-muted bg-owner-bg-subtle rounded-owner-lg p-3">
                Partial payments are supported — only the amount entered above will be recorded. If remaining balance is collected later by a different person, add a separate entry.
              </p>
            </div>
            <div className="px-6 py-4 border-t border-owner-border flex gap-3">
              <OwnerButton onClick={handleRecord} loading={saving} fullWidth>Save Payment</OwnerButton>
              <OwnerButton onClick={() => setRecordModal(false)} variant="secondary" fullWidth>Cancel</OwnerButton>
            </div>
          </div>
        </div>
      )}

      {/* Raise Electricity Bill Modal */}
      {billModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-owner-surface-elevated rounded-owner-2xl w-full max-w-sm shadow-owner-lg border border-owner-border animate-owner-scale-in">
            <div className="px-6 py-4 border-b border-owner-border flex items-center justify-between">
              <h2 className="text-base font-bold text-owner-fg">Raise Electricity Bill</h2>
              <OwnerIconButton aria-label="Close" variant="ghost" size="sm" onClick={() => setBillModal(false)}>
                <X />
              </OwnerIconButton>
            </div>
            <div className="p-6 space-y-4">
              <OwnerSelect label="Tenant *" value={billForm.tenant_id} onChange={e => setBillForm(f => ({ ...f, tenant_id: e.target.value }))}>
                <option value="">Select tenant</option>
                {tenants.filter(t => t.status === 'active').map(t => (
                  <option key={t.id} value={t.id}>{t.name} — Room {t.room?.room_number ?? '—'}</option>
                ))}
              </OwnerSelect>
              <OwnerInput
                label="Billing Month *"
                placeholder="e.g. July 2026"
                value={billForm.for_month}
                onChange={e => setBillForm(f => ({ ...f, for_month: e.target.value }))}
              />
              <div className="grid grid-cols-2 gap-3">
                <OwnerInput label="Amount (₹) *" type="number" value={billForm.amount} onChange={e => setBillForm(f => ({ ...f, amount: e.target.value }))} />
                <OwnerInput label="Due Date" type="date" value={billForm.due_date} onChange={e => setBillForm(f => ({ ...f, due_date: e.target.value }))} />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-owner-border">
              <OwnerButton onClick={handleRaiseBill} loading={billSaving} fullWidth>Raise Bill</OwnerButton>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Reminder Modal — was a dead button (state existed, no UI) */}
      {bulkReminderModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-owner-surface-elevated rounded-owner-2xl w-full max-w-md shadow-owner-lg border border-owner-border max-h-[85vh] flex flex-col animate-owner-scale-in">
            <div className="px-6 py-4 border-b border-owner-border flex items-center justify-between shrink-0">
              <h2 className="text-base font-bold text-owner-fg">Remind All ({pendingRentSorted.length})</h2>
              <OwnerIconButton aria-label="Close" variant="ghost" size="sm" onClick={() => setBulkReminderModal(false)}>
                <X />
              </OwnerIconButton>
            </div>
            <div className="p-4 space-y-2 overflow-y-auto">
              {pendingRentSorted.map(t => {
                const done = remindedPhones.has(t.phone)
                return (
                  <div key={t.id} className="flex items-center justify-between p-3 bg-owner-bg-subtle rounded-owner-lg">
                    <div>
                      <div className="text-sm font-semibold text-owner-fg">{t.name}</div>
                      <div className="text-xs text-owner-muted-subtle owner-numeric">{formatINR(t.remainingDue)} pending</div>
                    </div>
                    <a href={whatsappLink(t.phone, rentReminderMsg(t.name, t.remainingDue, t.property?.name ?? 'PG'))}
                      target="_blank" rel="noreferrer"
                      onClick={() => {
                        setRemindedPhones(prev => new Set(prev).add(t.phone))
                        if (t.auth_user_id) sendPushNotification({ user_ids: [t.auth_user_id], title: '💰 Rent Reminder', body: `${formatINR(t.remainingDue)} rent is due. Please pay soon.`, url: '/portal', tag: 'rent-reminder' })
                      }}
                      className={cn('px-3 py-1.5 rounded-owner-lg text-xs font-bold transition-colors flex items-center gap-1.5', done ? 'bg-owner-success/15 text-owner-success' : 'bg-owner-success text-white hover:bg-owner-success/90')}>
                      <MessageCircle className="w-3.5 h-3.5" /> {done ? 'Reminded' : 'Remind'}
                    </a>
                  </div>
                )
              })}
            </div>
            <div className="p-4 border-t border-owner-border shrink-0">
              <OwnerButton onClick={() => setBulkReminderModal(false)} variant="secondary" fullWidth>Done</OwnerButton>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
