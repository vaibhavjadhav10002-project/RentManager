'use client'
import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { generateFullAgreementPDF } from '@/lib/pdf'
import { toast } from 'sonner'
import {
  Building2, CheckCircle, Loader2, ChevronLeft, ChevronRight, Download,
  Printer, Eye, User, Home, FileText, IndianRupee, ShieldCheck, X,
} from 'lucide-react'
import SignaturePad from '@/components/shared/SignaturePad'
import { formatINR, formatDate } from '@/lib/utils'

// Defined OUTSIDE the page component — declaring inputs inside the render
// body causes React to remount them on every keystroke (loses focus after
// every character). See Field usages elsewhere in this codebase for the
// same fix.
function Field({ label, required, hint, className, ...props }: any) {
  return (
    <div>
      <label className="text-xs font-semibold text-gray-600 block mb-1">{label}{required && <span className="text-red-500"> *</span>}</label>
      <input {...props} className={`w-full px-3 py-2.5 border border-gray-200 rounded-xl text-base sm:text-sm focus:outline-none focus:border-blue-500 ${className ?? ''}`} />
      {hint && <p className="text-[11px] text-gray-400 mt-1">{hint}</p>}
    </div>
  )
}

const STEPS = ['Tenant Info', 'Property & Term', 'Financials', 'Terms', 'Sign & Submit']

const TERMS = [
  '30-day notice period is required before vacating the room.',
  'Rent must be paid on or before the due date each month.',
  'The security deposit is refundable after move-out inspection, less any pending dues or damages.',
  'Electricity charges will be billed separately as per meter reading or the plan configured for this PG.',
  'The tenant is responsible for maintaining the room and furniture in good condition.',
  'Any damage to property will be recovered from the security deposit.',
  'Smoking, illegal activities, and nuisance of any kind are strictly prohibited on the premises.',
  'Guests are allowed only in accordance with the PG\'s guest policy.',
  'All outstanding dues must be cleared in full before checkout.',
  'The owner/manager may inspect the room with prior notice to the tenant.',
  'Renewal of this agreement beyond the end date is subject to the owner\'s approval.',
]

function addMonths(dateStr: string, months: number) {
  const d = new Date(dateStr)
  d.setMonth(d.getMonth() + months)
  return d.toISOString().slice(0, 10)
}

