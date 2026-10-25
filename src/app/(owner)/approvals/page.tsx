'use client'
import { useEffect, useState, useCallback } from 'react'
import Image from 'next/image'
import { useProperty } from '@/components/shared/PropertyContext'
import { getPendingApprovals, approvePayment, rejectPayment, approveTenant, deleteTenant, getRooms, updateTenant, getLeaveRequests, decideLeaveRequest, getRentExtensionRequests, decideRentExtensionRequest, getMoveOutRequests, decideMoveOutRequest, getSubmittedOnboardingProfiles, approveOnboardingProfile, requestOnboardingCorrection, getProfileStatusHistory, getPendingProfileUpdateRequests, decideProfileUpdateRequest } from '@/lib/supabase/queries'
import { createClient } from '@/lib/supabase/client'
import { formatINR, formatDate, whatsappLink, friendlyErrorMessage } from '@/lib/utils'
import { sendPushNotification } from '@/lib/push'
import { toast } from 'sonner'
import { Check, X, QrCode, Copy, Loader2, Link2, ChevronRight } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import type { Room } from '@/types'
import { StatusTimeline, type ProfileStatusHistoryEntry } from '@/components/shared/StatusTimeline'
import { calculateProfileCompletion } from '@/lib/utils/profileStatus'
import { SkeletonList } from '@/components/shared/Skeleton'

