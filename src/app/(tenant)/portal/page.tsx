'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatINR, formatDate, applyAdvanceBalance, calculateLateFee, calculateLeaveRentAdjustment, getApprovedExtensionFor } from '@/lib/utils'
import UpiPayButtons from '@/components/shared/UpiPayButtons'
import { generateAgreementPDF, generateReceiptPDF, generateFullAgreementPDF } from '@/lib/pdf'
import {
  getBillsForTenant, claimBillPaid, getMessagesForTenant, sendMessageAsTenant, markMessagesReadByTenant,
  getAgreementForTenant, getUnreadNoticesForTenant, getAllActiveNoticesForTenant, markNoticeRead, getCotenantBirthdays,
  getTenantLeaveRequests, addLeaveRequest, getTenantRentExtensionRequests, addRentExtensionRequest,
  getTenantMoveOutRequests, addMoveOutRequest, getMoveOutChecklist,
  markOnboardingPasswordChanged, getProfileStatusHistory,
  addProfileUpdateRequest, getTenantProfileUpdateRequests,
} from '@/lib/supabase/queries'
import { sendPushNotification } from '@/lib/push'
import { toast } from 'sonner'
import { StatusTimeline, type ProfileStatusHistoryEntry } from '@/components/shared/StatusTimeline'
import { calculateProfileCompletion } from '@/lib/utils/profileStatus'
import type { DepositDeductionItem } from '@/types'
import {
  LogOut, Loader2, CheckCircle, Clock, FileText, MessageCircle, Lock, Download,
  AlertCircle, LayoutDashboard, ShieldCheck, User as UserIcon, Bell,
  ChevronRight, Headset, ChevronDown, MoreVertical, Send, HelpCircle,
  Wallet, Wrench, Users2, CalendarClock, Eye, Megaphone, X,
  ChevronLeft, Paperclip, Sun, Moon,
} from 'lucide-react'
import { PieChart, Pie, Cell } from 'recharts'
import { useRouter } from 'next/navigation'
import ForcePasswordChangeModal from '@/components/shared/ForcePasswordChangeModal'
import OnboardingWizard from '@/components/tenant/OnboardingWizard'
import EnableNotificationsBanner from '@/components/shared/EnableNotificationsBanner'

type Tab = 'dashboard' | 'tenancy' | 'rent' | 'history' | 'maintenance' | 'documents' | 'messages' | 'support' | 'notices' | 'requests'

