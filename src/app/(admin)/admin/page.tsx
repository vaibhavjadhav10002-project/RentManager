'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatINR } from '@/lib/utils'
import { toast } from 'sonner'
import { Plus, Loader2, Building2, Users, UserCheck } from 'lucide-react'

export default function AdminPage() {
  const [owners, setOwners] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ full_name: '', email: '', phone: '', password: '' })

  async function load() {
    setLoading(true)
    const sb = createClient()
    const { data } = await sb.from('profiles').select('*, properties(id, name)').eq('role', 'pg_owner').order('created_at', { ascending: false })
    setOwners(data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function addOwner() {
    if (!form.full_name || !form.email || !form.password) { toast.error('Fill all required fields'); return }
    setSaving(true)
    try {
      const sb = createClient()
      const { data, error } = await sb.auth.signUp({
        email: form.email, password: form.password,
        options: { data: { full_name: form.full_name, role: 'pg_owner' } },
      })
      if (error) throw error
      // Update phone separately
      if (form.phone && data.user) {
        await sb.from('profiles').update({ phone: form.phone }).eq('id', data.user.id)
      }
      toast.success(`Owner account created for ${form.full_name}!`)
      setModal(false)
      setForm({ full_name: '', email: '', phone: '', password: '' })
      load()
    } catch (e: any) { toast.error(e.message) }
    setSaving(false)
  }

  async function toggleActive(ownerId: string, current: boolean) {
    const sb = createClient()
    await sb.from('profiles').update({ is_active: !current }).eq('id', ownerId)
    toast.success(current ? 'Owner deactivated' : 'Owner reactivated')
    load()
  }

  return (
    <div className="min-h-screen bg-gray-50 p-5">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-xl font-extrabold text-gray-900">Super Admin</h1>
            <p className="text-sm text-gray-500">Manage all PG owners and their properties</p>
          </div>
          <button onClick={() => setModal(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition">
            <Plus className="w-4 h-4" /> Add PG Owner
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { icon: UserCheck, label: 'Total Owners', value: owners.length, color: 'bg-blue-50 text-blue-600' },
            { icon: Building2, label: 'Total Properties', value: owners.reduce((s, o) => s + (o.properties?.length ?? 0), 0), color: 'bg-purple-50 text-purple-600' },
            { icon: Users, label: 'Active Owners', value: owners.filter(o => o.is_active).length, color: 'bg-green-50 text-green-600' },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${s.color}`}><s.icon className="w-4 h-4" /></div>
              <div className="text-2xl font-extrabold text-gray-900">{s.value}</div>
              <div className="text-xs text-gray-500 mt-1">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Owners List */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 font-bold text-sm text-gray-900">All PG Owners</div>
          {loading ? (
            <div className="flex items-center justify-center h-32 text-gray-400"><Loader2 className="w-5 h-5 animate-spin mr-2" />Loading…</div>
          ) : owners.length === 0 ? (
            <div className="text-center py-12 text-gray-400 text-sm">No PG owners yet. Add one to get started.</div>
          ) : (
            <div className="divide-y divide-gray-50">
              {owners.map(o => (
                <div key={o.id} className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-purple-600 text-white font-bold text-sm flex items-center justify-center flex-shrink-0">
                    {(o.full_name || '?').split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-gray-900">{o.full_name}</div>
                    <div className="text-xs text-gray-400">{o.email} · {o.phone ?? 'No phone'}</div>
                    <div className="text-xs text-blue-600 mt-0.5">{o.properties?.length ?? 0} properties</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${o.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {o.is_active ? 'Active' : 'Deactivated'}
                    </span>
                    <button onClick={() => toggleActive(o.id, o.is_active)}
                      className="text-xs font-semibold px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-xl transition">
                      {o.is_active ? 'Deactivate' : 'Reactivate'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Add Owner Modal */}
        {modal && (
          <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                <h2 className="text-base font-bold">Add PG Owner</h2>
                <button onClick={() => setModal(false)} className="text-gray-400 text-xl font-bold">×</button>
              </div>
              <div className="p-6 space-y-4">
                {[
                  { key: 'full_name', label: 'Full Name *', placeholder: 'e.g. Suresh Kumar' },
                  { key: 'email', label: 'Email Address *', placeholder: 'owner@email.com', type: 'email' },
                  { key: 'phone', label: 'Phone Number', placeholder: '9876543210', type: 'tel' },
                  { key: 'password', label: 'Temporary Password *', placeholder: 'Min 6 characters', type: 'password' },
                ].map(({ key, label, placeholder, type }) => (
                  <div key={key}>
                    <label className="text-xs font-semibold text-gray-600 block mb-1">{label}</label>
                    <input type={type ?? 'text'} placeholder={placeholder} value={(form as any)[key]}
                      onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-500" />
                  </div>
                ))}
                <p className="text-xs text-gray-400 bg-gray-50 rounded-xl p-3">
                  Share these credentials with the owner. They can change their password after first login via Settings.
                </p>
              </div>
              <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
                <button onClick={addOwner} disabled={saving}
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50 transition">
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />} Create Owner Account
                </button>
                <button onClick={() => setModal(false)} className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-200 transition">Cancel</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
