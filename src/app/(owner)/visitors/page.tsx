'use client'
import { useEffect, useState, useCallback, useMemo } from 'react'
import { useProperty } from '@/components/shared/PropertyContext'
import { getVisitors, checkInVisitor, checkOutVisitor, deleteVisitor, archiveVisitor, getTenants } from '@/lib/supabase/queries'
import { queueOfflineAction } from '@/lib/offlineQueue'
import { toast } from 'sonner'
import { Plus, LogOut, Trash2, Loader2, UserCheck, Clock, Archive } from 'lucide-react'
import type { Visitor, Tenant } from '@/types'

export default function VisitorsPage() {
  const { activeId, properties } = useProperty()
  const [visitors, setVisitors] = useState<Visitor[]>([])
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'in' | 'all'>('in')
  const [modal, setModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [actioningId, setActioningId] = useState<string | null>(null)
  const [form, setForm] = useState({ property_id: '', visitor_name: '', visitor_phone: '', purpose: '', tenant_id: '', logged_by: '' })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const ids = activeId === 'all' ? properties.map(p => p.id) : [activeId]
      if (ids.length === 0 || ids.some(id => !id)) { setVisitors([]); setTenants([]); setLoading(false); return }
      const [visitorLists, tenantLists] = await Promise.all([
        Promise.all(ids.map(id => getVisitors(id))),
        Promise.all(ids.map(getTenants)),
      ])
      setVisitors(visitorLists.flat() as Visitor[])
      setTenants((tenantLists.flat() as Tenant[]).filter(t => t.status === 'active'))
    } catch { toast.error('Failed to load visitors') }
    setLoading(false)
  }, [activeId, properties])

  useEffect(() => { load() }, [load])

  const filtered = useMemo(
    () => (filter === 'in' ? visitors.filter(v => !v.check_out_time) : visitors),
    [visitors, filter]
  )
  const currentlyInCount = visitors.filter(v => !v.check_out_time).length

  function resetForm() {
    setForm({ property_id: '', visitor_name: '', visitor_phone: '', purpose: '', tenant_id: '', logged_by: '' })
  }

  async function handleCheckIn() {
    const propertyId = form.property_id || (activeId !== 'all' ? activeId : '')
    if (!propertyId) { toast.error('Select a property'); return }
    if (!form.visitor_name.trim()) { toast.error('Visitor name is required'); return }
    setSaving(true)
    const input = {
      property_id: propertyId,
      tenant_id: form.tenant_id || null,
      visitor_name: form.visitor_name.trim(),
      visitor_phone: form.visitor_phone.trim() || undefined,
      purpose: form.purpose.trim() || undefined,
      logged_by: form.logged_by.trim() || undefined,
    }
    try {
      await checkInVisitor(input)
      toast.success('Visitor checked in')
      setModal(false)
      resetForm()
      load()
    } catch (e: any) {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        queueOfflineAction('visitor_checkin', input, `Check in: ${input.visitor_name}`)
        toast.success('No connection — saved and will sync automatically once you\'re back online')
        setModal(false)
        resetForm()
      } else {
        toast.error(e.message || 'Failed to check in visitor')
      }
    }
    setSaving(false)
  }

  async function handleCheckOut(id: string) {
    setActioningId(id)
    try {
      await checkOutVisitor(id)
      toast.success('Visitor checked out')
      load()
    } catch (e: any) { toast.error(e.message || 'Failed to check out visitor') }
    setActioningId(null)
  }

  async function handleArchive(id: string) {
    setActioningId(id)
    try {
      await archiveVisitor(id)
      toast.success('Archived — find it later in Archive & Restore')
      load()
    } catch (e: any) { toast.error(e.message || 'Failed to archive record') }
    setActioningId(null)
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this visitor record? This cannot be undone.')) return
    setActioningId(id)
    try {
      await deleteVisitor(id)
      toast.success('Record deleted')
      load()
    } catch (e: any) { toast.error(e.message || 'Failed to delete record') }
    setActioningId(null)
  }

  const formPropertyId = form.property_id || (activeId !== 'all' ? activeId : '')
  const tenantsForForm = tenants.filter(t => !formPropertyId || t.property_id === formPropertyId)

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-extrabold text-gray-900">Visitor Management</h1>
          <p className="text-sm text-gray-500">{currentlyInCount} currently on the property</p>
        </div>
        <button onClick={() => setModal(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition">
          <Plus className="w-4 h-4" /> Log Visitor
        </button>
      </div>

      <div className="flex gap-1.5">
        <button onClick={() => setFilter('in')}
          className={`px-3 py-2 rounded-xl text-sm font-semibold transition ${filter === 'in' ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
          Currently In ({currentlyInCount})
        </button>
        <button onClick={() => setFilter('all')}
          className={`px-3 py-2 rounded-xl text-sm font-semibold transition ${filter === 'all' ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
          All History
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48 text-gray-400"><Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col items-center justify-center py-16 text-gray-400 gap-2">
          <UserCheck className="w-8 h-8" />
          <div className="text-sm">{filter === 'in' ? 'No one is currently checked in' : 'No visitor records yet'}</div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-50">
          {filtered.map(v => (
            <div key={v.id} className="flex items-start gap-3 px-5 py-4">
              <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
                <UserCheck className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-gray-800">{v.visitor_name}</div>
                <div className="text-xs text-gray-400">
                  {v.visitor_phone ? `${v.visitor_phone} · ` : ''}
                  {v.purpose || 'No purpose noted'}
                  {v.tenant?.name ? ` · Visiting ${v.tenant.name}` : ''}
                </div>
                <div className="flex items-center gap-1 text-xs text-gray-400 mt-1">
                  <Clock className="w-3 h-3" />
                  In: {new Date(v.check_in_time).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  {v.check_out_time && <span className="ml-1">· Out: {new Date(v.check_out_time).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {!v.check_out_time && (
                  <button onClick={() => handleCheckOut(v.id)} disabled={actioningId === v.id}
                    className="flex items-center gap-1 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-semibold transition disabled:opacity-50">
                    {actioningId === v.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LogOut className="w-3.5 h-3.5" />} Check Out
                  </button>
                )}
                <button onClick={() => handleArchive(v.id)} disabled={actioningId === v.id}
                  className="p-1.5 text-gray-300 hover:text-blue-500 transition disabled:opacity-50" title="Archive" aria-label="Archive">
                  <Archive className="w-4 h-4" />
                </button>
                <button onClick={() => handleDelete(v.id)} disabled={actioningId === v.id}
                  className="p-1.5 text-gray-300 hover:text-red-500 transition disabled:opacity-50" title="Delete permanently" aria-label="Delete permanently">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" role="dialog" aria-modal="true" aria-labelledby="visitor-modal-title">
          <div className="bg-white dark:bg-slate-900 rounded-t-2xl sm:rounded-2xl w-full max-w-md shadow-2xl pb-safe sm:pb-0 animate-owner-sheet-up sm:animate-owner-scale-in">
            <div className="px-6 py-4 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between">
              <h2 id="visitor-modal-title" className="text-base font-bold">Log Visitor</h2>
              <button onClick={() => { setModal(false); resetForm() }} aria-label="Close" className="text-gray-400 text-xl font-bold">×</button>
            </div>
            <div className="p-6 space-y-4">
              {activeId === 'all' && (
                <div>
                  <label htmlFor="visitor-property" className="text-xs font-semibold text-gray-600 block mb-1">Property *</label>
                  <select id="visitor-property" value={form.property_id} onChange={e => setForm(f => ({ ...f, property_id: e.target.value, tenant_id: '' }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-500">
                    <option value="">Select Property</option>
                    {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label htmlFor="visitor-name" className="text-xs font-semibold text-gray-600 block mb-1">Visitor Name *</label>
                <input id="visitor-name" value={form.visitor_name} onChange={e => setForm(f => ({ ...f, visitor_name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-500" placeholder="e.g. Ramesh Kumar" />
              </div>
              <div>
                <label htmlFor="visitor-phone" className="text-xs font-semibold text-gray-600 block mb-1">Phone</label>
                <input id="visitor-phone" value={form.visitor_phone} onChange={e => setForm(f => ({ ...f, visitor_phone: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-500" placeholder="Optional" />
              </div>
              <div>
                <label htmlFor="visitor-tenant" className="text-xs font-semibold text-gray-600 block mb-1">Visiting Tenant</label>
                <select id="visitor-tenant" value={form.tenant_id} onChange={e => setForm(f => ({ ...f, tenant_id: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-500">
                  <option value="">Not specified</option>
                  {tenantsForForm.map(t => <option key={t.id} value={t.id}>{t.name}{t.room?.room_number ? ` (Room ${t.room.room_number})` : ''}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="visitor-purpose" className="text-xs font-semibold text-gray-600 block mb-1">Purpose</label>
                <input id="visitor-purpose" value={form.purpose} onChange={e => setForm(f => ({ ...f, purpose: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-500" placeholder="e.g. Family visit, delivery, maintenance" />
              </div>
              <div>
                <label htmlFor="visitor-logged-by" className="text-xs font-semibold text-gray-600 block mb-1">Logged By</label>
                <input id="visitor-logged-by" value={form.logged_by} onChange={e => setForm(f => ({ ...f, logged_by: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-500" placeholder="Your name / security guard" />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-2">
              <button onClick={() => { setModal(false); resetForm() }} className="px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50 rounded-xl transition">Cancel</button>
              <button onClick={handleCheckIn} disabled={saving}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition disabled:opacity-50 flex items-center gap-2">
                {saving && <Loader2 className="w-4 h-4 animate-spin" />} Check In
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
