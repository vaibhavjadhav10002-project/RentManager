'use client'
import { useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Building2, CheckCircle, Loader2 } from 'lucide-react'

// Defined OUTSIDE the page component — if this were declared inside JoinPage's
// function body, React would treat it as a brand new component type on every
// re-render (which happens on every keystroke, since typing updates state).
// That was causing every input to lose focus after a single character,
// forcing the user to click back into the field for every letter/digit.
function Field({ label, required, ...props }: any) {
  return (
    <div>
      <label className="text-xs font-semibold text-gray-600 block mb-1">{label}{required && ' *'}</label>
      <input {...props} className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-base sm:text-sm focus:outline-none focus:border-blue-500" />
    </div>
  )
}

export default function JoinPage() {
  const params = useParams<{ slug: string }>()
  const [step, setStep] = useState<'form' | 'done'>('form')
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name: '', phone: '', email: '', emergency_contact: '',
    joining_date: '', monthly_rent: '', deposit_amount: '', deposit_paid: '',
    rent_paid_at_joining: '', notice_period_days: '30',
  })

  async function handleSubmit() {
    if (!form.name.trim() || !form.phone || !form.joining_date || !form.monthly_rent) {
      toast.error('Please fill all required fields'); return
    }
    const digitsOnly = form.phone.replace(/\D/g, '')
    if (digitsOnly.length < 10) { toast.error('Enter a valid 10-digit mobile number'); return }
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) { toast.error('Enter a valid email address'); return }
    if (Number(form.monthly_rent) <= 0) { toast.error('Enter a valid monthly rent'); return }
    setSaving(true)
    try {
      const sb = createClient()
      // Look up property by qr_slug
      const { data: property, error: propErr } = await sb
        .from('properties').select('id, name').eq('qr_slug', params.slug).single()
      if (propErr || !property) { toast.error('Invalid join link. Ask your PG owner for the correct link.'); setSaving(false); return }

      const { data: newTenant, error } = await sb.from('tenants').insert({
        property_id: property.id,
        name: form.name.trim(),
        phone: form.phone,
        email: form.email || null,
        emergency_contact: form.emergency_contact || null,
        joining_date: form.joining_date,
        monthly_rent: Number(form.monthly_rent),
        deposit_amount: Number(form.deposit_amount || 0),
        deposit_paid: Number(form.deposit_paid || 0),
        rent_paid_at_joining: Number(form.rent_paid_at_joining || 0),
        notice_period_days: Number(form.notice_period_days),
        status: 'pending_approval',
        submitted_via: 'qr_link',
      }).select().single()
      if (error) throw error

      // The rent_paid_at_joining column alone doesn't reduce "pending rent"
      // anywhere — every pending-rent calculation in the app reads the
      // `payments` table, not this column. So we also record it as a
      // self-reported payment claim (pending owner approval, same as any
      // other tenant-submitted payment) for the correct amount still due.
      const rentPaidNow = Number(form.rent_paid_at_joining || 0)
      if (rentPaidNow > 0) {
        const forMonth = new Date(form.joining_date).toLocaleString('en-IN', { month: 'long', year: 'numeric' })
        await sb.from('payments').insert({
          tenant_id: newTenant.id,
          property_id: property.id,
          type: 'rent',
          for_month: forMonth,
          total_due: Number(form.monthly_rent),
          amount_received: rentPaidNow,
          submitted_by_tenant: true,
          approval_status: 'pending_approval',
          payment_date: form.joining_date,
        })
      }
      setStep('done')
    } catch (e: any) { toast.error(e.message) }
    setSaving(false)
  }

  if (step === 'done') return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-purple-50 p-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 sm:p-8 max-w-sm w-full text-center">
        <CheckCircle className="w-14 h-14 text-green-500 mx-auto mb-4" />
        <h2 className="text-lg font-extrabold text-gray-900 mb-2">Request Submitted!</h2>
        <p className="text-sm text-gray-500">Your details have been sent to the PG owner. They will review and create your login. You'll receive your credentials soon.</p>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 px-3 py-6 sm:p-4 flex items-center justify-center">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-6">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center shadow-lg mb-3">
            <Building2 className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-lg font-extrabold text-gray-900 text-center">Join PG</h1>
          <p className="text-xs text-gray-500 mt-1 text-center px-4">Fill your details — the owner will approve your request</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 sm:p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="col-span-1 sm:col-span-2"><Field label="Full Name" required value={form.name} onChange={(e: any) => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Your full name" /></div>
            <Field label="Mobile Number" required type="tel" inputMode="numeric" value={form.phone} onChange={(e: any) => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="10-digit mobile" />
            <Field label="Email" type="email" value={form.email} onChange={(e: any) => setForm(f => ({ ...f, email: e.target.value }))} placeholder="Optional" />
            <Field label="Emergency Contact" type="tel" inputMode="numeric" value={form.emergency_contact} onChange={(e: any) => setForm(f => ({ ...f, emergency_contact: e.target.value }))} placeholder="Parent/Guardian" />
            <Field label="Joining Date" required type="date" value={form.joining_date} onChange={(e: any) => setForm(f => ({ ...f, joining_date: e.target.value }))} />
            <Field label="Monthly Rent (₹)" required type="number" inputMode="numeric" value={form.monthly_rent} onChange={(e: any) => setForm(f => ({ ...f, monthly_rent: e.target.value }))} placeholder="As agreed" />
            <Field label="Total Deposit (₹)" type="number" inputMode="numeric" value={form.deposit_amount} onChange={(e: any) => setForm(f => ({ ...f, deposit_amount: e.target.value }))} placeholder="0" />
            <div className="col-span-1 sm:col-span-2">
              <Field label="Deposit Paid Now (₹)" type="number" inputMode="numeric" value={form.deposit_paid} onChange={(e: any) => setForm(f => ({ ...f, deposit_paid: e.target.value }))} placeholder="If partial, enter amount paid today" />
            </div>
            <div className="col-span-1 sm:col-span-2">
              <Field label="Rent Paid at Joining (₹)" type="number" inputMode="numeric" value={form.rent_paid_at_joining} onChange={(e: any) => setForm(f => ({ ...f, rent_paid_at_joining: e.target.value }))} placeholder="If you've already paid some rent in cash, enter it here" />
            </div>
            <div className="col-span-1 sm:col-span-2">
              <label className="text-xs font-semibold text-gray-600 block mb-1">Notice Period</label>
              <div className="grid grid-cols-2 sm:flex gap-2">
                {['15', '30', '45', '60'].map(d => (
                  <button key={d} onClick={() => setForm(f => ({ ...f, notice_period_days: d }))}
                    className={`flex-1 py-2.5 sm:py-2 rounded-xl text-sm sm:text-xs font-semibold border transition ${form.notice_period_days === d ? 'border-blue-500 bg-blue-50 text-blue-600' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                    {d} days
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-blue-50 rounded-xl p-3 text-xs text-blue-700">
            Your details will be reviewed by the PG owner. Once approved, you'll get a login to track your rent and more.
          </div>

          <button onClick={handleSubmit} disabled={saving}
            className="w-full py-3.5 sm:py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 hover:opacity-90 transition disabled:opacity-50">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {saving ? 'Submitting…' : 'Submit Request'}
          </button>
        </div>
      </div>
    </div>
  )
}