export default function ApprovalsPage() {
  const { activeId, active, properties } = useProperty()
  const [tab, setTab] = useState<'payments' | 'tenants' | 'leave' | 'extensions' | 'moveout' | 'reviews' | 'updates'>('payments')
  const [payments, setPayments] = useState<any[]>([])
  const [pendingTenants, setPendingTenants] = useState<any[]>([])
  const [leaveRequests, setLeaveRequests] = useState<any[]>([])
  const [decidingLeaveId, setDecidingLeaveId] = useState<string | null>(null)
  const [rentExtensions, setRentExtensions] = useState<any[]>([])
  const [decidingExtensionId, setDecidingExtensionId] = useState<string | null>(null)
  const [moveOutRequests, setMoveOutRequests] = useState<any[]>([])
  const [decidingMoveOutId, setDecidingMoveOutId] = useState<string | null>(null)
  const [submittedProfiles, setSubmittedProfiles] = useState<any[]>([])
  const [reviewModal, setReviewModal] = useState<any>(null)
  const [reviewHistory, setReviewHistory] = useState<ProfileStatusHistoryEntry[]>([])
  const [reviewForm, setReviewForm] = useState<Record<string, string>>({})
  const [profileUpdateRequests, setProfileUpdateRequests] = useState<any[]>([])
  const [decidingUpdateId, setDecidingUpdateId] = useState<string | null>(null)
  const [updateRejectModal, setUpdateRejectModal] = useState<any>(null)
  const [updateOwnerNote, setUpdateOwnerNote] = useState('')
  const [assignForm, setAssignForm] = useState({ room_id: '', bed_label: '', monthly_rent: '', deposit_amount: '', deposit_paid: '', joining_date: '', notice_period_days: '30' })
  const [reviewRooms, setReviewRooms] = useState<any[]>([])
  const [reviewSaving, setReviewSaving] = useState(false)
  const [correctionNote, setCorrectionNote] = useState('')
  const [showCorrectionInput, setShowCorrectionInput] = useState(false)
  const [loading, setLoading] = useState(true)
  const [qrModal, setQrModal] = useState(false)
  const [approveModal, setApproveModal] = useState<any>(null)
  const [rooms, setRooms] = useState<Room[]>([])
  const [selectedRoomId, setSelectedRoomId] = useState('')
  const [selectedBedLabel, setSelectedBedLabel] = useState('')
  const [approvingId, setApprovingId] = useState<string | null>(null)
  const [appUrl, setAppUrl] = useState('')
  useEffect(() => { setAppUrl(window.location.origin) }, [])
  // Same /app-version.json the tenant-side download gate reads from —
  // included in the WhatsApp welcome text below (see useApkDownloadGate).
  const [apkUrl, setApkUrl] = useState('')
  useEffect(() => {
    fetch('/app-version.json', { cache: 'no-store' })
      .then(res => (res.ok ? res.json() : null))
      .then(json => {
        const url = json?.apkDownloadUrl
        if (typeof url === 'string' && url && !url.includes('REPLACE-WITH')) setApkUrl(url)
      })
      .catch(() => {})
  }, [])

  // List → Detail pattern (premium redesign): tapping a Payment Claim,
  // Leave Request, Rent Extension, or Move-Out row opens this bottom
  // sheet instead of showing Approve/Reject inline on the row. Reviews,
  // New Tenant Requests, and Profile Updates already had their own
  // dedicated detail modals (reviewModal / approveModal /
  // updateRejectModal) — those keep their existing state and handlers
  // exactly as-is, just restyled as bottom sheets below.
  const [detailSheet, setDetailSheet] = useState<{ kind: 'payment' | 'leave' | 'extension' | 'moveout' | 'tenant' | 'update'; item: any } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const sb = createClient()
      const ids = activeId === 'all' ? properties.map(p => p.id) : [activeId]
      const [pList, tList, lList, xList, mList, rList, uList] = await Promise.all([
        Promise.all(ids.map(id => getPendingApprovals(id))).then(r => r.flat()),
        Promise.all(ids.map(id =>
          sb.from('tenants').select('*, property:properties(name)').eq('property_id', id).eq('status', 'pending_approval').then(r => r.data ?? [])
        )).then(r => r.flat()),
        Promise.all(ids.map(id => getLeaveRequests(id))).then(r => r.flat()),
        Promise.all(ids.map(id => getRentExtensionRequests(id))).then(r => r.flat()),
        Promise.all(ids.map(id => getMoveOutRequests(id))).then(r => r.flat()),
        Promise.all(ids.map(id => getSubmittedOnboardingProfiles(id))).then(r => r.flat()),
        Promise.all(ids.map(id => getPendingProfileUpdateRequests(id))).then(r => r.flat()),
      ])
      setPayments(pList)
      setPendingTenants(tList)
      setLeaveRequests(lList)
      setRentExtensions(xList)
      setMoveOutRequests(mList)
      setSubmittedProfiles(rList)
      setProfileUpdateRequests(uList)
    } catch { toast.error('Failed to load') }
    setLoading(false)
  }, [activeId, properties])

  useEffect(() => { load() }, [load])

  async function handleApprovePayment(id: string) {
    // Optimistic: this list is pending-only, so a decided payment should
    // simply disappear immediately — no need to wait for the round-trip
    // (or re-fetch all 7 approval queries via load()) just to see it gone.
    // Snapshot for rollback in case the server call actually fails (e.g.
    // someone else already decided it — a real race, not just slow
    // network), so the item doesn't just vanish for no reason.
    const prev = payments
    setPayments(p => p.filter(x => x.id !== id))
    try { await approvePayment(id); toast.success('Payment approved!') }
    catch (e: any) { setPayments(prev); toast.error(friendlyErrorMessage(e)) }
  }

  async function handleRejectPayment(id: string) {
    const prev = payments
    setPayments(p => p.filter(x => x.id !== id))
    try { await rejectPayment(id); toast.error('Payment rejected') }
    catch (e: any) { setPayments(prev); toast.error(friendlyErrorMessage(e)) }
  }

  async function handleRejectTenant(id: string, name: string) {
    if (!confirm(`Reject ${name}'s request? This cannot be undone.`)) return
    try { await deleteTenant(id); toast.error('Tenant request rejected'); load() }
    catch (e: any) { toast.error(friendlyErrorMessage(e)) }
  }

  async function handleDecideLeave(l: any, status: 'approved' | 'rejected') {
    setDecidingLeaveId(l.id)
    // Optimistic: this list shows both pending and already-decided
    // requests (status badge per row, not a pending-only query), so the
    // right instant update is flipping this row's own status in place —
    // matches exactly what the real row will look like once the request
    // actually resolves.
    setLeaveRequests(rs => rs.map(r => r.id === l.id ? { ...r, status } : r))
    try {
      await decideLeaveRequest(l.id, status)
      toast[status === 'approved' ? 'success' : 'error'](`Leave request ${status}`)
      if (l.tenant?.auth_user_id) {
        sendPushNotification({
          user_ids: [l.tenant.auth_user_id],
          title: status === 'approved' ? '✅ Leave Approved' : '❌ Leave Rejected',
          body: `Your leave request for ${formatDate(l.start_date)} – ${formatDate(l.end_date)} was ${status}.`,
          url: '/portal', tag: 'leave-request',
        })
      }
    } catch (e: any) {
      setLeaveRequests(rs => rs.map(r => r.id === l.id ? { ...r, status: l.status } : r))
      toast.error(friendlyErrorMessage(e))
    }
    setDecidingLeaveId(null)
  }

  async function handleDecideExtension(x: any, status: 'approved' | 'rejected') {
    setDecidingExtensionId(x.id)
    setRentExtensions(rs => rs.map(r => r.id === x.id ? { ...r, status } : r))
    try {
      await decideRentExtensionRequest(x.id, status)
      toast[status === 'approved' ? 'success' : 'error'](`Extension request ${status}`)
      if (x.tenant?.auth_user_id) {
        sendPushNotification({
          user_ids: [x.tenant.auth_user_id],
          title: status === 'approved' ? '✅ Extension Approved' : '❌ Extension Rejected',
          body: `Your extension request for ${x.for_month} rent (until ${formatDate(x.requested_until)}) was ${status}.`,
          url: '/portal', tag: 'rent-extension',
        })
      }
    } catch (e: any) {
      setRentExtensions(rs => rs.map(r => r.id === x.id ? { ...r, status: x.status } : r))
      toast.error(friendlyErrorMessage(e))
    }
    setDecidingExtensionId(null)
  }

  async function handleDecideMoveOut(m: any, status: 'approved' | 'rejected') {
    setDecidingMoveOutId(m.id)
    setMoveOutRequests(rs => rs.map(r => r.id === m.id ? { ...r, status } : r))
    try {
      await decideMoveOutRequest(m.id, status)
      toast[status === 'approved' ? 'success' : 'error'](`Move-out request ${status}`)
      if (m.tenant?.auth_user_id) {
        sendPushNotification({
          user_ids: [m.tenant.auth_user_id],
          title: status === 'approved' ? '✅ Move-Out Approved' : '❌ Move-Out Rejected',
          body: status === 'approved'
            ? `Your move-out on ${formatDate(m.requested_date)} is approved. You're now on notice.`
            : `Your move-out request for ${formatDate(m.requested_date)} was rejected.`,
          url: '/portal', tag: 'move-out-request',
        })
      }
    } catch (e: any) {
      setMoveOutRequests(rs => rs.map(r => r.id === m.id ? { ...r, status: m.status } : r))
      toast.error(friendlyErrorMessage(e))
    }
    setDecidingMoveOutId(null)
  }

  async function openApproveModal(t: any) {
    setApproveModal(t)
    setSelectedRoomId('')
    setSelectedBedLabel('')
    try { setRooms(await getRooms(t.property_id)) } catch { setRooms([]) }
  }

  async function confirmApproveTenant() {
    const t = approveModal
    setApprovingId(t.id)
    const defaultPassword = 'Pass@123'
    try {
      await approveTenant(t.id, defaultPassword, t)
      // Room assignment is a separate update so a failure here doesn't
      // undo the approval itself — the tenant is still active either way.
      if (selectedRoomId) {
        try {
          await updateTenant(t.id, { room_id: selectedRoomId, bed_label: selectedBedLabel || null })
        } catch (roomErr: any) {
          toast.error(`Approved, but couldn't assign the room automatically: ${roomErr.message}. Assign it manually from the Tenants page.`)
        }
      }
      toast.success(`${t.name} approved! Sending login details on WhatsApp…`)
      setApproveModal(null)
      load()
      const loginUrl = `${appUrl}/login`
      const apkLine = apkUrl ? `\n\n📱 Download the Rentivo app:\n${apkUrl}` : ''
      const msg = `Welcome to ${t.property?.name ?? 'the PG'}! 🎉\n\nYour login is ready:\nLogin: ${loginUrl}\nUsername: ${t.phone}\nPassword: ${defaultPassword}${apkLine}\n\nPlease change your password after your first login.`
      window.open(whatsappLink(t.phone, msg), '_blank')
    } catch (e: any) { toast.error(friendlyErrorMessage(e)) }
    setApprovingId(null)
  }

  const joinLink = active ? `${appUrl}/join/${active.qr_slug}` : ''

  async function openReviewModal(t: any) {
    setReviewModal(t)
    const draft = t.pending_profile ?? {}
    setReviewForm({
      name: draft.name ?? t.name ?? '',
      email: draft.email ?? t.email ?? '',
      aadhaar_number: draft.aadhaar_number ?? t.aadhaar_number ?? '',
      permanent_address: draft.permanent_address ?? t.permanent_address ?? '',
      emergency_contact_name: draft.emergency_contact_name ?? t.emergency_contact_name ?? '',
      emergency_contact: draft.emergency_contact ?? t.emergency_contact ?? '',
      photo_url: draft.photo_url ?? t.photo_url ?? '',
      aadhaar_front_url: draft.aadhaar_front_url ?? t.aadhaar_front_url ?? '',
      aadhaar_back_url: draft.aadhaar_back_url ?? t.aadhaar_back_url ?? '',
      pan_url: draft.pan_url ?? t.pan_url ?? '',
    })
    setAssignForm({ room_id: '', bed_label: '', monthly_rent: '', deposit_amount: '', deposit_paid: '', joining_date: new Date().toISOString().slice(0, 10), notice_period_days: '30' })
    setShowCorrectionInput(false)
    setCorrectionNote('')
    try { setReviewRooms(await getRooms(t.property_id)) } catch { setReviewRooms([]) }
    try { setReviewHistory(await getProfileStatusHistory(t.id)) } catch { setReviewHistory([]) }
  }

  async function handleApproveReview() {
    if (!reviewModal) return
    if (!assignForm.room_id) { toast.error('Assign a room before approving'); return }
    if (!assignForm.monthly_rent || Number(assignForm.monthly_rent) <= 0) { toast.error('Enter the monthly rent'); return }
    setReviewSaving(true)
    try {
      await approveOnboardingProfile(reviewModal.id, reviewForm, {
        room_id: assignForm.room_id,
        bed_label: assignForm.bed_label,
        monthly_rent: Number(assignForm.monthly_rent),
        deposit_amount: Number(assignForm.deposit_amount || 0),
        deposit_paid: Number(assignForm.deposit_paid || 0),
        joining_date: assignForm.joining_date,
        notice_period_days: Number(assignForm.notice_period_days || 30),
      })
      // Phase 8.6 — onboarding notification, reusing the same
      // sendPushNotification() pattern this page already uses for leave/
      // extension decisions above.
      if (reviewModal.auth_user_id) {
        sendPushNotification({
          user_ids: [reviewModal.auth_user_id],
          title: '🎉 Profile Approved',
          body: `Your profile was approved! Your account is now fully active.`,
          url: '/portal', tag: 'onboarding-approved',
        })
      }
      toast.success(`${reviewModal.name} approved and activated!`)
      setReviewModal(null)
      load()
    } catch (e: any) { toast.error(friendlyErrorMessage(e)) }
    setReviewSaving(false)
  }

  async function handleRejectReview() {
    if (!reviewModal) return
    if (!confirm(`Reject ${reviewModal.name}'s profile? This removes their invitation and login — this cannot be undone.`)) return
    setReviewSaving(true)
    try {
      await deleteTenant(reviewModal.id)
      toast.error('Profile rejected')
      setReviewModal(null)
      load()
    } catch (e: any) { toast.error(friendlyErrorMessage(e)) }
    setReviewSaving(false)
  }

  async function handleSendBackForCorrection() {
    if (!reviewModal) return
    if (!correctionNote.trim()) { toast.error('Add a note explaining what needs fixing'); return }
    setReviewSaving(true)
    try {
      await requestOnboardingCorrection(reviewModal.id, correctionNote.trim())
      // Phase 8.6 — onboarding notification.
      if (reviewModal.auth_user_id) {
        sendPushNotification({
          user_ids: [reviewModal.auth_user_id],
          title: '✏️ Correction Requested',
          body: `Your owner asked for a correction: ${correctionNote.trim().slice(0, 100)}`,
          url: '/portal', tag: 'onboarding-correction-requested',
        })
      }
      toast.success('Sent back to tenant for correction')
      setReviewModal(null)
      load()
    } catch (e: any) { toast.error(friendlyErrorMessage(e)) }
    setReviewSaving(false)
  }

  async function handleApproveUpdate(req: any) {
    setDecidingUpdateId(req.id)
    try {
      await decideProfileUpdateRequest(req.id, 'approved')
      toast.success(`Profile update approved for ${req.tenant?.name ?? 'tenant'}`)
      if (req.tenant?.auth_user_id) {
        sendPushNotification({
          user_ids: [req.tenant.auth_user_id],
          title: '✅ Profile Update Approved',
          body: 'Your requested profile changes are now live.',
          url: '/portal', tag: 'profile-update-approved',
        })
      }
      setProfileUpdateRequests(prev => prev.filter(r => r.id !== req.id))
    } catch (e: any) { toast.error(friendlyErrorMessage(e)) }
    setDecidingUpdateId(null)
  }

  async function handleRejectUpdate() {
    if (!updateRejectModal) return
    setDecidingUpdateId(updateRejectModal.id)
    try {
      await decideProfileUpdateRequest(updateRejectModal.id, 'rejected', updateOwnerNote)
      toast.success('Profile update request rejected')
      if (updateRejectModal.tenant?.auth_user_id) {
        sendPushNotification({
          user_ids: [updateRejectModal.tenant.auth_user_id],
          title: '❌ Profile Update Rejected',
          body: updateOwnerNote.trim() ? `Your owner declined this update: ${updateOwnerNote.trim().slice(0, 100)}` : 'Your owner declined this profile update request.',
          url: '/portal', tag: 'profile-update-rejected',
        })
      }
      setProfileUpdateRequests(prev => prev.filter(r => r.id !== updateRejectModal.id))
      setUpdateRejectModal(null)
      setUpdateOwnerNote('')
    } catch (e: any) { toast.error(friendlyErrorMessage(e)) }
    setDecidingUpdateId(null)
  }

  return (
    <div className="space-y-5 pb-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-extrabold text-owner-fg tracking-tight">Approvals</h1>
          <p className="text-sm text-owner-muted mt-0.5">Review payment claims and new tenant requests</p>
        </div>
        <button onClick={() => { if (!active) { toast.error('Select a specific property first (not "All Properties")'); return } setQrModal(true) }}
          className="flex items-center gap-2 px-4 h-11 bg-purple-600 hover:bg-purple-700 active:bg-purple-800 active:scale-[0.98] text-white rounded-2xl text-sm font-semibold transition">
          <QrCode className="w-4 h-4" /> Tenant Join Link / QR
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1.5 flex-wrap">
        {[['payments', 'Payments'], ['tenants', 'New Tenants'], ['reviews', 'Reviews'], ['updates', 'Updates'], ['leave', 'Leave'], ['extensions', 'Extensions'], ['moveout', 'Move-Out']].map(([v, label]) => (
          <button key={v} onClick={() => setTab(v as any)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-owner-full text-xs font-semibold transition-all active:scale-[0.97] ${tab === v ? 'bg-owner-primary text-owner-primary-fg' : 'bg-owner-surface-hover text-owner-muted hover:text-owner-fg'}`}>
            {label}
            {v === 'payments' && payments.length > 0 && <span className="bg-yellow-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold">{payments.length}</span>}
            {v === 'tenants' && pendingTenants.length > 0 && <span className="bg-purple-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold">{pendingTenants.length}</span>}
            {v === 'reviews' && submittedProfiles.length > 0 && <span className="bg-teal-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold">{submittedProfiles.length}</span>}
            {v === 'updates' && profileUpdateRequests.length > 0 && <span className="bg-pink-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold">{profileUpdateRequests.length}</span>}
            {v === 'leave' && leaveRequests.filter(l => l.status === 'pending').length > 0 && <span className="bg-indigo-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold">{leaveRequests.filter(l => l.status === 'pending').length}</span>}
            {v === 'extensions' && rentExtensions.filter(x => x.status === 'pending').length > 0 && <span className="bg-blue-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold">{rentExtensions.filter(x => x.status === 'pending').length}</span>}
            {v === 'moveout' && moveOutRequests.filter(m => m.status === 'pending').length > 0 && <span className="bg-orange-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold">{moveOutRequests.filter(m => m.status === 'pending').length}</span>}
          </button>
        ))}
      </div>

      {loading ? (
        <SkeletonList rows={5} />
      ) : tab === 'payments' ? (
        payments.length === 0 ? (
          <div className="bg-owner-surface rounded-2xl border border-owner-border p-12 text-center text-owner-muted-subtle">
            <Check className="w-10 h-10 mx-auto mb-3 text-green-400" />
            <div className="font-semibold">No pending payment claims</div>
          </div>
        ) : (
          <div className="space-y-2.5">
            {payments.map(p => (
              <button key={p.id} onClick={() => setDetailSheet({ kind: 'payment', item: p })}
                className="w-full bg-owner-surface rounded-2xl border border-owner-border p-4 shadow-sm flex items-center gap-3 text-left transition active:scale-[0.99] active:bg-owner-surface-hover">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-600 to-purple-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
                  {(p.tenant?.name || '?').split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-owner-fg truncate">{p.tenant?.name} <span className="text-owner-muted-subtle font-normal text-xs">· Room {p.tenant?.room?.room_number}</span></div>
                  <div className="text-xs text-owner-muted mt-0.5">{p.for_month} · <span className="capitalize">{p.method?.replace('_', ' ')}</span></div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <div className="text-base font-extrabold text-owner-fg">{formatINR(p.amount_received)}</div>
                  <ChevronRight className="w-4 h-4 text-owner-muted-subtle" />
                </div>
              </button>
            ))}
          </div>
        )
      ) : tab === 'tenants' ? (
        pendingTenants.length === 0 ? (
          <div className="bg-owner-surface rounded-2xl border border-owner-border p-12 text-center text-owner-muted-subtle">
            <Check className="w-10 h-10 mx-auto mb-3 text-green-400" />
            <div className="font-semibold">No pending tenant requests</div>
            <p className="text-xs mt-2">Share the join link/QR with new tenants to get started</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {pendingTenants.map(t => (
              <button key={t.id} onClick={() => setDetailSheet({ kind: 'tenant', item: t })}
                className="w-full bg-owner-surface rounded-2xl border border-owner-border p-4 shadow-sm flex items-center gap-3 text-left transition active:scale-[0.99] active:bg-owner-surface-hover">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-purple-600 to-blue-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
                  {(t.name || '?').split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-owner-fg truncate">{t.name}</div>
                  <div className="text-xs text-owner-muted mt-0.5 truncate"><span className="font-semibold text-purple-600">{t.property?.name}</span> · Joining {t.joining_date}</div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <div className="text-base font-extrabold text-owner-fg">{formatINR(t.monthly_rent)}</div>
                  <ChevronRight className="w-4 h-4 text-owner-muted-subtle" />
                </div>
              </button>
            ))}
          </div>
        )
      ) : tab === 'reviews' ? (
        submittedProfiles.length === 0 ? (
          <div className="bg-owner-surface rounded-2xl border border-owner-border p-12 text-center text-owner-muted-subtle">
            <Check className="w-10 h-10 mx-auto mb-3 text-green-400" />
            <div className="font-semibold">No profiles waiting for review</div>
          </div>
        ) : (
          <div className="space-y-2.5">
            {submittedProfiles.map(t => (
              <button key={t.id} onClick={() => openReviewModal(t)}
                className="w-full bg-owner-surface rounded-2xl border border-owner-border p-4 shadow-sm flex items-center gap-3 text-left transition active:scale-[0.99] active:bg-owner-surface-hover">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-teal-500 to-blue-500 text-white font-bold text-xs flex items-center justify-center shrink-0">
                  {((t.pending_profile?.name ?? t.name) || '?').split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-owner-fg truncate">{t.pending_profile?.name ?? t.name}</div>
                  <div className="text-xs text-owner-muted mt-0.5 flex items-center gap-1.5">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${t.onboarding_status === 'resubmitted' ? 'bg-blue-100 text-blue-700' : 'bg-teal-100 text-teal-700'}`}>
                      {t.onboarding_status === 'resubmitted' ? 'Resubmitted' : 'Submitted'}
                    </span>
                    <span className="text-owner-muted-subtle font-semibold">{calculateProfileCompletion(t)}% complete</span>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-owner-muted-subtle shrink-0" />
              </button>
            ))}
          </div>
        )
      ) : tab === 'updates' ? (
        profileUpdateRequests.length === 0 ? (
          <div className="bg-owner-surface rounded-2xl border border-owner-border p-12 text-center text-owner-muted-subtle">
            <Check className="w-10 h-10 mx-auto mb-3 text-green-400" />
            <div className="font-semibold">No profile update requests pending</div>
          </div>
        ) : (
          <div className="space-y-2.5">
            {profileUpdateRequests.map(req => {
              const changedCount = Object.keys(req.requested_changes ?? {}).length
              return (
                <button key={req.id} onClick={() => setDetailSheet({ kind: 'update', item: req })}
                  className="w-full bg-owner-surface rounded-2xl border border-owner-border p-4 shadow-sm flex items-center gap-3 text-left transition active:scale-[0.99] active:bg-owner-surface-hover">
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-teal-500 to-blue-500 text-white font-bold text-xs flex items-center justify-center shrink-0">
                    {(req.tenant?.name || '?').split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-owner-fg truncate">{req.tenant?.name ?? 'Tenant'}</div>
                    <div className="text-xs text-owner-muted mt-0.5">Room {req.tenant?.room?.room_number ?? '—'} · {changedCount} field{changedCount === 1 ? '' : 's'} changed</div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-owner-muted-subtle shrink-0" />
                </button>
              )
            })}
          </div>
        )
      ) : tab === 'leave' ? (
        leaveRequests.length === 0 ? (
          <div className="bg-owner-surface rounded-2xl border border-owner-border p-12 text-center text-owner-muted-subtle">
            <Check className="w-10 h-10 mx-auto mb-3 text-green-400" />
            <div className="font-semibold">No leave requests</div>
          </div>
        ) : (
          <div className="space-y-2.5">
            {leaveRequests.map(l => (
              <button key={l.id} onClick={() => l.status === 'pending' && setDetailSheet({ kind: 'leave', item: l })}
                className={`w-full bg-owner-surface rounded-2xl border border-owner-border p-4 shadow-sm flex items-center gap-3 text-left transition ${l.status === 'pending' ? 'active:scale-[0.99] active:bg-owner-surface-hover' : ''}`}>
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-600 to-blue-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
                  {(l.tenant?.name || '?').split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-owner-fg truncate">{l.tenant?.name} <span className="text-owner-muted-subtle font-normal text-xs">· Room {l.tenant?.room?.room_number ?? '—'}</span></div>
                  <div className="text-xs text-owner-muted mt-0.5">{formatDate(l.start_date)} – {formatDate(l.end_date)}</div>
                </div>
                {l.status === 'pending' ? (
                  <ChevronRight className="w-4 h-4 text-owner-muted-subtle shrink-0" />
                ) : (
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full capitalize shrink-0 ${l.status === 'approved' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{l.status}</span>
                )}
              </button>
            ))}
          </div>
        )
      ) : tab === 'extensions' ? (
        rentExtensions.length === 0 ? (
          <div className="bg-owner-surface rounded-2xl border border-owner-border p-12 text-center text-owner-muted-subtle">
            <Check className="w-10 h-10 mx-auto mb-3 text-green-400" />
            <div className="font-semibold">No rent extension requests</div>
          </div>
        ) : (
          <div className="space-y-2.5">
            {rentExtensions.map(x => (
              <button key={x.id} onClick={() => x.status === 'pending' && setDetailSheet({ kind: 'extension', item: x })}
                className={`w-full bg-owner-surface rounded-2xl border border-owner-border p-4 shadow-sm flex items-center gap-3 text-left transition ${x.status === 'pending' ? 'active:scale-[0.99] active:bg-owner-surface-hover' : ''}`}>
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
                  {(x.tenant?.name || '?').split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-owner-fg truncate">{x.tenant?.name} <span className="text-owner-muted-subtle font-normal text-xs">· Room {x.tenant?.room?.room_number ?? '—'}</span></div>
                  <div className="text-xs text-owner-muted mt-0.5">{x.for_month} rent → pay by {formatDate(x.requested_until)}</div>
                </div>
                {x.status === 'pending' ? (
                  <ChevronRight className="w-4 h-4 text-owner-muted-subtle shrink-0" />
                ) : (
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full capitalize shrink-0 ${x.status === 'approved' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{x.status}</span>
                )}
              </button>
            ))}
          </div>
        )
      ) : (
        moveOutRequests.length === 0 ? (
          <div className="bg-owner-surface rounded-2xl border border-owner-border p-12 text-center text-owner-muted-subtle">
            <Check className="w-10 h-10 mx-auto mb-3 text-green-400" />
            <div className="font-semibold">No move-out requests</div>
          </div>
        ) : (
          <div className="space-y-2.5">
            {moveOutRequests.map(m => (
              <button key={m.id} onClick={() => m.status === 'pending' && setDetailSheet({ kind: 'moveout', item: m })}
                className={`w-full bg-owner-surface rounded-2xl border border-owner-border p-4 shadow-sm flex items-center gap-3 text-left transition ${m.status === 'pending' ? 'active:scale-[0.99] active:bg-owner-surface-hover' : ''}`}>
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-orange-500 to-red-500 text-white font-bold text-xs flex items-center justify-center shrink-0">
                  {(m.tenant?.name || '?').split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-owner-fg truncate">{m.tenant?.name} <span className="text-owner-muted-subtle font-normal text-xs">· Room {m.tenant?.room?.room_number ?? '—'}</span></div>
                  <div className="text-xs text-owner-muted mt-0.5">Move out on {formatDate(m.requested_date)}</div>
                </div>
                {m.status === 'pending' ? (
                  <ChevronRight className="w-4 h-4 text-owner-muted-subtle shrink-0" />
                ) : (
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full capitalize shrink-0 ${m.status === 'approved' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{m.status}</span>
                )}
              </button>
            ))}
          </div>
        )
      )}

      {/* Detail sheet (List → Detail → Actions-at-bottom pattern) for
          Payment Claims, Leave, Rent Extension, and Move-Out requests.
          Reuses the exact same handlers the old inline row buttons
          called — this is a presentation change only. */}
      {detailSheet && (() => {
        const { kind, item: it } = detailSheet
        const meta: Record<string, { title: string; gradient: string; deciding: string | null; onApprove: () => void; onReject: () => void }> = {
          payment: {
            title: 'Payment Claim', gradient: 'from-blue-600 to-purple-600', deciding: null,
            onApprove: async () => { await handleApprovePayment(it.id); setDetailSheet(null) },
            onReject: async () => { await handleRejectPayment(it.id); setDetailSheet(null) },
          },
          leave: {
            title: 'Leave Request', gradient: 'from-indigo-600 to-blue-600', deciding: decidingLeaveId,
            onApprove: async () => { await handleDecideLeave(it, 'approved'); setDetailSheet(null) },
            onReject: async () => { await handleDecideLeave(it, 'rejected'); setDetailSheet(null) },
          },
          extension: {
            title: 'Rent Extension Request', gradient: 'from-blue-600 to-indigo-600', deciding: decidingExtensionId,
            onApprove: async () => { await handleDecideExtension(it, 'approved'); setDetailSheet(null) },
            onReject: async () => { await handleDecideExtension(it, 'rejected'); setDetailSheet(null) },
          },
          moveout: {
            title: 'Move-Out Request', gradient: 'from-orange-500 to-red-500', deciding: decidingMoveOutId,
            onApprove: async () => { await handleDecideMoveOut(it, 'approved'); setDetailSheet(null) },
            onReject: async () => { await handleDecideMoveOut(it, 'rejected'); setDetailSheet(null) },
          },
          tenant: {
            title: 'New Tenant Request', gradient: 'from-purple-600 to-blue-600', deciding: null,
            // Approving a new tenant needs room/bed assignment first — that
            // existing flow (openApproveModal + its own confirm step) is
            // unchanged; the detail sheet just hands off to it instead of
            // approving immediately like the other 4 kinds.
            onApprove: () => { setDetailSheet(null); openApproveModal(it) },
            onReject: async () => { await handleRejectTenant(it.id, it.name); setDetailSheet(null) },
          },
          update: {
            title: 'Profile Update Request', gradient: 'from-teal-500 to-blue-500', deciding: decidingUpdateId,
            onApprove: async () => { await handleApproveUpdate(it); setDetailSheet(null) },
            // Rejecting an update needs an owner note first — hands off to
            // the existing updateRejectModal flow unchanged.
            onReject: () => { setDetailSheet(null); setUpdateRejectModal(it); setUpdateOwnerNote('') },
          },
        }
        const m = meta[kind]
        const isDeciding = m.deciding === it.id
        return (
          <>
            <div onClick={() => setDetailSheet(null)} className="fixed inset-0 bg-black/40 z-50 transition-opacity" />
            <div className="fixed inset-x-0 bottom-0 z-50 bg-owner-surface-elevated rounded-t-3xl shadow-owner-lg max-h-[85vh] flex flex-col animate-owner-scale-in">
              <div className="flex justify-center pt-2.5 pb-1 shrink-0">
                <div className="h-1 w-9 rounded-full bg-owner-border-strong" />
              </div>
              <div className="px-5 pb-4 pt-1 flex items-center gap-3 border-b border-owner-border shrink-0">
                <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${m.gradient} text-white font-bold text-xs flex items-center justify-center shrink-0`}>
                  {((kind === 'tenant' ? it.name : it.tenant?.name) || '?').split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                </div>
                <div className="min-w-0">
                  <div className="text-[11px] font-bold text-owner-muted-subtle uppercase tracking-wide">{m.title}</div>
                  <div className="font-bold text-owner-fg truncate">
                    {kind === 'tenant' ? it.name : it.tenant?.name}
                    <span className="text-owner-muted-subtle font-normal text-xs"> · {kind === 'tenant' ? (it.property?.name ?? 'Room unassigned') : `Room ${it.tenant?.room?.room_number ?? '—'}`}</span>
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
                {kind === 'payment' && (
                  <>
                    <div className="bg-owner-surface-hover rounded-2xl p-4 text-center">
                      <div className="text-xs text-owner-muted-subtle font-semibold uppercase tracking-wide">Amount</div>
                      <div className="text-3xl font-extrabold text-owner-fg mt-1">{formatINR(it.amount_received)}</div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-owner-surface-hover rounded-xl p-3">
                        <div className="text-[10px] text-owner-muted-subtle uppercase font-bold">For Month</div>
                        <div className="text-sm font-bold text-owner-fg mt-0.5">{it.for_month}</div>
                      </div>
                      <div className="bg-owner-surface-hover rounded-xl p-3">
                        <div className="text-[10px] text-owner-muted-subtle uppercase font-bold">Method</div>
                        <div className="text-sm font-bold text-owner-fg mt-0.5 capitalize">{it.method?.replace('_', ' ')}</div>
                      </div>
                    </div>
                    {it.tenant_note && (
                      <div>
                        <div className="text-xs font-bold text-owner-muted-subtle uppercase tracking-wide mb-1.5">Note from Tenant</div>
                        <div className="text-sm text-owner-muted italic bg-owner-surface-hover rounded-xl px-3 py-2.5">&quot;{it.tenant_note}&quot;</div>
                      </div>
                    )}
                    <div className="text-xs text-owner-muted-subtle">Submitted {new Date(it.created_at).toLocaleString('en-IN')}</div>
                  </>
                )}
                {kind === 'leave' && (
                  <>
                    <div className="bg-owner-surface-hover rounded-2xl p-4">
                      <div className="text-xs text-owner-muted-subtle font-semibold uppercase tracking-wide">Leave Period</div>
                      <div className="text-lg font-extrabold text-owner-fg mt-1">{formatDate(it.start_date)} – {formatDate(it.end_date)}</div>
                    </div>
                    {it.reason && (
                      <div>
                        <div className="text-xs font-bold text-owner-muted-subtle uppercase tracking-wide mb-1.5">Reason</div>
                        <div className="text-sm text-owner-muted italic bg-owner-surface-hover rounded-xl px-3 py-2.5">&quot;{it.reason}&quot;</div>
                      </div>
                    )}
                    <div className="text-xs text-owner-muted-subtle">Requested {formatDate(it.created_at)}</div>
                  </>
                )}
                {kind === 'extension' && (
                  <>
                    <div className="bg-owner-surface-hover rounded-2xl p-4">
                      <div className="text-xs text-owner-muted-subtle font-semibold uppercase tracking-wide">Extension Requested</div>
                      <div className="text-lg font-extrabold text-owner-fg mt-1">{it.for_month} rent → pay by {formatDate(it.requested_until)}</div>
                    </div>
                    {it.reason && (
                      <div>
                        <div className="text-xs font-bold text-owner-muted-subtle uppercase tracking-wide mb-1.5">Reason</div>
                        <div className="text-sm text-owner-muted italic bg-owner-surface-hover rounded-xl px-3 py-2.5">&quot;{it.reason}&quot;</div>
                      </div>
                    )}
                    <div className="text-xs text-owner-muted-subtle">Requested {formatDate(it.created_at)}</div>
                  </>
                )}
                {kind === 'moveout' && (
                  <>
                    <div className="bg-owner-surface-hover rounded-2xl p-4">
                      <div className="text-xs text-owner-muted-subtle font-semibold uppercase tracking-wide">Move-Out Date</div>
                      <div className="text-lg font-extrabold text-owner-fg mt-1">{formatDate(it.requested_date)}</div>
                    </div>
                    {it.reason && (
                      <div>
                        <div className="text-xs font-bold text-owner-muted-subtle uppercase tracking-wide mb-1.5">Reason</div>
                        <div className="text-sm text-owner-muted italic bg-owner-surface-hover rounded-xl px-3 py-2.5">&quot;{it.reason}&quot;</div>
                      </div>
                    )}
                    <div className="text-xs text-owner-muted-subtle">Requested {formatDate(it.created_at)}</div>
                  </>
                )}
                {kind === 'tenant' && (
                  <>
                    <div className="bg-owner-surface-hover rounded-2xl p-4 text-center">
                      <div className="text-xs text-owner-muted-subtle font-semibold uppercase tracking-wide">Monthly Rent</div>
                      <div className="text-3xl font-extrabold text-owner-fg mt-1">{formatINR(it.monthly_rent)}</div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-owner-surface-hover rounded-xl p-3">
                        <div className="text-[10px] text-owner-muted-subtle uppercase font-bold">Phone</div>
                        <div className="text-sm font-bold text-owner-fg mt-0.5">{it.phone}</div>
                      </div>
                      <div className="bg-owner-surface-hover rounded-xl p-3">
                        <div className="text-[10px] text-owner-muted-subtle uppercase font-bold">Joining Date</div>
                        <div className="text-sm font-bold text-owner-fg mt-0.5">{it.joining_date}</div>
                      </div>
                      <div className="bg-owner-surface-hover rounded-xl p-3">
                        <div className="text-[10px] text-owner-muted-subtle uppercase font-bold">Deposit Paid</div>
                        <div className="text-sm font-bold text-owner-fg mt-0.5">{formatINR(it.deposit_paid)} <span className="text-owner-muted-subtle font-normal">/ {formatINR(it.deposit_amount)}</span></div>
                        {it.deposit_paid < it.deposit_amount && (
                          <div className="text-xs text-yellow-600 font-semibold mt-0.5">₹{(it.deposit_amount - it.deposit_paid).toLocaleString('en-IN')} pending</div>
                        )}
                      </div>
                      {it.rent_paid_at_joining > 0 ? (
                        <div className="bg-owner-surface-hover rounded-xl p-3">
                          <div className="text-[10px] text-owner-muted-subtle uppercase font-bold">Rent Paid at Joining</div>
                          <div className="text-sm font-bold text-green-700 mt-0.5">{formatINR(it.rent_paid_at_joining)}</div>
                        </div>
                      ) : (
                        <div className="bg-owner-surface-hover rounded-xl p-3">
                          <div className="text-[10px] text-owner-muted-subtle uppercase font-bold">Rent Pending</div>
                          <div className="text-sm font-bold text-yellow-600 mt-0.5">{formatINR(it.monthly_rent - (it.rent_paid_at_joining || 0))}</div>
                        </div>
                      )}
                    </div>
                    <div className="text-xs text-owner-muted-subtle bg-blue-50 text-blue-700 rounded-xl px-3 py-2.5">Approving will ask you to assign a room and bed before finalizing.</div>
                  </>
                )}
                {kind === 'update' && (() => {
                  const fieldLabels: Record<string, string> = {
                    name: 'Full Name', email: 'Email', aadhaar_number: 'Aadhaar Number',
                    permanent_address: 'Permanent Address', emergency_contact_name: 'Emergency Contact Name', emergency_contact: 'Emergency Contact Number',
                  }
                  return (
                    <>
                      {it.reason && (
                        <div>
                          <div className="text-xs font-bold text-owner-muted-subtle uppercase tracking-wide mb-1.5">Reason</div>
                          <div className="text-sm text-owner-muted italic bg-owner-surface-hover rounded-xl px-3 py-2.5">&quot;{it.reason}&quot;</div>
                        </div>
                      )}
                      <div>
                        <div className="text-xs font-bold text-owner-muted-subtle uppercase tracking-wide mb-1.5">Requested Changes</div>
                        <div className="border border-owner-border rounded-xl overflow-hidden">
                          <div className="grid grid-cols-3 bg-owner-surface-hover text-[11px] font-bold text-owner-muted-subtle uppercase tracking-wide px-3 py-2">
                            <span>Field</span><span>Current</span><span>Requested</span>
                          </div>
                          {Object.entries(it.requested_changes ?? {}).map(([key, newVal]) => (
                            <div key={key} className="grid grid-cols-3 text-xs px-3 py-2 border-t border-owner-border">
                              <span className="text-owner-muted font-semibold">{fieldLabels[key] ?? key}</span>
                              <span className="text-owner-muted-subtle">{(it.tenant as any)?.[key] || '—'}</span>
                              <span className="text-owner-fg font-semibold">{String(newVal) || '—'}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="text-xs text-owner-muted-subtle">Requested {formatDate(it.created_at)}</div>
                    </>
                  )
                })()}
              </div>

              <div className="px-5 py-4 border-t border-owner-border flex gap-2.5 shrink-0" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
                <button onClick={m.onReject} disabled={isDeciding}
                  className="flex-1 h-12 flex items-center justify-center gap-1.5 bg-red-50 hover:bg-red-100 active:bg-red-200 active:scale-[0.98] text-red-700 rounded-2xl text-sm font-bold transition disabled:opacity-50">
                  <X className="w-4 h-4" /> Reject
                </button>
                <button onClick={m.onApprove} disabled={isDeciding}
                  className="flex-1 h-12 flex items-center justify-center gap-1.5 bg-green-600 hover:bg-green-700 active:bg-green-800 active:scale-[0.98] text-white rounded-2xl text-sm font-bold transition disabled:opacity-50">
                  {isDeciding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Approve
                </button>
              </div>
            </div>
          </>
        )
      })()}

      {/* Profile Review Modal (Phase 8.4) */}
      {reviewModal && (
        <>
          <div onClick={() => setReviewModal(null)} className="fixed inset-0 bg-black/40 z-50 transition-opacity" />
          <div className="fixed inset-x-0 bottom-0 z-50 bg-owner-surface-elevated rounded-t-3xl shadow-owner-lg max-h-[85vh] flex flex-col animate-owner-scale-in">
            <div className="flex justify-center pt-2.5 pb-1 shrink-0">
              <div className="h-1 w-9 rounded-full bg-owner-border-strong" />
            </div>
            <div className="px-5 pb-4 pt-1 flex items-center gap-3 border-b border-owner-border shrink-0">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-teal-500 to-blue-500 text-white font-bold text-xs flex items-center justify-center shrink-0">
                {((reviewModal.pending_profile?.name ?? reviewModal.name) || '?').split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[11px] font-bold text-owner-muted-subtle uppercase tracking-wide">Profile Review</div>
                <div className="font-bold text-owner-fg truncate">{reviewModal.pending_profile?.name ?? reviewModal.name} <span className="text-owner-muted-subtle font-normal text-xs">· {reviewModal.phone}</span></div>
              </div>
              <button onClick={() => setReviewModal(null)} aria-label="Close" className="text-owner-muted-subtle text-xl font-bold shrink-0 w-8 h-8 flex items-center justify-center rounded-full hover:bg-owner-surface-hover transition">×</button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {/* Profile Status System (Phase 8.5) — full history + completion */}
              <div className="bg-owner-surface-hover rounded-2xl p-4">
                <StatusTimeline
                  currentStatus={reviewModal.onboarding_status}
                  history={reviewHistory}
                  completionPercent={calculateProfileCompletion(reviewModal)}
                  variant="owner"
                />
              </div>

              {/* Previous / New / Source comparison */}
              <div>
                <div className="text-xs font-bold text-owner-muted-subtle uppercase tracking-wide mb-2">Submitted Details</div>
                <div className="border border-owner-border rounded-xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm min-w-[480px]">
                      <thead>
                        <tr className="bg-owner-surface-hover text-left text-xs text-owner-muted">
                          <th className="px-3 py-2 font-semibold">Field</th>
                          <th className="px-3 py-2 font-semibold">Previous (Owner)</th>
                          <th className="px-3 py-2 font-semibold">Submitted (Tenant) — editable</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          ['name', 'Full Name'], ['email', 'Email'], ['aadhaar_number', 'Aadhaar Number'],
                          ['permanent_address', 'Permanent Address'], ['emergency_contact_name', 'Emergency Contact Name'],
                          ['emergency_contact', 'Emergency Contact Number'],
                        ].map(([key, label]) => (
                          <tr key={key} className="border-t border-owner-border">
                            <td className="px-3 py-2 font-semibold text-owner-fg align-top whitespace-nowrap">{label}</td>
                            <td className="px-3 py-2 text-owner-muted-subtle align-top max-w-[160px] truncate">{reviewModal[key] || <span className="italic">Not set</span>}</td>
                            <td className="px-3 py-2">
                              <input value={reviewForm[key] ?? ''} onChange={e => setReviewForm(f => ({ ...f, [key]: e.target.value }))}
                                className="w-full min-w-[140px] px-2 py-1 border border-owner-border rounded-lg text-sm focus:outline-none focus:border-blue-500" />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Document previews */}
              <div>
                <div className="text-xs font-bold text-owner-muted-subtle uppercase tracking-wide mb-2">Documents (Source: Tenant)</div>
                <div className="grid grid-cols-4 gap-2">
                  {[['Photo', reviewForm.photo_url], ['Aadhaar Front', reviewForm.aadhaar_front_url], ['Aadhaar Back', reviewForm.aadhaar_back_url], ['PAN', reviewForm.pan_url]].map(([label, url]) => (
                    <a key={label} href={url || undefined} target="_blank" rel="noreferrer"
                      className={`relative aspect-square rounded-xl border border-owner-border overflow-hidden flex items-center justify-center text-xs text-owner-muted-subtle ${url ? '' : 'bg-owner-surface-hover'}`}>
                      {url ? <Image src={url} alt={label as string} fill className="object-cover" sizes="120px" /> : label}
                    </a>
                  ))}
                </div>
              </div>

              {/* Owner-controlled assignment — finalized as part of approval */}
              <div>
                <div className="text-xs font-bold text-owner-muted-subtle uppercase tracking-wide mb-2">Assign Room & Rent (required to approve)</div>
                <div className="grid grid-cols-2 gap-3">
                  <select value={assignForm.room_id} onChange={e => setAssignForm(f => ({ ...f, room_id: e.target.value }))}
                    className="px-3 py-2 border border-owner-border rounded-xl text-sm focus:outline-none focus:border-blue-500">
                    <option value="">Select room</option>
                    {reviewRooms.map(r => <option key={r.id} value={r.id}>{r.room_number} ({r.sharing_type})</option>)}
                  </select>
                  <input placeholder="Bed label (optional)" value={assignForm.bed_label} onChange={e => setAssignForm(f => ({ ...f, bed_label: e.target.value }))}
                    className="px-3 py-2 border border-owner-border rounded-xl text-sm focus:outline-none focus:border-blue-500" />
                  <input type="number" placeholder="Monthly rent (₹)" value={assignForm.monthly_rent} onChange={e => setAssignForm(f => ({ ...f, monthly_rent: e.target.value }))}
                    className="px-3 py-2 border border-owner-border rounded-xl text-sm focus:outline-none focus:border-blue-500" />
                  <input type="number" placeholder="Deposit amount (₹)" value={assignForm.deposit_amount} onChange={e => setAssignForm(f => ({ ...f, deposit_amount: e.target.value }))}
                    className="px-3 py-2 border border-owner-border rounded-xl text-sm focus:outline-none focus:border-blue-500" />
                  <input type="number" placeholder="Deposit paid so far (₹)" value={assignForm.deposit_paid} onChange={e => setAssignForm(f => ({ ...f, deposit_paid: e.target.value }))}
                    className="px-3 py-2 border border-owner-border rounded-xl text-sm focus:outline-none focus:border-blue-500" />
                  <input type="date" value={assignForm.joining_date} onChange={e => setAssignForm(f => ({ ...f, joining_date: e.target.value }))}
                    className="px-3 py-2 border border-owner-border rounded-xl text-sm focus:outline-none focus:border-blue-500" />
                </div>
              </div>

              {showCorrectionInput && (
                <div>
                  <label className="text-xs font-semibold text-owner-muted block mb-1">What needs to be corrected?</label>
                  <textarea rows={3} value={correctionNote} onChange={e => setCorrectionNote(e.target.value)}
                    placeholder="e.g. The Aadhaar back photo is blurry — please re-upload"
                    className="w-full px-3 py-2 border border-owner-border rounded-xl text-sm focus:outline-none focus:border-blue-500 resize-none" />
                </div>
              )}
            </div>

            <div className="px-5 py-4 border-t border-owner-border shrink-0 space-y-2" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
              {showCorrectionInput ? (
                <div className="flex gap-2.5">
                  <button onClick={() => setShowCorrectionInput(false)}
                    className="flex-1 h-12 flex items-center justify-center gap-1.5 bg-owner-surface-hover hover:opacity-80 active:scale-[0.98] text-owner-fg rounded-2xl text-sm font-bold transition">
                    Cancel
                  </button>
                  <button onClick={handleSendBackForCorrection} disabled={reviewSaving}
                    className="flex-1 h-12 flex items-center justify-center gap-1.5 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 active:scale-[0.98] text-white rounded-2xl text-sm font-bold transition disabled:opacity-50">
                    {reviewSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Send Back
                  </button>
                </div>
              ) : (
                <>
                  <button onClick={handleApproveReview} disabled={reviewSaving}
                    className="w-full h-12 flex items-center justify-center gap-1.5 bg-green-600 hover:bg-green-700 active:bg-green-800 active:scale-[0.98] text-white rounded-2xl text-sm font-bold transition disabled:opacity-50">
                    {reviewSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Approve & Activate
                  </button>
                  <div className="flex gap-2.5">
                    <button onClick={() => setShowCorrectionInput(true)} disabled={reviewSaving}
                      className="flex-1 h-11 flex items-center justify-center gap-1.5 bg-amber-50 hover:bg-amber-100 active:bg-amber-200 active:scale-[0.98] text-amber-700 rounded-2xl text-xs font-bold transition disabled:opacity-50">
                      Send Back For Correction
                    </button>
                    <button onClick={handleRejectReview} disabled={reviewSaving}
                      className="flex-1 h-11 flex items-center justify-center gap-1.5 bg-red-50 hover:bg-red-100 active:bg-red-200 active:scale-[0.98] text-red-700 rounded-2xl text-xs font-bold transition disabled:opacity-50">
                      <X className="w-3.5 h-3.5" /> Reject
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </>
      )}

      {/* Profile Update Reject Modal (Phase 8.7) */}
      {updateRejectModal && (
        <>
          <div onClick={() => setUpdateRejectModal(null)} className="fixed inset-0 bg-black/40 z-50 transition-opacity" />
          <div className="fixed inset-x-0 bottom-0 z-50 bg-owner-surface-elevated rounded-t-3xl shadow-owner-lg max-h-[85vh] flex flex-col animate-owner-scale-in">
            <div className="flex justify-center pt-2.5 pb-1 shrink-0">
              <div className="h-1 w-9 rounded-full bg-owner-border-strong" />
            </div>
            <div className="px-5 pb-4 pt-1 flex items-center gap-3 border-b border-owner-border shrink-0">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-teal-500 to-blue-500 text-white font-bold text-xs flex items-center justify-center shrink-0">
                {(updateRejectModal.tenant?.name || '?').split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[11px] font-bold text-owner-muted-subtle uppercase tracking-wide">Reject Update</div>
                <div className="font-bold text-owner-fg truncate">{updateRejectModal.tenant?.name ?? 'Tenant'}</div>
              </div>
              <button onClick={() => setUpdateRejectModal(null)} aria-label="Close" className="text-owner-muted-subtle text-xl font-bold shrink-0 w-8 h-8 flex items-center justify-center rounded-full hover:bg-owner-surface-hover transition">×</button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
              <p className="text-xs text-owner-muted">Let {updateRejectModal.tenant?.name ?? 'the tenant'} know why (optional).</p>
              <textarea rows={3} value={updateOwnerNote} onChange={e => setUpdateOwnerNote(e.target.value)}
                placeholder="e.g. Please upload a clearer Aadhaar copy" className="w-full px-3 py-2 border border-owner-border rounded-xl text-sm focus:outline-none focus:border-blue-500 resize-none" />
            </div>
            <div className="px-5 py-4 border-t border-owner-border shrink-0 flex gap-2.5" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
              <button onClick={() => setUpdateRejectModal(null)}
                className="flex-1 h-12 flex items-center justify-center gap-1.5 bg-owner-surface-hover hover:opacity-80 active:scale-[0.98] text-owner-fg rounded-2xl text-sm font-bold transition">
                Cancel
              </button>
              <button onClick={handleRejectUpdate} disabled={decidingUpdateId === updateRejectModal.id}
                className="flex-1 h-12 flex items-center justify-center gap-1.5 bg-red-600 hover:bg-red-700 active:bg-red-800 active:scale-[0.98] text-white rounded-2xl text-sm font-bold transition disabled:opacity-50">
                {decidingUpdateId === updateRejectModal.id && <Loader2 className="w-4 h-4 animate-spin" />} Reject Request
              </button>
            </div>
          </div>
        </>
      )}

      {/* QR / Join Link Modal */}
      {qrModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-owner-surface rounded-2xl w-full max-w-sm shadow-2xl">
            <div className="px-6 py-4 border-b border-owner-border flex items-center justify-between">
              <h2 className="text-base font-bold">Tenant Join Link</h2>
              <button onClick={() => setQrModal(false)} className="text-owner-muted-subtle text-xl font-bold">×</button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-xs text-owner-muted">Share this link or QR code with new tenants. They fill in their details, it lands in &quot;New Tenant Requests&quot; for your approval.</p>
              <div className="flex justify-center p-4 bg-owner-surface-hover rounded-xl">
                <QRCodeSVG value={joinLink} size={160} />
              </div>
              <div className="flex items-center gap-2 bg-owner-surface-hover rounded-xl px-3 py-2.5">
                <Link2 className="w-3.5 h-3.5 text-owner-muted-subtle flex-shrink-0" />
                <span className="text-xs text-owner-muted flex-1 truncate font-mono">{joinLink}</span>
                <button onClick={() => { navigator.clipboard.writeText(joinLink); toast.success('Copied!') }}
                  className="p-1.5 hover:bg-owner-surface-hover rounded-lg transition">
                  <Copy className="w-3.5 h-3.5 text-owner-muted" />
                </button>
              </div>
              <a href={`https://wa.me/?text=${encodeURIComponent(`Join ${active?.name ?? 'our PG'} — fill your details here: ${joinLink}`)}`}
                target="_blank" rel="noreferrer"
                className="flex items-center justify-center gap-2 w-full py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-semibold transition">
                Share via WhatsApp
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Approve Tenant Modal — room assignment + confirm (password is auto Pass@123) */}
      {approveModal && (
        <>
          <div onClick={() => setApproveModal(null)} className="fixed inset-0 bg-black/40 z-50 transition-opacity" />
          <div className="fixed inset-x-0 bottom-0 z-50 bg-owner-surface-elevated rounded-t-3xl shadow-owner-lg max-h-[85vh] flex flex-col animate-owner-scale-in">
            <div className="flex justify-center pt-2.5 pb-1 shrink-0">
              <div className="h-1 w-9 rounded-full bg-owner-border-strong" />
            </div>
            <div className="px-5 pb-4 pt-1 flex items-center gap-3 border-b border-owner-border shrink-0">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-purple-600 to-blue-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
                {(approveModal.name || '?').split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[11px] font-bold text-owner-muted-subtle uppercase tracking-wide">Approve & Send Login</div>
                <div className="font-bold text-owner-fg truncate">{approveModal.name}</div>
              </div>
              <button onClick={() => setApproveModal(null)} aria-label="Close" className="text-owner-muted-subtle text-xl font-bold shrink-0 w-8 h-8 flex items-center justify-center rounded-full hover:bg-owner-surface-hover transition">×</button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              <p className="text-xs text-owner-muted bg-blue-50 text-blue-700 rounded-xl px-3 py-2.5">
                Login will be created automatically (username: <strong>{approveModal.phone}</strong>, password: <strong>Pass@123</strong>) and shared via WhatsApp.
              </p>
              <div>
                <label className="text-xs font-semibold text-owner-muted block mb-1">Assign Room (optional — can also do this later)</label>
                <select value={selectedRoomId} onChange={e => { setSelectedRoomId(e.target.value); setSelectedBedLabel('') }}
                  className="w-full px-3 py-2 border border-owner-border rounded-xl text-sm focus:outline-none focus:border-blue-500">
                  <option value="">No room / assign later</option>
                  {rooms.map(r => <option key={r.id} value={r.id}>Room {r.room_number} ({r.sharing_type})</option>)}
                </select>
              </div>
              {selectedRoomId && (
                <div>
                  <label className="text-xs font-semibold text-owner-muted block mb-1">Bed Label (optional)</label>
                  <input value={selectedBedLabel} onChange={e => setSelectedBedLabel(e.target.value)} placeholder="A / B / C"
                    className="w-full px-3 py-2 border border-owner-border rounded-xl text-sm focus:outline-none focus:border-blue-500" />
                </div>
              )}
            </div>
            <div className="px-5 py-4 border-t border-owner-border shrink-0 flex gap-2.5" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
              <button onClick={() => setApproveModal(null)}
                className="flex-1 h-12 flex items-center justify-center gap-1.5 bg-owner-surface-hover hover:opacity-80 active:scale-[0.98] text-owner-fg rounded-2xl text-sm font-bold transition">
                Cancel
              </button>
              <button onClick={confirmApproveTenant} disabled={approvingId === approveModal.id}
                className="flex-1 h-12 flex items-center justify-center gap-1.5 bg-green-600 hover:bg-green-700 active:bg-green-800 active:scale-[0.98] text-white rounded-2xl text-sm font-bold transition disabled:opacity-50">
                {approvingId === approveModal.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Approve & Send Login
              </button>
            </div>
          </div>
        </>
      )}

    </div>
  )
}
