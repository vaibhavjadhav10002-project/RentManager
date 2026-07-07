'use client'
import { useEffect, useState, useCallback } from 'react'
import { useProperty } from '@/components/shared/PropertyContext'
import { getNotices, sendNotice, deleteNotice, getTenants } from '@/lib/supabase/queries'
import { noticeWhatsappMsg } from '@/lib/utils'
import { toast } from 'sonner'
import { Plus, Loader2, Trash2, Megaphone, MessageCircle, Users, User } from 'lucide-react'
import type { Tenant } from '@/types'

const CATEGORIES = [
  { value: 'rent', label: 'Rent', color: 'bg-green-100 text-green-700 dark:bg-green-500/10 dark:text-green-400' },
  { value: 'deposit', label: 'Deposit', color: 'bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400' },
  { value: 'electricity', label: 'Electricity', color: 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400' },
  { value: 'water', label: 'Water', color: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-500/10 dark:text-cyan-400' },
  { value: 'maintenance', label: 'Maintenance', color: 'bg-orange-100 text-orange-700 dark:bg-orange-500/10 dark:text-orange-400' },
  { value: 'general', label: 'General', color: 'bg-gray-100 text-gray-700 dark:bg-slate-700 dark:text-slate-300' },
] as const

export default function NoticesPage() {
  const { activeId, active, properties } = useProperty()
  const [notices, setNotices] = useState<any[]>([])
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [audience, setAudience] = useState<'all' | 'selected'>('all')
  const [selectedTenantIds, setSelectedTenantIds] = useState<string[]>([])
  const [form, setForm] = useState({ category: 'general' as typeof CATEGORIES[number]['value'], title: '', message: '' })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      if (activeId === 'all') {
        const [noticeLists, tenantLists] = await Promise.all([
          Promise.all(properties.map(p => getNotices(p.id))),
          Promise.all(properties.map(p => getTenants(p.id))),
        ])
        setNotices(noticeLists.flat().sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()))
        setTenants(tenantLists.flat().filter(t => t.status === 'active'))
      } else if (activeId) {
        const [n, t] = await Promise.all([getNotices(activeId), getTenants(activeId)])
        setNotices(n)
        setTenants(t.filter(t => t.status === 'active'))
      } else {
        setNotices([]); setTenants([])
      }
    } catch { toast.error('Failed to load notices') }
    setLoading(false)
  }, [activeId, properties])

  useEffect(() => { load() }, [load])

  function openModal() {
    if (activeId === 'all') {
      toast.error('Select a specific property from the switcher above to send a notice')
      return
    }
    setForm({ category: 'general', title: '', message: '' })
    setAudience('all')
    setSelectedTenantIds([])
    setModal(true)
  }

  function toggleTenant(id: string) {
    setSelectedTenantIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  async function handleSend() {
    if (!form.title.trim() || !form.message.trim()) { toast.error('Fill in title and message'); return }
    if (audience === 'selected' && selectedTenantIds.length === 0) { toast.error('Select at least one tenant, or choose "All Tenants"'); return }
    if (!active) { toast.error('Select a specific property first'); return }
    setSaving(true)
    try {
      await sendNotice({
        property_id: active.id,
        category: form.category,
        title: form.title.trim(),
        message: form.message.trim(),
        tenant_ids: audience === 'selected' ? selectedTenantIds : undefined,
      })
      toast.success('Notice sent! It now appears on the tenant dashboard.')
      setModal(false)
      load()
    } catch (e: any) { toast.error(e.message) }
    setSaving(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this notice? Tenants will no longer see it.')) return
    try { await deleteNotice(id); toast.success('Notice deleted'); load() }
    catch (e: any) { toast.error(e.message) }
  }

  function targetedTenants(notice: any): Tenant[] {
    if (!notice.tenant_ids) return tenants  // null = everyone
    return tenants.filter(t => notice.tenant_ids.includes(t.id))
  }

  function whatsappAllLink(notice: any) {
    const targets = targetedTenants(notice)
    // wa.me only supports one recipient per link, so for "send to everyone"
    // we open the first tenant's chat pre-filled — the owner can still copy
    // the message and forward it manually to the rest, which is the honest
    // limit of what a free, no-API WhatsApp integration can do.
    if (targets.length === 0) return null
    const first = targets[0]
    return `https://wa.me/${first.phone.replace(/\D/g, '').startsWith('91') ? '' : '91'}${first.phone.replace(/\D/g, '')}?text=${encodeURIComponent(noticeWhatsappMsg(first.name, notice.title, notice.message, active?.name ?? 'your PG'))}`
  }

  const catInfo = (val: string) => CATEGORIES.find(c => c.value === val) ?? CATEGORIES[5]

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-extrabold text-gray-900 dark:text-white">Notices</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400">Send announcements to your tenants — rent, electricity, maintenance, or anything else</p>
        </div>
        <button onClick={openModal} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition">
          <Plus className="w-4 h-4" /> Send Notice
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40 text-gray-400 dark:text-slate-500"><Loader2 className="w-5 h-5 animate-spin mr-2" />Loading…</div>
      ) : notices.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 p-12 text-center">
          <Megaphone className="w-10 h-10 mx-auto mb-3 text-gray-300 dark:text-slate-600" />
          <div className="font-semibold text-gray-700 dark:text-slate-300">No notices sent yet</div>
          <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">Send your first notice — it'll appear right on your tenants' dashboards.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {notices.map(n => {
            const cat = catInfo(n.category)
            const wa = whatsappAllLink(n)
            const targetCount = n.tenant_ids ? n.tenant_ids.length : tenants.length
            return (
              <div key={n.id} className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 p-5 shadow-sm dark:shadow-none">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-full capitalize ${cat.color}`}>{cat.label}</span>
                      <span className="text-xs text-gray-400 dark:text-slate-500 flex items-center gap-1">
                        {n.tenant_ids ? <User className="w-3 h-3" /> : <Users className="w-3 h-3" />}
                        {n.tenant_ids ? `${targetCount} selected tenant${targetCount === 1 ? '' : 's'}` : 'All tenants'}
                      </span>
                    </div>
                    <div className="font-bold text-sm text-gray-900 dark:text-white mb-1">{n.title}</div>
                    <p className="text-sm text-gray-600 dark:text-slate-300 whitespace-pre-wrap">{n.message}</p>
                    <div className="text-xs text-gray-400 dark:text-slate-500 mt-2">{new Date(n.created_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    {wa && (
                      <a href={wa} target="_blank" rel="noreferrer"
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-green-100 hover:bg-green-200 dark:bg-green-500/10 dark:hover:bg-green-500/20 text-green-700 dark:text-green-400 rounded-xl text-xs font-semibold transition">
                        <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
                      </a>
                    )}
                    <button onClick={() => handleDelete(n.id)} className="p-1.5 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg text-gray-400 hover:text-red-500 transition">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Send Notice Modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between flex-shrink-0">
              <h2 className="text-base font-bold text-gray-900 dark:text-white">Send Notice — {active?.name}</h2>
              <button onClick={() => setModal(false)} className="text-gray-400 text-xl font-bold">×</button>
            </div>
            <div className="p-6 space-y-4 overflow-y-auto">
              <div>
                <label className="text-xs font-semibold text-gray-600 dark:text-slate-400 block mb-1.5">Category</label>
                <div className="grid grid-cols-3 gap-2">
                  {CATEGORIES.map(c => (
                    <button key={c.value} onClick={() => setForm(f => ({ ...f, category: c.value }))}
                      className={`py-2 rounded-xl text-xs font-semibold border transition capitalize ${form.category === c.value ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400' : 'border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-800'}`}>
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 dark:text-slate-400 block mb-1.5">Title *</label>
                <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Electricity bill due, Water supply shutdown"
                  className="w-full px-3 py-2 border border-gray-200 dark:border-slate-700 dark:bg-slate-800 dark:text-white rounded-xl text-sm focus:outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 dark:text-slate-400 block mb-1.5">Message *</label>
                <textarea rows={4} value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))} placeholder="Write your notice here…"
                  className="w-full px-3 py-2 border border-gray-200 dark:border-slate-700 dark:bg-slate-800 dark:text-white rounded-xl text-sm focus:outline-none focus:border-blue-500 resize-none" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 dark:text-slate-400 block mb-1.5">Send To</label>
                <div className="flex gap-2 mb-2">
                  <button onClick={() => setAudience('all')}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold border transition ${audience === 'all' ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400' : 'border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-400'}`}>
                    <Users className="w-3.5 h-3.5" /> All Tenants ({tenants.length})
                  </button>
                  <button onClick={() => setAudience('selected')}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold border transition ${audience === 'selected' ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400' : 'border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-400'}`}>
                    <User className="w-3.5 h-3.5" /> Select Tenants
                  </button>
                </div>
                {audience === 'selected' && (
                  <div className="border border-gray-200 dark:border-slate-700 rounded-xl max-h-40 overflow-y-auto">
                    {tenants.length === 0 ? (
                      <div className="p-3 text-xs text-gray-400 dark:text-slate-500 text-center">No active tenants at this property</div>
                    ) : tenants.map(t => (
                      <label key={t.id} className="flex items-center gap-2.5 px-3 py-2 hover:bg-gray-50 dark:hover:bg-slate-800 cursor-pointer border-b border-gray-50 dark:border-slate-800 last:border-0">
                        <input type="checkbox" checked={selectedTenantIds.includes(t.id)} onChange={() => toggleTenant(t.id)} className="accent-blue-600" />
                        <span className="text-xs text-gray-700 dark:text-slate-300">{t.name}{t.room ? ` — Room ${t.room.room_number}` : ''}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
              <div className="bg-blue-50 dark:bg-blue-500/10 rounded-xl p-3 text-xs text-blue-700 dark:text-blue-400">
                This notice appears immediately on the tenant dashboard. After sending, you'll get a one-tap WhatsApp button to forward the same message.
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 dark:border-slate-800 flex gap-3 flex-shrink-0">
              <button onClick={handleSend} disabled={saving}
                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50 transition">
                {saving && <Loader2 className="w-4 h-4 animate-spin" />} Send Notice
              </button>
              <button onClick={() => setModal(false)} className="flex-1 py-2.5 bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 rounded-xl text-sm font-semibold hover:bg-gray-200 dark:hover:bg-slate-700 transition">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
