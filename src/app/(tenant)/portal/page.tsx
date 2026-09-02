'use client'
import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatINR, formatDate, calculateLateFee, getApprovedExtensionFor, getRentOutstandingSummary, computeEligibleMoveOutDate, computeJoiningPaymentStatus, parseDateOnly, friendlyErrorMessage } from '@/lib/utils'
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
  ChevronLeft, Paperclip, Zap, Building2, LayoutGrid, FolderOpen,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import ForcePasswordChangeModal from '@/components/shared/ForcePasswordChangeModal'
import OnboardingWizard from '@/components/tenant/OnboardingWizard'
import EnableNotificationsBanner from '@/components/shared/EnableNotificationsBanner'
import { Card, Badge, Button, SectionHeader, EmptyState, Avatar, ThemeToggle } from '@/components/tenant/ui'
import { useActiveExperience } from '@/lib/experience/useActiveExperience'
import PullToRefresh from '@/components/shared/PullToRefresh'

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
  const [payingBillId, setPayingBillId] = useState<string | null>(null)
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

      // Neither of these depends on the other's result (both only need
      // user.id) — running them in parallel instead of sequentially saves
      // a full network round-trip on every single portal load, which
      // matters most on the slower mobile connections this app is
      // actually used on.
      const [{ data: prof }, { data: t }] = await Promise.all([
        sb.from('profiles').select('must_change_password').eq('id', user.id).single(),
        sb.from('tenants').select('*, room:rooms(*), property:properties(name, address, upi_id, late_fee_per_day, late_fee_grace_days, owner_id)').eq('auth_user_id', user.id).single(),
      ])
      setMustChangePw(!!prof?.must_change_password)

      if (!t) { router.push('/login'); return }
      setTenant(t)

      // Same reasoning — payments and complaints only need t.id, not each
      // other, so they run in parallel too.
      const [{ data: p }, { data: c }] = await Promise.all([
        sb.from('payments').select('*').eq('tenant_id', t.id).order('payment_date', { ascending: false }),
        sb.from('complaints').select('*').eq('tenant_id', t.id).order('created_at', { ascending: false }),
      ])
      setPayments(p ?? [])
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
  const greetingHour = new Date().getHours()
  const greeting = greetingHour < 12 ? 'Good Morning' : greetingHour < 17 ? 'Good Afternoon' : 'Good Evening'
  const activePack = useActiveExperience()
  const timeSlot = greetingHour < 12 ? 'morning' : greetingHour < 17 ? 'afternoon' : greetingHour < 21 ? 'evening' : 'night'
  const packGreetingText = activePack?.greeting ? (activePack.greeting[timeSlot] ?? activePack.greeting.default) : null
  const nextDueDate = new Date(new Date().getFullYear(), new Date().getMonth(), new Date(tenant?.joining_date ?? Date.now()).getDate())
  const daysLeft = tenant ? Math.ceil((nextDueDate.getTime() - Date.now()) / 86400000) : 0
  const depositDue = tenant ? tenant.deposit_amount - tenant.deposit_paid : 0
  const joiningStatus = tenant ? computeJoiningPaymentStatus(tenant) : null
  const openComplaints = complaints.filter(c => c.status !== 'resolved').length
  const unreadMessages = messages.filter(m => m.sender === 'owner' && !m.read_by_tenant).length

  // Single authoritative ledger calculation (shared with the Owner
  // Dashboard/Payments pages via getRentOutstandingSummary) — walks every
  // month since joining, not just the current one, and applies advance
  // balance oldest-first, so the two sides of the app can never disagree
  // on what's actually still owed.
  //
  // Memoized: this component has 50+ pieces of state (every form field,
  // every modal open/close, every tab switch), so without this the full
  // month-by-month ledger walk — including the overlapping-leave interval
  // merge — would re-run from scratch on every single re-render, even
  // ones caused by typing in an unrelated field. Only recomputes when the
  // actual underlying data (tenant, payments, leaveRequests) changes.
  const { months: ledgerAfterAdvance, remainingAdvance, oldestUnpaidMonth, totalPending: totalRentPending } = useMemo(() => {
    if (!tenant) return { months: [], remainingAdvance: 0, oldestUnpaidMonth: null, totalPending: 0 }
    const approvedLeaves = leaveRequests.filter(l => l.status === 'approved')
    return getRentOutstandingSummary(tenant, payments, approvedLeaves)
  }, [tenant, payments, leaveRequests])

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
    const dueDay = parseDateOnly(tenant.joining_date).getDate()
    let dueDate = new Date(monthDate.getFullYear(), monthDate.getMonth(), dueDay)
    if (activeExtension) {
      const extendedDate = parseDateOnly(activeExtension.requested_until)
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
        // late_fee_amount keeps the fee separately identifiable from rent
        // for income reporting, even though it's still collected as one
        // combined payment for the tenant's convenience.
        late_fee_amount: payKind === 'rent' ? lateFee : 0,
        method, tenant_note: note, submitted_by_tenant: true,
        approval_status: 'pending_approval', payment_date: new Date().toISOString().slice(0, 10),
      })
      toast.success('Marked as paid — waiting for owner approval')
      if (payKind === 'rent') setClaimed(true)
      else setDepositClaimed(true)
      setPayModal(false)
    } catch (e: any) { toast.error(friendlyErrorMessage(e)) }
    setSaving(false)
  }

  async function handlePayBill(billId: string) {
    setPayingBillId(billId)
    try {
      await claimBillPaid(billId)
      setBills(prev => prev.map(b => b.id === billId ? { ...b, status: 'pending_approval' } : b))
      toast.success('Marked as paid — waiting for owner approval')
    } catch (e: any) { toast.error(friendlyErrorMessage(e)) }
    setPayingBillId(null)
  }

  const pendingBillsList = bills.filter(b => b.status === 'pending')
  const totalDueAll = (totalRentPending > 0 && !claimed ? totalRentPending : 0)
    + (depositDue > 0 && !depositClaimed ? depositDue : 0)
    + pendingBillsList.reduce((s, b) => s + b.amount, 0)
  const pendingItemCount = (totalRentPending > 0 && !claimed ? 1 : 0) + (depositDue > 0 && !depositClaimed ? 1 : 0) + pendingBillsList.length

  // Dashboard redesign (T2): rent + electricity, merged into one due-date-sorted list
  const upcomingDues = [
    ...(totalRentPending > 0 && tenant?.status === 'active' ? [{
      key: 'rent', icon: CalendarClock, title: `Rent — ${thisMonth}`,
      due: formatDate(nextDueDate.toISOString()), amount: totalRentPending,
    }] : []),
    ...pendingBillsList.map(b => ({
      key: `bill-${b.id}`, icon: Zap, title: `Electricity Bill — ${b.for_month}`,
      due: b.due_date ? formatDate(b.due_date) : 'Date not set', amount: b.amount,
    })),
  ]
  const latestBill = pendingBillsList[0] ?? bills[0]
  const unreadNoticeCount = allNotices.filter(n => !n.isRead).length

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
          late_fee_amount: lateFee,
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
    } catch (e: any) { toast.error(friendlyErrorMessage(e)) }
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
    } catch (e: any) { toast.error(friendlyErrorMessage(e)) }
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
    } catch (e: any) { toast.error(friendlyErrorMessage(e)) }
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
    } catch (e: any) { toast.error(friendlyErrorMessage(e)) }
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
    } catch (e: any) { toast.error(friendlyErrorMessage(e)) }
    setSavingExtension(false)
  }

  async function submitMoveOutRequest() {
    if (!moveOutForm.requested_date) { toast.error('Select a date'); return }
    // Notice period is rent-cycle based (see computeEligibleMoveOutDate) —
    // the same authoritative calculation the Owner side uses, so a
    // request can never be approved for a date the cycle rule doesn't
    // actually allow.
    const eligibleFrom = computeEligibleMoveOutDate(tenant.joining_date, new Date().toISOString().slice(0, 10))
    if (parseDateOnly(moveOutForm.requested_date) < eligibleFrom) {
      toast.error(`Based on your rent cycle, the earliest eligible move-out date is ${formatDate(eligibleFrom)}`)
      return
    }
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
    } catch (e: any) { toast.error(friendlyErrorMessage(e)) }
    setSavingMoveOut(false)
  }

  async function changePassword() {
    if (pwForm.newPw !== pwForm.confirm) { toast.error('Passwords do not match'); return }
    if (pwForm.newPw.length < 6) { toast.error('Min 6 characters'); return }
    const sb = createClient()
    const { error } = await sb.auth.updateUser({ password: pwForm.newPw })
    if (error) { toast.error(friendlyErrorMessage(error)); return }
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
    } catch (e: any) { toast.error(friendlyErrorMessage(e)) }
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
    } catch (e: any) { toast.error(friendlyErrorMessage(e)) }
    setSendingMsg(false)
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-tenant-bg">
      <Loader2 className="w-6 h-6 animate-spin text-tenant-primary" />
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
    <div className="h-[100dvh] overflow-hidden bg-tenant-bg flex">
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
      <aside className={`fixed lg:static inset-y-0 left-0 w-64 bg-tenant-surface border-r border-tenant-border flex flex-col z-40 transition-transform ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="px-5 h-16 flex items-center gap-2.5 border-b border-tenant-border">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-tenant-primary to-tenant-accent-teal flex items-center justify-center text-white font-extrabold text-sm">PG</div>
          <div>
            <div className="text-sm font-extrabold text-tenant-fg">RentFlow</div>
            <div className="text-[11px] text-tenant-muted-subtle">Tenant Portal</div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => { key === 'messages' ? openMessagesTab() : setTab(key); setSidebarOpen(false) }}
              className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl text-sm font-semibold transition ${
                tab === key ? 'bg-tenant-primary/10 text-tenant-primary' : 'text-tenant-muted hover:bg-tenant-surface-hover'
              }`}>
              <span className="flex items-center gap-3"><Icon className="w-4 h-4" /> {label}</span>
              {key === 'messages' && unreadMessages > 0 && (
                <span className="bg-tenant-danger text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">{unreadMessages}</span>
              )}
              {key === 'maintenance' && openComplaints > 0 && (
                <span className="bg-tenant-warning-subtle text-tenant-warning text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">{openComplaints}</span>
              )}
              {key === 'notices' && allNotices.filter(n => !n.isRead).length > 0 && (
                <span className="bg-tenant-danger text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">{allNotices.filter(n => !n.isRead).length}</span>
              )}
            </button>
          ))}
        </nav>

        <div className="p-3">
          <div className="bg-tenant-primary/10 rounded-2xl p-4">
            <div className="w-9 h-9 rounded-xl bg-tenant-surface-elevated flex items-center justify-center mb-2 shadow-tenant-sm">
              <Wallet className="w-4 h-4 text-tenant-primary" />
            </div>
            <div className="text-xs font-bold text-tenant-fg">Pay Rent Easily</div>
            <div className="text-[11px] text-tenant-muted mb-2">Make your rent payment securely in just a few clicks.</div>
            <button onClick={() => openPay('rent')} className="w-full text-xs font-semibold text-tenant-primary bg-tenant-surface-elevated rounded-xl py-1.5 shadow-tenant-sm hover:bg-tenant-surface-hover transition">
              Pay Now
            </button>
          </div>
        </div>
      </aside>

      {sidebarOpen && <div onClick={() => setSidebarOpen(false)} className="fixed inset-0 bg-black/30 z-30 lg:hidden" />}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 h-full">
        <header className="bg-tenant-surface border-b border-tenant-border px-4 lg:px-8 min-h-16 native-safe-top flex items-center justify-between sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(true)} className="lg:hidden text-tenant-muted">☰</button>
            <div className="hidden sm:block">
              <div className="text-sm font-extrabold text-tenant-fg leading-tight">
                {navItems.find(n => n.key === tab)?.label ?? 'Dashboard'}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <button onClick={() => setNotifOpen(o => !o)} aria-label="Notifications" className="relative p-2 rounded-xl bg-tenant-bg-subtle hover:bg-tenant-surface-hover transition text-tenant-muted">
                <Bell className="w-4 h-4" />
                {tenantNotifications.length > 0 && (
                  <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 bg-tenant-danger rounded-full border-2 border-tenant-surface text-[9px] text-white font-bold flex items-center justify-center">
                    {tenantNotifications.length > 9 ? '9+' : tenantNotifications.length}
                  </span>
                )}
              </button>
              {notifOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setNotifOpen(false)} />
                  {/* w-80 with right-0 anchoring used to push this off the
                      left edge of the viewport on narrow phone screens
                      (right-anchored + fixed-width can overshoot the left
                      side once the screen is narrower than the sidebar +
                      dropdown combined). Capping with max-w-[calc(100vw-2rem)]
                      lets it shrink to fit instead of overflowing, while
                      still preferring the full 320px (w-80) on anything
                      wide enough for it. */}
                  <div className="absolute top-full right-0 mt-1.5 w-80 max-w-[calc(100vw-2rem)] bg-tenant-surface-elevated rounded-xl shadow-tenant-lg border border-tenant-border z-50 overflow-hidden">
                    <div className="px-4 py-3 border-b border-tenant-border font-bold text-sm text-tenant-fg">Notifications</div>
                    <div className="max-h-80 overflow-y-auto">
                      {tenantNotifications.length === 0 ? (
                        <div className="text-center py-8 text-sm text-tenant-muted-subtle">You&apos;re all caught up!</div>
                      ) : tenantNotifications.map(n => (
                        <button key={n.id} onClick={() => { setNotifOpen(false); n.tab === 'messages' ? openMessagesTab() : setTab(n.tab) }}
                          className="w-full text-left px-4 py-3 hover:bg-tenant-surface-hover border-b border-tenant-border last:border-0 transition">
                          <div className="text-sm font-semibold text-tenant-fg truncate">{n.title}</div>
                          <div className="text-xs text-tenant-muted mt-0.5 line-clamp-2 break-words">{n.subtitle}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="relative">
              <button onClick={() => setProfileMenuOpen(o => !o)} className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-tenant-primary to-tenant-accent-teal flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
                  {initials}
                </div>
                <div className="hidden sm:block text-left">
                  <div className="text-sm font-bold text-tenant-fg leading-tight">{tenant.name}</div>
                  <div className="text-xs text-tenant-muted-subtle leading-tight">Tenant</div>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-tenant-muted-subtle hidden sm:block" />
              </button>
              {profileMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setProfileMenuOpen(false)} />
                  <div className="absolute top-full right-0 mt-1.5 w-48 max-w-[calc(100vw-2rem)] bg-tenant-surface-elevated rounded-xl shadow-tenant-lg border border-tenant-border z-50 overflow-hidden">
                    <button onClick={() => { setProfileMenuOpen(false); setTab('tenancy') }}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-tenant-fg hover:bg-tenant-surface-hover transition">
                      <UserIcon className="w-4 h-4" /> My Tenancy
                    </button>
                    <button onClick={() => { setProfileMenuOpen(false); setPwModal(true) }}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-tenant-fg hover:bg-tenant-surface-hover transition">
                      <Lock className="w-4 h-4" /> Change Password
                    </button>
                    <button onClick={async () => { const sb = createClient(); await sb.auth.signOut(); router.push('/login') }}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-tenant-danger hover:bg-tenant-danger-subtle transition">
                      <LogOut className="w-4 h-4" /> Logout
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        <main id="main-content" className="flex-1 min-h-0 flex flex-col">
          <PullToRefresh className="p-4 pb-24 lg:p-8 max-w-6xl w-full mx-auto">
          {/* key={tab} re-triggers the entrance animation on every tab
              switch, same as PageTransition does for route-based navigation —
              the portal's tabs are client-side state, not real routes, so
              this is the tab-switch equivalent of that same effect. */}
          <div key={tab} className="animate-page-in">

          {tab === 'dashboard' && (
            <div className="space-y-5">
              <EnableNotificationsBanner />

              {/* Welcome banner — accent colors/greeting swap to the active
                  Experience Pack (festival/season) when one is live today;
                  falls back to the existing look/copy otherwise. See
                  src/lib/experience/ (previously built but never wired to
                  any screen) and useActiveExperience.ts. */}
              <div
                className="relative overflow-hidden rounded-tenant-2xl bg-tenant-primary/10 border border-tenant-primary/15 p-5"
                style={activePack?.accentPalette?.primary ? {
                  backgroundColor: `hsl(${activePack.accentPalette.primary} / 0.12)`,
                  borderColor: `hsl(${activePack.accentPalette.primary} / 0.25)`,
                } : undefined}
              >
                <div className="relative z-10 pr-16">
                  <h1 className="font-tenant-display text-lg font-extrabold text-tenant-fg">
                    {packGreetingText ?? `${greeting}, ${tenant.name.split(' ')[0]}`} 👋
                  </h1>
                  <p className="text-sm text-tenant-muted mt-1">
                    {activePack ? activePack.name : "Welcome back! Here's what's happening."}
                  </p>
                </div>
                <Building2
                  className="absolute -right-4 -bottom-5 w-24 h-24 text-tenant-primary/15 pointer-events-none"
                  strokeWidth={1}
                  style={activePack?.accentPalette?.primary ? { color: `hsl(${activePack.accentPalette.primary} / 0.18)` } : undefined}
                />
              </div>

              {joiningStatus && joiningStatus.totalOutstanding > 0 && (
                <Card variant="default" className={joiningStatus.status === 'overdue' ? 'bg-tenant-danger-subtle border-tenant-danger/20' : 'bg-tenant-warning-subtle border-tenant-warning/20'}>
                  <div className="flex items-start gap-3">
                    <span className="text-xl">🏠</span>
                    <div className="flex-1">
                      <div className={`text-sm font-bold ${joiningStatus.status === 'overdue' ? 'text-tenant-danger' : 'text-tenant-warning'}`}>
                        Joining Payment {joiningStatus.status === 'overdue' ? 'Overdue' : 'Due'}: {formatINR(joiningStatus.totalOutstanding)}
                      </div>
                      <div className={`text-xs mt-1 space-y-0.5 ${joiningStatus.status === 'overdue' ? 'text-tenant-danger/80' : 'text-tenant-warning/80'}`}>
                        {joiningStatus.depositOutstanding > 0 && <div>Deposit: {formatINR(joiningStatus.depositPaid)} / {formatINR(joiningStatus.depositRequired)} — {formatINR(joiningStatus.depositOutstanding)} remaining</div>}
                        {joiningStatus.rentOutstanding > 0 && <div>Joining rent: {formatINR(joiningStatus.rentPaid)} / {formatINR(joiningStatus.rentRequired)} — {formatINR(joiningStatus.rentOutstanding)} remaining</div>}
                        <div>Pay by {formatDate(joiningStatus.deadline)}{joiningStatus.status === 'overdue' ? ' — deadline has passed' : ''}</div>
                      </div>
                    </div>
                  </div>
                </Card>
              )}

              {agreementDaysLeft !== null && agreementDaysLeft <= 14 && (agreement.status === 'signed' || agreement.status === 'active') && (
                <Card variant="default" className={agreementDaysLeft < 0 ? 'bg-tenant-danger-subtle border-tenant-danger/20' : 'bg-tenant-warning-subtle border-tenant-warning/20'}>
                  <div className="flex items-center gap-3">
                    <span className="text-xl">📄</span>
                    <div className="flex-1">
                      <div className={`text-sm font-bold ${agreementDaysLeft < 0 ? 'text-tenant-danger' : 'text-tenant-warning'}`}>
                        {agreementDaysLeft < 0 ? 'Your rent agreement has expired' : `Your rent agreement expires in ${agreementDaysLeft}d`}
                      </div>
                      <div className={`text-xs mt-0.5 ${agreementDaysLeft < 0 ? 'text-tenant-danger/80' : 'text-tenant-warning/80'}`}>Contact your owner to renew it.</div>
                    </div>
                  </div>
                </Card>
              )}

              {/* Overview */}
              <div>
                <SectionHeader title="Overview" />
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <Card className="text-center">
                    <div className="w-11 h-11 rounded-tenant-xl mx-auto mb-2.5 flex items-center justify-center bg-tenant-primary/15">
                      <CalendarClock className="w-5 h-5 text-tenant-primary" />
                    </div>
                    <div className="text-xs text-tenant-muted">Total Rent (Monthly)</div>
                    <div className="text-lg font-extrabold text-tenant-fg mt-1 tenant-numeric">{formatINR(tenant.monthly_rent)}</div>
                    <div className="text-[11px] text-tenant-muted-subtle mt-0.5">Due on {formatDate(nextDueDate.toISOString())}</div>
                  </Card>
                  <Card className="text-center">
                    <div className="w-11 h-11 rounded-tenant-xl mx-auto mb-2.5 flex items-center justify-center bg-tenant-danger/15">
                      <AlertCircle className="w-5 h-5 text-tenant-danger" />
                    </div>
                    <div className="text-xs text-tenant-muted">Pending Rent</div>
                    <div className="text-lg font-extrabold text-tenant-fg mt-1 tenant-numeric">{formatINR(totalRentPending)}</div>
                    <div className={`text-[11px] mt-0.5 ${thisMonthPaid ? 'text-tenant-success' : 'text-tenant-danger'}`}>{thisMonthPaid ? 'All paid' : '1 month pending'}</div>
                  </Card>
                  <Card className="text-center">
                    <div className="w-11 h-11 rounded-tenant-xl mx-auto mb-2.5 flex items-center justify-center bg-tenant-success/15">
                      <ShieldCheck className="w-5 h-5 text-tenant-success" />
                    </div>
                    <div className="text-xs text-tenant-muted">Deposit Amount</div>
                    <div className="text-lg font-extrabold text-tenant-fg mt-1 tenant-numeric">{formatINR(tenant.deposit_amount)}</div>
                    <div className={`text-[11px] mt-0.5 ${depositDue <= 0 ? 'text-tenant-success' : 'text-tenant-warning'}`}>{depositDue <= 0 ? 'Paid' : 'Pending'}</div>
                  </Card>
                  <Card className="text-center">
                    <div className="w-11 h-11 rounded-tenant-xl mx-auto mb-2.5 flex items-center justify-center bg-tenant-warning/15">
                      <Zap className="w-5 h-5 text-tenant-warning" />
                    </div>
                    <div className="text-xs text-tenant-muted">Electricity Bill</div>
                    <div className="text-lg font-extrabold text-tenant-fg mt-1 tenant-numeric">{latestBill ? formatINR(latestBill.amount) : '—'}</div>
                    <div className="text-[11px] text-tenant-muted-subtle mt-0.5">{latestBill ? latestBill.for_month : 'No bills yet'}</div>
                  </Card>
                </div>
              </div>

              {/* Rent Overview with progress bar */}
              <Card padding="lg">
                <div className="flex items-center justify-between gap-3 mb-4">
                  <div className="text-[15px] font-bold text-tenant-fg">
                    Rent Overview <span className="text-tenant-primary">— {thisMonth}</span>
                  </div>
                  <button onClick={() => setTab('rent')} className="flex items-center gap-0.5 text-xs font-semibold text-tenant-primary shrink-0">
                    View Details <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-3 mb-3">
                  <div>
                    <div className="text-xs text-tenant-muted">Rent Amount</div>
                    <div className="text-base font-extrabold text-tenant-fg tenant-numeric mt-0.5">{formatINR(referenceMonth?.amount ?? tenant.monthly_rent)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-tenant-muted">Paid Amount</div>
                    <div className="text-base font-extrabold text-tenant-success tenant-numeric mt-0.5">{formatINR(donutPaid)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-tenant-muted">Pending Amount</div>
                    <div className="text-base font-extrabold text-tenant-danger tenant-numeric mt-0.5">{formatINR(donutPending)}</div>
                  </div>
                </div>
                <div className="h-2 rounded-tenant-full bg-tenant-danger/20 overflow-hidden mb-4">
                  <div className="h-full bg-tenant-success rounded-tenant-full transition-all" style={{ width: `${Math.min(100, donutPct)}%` }} />
                </div>
                {!thisMonthPaid && tenant.status === 'active' ? (
                  <div className="flex items-center justify-between gap-3 flex-wrap bg-tenant-danger-subtle rounded-tenant-xl px-4 py-3">
                    <div className="flex items-center gap-2 text-xs text-tenant-danger font-semibold">
                      <AlertCircle className="w-4 h-4 flex-shrink-0" />
                      Rent is pending. Please pay before {formatDate(nextDueDate.toISOString())}.
                    </div>
                    <Button size="sm" onClick={() => openPay('rent')}>Pay Rent</Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-tenant-success text-sm font-semibold">
                    <CheckCircle className="w-4 h-4" /> All rent paid up!
                  </div>
                )}
              </Card>

              {/* Upcoming Dues */}
              <div>
                <SectionHeader title="Upcoming Dues" action={upcomingDues.length > 0 && <button onClick={() => setTab('rent')}>View All</button>} />
                <Card padding="none">
                  {upcomingDues.length === 0 ? (
                    <EmptyState icon={CheckCircle} title="No dues right now" subtitle="You're all caught up!" className="py-10" />
                  ) : (
                    <div className="divide-y divide-tenant-border">
                      {upcomingDues.map(d => (
                        <button key={d.key} onClick={() => setTab('rent')}
                          className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-tenant-surface-hover transition">
                          <div className="w-10 h-10 rounded-tenant-xl bg-tenant-warning/15 flex items-center justify-center flex-shrink-0">
                            <d.icon className="w-4.5 h-4.5 text-tenant-warning" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-semibold text-tenant-fg truncate">{d.title}</div>
                            <div className="text-xs text-tenant-muted">Due on {d.due}</div>
                          </div>
                          <div className="text-sm font-bold text-tenant-danger tenant-numeric shrink-0">{formatINR(d.amount)}</div>
                          <ChevronRight className="w-4 h-4 text-tenant-muted-subtle flex-shrink-0" />
                        </button>
                      ))}
                    </div>
                  )}
                </Card>
              </div>

              {/* Module shortcuts */}
              <div>
                <SectionHeader title="Quick Access" />
                <div className="grid grid-cols-4 gap-3">
                  {[
                    { label: 'Rent & Payments', icon: Wallet, bg: 'bg-tenant-primary/15', color: 'text-tenant-primary', onClick: () => setTab('rent') },
                    { label: 'Deposit', icon: ShieldCheck, bg: 'bg-tenant-success/15', color: 'text-tenant-success', onClick: () => setTab('rent') },
                    { label: 'Electricity Bill', icon: Zap, bg: 'bg-tenant-warning/15', color: 'text-tenant-warning', onClick: () => setTab('rent') },
                    { label: 'Documents', icon: FolderOpen, bg: 'bg-tenant-info/15', color: 'text-tenant-info', onClick: () => setTab('documents') },
                    { label: 'Complaints', icon: Wrench, bg: 'bg-tenant-danger/15', color: 'text-tenant-danger', onClick: () => setTab('maintenance'), badge: openComplaints },
                    { label: 'Notices', icon: Megaphone, bg: 'bg-tenant-purple/15', color: 'text-tenant-purple', onClick: () => setTab('notices'), badge: unreadNoticeCount },
                    { label: 'My Profile', icon: UserIcon, bg: 'bg-tenant-teal/15', color: 'text-tenant-teal', onClick: () => setTab('tenancy') },
                    { label: 'My Room', icon: Users2, bg: 'bg-tenant-primary/15', color: 'text-tenant-primary', onClick: () => setTab('tenancy') },
                  ].map(m => (
                    <button key={m.label} onClick={m.onClick}
                      className="relative flex flex-col items-center gap-2 bg-tenant-surface border border-tenant-border rounded-tenant-xl p-3 active:scale-[0.97] transition">
                      {m.badge ? (
                        <span className="absolute top-1.5 right-1.5 min-w-[16px] h-4 px-1 bg-tenant-danger rounded-tenant-full text-[9px] text-white font-bold flex items-center justify-center">
                          {m.badge > 9 ? '9+' : m.badge}
                        </span>
                      ) : null}
                      <div className={`w-11 h-11 rounded-tenant-xl flex items-center justify-center ${m.bg}`}>
                        <m.icon className={`w-5 h-5 ${m.color}`} />
                      </div>
                      <span className="text-[11px] font-semibold text-tenant-fg text-center leading-tight">{m.label}</span>
                    </button>
                  ))}
                </div>
              </div>

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
                  <Card padding="none">
                    <div className="px-4 py-3 border-b border-tenant-border flex items-center gap-2">
                      <span className="text-base">🎂</span>
                      <span className="font-bold text-sm text-tenant-fg">Upcoming Birthdays</span>
                    </div>
                    <div className="divide-y divide-tenant-border">
                      {withNextOccurrence.map((b, i) => {
                        const isToday = b.next.toDateString() === today.toDateString()
                        return (
                          <div key={i} className="px-4 py-2.5 flex items-center justify-between">
                            <span className="text-sm text-tenant-fg">{b.name}{isToday ? ' 🎉' : ''}</span>
                            <span className={`text-xs font-semibold ${isToday ? 'text-pink-500' : 'text-tenant-muted-subtle'}`}>
                              {isToday ? 'Today!' : b.next.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </Card>
                )
              })()}
            </div>
          )}

          {tab === 'tenancy' && (
            <div className="space-y-5">
              <div>
                <h1 className="font-tenant-display text-xl font-extrabold text-tenant-fg">My Tenancy</h1>
                <p className="text-sm text-tenant-muted">Your room, property and agreement details.</p>
              </div>

              <Card padding="lg">
                <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
                  <div className="flex items-center gap-4">
                    <Avatar name={tenant.name} size="lg" />
                    <div>
                      <div className="text-lg font-extrabold text-tenant-fg">{tenant.name}</div>
                      <div className="text-sm text-tenant-muted">Room {tenant.room?.room_number ?? '—'} · Bed {tenant.bed_label ?? '—'}</div>
                    </div>
                  </div>
                  {tenant.status === 'active' && !profileUpdateRequests.some(u => u.status === 'pending') && (
                    <Button
                      size="sm"
                      onClick={() => {
                        setProfileUpdateForm({
                          name: tenant.name || '', email: tenant.email || '', aadhaar_number: tenant.aadhaar_number || '',
                          permanent_address: tenant.permanent_address || '', emergency_contact_name: tenant.emergency_contact_name || '',
                          emergency_contact: tenant.emergency_contact || '', reason: '',
                        })
                        setProfileUpdateModal(true)
                      }}
                    >
                      Request Profile Update
                    </Button>
                  )}
                </div>
                {profileUpdateRequests.some(u => u.status === 'pending') && (
                  <div className="bg-tenant-warning-subtle rounded-tenant-xl p-3 mb-4 text-xs text-tenant-warning">
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
                    <div key={label} className="flex justify-between border-b border-tenant-border pb-3 last:border-0 last:pb-0">
                      <span className="text-sm text-tenant-muted">{label}</span>
                      <span className="text-sm font-bold text-tenant-fg capitalize">{value}</span>
                    </div>
                  ))}
                </div>
              </Card>

              <Card padding="lg">
                <div className="font-bold text-sm text-tenant-fg mb-4">Security Deposit</div>
                <div className="space-y-3">
                  {[
                    ['Total Deposit', formatINR(tenant.deposit_amount)],
                    ['Amount Paid', formatINR(tenant.deposit_paid)],
                    ['Pending', formatINR(Math.max(0, depositDue))],
                    ['Status', depositDue <= 0 ? 'Fully Paid' : 'Partially Paid'],
                  ].map(([label, value]) => (
                    <div key={label} className="flex justify-between border-b border-tenant-border pb-3 last:border-0 last:pb-0">
                      <span className="text-sm text-tenant-muted">{label}</span>
                      <span className="text-sm font-bold text-tenant-fg tenant-numeric">{value}</span>
                    </div>
                  ))}
                  {tenant.deposit_refunded > 0 && (
                    <div className="bg-tenant-success-subtle rounded-tenant-xl p-4 space-y-2 mt-2">
                      <div className="text-xs font-bold text-tenant-success">Refund Processed</div>
                      <div className="flex justify-between text-sm">
                        <span className="text-tenant-muted">Amount Refunded</span>
                        <span className="font-bold text-tenant-success tenant-numeric">{formatINR(tenant.deposit_refunded)}</span>
                      </div>
                      {tenant.deposit_refund_date && (
                        <div className="flex justify-between text-sm">
                          <span className="text-tenant-muted">Refund Date</span>
                          <span className="font-bold text-tenant-fg">{formatDate(tenant.deposit_refund_date)}</span>
                        </div>
                      )}
                      {tenant.deposit_deduction_items?.length > 0 && (
                        <div className="pt-1 space-y-1 border-t border-tenant-success/20 mt-1">
                          <div className="text-xs font-semibold text-tenant-success pt-1">Deductions</div>
                          {tenant.deposit_deduction_items.map((item: DepositDeductionItem, idx: number) => (
                            <div key={idx} className="flex justify-between text-xs text-tenant-muted">
                              <span>{item.label}</span>
                              <span>− {formatINR(item.amount)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {tenant.deposit_deduction_notes && (
                        <div className="text-xs text-tenant-muted-subtle mt-1">Note: {tenant.deposit_deduction_notes}</div>
                      )}
                    </div>
                  )}
                  {tenant.deposit_refunded === 0 && (tenant.status === 'leaving' || tenant.status === 'left') && tenant.deposit_paid > 0 && (
                    <div className="bg-tenant-warning-subtle rounded-tenant-xl p-4 mt-2">
                      <div className="text-xs font-bold text-tenant-warning">Settlement Pending</div>
                      <div className="text-xs text-tenant-warning/80 mt-1">Your deposit refund is being processed by the owner.</div>
                    </div>
                  )}
                </div>
                {depositDue > 0 && !depositClaimed && tenant.status === 'active' && (
                  <Button fullWidth className="mt-4" onClick={() => openPay('deposit')}>
                    Pay {formatINR(depositDue)} Deposit
                  </Button>
                )}
              </Card>

              <Card padding="lg">
                <div className="flex items-center justify-between mb-4">
                  <div className="font-bold text-sm text-tenant-fg">Temporary Leave</div>
                  {tenant.status === 'active' && (
                    <Button size="sm" onClick={() => setLeaveModal(true)}>Request Leave</Button>
                  )}
                </div>
                {leaveRequests.length === 0 ? (
                  <EmptyState icon={CalendarClock} title="No leave requests yet" className="py-6" />
                ) : (
                  <div className="space-y-3">
                    {leaveRequests.map(l => (
                      <div key={l.id} className="border border-tenant-border rounded-tenant-lg p-4">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <span className="text-sm font-bold text-tenant-fg">{formatDate(l.start_date)} – {formatDate(l.end_date)}</span>
                          <Badge tone={l.status === 'approved' ? 'success' : l.status === 'rejected' ? 'danger' : 'warning'} size="sm" className="capitalize">
                            {l.status}
                          </Badge>
                        </div>
                        {l.reason && <p className="text-sm text-tenant-muted mt-1.5">{l.reason}</p>}
                        {l.owner_note && <p className="text-xs text-tenant-muted-subtle mt-1.5">Owner note: {l.owner_note}</p>}
                        <div className="text-xs text-tenant-muted-subtle mt-2">Requested {formatDate(l.created_at)}</div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              <Card padding="lg">
                <div className="flex items-center justify-between mb-4">
                  <div className="font-bold text-sm text-tenant-fg">Move-Out</div>
                  {tenant.status === 'active' && !moveOutRequests.some(m => m.status !== 'rejected') && (
                    <Button size="sm" onClick={() => setMoveOutModal(true)}>Request Move-Out</Button>
                  )}
                </div>
                {tenant.status === 'leaving' && moveOutChecklist && (
                  <div className="mb-4 bg-tenant-warning-subtle border border-tenant-warning/20 rounded-tenant-xl p-4">
                    <div className="text-xs font-bold text-tenant-warning mb-2">
                      Owner Move-Out Checklist ({moveOutChecklist.items.filter((i: any) => i.checked).length}/{moveOutChecklist.items.length})
                    </div>
                    <div className="space-y-1.5">
                      {moveOutChecklist.items.map((i: any, idx: number) => (
                        <div key={idx} className="flex items-center gap-2 text-xs text-tenant-warning">
                          <span>{i.checked ? '✅' : '⬜'}</span> {i.label}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {moveOutRequests.length === 0 ? (
                  <EmptyState icon={LogOut} title="No move-out requests yet" className="py-6" />
                ) : (
                  <div className="space-y-3">
                    {moveOutRequests.map(m => (
                      <div key={m.id} className="border border-tenant-border rounded-tenant-lg p-4">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <span className="text-sm font-bold text-tenant-fg">Move out on {formatDate(m.requested_date)}</span>
                          <Badge tone={m.status === 'approved' ? 'success' : m.status === 'rejected' ? 'danger' : 'warning'} size="sm" className="capitalize">
                            {m.status}
                          </Badge>
                        </div>
                        {m.reason && <p className="text-sm text-tenant-muted mt-1.5">{m.reason}</p>}
                        {m.owner_note && <p className="text-xs text-tenant-muted-subtle mt-1.5">Owner note: {m.owner_note}</p>}
                        <div className="text-xs text-tenant-muted-subtle mt-2">Requested {formatDate(m.created_at)}</div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              <Card padding="lg">
                <SectionHeader title="Appearance" className="mb-0" />
                <p className="text-xs text-tenant-muted-subtle -mt-1 mb-3">Theme applies across the whole tenant portal.</p>
                <ThemeToggle />
              </Card>
            </div>
          )}

          {tab === 'rent' && (
            <div className="space-y-5">
              <div>
                <h1 className="font-tenant-display text-xl font-extrabold text-tenant-fg">Rent & Payments</h1>
                <p className="text-sm text-tenant-muted">Your full monthly rent history.</p>
              </div>

              {(lateFee > 0 || remainingAdvance > 0 || (oldestUnpaidMonth?.adjustment ?? 0) > 0 || activeExtension) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {lateFee > 0 && (
                    <Card className="bg-tenant-danger-subtle border-tenant-danger/20">
                      <div className="text-xs font-bold text-tenant-danger">Late Fee Applied</div>
                      <div className="text-lg font-extrabold text-tenant-danger mt-0.5 tenant-numeric">{formatINR(lateFee)}</div>
                      <div className="text-xs text-tenant-danger/80 mt-0.5">Added to your next payment for {oldestUnpaidMonth?.label}</div>
                    </Card>
                  )}
                  {remainingAdvance > 0 && (
                    <Card className="bg-tenant-success-subtle border-tenant-success/20">
                      <div className="text-xs font-bold text-tenant-success">Advance Balance</div>
                      <div className="text-lg font-extrabold text-tenant-success mt-0.5 tenant-numeric">{formatINR(remainingAdvance)}</div>
                      <div className="text-xs text-tenant-success/80 mt-0.5">Will auto-apply to your next due month</div>
                    </Card>
                  )}
                  {(oldestUnpaidMonth?.adjustment ?? 0) > 0 && (
                    <Card className="bg-tenant-primary/10 border-tenant-primary/20">
                      <div className="text-xs font-bold text-tenant-primary">Leave Adjustment</div>
                      <div className="text-lg font-extrabold text-tenant-primary mt-0.5 tenant-numeric">− {formatINR(oldestUnpaidMonth?.adjustment ?? 0)}</div>
                      <div className="text-xs text-tenant-primary/80 mt-0.5">Prorated for your approved leave in {oldestUnpaidMonth?.label}</div>
                    </Card>
                  )}
                  {activeExtension && (
                    <Card className="bg-tenant-info-subtle border-tenant-info/20">
                      <div className="text-xs font-bold text-tenant-info">Extension Granted</div>
                      <div className="text-lg font-extrabold text-tenant-info mt-0.5">Until {formatDate(activeExtension.requested_until)}</div>
                      <div className="text-xs text-tenant-info/80 mt-0.5">No late fee for {oldestUnpaidMonth?.label} until this date</div>
                    </Card>
                  )}
                </div>
              )}

              <Card padding="none">
                <div className="divide-y divide-tenant-border">
                  {ledgerDisplay.map(m => (
                    <div key={m.label} className="flex items-center justify-between px-4 py-3.5">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-tenant-fg">{m.label}</div>
                        <div className="text-xs text-tenant-muted-subtle">{m.paidOn ? `Paid on ${formatDate(m.paidOn)}` : 'Not yet paid'}</div>
                        {(m.adjustment ?? 0) > 0 && <div className="text-xs text-tenant-primary mt-0.5">Leave adjustment: − {formatINR(m.adjustment ?? 0)}</div>}
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-sm font-bold text-tenant-fg tenant-numeric">{formatINR(m.amount)}</div>
                        <Badge tone={m.status === 'paid' ? 'success' : m.status === 'partial' ? 'warning' : 'danger'} size="sm" className="mt-1">
                          {m.status === 'paid' ? 'Paid' : m.status === 'partial' ? 'Partial' : 'Pending'}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

              {!thisMonthPaid && !claimed && tenant.status === 'active' && (
                <Button fullWidth onClick={() => openPay('rent')}>
                  Pay {oldestUnpaidMonth?.label ?? thisMonth} Rent
                </Button>
              )}
              {!thisMonthPaid && !claimed && tenant.status === 'active' && oldestUnpaidMonth &&
                !rentExtensions.some(e => e.for_month === oldestUnpaidMonth.label && e.status !== 'rejected') && (
                <Button fullWidth variant="secondary" onClick={() => setExtensionModal(true)}>
                  Request Extension for {oldestUnpaidMonth.label}
                </Button>
              )}

              {rentExtensions.length > 0 && (
                <Card>
                  <div className="font-bold text-sm text-tenant-fg mb-3">Extension Requests</div>
                  <div className="space-y-3">
                    {rentExtensions.map(e => (
                      <div key={e.id} className="border border-tenant-border rounded-tenant-lg p-3">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <span className="text-sm font-bold text-tenant-fg">{e.for_month} → {formatDate(e.requested_until)}</span>
                          <Badge tone={e.status === 'approved' ? 'success' : e.status === 'rejected' ? 'danger' : 'warning'} size="sm" className="capitalize">
                            {e.status}
                          </Badge>
                        </div>
                        {e.reason && <p className="text-xs text-tenant-muted mt-1">{e.reason}</p>}
                        {e.owner_note && <p className="text-xs text-tenant-muted-subtle mt-1">Owner note: {e.owner_note}</p>}
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {bills.length > 0 && (
                <div>
                  <SectionHeader title="Other Bills" />
                  <Card padding="none">
                    <div className="divide-y divide-tenant-border">
                      {bills.map(b => (
                        <div key={b.id} className="flex items-center gap-3 px-4 py-3.5">
                          <div className="w-10 h-10 rounded-tenant-xl bg-tenant-warning/15 flex items-center justify-center flex-shrink-0">
                            <Zap className="w-4.5 h-4.5 text-tenant-warning" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-semibold text-tenant-fg truncate">{b.bill_type} — {b.for_month}</div>
                            <div className="text-xs text-tenant-muted-subtle tenant-numeric">{formatINR(b.amount)}</div>
                          </div>
                          {b.status === 'pending' ? (
                            <Button
                              size="sm"
                              className="shrink-0"
                              loading={payingBillId === b.id}
                              disabled={tenant.status !== 'active'}
                              onClick={() => handlePayBill(b.id)}
                            >
                              Pay
                            </Button>
                          ) : (
                            <Badge tone={b.status === 'paid' ? 'success' : 'info'} size="sm" className="capitalize shrink-0">
                              {b.status.replace('_', ' ')}
                            </Badge>
                          )}
                        </div>
                      ))}
                    </div>
                  </Card>
                </div>
              )}
            </div>
          )}

          {tab === 'history' && (
            <div className="space-y-5">
              <div>
                <h1 className="font-tenant-display text-xl font-extrabold text-tenant-fg">Payment History</h1>
                <p className="text-sm text-tenant-muted">All your payments, in one place.</p>
              </div>
              <Card padding="none">
                {payments.length === 0 ? (
                  <EmptyState icon={Wallet} title="No payments yet" className="py-12" />
                ) : (
                  <>
                    {/* Mobile: stacked card list, no horizontal scroll */}
                    <div className="sm:hidden divide-y divide-tenant-border">
                      {payments.map(p => (
                        <div key={p.id} className="flex items-center justify-between gap-3 px-4 py-3.5">
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-tenant-fg capitalize">{p.type} · {p.for_month ?? '—'}</div>
                            <div className="text-xs text-tenant-muted-subtle mt-0.5">{formatDate(p.payment_date)}</div>
                            <Badge tone={p.approval_status === 'approved' ? 'success' : p.approval_status === 'rejected' ? 'danger' : 'warning'} size="sm" className="capitalize mt-1">
                              {p.approval_status.replace('_', ' ')}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-1 shrink-0 relative">
                            <div className="text-sm font-bold text-tenant-fg tenant-numeric">{formatINR(p.amount_received)}</div>
                            <button onClick={() => setRowMenuOpen(o => o === p.id ? null : p.id)} className="p-1.5 hover:bg-tenant-surface-hover rounded-tenant-lg transition" aria-label="Row options">
                              <MoreVertical className="w-4 h-4 text-tenant-muted" />
                            </button>
                            {rowMenuOpen === p.id && (
                              <>
                                <div className="fixed inset-0 z-40" onClick={() => setRowMenuOpen(null)} />
                                <div className="absolute right-0 top-full mt-1 w-44 bg-tenant-surface-elevated rounded-tenant-xl shadow-tenant-md border border-tenant-border z-50 overflow-hidden">
                                  {p.approval_status === 'approved' ? (
                                    <button onClick={() => { downloadReceipt(p); setRowMenuOpen(null) }}
                                      className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-tenant-fg hover:bg-tenant-surface-hover transition">
                                      <Download className="w-3.5 h-3.5" /> Download Receipt
                                    </button>
                                  ) : (
                                    <div className="px-4 py-2.5 text-xs text-tenant-muted-subtle">Awaiting owner approval</div>
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
                        <tr className="text-left text-xs text-tenant-muted-subtle border-b border-tenant-border">
                          <th className="px-4 py-3 font-semibold">Date</th>
                          <th className="px-4 py-3 font-semibold">Type</th>
                          <th className="px-4 py-3 font-semibold">Month</th>
                          <th className="px-4 py-3 font-semibold">Amount</th>
                          <th className="px-4 py-3 font-semibold">Status</th>
                          <th className="px-4 py-3 font-semibold text-right">Txn ID</th>
                          <th className="px-4 py-3"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {payments.map(p => (
                          <tr key={p.id} className="border-b border-tenant-border last:border-0 hover:bg-tenant-surface-hover">
                            <td className="px-4 py-3.5 text-tenant-muted whitespace-nowrap">{formatDate(p.payment_date)}</td>
                            <td className="px-4 py-3.5 text-tenant-muted capitalize">{p.type}</td>
                            <td className="px-4 py-3.5 text-tenant-muted">{p.for_month ?? '—'}</td>
                            <td className="px-4 py-3.5 font-semibold text-tenant-fg tenant-numeric">{formatINR(p.amount_received)}</td>
                            <td className="px-4 py-3.5">
                              <Badge tone={p.approval_status === 'approved' ? 'success' : p.approval_status === 'rejected' ? 'danger' : 'warning'} size="sm" className="capitalize">
                                {p.approval_status.replace('_', ' ')}
                              </Badge>
                            </td>
                            <td className="px-4 py-3.5 text-right text-xs text-tenant-muted-subtle font-mono">#{p.id.slice(0, 8).toUpperCase()}</td>
                            <td className="px-4 py-3.5 text-right relative">
                              <button onClick={() => setRowMenuOpen(o => o === p.id ? null : p.id)} className="p-1.5 hover:bg-tenant-surface-hover rounded-tenant-lg transition" aria-label="Row options">
                                <MoreVertical className="w-4 h-4 text-tenant-muted" />
                              </button>
                              {rowMenuOpen === p.id && (
                                <>
                                  <div className="fixed inset-0 z-40" onClick={() => setRowMenuOpen(null)} />
                                  <div className="absolute right-4 top-full mt-1 w-44 bg-tenant-surface-elevated rounded-tenant-xl shadow-tenant-md border border-tenant-border z-50 overflow-hidden">
                                    {p.approval_status === 'approved' ? (
                                      <button onClick={() => { downloadReceipt(p); setRowMenuOpen(null) }}
                                        className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-tenant-fg hover:bg-tenant-surface-hover transition">
                                        <Download className="w-3.5 h-3.5" /> Download Receipt
                                      </button>
                                    ) : (
                                      <div className="px-4 py-2.5 text-xs text-tenant-muted-subtle">Awaiting owner approval</div>
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
              </Card>
            </div>
          )}

          {tab === 'maintenance' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h1 className="font-tenant-display text-xl font-extrabold text-tenant-fg">Maintenance</h1>
                  <p className="text-sm text-tenant-muted">Track issues you&apos;ve raised.</p>
                </div>
                <Button size="sm" icon={<Wrench className="w-4 h-4" />} onClick={() => setComplaintModal(true)}>
                  Raise New
                </Button>
              </div>
              <Card padding="none">
                {complaints.length === 0 ? (
                  <EmptyState icon={Wrench} title="No requests raised yet" className="py-12" />
                ) : (
                  <div className="divide-y divide-tenant-border">
                    {complaints.map(c => (
                      <div key={c.id} className="flex items-start justify-between gap-3 px-4 py-4">
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold text-tenant-fg flex items-center gap-1.5 flex-wrap">
                            <AlertCircle className="w-3.5 h-3.5 text-tenant-warning flex-shrink-0" /> {c.issue_type}
                            <span className="text-xs text-tenant-muted-subtle font-normal">#{c.id.slice(0, 8).toUpperCase()}</span>
                          </div>
                          {c.description && <div className="text-xs text-tenant-muted mt-1">{c.description}</div>}
                          <div className="text-xs text-tenant-muted-subtle mt-1">{formatDate(c.created_at)}</div>
                        </div>
                        <Badge tone={c.status === 'resolved' ? 'success' : c.status === 'in_progress' ? 'info' : 'warning'} size="sm" className="capitalize flex-shrink-0">
                          {c.status.replace('_', ' ')}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>
          )}

          {tab === 'requests' && (
            <div className="space-y-5">
              <div>
                <h1 className="font-tenant-display text-xl font-extrabold text-tenant-fg">My Requests</h1>
                <p className="text-sm text-tenant-muted">Every leave, extension, move-out and maintenance request in one place.</p>
              </div>

              <div className="flex flex-wrap gap-2">
                {[['all', 'All'], ['leave', 'Leave'], ['extension', 'Extension'], ['moveout', 'Move-Out'], ['maintenance', 'Maintenance'], ['profile', 'Profile Update']].map(([v, l]) => (
                  <button key={v} onClick={() => setRequestTypeFilter(v as any)}
                    className={`px-3 py-1.5 rounded-tenant-lg text-xs font-semibold whitespace-nowrap transition ${requestTypeFilter === v ? 'bg-tenant-primary text-tenant-primary-fg' : 'bg-tenant-surface border border-tenant-border text-tenant-muted hover:bg-tenant-surface-hover'}`}>
                    {l}
                  </button>
                ))}
              </div>

              <Card padding="none">
                {allRequests.length === 0 ? (
                  <EmptyState icon={FileText} title="No requests yet" className="py-12" />
                ) : (
                  <div className="divide-y divide-tenant-border">
                    {allRequests.map(r => (
                      <div key={r.id} className="flex items-start justify-between gap-3 px-4 py-4">
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold text-tenant-fg flex items-center gap-1.5">
                            <span>{r.icon}</span> {r.title}
                          </div>
                          <div className="text-xs text-tenant-muted-subtle mt-1">{r.typeLabel} · Requested {formatDate(r.created_at)}</div>
                          {r.detail && <div className="text-xs text-tenant-muted mt-1">{r.detail}</div>}
                        </div>
                        <Badge tone={r.status === 'approved' ? 'success' : r.status === 'rejected' ? 'danger' : 'warning'} size="sm" className="capitalize flex-shrink-0">
                          {(r as any).statusLabel ?? r.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>
          )}

          {tab === 'documents' && (
            <div className="space-y-5">
              <div>
                <h1 className="font-tenant-display text-xl font-extrabold text-tenant-fg">Documents</h1>
                <p className="text-sm text-tenant-muted">Your KYC and agreement status.</p>
              </div>
              <Card padding="none">
                <div className="divide-y divide-tenant-border">
                  <div className="flex items-center justify-between gap-3 px-4 py-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-tenant-xl bg-tenant-info/15 flex items-center justify-center flex-shrink-0"><FileText className="w-4 h-4 text-tenant-info" /></div>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-tenant-fg">Rent Agreement</div>
                        <div className="text-xs text-tenant-muted-subtle truncate">{agreement ? `${agreement.agreement_number} · ${agreement.status}` : 'System-generated from your tenant record'}</div>
                        {agreementDaysLeft !== null && agreementDaysLeft <= 30 && (agreement.status === 'signed' || agreement.status === 'active') && (
                          <div className={`text-xs font-semibold mt-0.5 ${agreementDaysLeft < 0 ? 'text-tenant-danger' : 'text-tenant-warning'}`}>
                            {agreementDaysLeft < 0 ? `Expired ${Math.abs(agreementDaysLeft)}d ago — ask your owner to renew` : agreementDaysLeft === 0 ? 'Expires today' : `Expires in ${agreementDaysLeft}d`}
                          </div>
                        )}
                      </div>
                    </div>
                    <button onClick={downloadAgreement} aria-label="Download rent agreement" className="p-2 hover:bg-tenant-surface-hover rounded-tenant-lg transition flex-shrink-0"><Download className="w-4 h-4 text-tenant-muted" /></button>
                  </div>
                  {agreement?.government_id && (
                    <div className="flex items-center justify-between gap-3 px-4 py-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-tenant-xl bg-tenant-success/15 flex items-center justify-center flex-shrink-0"><FileText className="w-4 h-4 text-tenant-success" /></div>
                        <div>
                          <div className="text-sm font-semibold text-tenant-fg">Government ID</div>
                          <div className="text-xs text-tenant-muted-subtle">Uploaded at joining</div>
                        </div>
                      </div>
                      <a href={agreement.government_id} target="_blank" rel="noreferrer" className="p-2 hover:bg-tenant-surface-hover rounded-tenant-lg transition flex-shrink-0" aria-label="View government ID"><Eye className="w-4 h-4 text-tenant-muted" /></a>
                    </div>
                  )}
                  <div className="flex items-center justify-between gap-3 px-4 py-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-tenant-xl bg-tenant-warning/15 flex items-center justify-center flex-shrink-0"><FileText className="w-4 h-4 text-tenant-warning" /></div>
                      <div>
                        <div className="text-sm font-semibold text-tenant-fg">Aadhaar Card</div>
                        <div className="text-xs text-tenant-muted-subtle">KYC verification status</div>
                      </div>
                    </div>
                    <Badge tone={tenant.aadhaar_status === 'verified' ? 'success' : tenant.aadhaar_status === 'rejected' ? 'danger' : 'warning'} size="sm" className="capitalize flex-shrink-0">
                      {tenant.aadhaar_status}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between gap-3 px-4 py-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-tenant-xl bg-tenant-purple/15 flex items-center justify-center flex-shrink-0"><FileText className="w-4 h-4 text-tenant-purple" /></div>
                      <div>
                        <div className="text-sm font-semibold text-tenant-fg">PAN Card</div>
                        <div className="text-xs text-tenant-muted-subtle">KYC verification status</div>
                      </div>
                    </div>
                    <Badge tone={tenant.pan_status === 'verified' ? 'success' : tenant.pan_status === 'rejected' ? 'danger' : 'warning'} size="sm" className="capitalize flex-shrink-0">
                      {tenant.pan_status}
                    </Badge>
                  </div>
                </div>
              </Card>
              <p className="text-xs text-tenant-muted-subtle">Document upload isn&apos;t available yet — ask your PG owner if they need physical/digital copies of your KYC documents.</p>
            </div>
          )}

          {tab === 'messages' && (
            <div className="space-y-5 h-full flex flex-col">
              <div>
                <h1 className="font-tenant-display text-xl font-extrabold text-tenant-fg">Messages</h1>
                <p className="text-sm text-tenant-muted">Chat directly with your PG owner.</p>
              </div>
              <Card padding="none" className="flex flex-col h-[60vh]">
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {messages.length === 0 ? (
                    <EmptyState icon={MessageCircle} title="No messages yet" subtitle="Say hello to your owner!" className="py-10" />
                  ) : messages.map(m => (
                    <div key={m.id} className={`flex ${m.sender === 'tenant' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[75%] rounded-tenant-2xl px-4 py-2.5 text-sm ${m.sender === 'tenant' ? 'bg-tenant-primary text-tenant-primary-fg' : 'bg-tenant-surface-hover text-tenant-fg'}`}>
                        <div>{m.body}</div>
                        <div className={`text-[10px] mt-1 ${m.sender === 'tenant' ? 'text-tenant-primary-fg/70' : 'text-tenant-muted-subtle'}`}>
                          {new Date(m.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="p-3.5 border-t border-tenant-border flex gap-2">
                  <input value={newMessage} onChange={e => setNewMessage(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && sendMessage()}
                    placeholder="Type a message…"
                    className="flex-1 px-4 py-2.5 bg-tenant-surface border border-tenant-border rounded-tenant-xl text-sm text-tenant-fg placeholder:text-tenant-muted-subtle focus:outline-none focus:border-tenant-primary focus:ring-2 focus:ring-tenant-primary/20" />
                  <Button size="icon" onClick={sendMessage} disabled={sendingMsg || !newMessage.trim()} loading={sendingMsg} className="flex-shrink-0">
                    {!sendingMsg && <Send className="w-4 h-4" />}
                  </Button>
                </div>
              </Card>
            </div>
          )}

          {tab === 'support' && (
            <div className="space-y-5">
              <div>
                <h1 className="font-tenant-display text-xl font-extrabold text-tenant-fg">Support</h1>
                <p className="text-sm text-tenant-muted">Get help or reach your PG owner directly.</p>
              </div>
              <Card padding="lg">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 rounded-tenant-xl bg-tenant-primary/15 flex items-center justify-center flex-shrink-0"><Headset className="w-5 h-5 text-tenant-primary" /></div>
                  <div>
                    <div className="font-bold text-tenant-fg">Contact {tenant.property?.name ?? 'your PG owner'}</div>
                    <div className="text-xs text-tenant-muted-subtle">Usually responds within a few hours</div>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button onClick={openMessagesTab} className="flex items-center justify-center gap-2 py-3 bg-tenant-primary/10 hover:bg-tenant-primary/15 text-tenant-primary rounded-tenant-xl text-sm font-semibold transition">
                    <MessageCircle className="w-4 h-4" /> Message Owner
                  </button>
                  <button onClick={() => setComplaintModal(true)} className="flex items-center justify-center gap-2 py-3 bg-tenant-warning/10 hover:bg-tenant-warning/15 text-tenant-warning rounded-tenant-xl text-sm font-semibold transition">
                    <Wrench className="w-4 h-4" /> Raise Maintenance Request
                  </button>
                  <button onClick={() => setTab('requests')} className="flex items-center justify-center gap-2 py-3 bg-tenant-surface-hover hover:bg-tenant-border text-tenant-fg rounded-tenant-xl text-sm font-semibold transition sm:col-span-2">
                    <CheckCircle className="w-4 h-4" /> View All My Requests
                  </button>
                </div>
              </Card>
              <Card padding="lg" className="space-y-4">
                <div className="font-bold text-sm text-tenant-fg">Frequently Asked</div>
                {[
                  ['How do I pay rent?', 'Go to Rent & Payments → Pay Rent Now, then confirm via UPI or by marking it paid for your owner to verify.'],
                  ['When is my deposit refunded?', 'Your security deposit is refunded after you vacate, following a room inspection, minus any pending dues or damages.'],
                  ['How do I report a maintenance issue?', 'Use the Maintenance tab or the button above to raise a request — your owner will be notified.'],
                  ['Can I download my agreement anytime?', 'Yes — go to Documents and tap the download icon next to Rent Agreement.'],
                ].map(([q, a]) => (
                  <div key={q} className="border-b border-tenant-border pb-3 last:border-0 last:pb-0">
                    <div className="text-sm font-semibold text-tenant-fg">{q}</div>
                    <div className="text-xs text-tenant-muted mt-1">{a}</div>
                  </div>
                ))}
              </Card>
            </div>
          )}

          {tab === 'notices' && (
            <div className="space-y-5">
              <div>
                <h1 className="font-tenant-display text-xl font-extrabold text-tenant-fg">Notice Board</h1>
                <p className="text-sm text-tenant-muted">Announcements from your PG owner.</p>
              </div>
              {allNotices.length === 0 ? (
                <Card className="p-12 text-center">
                  <EmptyState icon={Megaphone} title="No notices yet" className="py-0" />
                </Card>
              ) : (
                <div className="space-y-3">
                  {allNotices.map(n => (
                    <Card key={n.id} padding="lg" className={!n.isRead ? 'border-tenant-primary/30 ring-1 ring-tenant-primary/15' : ''}>
                      <div className="flex items-start justify-between gap-3 mb-2 flex-wrap">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-sm font-bold text-tenant-fg">{n.title}</h3>
                          {!n.isRead && <span className="w-2 h-2 rounded-full bg-tenant-primary flex-shrink-0" />}
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <Badge tone={n.priority === 'Urgent' ? 'danger' : n.priority === 'Important' ? 'warning' : 'neutral'} size="sm">
                            {n.priority}
                          </Badge>
                          <Badge tone="primary" size="sm">{n.category}</Badge>
                        </div>
                      </div>
                      <p className="text-sm text-tenant-muted whitespace-pre-wrap">{n.description}</p>
                      {n.attachment_url && (
                        <a href={n.attachment_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-xs font-semibold text-tenant-primary hover:underline mt-2">
                          <Paperclip className="w-3.5 h-3.5" /> {n.attachment_name || 'View attachment'}
                        </a>
                      )}
                      <div className="flex items-center justify-between gap-2 flex-wrap mt-3 pt-3 border-t border-tenant-border">
                        <div className="text-xs text-tenant-muted-subtle">
                          Published {formatDate(n.publish_date)}{n.expiry_date ? ` · Expires ${formatDate(n.expiry_date)}` : ''}
                          {n.created_by && ` · By ${n.created_by}`}
                        </div>
                        {!n.isRead && (
                          <button onClick={() => handleMarkNoticeRead(n)} className="text-xs font-semibold text-tenant-primary hover:underline flex-shrink-0">
                            Mark as Read
                          </button>
                        )}
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}

          </div>
          </PullToRefresh>
        </main>
      </div>

      {/* Bottom tab bar — mobile only, sidebar already covers desktop nav.
          Mirrors OwnerBottomNav.tsx treatment (indicator bar, ripple, icon-pop,
          elevation shadow, 52dp touch target) so Owner/Tenant nav feel like
          the same design system, per the UI-consistency pass. */}
      <nav className="lg:hidden tenant-safe-bottom fixed bottom-0 left-0 right-0 z-30 bg-tenant-surface-elevated/95 backdrop-blur-md border-t border-tenant-border shadow-[0_-8px_24px_-8px_rgba(0,0,0,0.12)]">
        <div className="flex items-stretch justify-around px-1">
          {[
            { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, onClick: () => setTab('dashboard') },
            { key: 'rent', label: 'Payments', icon: Wallet, onClick: () => setTab('rent') },
            null,
            { key: 'notices', label: 'Notices', icon: Megaphone, onClick: () => setTab('notices'), badge: unreadNoticeCount },
            { key: 'tenancy', label: 'Profile', icon: UserIcon, onClick: () => setTab('tenancy') },
          ].map((item, i) => item === null ? (
            <div key="spacer" className="flex-1" />
          ) : (
            <button key={item.key} onClick={item.onClick}
              className="relative flex flex-col items-center justify-center gap-1 flex-1 min-h-[52px] py-2.5 min-w-0 overflow-hidden before:absolute before:inset-0 before:rounded-tenant-lg before:bg-tenant-fg/5 before:scale-0 before:opacity-0 active:before:scale-100 active:before:opacity-100 before:transition before:duration-300"
              aria-current={tab === item.key ? 'page' : undefined}>
              <span className={`absolute top-0 left-1/2 -translate-x-1/2 h-[3px] rounded-full bg-tenant-primary transition-all duration-300 ease-out ${tab === item.key ? 'w-6 opacity-100' : 'w-0 opacity-0'}`} aria-hidden="true" />
              <span className={`relative flex items-center justify-center h-8 w-11 rounded-tenant-full transition-all duration-300 ease-out ${tab === item.key ? 'bg-tenant-primary/15 scale-100' : 'scale-90'}`}>
                <item.icon className={`transition-all duration-300 ease-out ${tab === item.key ? 'h-5 w-5 text-tenant-primary' : 'h-[19px] w-[19px] text-tenant-muted'}`} />
                {item.badge ? (
                  <span className="absolute -top-0.5 right-1.5 min-w-[15px] h-[15px] px-0.5 flex items-center justify-center rounded-tenant-full bg-tenant-danger text-white font-bold text-[9px] ring-2 ring-tenant-surface-elevated">
                    {item.badge > 9 ? '9+' : item.badge}
                  </span>
                ) : null}
              </span>
              <span className={`text-[10.5px] font-semibold truncate max-w-full transition-colors duration-300 ${tab === item.key ? 'text-tenant-primary' : 'text-tenant-muted'}`}>
                {item.label}
              </span>
            </button>
          ))}
        </div>
        <button onClick={() => openPay('rent')} aria-label="Pay Now"
          className="absolute -top-6 left-1/2 -translate-x-1/2 w-14 h-14 rounded-tenant-full bg-tenant-primary text-tenant-primary-fg shadow-tenant-glow-lg flex items-center justify-center active:scale-95 transition-transform">
          <LayoutGrid className="w-6 h-6" />
        </button>
      </nav>

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
              className="bg-tenant-surface-elevated rounded-2xl w-full max-w-md shadow-tenant-lg relative animate-in zoom-in-95 fade-in duration-200 max-h-[90vh] flex flex-col">

              <button onClick={dismissNoticeModal} aria-label="Close"
                className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-tenant-bg-subtle hover:bg-tenant-surface-hover text-tenant-muted transition z-10">
                <X className="w-4 h-4" />
              </button>

              <div className={`px-6 pt-6 pb-4 rounded-t-2xl ${isUrgent ? 'bg-tenant-danger-subtle' : 'bg-tenant-primary/10'}`}>
                <div className="flex items-center gap-2 mb-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${isUrgent ? 'bg-tenant-danger/15' : 'bg-tenant-primary/15'}`}>
                    <Megaphone className={`w-5 h-5 ${isUrgent ? 'text-tenant-danger' : 'text-tenant-primary'}`} />
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      notice.priority === 'Urgent' ? 'bg-tenant-danger text-white' : notice.priority === 'Important' ? 'bg-tenant-warning-subtle text-tenant-warning' : 'bg-tenant-bg-subtle text-tenant-muted'
                    }`}>{notice.priority}</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-tenant-primary/15 text-tenant-primary">{notice.category}</span>
                  </div>
                </div>
                <h2 id="notice-modal-title" className="text-lg font-extrabold text-tenant-fg pr-8">{notice.title}</h2>
              </div>

              <div className="px-6 py-4 overflow-y-auto flex-1">
                <p className="text-sm text-tenant-fg/85 whitespace-pre-wrap">{notice.description}</p>

                {notice.attachment_url && (
                  <a href={notice.attachment_url} target="_blank" rel="noreferrer"
                    className="mt-3 flex items-center gap-2 p-3 bg-tenant-bg-subtle rounded-xl text-sm font-semibold text-tenant-primary hover:bg-tenant-surface-hover transition">
                    <Paperclip className="w-4 h-4" /> {notice.attachment_name || 'View attachment'}
                    <Download className="w-3.5 h-3.5 ml-auto" />
                  </a>
                )}

                <div className="grid grid-cols-2 gap-3 mt-4 text-xs">
                  <div>
                    <div className="text-tenant-muted-subtle">Published</div>
                    <div className="font-semibold text-tenant-fg">{formatDate(notice.publish_date)}</div>
                  </div>
                  <div>
                    <div className="text-tenant-muted-subtle">Expires</div>
                    <div className="font-semibold text-tenant-fg">{notice.expiry_date ? formatDate(notice.expiry_date) : 'No expiry'}</div>
                  </div>
                  {notice.created_by && (
                    <div className="col-span-2">
                      <div className="text-tenant-muted-subtle">Published By</div>
                      <div className="font-semibold text-tenant-fg">{notice.created_by}</div>
                    </div>
                  )}
                </div>
              </div>

              <div className="px-6 py-4 border-t border-tenant-border space-y-3 flex-shrink-0">
                {noticeQueue.length > 1 && (
                  <div className="flex items-center justify-between text-xs text-tenant-muted-subtle">
                    <button onClick={() => setNoticeIndex(i => Math.max(0, i - 1))} disabled={noticeIndex === 0}
                      className="flex items-center gap-1 font-semibold disabled:opacity-30 hover:text-tenant-fg transition">
                      <ChevronLeft className="w-3.5 h-3.5" /> Previous
                    </button>
                    <span>{noticeIndex + 1} of {noticeQueue.length}</span>
                    <button onClick={() => setNoticeIndex(i => Math.min(noticeQueue.length - 1, i + 1))} disabled={noticeIndex === noticeQueue.length - 1}
                      className="flex items-center gap-1 font-semibold disabled:opacity-30 hover:text-tenant-fg transition">
                      Next <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
                <div className="flex gap-2">
                  <button onClick={() => { setNoticeModalOpen(false); setTab('notices') }}
                    className="flex-1 py-2.5 border border-tenant-border rounded-xl text-sm font-semibold text-tenant-muted hover:bg-tenant-surface-hover transition">
                    View All Notices
                  </button>
                  <button onClick={closeNoticeModal}
                    className="flex-1 py-2.5 bg-tenant-primary hover:bg-tenant-primary-hover text-tenant-primary-fg rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition">
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
          <div className="bg-tenant-surface-elevated rounded-tenant-2xl w-full max-w-sm shadow-tenant-lg">
            <div className="px-5 py-4 border-b border-tenant-border flex items-center justify-between">
              <h2 className="text-base font-bold">Pay {payKind === 'rent' ? `Rent — ${oldestUnpaidMonth?.label ?? thisMonth}` : 'Security Deposit'}</h2>
              <button onClick={() => setPayModal(false)} className="text-tenant-muted-subtle text-xl font-bold">×</button>
            </div>
            <div className="p-5 space-y-4">
              <div className="bg-tenant-primary/10 rounded-tenant-xl p-3 text-xs text-tenant-primary">
                Amount: <span className="font-bold">{formatINR(payAmount)}</span>{payKind === 'rent' && lateFee > 0 && <span> (includes {formatINR(lateFee)} late fee)</span>}. This notifies your owner that you&apos;ve paid. No real payment is made here — the owner will verify and approve.
              </div>
              {tenant.property?.upi_id && (
                <UpiPayButtons upiId={tenant.property.upi_id} payeeName={tenant.property.name ?? 'PG Owner'} amount={payAmount} note={`${payKind === 'rent' ? 'Rent' : 'Deposit'} - ${tenant.name}`} />
              )}
              <div>
                <label className="text-xs font-semibold text-tenant-muted block mb-2">Payment Method</label>
                <div className="flex gap-2">
                  {['upi', 'cash', 'bank_transfer'].map(m => (
                    <button key={m} onClick={() => setMethod(m)}
                      className={`flex-1 py-2 rounded-tenant-xl text-xs font-semibold border transition ${method === m ? 'border-tenant-primary bg-tenant-primary/10 text-tenant-primary' : 'border-tenant-border text-tenant-muted hover:bg-tenant-surface-hover'}`}>
                      {m.replace('_', ' ').toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-tenant-muted block mb-1">Note (optional)</label>
                <textarea rows={2} value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. Paid via GPay this morning" className="w-full px-3 py-2 border border-tenant-border rounded-tenant-xl text-sm focus:outline-none focus:border-tenant-primary resize-none" />
              </div>
            </div>
            <div className="px-5 py-4 border-t border-tenant-border">
              <button onClick={submitPayment} disabled={saving} className="w-full py-2.5 bg-tenant-primary hover:bg-tenant-primary-hover text-tenant-primary-fg rounded-tenant-xl text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50 transition">
                {saving && <Loader2 className="w-4 h-4 animate-spin" />} Submit for Approval
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Complaint Modal */}
      {complaintModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-tenant-surface-elevated rounded-tenant-2xl w-full max-w-sm shadow-tenant-lg">
            <div className="px-5 py-4 border-b border-tenant-border flex items-center justify-between">
              <h2 className="text-base font-bold">Raise Maintenance Request</h2>
              <button onClick={() => setComplaintModal(false)} className="text-tenant-muted-subtle text-xl font-bold">×</button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-xs font-semibold text-tenant-muted block mb-1">Issue Type</label>
                <select value={complaint.issue_type} onChange={e => setComplaint(c => ({ ...c, issue_type: e.target.value }))} className="w-full px-3 py-2 border border-tenant-border rounded-tenant-xl text-sm focus:outline-none focus:border-tenant-primary">
                  {['Plumbing', 'Electrical', 'WiFi', 'Cleaning', 'AC', 'Maintenance', 'Other'].map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-tenant-muted block mb-1">Priority</label>
                <div className="flex gap-2">
                  {['low', 'medium', 'high'].map(p => (
                    <button key={p} onClick={() => setComplaint(c => ({ ...c, priority: p }))}
                      className={`flex-1 py-2 rounded-tenant-xl text-xs font-semibold border transition capitalize ${complaint.priority === p ? 'border-tenant-primary bg-tenant-primary/10 text-tenant-primary' : 'border-tenant-border text-tenant-muted'}`}>{p}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-tenant-muted block mb-1">Description</label>
                <textarea rows={3} value={complaint.description} onChange={e => setComplaint(c => ({ ...c, description: e.target.value }))} placeholder="Describe the issue…" className="w-full px-3 py-2 border border-tenant-border rounded-tenant-xl text-sm focus:outline-none focus:border-tenant-primary resize-none" />
              </div>
            </div>
            <div className="px-5 py-4 border-t border-tenant-border">
              <button onClick={submitComplaint} disabled={saving} className="w-full py-2.5 bg-tenant-primary hover:bg-tenant-primary-hover text-tenant-primary-fg rounded-tenant-xl text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50 transition">
                {saving && <Loader2 className="w-4 h-4 animate-spin" />} Submit Request
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Leave Request Modal */}
      {leaveModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-tenant-surface-elevated rounded-tenant-2xl w-full max-w-sm shadow-tenant-lg">
            <div className="px-5 py-4 border-b border-tenant-border flex items-center justify-between">
              <h2 className="text-base font-bold">Request Temporary Leave</h2>
              <button onClick={() => setLeaveModal(false)} aria-label="Close" className="text-tenant-muted-subtle text-xl font-bold">×</button>
            </div>
            <div className="p-5 space-y-4">
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-xs font-semibold text-tenant-muted block mb-1">From</label>
                  <input type="date" value={leaveForm.start_date} onChange={e => setLeaveForm(f => ({ ...f, start_date: e.target.value }))} className="w-full px-3 py-2 border border-tenant-border rounded-tenant-xl text-sm focus:outline-none focus:border-tenant-primary" />
                </div>
                <div className="flex-1">
                  <label className="text-xs font-semibold text-tenant-muted block mb-1">To</label>
                  <input type="date" value={leaveForm.end_date} onChange={e => setLeaveForm(f => ({ ...f, end_date: e.target.value }))} className="w-full px-3 py-2 border border-tenant-border rounded-tenant-xl text-sm focus:outline-none focus:border-tenant-primary" />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-tenant-muted block mb-1">Reason (optional)</label>
                <textarea rows={3} value={leaveForm.reason} onChange={e => setLeaveForm(f => ({ ...f, reason: e.target.value }))} placeholder="e.g. Going home for a family function" className="w-full px-3 py-2 border border-tenant-border rounded-tenant-xl text-sm focus:outline-none focus:border-tenant-primary resize-none" />
              </div>
            </div>
            <div className="px-5 py-4 border-t border-tenant-border">
              <button onClick={submitLeaveRequest} disabled={savingLeave} className="w-full py-2.5 bg-tenant-primary hover:bg-tenant-primary-hover text-tenant-primary-fg rounded-tenant-xl text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50 transition">
                {savingLeave && <Loader2 className="w-4 h-4 animate-spin" />} Submit Request
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Profile Update Request Modal (Phase 8.7) */}
      {profileUpdateModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-tenant-surface-elevated rounded-tenant-2xl w-full max-w-sm shadow-tenant-lg max-h-[85vh] flex flex-col">
            <div className="px-5 py-4 border-b border-tenant-border flex items-center justify-between shrink-0">
              <h2 className="text-base font-bold">Request Profile Update</h2>
              <button onClick={() => setProfileUpdateModal(false)} aria-label="Close" className="text-tenant-muted-subtle text-xl font-bold">×</button>
            </div>
            <div className="p-5 space-y-4 overflow-y-auto">
              <p className="text-xs text-tenant-muted">
                Changes here won&apos;t take effect immediately — your owner will review and approve them first.
              </p>
              {[
                ['name', 'Full Name'], ['email', 'Email'], ['aadhaar_number', 'Aadhaar Number'],
                ['permanent_address', 'Permanent Address'], ['emergency_contact_name', 'Emergency Contact Name'],
                ['emergency_contact', 'Emergency Contact Number'],
              ].map(([key, label]) => (
                <div key={key}>
                  <label className="text-xs font-semibold text-tenant-muted block mb-1">{label}</label>
                  {key === 'permanent_address' ? (
                    <textarea rows={2} value={(profileUpdateForm as any)[key]} onChange={e => setProfileUpdateForm(f => ({ ...f, [key]: e.target.value }))}
                      className="w-full px-3 py-2 border border-tenant-border rounded-tenant-xl text-sm focus:outline-none focus:border-tenant-primary resize-none" />
                  ) : (
                    <input value={(profileUpdateForm as any)[key]} onChange={e => setProfileUpdateForm(f => ({ ...f, [key]: e.target.value }))}
                      className="w-full px-3 py-2 border border-tenant-border rounded-tenant-xl text-sm focus:outline-none focus:border-tenant-primary" />
                  )}
                </div>
              ))}
              <div>
                <label className="text-xs font-semibold text-tenant-muted block mb-1">Reason (optional)</label>
                <textarea rows={2} value={profileUpdateForm.reason} onChange={e => setProfileUpdateForm(f => ({ ...f, reason: e.target.value }))}
                  placeholder="e.g. My address changed recently" className="w-full px-3 py-2 border border-tenant-border rounded-tenant-xl text-sm focus:outline-none focus:border-tenant-primary resize-none" />
              </div>
            </div>
            <div className="px-5 py-4 border-t border-tenant-border shrink-0">
              <button onClick={submitProfileUpdateRequest} disabled={savingProfileUpdate} className="w-full py-2.5 bg-tenant-primary hover:bg-tenant-primary-hover text-tenant-primary-fg rounded-tenant-xl text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50 transition">
                {savingProfileUpdate && <Loader2 className="w-4 h-4 animate-spin" />} Submit Request
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rent Extension Request Modal */}
      {extensionModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-tenant-surface-elevated rounded-tenant-2xl w-full max-w-sm shadow-tenant-lg">
            <div className="px-5 py-4 border-b border-tenant-border flex items-center justify-between">
              <h2 className="text-base font-bold">Request Rent Extension</h2>
              <button onClick={() => setExtensionModal(false)} aria-label="Close" className="text-tenant-muted-subtle text-xl font-bold">×</button>
            </div>
            <div className="p-5 space-y-4">
              <div className="bg-tenant-primary/10 rounded-tenant-xl p-3 text-xs text-tenant-primary">
                Asking for more time to pay {oldestUnpaidMonth?.label ?? thisMonth} rent. No late fee will apply until the date below, if approved.
              </div>
              <div>
                <label className="text-xs font-semibold text-tenant-muted block mb-1">Pay By</label>
                <input type="date" value={extensionForm.requested_until} onChange={e => setExtensionForm(f => ({ ...f, requested_until: e.target.value }))} className="w-full px-3 py-2 border border-tenant-border rounded-tenant-xl text-sm focus:outline-none focus:border-tenant-primary" />
              </div>
              <div>
                <label className="text-xs font-semibold text-tenant-muted block mb-1">Reason (optional)</label>
                <textarea rows={3} value={extensionForm.reason} onChange={e => setExtensionForm(f => ({ ...f, reason: e.target.value }))} placeholder="e.g. Salary credits on the 5th" className="w-full px-3 py-2 border border-tenant-border rounded-tenant-xl text-sm focus:outline-none focus:border-tenant-primary resize-none" />
              </div>
            </div>
            <div className="px-5 py-4 border-t border-tenant-border">
              <button onClick={submitExtensionRequest} disabled={savingExtension} className="w-full py-2.5 bg-tenant-primary hover:bg-tenant-primary-hover text-tenant-primary-fg rounded-tenant-xl text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50 transition">
                {savingExtension && <Loader2 className="w-4 h-4 animate-spin" />} Submit Request
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Move-Out Request Modal */}
      {moveOutModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-tenant-surface-elevated rounded-tenant-2xl w-full max-w-sm shadow-tenant-lg">
            <div className="px-5 py-4 border-b border-tenant-border flex items-center justify-between">
              <h2 className="text-base font-bold">Request Move-Out</h2>
              <button onClick={() => setMoveOutModal(false)} aria-label="Close" className="text-tenant-muted-subtle text-xl font-bold">×</button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-xs font-semibold text-tenant-muted block mb-1">Intended Move-Out Date</label>
                <input type="date" min={tenant ? computeEligibleMoveOutDate(tenant.joining_date, new Date().toISOString().slice(0, 10)).toISOString().slice(0, 10) : undefined} value={moveOutForm.requested_date} onChange={e => setMoveOutForm(f => ({ ...f, requested_date: e.target.value }))} className="w-full px-3 py-2 border border-tenant-border rounded-tenant-xl text-sm focus:outline-none focus:border-tenant-primary" />
                {tenant && <p className="text-xs text-tenant-muted-subtle mt-1">Based on your rent cycle and notice period, the earliest eligible date is {formatDate(computeEligibleMoveOutDate(tenant.joining_date, new Date().toISOString().slice(0, 10)))}.</p>}
              </div>
              <div>
                <label className="text-xs font-semibold text-tenant-muted block mb-1">Reason (optional)</label>
                <textarea rows={3} value={moveOutForm.reason} onChange={e => setMoveOutForm(f => ({ ...f, reason: e.target.value }))} placeholder="e.g. Relocating for a new job" className="w-full px-3 py-2 border border-tenant-border rounded-tenant-xl text-sm focus:outline-none focus:border-tenant-primary resize-none" />
              </div>
            </div>
            <div className="px-5 py-4 border-t border-tenant-border">
              <button onClick={submitMoveOutRequest} disabled={savingMoveOut} className="w-full py-2.5 bg-tenant-primary hover:bg-tenant-primary-hover text-tenant-primary-fg rounded-tenant-xl text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50 transition">
                {savingMoveOut && <Loader2 className="w-4 h-4 animate-spin" />} Submit Request
              </button>
            </div>
          </div>
        </div>
      )}


      {/* Change Password Modal */}
      {pwModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-tenant-surface-elevated rounded-tenant-2xl w-full max-w-sm shadow-tenant-lg">
            <div className="px-5 py-4 border-b border-tenant-border flex items-center justify-between">
              <h2 className="text-base font-bold">Change Password</h2>
              <button onClick={() => setPwModal(false)} className="text-tenant-muted-subtle text-xl font-bold">×</button>
            </div>
            <div className="p-5 space-y-4">
              {[['New Password', 'newPw'], ['Confirm Password', 'confirm']].map(([l, k]) => (
                <div key={k}>
                  <label className="text-xs font-semibold text-tenant-muted block mb-1">{l}</label>
                  <input type="password" value={(pwForm as any)[k]} onChange={e => setPwForm(f => ({ ...f, [k]: e.target.value }))} className="w-full px-3 py-2 border border-tenant-border rounded-tenant-xl text-sm focus:outline-none focus:border-tenant-primary" />
                </div>
              ))}
            </div>
            <div className="px-5 py-4 border-t border-tenant-border">
              <button onClick={changePassword} className="w-full py-2.5 bg-tenant-primary hover:bg-tenant-primary-hover text-tenant-primary-fg rounded-tenant-xl text-sm font-semibold transition">Update Password</button>
            </div>
          </div>
        </div>
      )}
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
    <div className="min-h-screen flex items-center justify-center bg-tenant-bg px-6 py-10">
      <div className="text-center max-w-sm w-full">
        <div className="w-14 h-14 rounded-tenant-2xl bg-tenant-primary/10 flex items-center justify-center mx-auto mb-4">
          <Clock className="w-6 h-6 text-tenant-primary" />
        </div>
        <h1 className="text-lg font-extrabold text-tenant-fg mb-1.5">Profile Under Review</h1>
        <p className="text-sm text-tenant-muted mb-6">
          Thanks, {tenant.name}! Your details have been submitted. Your owner will review them and activate your account shortly.
        </p>
        <div className="bg-tenant-surface-elevated rounded-tenant-2xl border border-tenant-border p-5 text-left shadow-tenant-xs">
          <StatusTimeline currentStatus={tenant.onboarding_status} history={history} completionPercent={completion} variant="tenant" />
        </div>
      </div>
    </div>
  )
}