function ordinal(n: number) {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

export default function JoinPage() {
  const params = useParams<{ slug: string }>()
  const [loadingProperty, setLoadingProperty] = useState(true)
  const [property, setProperty] = useState<{ id: string; name: string; address: string | null; upi_id: string | null } | null>(null)
  const [ownerName, setOwnerName] = useState('')
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)

  const [form, setForm] = useState({
    name: '', phone: '', email: '', government_id: '', emergency_contact: '',
    start_date: '', duration_months: '11',
    monthly_rent: '', security_deposit: '', deposit_paid: '0', rent_paid_at_joining: '0',
    electricity_charges: 'As per meter reading', maintenance_charges: '0',
    other_charges: '0', other_charges_note: '', late_fee_policy: '₹50 per day after the due date',
  })
  const [accepted, setAccepted] = useState(false)
  const [signature, setSignature] = useState<string | null>(null)
  const [signedName, setSignedName] = useState('')

  useEffect(() => {
    async function loadProperty() {
      const sb = createClient()
      const { data: prop } = await sb.from('properties').select('id, name, address, upi_id').eq('qr_slug', params.slug).single()
      if (!prop) { setLoadingProperty(false); return }
      setProperty(prop)
      const { data: owner } = await sb.rpc('get_property_owner_name', { p_property_id: prop.id })
      setOwnerName(owner || 'PG Owner')
      setLoadingProperty(false)
    }
    loadProperty()
  }, [params.slug])

  useEffect(() => { if (form.name && !signedName) setSignedName(form.name) }, [form.name])

  const endDate = form.start_date ? addMonths(form.start_date, Number(form.duration_months)) : ''
  const dueDay = form.start_date ? new Date(form.start_date).getDate() : 1
  const agreementNumberPreview = `AGR-${new Date().getFullYear()}-XXXX`

  function validateStep(s: number): boolean {
    if (s === 0) {
      if (!form.name.trim()) { toast.error('Full name is required'); return false }
      const digits = form.phone.replace(/\D/g, '')
      if (digits.length < 10) { toast.error('Enter a valid 10-digit mobile number'); return false }
      if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) { toast.error('Enter a valid email address'); return false }
      if (!form.government_id.trim()) { toast.error('Government ID is required'); return false }
      if (!form.emergency_contact.trim()) { toast.error('Emergency contact is required'); return false }
    }
    if (s === 1) {
      if (!form.start_date) { toast.error('Select a start date'); return false }
    }
    if (s === 2) {
      if (!form.monthly_rent || Number(form.monthly_rent) <= 0) { toast.error('Enter a valid monthly rent'); return false }
      if (form.security_deposit === '' || Number(form.security_deposit) < 0) { toast.error('Enter the security deposit amount'); return false }
      if (form.deposit_paid === '') { toast.error('Enter deposit paid now (0 if none)'); return false }
      if (form.rent_paid_at_joining === '') { toast.error('Enter rent paid at joining (0 if none)'); return false }
      if (!form.electricity_charges.trim()) { toast.error('Electricity charges detail is required'); return false }
      if (form.maintenance_charges === '') { toast.error('Enter maintenance charges (0 if none)'); return false }
      if (!form.late_fee_policy.trim()) { toast.error('Late fee policy is required'); return false }
    }
    return true
  }

  function next() {
    if (!validateStep(step)) return
    setStep(s => Math.min(s + 1, STEPS.length - 1))
  }
  function back() { setStep(s => Math.max(s - 1, 0)) }

  function buildAgreementPdfData(agreementNumber: string) {
    return {
      agreementNumber,
      tenantName: form.name.trim(),
      tenantPhone: form.phone,
      tenantEmail: form.email || undefined,
      governmentId: form.government_id,
      emergencyContact: form.emergency_contact,
      propertyName: property?.name ?? 'PG',
      propertyAddress: property?.address ?? undefined,
      ownerName,
      startDate: form.start_date,
      endDate,
      durationMonths: Number(form.duration_months),
      rentCycle: 'Monthly',
      monthlyRent: Number(form.monthly_rent),
      securityDeposit: Number(form.security_deposit),
      electricityCharges: form.electricity_charges,
      maintenanceCharges: Number(form.maintenance_charges),
      otherCharges: Number(form.other_charges || 0),
      otherChargesNote: form.other_charges_note || undefined,
      dueDay,
      lateFeePolicy: form.late_fee_policy,
      termsVersion: 'v1.0',
      tenantSignature: signature,
      tenantSignedName: signedName,
      tenantSignedAt: new Date().toISOString(),
      status: 'pending',
    }
  }

  function handleDownloadPreviewPdf() {
    generateFullAgreementPDF(buildAgreementPdfData(agreementNumberPreview))
  }

  async function handleComplete() {
    if (!accepted) { toast.error('Please accept the terms & conditions'); return }
    if (!signature) { toast.error('Please sign the agreement'); return }
    if (!signedName.trim()) { toast.error('Enter your name to confirm your signature'); return }
    if (!property) { toast.error('Invalid join link'); return }
    setSaving(true)
    try {
      const sb = createClient()

      const { data: newTenant, error: tErr } = await sb.from('tenants').insert({
        property_id: property.id,
        name: form.name.trim(),
        phone: form.phone,
        email: form.email || null,
        emergency_contact: form.emergency_contact,
        joining_date: form.start_date,
        monthly_rent: Number(form.monthly_rent),
        deposit_amount: Number(form.security_deposit),
        deposit_paid: Number(form.deposit_paid || 0),
        rent_paid_at_joining: Number(form.rent_paid_at_joining || 0),
        notice_period_days: 30,
        status: 'pending_approval',
        submitted_via: 'qr_link',
      }).select().single()
      if (tErr) throw tErr

      const rentPaidNow = Number(form.rent_paid_at_joining || 0)
      if (rentPaidNow > 0) {
        const forMonth = new Date(form.start_date).toLocaleString('en-IN', { month: 'long', year: 'numeric' })
        await sb.from('payments').insert({
          tenant_id: newTenant.id, property_id: property.id, type: 'rent', for_month: forMonth,
          total_due: Number(form.monthly_rent), amount_received: rentPaidNow,
          submitted_by_tenant: true, approval_status: 'pending_approval', payment_date: form.start_date,
        })
      }

      const agreementNumber = `AGR-${new Date().getFullYear()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`
      await sb.from('agreements').insert({
        agreement_number: agreementNumber,
        tenant_id: newTenant.id,
        property_id: property.id,
        start_date: form.start_date,
        end_date: endDate,
        duration_months: Number(form.duration_months),
        rent_cycle: 'Monthly',
        monthly_rent: Number(form.monthly_rent),
        security_deposit: Number(form.security_deposit),
        electricity_charges: form.electricity_charges,
        maintenance_charges: Number(form.maintenance_charges || 0),
        other_charges: Number(form.other_charges || 0),
        other_charges_note: form.other_charges_note || null,
        due_day: dueDay,
        late_fee_policy: form.late_fee_policy,
        government_id: form.government_id,
        terms_version: 'v1.0',
        tenant_accepted: true,
        tenant_signature: signature,
        tenant_signed_name: signedName,
        tenant_signed_at: new Date().toISOString(),
        status: 'signed',
      })

      setSubmitted(true)
    } catch (e: any) { toast.error(e.message ?? 'Something went wrong') }
    setSaving(false)
  }

  if (loadingProperty) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
    </div>
  )

  if (!property) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4 text-center">
      <div>
        <h2 className="text-lg font-bold text-gray-900 mb-2">Invalid join link</h2>
        <p className="text-sm text-gray-500">Ask your PG owner for the correct link.</p>
      </div>
    </div>
  )

  if (submitted) return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-purple-50 p-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 sm:p-8 max-w-sm w-full text-center">
        <CheckCircle className="w-14 h-14 text-green-500 mx-auto mb-4" />
        <h2 className="text-lg font-extrabold text-gray-900 mb-2">Request Submitted!</h2>
        <p className="text-sm text-gray-500">Your details and signed agreement have been sent to the PG owner. They'll review, assign your room, and create your login. You'll receive your credentials soon.</p>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 px-3 py-6 sm:p-4">
      <div className="w-full max-w-2xl mx-auto">
        <div className="flex flex-col items-center mb-6">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center shadow-lg mb-3">
            <Building2 className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-lg font-extrabold text-gray-900 text-center">Join {property.name}</h1>
          <p className="text-xs text-gray-500 mt-1 text-center px-4">Fill your details and sign the agreement — the owner will review and approve</p>
        </div>

        {/* Stepper */}
        <div className="flex items-center justify-between mb-5 px-1">
          {STEPS.map((s, i) => (
            <div key={s} className="flex-1 flex items-center">
              <div className="flex flex-col items-center flex-shrink-0">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition ${
                  i < step ? 'bg-green-500 text-white' : i === step ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-400'
                }`}>
                  {i < step ? <CheckCircle className="w-4 h-4" /> : i + 1}
                </div>
                <span className={`text-[10px] mt-1 text-center hidden sm:block ${i === step ? 'text-blue-600 font-semibold' : 'text-gray-400'}`}>{s}</span>
              </div>
              {i < STEPS.length - 1 && <div className={`flex-1 h-0.5 mx-1 ${i < step ? 'bg-green-500' : 'bg-gray-200'}`} />}
            </div>
          ))}
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 sm:p-6">

          {/* Step 1: Tenant Info */}
          {step === 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-bold text-gray-900"><User className="w-4 h-4 text-blue-600" /> Tenant Information</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="col-span-1 sm:col-span-2"><Field label="Full Name" required value={form.name} onChange={(e: any) => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Your full name" /></div>
                <Field label="Mobile Number" required type="tel" inputMode="numeric" value={form.phone} onChange={(e: any) => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="10-digit mobile" />
                <Field label="Email" type="email" value={form.email} onChange={(e: any) => setForm(f => ({ ...f, email: e.target.value }))} placeholder="Optional" />
                <Field label="Government ID" required value={form.government_id} onChange={(e: any) => setForm(f => ({ ...f, government_id: e.target.value }))} placeholder="Aadhaar / PAN / License number" />
                <Field label="Emergency Contact" required type="tel" inputMode="numeric" value={form.emergency_contact} onChange={(e: any) => setForm(f => ({ ...f, emergency_contact: e.target.value }))} placeholder="Parent/Guardian number" />
              </div>
            </div>
          )}

          {/* Step 2: Property & Agreement Details */}
          {step === 1 && (
            <div className="space-y-5">
              <div>
                <div className="flex items-center gap-2 text-sm font-bold text-gray-900 mb-3"><Home className="w-4 h-4 text-blue-600" /> Property Information</div>
                <div className="bg-gray-50 rounded-xl p-4 grid grid-cols-2 gap-3 text-sm">
                  <div><div className="text-xs text-gray-400">PG Name</div><div className="font-semibold text-gray-900">{property.name}</div></div>
                  <div><div className="text-xs text-gray-400">Owner / Manager</div><div className="font-semibold text-gray-900">{ownerName}</div></div>
                  <div><div className="text-xs text-gray-400">Room Number</div><div className="font-semibold text-gray-900">To be assigned</div></div>
                  <div><div className="text-xs text-gray-400">Bed Number</div><div className="font-semibold text-gray-900">To be assigned</div></div>
                </div>
                <p className="text-[11px] text-gray-400 mt-1.5">Your room and bed will be assigned by the owner when they approve your request.</p>
              </div>
              <div>
                <div className="flex items-center gap-2 text-sm font-bold text-gray-900 mb-3"><FileText className="w-4 h-4 text-blue-600" /> Agreement Details</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Start Date" required type="date" value={form.start_date} onChange={(e: any) => setForm(f => ({ ...f, start_date: e.target.value }))} />
                  <div>
                    <label className="text-xs font-semibold text-gray-600 block mb-1">Agreement Duration <span className="text-red-500">*</span></label>
                    <div className="flex gap-2">
                      {['6', '11', '12'].map(m => (
                        <button key={m} type="button" onClick={() => setForm(f => ({ ...f, duration_months: m }))}
                          className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition ${form.duration_months === m ? 'border-blue-500 bg-blue-50 text-blue-600' : 'border-gray-200 text-gray-600'}`}>
                          {m} mo
                        </button>
                      ))}
                    </div>
                  </div>
                  <Field label="End Date (auto)" value={endDate ? formatDate(endDate) : '—'} disabled className="bg-gray-50 text-gray-500" />
                  <Field label="Rent Cycle" value="Monthly" disabled className="bg-gray-50 text-gray-500" />
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Financial Details */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-bold text-gray-900"><IndianRupee className="w-4 h-4 text-blue-600" /> Financial Details</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Monthly Rent (₹)" required type="number" inputMode="numeric" value={form.monthly_rent} onChange={(e: any) => setForm(f => ({ ...f, monthly_rent: e.target.value }))} placeholder="As agreed" />
                <Field label="Security Deposit (₹)" required type="number" inputMode="numeric" value={form.security_deposit} onChange={(e: any) => setForm(f => ({ ...f, security_deposit: e.target.value }))} placeholder="Refundable amount" />
                <Field label="Deposit Paid Now (₹)" required type="number" inputMode="numeric" value={form.deposit_paid} onChange={(e: any) => setForm(f => ({ ...f, deposit_paid: e.target.value }))} hint="Enter 0 if not paid yet" />
                <Field label="Rent Paid at Joining (₹)" required type="number" inputMode="numeric" value={form.rent_paid_at_joining} onChange={(e: any) => setForm(f => ({ ...f, rent_paid_at_joining: e.target.value }))} hint="Enter 0 if not paid yet" />
                <Field label="Maintenance Charges (₹/mo)" required type="number" inputMode="numeric" value={form.maintenance_charges} onChange={(e: any) => setForm(f => ({ ...f, maintenance_charges: e.target.value }))} />
                <Field label="Due Date (auto)" value={form.start_date ? `${ordinal(dueDay)} of every month` : '—'} disabled className="bg-gray-50 text-gray-500" />
                <div className="col-span-1 sm:col-span-2"><Field label="Electricity Charges" required value={form.electricity_charges} onChange={(e: any) => setForm(f => ({ ...f, electricity_charges: e.target.value }))} /></div>
                <div className="col-span-1 sm:col-span-2"><Field label="Other Charges (₹, optional)" type="number" inputMode="numeric" value={form.other_charges} onChange={(e: any) => setForm(f => ({ ...f, other_charges: e.target.value }))} placeholder="0" /></div>
                {Number(form.other_charges) > 0 && (
                  <div className="col-span-1 sm:col-span-2"><Field label="Other Charges Note" value={form.other_charges_note} onChange={(e: any) => setForm(f => ({ ...f, other_charges_note: e.target.value }))} placeholder="What is this charge for?" /></div>
                )}
                <div className="col-span-1 sm:col-span-2"><Field label="Late Fee Policy" required value={form.late_fee_policy} onChange={(e: any) => setForm(f => ({ ...f, late_fee_policy: e.target.value }))} /></div>
              </div>
            </div>
          )}

          {/* Step 4: Terms & Conditions */}
          {step === 3 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-bold text-gray-900"><ShieldCheck className="w-4 h-4 text-blue-600" /> Terms & Conditions</div>
              <div className="max-h-72 overflow-y-auto border border-gray-100 rounded-xl p-4 bg-gray-50 space-y-2.5">
                {TERMS.map((t, i) => (
                  <div key={i} className="flex gap-2 text-sm text-gray-700">
                    <span className="text-gray-400 flex-shrink-0">{i + 1}.</span>
                    <span>{t}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Step 5: Sign & Submit */}
          {step === 4 && (
            <div className="space-y-5">
              <div className="flex items-center gap-2 text-sm font-bold text-gray-900"><FileText className="w-4 h-4 text-blue-600" /> Digital Acceptance</div>

              <button type="button" onClick={() => setPreviewOpen(true)} className="w-full flex items-center justify-center gap-2 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50 transition">
                <Eye className="w-4 h-4" /> Preview Full Agreement
              </button>

              <label className="flex items-start gap-2.5 bg-blue-50 rounded-xl p-3 cursor-pointer">
                <input type="checkbox" checked={accepted} onChange={e => setAccepted(e.target.checked)} className="mt-0.5 w-4 h-4 accent-blue-600" />
                <span className="text-xs text-blue-800">I have read, understood, and agree to the PG Agreement & Terms and Conditions.</span>
              </label>

              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1">Your Signature <span className="text-red-500">*</span></label>
                <SignaturePad onChange={setSignature} />
              </div>

              <Field label="Type your name to confirm signature" required value={signedName} onChange={(e: any) => setSignedName(e.target.value)} />

              <div className="text-xs text-gray-400">Signed on {formatDate(new Date().toISOString())} at {new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</div>

              <div className="flex gap-2">
                <button type="button" onClick={handleDownloadPreviewPdf} className="flex-1 flex items-center justify-center gap-2 py-2.5 border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 hover:bg-gray-50 transition">
                  <Download className="w-3.5 h-3.5" /> Download PDF
                </button>
                <button type="button" onClick={() => window.print()} className="flex-1 flex items-center justify-center gap-2 py-2.5 border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 hover:bg-gray-50 transition">
                  <Printer className="w-3.5 h-3.5" /> Print
                </button>
              </div>
            </div>
          )}

          {/* Nav buttons */}
          <div className="flex gap-3 mt-6 pt-4 border-t border-gray-100">
            {step > 0 && (
              <button onClick={back} className="px-4 py-3 sm:py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 flex items-center gap-1.5 hover:bg-gray-50 transition">
                <ChevronLeft className="w-4 h-4" /> Back
              </button>
            )}
            {step < STEPS.length - 1 ? (
              <button onClick={next} className="flex-1 py-3 sm:py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-1.5 hover:opacity-90 transition">
                Next <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button onClick={handleComplete} disabled={saving || !accepted || !signature}
                title={!accepted || !signature ? 'Accept the terms and sign above to continue' : ''}
                className="flex-1 py-3 sm:py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 hover:opacity-90 transition disabled:opacity-40 disabled:cursor-not-allowed">
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                {saving ? 'Submitting…' : 'Complete Joining'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Agreement Preview Modal */}
      {previewOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[85vh] shadow-2xl flex flex-col">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
              <h2 className="text-base font-bold">Agreement Preview</h2>
              <button onClick={() => setPreviewOpen(false)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="p-5 overflow-y-auto text-sm space-y-4">
              <div>
                <div className="font-bold text-gray-900 mb-1">1. Tenant Information</div>
                {[['Name', form.name], ['Mobile', form.phone], ['Email', form.email || '—'], ['Government ID', form.government_id || '—'], ['Emergency Contact', form.emergency_contact || '—']].map(([l, v]) => (
                  <div key={l} className="flex justify-between text-gray-600 py-0.5"><span>{l}</span><span className="font-medium text-gray-900">{v}</span></div>
                ))}
              </div>
              <div>
                <div className="font-bold text-gray-900 mb-1">2. Property Information</div>
                {[['PG Name', property.name], ['Owner', ownerName], ['Room', 'To be assigned'], ['Bed', 'To be assigned']].map(([l, v]) => (
                  <div key={l} className="flex justify-between text-gray-600 py-0.5"><span>{l}</span><span className="font-medium text-gray-900">{v}</span></div>
                ))}
              </div>
              <div>
                <div className="font-bold text-gray-900 mb-1">3. Agreement Details</div>
                {[['Start Date', form.start_date ? formatDate(form.start_date) : '—'], ['End Date', endDate ? formatDate(endDate) : '—'], ['Duration', `${form.duration_months} months`], ['Rent Cycle', 'Monthly']].map(([l, v]) => (
                  <div key={l} className="flex justify-between text-gray-600 py-0.5"><span>{l}</span><span className="font-medium text-gray-900">{v}</span></div>
                ))}
              </div>
              <div>
                <div className="font-bold text-gray-900 mb-1">4. Financial Details</div>
                {[
                  ['Monthly Rent', formatINR(Number(form.monthly_rent || 0))],
                  ['Security Deposit', formatINR(Number(form.security_deposit || 0))],
                  ['Electricity', form.electricity_charges],
                  ['Maintenance', formatINR(Number(form.maintenance_charges || 0))],
                  ['Due Date', form.start_date ? `${ordinal(dueDay)} of every month` : '—'],
                  ['Late Fee', form.late_fee_policy],
                ].map(([l, v]) => (
                  <div key={l} className="flex justify-between text-gray-600 py-0.5"><span>{l}</span><span className="font-medium text-gray-900">{v}</span></div>
                ))}
              </div>
              <div>
                <div className="font-bold text-gray-900 mb-1">5. Terms & Conditions</div>
                <ol className="list-decimal list-inside text-gray-600 space-y-1 text-xs">
                  {TERMS.map((t, i) => <li key={i}>{t}</li>)}
                </ol>
              </div>
            </div>
            <div className="p-4 border-t border-gray-100 flex-shrink-0">
              <button onClick={() => setPreviewOpen(false)} className="w-full py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-semibold transition">Close Preview</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
