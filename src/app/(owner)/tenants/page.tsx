'use client'
import { useEffect, useState, useCallback } from 'react'
import { useProperty } from '@/components/shared/PropertyContext'
import { getTenants, getAllTenants, addTenantByOwner, updateTenant, getRooms, getPaymentsForTenant, setTenantLeaving, markTenantLeft, getMoveOutChecklist, startMoveOutChecklist, updateMoveOutChecklist, inviteTenant } from '@/lib/supabase/queries'
import { formatINR, formatDate, whatsappLink, rentReminderMsg, cn } from '@/lib/utils'
import { generateReceiptPDF } from '@/lib/pdf'
import { sendPushNotification } from '@/lib/push'
import { toast } from 'sonner'
import { Plus, Search, Phone, MessageCircle, Eye, Pencil, Download, LogOut, Calendar, X, Loader2, Trash2, Send, Copy, Check, ChevronRight } from 'lucide-react'
import type { Tenant } from '@/types'
import {
  OwnerButton, OwnerIconButton, OwnerBadge, OwnerCard, OwnerAvatar, OwnerInput, OwnerSelect, OwnerTextarea, OwnerEmptyState,
  OwnerTable, OwnerTableHead, OwnerTableBody, OwnerTableRow, OwnerTableHeadCell, OwnerTableCell, OwnerTableEmptyRow,
  type OwnerBadgeProps,
} from '@/components/owner/ui'

// Explicit local tone maps (not the generic ownerStatusTone helper) so the
// specific semantics this page already had are preserved exactly —
// pending_approval reads as purple here (to visually stand out from a
// generic "pending" amber), not because of any change in meaning.
const STATUS_TONE: Record<string, NonNullable<OwnerBadgeProps['tone']>> = {
  active: 'success', leaving: 'warning', left: 'neutral', pending_approval: 'purple', invited: 'info',
}
const KYC_TONE: Record<string, NonNullable<OwnerBadgeProps['tone']>> = {
  verified: 'success', pending: 'warning', rejected: 'danger',
}

