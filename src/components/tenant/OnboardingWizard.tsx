'use client'
import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { markOnboardingDraftStarted, submitOnboardingProfile, getProfileStatusHistory } from '@/lib/supabase/queries'
import { sendPushNotification } from '@/lib/push'
import { toast } from 'sonner'
import { Camera, User, CreditCard, Phone, Mail, FileText, Loader2, Check, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react'
import { Button, Card, CardHeader, CardTitle, CardDescription, Input, Textarea, TopAppBar, Avatar } from '@/components/tenant/ui'
import { StatusTimeline, type ProfileStatusHistoryEntry } from '@/components/shared/StatusTimeline'
import { calculateProfileCompletion } from '@/lib/utils/profileStatus'
import type { Tenant } from '@/types'

interface OnboardingWizardProps {
  tenant: Tenant
  onComplete: (updated: Tenant) => void
}

// Reuses the same Supabase Storage bucket as the QR-join flow's government ID
// upload, but with the path convention the existing tenant_documents RLS
// policies actually expect: <property_id>/<tenant_id>/<filename>. (An
// earlier version used a flat `<uuid>.<ext>` path here, which silently
// failed tenant_owns_path()'s check on the 2nd path segment — every KYC
// upload from this wizard was being rejected by RLS.)
async function uploadDocument(file: File, tenant: Tenant): Promise<string> {
  const sb = createClient()
  const ext = file.name.split('.').pop() || 'jpg'
  const path = `${tenant.property_id}/${tenant.id}/${crypto.randomUUID()}.${ext}`
  const { error } = await sb.storage.from('tenant-documents').upload(path, file)
  if (error) throw error
  const { data } = sb.storage.from('tenant-documents').getPublicUrl(path)
  return data.publicUrl
}

function UploadTile({ label, url, uploading, onSelect }: { label: string; url: string | null; uploading: boolean; onSelect: (file: File) => void }) {
  const inputId = `upload-${label.replace(/\s+/g, '-')}`
  return (
    <div>
      <label className="block text-xs font-semibold text-tenant-muted mb-1.5">{label}</label>
      <label
        htmlFor={inputId}
        className="relative flex flex-col items-center justify-center h-32 rounded-tenant-xl border-2 border-dashed border-tenant-border-strong bg-tenant-surface cursor-pointer overflow-hidden hover:border-tenant-primary transition-colors"
      >
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={label} className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <>
            <Camera className="w-5 h-5 text-tenant-muted-subtle mb-1.5" />
            <span className="text-xs text-tenant-muted-subtle">Tap to upload</span>
          </>
        )}
        {uploading && (
          <div className="absolute inset-0 bg-tenant-bg/70 flex items-center justify-center">
            <Loader2 className="w-5 h-5 animate-spin text-tenant-primary" />
          </div>
        )}
        {url && !uploading && (
          <div className="absolute top-1.5 right-1.5 bg-tenant-success text-white rounded-tenant-full p-0.5">
            <Check className="w-3 h-3" />
          </div>
        )}
        <input
          id={inputId}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) onSelect(f) }}
        />
      </label>
    </div>
  )
}

