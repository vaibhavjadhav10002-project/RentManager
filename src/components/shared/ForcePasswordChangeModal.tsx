'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Lock, Loader2, ShieldCheck } from 'lucide-react'

export default function ForcePasswordChangeModal({ userId, onDone }: { userId: string; onDone: () => void }) {
  const [pw, setPw] = useState('')
  const [confirm, setConfirm] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleChange() {
    if (pw.length < 6) { toast.error('Password must be at least 6 characters'); return }
    if (pw !== confirm) { toast.error('Passwords do not match'); return }
    setSaving(true)
    const sb = createClient()

    const { error: pwErr } = await sb.auth.updateUser({ password: pw })
    if (pwErr) { toast.error(pwErr.message); setSaving(false); return }

    const { error: profErr } = await sb.from('profiles').update({ must_change_password: false }).eq('id', userId)
    if (profErr) { toast.error(profErr.message); setSaving(false); return }

    toast.success('Password updated!')
    onDone()
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-[200] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-6">
        <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center mb-4">
          <ShieldCheck className="w-6 h-6 text-blue-600" />
        </div>
        <h2 className="text-lg font-bold text-gray-900 mb-1">Set a new password</h2>
        <p className="text-sm text-gray-500 mb-5">
          For your account's security, please set your own password before continuing.
        </p>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1">New Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input type="password" value={pw} onChange={e => setPw(e.target.value)}
                placeholder="At least 6 characters"
                className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-500" />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1">Confirm Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleChange()}
                placeholder="Re-enter password"
                className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-500" />
            </div>
          </div>
        </div>

        <button onClick={handleChange} disabled={saving}
          className="w-full mt-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50 transition">
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          {saving ? 'Saving…' : 'Set Password & Continue'}
        </button>
      </div>
    </div>
  )
}