export default function TenantPortal() {
  const router = useRouter()
  const [tenant, setTenant] = useState<any>(null)
  const [birthdays, setBirthdays] = useState<{ name: string; date_of_birth: string }[]>([])
  const [payments, setPayments] = useState<any[]>([])
  const [complaints, setComplaints] = useState<any[]>([])
  const [bills, setBills] = useState<any[]>([])
  const [messages, setMessages] = useState<any[]>([])
  const [agreement, setAgreement] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('dashboard')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [darkMode, setDarkMode] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [profileMenuOpen, setProfileMenuOpen] = useState(false)
  const [rowMenuOpen, setRowMenuOpen] = useState<string | null>(null)

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
  const [newMessage, setNewMessage] = useState('')
  const [sendingMsg, setSendingMsg] = useState(false)
  const [allNotices, setAllNotices] = useState<any[]>([])
  const [noticeQueue, setNoticeQueue] = useState<any[]>([])
  const [noticeModalOpen, setNoticeModalOpen] = useState(false)
  const [noticeIndex, setNoticeIndex] = useState(0)
  const [leaveRequests, setLeaveRequests] = useState<any[]>([])
  const [leaveModal, setLeaveModal] = useState(false)
  const [leaveForm, setLeaveForm] = useState({ start_date: '', end_date: '', reason: '' })
  const [savingLeave, setSavingLeave] = useState(false)
  const [profileUpdateRequests, setProfileUpdateRequests] = useState<any[]>([])
  const [profileUpdateModal, setProfileUpdateModal] = useState(false)
  const [profileUpdateForm, setProfileUpdateForm] = useState({
    name: '', email: '', aadhaar_number: '', permanent_address: '', emergency_contact_name: '', emergency_contact: '', reason: '',
  })
  const [savingProfileUpdate, setSavingProfileUpdate] = useState(false)
  const [rentExtensions, setRentExtensions] = useState<any[]>([])
  const [extensionModal, setExtensionModal] = useState(false)
  const [extensionForm, setExtensionForm] = useState({ requested_until: '', reason: '' })
  const [savingExtension, setSavingExtension] = useState(false)
  const [moveOutRequests, setMoveOutRequests] = useState<any[]>([])
  const [moveOutModal, setMoveOutModal] = useState(false)
  const [moveOutForm, setMoveOutForm] = useState({ requested_date: '', reason: '' })
  const [savingMoveOut, setSavingMoveOut] = useState(false)
  const [moveOutChecklist, setMoveOutChecklist] = useState<any>(null)
  const [requestTypeFilter, setRequestTypeFilter] = useState<'all' | 'leave' | 'extension' | 'moveout' | 'maintenance' | 'profile'>('all')

  useEffect(() => {
    async function load() {
      const sb = createClient()
      const { data: { user } } = await sb.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: prof } = await sb.from('profiles').select('must_change_password').eq('id', user.id).single()
      setMustChangePw(!!prof?.must_change_password)

      const { data: t } = await sb.from('tenants').select('*, room:rooms(*), property:properties(name, address, upi_id, late_fee_per_day, late_fee_grace_days, owner_id)').eq('auth_user_id', user.id).single()
      if (!t) { router.push('/login'); return }
      setTenant(t)

      const { data: p } = await sb.from('payments').select('*').eq('tenant_id', t.id).order('payment_date', { ascending: false })
      setPayments(p ?? [])

      const { data: c } = await sb.from('complaints').select('*').eq('tenant_id', t.id).order('created_at', { ascending: false })
      setComplaints(c ?? [])

      getTenantLeaveRequests(t.id).then(setLeaveRequests).catch(() => setLeaveRequests([]))
      getTenantRentExtensionRequests(t.id).then(setRentExtensions).catch(() => setRentExtensions([]))
      getTenantMoveOutRequests(t.id).then(setMoveOutRequests).catch(() => setMoveOutRequests([]))
      getTenantProfileUpdateRequests(t.id).then(setProfileUpdateRequests).catch(() => setProfileUpdateRequests([]))
      getMoveOutChecklist(t.id).then(setMoveOutChecklist).catch(() => setMoveOutChecklist(null))

      getBillsForTenant(t.id).then(setBills).catch(() => setBills([]))
      getMessagesForTenant(t.id).then(setMessages).catch(() => setMessages([]))
      getAgreementForTenant(t.id).then(setAgreement).catch(() => setAgreement(null))
      getCotenantBirthdays(t.property_id).then(setBirthdays).catch(() => setBirthdays([]))

      getUnreadNoticesForTenant(t.id, t.property_id).then(unread => {
        setNoticeQueue(unread)
        if (unread.length > 0) { setNoticeIndex(0); setNoticeModalOpen(true) }
      }).catch(() => setNoticeQueue([]))
      getAllActiveNoticesForTenant(t.id, t.property_id).then(setAllNotices).catch(() => setAllNotices([]))

      setLoading(false)
    }
    load()
  }, [router])

  const thisMonth = new Date().toLocaleString('en-IN', { month: 'long', year: 'numeric' })
  const nextDueDate = new Date(new Date().getFullYear(), new Date().getMonth(), new Date(tenant?.joining_date ?? Date.now()).getDate())
  const daysLeft = tenant ? Math.ceil((nextDueDate.getTime() - Date.now()) / 86400000) : 0
  const depositDue = tenant ? tenant.deposit_amount - tenant.deposit_paid : 0
  const openComplaints = complaints.filter(c => c.status !== 'resolved').length
  const unreadMessages = messages.filter(m => m.sender === 'owner' && !m.read_by_tenant).length

  const monthlyLedger = (() => {
    if (!tenant?.joining_date) return []
    const months: { label: string; status: 'paid' | 'pending' | 'partial'; amount: number; paid: number; paidOn?: string; adjustment: number }[] = []
    const start = new Date(tenant.joining_date)
    const cursor = new Date(start.getFullYear(), start.getMonth(), 1)
    const today = new Date()
    const end = tenant.leaving_date && new Date(tenant.leaving_date) < today ? new Date(tenant.leaving_date) : today
    const approvedLeaves = leaveRequests.filter(l => l.status === 'approved')
    while (cursor <= end) {
      const label = cursor.toLocaleString('en-IN', { month: 'long', year: 'numeric' })
      const monthPayments = payments.filter(p => p.for_month === label && p.type === 'rent' && p.approval_status === 'approved')
      const totalPaid = monthPayments.reduce((s, p) => s + p.amount_received, 0)
      const adjustment = calculateLeaveRentAdjustment(label, tenant.monthly_rent, approvedLeaves)
      const amount = tenant.monthly_rent - adjustment
      const status = totalPaid >= amount ? 'paid' : totalPaid > 0 ? 'partial' : 'pending'
      months.push({ label, status, amount, paid: totalPaid, paidOn: monthPayments[0]?.payment_date, adjustment })
      cursor.setMonth(cursor.getMonth() + 1)
    }
    return months
  })()

  // Advance payments (type='advance', approved) auto-apply to the oldest
  // unpaid months first — same shared logic the owner side uses, so the
  // two views can never disagree.
  const advanceBalance = payments.filter(p => p.type === 'advance' && p.approval_status === 'approved').reduce((s, p) => s + p.amount_received, 0)
  const { months: ledgerAfterAdvance, remainingAdvance } = applyAdvanceBalance(monthlyLedger, advanceBalance)

  // Oldest unpaid/partial month first — this is what "Pay Now" targets, so
  // a partial payment made at joining (or any earlier missed month) is
  // exactly as visible and payable as the current month's rent.
  const oldestUnpaidMonth = [...ledgerAfterAdvance].find(m => m.status !== 'paid')
  const totalRentPending = ledgerAfterAdvance.reduce((s, m) => s + Math.max(0, m.amount - m.paid), 0)
  const thisMonthPaid = totalRentPending <= 0
  const ledgerDisplay = [...ledgerAfterAdvance].reverse()
  const referenceMonth = oldestUnpaidMonth ?? ledgerAfterAdvance[ledgerAfterAdvance.length - 1]
  const donutPaid = referenceMonth?.paid ?? 0
  const donutPending = Math.max(0, (referenceMonth?.amount ?? tenant?.monthly_rent ?? 0) - donutPaid)
  const donutPct = referenceMonth ? Math.round((donutPaid / (referenceMonth.amount || 1)) * 100) : 100

  // Late fee — property-level policy, applies only if the owner has
  // configured a per-day rate. Computed against the oldest unpaid month's
  // own due date (not just "today"), so it's accurate for old backlog too.
  // An approved Rent Extension for that month pushes the due date used
  // here out to the extended date — the fee never charges during a
  // window the owner explicitly granted.
  const activeExtension = oldestUnpaidMonth ? getApprovedExtensionFor(oldestUnpaidMonth.label, rentExtensions) : null
  const agreementDaysLeft = agreement?.end_date
    ? Math.floor((new Date(agreement.end_date).getTime() - Date.now()) / 86400000)
    : null

  // Unified self-service request history — every request type the tenant
  // can raise (leave, rent extension, move-out, maintenance/complaints)
  // normalized into one shape so they can browse them all in one place
  // instead of hunting across the Tenancy, Rent and Maintenance tabs.
  const allRequests = [
    ...leaveRequests.map(l => ({
      id: `leave-${l.id}`, type: 'leave' as const, typeLabel: 'Leave', icon: '🧳',
      title: `${formatDate(l.start_date)} – ${formatDate(l.end_date)}`,
      status: l.status, created_at: l.created_at, detail: l.reason,
    })),
    ...rentExtensions.map(x => ({
      id: `ext-${x.id}`, type: 'extension' as const, typeLabel: 'Rent Extension', icon: '⏳',
      title: `${x.for_month} → pay by ${formatDate(x.requested_until)}`,
      status: x.status, created_at: x.created_at, detail: x.reason,
    })),
    ...moveOutRequests.map(m => ({
      id: `move-${m.id}`, type: 'moveout' as const, typeLabel: 'Move-Out', icon: '🚪',
      title: `Move out on ${formatDate(m.requested_date)}`,
      status: m.status, created_at: m.created_at, detail: m.reason,
    })),
    ...complaints.map(c => ({
      id: `complaint-${c.id}`, type: 'maintenance' as const, typeLabel: 'Maintenance', icon: '🔧',
      title: c.issue_type,
      status: c.status === 'resolved' ? 'approved' : c.status === 'in_progress' ? 'pending' : 'pending',
      statusLabel: c.status === 'resolved' ? 'resolved' : c.status === 'in_progress' ? 'in progress' : 'open',
      created_at: c.created_at, detail: c.description,
    })),
    ...profileUpdateRequests.map(u => ({
      id: `profile-${u.id}`, type: 'profile' as const, typeLabel: 'Profile Update', icon: '📝',
      title: Object.keys(u.requested_changes ?? {}).join(', ') || 'Profile update',
      status: u.status, created_at: u.created_at, detail: u.reason,
    })),
  ]
    .filter(r => requestTypeFilter === 'all' || r.type === requestTypeFilter)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  const lateFee = (() => {
    if (!tenant?.property || !oldestUnpaidMonth || !tenant.joining_date) return 0
    const feePerDay = tenant.property.late_fee_per_day ?? 0
    if (!feePerDay) return 0
    const monthDate = new Date(`1 ${oldestUnpaidMonth.label}`)
    const dueDay = new Date(tenant.joining_date).getDate()
    let dueDate = new Date(monthDate.getFullYear(), monthDate.getMonth(), dueDay)
    if (activeExtension) {
      const extendedDate = new Date(activeExtension.requested_until)
      if (extendedDate > dueDate) dueDate = extendedDate
    }
    const overdue = Math.max(0, Math.floor((Date.now() - dueDate.getTime()) / 86400000))
    return calculateLateFee(overdue, feePerDay, tenant.property.late_fee_grace_days ?? 0)
  })()

  const tenantNotifications = [
    ...(totalRentPending > 0 && tenant?.status === 'active' ? [{
      id: 'rent', title: `Rent due: ${formatINR(totalRentPending)}`,
      subtitle: oldestUnpaidMonth?.label ?? 'This month', tab: 'rent' as Tab,
    }] : []),
    ...(depositDue > 0 && !depositClaimed && tenant?.status === 'active' ? [{
      id: 'deposit', title: `Deposit pending: ${formatINR(depositDue)}`,
      subtitle: 'Refundable security deposit', tab: 'tenancy' as Tab,
    }] : []),
    ...bills.filter(b => b.status === 'pending').map(b => ({
      id: `bill-${b.id}`, title: `${b.bill_type} bill: ${formatINR(b.amount)}`,
      subtitle: b.for_month, tab: 'dashboard' as Tab,
    })),
    ...complaints.filter(c => c.status !== 'resolved').map(c => ({
      id: `complaint-${c.id}`, title: `Maintenance update: ${c.issue_type}`,
      subtitle: `Status: ${c.status.replace('_', ' ')}`, tab: 'maintenance' as Tab,
    })),
    ...(unreadMessages > 0 ? [{
      id: 'messages', title: `${unreadMessages} new message${unreadMessages > 1 ? 's' : ''}`,
      subtitle: 'From your PG owner', tab: 'messages' as Tab,
    }] : []),
    ...(noticeQueue.length > 0 ? [{
      id: 'notices', title: `${noticeQueue.length} new notice${noticeQueue.length > 1 ? 's' : ''}`,
      subtitle: 'From your PG owner', tab: 'notices' as Tab,
    }] : []),
  ]

  const [payKind, setPayKind] = useState<'rent' | 'deposit'>('rent')
  function payAmountFor(kind: 'rent' | 'deposit') {
    if (kind === 'rent') return Math.max(0, (oldestUnpaidMonth?.amount ?? tenant?.monthly_rent ?? 0) - (oldestUnpaidMonth?.paid ?? 0)) + lateFee
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
        type: payKind, for_month: payKind === 'rent' ? (oldestUnpaidMonth?.label ?? thisMonth) : null,
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

  const pendingBillsList = bills.filter(b => b.status === 'pending')
  const totalDueAll = (totalRentPending > 0 && !claimed ? totalRentPending : 0)
    + (depositDue > 0 && !depositClaimed ? depositDue : 0)
    + pendingBillsList.reduce((s, b) => s + b.amount, 0)
  const pendingItemCount = (totalRentPending > 0 && !claimed ? 1 : 0) + (depositDue > 0 && !depositClaimed ? 1 : 0) + pendingBillsList.length

  async function handlePayAll() {
    if (tenant.status !== 'active') return
    setSaving(true)
    try {
      const sb = createClient()
      if (totalRentPending > 0 && !claimed) {
        await sb.from('payments').insert({
          tenant_id: tenant.id, property_id: tenant.property_id, type: 'rent',
          for_month: oldestUnpaidMonth?.label ?? thisMonth,
          total_due: payAmountFor('rent'), amount_received: payAmountFor('rent'),
          submitted_by_tenant: true, approval_status: 'pending_approval',
          payment_date: new Date().toISOString().slice(0, 10),
        })
        setClaimed(true)
      }
      if (depositDue > 0 && !depositClaimed) {
        await sb.from('payments').insert({
          tenant_id: tenant.id, property_id: tenant.property_id, type: 'deposit', for_month: null,
          total_due: depositDue, amount_received: depositDue,
          submitted_by_tenant: true, approval_status: 'pending_approval',
          payment_date: new Date().toISOString().slice(0, 10),
        })
        setDepositClaimed(true)
      }
      for (const b of pendingBillsList) {
        await claimBillPaid(b.id)
      }
      setBills(prev => prev.map(b => b.status === 'pending' ? { ...b, status: 'pending_approval' } : b))
      toast.success('All pending payments marked as paid — waiting for owner approval')
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
      toast.success('Request submitted!'); setComplaintModal(false)
      setComplaint({ issue_type: 'Plumbing', description: '', priority: 'medium' })
    } catch (e: any) { toast.error(e.message) }
    setSaving(false)
  }

  async function submitLeaveRequest() {
    if (!leaveForm.start_date || !leaveForm.end_date) { toast.error('Select both dates'); return }
    if (leaveForm.end_date < leaveForm.start_date) { toast.error('End date must be after start date'); return }
    setSavingLeave(true)
    try {
      const data = await addLeaveRequest({
        property_id: tenant.property_id, tenant_id: tenant.id,
        start_date: leaveForm.start_date, end_date: leaveForm.end_date, reason: leaveForm.reason,
      })
      setLeaveRequests(prev => [data, ...prev])
      toast.success('Leave request submitted!'); setLeaveModal(false)
      setLeaveForm({ start_date: '', end_date: '', reason: '' })
      if (tenant.property?.owner_id) {
        sendPushNotification({
          user_ids: [tenant.property.owner_id],
          title: '🧳 Leave Request',
          body: `${tenant.name} requested leave from ${formatDate(leaveForm.start_date)} to ${formatDate(leaveForm.end_date)}.`,
          url: '/approvals', tag: 'leave-request',
        })
      }
    } catch (e: any) { toast.error(e.message) }
    setSavingLeave(false)
  }

  async function submitProfileUpdateRequest() {
    const changes: Record<string, string> = {}
    ;(['name', 'email', 'aadhaar_number', 'permanent_address', 'emergency_contact_name', 'emergency_contact'] as const).forEach(key => {
      const newVal = profileUpdateForm[key]?.trim() ?? ''
      const currentVal = (tenant[key] ?? '').toString().trim()
      if (newVal !== currentVal) changes[key] = newVal
    })
    if (Object.keys(changes).length === 0) { toast.error('No changes to submit'); return }
    setSavingProfileUpdate(true)
    try {
      const data = await addProfileUpdateRequest({ id: tenant.id, property_id: tenant.property_id }, changes, profileUpdateForm.reason)
      setProfileUpdateRequests(prev => [data, ...prev])
      toast.success('Profile update request submitted!')
      setProfileUpdateModal(false)
      if (tenant.property?.owner_id) {
        sendPushNotification({
          user_ids: [tenant.property.owner_id],
          title: '📝 Profile Update Request',
          body: `${tenant.name} requested a profile update: ${Object.keys(changes).join(', ')}.`,
          url: '/approvals', tag: 'profile-update-request',
        })
      }
    } catch (e: any) { toast.error(e.message) }
    setSavingProfileUpdate(false)
  }

  async function submitExtensionRequest() {
    if (!extensionForm.requested_until) { toast.error('Select a date'); return }
    setSavingExtension(true)
    try {
      const forMonth = oldestUnpaidMonth?.label ?? thisMonth
      const data = await addRentExtensionRequest({
        property_id: tenant.property_id, tenant_id: tenant.id,
        for_month: forMonth, requested_until: extensionForm.requested_until, reason: extensionForm.reason,
      })
      setRentExtensions(prev => [data, ...prev])
      toast.success('Extension request submitted!'); setExtensionModal(false)
      setExtensionForm({ requested_until: '', reason: '' })
      if (tenant.property?.owner_id) {
        sendPushNotification({
          user_ids: [tenant.property.owner_id],
          title: '⏳ Rent Extension Request',
          body: `${tenant.name} requested to extend ${forMonth} rent until ${formatDate(extensionForm.requested_until)}.`,
          url: '/approvals', tag: 'rent-extension',
        })
      }
    } catch (e: any) { toast.error(e.message) }
    setSavingExtension(false)
  }

  async function submitMoveOutRequest() {
    if (!moveOutForm.requested_date) { toast.error('Select a date'); return }
    setSavingMoveOut(true)
    try {
      const data = await addMoveOutRequest({
        property_id: tenant.property_id, tenant_id: tenant.id,
        requested_date: moveOutForm.requested_date, reason: moveOutForm.reason,
      })
      setMoveOutRequests(prev => [data, ...prev])
      toast.success('Move-out request submitted!'); setMoveOutModal(false)
      setMoveOutForm({ requested_date: '', reason: '' })
      if (tenant.property?.owner_id) {
        sendPushNotification({
          user_ids: [tenant.property.owner_id],
          title: '🚪 Move-Out Request',
          body: `${tenant.name} requested to move out on ${formatDate(moveOutForm.requested_date)}.`,
          url: '/approvals', tag: 'move-out-request',
        })
      }
    } catch (e: any) { toast.error(e.message) }
    setSavingMoveOut(false)
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

  async function downloadAgreement() {
    if (agreement) {
      await generateFullAgreementPDF({
        agreementNumber: agreement.agreement_number,
        creationDate: agreement.created_at,
        tenantName: tenant.name, tenantPhone: tenant.phone, tenantEmail: tenant.email ?? undefined,
        tenantPhotoUrl: tenant.photo_url ?? undefined,
        governmentId: agreement.government_id ? 'Photo on file' : undefined,
        emergencyContact: tenant.emergency_contact ?? undefined,
        propertyName: tenant.property?.name ?? 'PG', propertyAddress: tenant.property?.address ?? undefined,
        roomNumber: tenant.room?.room_number, bedLabel: tenant.bed_label ?? undefined,
        joiningDate: tenant.joining_date,
        startDate: agreement.start_date, endDate: agreement.end_date,
        durationMonths: agreement.duration_months, rentCycle: agreement.rent_cycle,
        monthlyRent: agreement.monthly_rent, securityDeposit: agreement.security_deposit,
        electricityCharges: agreement.electricity_charges, maintenanceCharges: agreement.maintenance_charges,
        otherCharges: agreement.other_charges, otherChargesNote: agreement.other_charges_note ?? undefined,
        dueDay: agreement.due_day, lateFeePolicy: agreement.late_fee_policy,
        termsVersion: agreement.terms_version,
        tenantSignature: agreement.tenant_signature, tenantSignedName: agreement.tenant_signed_name,
        tenantSignedAt: agreement.tenant_signed_at, status: agreement.status,
      })
    } else {
      generateAgreementPDF({
        tenantName: tenant.name, tenantPhone: tenant.phone,
        propertyName: tenant.property?.name ?? 'PG', propertyAddress: tenant.property?.address,
        roomNumber: tenant.room?.room_number, bedLabel: tenant.bed_label,
        joiningDate: tenant.joining_date, monthlyRent: tenant.monthly_rent,
        depositAmount: tenant.deposit_amount, noticePeriodDays: tenant.notice_period_days,
      })
    }
    toast.success('Agreement downloaded')
  }

  async function downloadReceipt(p: any) {
    await generateReceiptPDF({
      tenantName: tenant.name, propertyName: tenant.property?.name ?? 'PG',
      roomNumber: tenant.room?.room_number, bedLabel: tenant.bed_label ?? undefined,
      forMonth: p.for_month ?? undefined, type: p.type,
      totalDue: p.total_due, amountReceived: p.amount_received, method: p.method,
      referenceNumber: p.reference_number ?? undefined,
      paymentDate: p.payment_date, approvalStatus: p.approval_status,
      receiptNo: p.id.slice(0, 8).toUpperCase(),
    })
  }

  async function openMessagesTab() {
    setTab('messages')
    if (tenant && unreadMessages > 0) {
      await markMessagesReadByTenant(tenant.id)
      setMessages(prev => prev.map(m => ({ ...m, read_by_tenant: true })))
    }
  }

  async function handleMarkNoticeRead(notice: any) {
    if (!tenant) return
    try {
      await markNoticeRead(notice.id, tenant.id)
      setAllNotices(prev => prev.map(n => n.id === notice.id ? { ...n, isRead: true } : n))
    } catch (e: any) { toast.error(e.message) }
  }

  async function closeNoticeModal() {
    const current = noticeQueue[noticeIndex]
    if (current) await handleMarkNoticeRead(current)
    if (noticeIndex < noticeQueue.length - 1) {
      setNoticeIndex(i => i + 1)
    } else {
      setNoticeModalOpen(false)
    }
  }

  function dismissNoticeModal() {
    // Closed without explicitly marking read — still counts as "seen" this
    // session so it doesn't reopen immediately, but stays unread on the
    // Notice Board until the tenant marks it read there.
    setNoticeModalOpen(false)
  }

  async function sendMessage() {
    if (!newMessage.trim() || !tenant) return
    setSendingMsg(true)
    try {
      const msg = await sendMessageAsTenant(tenant.id, tenant.property_id, newMessage.trim())
      setMessages(prev => [...prev, msg])
      setNewMessage('')
    } catch (e: any) { toast.error(e.message) }
    setSendingMsg(false)
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
    </div>
  )

  // Invited tenants (Phase 8.1) have no room/rent/agreement yet, so the
  // normal portal (rent ledger, documents, etc.) has nothing meaningful to
  // show them. Route them through the onboarding flow instead of mounting
  // the full sidebar/tabs shell underneath.
  if (tenant.status === 'invited') {
    if (mustChangePw) {
      return (
        <ForcePasswordChangeModal userId={tenant.auth_user_id} onDone={async () => {
          setMustChangePw(false)
          if (tenant.onboarding_status === 'invitation_created') {
            try {
              const updated = await markOnboardingPasswordChanged(tenant)
              setTenant((prev: any) => prev ? { ...prev, onboarding_status: updated.onboarding_status } : prev)
              // Phase 8.6 — onboarding notifications, reusing the exact
              // sendPushNotification() pattern already used for leave/
              // extension/move-out requests elsewhere on this page.
              if (tenant.property?.owner_id) {
                sendPushNotification({
                  user_ids: [tenant.property.owner_id],
                  title: '📝 Tenant Registered',
                  body: `${tenant.name} activated their account and can now complete their profile.`,
                  url: '/approvals', tag: 'onboarding-registered',
                })
              }
              if (tenant.auth_user_id) {
                sendPushNotification({
                  user_ids: [tenant.auth_user_id],
                  title: '✅ Password Changed',
                  body: `Your password was updated. Next, complete your profile for your owner to review.`,
                  url: '/portal', tag: 'onboarding-password-changed',
                })
              }
            } catch {}
          }
        }} />
      )
    }
    if (!['submitted', 'resubmitted', 'approved'].includes(tenant.onboarding_status ?? '')) {
      return <OnboardingWizard tenant={tenant} onComplete={(updated) => setTenant(updated)} />
    }
    return <OnboardingReviewScreen tenant={tenant} />
  }

  const initials = (tenant.name || '?').split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
  const recentPayment = payments.find(p => p.approval_status === 'approved')

  const navItems: { key: Tab; label: string; icon: any }[] = [
    { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { key: 'tenancy', label: 'My Tenancy', icon: Users2 },
    { key: 'rent', label: 'Rent & Payments', icon: Wallet },
    { key: 'history', label: 'Payment History', icon: Clock },
    { key: 'maintenance', label: 'Maintenance', icon: Wrench },
    { key: 'requests', label: 'My Requests', icon: CheckCircle },
    { key: 'notices', label: 'Notice Board', icon: Megaphone },
    { key: 'documents', label: 'Documents', icon: FileText },
    { key: 'messages', label: 'Messages', icon: MessageCircle },
    { key: 'support', label: 'Support', icon: HelpCircle },
  ]

  return (
    <div className={darkMode ? 'dark' : ''}>
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex">
      {mustChangePw && (
        <ForcePasswordChangeModal userId={tenant.auth_user_id} onDone={async () => {
          setMustChangePw(false)
          // Only advance the onboarding ladder for tenants who came through
          // the invitation flow (Phase 8.1) — QR-join and owner-added
          // tenants never set onboarding_status, so it stays null for them
          // and this is a no-op.
          if (tenant.onboarding_status === 'invitation_created') {
            try {
              const updated = await markOnboardingPasswordChanged(tenant)
              setTenant((prev: any) => prev ? { ...prev, onboarding_status: updated.onboarding_status } : prev)
            } catch {
              // Non-critical — the password itself is already changed and
              // the gate is already cleared either way. Worst case the
              // status ladder is one step behind until the next profile
              // action corrects it.
            }
          }
        }} />
      )}

      {/* Sidebar */}
      <aside className={`fixed lg:static inset-y-0 left-0 w-64 bg-white border-r border-gray-100 flex flex-col z-40 transition-transform ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="px-5 h-16 flex items-center gap-2.5 border-b border-gray-100">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-600 to-blue-600 flex items-center justify-center text-white font-extrabold text-sm">PG</div>
          <div>
            <div className="text-sm font-extrabold text-gray-900">RentFlow</div>
            <div className="text-[11px] text-gray-400">Tenant Portal</div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => { key === 'messages' ? openMessagesTab() : setTab(key); setSidebarOpen(false) }}
              className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl text-sm font-semibold transition ${
                tab === key ? 'bg-indigo-50 text-indigo-700' : 'text-gray-500 hover:bg-gray-50'
              }`}>
              <span className="flex items-center gap-3"><Icon className="w-4 h-4" /> {label}</span>
              {key === 'messages' && unreadMessages > 0 && (
                <span className="bg-red-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">{unreadMessages}</span>
              )}
              {key === 'maintenance' && openComplaints > 0 && (
                <span className="bg-orange-100 text-orange-600 text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">{openComplaints}</span>
              )}
              {key === 'notices' && allNotices.filter(n => !n.isRead).length > 0 && (
                <span className="bg-red-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">{allNotices.filter(n => !n.isRead).length}</span>
              )}
            </button>
          ))}
        </nav>

        <div className="p-3">
          <div className="bg-indigo-50 rounded-2xl p-4">
            <div className="w-9 h-9 rounded-xl bg-white flex items-center justify-center mb-2 shadow-sm">
              <Wallet className="w-4 h-4 text-indigo-600" />
            </div>
            <div className="text-xs font-bold text-gray-900">Pay Rent Easily</div>
            <div className="text-[11px] text-gray-500 mb-2">Make your rent payment securely in just a few clicks.</div>
            <button onClick={() => openPay('rent')} className="w-full text-xs font-semibold text-indigo-700 bg-white rounded-xl py-1.5 shadow-sm hover:bg-indigo-100 transition">
              Pay Now
            </button>
          </div>
        </div>
      </aside>

      {sidebarOpen && <div onClick={() => setSidebarOpen(false)} className="fixed inset-0 bg-black/30 z-30 lg:hidden" />}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-white border-b border-gray-100 px-4 lg:px-8 min-h-16 native-safe-top flex items-center justify-between sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(true)} className="lg:hidden text-gray-500">☰</button>
            <div className="hidden sm:block">
              <div className="text-sm font-extrabold text-gray-900 leading-tight">
                {navItems.find(n => n.key === tab)?.label ?? 'Dashboard'}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setDarkMode(d => !d)} aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
              className="p-2 rounded-xl bg-gray-50 dark:bg-slate-800 hover:bg-gray-100 dark:hover:bg-slate-700 transition text-gray-500 dark:text-slate-400">
              {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <div className="relative">
              <button onClick={() => setNotifOpen(o => !o)} aria-label="Notifications" className="relative p-2 rounded-xl bg-gray-50 hover:bg-gray-100 transition text-gray-500">
                <Bell className="w-4 h-4" />
                {tenantNotifications.length > 0 && (
                  <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 bg-red-500 rounded-full border-2 border-white text-[9px] text-white font-bold flex items-center justify-center">
                    {tenantNotifications.length > 9 ? '9+' : tenantNotifications.length}
                  </span>
                )}
              </button>
              {notifOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setNotifOpen(false)} />
                  <div className="absolute top-full right-0 mt-1.5 w-80 bg-white rounded-xl shadow-lg border border-gray-200 z-50 overflow-hidden">
                    <div className="px-4 py-3 border-b border-gray-100 font-bold text-sm text-gray-900">Notifications</div>
                    <div className="max-h-80 overflow-y-auto">
                      {tenantNotifications.length === 0 ? (
                        <div className="text-center py-8 text-sm text-gray-400">You&apos;re all caught up!</div>
                      ) : tenantNotifications.map(n => (
                        <button key={n.id} onClick={() => { setNotifOpen(false); n.tab === 'messages' ? openMessagesTab() : setTab(n.tab) }}
                          className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b border-gray-50 last:border-0 transition">
                          <div className="text-sm font-semibold text-gray-900">{n.title}</div>
                          <div className="text-xs text-gray-500 mt-0.5">{n.subtitle}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="relative">
              <button onClick={() => setProfileMenuOpen(o => !o)} className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-600 to-blue-600 flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
                  {initials}
                </div>
                <div className="hidden sm:block text-left">
                  <div className="text-sm font-bold text-gray-900 leading-tight">{tenant.name}</div>
                  <div className="text-xs text-gray-400 leading-tight">Tenant</div>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-gray-400 hidden sm:block" />
              </button>
              {profileMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setProfileMenuOpen(false)} />
                  <div className="absolute top-full right-0 mt-1.5 w-48 bg-white rounded-xl shadow-lg border border-gray-200 z-50 overflow-hidden">
                    <button onClick={() => { setProfileMenuOpen(false); setTab('tenancy') }}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition">
                      <UserIcon className="w-4 h-4" /> My Tenancy
                    </button>
                    <button onClick={() => { setProfileMenuOpen(false); setPwModal(true) }}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition">
                      <Lock className="w-4 h-4" /> Change Password
                    </button>
                    <button onClick={async () => { const sb = createClient(); await sb.auth.signOut(); router.push('/login') }}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 transition">
                      <LogOut className="w-4 h-4" /> Logout
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        <main id="main-content" className="flex-1 p-4 lg:p-8 max-w-6xl w-full mx-auto">

          {tab === 'dashboard' && (
            <div className="space-y-5">
              <EnableNotificationsBanner />
              <div>
                <h1 className="text-xl font-extrabold text-gray-900">Tenant Dashboard</h1>
                <p className="text-sm text-gray-500">Welcome back, <span className="font-semibold text-gray-700">{tenant.name}</span> 👋</p>
              </div>

              {/* Quick Actions */}
              {tenant.status === 'active' && (
                <div className="grid grid-cols-3 lg:grid-cols-6 gap-3">
                  {[
                    { label: 'Pay Rent', icon: Wallet, color: 'text-indigo-600', bg: 'bg-indigo-50', onClick: () => openPay('rent') },
                    { label: 'Maintenance', icon: Wrench, color: 'text-orange-600', bg: 'bg-orange-50', onClick: () => setComplaintModal(true) },
                    { label: 'Message', icon: MessageCircle, color: 'text-blue-600', bg: 'bg-blue-50', onClick: openMessagesTab },
                    { label: 'Request Leave', icon: Users2, color: 'text-purple-600', bg: 'bg-purple-50', onClick: () => setLeaveModal(true) },
                    { label: 'Agreement', icon: Download, color: 'text-green-600', bg: 'bg-green-50', onClick: downloadAgreement },
                    { label: 'My Requests', icon: CheckCircle, color: 'text-teal-600', bg: 'bg-teal-50', onClick: () => setTab('requests') },
                  ].map(a => (
                    <button key={a.label} onClick={a.onClick}
                      className="flex flex-col items-center gap-2 bg-white rounded-2xl border border-gray-100 p-4 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${a.bg}`}>
                        <a.icon className={`w-5 h-5 ${a.color}`} />
                      </div>
                      <span className="text-xs font-semibold text-gray-700 text-center leading-tight">{a.label}</span>
                    </button>
                  ))}
                </div>
              )}

              {agreementDaysLeft !== null && agreementDaysLeft <= 14 && (agreement.status === 'signed' || agreement.status === 'active') && (
                <div className={`rounded-2xl p-4 border flex items-center gap-3 ${agreementDaysLeft < 0 ? 'bg-red-50 border-red-100' : 'bg-amber-50 border-amber-100'}`}>
                  <span className="text-xl">📄</span>
                  <div className="flex-1">
                    <div className={`text-sm font-bold ${agreementDaysLeft < 0 ? 'text-red-700' : 'text-amber-700'}`}>
                      {agreementDaysLeft < 0 ? 'Your rent agreement has expired' : `Your rent agreement expires in ${agreementDaysLeft}d`}
                    </div>
                    <div className={`text-xs mt-0.5 ${agreementDaysLeft < 0 ? 'text-red-600' : 'text-amber-600'}`}>Contact your owner to renew it.</div>
                  </div>
                </div>
              )}

              {/* Upcoming birthdays of co-tenants at the same PG */}
              {birthdays.length > 0 && (() => {
                const today = new Date()
                const withNextOccurrence = birthdays.map(b => {
                  const dob = new Date(b.date_of_birth)
                  let next = new Date(today.getFullYear(), dob.getMonth(), dob.getDate())
                  if (next < new Date(today.getFullYear(), today.getMonth(), today.getDate())) {
                    next = new Date(today.getFullYear() + 1, dob.getMonth(), dob.getDate())
                  }
                  return { ...b, next }
                }).sort((a, b) => a.next.getTime() - b.next.getTime()).slice(0, 5)

                return (
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
                      <span className="text-base">🎂</span>
                      <span className="font-bold text-sm text-gray-900">Upcoming Birthdays</span>
                    </div>
                    <div className="divide-y divide-gray-50">
                      {withNextOccurrence.map((b, i) => {
                        const isToday = b.next.toDateString() === today.toDateString()
                        return (
                          <div key={i} className="px-4 py-2.5 flex items-center justify-between">
                            <span className="text-sm text-gray-800">{b.name}{isToday ? ' 🎉' : ''}</span>
                            <span className={`text-xs font-semibold ${isToday ? 'text-pink-600' : 'text-gray-400'}`}>
                              {isToday ? 'Today!' : b.next.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })()}

              {/* Stat cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-xs font-semibold text-gray-500">Total Rent</div>
                    <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center"><Wallet className="w-4 h-4 text-indigo-600" /></div>
                  </div>
                  <div className="text-2xl font-extrabold text-gray-900">{formatINR(tenant.monthly_rent)}</div>
                  <div className="text-xs text-gray-400 mt-1">Monthly Rent</div>
                </div>
                <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-xs font-semibold text-gray-500">Paid Amount</div>
                    <div className="w-9 h-9 rounded-xl bg-green-50 flex items-center justify-center"><Download className="w-4 h-4 text-green-600" /></div>
                  </div>
                  <div className="text-2xl font-extrabold text-green-600">{formatINR(donutPaid)}</div>
                  <div className="text-xs text-gray-400 mt-1">{referenceMonth?.label ?? thisMonth}</div>
                </div>
                <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-xs font-semibold text-gray-500">Pending Rent</div>
                    <div className="w-9 h-9 rounded-xl bg-orange-50 flex items-center justify-center"><AlertCircle className="w-4 h-4 text-orange-500" /></div>
                  </div>
                  <div className="text-2xl font-extrabold text-red-600">{formatINR(totalRentPending)}</div>
                  <div className="text-xs text-gray-400 mt-1">Due Amount</div>
                </div>
                <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-xs font-semibold text-gray-500">Due Date</div>
                    <div className="w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center"><CalendarClock className="w-4 h-4 text-red-500" /></div>
                  </div>
                  <div className="text-lg font-extrabold text-gray-900">{formatDate(nextDueDate.toISOString())}</div>
                  <div className={`text-xs mt-1 font-semibold ${daysLeft <= 3 ? 'text-red-500' : 'text-gray-400'}`}>
                    {thisMonthPaid ? 'All caught up' : daysLeft > 0 ? `${daysLeft} Days Left` : 'Overdue'}
                  </div>
                </div>
              </div>

              {/* Pay All Now banner */}
              {pendingItemCount > 1 && tenant.status === 'active' && (
                <div className="bg-indigo-50 border border-indigo-100 rounded-2xl px-5 py-4 flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2.5 text-sm text-indigo-800">
                    <Clock className="w-4 h-4 flex-shrink-0" />
                    You have {pendingItemCount} pending payments. <span className="font-bold">Pay All: {formatINR(totalDueAll)}</span>
                  </div>
                  <button onClick={handlePayAll} disabled={saving} className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold transition disabled:opacity-50 flex items-center gap-2">
                    {saving && <Loader2 className="w-4 h-4 animate-spin" />} Pay All Now
                  </button>
                </div>
              )}

              {/* Bills strip (electricity etc, if any) */}
              {bills.filter(b => b.status === 'pending').length > 0 && (
                <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm space-y-2">
                  <div className="font-bold text-sm text-gray-900 mb-1">Other Bills Due</div>
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
                          <UpiPayButtons compact upiId={tenant.property.upi_id} payeeName={tenant.property.name ?? 'PG Owner'} amount={b.amount} note={`${b.bill_type} - ${tenant.name}`} />
                        )}
                        <button onClick={() => handlePayBill(b.id)} className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition">Pay Now</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Rent Overview donut */}
                <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                  <div className="font-bold text-sm text-gray-900 mb-4">Rent Overview</div>
                  <div className="flex items-center gap-6">
                    <div className="relative w-32 h-32 flex-shrink-0">
                      <PieChart width={128} height={128}>
                        <Pie data={[{ value: donutPaid || 0.0001 }, { value: donutPending }]} dataKey="value"
                          innerRadius={44} outerRadius={62} startAngle={90} endAngle={-270} stroke="none">
                          <Cell fill="#4f46e5" />
                          <Cell fill="#e0e7ff" />
                        </Pie>
                      </PieChart>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <div className="text-lg font-extrabold text-gray-900">{donutPct}%</div>
                        <div className="text-[10px] text-gray-400">Paid</div>
                      </div>
                    </div>
                    <div className="space-y-3 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 flex-shrink-0" />
                        <div>
                          <div className="text-xs text-gray-500">Paid Amount</div>
                          <div className="text-sm font-bold text-gray-900">{formatINR(donutPaid)}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-indigo-100 flex-shrink-0" />
                        <div>
                          <div className="text-xs text-gray-500">Pending Amount</div>
                          <div className="text-sm font-bold text-gray-900">{formatINR(donutPending)}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 pt-3 border-t border-gray-50 text-xs text-gray-500 flex items-center gap-1.5">
                    <CalendarClock className="w-3.5 h-3.5" /> Due Date: <span className="font-semibold text-gray-900">{formatDate(nextDueDate.toISOString())}</span>
                  </div>
                </div>

                {/* Pay Rent panel */}
                <div className="bg-gradient-to-br from-indigo-50 to-blue-50 rounded-2xl border border-indigo-100 p-5 shadow-sm flex flex-col justify-between">
                  <div>
                    <div className="font-bold text-sm text-gray-900 mb-1">Pay Rent</div>
                    {totalRentPending > 0 ? (
                      <>
                        <p className="text-xs text-gray-500">You have pending rent of</p>
                        <div className="text-2xl font-extrabold text-gray-900 mt-1">{formatINR(totalRentPending)}</div>
                        <div className="text-xs text-gray-500 mt-2">Due Date: <span className="font-semibold text-red-600">{formatDate(nextDueDate.toISOString())}</span></div>
                      </>
                    ) : (
                      <div className="flex items-center gap-2 mt-2 text-green-700">
                        <CheckCircle className="w-5 h-5" />
                        <span className="text-sm font-semibold">All rent paid up!</span>
                      </div>
                    )}
                  </div>
                  {totalRentPending > 0 && tenant.status === 'active' && (
                    <button onClick={() => openPay('rent')} className="w-full mt-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold transition">
                      Pay Rent Now
                    </button>
                  )}
                </div>
              </div>

              {/* Mini cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-9 h-9 rounded-xl bg-green-50 flex items-center justify-center"><ShieldCheck className="w-4 h-4 text-green-600" /></div>
                    <div className="font-bold text-sm text-gray-900">Security Deposit</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-extrabold text-gray-900">{formatINR(tenant.deposit_amount)}</span>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${depositDue <= 0 ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                      {depositDue <= 0 ? 'Paid' : 'Pending'}
                    </span>
                  </div>
                  <div className="text-xs text-gray-400 mt-1">Will be refunded after tenancy end.</div>
                </div>
                <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-9 h-9 rounded-xl bg-orange-50 flex items-center justify-center"><Clock className="w-4 h-4 text-orange-500" /></div>
                    <div className="font-bold text-sm text-gray-900">Upcoming Due</div>
                  </div>
                  <div className="text-lg font-extrabold text-gray-900">{formatINR(totalRentPending > 0 ? payAmountFor('rent') : tenant.monthly_rent)}</div>
                  <div className="text-xs text-orange-600 font-semibold mt-1">Due on {formatDate(nextDueDate.toISOString())}</div>
                  <div className="text-xs text-gray-400">{daysLeft > 0 ? `${daysLeft} days remaining` : 'Overdue'}</div>
                </div>
                <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center"><FileText className="w-4 h-4 text-blue-600" /></div>
                    <div className="font-bold text-sm text-gray-900">Recent Payment</div>
                  </div>
                  {recentPayment ? (
                    <>
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-extrabold text-gray-900">{formatINR(recentPayment.amount_received)}</span>
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700">Paid</span>
                      </div>
                      <div className="text-xs text-gray-400 mt-1">Paid on {formatDate(recentPayment.payment_date)}</div>
                      <div className="text-xs text-gray-400">Txn #{recentPayment.id.slice(0, 8).toUpperCase()}</div>
                    </>
                  ) : (
                    <div className="text-xs text-gray-400">No payments yet</div>
                  )}
                </div>
              </div>

              {/* Payment History table (recent) */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
                  <div className="font-bold text-sm text-gray-900">Payment History</div>
                  <button onClick={() => setTab('history')} className="text-xs font-semibold text-indigo-600 hover:underline">View All</button>
                </div>
                {payments.length === 0 ? (
                  <div className="text-center py-10 text-sm text-gray-400">No payments yet</div>
                ) : (
                  <>
                    {/* Mobile: stacked card list, no horizontal scroll */}
                    <div className="sm:hidden divide-y divide-gray-50">
                      {payments.slice(0, 5).map(p => (
                        <div key={p.id} className="flex items-center justify-between gap-3 px-5 py-3">
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-gray-900">{p.for_month ?? '—'}</div>
                            <div className="text-xs text-gray-400 mt-0.5">{formatDate(p.payment_date)}</div>
                            <span className={`inline-block mt-1 text-xs font-bold px-2 py-0.5 rounded-full ${p.approval_status === 'approved' ? 'bg-green-100 text-green-700' : p.approval_status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
                              {p.approval_status.replace('_', ' ')}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <div className="text-sm font-bold text-gray-900">{formatINR(p.amount_received)}</div>
                            {p.approval_status === 'approved' && (
                              <button onClick={() => downloadReceipt(p)} aria-label="Download receipt" className="p-1.5 hover:bg-gray-100 rounded-lg transition"><Download className="w-3.5 h-3.5 text-gray-400" /></button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                    {/* Desktop/tablet: full table */}
                    <table className="w-full text-sm hidden sm:table">
                      <thead>
                        <tr className="text-left text-xs text-gray-400 border-b border-gray-50">
                          <th className="px-5 py-2.5 font-semibold">Date</th>
                          <th className="px-5 py-2.5 font-semibold">Month</th>
                          <th className="px-5 py-2.5 font-semibold">Amount</th>
                          <th className="px-5 py-2.5 font-semibold">Status</th>
                          <th className="px-5 py-2.5 font-semibold">Transaction ID</th>
                          <th className="px-5 py-2.5 font-semibold text-right">Receipt</th>
                        </tr>
                      </thead>
                      <tbody>
                        {payments.slice(0, 5).map(p => (
                          <tr key={p.id} className="border-b border-gray-50 last:border-0">
                            <td className="px-5 py-3 text-gray-600">{formatDate(p.payment_date)}</td>
                            <td className="px-5 py-3 text-gray-600">{p.for_month ?? '—'}</td>
                            <td className="px-5 py-3 font-semibold text-gray-900">{formatINR(p.amount_received)}</td>
                            <td className="px-5 py-3">
                              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${p.approval_status === 'approved' ? 'bg-green-100 text-green-700' : p.approval_status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                {p.approval_status.replace('_', ' ')}
                              </span>
                            </td>
                            <td className="px-5 py-3 text-xs text-gray-400 font-mono">#{p.id.slice(0, 8).toUpperCase()}</td>
                            <td className="px-5 py-3 text-right">
                              {p.approval_status === 'approved' ? (
                                <button onClick={() => downloadReceipt(p)} aria-label="Download receipt" className="p-1.5 hover:bg-gray-100 rounded-lg transition"><Download className="w-3.5 h-3.5 text-gray-400" /></button>
                              ) : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </>
                )}
              </div>
            </div>
          )}

          {tab === 'tenancy' && (
            <div className="space-y-5">
              <div>
                <h1 className="text-xl font-extrabold text-gray-900">My Tenancy</h1>
                <p className="text-sm text-gray-500">Your room, property and agreement details.</p>
              </div>
              <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
                <div className="flex items-center justify-between gap-4 mb-6">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-600 to-blue-600 flex items-center justify-center text-white font-extrabold text-xl">
                      {initials}
                    </div>
                    <div>
                      <div className="text-lg font-extrabold text-gray-900">{tenant.name}</div>
                      <div className="text-sm text-gray-500">Room {tenant.room?.room_number ?? '—'} · Bed {tenant.bed_label ?? '—'}</div>
                    </div>
                  </div>
                  {tenant.status === 'active' && !profileUpdateRequests.some(u => u.status === 'pending') && (
                    <button
                      onClick={() => {
                        setProfileUpdateForm({
                          name: tenant.name || '', email: tenant.email || '', aadhaar_number: tenant.aadhaar_number || '',
                          permanent_address: tenant.permanent_address || '', emergency_contact_name: tenant.emergency_contact_name || '',
                          emergency_contact: tenant.emergency_contact || '', reason: '',
                        })
                        setProfileUpdateModal(true)
                      }}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold transition whitespace-nowrap"
                    >
                      Request Profile Update
                    </button>
                  )}
                </div>
                {profileUpdateRequests.some(u => u.status === 'pending') && (
                  <div className="bg-amber-50 rounded-xl p-3 mb-4 text-xs text-amber-800">
                    You have a profile update request pending owner review.
                  </div>
                )}
                <div className="space-y-3">
                  {[
                    ['Mobile Number', tenant.phone],
                    ['Email', tenant.email || '—'],
                    ['Emergency Contact', tenant.emergency_contact || '—'],
                    ['Property', tenant.property?.name],
                    ['Address', tenant.property?.address || '—'],
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
              </div>

              <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
                <div className="font-bold text-sm text-gray-900 mb-4">Security Deposit</div>
                <div className="space-y-3">
                  {[
                    ['Total Deposit', formatINR(tenant.deposit_amount)],
                    ['Amount Paid', formatINR(tenant.deposit_paid)],
                    ['Pending', formatINR(Math.max(0, depositDue))],
                    ['Status', depositDue <= 0 ? 'Fully Paid' : 'Partially Paid'],
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
                      {tenant.deposit_deduction_items?.length > 0 && (
                        <div className="pt-1 space-y-1 border-t border-green-100 mt-1">
                          <div className="text-xs font-semibold text-green-800 pt-1">Deductions</div>
                          {tenant.deposit_deduction_items.map((item: DepositDeductionItem, idx: number) => (
                            <div key={idx} className="flex justify-between text-xs text-gray-600">
                              <span>{item.label}</span>
                              <span>− {formatINR(item.amount)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {tenant.deposit_deduction_notes && (
                        <div className="text-xs text-gray-500 mt-1">Note: {tenant.deposit_deduction_notes}</div>
                      )}
                    </div>
                  )}
                  {tenant.deposit_refunded === 0 && (tenant.status === 'leaving' || tenant.status === 'left') && tenant.deposit_paid > 0 && (
                    <div className="bg-amber-50 rounded-xl p-4 mt-2">
                      <div className="text-xs font-bold text-amber-800">Settlement Pending</div>
                      <div className="text-xs text-amber-700 mt-1">Your deposit refund is being processed by the owner.</div>
                    </div>
                  )}
                </div>
                {depositDue > 0 && !depositClaimed && tenant.status === 'active' && (
                  <button onClick={() => openPay('deposit')} className="w-full mt-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold transition">
                    Pay {formatINR(depositDue)} Deposit
                  </button>
                )}
              </div>

              <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div className="font-bold text-sm text-gray-900">Temporary Leave</div>
                  {tenant.status === 'active' && (
                    <button onClick={() => setLeaveModal(true)} className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold transition">
                      Request Leave
                    </button>
                  )}
                </div>
                {leaveRequests.length === 0 ? (
                  <div className="text-sm text-gray-400 text-center py-6">No leave requests yet</div>
                ) : (
                  <div className="space-y-3">
                    {leaveRequests.map(l => (
                      <div key={l.id} className="border border-gray-50 rounded-xl p-4">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <span className="text-sm font-bold text-gray-900">{formatDate(l.start_date)} – {formatDate(l.end_date)}</span>
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full capitalize ${
                            l.status === 'approved' ? 'bg-green-100 text-green-700' : l.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
                          }`}>{l.status}</span>
                        </div>
                        {l.reason && <p className="text-sm text-gray-500 mt-1.5">{l.reason}</p>}
                        {l.owner_note && <p className="text-xs text-gray-400 mt-1.5">Owner note: {l.owner_note}</p>}
                        <div className="text-xs text-gray-400 mt-2">Requested {formatDate(l.created_at)}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div className="font-bold text-sm text-gray-900">Move-Out</div>
                  {tenant.status === 'active' && !moveOutRequests.some(m => m.status !== 'rejected') && (
                    <button onClick={() => setMoveOutModal(true)} className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold transition">
                      Request Move-Out
                    </button>
                  )}
                </div>
                {tenant.status === 'leaving' && moveOutChecklist && (
                  <div className="mb-4 bg-amber-50 border border-amber-100 rounded-xl p-4">
                    <div className="text-xs font-bold text-amber-800 mb-2">
                      Owner Move-Out Checklist ({moveOutChecklist.items.filter((i: any) => i.checked).length}/{moveOutChecklist.items.length})
                    </div>
                    <div className="space-y-1.5">
                      {moveOutChecklist.items.map((i: any, idx: number) => (
                        <div key={idx} className="flex items-center gap-2 text-xs text-amber-700">
                          <span>{i.checked ? '✅' : '⬜'}</span> {i.label}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {moveOutRequests.length === 0 ? (
                  <div className="text-sm text-gray-400 text-center py-6">No move-out requests yet</div>
                ) : (
                  <div className="space-y-3">
                    {moveOutRequests.map(m => (
                      <div key={m.id} className="border border-gray-50 rounded-xl p-4">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <span className="text-sm font-bold text-gray-900">Move out on {formatDate(m.requested_date)}</span>
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full capitalize ${
                            m.status === 'approved' ? 'bg-green-100 text-green-700' : m.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
                          }`}>{m.status}</span>
                        </div>
                        {m.reason && <p className="text-sm text-gray-500 mt-1.5">{m.reason}</p>}
                        {m.owner_note && <p className="text-xs text-gray-400 mt-1.5">Owner note: {m.owner_note}</p>}
                        <div className="text-xs text-gray-400 mt-2">Requested {formatDate(m.created_at)}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {tab === 'rent' && (
            <div className="space-y-5">
              <div>
                <h1 className="text-xl font-extrabold text-gray-900">Rent & Payments</h1>
                <p className="text-sm text-gray-500">Your full monthly rent history.</p>
              </div>
              {(lateFee > 0 || remainingAdvance > 0 || (oldestUnpaidMonth?.adjustment ?? 0) > 0 || activeExtension) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {lateFee > 0 && (
                    <div className="bg-red-50 border border-red-100 rounded-2xl p-4">
                      <div className="text-xs font-bold text-red-700">Late Fee Applied</div>
                      <div className="text-lg font-extrabold text-red-700 mt-0.5">{formatINR(lateFee)}</div>
                      <div className="text-xs text-red-500 mt-0.5">Added to your next payment for {oldestUnpaidMonth?.label}</div>
                    </div>
                  )}
                  {remainingAdvance > 0 && (
                    <div className="bg-green-50 border border-green-100 rounded-2xl p-4">
                      <div className="text-xs font-bold text-green-700">Advance Balance</div>
                      <div className="text-lg font-extrabold text-green-700 mt-0.5">{formatINR(remainingAdvance)}</div>
                      <div className="text-xs text-green-600 mt-0.5">Will auto-apply to your next due month</div>
                    </div>
                  )}
                  {(oldestUnpaidMonth?.adjustment ?? 0) > 0 && (
                    <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4">
                      <div className="text-xs font-bold text-indigo-700">Leave Adjustment</div>
                      <div className="text-lg font-extrabold text-indigo-700 mt-0.5">− {formatINR(oldestUnpaidMonth?.adjustment ?? 0)}</div>
                      <div className="text-xs text-indigo-600 mt-0.5">Prorated for your approved leave in {oldestUnpaidMonth?.label}</div>
                    </div>
                  )}
                  {activeExtension && (
                    <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4">
                      <div className="text-xs font-bold text-blue-700">Extension Granted</div>
                      <div className="text-lg font-extrabold text-blue-700 mt-0.5">Until {formatDate(activeExtension.requested_until)}</div>
                      <div className="text-xs text-blue-600 mt-0.5">No late fee for {oldestUnpaidMonth?.label} until this date</div>
                    </div>
                  )}
                </div>
              )}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                {ledgerDisplay.map(m => (
                  <div key={m.label} className="flex items-center justify-between px-5 py-4 border-b border-gray-50 last:border-0">
                    <div>
                      <div className="text-sm font-semibold text-gray-900">{m.label}</div>
                      <div className="text-xs text-gray-400">{m.paidOn ? `Paid on ${formatDate(m.paidOn)}` : 'Not yet paid'}</div>
                      {m.adjustment > 0 && <div className="text-xs text-indigo-500 mt-0.5">Leave adjustment: − {formatINR(m.adjustment)}</div>}
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
                <button onClick={() => openPay('rent')} className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold transition">
                  Pay {oldestUnpaidMonth?.label ?? thisMonth} Rent
                </button>
              )}
              {!thisMonthPaid && !claimed && tenant.status === 'active' && oldestUnpaidMonth &&
                !rentExtensions.some(e => e.for_month === oldestUnpaidMonth.label && e.status !== 'rejected') && (
                <button onClick={() => setExtensionModal(true)} className="w-full py-2.5 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-xl text-sm font-semibold transition">
                  Request Extension for {oldestUnpaidMonth.label}
                </button>
              )}

              {rentExtensions.length > 0 && (
                <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                  <div className="font-bold text-sm text-gray-900 mb-3">Extension Requests</div>
                  <div className="space-y-3">
                    {rentExtensions.map(e => (
                      <div key={e.id} className="border border-gray-50 rounded-xl p-3">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <span className="text-sm font-bold text-gray-900">{e.for_month} → {formatDate(e.requested_until)}</span>
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full capitalize ${
                            e.status === 'approved' ? 'bg-green-100 text-green-700' : e.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
                          }`}>{e.status}</span>
                        </div>
                        {e.reason && <p className="text-xs text-gray-500 mt-1">{e.reason}</p>}
                        {e.owner_note && <p className="text-xs text-gray-400 mt-1">Owner note: {e.owner_note}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {bills.length > 0 && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                  <div className="font-bold text-sm text-gray-900 mb-3">Other Bills</div>
                  <div className="space-y-2">
                    {bills.map(b => (
                      <div key={b.id} className="flex items-center justify-between gap-3 p-3 bg-gray-50 rounded-xl">
                        <div>
                          <div className="text-sm font-semibold text-gray-900">{b.bill_type} — {b.for_month}</div>
                          <div className="text-xs text-gray-400">{formatINR(b.amount)}</div>
                        </div>
                        <span className={`text-xs font-bold px-2.5 py-1 rounded-full capitalize ${b.status === 'paid' ? 'bg-green-100 text-green-700' : b.status === 'pending_approval' ? 'bg-blue-100 text-blue-700' : 'bg-yellow-100 text-yellow-700'}`}>
                          {b.status.replace('_', ' ')}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === 'history' && (
            <div className="space-y-5">
              <div>
                <h1 className="text-xl font-extrabold text-gray-900">Payment History</h1>
                <p className="text-sm text-gray-500">All your payments, in one place.</p>
              </div>
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                {payments.length === 0 ? (
                  <div className="text-center py-12 text-gray-400 text-sm">No payments yet</div>
                ) : (
                  <>
                    {/* Mobile: stacked card list, no horizontal scroll */}
                    <div className="sm:hidden divide-y divide-gray-50">
                      {payments.map(p => (
                        <div key={p.id} className="flex items-center justify-between gap-3 px-5 py-3.5">
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-gray-900 capitalize">{p.type} · {p.for_month ?? '—'}</div>
                            <div className="text-xs text-gray-400 mt-0.5">{formatDate(p.payment_date)}</div>
                            <span className={`inline-block mt-1 text-xs font-bold px-2 py-0.5 rounded-full ${p.approval_status === 'approved' ? 'bg-green-100 text-green-700' : p.approval_status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
                              {p.approval_status.replace('_', ' ')}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 shrink-0 relative">
                            <div className="text-sm font-bold text-gray-900">{formatINR(p.amount_received)}</div>
                            <button onClick={() => setRowMenuOpen(o => o === p.id ? null : p.id)} className="p-1.5 hover:bg-gray-100 rounded-lg transition" aria-label="Row options">
                              <MoreVertical className="w-4 h-4 text-gray-400" />
                            </button>
                            {rowMenuOpen === p.id && (
                              <>
                                <div className="fixed inset-0 z-40" onClick={() => setRowMenuOpen(null)} />
                                <div className="absolute right-0 top-full mt-1 w-44 bg-white rounded-xl shadow-lg border border-gray-200 z-50 overflow-hidden">
                                  {p.approval_status === 'approved' ? (
                                    <button onClick={() => { downloadReceipt(p); setRowMenuOpen(null) }}
                                      className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition">
                                      <Download className="w-3.5 h-3.5" /> Download Receipt
                                    </button>
                                  ) : (
                                    <div className="px-4 py-2.5 text-xs text-gray-400">Awaiting owner approval</div>
                                  )}
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                    {/* Desktop/tablet: full table */}
                    <table className="w-full text-sm hidden sm:table">
                      <thead>
                        <tr className="text-left text-xs text-gray-400 border-b border-gray-100">
                          <th className="px-5 py-3 font-semibold">Date</th>
                          <th className="px-5 py-3 font-semibold">Type</th>
                          <th className="px-5 py-3 font-semibold">Month</th>
                          <th className="px-5 py-3 font-semibold">Amount</th>
                          <th className="px-5 py-3 font-semibold">Status</th>
                          <th className="px-5 py-3 font-semibold text-right">Txn ID</th>
                          <th className="px-5 py-3"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {payments.map(p => (
                          <tr key={p.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
                            <td className="px-5 py-3.5 text-gray-600 whitespace-nowrap">{formatDate(p.payment_date)}</td>
                            <td className="px-5 py-3.5 text-gray-600 capitalize">{p.type}</td>
                            <td className="px-5 py-3.5 text-gray-600">{p.for_month ?? '—'}</td>
                            <td className="px-5 py-3.5 font-semibold text-gray-900">{formatINR(p.amount_received)}</td>
                            <td className="px-5 py-3.5">
                              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${p.approval_status === 'approved' ? 'bg-green-100 text-green-700' : p.approval_status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                {p.approval_status.replace('_', ' ')}
                              </span>
                            </td>
                            <td className="px-5 py-3.5 text-right text-xs text-gray-400 font-mono">#{p.id.slice(0, 8).toUpperCase()}</td>
                            <td className="px-5 py-3.5 text-right relative">
                              <button onClick={() => setRowMenuOpen(o => o === p.id ? null : p.id)} className="p-1.5 hover:bg-gray-100 rounded-lg transition" aria-label="Row options">
                                <MoreVertical className="w-4 h-4 text-gray-400" />
                              </button>
                              {rowMenuOpen === p.id && (
                                <>
                                  <div className="fixed inset-0 z-40" onClick={() => setRowMenuOpen(null)} />
                                  <div className="absolute right-5 top-full mt-1 w-44 bg-white rounded-xl shadow-lg border border-gray-200 z-50 overflow-hidden">
                                    {p.approval_status === 'approved' ? (
                                      <button onClick={() => { downloadReceipt(p); setRowMenuOpen(null) }}
                                        className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition">
                                        <Download className="w-3.5 h-3.5" /> Download Receipt
                                      </button>
                                    ) : (
                                      <div className="px-4 py-2.5 text-xs text-gray-400">Awaiting owner approval</div>
                                    )}
                                  </div>
                                </>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </>
                )}
              </div>
            </div>
          )}

          {tab === 'maintenance' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-xl font-extrabold text-gray-900">Maintenance</h1>
                  <p className="text-sm text-gray-500">Track issues you&apos;ve raised.</p>
                </div>
                <button onClick={() => setComplaintModal(true)} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold transition">
                  <Wrench className="w-4 h-4" /> Raise New
                </button>
              </div>
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-50">
                {complaints.length === 0 ? (
                  <div className="text-center py-12 text-gray-400 text-sm">No requests raised yet</div>
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

          {tab === 'requests' && (
            <div className="space-y-5">
              <div>
                <h1 className="text-xl font-extrabold text-gray-900">My Requests</h1>
                <p className="text-sm text-gray-500">Every leave, extension, move-out and maintenance request in one place.</p>
              </div>

              <div className="flex flex-wrap gap-2">
                {[['all', 'All'], ['leave', 'Leave'], ['extension', 'Extension'], ['moveout', 'Move-Out'], ['maintenance', 'Maintenance'], ['profile', 'Profile Update']].map(([v, l]) => (
                  <button key={v} onClick={() => setRequestTypeFilter(v as any)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${requestTypeFilter === v ? 'bg-indigo-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                    {l}
                  </button>
                ))}
              </div>

              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-50">
                {allRequests.length === 0 ? (
                  <div className="text-center py-12 text-gray-400 text-sm">No requests yet</div>
                ) : allRequests.map(r => (
                  <div key={r.id} className="flex items-start justify-between gap-3 px-5 py-4">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
                        <span>{r.icon}</span> {r.title}
                      </div>
                      <div className="text-xs text-gray-400 mt-1">{r.typeLabel} · Requested {formatDate(r.created_at)}</div>
                      {r.detail && <div className="text-xs text-gray-500 mt-1">{r.detail}</div>}
                    </div>
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full flex-shrink-0 capitalize ${
                      r.status === 'approved' ? 'bg-green-100 text-green-700' : r.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
                    }`}>
                      {(r as any).statusLabel ?? r.status}
                    </span>
                  </div>
                ))}
              </div>
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
                      <div className="text-xs text-gray-400">{agreement ? `${agreement.agreement_number} · ${agreement.status}` : 'System-generated from your tenant record'}</div>
                      {agreementDaysLeft !== null && agreementDaysLeft <= 30 && (agreement.status === 'signed' || agreement.status === 'active') && (
                        <div className={`text-xs font-semibold mt-0.5 ${agreementDaysLeft < 0 ? 'text-red-600' : 'text-amber-600'}`}>
                          {agreementDaysLeft < 0 ? `Expired ${Math.abs(agreementDaysLeft)}d ago — ask your owner to renew` : agreementDaysLeft === 0 ? 'Expires today' : `Expires in ${agreementDaysLeft}d`}
                        </div>
                      )}
                    </div>
                  </div>
                  <button onClick={downloadAgreement} aria-label="Download rent agreement" className="p-2 hover:bg-gray-100 rounded-lg transition"><Download className="w-4 h-4 text-gray-500" /></button>
                </div>
                {agreement?.government_id && (
                  <div className="flex items-center justify-between px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-green-50 flex items-center justify-center"><FileText className="w-4 h-4 text-green-500" /></div>
                      <div>
                        <div className="text-sm font-semibold text-gray-900">Government ID</div>
                        <div className="text-xs text-gray-400">Uploaded at joining</div>
                      </div>
                    </div>
                    <a href={agreement.government_id} target="_blank" rel="noreferrer" className="p-2 hover:bg-gray-100 rounded-lg transition" aria-label="View government ID"><Eye className="w-4 h-4 text-gray-500" /></a>
                  </div>
                )}
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
              <p className="text-xs text-gray-400">Document upload isn&apos;t available yet — ask your PG owner if they need physical/digital copies of your KYC documents.</p>
            </div>
          )}

          {tab === 'messages' && (
            <div className="space-y-5 h-full flex flex-col">
              <div>
                <h1 className="text-xl font-extrabold text-gray-900">Messages</h1>
                <p className="text-sm text-gray-500">Chat directly with your PG owner.</p>
              </div>
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col h-[60vh]">
                <div className="flex-1 overflow-y-auto p-5 space-y-3">
                  {messages.length === 0 ? (
                    <div className="text-center text-sm text-gray-400 py-10">No messages yet — say hello to your owner!</div>
                  ) : messages.map(m => (
                    <div key={m.id} className={`flex ${m.sender === 'tenant' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm ${m.sender === 'tenant' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-800'}`}>
                        <div>{m.body}</div>
                        <div className={`text-[10px] mt-1 ${m.sender === 'tenant' ? 'text-indigo-200' : 'text-gray-400'}`}>
                          {new Date(m.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="p-4 border-t border-gray-100 flex gap-2">
                  <input value={newMessage} onChange={e => setNewMessage(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && sendMessage()}
                    placeholder="Type a message…"
                    className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500" />
                  <button onClick={sendMessage} disabled={sendingMsg || !newMessage.trim()}
                    className="w-11 h-11 flex items-center justify-center bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition disabled:opacity-50 flex-shrink-0">
                    {sendingMsg ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>
          )}

          {tab === 'support' && (
            <div className="space-y-5">
              <div>
                <h1 className="text-xl font-extrabold text-gray-900">Support</h1>
                <p className="text-sm text-gray-500">Get help or reach your PG owner directly.</p>
              </div>
              <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center"><Headset className="w-5 h-5 text-indigo-600" /></div>
                  <div>
                    <div className="font-bold text-gray-900">Contact {tenant.property?.name ?? 'your PG owner'}</div>
                    <div className="text-xs text-gray-400">Usually responds within a few hours</div>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button onClick={openMessagesTab} className="flex items-center justify-center gap-2 py-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-sm font-semibold transition">
                    <MessageCircle className="w-4 h-4" /> Message Owner
                  </button>
                  <button onClick={() => setComplaintModal(true)} className="flex items-center justify-center gap-2 py-3 bg-orange-50 hover:bg-orange-100 text-orange-700 rounded-xl text-sm font-semibold transition">
                    <Wrench className="w-4 h-4" /> Raise Maintenance Request
                  </button>
                  <button onClick={() => setTab('requests')} className="flex items-center justify-center gap-2 py-3 bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-xl text-sm font-semibold transition sm:col-span-2">
                    <CheckCircle className="w-4 h-4" /> View All My Requests
                  </button>
                </div>
              </div>
              <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm space-y-4">
                <div className="font-bold text-sm text-gray-900">Frequently Asked</div>
                {[
                  ['How do I pay rent?', 'Go to Rent & Payments → Pay Rent Now, then confirm via UPI or by marking it paid for your owner to verify.'],
                  ['When is my deposit refunded?', 'Your security deposit is refunded after you vacate, following a room inspection, minus any pending dues or damages.'],
                  ['How do I report a maintenance issue?', 'Use the Maintenance tab or the button above to raise a request — your owner will be notified.'],
                  ['Can I download my agreement anytime?', 'Yes — go to Documents and tap the download icon next to Rent Agreement.'],
                ].map(([q, a]) => (
                  <div key={q} className="border-b border-gray-50 pb-3 last:border-0 last:pb-0">
                    <div className="text-sm font-semibold text-gray-800">{q}</div>
                    <div className="text-xs text-gray-500 mt-1">{a}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === 'notices' && (
            <div className="space-y-5">
              <div>
                <h1 className="text-xl font-extrabold text-gray-900">Notice Board</h1>
                <p className="text-sm text-gray-500">Announcements from your PG owner.</p>
              </div>
              {allNotices.length === 0 ? (
                <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center text-sm text-gray-400 shadow-sm">
                  No notices yet
                </div>
              ) : (
                <div className="space-y-3">
                  {allNotices.map(n => (
                    <div key={n.id} className={`bg-white rounded-2xl border shadow-sm p-5 ${!n.isRead ? 'border-indigo-200 ring-1 ring-indigo-100' : 'border-gray-100'}`}>
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-sm font-bold text-gray-900">{n.title}</h3>
                          {!n.isRead && <span className="w-2 h-2 rounded-full bg-indigo-600 flex-shrink-0" />}
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            n.priority === 'Urgent' ? 'bg-red-100 text-red-700' : n.priority === 'Important' ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-600'
                          }`}>{n.priority}</span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">{n.category}</span>
                        </div>
                      </div>
                      <p className="text-sm text-gray-600 whitespace-pre-wrap">{n.description}</p>
                      {n.attachment_url && (
                        <a href={n.attachment_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:underline mt-2">
                          <Paperclip className="w-3.5 h-3.5" /> {n.attachment_name || 'View attachment'}
                        </a>
                      )}
                      <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-50">
                        <div className="text-xs text-gray-400">
                          Published {formatDate(n.publish_date)}{n.expiry_date ? ` · Expires ${formatDate(n.expiry_date)}` : ''}
                          {n.created_by && ` · By ${n.created_by}`}
                        </div>
                        {!n.isRead && (
                          <button onClick={() => handleMarkNoticeRead(n)} className="text-xs font-semibold text-indigo-600 hover:underline flex-shrink-0">
                            Mark as Read
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </main>
      </div>

      {/* Notice Announcement Modal */}
      {noticeModalOpen && noticeQueue[noticeIndex] && (() => {
        const notice = noticeQueue[noticeIndex]
        const isUrgent = notice.priority === 'Urgent'
        return (
          <div
            className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={() => !isUrgent && dismissNoticeModal()}
            onKeyDown={e => { if (e.key === 'Escape' && !isUrgent) dismissNoticeModal() }}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-labelledby="notice-modal-title"
          >
            <div onClick={e => e.stopPropagation()}
              className="bg-white rounded-2xl w-full max-w-md shadow-2xl relative animate-in zoom-in-95 fade-in duration-200 max-h-[90vh] flex flex-col">

              <button onClick={dismissNoticeModal} aria-label="Close"
                className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 transition z-10">
                <X className="w-4 h-4" />
              </button>

              <div className={`px-6 pt-6 pb-4 rounded-t-2xl ${isUrgent ? 'bg-gradient-to-br from-red-50 to-orange-50' : 'bg-gradient-to-br from-indigo-50 to-blue-50'}`}>
                <div className="flex items-center gap-2 mb-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${isUrgent ? 'bg-red-100' : 'bg-indigo-100'}`}>
                    <Megaphone className={`w-5 h-5 ${isUrgent ? 'text-red-600' : 'text-indigo-600'}`} />
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      notice.priority === 'Urgent' ? 'bg-red-600 text-white' : notice.priority === 'Important' ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-600'
                    }`}>{notice.priority}</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">{notice.category}</span>
                  </div>
                </div>
                <h2 id="notice-modal-title" className="text-lg font-extrabold text-gray-900 pr-8">{notice.title}</h2>
              </div>

              <div className="px-6 py-4 overflow-y-auto flex-1">
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{notice.description}</p>

                {notice.attachment_url && (
                  <a href={notice.attachment_url} target="_blank" rel="noreferrer"
                    className="mt-3 flex items-center gap-2 p-3 bg-gray-50 rounded-xl text-sm font-semibold text-indigo-600 hover:bg-gray-100 transition">
                    <Paperclip className="w-4 h-4" /> {notice.attachment_name || 'View attachment'}
                    <Download className="w-3.5 h-3.5 ml-auto" />
                  </a>
                )}

                <div className="grid grid-cols-2 gap-3 mt-4 text-xs">
                  <div>
                    <div className="text-gray-400">Published</div>
                    <div className="font-semibold text-gray-800">{formatDate(notice.publish_date)}</div>
                  </div>
                  <div>
                    <div className="text-gray-400">Expires</div>
                    <div className="font-semibold text-gray-800">{notice.expiry_date ? formatDate(notice.expiry_date) : 'No expiry'}</div>
                  </div>
                  {notice.created_by && (
                    <div className="col-span-2">
                      <div className="text-gray-400">Published By</div>
                      <div className="font-semibold text-gray-800">{notice.created_by}</div>
                    </div>
                  )}
                </div>
              </div>

              <div className="px-6 py-4 border-t border-gray-100 space-y-3 flex-shrink-0">
                {noticeQueue.length > 1 && (
                  <div className="flex items-center justify-between text-xs text-gray-400">
                    <button onClick={() => setNoticeIndex(i => Math.max(0, i - 1))} disabled={noticeIndex === 0}
                      className="flex items-center gap-1 font-semibold disabled:opacity-30 hover:text-gray-700 transition">
                      <ChevronLeft className="w-3.5 h-3.5" /> Previous
                    </button>
                    <span>{noticeIndex + 1} of {noticeQueue.length}</span>
                    <button onClick={() => setNoticeIndex(i => Math.min(noticeQueue.length - 1, i + 1))} disabled={noticeIndex === noticeQueue.length - 1}
                      className="flex items-center gap-1 font-semibold disabled:opacity-30 hover:text-gray-700 transition">
                      Next <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
                <div className="flex gap-2">
                  <button onClick={() => { setNoticeModalOpen(false); setTab('notices') }}
                    className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 transition">
                    View All Notices
                  </button>
                  <button onClick={closeNoticeModal}
                    className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition">
                    <CheckCircle className="w-4 h-4" /> Mark as Read
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Mark as Paid Modal */}
      {payModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-base font-bold">Pay {payKind === 'rent' ? `Rent — ${oldestUnpaidMonth?.label ?? thisMonth}` : 'Security Deposit'}</h2>
              <button onClick={() => setPayModal(false)} className="text-gray-400 text-xl font-bold">×</button>
            </div>
            <div className="p-5 space-y-4">
              <div className="bg-blue-50 rounded-xl p-3 text-xs text-blue-700">
                Amount: <span className="font-bold">{formatINR(payAmount)}</span>{payKind === 'rent' && lateFee > 0 && <span> (includes {formatINR(lateFee)} late fee)</span>}. This notifies your owner that you&apos;ve paid. No real payment is made here — the owner will verify and approve.
              </div>
              {tenant.property?.upi_id && (
                <UpiPayButtons upiId={tenant.property.upi_id} payeeName={tenant.property.name ?? 'PG Owner'} amount={payAmount} note={`${payKind === 'rent' ? 'Rent' : 'Deposit'} - ${tenant.name}`} />
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
              <h2 className="text-base font-bold">Raise Maintenance Request</h2>
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
                {saving && <Loader2 className="w-4 h-4 animate-spin" />} Submit Request
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Leave Request Modal */}
      {leaveModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-base font-bold">Request Temporary Leave</h2>
              <button onClick={() => setLeaveModal(false)} aria-label="Close" className="text-gray-400 text-xl font-bold">×</button>
            </div>
            <div className="p-5 space-y-4">
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-xs font-semibold text-gray-600 block mb-1">From</label>
                  <input type="date" value={leaveForm.start_date} onChange={e => setLeaveForm(f => ({ ...f, start_date: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-500" />
                </div>
                <div className="flex-1">
                  <label className="text-xs font-semibold text-gray-600 block mb-1">To</label>
                  <input type="date" value={leaveForm.end_date} onChange={e => setLeaveForm(f => ({ ...f, end_date: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-500" />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1">Reason (optional)</label>
                <textarea rows={3} value={leaveForm.reason} onChange={e => setLeaveForm(f => ({ ...f, reason: e.target.value }))} placeholder="e.g. Going home for a family function" className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-500 resize-none" />
              </div>
            </div>
            <div className="px-5 py-4 border-t border-gray-100">
              <button onClick={submitLeaveRequest} disabled={savingLeave} className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50 transition">
                {savingLeave && <Loader2 className="w-4 h-4 animate-spin" />} Submit Request
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Profile Update Request Modal (Phase 8.7) */}
      {profileUpdateModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl max-h-[85vh] flex flex-col">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between shrink-0">
              <h2 className="text-base font-bold">Request Profile Update</h2>
              <button onClick={() => setProfileUpdateModal(false)} aria-label="Close" className="text-gray-400 text-xl font-bold">×</button>
            </div>
            <div className="p-5 space-y-4 overflow-y-auto">
              <p className="text-xs text-gray-500">
                Changes here won&apos;t take effect immediately — your owner will review and approve them first.
              </p>
              {[
                ['name', 'Full Name'], ['email', 'Email'], ['aadhaar_number', 'Aadhaar Number'],
                ['permanent_address', 'Permanent Address'], ['emergency_contact_name', 'Emergency Contact Name'],
                ['emergency_contact', 'Emergency Contact Number'],
              ].map(([key, label]) => (
                <div key={key}>
                  <label className="text-xs font-semibold text-gray-600 block mb-1">{label}</label>
                  {key === 'permanent_address' ? (
                    <textarea rows={2} value={(profileUpdateForm as any)[key]} onChange={e => setProfileUpdateForm(f => ({ ...f, [key]: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-500 resize-none" />
                  ) : (
                    <input value={(profileUpdateForm as any)[key]} onChange={e => setProfileUpdateForm(f => ({ ...f, [key]: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-500" />
                  )}
                </div>
              ))}
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1">Reason (optional)</label>
                <textarea rows={2} value={profileUpdateForm.reason} onChange={e => setProfileUpdateForm(f => ({ ...f, reason: e.target.value }))}
                  placeholder="e.g. My address changed recently" className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-500 resize-none" />
              </div>
            </div>
            <div className="px-5 py-4 border-t border-gray-100 shrink-0">
              <button onClick={submitProfileUpdateRequest} disabled={savingProfileUpdate} className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50 transition">
                {savingProfileUpdate && <Loader2 className="w-4 h-4 animate-spin" />} Submit Request
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rent Extension Request Modal */}
      {extensionModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-base font-bold">Request Rent Extension</h2>
              <button onClick={() => setExtensionModal(false)} aria-label="Close" className="text-gray-400 text-xl font-bold">×</button>
            </div>
            <div className="p-5 space-y-4">
              <div className="bg-blue-50 rounded-xl p-3 text-xs text-blue-700">
                Asking for more time to pay {oldestUnpaidMonth?.label ?? thisMonth} rent. No late fee will apply until the date below, if approved.
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1">Pay By</label>
                <input type="date" value={extensionForm.requested_until} onChange={e => setExtensionForm(f => ({ ...f, requested_until: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1">Reason (optional)</label>
                <textarea rows={3} value={extensionForm.reason} onChange={e => setExtensionForm(f => ({ ...f, reason: e.target.value }))} placeholder="e.g. Salary credits on the 5th" className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-500 resize-none" />
              </div>
            </div>
            <div className="px-5 py-4 border-t border-gray-100">
              <button onClick={submitExtensionRequest} disabled={savingExtension} className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50 transition">
                {savingExtension && <Loader2 className="w-4 h-4 animate-spin" />} Submit Request
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Move-Out Request Modal */}
      {moveOutModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-base font-bold">Request Move-Out</h2>
              <button onClick={() => setMoveOutModal(false)} aria-label="Close" className="text-gray-400 text-xl font-bold">×</button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1">Intended Move-Out Date</label>
                <input type="date" value={moveOutForm.requested_date} onChange={e => setMoveOutForm(f => ({ ...f, requested_date: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1">Reason (optional)</label>
                <textarea rows={3} value={moveOutForm.reason} onChange={e => setMoveOutForm(f => ({ ...f, reason: e.target.value }))} placeholder="e.g. Relocating for a new job" className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-500 resize-none" />
              </div>
            </div>
            <div className="px-5 py-4 border-t border-gray-100">
              <button onClick={submitMoveOutRequest} disabled={savingMoveOut} className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50 transition">
                {savingMoveOut && <Loader2 className="w-4 h-4 animate-spin" />} Submit Request
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
    </div>
  )
}

// Phase 8.5 — replaces the old static "Profile Under Review" message with
// the Tenant Timeline, so a tenant waiting on owner review can see exactly
// where they are (Submitted / Resubmitted / Approved) instead of a plain
// paragraph, while keeping the exact same entry condition it had before
// (rendered only once onboarding_status is submitted/resubmitted/approved).
function OnboardingReviewScreen({ tenant }: { tenant: any }) {
  const [history, setHistory] = useState<ProfileStatusHistoryEntry[]>([])
  useEffect(() => { getProfileStatusHistory(tenant.id).then(setHistory).catch(() => setHistory([])) }, [tenant.id])
  const completion = calculateProfileCompletion(tenant)

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-6 py-10">
      <div className="text-center max-w-sm w-full">
        <div className="w-14 h-14 rounded-2xl bg-indigo-50 flex items-center justify-center mx-auto mb-4">
          <Clock className="w-6 h-6 text-indigo-600" />
        </div>
        <h1 className="text-lg font-extrabold text-gray-900 mb-1.5">Profile Under Review</h1>
        <p className="text-sm text-gray-500 mb-6">
          Thanks, {tenant.name}! Your details have been submitted. Your owner will review them and activate your account shortly.
        </p>
        <div className="bg-white rounded-2xl border border-gray-100 p-5 text-left shadow-sm">
          <StatusTimeline currentStatus={tenant.onboarding_status} history={history} completionPercent={completion} variant="tenant" />
        </div>
      </div>
    </div>
  )
}
