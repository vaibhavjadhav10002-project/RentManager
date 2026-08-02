'use client'
import { useEffect, useState, useCallback } from 'react'
import { useProperty } from '@/components/shared/PropertyContext'
import { getPendingApprovals, approvePayment, rejectPayment, approveTenant, deleteTenant, getRooms, updateTenant, getLeaveRequests, decideLeaveRequest, getRentExtensionRequests, decideRentExtensionRequest, getMoveOutRequests, decideMoveOutRequest, getSubmittedOnboardingProfiles, approveOnboardingProfile, requestOnboardingCorrection, getProfileStatusHistory, getPendingProfileUpdateRequests, decideProfileUpdateRequest } from '@/lib/supabase/queries'
import { createClient } from '@/lib/supabase/client'
import { formatINR, formatDate, whatsappLink } from '@/lib/utils'
import { sendPushNotification } from '@/lib/push'
import { toast } from 'sonner'
import { Check, X, QrCode, Copy, Loader2, Link2 } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import type { Room } from '@/types'
import { StatusTimeline, type ProfileStatusHistoryEntry } from '@/components/shared/StatusTimeline'
import { calculateProfileCompletion } from '@/lib/utils/profileStatus'

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
    try { await approvePayment(id); toast.success('Payment approved!'); load() }
    catch (e: any) { toast.error(e.message) }
  }

  async function handleRejectPayment(id: string) {
    try { await rejectPayment(id); toast.error('Payment rejected'); load() }
    catch (e: any) { toast.error(e.message) }
  }

  async function handleRejectTenant(id: string, name: string) {
    if (!confirm(`Reject ${name}'s request? This cannot be undone.`)) return
    try { await deleteTenant(id); toast.error('Tenant request rejected'); load() }
    catch (e: any) { toast.error(e.message) }
  }

  async function handleDecideLeave(l: any, status: 'approved' | 'rejected') {
    setDecidingLeaveId(l.id)
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
      load()
    } catch (e: any) { toast.error(e.message) }
    setDecidingLeaveId(null)
  }

  async function handleDecideExtension(x: any, status: 'approved' | 'rejected') {
    setDecidingExtensionId(x.id)
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
      load()
    } catch (e: any) { toast.error(e.message) }
    setDecidingExtensionId(null)
  }

  async function handleDecideMoveOut(m: any, status: 'approved' | 'rejected') {
    setDecidingMoveOutId(m.id)
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
      load()
    } catch (e: any) { toast.error(e.message) }
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
      const msg = `Welcome to ${t.property?.name ?? 'the PG'}! 🎉\n\nYour login is ready:\nLogin: ${loginUrl}\nUsername: ${t.phone}\nPassword: ${defaultPassword}\n\nPlease change your password after your first login.`
      window.open(whatsappLink(t.phone, msg), '_blank')
    } catch (e: any) { toast.error(e.message) }
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
    } catch (e: any) { toast.error(e.message) }
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
    } catch (e: any) { toast.error(e.message) }
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
    } catch (e: any) { toast.error(e.message) }
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
    } catch (e: any) { toast.error(e.message) }
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
    } catch (e: any) { toast.error(e.message) }
    setDecidingUpdateId(null)
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-extrabold text-gray-900">Approvals</h1>
          <p className="text-sm text-gray-500">Review payment claims and new tenant requests</p>
        </div>
        <button onClick={() => { if (!active) { toast.error('Select a specific property first (not "All Properties")'); return } setQrModal(true) }} className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-sm font-semibold transition">
          <QrCode className="w-4 h-4" /> Tenant Join Link / QR
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-gray-100 rounded-xl w-fit">
        {[['payments', 'Payment Claims'], ['tenants', 'New Tenant Requests'], ['reviews', 'Profile Reviews'], ['updates', 'Profile Updates'], ['leave', 'Leave Requests'], ['extensions', 'Rent Extensions'], ['moveout', 'Move-Out Requests']].map(([v, l]) => (
          <button key={v} onClick={() => setTab(v as any)}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-semibold transition ${tab === v ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}>
            {l}
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
        <div className="flex items-center justify-center h-40 text-gray-400"><Loader2 className="w-5 h-5 animate-spin mr-2" />Loading…</div>
      ) : tab === 'payments' ? (
        payments.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center text-gray-400">
            <Check className="w-10 h-10 mx-auto mb-3 text-green-400" />
            <div className="font-semibold">No pending payment claims</div>
          </div>
        ) : (
          <div className="space-y-3">
            {payments.map(p => (
              <div key={p.id} className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm flex items-start justify-between gap-4 flex-wrap">
                <div className="flex gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-purple-600 text-white font-bold text-xs flex items-center justify-center flex-shrink-0">
                    {(p.tenant?.name || '?').split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                  </div>
                  <div>
                    <div className="font-bold text-gray-900">{p.tenant?.name} <span className="text-gray-400 font-normal text-xs">· Room {p.tenant?.room?.room_number}</span></div>
                    <div className="text-xs text-gray-500 mt-1">{p.for_month} · <span className="capitalize">{p.method?.replace('_', ' ')}</span></div>
                    {p.tenant_note && <div className="text-xs text-gray-400 italic mt-1">&quot;{p.tenant_note}&quot;</div>}
                    <div className="text-xs text-gray-400 mt-1">Submitted {new Date(p.created_at).toLocaleString('en-IN')}</div>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <div className="text-xl font-extrabold text-gray-900">{formatINR(p.amount_received)}</div>
                  <div className="flex gap-2">
                    <button onClick={() => handleApprovePayment(p.id)} className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-xs font-semibold transition">
                      <Check className="w-3.5 h-3.5" /> Approve
                    </button>
                    <button onClick={() => handleRejectPayment(p.id)} className="flex items-center gap-1.5 px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-700 rounded-xl text-xs font-semibold transition">
                      <X className="w-3.5 h-3.5" /> Reject
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      ) : tab === 'tenants' ? (
        pendingTenants.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center text-gray-400">
            <Check className="w-10 h-10 mx-auto mb-3 text-green-400" />
            <div className="font-semibold">No pending tenant requests</div>
            <p className="text-xs mt-2">Share the join link/QR with new tenants to get started</p>
          </div>
        ) : (
          <div className="space-y-3">
            {pendingTenants.map(t => (
              <div key={t.id} className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex gap-3 flex-1 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-600 to-blue-600 text-white font-bold text-xs flex items-center justify-center flex-shrink-0">
                      {(t.name || '?').split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-gray-900">{t.name}</div>
                      <div className="text-xs text-gray-500 mt-1">{t.phone} · <span className="font-semibold text-purple-600">{t.property?.name}</span></div>
                      <div className="text-xs text-gray-400 mt-1">Joining {t.joining_date}</div>
                      <div className="flex gap-4 mt-3 flex-wrap">
                        <div>
                          <div className="text-[10px] text-gray-400 uppercase font-bold">Rent</div>
                          <div className="text-sm font-bold text-gray-900">{formatINR(t.monthly_rent)}</div>
                          {t.rent_paid_at_joining < t.monthly_rent && (
                            <div className="text-xs text-yellow-600 font-semibold">₹{(t.monthly_rent - t.rent_paid_at_joining).toLocaleString('en-IN')} pending</div>
                          )}
                        </div>
                        <div>
                          <div className="text-[10px] text-gray-400 uppercase font-bold">Deposit Paid</div>
                          <div className="text-sm font-bold text-gray-900">{formatINR(t.deposit_paid)} <span className="text-gray-400 font-normal">/ {formatINR(t.deposit_amount)}</span></div>
                          {t.deposit_paid < t.deposit_amount && (
                            <div className="text-xs text-yellow-600 font-semibold">₹{(t.deposit_amount - t.deposit_paid).toLocaleString('en-IN')} pending</div>
                          )}
                        </div>
                        {t.rent_paid_at_joining > 0 && (
                          <div>
                            <div className="text-[10px] text-gray-400 uppercase font-bold">Rent Paid at Joining</div>
                            <div className="text-sm font-bold text-green-700">{formatINR(t.rent_paid_at_joining)}</div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => openApproveModal(t)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-xs font-semibold transition">
                      <Check className="w-3.5 h-3.5" /> Approve
                    </button>
                    <button onClick={() => handleRejectTenant(t.id, t.name)} className="flex items-center gap-1.5 px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-700 rounded-xl text-xs font-semibold transition">
                      <X className="w-3.5 h-3.5" /> Reject
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      ) : tab === 'reviews' ? (
        submittedProfiles.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center text-gray-400">
            <Check className="w-10 h-10 mx-auto mb-3 text-green-400" />
            <div className="font-semibold">No profiles waiting for review</div>
          </div>
        ) : (
          <div className="space-y-3">
            {submittedProfiles.map(t => (
              <div key={t.id} className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex gap-3 flex-1 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500 to-blue-500 text-white font-bold text-xs flex items-center justify-center flex-shrink-0">
                      {((t.pending_profile?.name ?? t.name) || '?').split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-gray-900">{t.pending_profile?.name ?? t.name}</div>
                      <div className="text-xs text-gray-500 mt-1">{t.phone}</div>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full mt-1.5 inline-block ${t.onboarding_status === 'resubmitted' ? 'bg-blue-100 text-blue-700' : 'bg-teal-100 text-teal-700'}`}>
                        {t.onboarding_status === 'resubmitted' ? 'Resubmitted' : 'Submitted'}
                      </span>
                      <span className="text-xs font-semibold text-gray-400 ml-2">{calculateProfileCompletion(t)}% complete</span>
                    </div>
                  </div>
                  <button onClick={() => openReviewModal(t)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-semibold transition flex-shrink-0">
                    Review
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      ) : tab === 'updates' ? (
        profileUpdateRequests.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center text-gray-400">
            <Check className="w-10 h-10 mx-auto mb-3 text-green-400" />
            <div className="font-semibold">No profile update requests pending</div>
          </div>
        ) : (
          <div className="space-y-3">
            {profileUpdateRequests.map(req => {
              const fieldLabels: Record<string, string> = {
                name: 'Full Name', email: 'Email', aadhaar_number: 'Aadhaar Number',
                permanent_address: 'Permanent Address', emergency_contact_name: 'Emergency Contact Name', emergency_contact: 'Emergency Contact Number',
              }
              return (
                <div key={req.id} className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                  <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
                    <div>
                      <div className="font-bold text-gray-900">{req.tenant?.name ?? 'Tenant'}</div>
                      <div className="text-xs text-gray-500 mt-1">{req.tenant?.phone} · Room {req.tenant?.room?.room_number ?? '—'}</div>
                      <div className="text-xs text-gray-400 mt-1">Requested {formatDate(req.created_at)}</div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => { setUpdateRejectModal(req); setUpdateOwnerNote('') }} disabled={decidingUpdateId === req.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 rounded-xl text-xs font-semibold transition disabled:opacity-50">
                        <X className="w-3.5 h-3.5" /> Reject
                      </button>
                      <button onClick={() => handleApproveUpdate(req)} disabled={decidingUpdateId === req.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-semibold transition disabled:opacity-50">
                        {decidingUpdateId === req.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Approve
                      </button>
                    </div>
                  </div>
                  {req.reason && <div className="text-xs text-gray-500 italic bg-gray-50 rounded-lg px-3 py-2 mb-3">&quot;{req.reason}&quot;</div>}
                  <div className="border border-gray-100 rounded-xl overflow-hidden">
                    <div className="grid grid-cols-3 bg-gray-50 text-[11px] font-bold text-gray-400 uppercase tracking-wide px-3 py-2">
                      <span>Field</span><span>Current</span><span>Requested</span>
                    </div>
                    {Object.entries(req.requested_changes ?? {}).map(([key, newVal]) => (
                      <div key={key} className="grid grid-cols-3 text-xs px-3 py-2 border-t border-gray-50">
                        <span className="text-gray-500 font-semibold">{fieldLabels[key] ?? key}</span>
                        <span className="text-gray-400">{(req.tenant as any)?.[key] || '—'}</span>
                        <span className="text-gray-900 font-semibold">{String(newVal) || '—'}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )
      ) : tab === 'leave' ? (
        leaveRequests.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center text-gray-400">
            <Check className="w-10 h-10 mx-auto mb-3 text-green-400" />
            <div className="font-semibold">No leave requests</div>
          </div>
        ) : (
          <div className="space-y-3">
            {leaveRequests.map(l => (
              <div key={l.id} className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex gap-3 flex-1 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-blue-600 text-white font-bold text-xs flex items-center justify-center flex-shrink-0">
                      {(l.tenant?.name || '?').split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-gray-900">{l.tenant?.name} <span className="text-gray-400 font-normal text-xs">· Room {l.tenant?.room?.room_number ?? '—'}</span></div>
                      <div className="text-xs text-gray-500 mt-1">{formatDate(l.start_date)} – {formatDate(l.end_date)}</div>
                      {l.reason && <div className="text-xs text-gray-400 italic mt-1">&quot;{l.reason}&quot;</div>}
                      <div className="text-xs text-gray-400 mt-1">Requested {formatDate(l.created_at)}</div>
                    </div>
                  </div>
                  {l.status === 'pending' ? (
                    <div className="flex gap-2 flex-shrink-0">
                      <button onClick={() => handleDecideLeave(l, 'approved')} disabled={decidingLeaveId === l.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-xs font-semibold transition disabled:opacity-50">
                        <Check className="w-3.5 h-3.5" /> Approve
                      </button>
                      <button onClick={() => handleDecideLeave(l, 'rejected')} disabled={decidingLeaveId === l.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-700 rounded-xl text-xs font-semibold transition disabled:opacity-50">
                        <X className="w-3.5 h-3.5" /> Reject
                      </button>
                    </div>
                  ) : (
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full capitalize flex-shrink-0 ${l.status === 'approved' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{l.status}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )
      ) : tab === 'extensions' ? (
        rentExtensions.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center text-gray-400">
            <Check className="w-10 h-10 mx-auto mb-3 text-green-400" />
            <div className="font-semibold">No rent extension requests</div>
          </div>
        ) : (
          <div className="space-y-3">
            {rentExtensions.map(x => (
              <div key={x.id} className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex gap-3 flex-1 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white font-bold text-xs flex items-center justify-center flex-shrink-0">
                      {(x.tenant?.name || '?').split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-gray-900">{x.tenant?.name} <span className="text-gray-400 font-normal text-xs">· Room {x.tenant?.room?.room_number ?? '—'}</span></div>
                      <div className="text-xs text-gray-500 mt-1">{x.for_month} rent → pay by {formatDate(x.requested_until)}</div>
                      {x.reason && <div className="text-xs text-gray-400 italic mt-1">&quot;{x.reason}&quot;</div>}
                      <div className="text-xs text-gray-400 mt-1">Requested {formatDate(x.created_at)}</div>
                    </div>
                  </div>
                  {x.status === 'pending' ? (
                    <div className="flex gap-2 flex-shrink-0">
                      <button onClick={() => handleDecideExtension(x, 'approved')} disabled={decidingExtensionId === x.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-xs font-semibold transition disabled:opacity-50">
                        <Check className="w-3.5 h-3.5" /> Approve
                      </button>
                      <button onClick={() => handleDecideExtension(x, 'rejected')} disabled={decidingExtensionId === x.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-700 rounded-xl text-xs font-semibold transition disabled:opacity-50">
                        <X className="w-3.5 h-3.5" /> Reject
                      </button>
                    </div>
                  ) : (
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full capitalize flex-shrink-0 ${x.status === 'approved' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{x.status}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        moveOutRequests.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center text-gray-400">
            <Check className="w-10 h-10 mx-auto mb-3 text-green-400" />
            <div className="font-semibold">No move-out requests</div>
          </div>
        ) : (
          <div className="space-y-3">
            {moveOutRequests.map(m => (
              <div key={m.id} className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex gap-3 flex-1 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-red-500 text-white font-bold text-xs flex items-center justify-center flex-shrink-0">
                      {(m.tenant?.name || '?').split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-gray-900">{m.tenant?.name} <span className="text-gray-400 font-normal text-xs">· Room {m.tenant?.room?.room_number ?? '—'}</span></div>
                      <div className="text-xs text-gray-500 mt-1">Move out on {formatDate(m.requested_date)}</div>
                      {m.reason && <div className="text-xs text-gray-400 italic mt-1">&quot;{m.reason}&quot;</div>}
                      <div className="text-xs text-gray-400 mt-1">Requested {formatDate(m.created_at)}</div>
                    </div>
                  </div>
                  {m.status === 'pending' ? (
                    <div className="flex gap-2 flex-shrink-0">
                      <button onClick={() => handleDecideMoveOut(m, 'approved')} disabled={decidingMoveOutId === m.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-xs font-semibold transition disabled:opacity-50">
                        <Check className="w-3.5 h-3.5" /> Approve
                      </button>
                      <button onClick={() => handleDecideMoveOut(m, 'rejected')} disabled={decidingMoveOutId === m.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-700 rounded-xl text-xs font-semibold transition disabled:opacity-50">
                        <X className="w-3.5 h-3.5" /> Reject
                      </button>
                    </div>
                  ) : (
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full capitalize flex-shrink-0 ${m.status === 'approved' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{m.status}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* Profile Review Modal (Phase 8.4) */}
      {reviewModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-t-2xl sm:rounded-2xl w-full max-w-2xl shadow-2xl my-8 pb-safe sm:pb-0 animate-owner-sheet-up sm:animate-owner-scale-in">
            <div className="px-6 py-4 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between sticky top-0 bg-white dark:bg-slate-900 rounded-t-2xl">
              <div>
                <h2 className="text-base font-bold">Review Profile</h2>
                <p className="text-xs text-gray-400">{reviewModal.phone}</p>
              </div>
              <button onClick={() => setReviewModal(null)} className="text-gray-400 text-xl font-bold">×</button>
            </div>

            <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
              {/* Profile Status System (Phase 8.5) — full history + completion */}
              <div className="bg-gray-50 rounded-xl p-4">
                <StatusTimeline
                  currentStatus={reviewModal.onboarding_status}
                  history={reviewHistory}
                  completionPercent={calculateProfileCompletion(reviewModal)}
                  variant="owner"
                />
              </div>

              {/* Previous / New / Source comparison */}
              <div>
                <div className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Submitted Details</div>
                <div className="border border-gray-100 rounded-xl overflow-hidden overflow-x-auto">
                  <table className="w-full text-sm min-w-[480px]">
                    <thead>
                      <tr className="bg-gray-50 text-left text-xs text-gray-500">
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
                        <tr key={key} className="border-t border-gray-50">
                          <td className="px-3 py-2 font-semibold text-gray-700 align-top">{label}</td>
                          <td className="px-3 py-2 text-gray-400 align-top">{reviewModal[key] || <span className="italic">Not set</span>}</td>
                          <td className="px-3 py-2">
                            <input value={reviewForm[key] ?? ''} onChange={e => setReviewForm(f => ({ ...f, [key]: e.target.value }))}
                              className="w-full px-2 py-1 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-500" />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Document previews */}
              <div>
                <div className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Documents (Source: Tenant)</div>
                <div className="grid grid-cols-4 gap-2">
                  {[['Photo', reviewForm.photo_url], ['Aadhaar Front', reviewForm.aadhaar_front_url], ['Aadhaar Back', reviewForm.aadhaar_back_url], ['PAN', reviewForm.pan_url]].map(([label, url]) => (
                    <a key={label} href={url || undefined} target="_blank" rel="noreferrer"
                      className={`aspect-square rounded-xl border border-gray-100 overflow-hidden flex items-center justify-center text-xs text-gray-400 ${url ? '' : 'bg-gray-50'}`}>
                      {url ? <img src={url} alt={label as string} className="w-full h-full object-cover" /> : label}
                    </a>
                  ))}
                </div>
              </div>

              {/* Owner-controlled assignment — finalized as part of approval */}
              <div>
                <div className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Assign Room & Rent (required to approve)</div>
                <div className="grid grid-cols-2 gap-3">
                  <select value={assignForm.room_id} onChange={e => setAssignForm(f => ({ ...f, room_id: e.target.value }))}
                    className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-500">
                    <option value="">Select room</option>
                    {reviewRooms.map(r => <option key={r.id} value={r.id}>{r.room_number} ({r.sharing_type})</option>)}
                  </select>
                  <input placeholder="Bed label (optional)" value={assignForm.bed_label} onChange={e => setAssignForm(f => ({ ...f, bed_label: e.target.value }))}
                    className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-500" />
                  <input type="number" placeholder="Monthly rent (₹)" value={assignForm.monthly_rent} onChange={e => setAssignForm(f => ({ ...f, monthly_rent: e.target.value }))}
                    className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-500" />
                  <input type="number" placeholder="Deposit amount (₹)" value={assignForm.deposit_amount} onChange={e => setAssignForm(f => ({ ...f, deposit_amount: e.target.value }))}
                    className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-500" />
                  <input type="number" placeholder="Deposit paid so far (₹)" value={assignForm.deposit_paid} onChange={e => setAssignForm(f => ({ ...f, deposit_paid: e.target.value }))}
                    className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-500" />
                  <input type="date" value={assignForm.joining_date} onChange={e => setAssignForm(f => ({ ...f, joining_date: e.target.value }))}
                    className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-500" />
                </div>
              </div>

              {showCorrectionInput && (
                <div>
                  <label className="text-xs font-semibold text-gray-600 block mb-1">What needs to be corrected?</label>
                  <textarea rows={3} value={correctionNote} onChange={e => setCorrectionNote(e.target.value)}
                    placeholder="e.g. The Aadhaar back photo is blurry — please re-upload"
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-500 resize-none" />
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex flex-wrap gap-2 sticky bottom-0 bg-white rounded-b-2xl">
              {showCorrectionInput ? (
                <>
                  <button onClick={handleSendBackForCorrection} disabled={reviewSaving}
                    className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-sm font-semibold transition disabled:opacity-50">
                    Send Back For Correction
                  </button>
                  <button onClick={() => setShowCorrectionInput(false)} className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-semibold transition">
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <button onClick={handleApproveReview} disabled={reviewSaving}
                    className="flex-1 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-semibold transition disabled:opacity-50">
                    {reviewSaving ? 'Saving…' : 'Approve & Activate'}
                  </button>
                  <button onClick={() => setShowCorrectionInput(true)} disabled={reviewSaving}
                    className="px-4 py-2.5 bg-amber-100 hover:bg-amber-200 text-amber-700 rounded-xl text-sm font-semibold transition disabled:opacity-50">
                    Send Back
                  </button>
                  <button onClick={handleRejectReview} disabled={reviewSaving}
                    className="px-4 py-2.5 bg-red-100 hover:bg-red-200 text-red-700 rounded-xl text-sm font-semibold transition disabled:opacity-50">
                    Reject
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Profile Update Reject Modal (Phase 8.7) */}
      {updateRejectModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white dark:bg-slate-900 rounded-t-2xl sm:rounded-2xl w-full max-w-sm shadow-2xl pb-safe sm:pb-0 animate-owner-sheet-up sm:animate-owner-scale-in">
            <div className="px-6 py-4 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between">
              <h2 className="text-base font-bold">Reject Profile Update</h2>
              <button onClick={() => setUpdateRejectModal(null)} className="text-gray-400 text-xl font-bold">×</button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-xs text-gray-500">Let {updateRejectModal.tenant?.name ?? 'the tenant'} know why (optional).</p>
              <textarea rows={3} value={updateOwnerNote} onChange={e => setUpdateOwnerNote(e.target.value)}
                placeholder="e.g. Please upload a clearer Aadhaar copy" className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-500 resize-none" />
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex gap-2">
              <button onClick={() => setUpdateRejectModal(null)} className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-semibold transition">Cancel</button>
              <button onClick={handleRejectUpdate} disabled={decidingUpdateId === updateRejectModal.id}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50 transition">
                {decidingUpdateId === updateRejectModal.id && <Loader2 className="w-4 h-4 animate-spin" />} Reject Request
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QR / Join Link Modal */}
      {qrModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white dark:bg-slate-900 rounded-t-2xl sm:rounded-2xl w-full max-w-sm shadow-2xl pb-safe sm:pb-0 animate-owner-sheet-up sm:animate-owner-scale-in">
            <div className="px-6 py-4 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between">
              <h2 className="text-base font-bold">Tenant Join Link</h2>
              <button onClick={() => setQrModal(false)} className="text-gray-400 text-xl font-bold">×</button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-xs text-gray-500">Share this link or QR code with new tenants. They fill in their details, it lands in &quot;New Tenant Requests&quot; for your approval.</p>
              <div className="flex justify-center p-4 bg-gray-50 rounded-xl">
                <QRCodeSVG value={joinLink} size={160} />
              </div>
              <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2.5">
                <Link2 className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                <span className="text-xs text-gray-600 flex-1 truncate font-mono">{joinLink}</span>
                <button onClick={() => { navigator.clipboard.writeText(joinLink); toast.success('Copied!') }}
                  className="p-1.5 hover:bg-gray-200 rounded-lg transition">
                  <Copy className="w-3.5 h-3.5 text-gray-500" />
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
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white dark:bg-slate-900 rounded-t-2xl sm:rounded-2xl w-full max-w-sm shadow-2xl pb-safe sm:pb-0 animate-owner-sheet-up sm:animate-owner-scale-in">
            <div className="px-6 py-4 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between">
              <h2 className="text-base font-bold">Approve {approveModal.name}</h2>
              <button onClick={() => setApproveModal(null)} className="text-gray-400 text-xl font-bold">×</button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-xs text-gray-500">
                Login will be created automatically (username: <strong>{approveModal.phone}</strong>, password: <strong>Pass@123</strong>) and shared via WhatsApp.
              </p>
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1">Assign Room (optional — can also do this later)</label>
                <select value={selectedRoomId} onChange={e => { setSelectedRoomId(e.target.value); setSelectedBedLabel('') }}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-500">
                  <option value="">No room / assign later</option>
                  {rooms.map(r => <option key={r.id} value={r.id}>Room {r.room_number} ({r.sharing_type})</option>)}
                </select>
              </div>
              {selectedRoomId && (
                <div>
                  <label className="text-xs font-semibold text-gray-600 block mb-1">Bed Label (optional)</label>
                  <input value={selectedBedLabel} onChange={e => setSelectedBedLabel(e.target.value)} placeholder="A / B / C"
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-500" />
                </div>
              )}
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
              <button onClick={confirmApproveTenant} disabled={approvingId === approveModal.id}
                className="flex-1 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50 transition">
                {approvingId === approveModal.id && <Loader2 className="w-4 h-4 animate-spin" />} Approve & Send Login
              </button>
              <button onClick={() => setApproveModal(null)} className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-xl text-sm font-semibold transition hover:bg-gray-200">Cancel</button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