export default function OnboardingWizard({ tenant, onComplete }: OnboardingWizardProps) {
  // A correction round-trip pre-fills from what the tenant already
  // submitted (pending_profile), not the empty/owner-only live columns —
  // otherwise "Send Back For Correction" would wipe out everything they
  // already filled in.
  const draft = tenant.pending_profile ?? {}
  const [form, setForm] = useState({
    name: draft.name ?? tenant.name ?? '',
    email: draft.email ?? tenant.email ?? '',
    aadhaar_number: draft.aadhaar_number ?? tenant.aadhaar_number ?? '',
    permanent_address: draft.permanent_address ?? tenant.permanent_address ?? '',
    emergency_contact_name: draft.emergency_contact_name ?? tenant.emergency_contact_name ?? '',
    emergency_contact: draft.emergency_contact ?? tenant.emergency_contact ?? '',
  })
  const [photoUrl, setPhotoUrl] = useState<string | null>(draft.photo_url ?? tenant.photo_url)
  const [aadhaarFrontUrl, setAadhaarFrontUrl] = useState<string | null>(draft.aadhaar_front_url ?? tenant.aadhaar_front_url)
  const [aadhaarBackUrl, setAadhaarBackUrl] = useState<string | null>(draft.aadhaar_back_url ?? tenant.aadhaar_back_url)
  const [panUrl, setPanUrl] = useState<string | null>(draft.pan_url ?? tenant.pan_url)
  const [uploading, setUploading] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [onboardingStatus, setOnboardingStatus] = useState(tenant.onboarding_status)
  const [history, setHistory] = useState<ProfileStatusHistoryEntry[]>([])
  const [showTimeline, setShowTimeline] = useState(false)
  const draftMarked = useRef(false)

  // First time the tenant opens the wizard after activating their
  // account, silently advance password_changed → draft. Guarded so it
  // only ever fires once per mount, and markOnboardingDraftStarted itself
  // is a no-op once the tenant is past 'password_changed'.
  useEffect(() => {
    if (draftMarked.current) return
    draftMarked.current = true
    markOnboardingDraftStarted(tenant)
      .then(updated => {
        if (updated) {
          setOnboardingStatus(updated.onboarding_status)
          getProfileStatusHistory(tenant.id).then(setHistory).catch(() => {})
        }
      })
      .catch(() => {})
  }, [tenant])

  useEffect(() => {
    getProfileStatusHistory(tenant.id).then(setHistory).catch(() => setHistory([]))
  }, [tenant.id])

  const completion = calculateProfileCompletion({ ...tenant, pending_profile: { ...(tenant.pending_profile ?? {}), ...form, photo_url: photoUrl, aadhaar_front_url: aadhaarFrontUrl, aadhaar_back_url: aadhaarBackUrl } })

  async function handleUpload(kind: 'photo' | 'aadhaar_front' | 'aadhaar_back' | 'pan', file: File) {
    if (file.size > 8 * 1024 * 1024) { toast.error('File must be under 8MB'); return }
    setUploading(kind)
    try {
      const url = await uploadDocument(file, tenant)
      if (kind === 'photo') setPhotoUrl(url)
      else if (kind === 'aadhaar_front') setAadhaarFrontUrl(url)
      else if (kind === 'aadhaar_back') setAadhaarBackUrl(url)
      else setPanUrl(url)
    } catch (e: any) {
      toast.error('Upload failed: ' + e.message)
    }
    setUploading(null)
  }

  function validate(): string | null {
    if (!form.name.trim()) return "Enter your full name"
    if (!photoUrl) return 'Upload a profile photo'
    if (!/^\d{12}$/.test(form.aadhaar_number.replace(/\s/g, ''))) return 'Enter a valid 12-digit Aadhaar number'
    if (!aadhaarFrontUrl) return 'Upload the front of your Aadhaar card'
    if (!aadhaarBackUrl) return 'Upload the back of your Aadhaar card'
    if (!form.permanent_address.trim()) return 'Enter your permanent address'
    if (!form.emergency_contact_name.trim()) return "Enter your emergency contact's name"
    if (!/^\d{10}$/.test(form.emergency_contact.replace(/\D/g, ''))) return 'Enter a valid 10-digit emergency contact number'
    return null
  }

  async function handleSubmit() {
    const error = validate()
    if (error) { toast.error(error); return }
    setSubmitting(true)
    try {
      const submittedProfile = {
        name: form.name.trim(),
        email: form.email.trim() || null,
        photo_url: photoUrl,
        aadhaar_number: form.aadhaar_number.replace(/\s/g, ''),
        aadhaar_front_url: aadhaarFrontUrl,
        aadhaar_back_url: aadhaarBackUrl,
        pan_url: panUrl,
        permanent_address: form.permanent_address.trim(),
        emergency_contact_name: form.emergency_contact_name.trim(),
        emergency_contact: form.emergency_contact.replace(/\D/g, ''),
      }
      const updated = await submitOnboardingProfile(
        { id: tenant.id, property_id: tenant.property_id, onboarding_status: onboardingStatus },
        submittedProfile
      )
      setOnboardingStatus(updated.onboarding_status)
      // Phase 8.6 — onboarding notifications, reusing sendPushNotification()
      // exactly as the rest of the tenant portal does for leave/extension/
      // move-out requests (tenant.property?.owner_id targets the owner).
      const isResubmission = updated.onboarding_status === 'resubmitted'
      if (tenant.property?.owner_id) {
        sendPushNotification({
          user_ids: [tenant.property.owner_id],
          title: isResubmission ? '🔁 Correction Resubmitted' : '📋 Profile Submitted',
          body: isResubmission
            ? `${tenant.name} resubmitted their profile after your correction request.`
            : `${tenant.name} submitted their profile for review.`,
          url: '/approvals', tag: 'onboarding-submitted',
        })
      }
      if (tenant.auth_user_id) {
        sendPushNotification({
          user_ids: [tenant.auth_user_id],
          title: '📋 Profile Submitted',
          body: 'Your profile was submitted. Your owner will review it shortly.',
          url: '/portal', tag: 'onboarding-submitted-confirm',
        })
      }
      toast.success('Profile submitted for review!')
      onComplete(updated)
    } catch (e: any) {
      toast.error(e.message ?? 'Could not submit your profile')
    }
    setSubmitting(false)
  }

  return (
    <div className="min-h-screen bg-tenant-bg pb-24">
      <TopAppBar title="Complete Your Profile" subtitle="A few details for your owner to review" variant="compact" />

      <div className="px-4 sm:max-w-2xl sm:mx-auto pt-5 space-y-4">
        {onboardingStatus === 'correction_requested' && (
          <Card className="bg-tenant-warning/10 border-tenant-warning/25">
            <div className="flex gap-3">
              <AlertTriangle className="w-5 h-5 text-tenant-warning shrink-0 mt-0.5" />
              <div>
                <div className="text-sm font-bold text-tenant-fg">Your owner asked for a correction</div>
                {tenant.correction_note && <p className="text-xs text-tenant-muted mt-1">{tenant.correction_note}</p>}
              </div>
            </div>
          </Card>
        )}

        <Card>
          <button
            type="button"
            onClick={() => setShowTimeline(v => !v)}
            className="w-full flex items-center justify-between gap-3"
          >
            <div className="flex-1 text-left">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-tenant-muted">Profile Completion</span>
                <span className="text-xs font-bold text-tenant-primary">{completion}%</span>
              </div>
              <div className="w-full h-2 rounded-full bg-tenant-surface-hover overflow-hidden">
                <div className="h-full rounded-full bg-tenant-primary transition-all duration-500" style={{ width: `${completion}%` }} />
              </div>
            </div>
            {showTimeline ? <ChevronUp className="w-4 h-4 text-tenant-muted shrink-0" /> : <ChevronDown className="w-4 h-4 text-tenant-muted shrink-0" />}
          </button>
          {showTimeline && (
            <div className="mt-4 pt-4 border-t border-tenant-border">
              <StatusTimeline currentStatus={onboardingStatus} history={history} variant="tenant" />
            </div>
          )}
        </Card>

        <Card variant="ghost" padding="none" className="flex flex-col items-center py-2">
          <Avatar src={photoUrl} name={form.name || tenant.name} size="xl" />
          <label htmlFor="upload-photo" className="mt-3">
            <span className="text-xs font-semibold text-tenant-primary cursor-pointer">
              {photoUrl ? 'Change Profile Photo' : 'Upload Profile Photo *'}
            </span>
            <input id="upload-photo" type="file" accept="image/*" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload('photo', f) }} />
          </label>
          {uploading === 'photo' && <Loader2 className="w-4 h-4 animate-spin text-tenant-primary mt-1" />}
        </Card>

        <Card>
          <CardHeader><CardTitle>Basic Details</CardTitle></CardHeader>
          <div className="space-y-3">
            <Input label="Full Name *" leftIcon={<User />} value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              hint="Only correct this if your owner entered it wrong" />
            <Input label="Email (optional)" type="email" leftIcon={<Mail />} value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="you@example.com" />
          </div>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Aadhaar Verification</CardTitle>
            <CardDescription>Used only to verify your identity with your owner</CardDescription>
          </CardHeader>
          <div className="space-y-3">
            <Input label="Aadhaar Number *" leftIcon={<CreditCard />} inputMode="numeric" maxLength={14}
              value={form.aadhaar_number} onChange={e => setForm(f => ({ ...f, aadhaar_number: e.target.value }))}
              placeholder="XXXX XXXX XXXX" />
            <div className="grid grid-cols-2 gap-3">
              <UploadTile label="Aadhaar Front *" url={aadhaarFrontUrl} uploading={uploading === 'aadhaar_front'}
                onSelect={f => handleUpload('aadhaar_front', f)} />
              <UploadTile label="Aadhaar Back *" url={aadhaarBackUrl} uploading={uploading === 'aadhaar_back'}
                onSelect={f => handleUpload('aadhaar_back', f)} />
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader><CardTitle>Address</CardTitle></CardHeader>
          <Textarea label="Permanent Address *" rows={3} value={form.permanent_address}
            onChange={e => setForm(f => ({ ...f, permanent_address: e.target.value }))}
            placeholder="House no., street, city, state, PIN code" />
        </Card>

        <Card>
          <CardHeader><CardTitle>Emergency Contact</CardTitle></CardHeader>
          <div className="space-y-3">
            <Input label="Contact Name *" leftIcon={<User />} value={form.emergency_contact_name}
              onChange={e => setForm(f => ({ ...f, emergency_contact_name: e.target.value }))} placeholder="Parent/Guardian name" />
            <Input label="Contact Number *" type="tel" leftIcon={<Phone />} inputMode="numeric" value={form.emergency_contact}
              onChange={e => setForm(f => ({ ...f, emergency_contact: e.target.value }))} placeholder="10-digit mobile number" />
          </div>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>PAN (optional)</CardTitle>
            <CardDescription>Only needed if your owner requires it for your agreement</CardDescription>
          </CardHeader>
          <UploadTile label="PAN Card" url={panUrl} uploading={uploading === 'pan'} onSelect={f => handleUpload('pan', f)} />
        </Card>

        <Button fullWidth size="lg" loading={submitting} onClick={handleSubmit} icon={submitting ? undefined : <FileText className="w-4 h-4" />}>
          {submitting ? 'Submitting…' : 'Submit for Review'}
        </Button>
        <p className="text-xs text-tenant-muted-subtle text-center pb-4">
          Your owner will review these details before your account becomes fully active.
        </p>
      </div>
    </div>
  )
}