export default function TenantsPage() {
  const { activeId, active, properties } = useProperty()
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [noticeModal, setNoticeModal] = useState<Tenant | null>(null)
  const [leavingDate, setLeavingDate] = useState('')
  const [checklistTenant, setChecklistTenant] = useState<Tenant | null>(null)
  const [checklist, setChecklist] = useState<any>(null)
  const [checklistLoading, setChecklistLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [roomOptions, setRoomOptions] = useState<{ id: string; room_number: string; sharing_type: string }[]>([])
  const [saving, setSaving] = useState(false)
  const [viewTenant, setViewTenant] = useState<Tenant | null>(null)
  const [viewTenantPayments, setViewTenantPayments] = useState<any[]>([])

  function openView(t: Tenant) {
    setViewTenant(t)
    setViewTenantPayments([])
    getPaymentsForTenant(t.id).then(setViewTenantPayments).catch(() => setViewTenantPayments([]))
  }
  const [editTenant, setEditTenant] = useState<Tenant | null>(null)
  const [editForm, setEditForm] = useState({
    name: '', phone: '', email: '', emergency_contact: '', bed_label: '',
    monthly_rent: '', deposit_amount: '', deposit_paid: '', notice_period_days: '', status: 'active',
    deposit_refunded: '', deposit_refund_date: '', deposit_deduction_notes: '',
    deposit_deduction_items: [] as { label: string; amount: string }[],
  })
  const [editSaving, setEditSaving] = useState(false)

  function openEdit(t: Tenant) {
    setEditTenant(t)
    setEditForm({
      name: t.name, phone: t.phone, email: t.email ?? '', emergency_contact: t.emergency_contact ?? '',
      bed_label: t.bed_label ?? '', monthly_rent: String(t.monthly_rent), deposit_amount: String(t.deposit_amount),
      deposit_paid: String(t.deposit_paid), notice_period_days: String(t.notice_period_days), status: t.status,
      deposit_refunded: String(t.deposit_refunded ?? 0), deposit_refund_date: t.deposit_refund_date ?? '',
      deposit_deduction_notes: t.deposit_deduction_notes ?? '',
      deposit_deduction_items: (t.deposit_deduction_items ?? []).map(i => ({ label: i.label, amount: String(i.amount) })),
    })
  }

  function addDeductionItem() {
    setEditForm(f => ({ ...f, deposit_deduction_items: [...f.deposit_deduction_items, { label: '', amount: '' }] }))
  }
  function updateDeductionItem(idx: number, field: 'label' | 'amount', value: string) {
    setEditForm(f => {
      const items = f.deposit_deduction_items.map((it, i) => i === idx ? { ...it, [field]: value } : it)
      const total = items.reduce((s, it) => s + (Number(it.amount) || 0), 0)
      const suggested = Math.max(0, Number(f.deposit_paid || 0) - total)
      return { ...f, deposit_deduction_items: items, deposit_refunded: String(suggested) }
    })
  }
  function removeDeductionItem(idx: number) {
    setEditForm(f => {
      const items = f.deposit_deduction_items.filter((_, i) => i !== idx)
      const total = items.reduce((s, it) => s + (Number(it.amount) || 0), 0)
      const suggested = Math.max(0, Number(f.deposit_paid || 0) - total)
      return { ...f, deposit_deduction_items: items, deposit_refunded: String(suggested) }
    })
  }

  async function handleEditSave() {
    if (!editTenant) return
    if (!editForm.name.trim()) { toast.error('Name is required'); return }
    if (editForm.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editForm.email)) { toast.error('Enter a valid email address'); return }
    if (!editForm.monthly_rent || Number(editForm.monthly_rent) <= 0) { toast.error('Enter a valid monthly rent'); return }
    const refundAmt = Number(editForm.deposit_refunded || 0)
    const depositPaidAmt = Number(editForm.deposit_paid || 0)
    if (refundAmt > depositPaidAmt) { toast.error('Refund amount cannot exceed deposit paid'); return }
    setEditSaving(true)
    try {
      const deductionItems = editForm.deposit_deduction_items
        .filter(it => it.label.trim())
        .map(it => ({ label: it.label.trim(), amount: Number(it.amount) || 0 }))
      await updateTenant(editTenant.id, {
        name: editForm.name.trim(),
        // Phone is intentionally NOT editable here once a login exists —
        // the tenant's login email is derived from their original phone
        // number, so changing it here would silently break their login.
        email: editForm.email || undefined,
        emergency_contact: editForm.emergency_contact || undefined,
        bed_label: editForm.bed_label || undefined,
        monthly_rent: Number(editForm.monthly_rent),
        deposit_amount: Number(editForm.deposit_amount || 0),
        deposit_paid: depositPaidAmt,
        deposit_refunded: refundAmt,
        deposit_refund_date: editForm.deposit_refund_date || undefined,
        deposit_deduction_notes: editForm.deposit_deduction_notes || undefined,
        deposit_deduction_items: deductionItems,
        notice_period_days: Number(editForm.notice_period_days || 30),
        status: editForm.status as Tenant['status'],
      })
      toast.success('Tenant updated!')
      setEditTenant(null)
      load()
    } catch (e: any) { toast.error(e.message ?? 'Failed to update tenant') }
    setEditSaving(false)
  }

  const [form, setForm] = useState({
    property_id: '', room_id: '', bed_label: '', name: '', phone: '',
    email: '', emergency_contact: '', date_of_birth: '', joining_date: '', monthly_rent: '',
    deposit_amount: '', deposit_paid: '', rent_paid_now: '', notice_period_days: '30', password: '',
  })

  const [inviteModalOpen, setInviteModalOpen] = useState(false)
  const [inviteForm, setInviteForm] = useState({ property_id: '', name: '', phone: '' })
  const [inviting, setInviting] = useState(false)
  const [inviteResult, setInviteResult] = useState<{ name: string; phone: string; tempPassword: string } | null>(null)
  const [copiedPw, setCopiedPw] = useState(false)

  const effectivePropertyId = activeId === 'all' ? form.property_id : activeId
  useEffect(() => {
    if (!effectivePropertyId) { setRoomOptions([]); return }
    getRooms(effectivePropertyId).then(setRoomOptions).catch(() => setRoomOptions([]))
  }, [effectivePropertyId])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = activeId === 'all' 
        ? await getAllTenants()
        : await getTenants(activeId)
      setTenants(data ?? [])
    } catch { toast.error('Failed to load tenants') }
    setLoading(false)
  }, [activeId])

  useEffect(() => { load() }, [load])

  const filtered = tenants.filter(t =>
    (statusFilter === 'all' || t.status === statusFilter) &&
    (t.name.toLowerCase().includes(search.toLowerCase()) ||
     t.phone.includes(search) ||
     t.room?.room_number?.includes(search))
  )

  const onNotice = tenants
    .filter(t => t.status === 'leaving' && t.leaving_date)
    .map(t => ({ ...t, daysLeft: Math.ceil((new Date(t.leaving_date!).getTime() - Date.now()) / 86400000) }))
    .sort((a, b) => a.daysLeft - b.daysLeft)

  async function handleSetNotice() {
    if (!noticeModal || !leavingDate) { toast.error('Pick a leaving date'); return }
    try {
      await setTenantLeaving(noticeModal.id, leavingDate)
      toast.success(`${noticeModal.name} marked as leaving on ${leavingDate}`)
      setNoticeModal(null); setLeavingDate('')
      load()
    } catch (e: any) { toast.error(e.message) }
  }

  async function handleMarkLeft(tenantId: string, name: string) {
    if (!confirm(`Mark ${name} as left? This should be done after move-out and final settlement.`)) return
    try {
      await markTenantLeft(tenantId)
      toast.success(`${name} marked as left`)
      load()
    } catch (e: any) { toast.error(e.message) }
  }

  async function openChecklist(t: Tenant) {
    setChecklistTenant(t)
    setChecklistLoading(true)
    try {
      const existing = await getMoveOutChecklist(t.id)
      const c = existing || await startMoveOutChecklist(t.id, t.property_id)
      setChecklist(c)
    } catch (e: any) { toast.error(e.message); setChecklistTenant(null) }
    setChecklistLoading(false)
  }

  async function toggleChecklistItem(idx: number) {
    if (!checklist) return
    const items = checklist.items.map((it: any, i: number) =>
      i === idx ? { ...it, checked: !it.checked } : it)
    setChecklist({ ...checklist, items }) // optimistic
    try {
      const updated = await updateMoveOutChecklist(checklist.id, items)
      setChecklist(updated)
    } catch (e: any) { toast.error(e.message) }
  }

  async function handleAdd() {
    if (!form.name.trim() || !form.phone || !form.joining_date || !form.password) {
      toast.error('Fill all required fields'); return
    }
    if (!effectivePropertyId) { toast.error('Select a property'); return }
    const digitsOnly = form.phone.replace(/\D/g, '')
    if (digitsOnly.length < 10) { toast.error('Enter a valid 10-digit mobile number'); return }
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) { toast.error('Enter a valid email address'); return }
    if (!form.monthly_rent || Number(form.monthly_rent) <= 0) { toast.error('Enter a valid monthly rent'); return }
    if (form.password.length < 6) { toast.error('Password must be at least 6 characters'); return }
    setSaving(true)
    try {
      await addTenantByOwner({
        property_id: effectivePropertyId,
        room_id: form.room_id || null,
        bed_label: form.bed_label,
        name: form.name.trim(),
        phone: form.phone,
        email: form.email,
        emergency_contact: form.emergency_contact,
        date_of_birth: form.date_of_birth || undefined,
        joining_date: form.joining_date,
        monthly_rent: Number(form.monthly_rent),
        deposit_amount: Number(form.deposit_amount || 0),
        deposit_paid: Number(form.deposit_paid || 0),
        rent_paid_now: Number(form.rent_paid_now || 0),
        notice_period_days: Number(form.notice_period_days || 30),
        password: form.password,
      })
      toast.success('Tenant added & login created!')
      setModalOpen(false)
      setForm({ property_id: '', room_id: '', bed_label: '', name: '', phone: '', email: '', emergency_contact: '', date_of_birth: '', joining_date: '', monthly_rent: '', deposit_amount: '', deposit_paid: '', rent_paid_now: '', notice_period_days: '30', password: '' })
      load()
    } catch (e: any) { toast.error(e.message) }
    setSaving(false)
  }

  const effectiveInvitePropertyId = activeId === 'all' ? inviteForm.property_id : activeId

  async function handleInvite() {
    if (!inviteForm.name.trim()) { toast.error("Enter the tenant's name"); return }
    const digitsOnly = inviteForm.phone.replace(/\D/g, '')
    if (digitsOnly.length < 10) { toast.error('Enter a valid 10-digit mobile number'); return }
    if (!effectiveInvitePropertyId) { toast.error('Select a property'); return }
    setInviting(true)
    try {
      const { tenant, tempPassword } = await inviteTenant({
        property_id: effectiveInvitePropertyId,
        name: inviteForm.name.trim(),
        phone: inviteForm.phone,
      })
      setInviteResult({ name: tenant.name, phone: tenant.phone, tempPassword })
      // Phase 8.6 — onboarding notification. Best-effort: the tenant hasn't
      // logged in yet at this point so there's usually no push subscription
      // to deliver to, but this reuses the exact same fire-and-forget
      // sendPushNotification() call already used everywhere else, so it
      // costs nothing and delivers once they do enable push later.
      if (tenant.auth_user_id) {
        sendPushNotification({
          user_ids: [tenant.auth_user_id],
          title: '👋 Welcome!',
          body: `You've been invited to join. Log in and change your password to get started.`,
          url: '/portal', tag: 'onboarding-invitation',
        })
      }
      load()
    } catch (e: any) { toast.error(e.message) }
    setInviting(false)
  }

  function closeInviteModal() {
    setInviteModalOpen(false)
    setInviteForm({ property_id: '', name: '', phone: '' })
    setInviteResult(null)
    setCopiedPw(false)
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-extrabold text-owner-fg">Tenants</h1>
          <p className="text-sm text-owner-muted">{tenants.filter(t => t.status === 'active').length} active tenants</p>
        </div>
        <div className="flex gap-2">
          <OwnerButton onClick={() => setInviteModalOpen(true)} variant="secondary" icon={<Send className="w-4 h-4" />}>
            Invite Tenant
          </OwnerButton>
          <OwnerButton onClick={() => setModalOpen(true)} icon={<Plus className="w-4 h-4" />}>
            Add Tenant
          </OwnerButton>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap items-center">
        <div className="flex-1 min-w-[200px]">
          <OwnerInput
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, phone, room..."
            leftIcon={<Search />}
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {['all', 'active', 'invited', 'leaving', 'pending_approval'].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={cn(
                'px-3 py-1.5 rounded-owner-full text-xs font-semibold transition-colors',
                statusFilter === s ? 'bg-owner-primary text-owner-primary-fg' : 'bg-owner-surface-hover text-owner-muted hover:text-owner-fg'
              )}>
              {s === 'all' ? 'All' : s === 'pending_approval' ? 'Pending' : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Notice Period Tracker */}
      {onNotice.length > 0 && (
        <OwnerCard className="bg-owner-warning-subtle border-owner-warning/25">
          <div className="flex items-center gap-2 mb-3">
            <Calendar className="w-4 h-4 text-owner-warning" />
            <span className="text-sm font-bold text-owner-fg">Tenants on Notice Period ({onNotice.length})</span>
          </div>
          <div className="space-y-2">
            {onNotice.map(t => (
              <div key={t.id} className="flex flex-wrap items-center gap-2 bg-owner-surface rounded-owner-lg p-3">
                <OwnerAvatar name={t.name} size="sm" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-owner-fg truncate">{t.name} <span className="text-owner-muted-subtle font-normal">· Room {t.room?.room_number}</span></div>
                  <div className="text-xs text-owner-muted">Leaving on {formatDate(t.leaving_date!)}</div>
                </div>
                <OwnerBadge tone={t.daysLeft <= 3 ? 'danger' : 'warning'} className="shrink-0">
                  {t.daysLeft > 0 ? `${t.daysLeft}d left` : t.daysLeft === 0 ? 'Leaving today' : `${Math.abs(t.daysLeft)}d overdue`}
                </OwnerBadge>
                <div className="flex items-center gap-2 w-full sm:w-auto sm:ml-auto">
                  <OwnerButton onClick={() => openChecklist(t)} variant="secondary" size="sm" className="flex-1 sm:flex-none">
                    Checklist
                  </OwnerButton>
                  <OwnerButton onClick={() => handleMarkLeft(t.id, t.name)} variant="secondary" size="sm" icon={<LogOut className="w-3.5 h-3.5" />} className="flex-1 sm:flex-none">
                    Mark Left
                  </OwnerButton>
                </div>
              </div>
            ))}
          </div>
        </OwnerCard>
      )}

      {/* Table */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-14 rounded-owner-lg bg-owner-surface-hover animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <OwnerEmptyState icon={Search} title="No tenants found" />
      ) : (
        <>
          {/* Mobile: stacked card list, no horizontal scroll */}
          <div className="sm:hidden space-y-2">
            {filtered.map(t => (
              <button key={t.id} onClick={() => openView(t)}
                className="w-full bg-owner-surface border border-owner-border rounded-owner-lg p-3.5 flex items-center gap-3 text-left transition active:scale-[0.99] active:bg-owner-surface-hover">
                <OwnerAvatar name={t.name} size="sm" />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-owner-fg truncate">{t.name}</div>
                  <div className="text-xs text-owner-muted-subtle mt-0.5 truncate">
                    {t.room ? `Room ${t.room.room_number}` : 'No room'}{t.bed_label ? ` · ${t.bed_label}` : ''} · {formatINR(t.monthly_rent)}/mo
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <OwnerBadge tone={STATUS_TONE[t.status]} className="capitalize">
                    {t.status.replace('_', ' ')}
                  </OwnerBadge>
                  {t.deposit_paid < t.deposit_amount && (
                    <span className="text-[10px] font-semibold text-owner-warning">Deposit due</span>
                  )}
                </div>
                <ChevronRight className="w-4 h-4 text-owner-muted-subtle shrink-0" />
              </button>
            ))}
          </div>
          {/* Desktop/tablet: full table */}
          <div className="hidden sm:block">
            <OwnerTable>
              <OwnerTableHead>
                <tr>
                  {['Tenant', 'Phone', 'Room/Bed', 'Rent', 'Deposit', 'Joining', 'KYC', 'Status', 'Remind', 'Actions'].map(h => (
                    <OwnerTableHeadCell key={h}>{h}</OwnerTableHeadCell>
                  ))}
                </tr>
              </OwnerTableHead>
              <OwnerTableBody>
                {filtered.map(t => (
                  <OwnerTableRow key={t.id}>
                    <OwnerTableCell>
                      <div className="flex items-center gap-2.5">
                        <OwnerAvatar name={t.name} size="sm" />
                        <div>
                          <div className="font-semibold text-owner-fg">{t.name}</div>
                          <div className="text-xs text-owner-muted-subtle">{t.email || '—'}</div>
                        </div>
                      </div>
                    </OwnerTableCell>
                    <OwnerTableCell className="font-mono text-xs">{t.phone}</OwnerTableCell>
                    <OwnerTableCell>
                      <span className="font-semibold">
                        {t.room ? `Room ${t.room.room_number}` : '—'}
                        {t.bed_label ? ` · ${t.bed_label}` : ''}
                      </span>
                    </OwnerTableCell>
                    <OwnerTableCell className="font-bold text-owner-primary owner-numeric">{formatINR(t.monthly_rent)}</OwnerTableCell>
                    <OwnerTableCell>
                      <div className="text-xs owner-numeric">
                        <span className="font-bold text-owner-fg">{formatINR(t.deposit_paid)}</span>
                        <span className="text-owner-muted-subtle"> / {formatINR(t.deposit_amount)}</span>
                      </div>
                      {t.deposit_paid < t.deposit_amount && (
                        <span className="text-xs text-owner-warning font-semibold">₹{(t.deposit_amount - t.deposit_paid).toLocaleString('en-IN')} pending</span>
                      )}
                    </OwnerTableCell>
                    <OwnerTableCell className="text-xs text-owner-muted">{formatDate(t.joining_date)}</OwnerTableCell>
                    <OwnerTableCell>
                      <div className="flex gap-1">
                        <OwnerBadge tone={KYC_TONE[t.aadhaar_status]} size="sm">ID</OwnerBadge>
                        <OwnerBadge tone={KYC_TONE[t.pan_status]} size="sm">PAN</OwnerBadge>
                      </div>
                    </OwnerTableCell>
                    <OwnerTableCell>
                      <OwnerBadge tone={STATUS_TONE[t.status]} className="capitalize">
                        {t.status.replace('_', ' ')}
                      </OwnerBadge>
                    </OwnerTableCell>
                    <OwnerTableCell>
                      <div className="flex gap-1.5">
                        <a href={whatsappLink(t.phone, rentReminderMsg(t.name, t.monthly_rent, t.property?.name ?? 'PG'))}
                          target="_blank" rel="noreferrer"
                          className="p-1.5 bg-owner-success/15 hover:bg-owner-success/25 rounded-owner-md transition-colors" title="WhatsApp">
                          <MessageCircle className="w-3.5 h-3.5 text-owner-success" />
                        </a>
                        <a href={`tel:${t.phone}`}
                          className="p-1.5 bg-owner-info/15 hover:bg-owner-info/25 rounded-owner-md transition-colors" title="Call">
                          <Phone className="w-3.5 h-3.5 text-owner-info" />
                        </a>
                      </div>
                    </OwnerTableCell>
                    <OwnerTableCell>
                      <div className="flex gap-1">
                        <OwnerIconButton aria-label={`View ${t.name}`} variant="ghost" size="sm" onClick={() => openView(t)}><Eye /></OwnerIconButton>
                        <OwnerIconButton aria-label={`Edit ${t.name}`} variant="ghost" size="sm" onClick={() => openEdit(t)}><Pencil /></OwnerIconButton>
                        {t.status === 'active' && (
                          <OwnerIconButton aria-label={`Give notice to ${t.name}`} variant="ghost" size="sm" onClick={() => { setNoticeModal(t); setLeavingDate('') }} className="hover:text-owner-warning" title="Give notice / mark leaving">
                            <LogOut />
                          </OwnerIconButton>
                        )}
                      </div>
                    </OwnerTableCell>
                  </OwnerTableRow>
                ))}
              </OwnerTableBody>
            </OwnerTable>
          </div>
        </>
      )}

      {/* Add Tenant Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-owner-surface-elevated rounded-owner-2xl w-full max-w-2xl shadow-owner-lg border border-owner-border my-4 animate-owner-scale-in">
            <div className="px-6 py-4 border-b border-owner-border flex items-center justify-between">
              <h2 className="text-base font-bold text-owner-fg">Add New Tenant</h2>
              <OwnerIconButton aria-label="Close" variant="ghost" size="sm" onClick={() => setModalOpen(false)}>
                <X />
              </OwnerIconButton>
            </div>
            <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4 overflow-y-auto max-h-[75vh]">

              {/* Property selector (only when "all" is selected) */}
              {activeId === 'all' && (
                <div className="sm:col-span-2">
                  <OwnerSelect label="Property *" value={form.property_id} onChange={e => setForm(f => ({ ...f, property_id: e.target.value }))}>
                    <option value="">Select Property</option>
                    {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </OwnerSelect>
                </div>
              )}

              {/* Room selector — dropdown of actual rooms, not a free-text UUID field */}
              <OwnerSelect
                label="Room"
                value={form.room_id}
                onChange={e => setForm(f => ({ ...f, room_id: e.target.value }))}
                disabled={!effectivePropertyId}
              >
                <option value="">{effectivePropertyId ? 'No room / unassigned' : 'Select a property first'}</option>
                {roomOptions.map(r => (
                  <option key={r.id} value={r.id}>Room {r.room_number} ({r.sharing_type})</option>
                ))}
              </OwnerSelect>

              {[
                { key: 'name', label: 'Full Name', required: true },
                { key: 'phone', label: 'Mobile Number', required: true, type: 'tel' },
                { key: 'email', label: 'Email' },
                { key: 'emergency_contact', label: 'Emergency Contact', type: 'tel' },
                { key: 'date_of_birth', label: 'Date of Birth (optional)', type: 'date' },
                { key: 'bed_label', label: 'Bed Label (A/B/C)' },
                { key: 'joining_date', label: 'Joining Date', required: true, type: 'date' },
                { key: 'notice_period_days', label: 'Notice Period (days)' },
                { key: 'monthly_rent', label: 'Monthly Rent (₹)', required: true, type: 'number' },
                { key: 'deposit_amount', label: 'Total Deposit (₹)', type: 'number' },
                { key: 'deposit_paid', label: 'Deposit Paid Now (₹)', type: 'number' },
                { key: 'rent_paid_now', label: 'Rent Paid Now (₹)', type: 'number' },
              ].map(({ key, label, required, type }) => (
                <OwnerInput
                  key={key}
                  label={`${label}${required ? ' *' : ''}`}
                  type={type ?? 'text'}
                  value={(form as any)[key]}
                  onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                />
              ))}

              <div className="sm:col-span-2 border-t border-owner-border pt-4">
                <p className="text-xs font-bold text-owner-muted uppercase tracking-wide mb-3">Tenant Login</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <OwnerInput label="Username (auto = phone)" disabled value={form.phone} />
                  <OwnerInput
                    label="Set Password *"
                    type="password"
                    value={form.password}
                    onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                    placeholder="Tenant can change later"
                  />
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-owner-border flex gap-3">
              <OwnerButton onClick={handleAdd} loading={saving} fullWidth>
                {saving ? 'Adding…' : 'Add Tenant & Create Login'}
              </OwnerButton>
              <OwnerButton onClick={() => setModalOpen(false)} variant="secondary" fullWidth>
                Cancel
              </OwnerButton>
            </div>
          </div>
        </div>
      )}

      {/* Invite Tenant Modal — Phase 8.1: minimal-entry alternative to Add Tenant */}
      {inviteModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-owner-surface-elevated rounded-owner-2xl w-full max-w-md shadow-owner-lg border border-owner-border my-4 animate-owner-scale-in">
            <div className="px-6 py-4 border-b border-owner-border flex items-center justify-between">
              <h2 className="text-base font-bold text-owner-fg">{inviteResult ? 'Invitation Sent' : 'Invite Tenant'}</h2>
              <OwnerIconButton aria-label="Close" variant="ghost" size="sm" onClick={closeInviteModal}>
                <X />
              </OwnerIconButton>
            </div>

            {inviteResult ? (
              <div className="p-6 space-y-4">
                <p className="text-sm text-owner-muted">
                  Share these login details with <span className="font-semibold text-owner-fg">{inviteResult.name}</span> so
                  they can log in and complete their profile. They&apos;ll be asked to set their own password on first login.
                </p>
                <div className="bg-owner-surface rounded-owner-lg border border-owner-border p-4 space-y-3">
                  <div>
                    <div className="text-xs font-semibold text-owner-muted mb-1">Mobile Number</div>
                    <div className="text-sm font-bold text-owner-fg owner-numeric">{inviteResult.phone}</div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-owner-muted mb-1">Temporary Password</div>
                    <div className="flex items-center gap-2">
                      <div className="text-sm font-bold text-owner-fg owner-numeric flex-1">{inviteResult.tempPassword}</div>
                      <OwnerIconButton
                        aria-label="Copy password"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          navigator.clipboard.writeText(inviteResult.tempPassword)
                          setCopiedPw(true)
                          toast.success('Password copied')
                          setTimeout(() => setCopiedPw(false), 2000)
                        }}
                      >
                        {copiedPw ? <Check className="text-owner-success" /> : <Copy />}
                      </OwnerIconButton>
                    </div>
                  </div>
                </div>
                <p className="text-xs text-owner-muted-subtle">
                  This password won&apos;t be shown again — copy it now, or reset it later from the tenant&apos;s profile.
                </p>
                <OwnerButton onClick={closeInviteModal} fullWidth>Done</OwnerButton>
              </div>
            ) : (
              <>
                <div className="p-6 space-y-4">
                  <p className="text-sm text-owner-muted">
                    Just their name and number — the tenant logs in and fills out the rest of their profile themselves.
                    You&apos;ll review and approve it before they&apos;re marked active.
                  </p>
                  {activeId === 'all' && (
                    <OwnerSelect label="Property *" value={inviteForm.property_id} onChange={e => setInviteForm(f => ({ ...f, property_id: e.target.value }))}>
                      <option value="">Select property</option>
                      {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </OwnerSelect>
                  )}
                  <OwnerInput label="Tenant Name *" value={inviteForm.name} onChange={e => setInviteForm(f => ({ ...f, name: e.target.value }))} placeholder="Full name" />
                  <OwnerInput label="Mobile Number *" value={inviteForm.phone} onChange={e => setInviteForm(f => ({ ...f, phone: e.target.value }))} placeholder="10-digit mobile number" />
                </div>
                <div className="px-6 py-4 border-t border-owner-border flex gap-3">
                  <OwnerButton onClick={handleInvite} loading={inviting} fullWidth icon={inviting ? undefined : <Send className="w-4 h-4" />}>
                    {inviting ? 'Sending…' : 'Send Invitation'}
                  </OwnerButton>
                  <OwnerButton onClick={closeInviteModal} variant="secondary" fullWidth>
                    Cancel
                  </OwnerButton>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* View Tenant Modal */}
      {viewTenant && (
        <>
          <div onClick={() => setViewTenant(null)} className="fixed inset-0 bg-black/40 z-50 transition-opacity" />
          <div className="fixed inset-x-0 bottom-0 z-50 bg-owner-surface-elevated rounded-t-3xl shadow-owner-lg max-h-[85vh] flex flex-col animate-owner-scale-in">
            <div className="flex justify-center pt-2.5 pb-1 shrink-0">
              <div className="h-1 w-9 rounded-full bg-owner-border-strong" />
            </div>
            <div className="px-5 pb-4 pt-1 flex items-center gap-3 border-b border-owner-border shrink-0">
              <OwnerAvatar name={viewTenant.name} size="sm" />
              <div className="min-w-0 flex-1">
                <div className="text-[11px] font-bold text-owner-muted uppercase tracking-wide">Tenant Details</div>
                <div className="font-bold text-owner-fg truncate">{viewTenant.name}</div>
              </div>
              <OwnerBadge tone={STATUS_TONE[viewTenant.status]} className="capitalize shrink-0">{viewTenant.status.replace('_', ' ')}</OwnerBadge>
              <OwnerIconButton aria-label="Close" variant="ghost" size="sm" onClick={() => setViewTenant(null)}>
                <X />
              </OwnerIconButton>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                {[
                  ['Phone', viewTenant.phone],
                  ['Email', viewTenant.email || '—'],
                  ['Room', viewTenant.room ? `Room ${viewTenant.room.room_number}` : '—'],
                  ['Bed', viewTenant.bed_label || '—'],
                  ['Monthly Rent', formatINR(viewTenant.monthly_rent)],
                  ['Joining Date', formatDate(viewTenant.joining_date)],
                  ['Deposit', `${formatINR(viewTenant.deposit_paid)} / ${formatINR(viewTenant.deposit_amount)}`],
                  ['Notice Period', `${viewTenant.notice_period_days} days`],
                  ['Emergency Contact', viewTenant.emergency_contact || '—'],
                ].map(([label, value]) => (
                  <div key={label} className="bg-owner-surface-hover rounded-xl p-3">
                    <div className="text-[10px] text-owner-muted-subtle uppercase font-bold">{label}</div>
                    <div className="text-sm font-semibold text-owner-fg mt-0.5">{value}</div>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <OwnerBadge tone={KYC_TONE[viewTenant.aadhaar_status]} className="capitalize">Aadhaar: {viewTenant.aadhaar_status}</OwnerBadge>
                <OwnerBadge tone={KYC_TONE[viewTenant.pan_status]} className="capitalize">PAN: {viewTenant.pan_status}</OwnerBadge>
              </div>

              <div>
                <div className="text-xs font-bold text-owner-muted uppercase tracking-wide mb-2">Rent History</div>
                {viewTenantPayments.length === 0 ? (
                  <OwnerEmptyState icon={Download} title="No payments recorded yet" className="py-6" />
                ) : (
                  <div className="space-y-1.5">
                    {viewTenantPayments.map(p => (
                      <div key={p.id} className="flex items-center justify-between py-1.5 border-b border-owner-border last:border-0">
                        <div>
                          <div className="text-xs font-semibold text-owner-fg">{p.for_month ?? p.type} · {formatINR(p.amount_received)}</div>
                          <div className="text-[11px] text-owner-muted-subtle">{formatDate(p.payment_date)} · <span className="capitalize">{p.approval_status.replace('_', ' ')}</span></div>
                        </div>
                        {p.approval_status === 'approved' && (
                          <OwnerIconButton aria-label="Download receipt" variant="ghost" size="sm" onClick={() => generateReceiptPDF({
                            tenantName: viewTenant.name, propertyName: viewTenant.property?.name ?? 'PG',
                            roomNumber: viewTenant.room?.room_number, forMonth: p.for_month ?? undefined, type: p.type,
                            totalDue: p.total_due, amountReceived: p.amount_received, method: p.method ?? undefined,
                            paymentDate: p.payment_date, approvalStatus: p.approval_status, receiptNo: p.id.slice(0, 8).toUpperCase(),
                          })}>
                            <Download />
                          </OwnerIconButton>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            {/* Actions at bottom — quick-contact row + management actions */}
            <div className="px-5 py-4 border-t border-owner-border shrink-0 space-y-2.5" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
              <div className="flex gap-2.5">
                <a href={whatsappLink(viewTenant.phone, rentReminderMsg(viewTenant.name, viewTenant.monthly_rent, viewTenant.property?.name ?? 'PG'))}
                  target="_blank" rel="noreferrer"
                  className="flex-1 h-11 flex items-center justify-center gap-1.5 bg-owner-success/15 hover:bg-owner-success/25 active:scale-[0.98] text-owner-success rounded-2xl text-xs font-bold transition">
                  <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
                </a>
                <a href={`tel:${viewTenant.phone}`}
                  className="flex-1 h-11 flex items-center justify-center gap-1.5 bg-owner-info/15 hover:bg-owner-info/25 active:scale-[0.98] text-owner-info rounded-2xl text-xs font-bold transition">
                  <Phone className="w-3.5 h-3.5" /> Call
                </a>
              </div>
              <div className="flex gap-2.5">
                <button onClick={() => { const t = viewTenant; setViewTenant(null); openEdit(t) }}
                  className="flex-1 h-12 flex items-center justify-center gap-1.5 bg-owner-primary hover:opacity-90 active:scale-[0.98] text-white rounded-2xl text-sm font-bold transition">
                  <Pencil className="w-4 h-4" /> Edit Tenant
                </button>
                {viewTenant.status === 'active' && (
                  <button onClick={() => { const t = viewTenant; setViewTenant(null); setNoticeModal(t); setLeavingDate('') }}
                    className="flex-1 h-12 flex items-center justify-center gap-1.5 bg-owner-warning/15 hover:bg-owner-warning/25 active:scale-[0.98] text-owner-warning rounded-2xl text-sm font-bold transition">
                    <LogOut className="w-4 h-4" /> Give Notice
                  </button>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Edit Tenant Modal */}
      {editTenant && (
        <>
          <div onClick={() => setEditTenant(null)} className="fixed inset-0 bg-black/40 z-50 transition-opacity" />
          <div className="fixed inset-x-0 bottom-0 z-50 bg-owner-surface-elevated rounded-t-3xl shadow-owner-lg max-h-[85vh] flex flex-col animate-owner-scale-in">
            <div className="flex justify-center pt-2.5 pb-1 shrink-0">
              <div className="h-1 w-9 rounded-full bg-owner-border-strong" />
            </div>
            <div className="px-5 pb-4 pt-1 flex items-center gap-3 border-b border-owner-border shrink-0">
              <OwnerAvatar name={editTenant.name} size="sm" />
              <div className="min-w-0 flex-1">
                <div className="text-[11px] font-bold text-owner-muted uppercase tracking-wide">Edit Tenant</div>
                <div className="font-bold text-owner-fg truncate">{editTenant.name}</div>
              </div>
              <OwnerIconButton aria-label="Close" variant="ghost" size="sm" onClick={() => setEditTenant(null)}>
                <X />
              </OwnerIconButton>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <OwnerInput
                label="Mobile Number (login username)"
                type="tel"
                value={editForm.phone}
                disabled
                hint="Can't be changed here — it's tied to the tenant's login."
              />
              {[
                { key: 'name', label: 'Full Name' },
                { key: 'email', label: 'Email' },
                { key: 'emergency_contact', label: 'Emergency Contact', type: 'tel' },
                { key: 'bed_label', label: 'Bed Label (A/B/C)' },
                { key: 'monthly_rent', label: 'Monthly Rent (₹)', type: 'number' },
                { key: 'deposit_amount', label: 'Total Deposit (₹)', type: 'number' },
                { key: 'deposit_paid', label: 'Deposit Paid (₹)', type: 'number' },
                { key: 'notice_period_days', label: 'Notice Period (days)', type: 'number' },
              ].map(({ key, label, type }) => (
                <OwnerInput
                  key={key}
                  label={label}
                  type={type ?? 'text'}
                  value={(editForm as any)[key]}
                  onChange={e => setEditForm(f => ({ ...f, [key]: e.target.value }))}
                />
              ))}
              <OwnerSelect
                label="Status"
                value={editForm.status}
                onChange={e => setEditForm(f => ({ ...f, status: e.target.value }))}
              >
                {['active', 'leaving', 'left', 'pending_approval'].map(s => (
                  <option key={s} value={s}>{s.replace('_', ' ')}</option>
                ))}
              </OwnerSelect>

              {(editForm.status === 'leaving' || editForm.status === 'left') && (
                <div className="sm:col-span-2 bg-owner-warning-subtle rounded-owner-xl p-4 space-y-3">
                  <div className="text-xs font-bold text-owner-warning">Deposit Refund / Adjustment</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <OwnerInput
                      label="Amount Refunded (₹)"
                      type="number"
                      value={editForm.deposit_refunded}
                      onChange={e => setEditForm(f => ({ ...f, deposit_refunded: e.target.value }))}
                    />
                    <OwnerInput
                      label="Refund Date"
                      type="date"
                      value={editForm.deposit_refund_date}
                      onChange={e => setEditForm(f => ({ ...f, deposit_refund_date: e.target.value }))}
                    />
                  </div>

                  {/* Itemized deductions (Phase 3.5) — auto-suggests the refund
                      amount above as items are added/edited/removed. */}
                  <div className="space-y-2">
                    <div className="text-xs font-bold text-owner-fg">Itemized Deductions</div>
                    {editForm.deposit_deduction_items.map((item, idx) => (
                      <div key={idx} className="flex gap-2 items-center">
                        <input
                          value={item.label}
                          onChange={e => updateDeductionItem(idx, 'label', e.target.value)}
                          placeholder="e.g. Wall damage"
                          className="flex-1 px-3 py-2 border border-owner-border rounded-owner-lg text-sm bg-owner-surface text-owner-fg focus:outline-none focus:border-owner-primary"
                        />
                        <input
                          type="number"
                          value={item.amount}
                          onChange={e => updateDeductionItem(idx, 'amount', e.target.value)}
                          placeholder="₹"
                          className="w-24 px-3 py-2 border border-owner-border rounded-owner-lg text-sm bg-owner-surface text-owner-fg focus:outline-none focus:border-owner-primary"
                        />
                        <OwnerIconButton aria-label="Remove deduction" variant="ghost" size="sm" onClick={() => removeDeductionItem(idx)} className="hover:text-owner-danger">
                          <Trash2 />
                        </OwnerIconButton>
                      </div>
                    ))}
                    <OwnerButton onClick={addDeductionItem} variant="secondary" size="sm" icon={<Plus className="w-3.5 h-3.5" />}>
                      Add Deduction
                    </OwnerButton>
                  </div>

                  <OwnerTextarea
                    label="Deduction Notes (damages, dues, etc.)"
                    rows={2}
                    value={editForm.deposit_deduction_notes}
                    onChange={e => setEditForm(f => ({ ...f, deposit_deduction_notes: e.target.value }))}
                  />
                  <div className="text-xs text-owner-muted">
                    Deposit paid: {formatINR(Number(editForm.deposit_paid || 0))} · Remaining to refund: {formatINR(Math.max(0, Number(editForm.deposit_paid || 0) - Number(editForm.deposit_refunded || 0)))}
                  </div>
                </div>
              )}
            </div>
            <div className="px-5 py-4 border-t border-owner-border shrink-0 flex gap-2.5" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
              <button onClick={() => setEditTenant(null)}
                className="flex-1 h-12 flex items-center justify-center gap-1.5 bg-owner-surface-hover hover:opacity-80 active:scale-[0.98] text-owner-fg rounded-2xl text-sm font-bold transition">
                Cancel
              </button>
              <button onClick={handleEditSave} disabled={editSaving}
                className="flex-1 h-12 flex items-center justify-center gap-1.5 bg-owner-primary hover:opacity-90 active:scale-[0.98] text-white rounded-2xl text-sm font-bold transition disabled:opacity-50">
                {editSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : null} {editSaving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Notice-Period Modal — the "Give Notice" button in the table (and
          handleSetNotice()/setTenantLeaving() above) already existed and
          worked; there was simply no dialog anywhere to trigger it from.
          This is that missing dialog — zero new business logic, just the
          UI for a handler that was already fully written. */}
      {noticeModal && (
        <>
          <div onClick={() => { setNoticeModal(null); setLeavingDate('') }} className="fixed inset-0 bg-black/40 z-50 transition-opacity" />
          <div className="fixed inset-x-0 bottom-0 z-50 bg-owner-surface-elevated rounded-t-3xl shadow-owner-lg max-h-[85vh] flex flex-col animate-owner-scale-in">
            <div className="flex justify-center pt-2.5 pb-1 shrink-0">
              <div className="h-1 w-9 rounded-full bg-owner-border-strong" />
            </div>
            <div className="px-5 pb-4 pt-1 flex items-center gap-3 border-b border-owner-border shrink-0">
              <OwnerAvatar name={noticeModal.name} size="sm" />
              <div className="min-w-0 flex-1">
                <div className="text-[11px] font-bold text-owner-muted uppercase tracking-wide">Give Notice</div>
                <div className="font-bold text-owner-fg truncate">{noticeModal.name}</div>
              </div>
              <OwnerIconButton aria-label="Close" variant="ghost" size="sm" onClick={() => { setNoticeModal(null); setLeavingDate('') }}>
                <X />
              </OwnerIconButton>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              <p className="text-sm text-owner-muted bg-owner-surface-hover rounded-xl px-3 py-2.5">
                Set a leaving date for <span className="font-semibold text-owner-fg">{noticeModal.name}</span>. They&apos;ll be moved to
                &quot;Leaving&quot; status and appear in the Notice Period tracker until then.
              </p>
              <OwnerInput
                label="Leaving Date *"
                type="date"
                value={leavingDate}
                onChange={e => setLeavingDate(e.target.value)}
              />
            </div>
            <div className="px-5 py-4 border-t border-owner-border shrink-0 flex gap-2.5" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
              <button onClick={() => { setNoticeModal(null); setLeavingDate('') }}
                className="flex-1 h-12 flex items-center justify-center gap-1.5 bg-owner-surface-hover hover:opacity-80 active:scale-[0.98] text-owner-fg rounded-2xl text-sm font-bold transition">
                Cancel
              </button>
              <button onClick={handleSetNotice}
                className="flex-1 h-12 flex items-center justify-center gap-1.5 bg-owner-primary hover:opacity-90 active:scale-[0.98] text-white rounded-2xl text-sm font-bold transition">
                Confirm
              </button>
            </div>
          </div>
        </>
      )}

      {/* Move-Out Checklist (Phase 3.4) — kept in its original literal-Tailwind
          styling rather than restyled to owner-* tokens, since the app-wide
          dark-theme CSS overrides (globals.css) already cover it correctly;
          restyling every ported feature is a larger effort than this merge
          covers. Functions identically to the redesigned surfaces around it. */}
      {checklistTenant && (
        <>
          <div onClick={() => { setChecklistTenant(null); setChecklist(null) }} className="fixed inset-0 bg-black/40 z-50 transition-opacity" />
          <div className="fixed inset-x-0 bottom-0 z-50 bg-owner-surface-elevated rounded-t-3xl shadow-owner-lg max-h-[85vh] flex flex-col animate-owner-scale-in">
            <div className="flex justify-center pt-2.5 pb-1 shrink-0">
              <div className="h-1 w-9 rounded-full bg-owner-border-strong" />
            </div>
            <div className="px-5 pb-4 pt-1 flex items-center gap-3 border-b border-owner-border shrink-0">
              <OwnerAvatar name={checklistTenant.name} size="sm" />
              <div className="min-w-0 flex-1">
                <div className="text-[11px] font-bold text-owner-muted uppercase tracking-wide">Move-Out Checklist</div>
                <div className="font-bold text-owner-fg truncate">{checklistTenant.name} <span className="text-owner-muted-subtle font-normal text-xs">· Room {checklistTenant.room?.room_number}</span></div>
              </div>
              <OwnerIconButton aria-label="Close" variant="ghost" size="sm" onClick={() => { setChecklistTenant(null); setChecklist(null) }}>
                <X />
              </OwnerIconButton>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
              {checklistLoading || !checklist ? (
                <div className="flex items-center justify-center py-10 text-owner-muted"><Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading…</div>
              ) : (
                <div className="space-y-2">
                  {checklist.items.map((item: any, idx: number) => (
                    <button key={idx} onClick={() => toggleChecklistItem(idx)}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition active:scale-[0.99] ${item.checked ? 'bg-owner-success-subtle border-owner-success/30' : 'bg-owner-surface-hover border-owner-border hover:opacity-80'}`}>
                      <span className="text-lg">{item.checked ? '✅' : '⬜'}</span>
                      <span className={`text-sm ${item.checked ? 'text-owner-success line-through' : 'text-owner-fg'}`}>{item.label}</span>
                    </button>
                  ))}
                  {checklist.completed && (
                    <div className="text-xs text-owner-success font-semibold text-center pt-2">
                      All items checked — ready to Mark Left when you&apos;re set.
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
