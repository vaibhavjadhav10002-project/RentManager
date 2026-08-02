'use client'
import { useEffect, useState, useCallback, useMemo } from 'react'
import { useProperty } from '@/components/shared/PropertyContext'
import { getParcels, logParcel, collectParcel, deleteParcel, archiveParcel, getTenants } from '@/lib/supabase/queries'
import { queueOfflineAction } from '@/lib/offlineQueue'
import { sendPushNotification } from '@/lib/push'
import { toast } from 'sonner'
import { Plus, Package, PackageCheck, Trash2, Loader2, Clock, Archive } from 'lucide-react'
import type { Parcel, Tenant } from '@/types'

export default function ParcelsPage() {
  const { activeId, properties } = useProperty()
  const [parcels, setParcels] = useState<Parcel[]>([])
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'pending' | 'all'>('pending')
  const [modal, setModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [actioningId, setActioningId] = useState<string | null>(null)
  const [form, setForm] = useState({ property_id: '', courier_name: '', tracking_number: '', description: '', tenant_id: '', received_by: '' })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const ids = activeId === 'all' ? properties.map(p => p.id) : [activeId]
      if (ids.length === 0 || ids.some(id => !id)) { setParcels([]); setTenants([]); setLoading(false); return }
      const [parcelLists, tenantLists] = await Promise.all([
        Promise.all(ids.map(id => getParcels(id))),
        Promise.all(ids.map(getTenants)),
      ])
      setParcels(parcelLists.flat() as Parcel[])
      setTenants((tenantLists.flat() as Tenant[]).filter(t => t.status === 'active'))
    } catch { toast.error('Failed to load parcels') }
    setLoading(false)
  }, [activeId, properties])

  useEffect(() => { load() }, [load])

  const filtered = useMemo(
    () => (filter === 'pending' ? parcels.filter(p => !p.collected_at) : parcels),
    [parcels, filter]
  )
  const pendingCount = parcels.filter(p => !p.collected_at).length

  function resetForm() {
    setForm({ property_id: '', courier_name: '', tracking_number: '', description: '', tenant_id: '', received_by: '' })
  }

  async function handleLog() {
    const propertyId = form.property_id || (activeId !== 'all' ? activeId : '')
    if (!propertyId) { toast.error('Select a property'); return }
    if (!form.tenant_id) { toast.error('Select which tenant this parcel is for'); return }
    setSaving(true)
    const input = {
      property_id: propertyId,
      tenant_id: form.tenant_id,
      courier_name: form.courier_name.trim() || undefined,
      tracking_number: form.tracking_number.trim() || undefined,
      description: form.description.trim() || undefined,
      received_by: form.received_by.trim() || undefined,
    }
    try {
      const parcel = await logParcel(input) as Parcel
      toast.success('Parcel logged')
      if (parcel.tenant?.auth_user_id) {
        sendPushNotification({
          user_ids: [parcel.tenant.auth_user_id],
          title: '📦 Parcel Arrived',
          body: `A parcel${form.courier_name.trim() ? ` from ${form.courier_name.trim()}` : ''} is waiting for you at the office.`,
          url: '/portal', tag: 'parcel',
        })
      }
      setModal(false)
      resetForm()
      load()
    } catch (e: any) {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        // The tenant notification is sent once this syncs (see OfflineQueueBadge's
        // executor) — there's no network to send it over right now anyway.
        queueOfflineAction('parcel_log', input, `Parcel for tenant`)
        toast.success('No connection — saved and will sync automatically once you\'re back online')
        setModal(false)
        resetForm()
      } else {
        toast.error(e.message || 'Failed to log parcel')
      }
    }
    setSaving(false)
  }

  async function handleCollect(id: string) {
    setActioningId(id)
    try {
      await collectParcel(id)
      toast.success('Marked as collected')
      load()
    } catch (e: any) { toast.error(e.message || 'Failed to update parcel') }
    setActioningId(null)
  }

  async function handleArchive(id: string) {
    setActioningId(id)
    try {
      await archiveParcel(id)
      toast.success('Archived — find it later in Archive & Restore')
      load()
    } catch (e: any) { toast.error(e.message || 'Failed to archive record') }
    setActioningId(null)
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this parcel record? This cannot be undone.')) return
    setActioningId(id)
    try {
      await deleteParcel(id)
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
          <h1 className="text-xl font-extrabold text-gray-900">Parcel Management</h1>
          <p className="text-sm text-gray-500">{pendingCount} awaiting collection</p>
        </div>
        <button onClick={() => setModal(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition">
          <Plus className="w-4 h-4" /> Log Parcel
        </button>
      </div>

      <div className="flex gap-1.5">
        <button onClick={() => setFilter('pending')}
          className={`px-3 py-2 rounded-xl text-sm font-semibold transition ${filter === 'pending' ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
          Awaiting Collection ({pendingCount})
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
          <Package className="w-8 h-8" />
          <div className="text-sm">{filter === 'pending' ? 'No parcels waiting for collection' : 'No parcel records yet'}</div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-50">
          {filtered.map(p => (
            <div key={p.id} className="flex items-start gap-3 px-5 py-4">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${p.collected_at ? 'bg-green-50 text-green-600' : 'bg-amber-50 text-amber-600'}`}>
                {p.collected_at ? <PackageCheck className="w-4 h-4" /> : <Package className="w-4 h-4" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-gray-800">
                  {p.tenant?.name ?? 'Unknown tenant'}{p.tenant?.room?.room_number ? ` · Room ${p.tenant.room.room_number}` : ''}
                </div>
                <div className="text-xs text-gray-400">
                  {p.courier_name || 'Courier not noted'}
                  {p.tracking_number ? ` · ${p.tracking_number}` : ''}
                  {p.description ? ` · ${p.description}` : ''}
                </div>
                <div className="flex items-center gap-1 text-xs text-gray-400 mt-1">
                  <Clock className="w-3 h-3" />
                  Received: {new Date(p.received_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  {p.collected_at && <span className="ml-1">· Collected: {new Date(p.collected_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {!p.collected_at && (
                  <button onClick={() => handleCollect(p.id)} disabled={actioningId === p.id}
                    className="flex items-center gap-1 px-3 py-1.5 bg-green-100 hover:bg-green-200 text-green-700 rounded-lg text-xs font-semibold transition disabled:opacity-50">
                    {actioningId === p.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <PackageCheck className="w-3.5 h-3.5" />} Collected
                  </button>
                )}
                <button onClick={() => handleArchive(p.id)} disabled={actioningId === p.id}
                  className="p-1.5 text-gray-300 hover:text-blue-500 transition disabled:opacity-50" title="Archive" aria-label="Archive">
                  <Archive className="w-4 h-4" />
                </button>
                <button onClick={() => handleDelete(p.id)} disabled={actioningId === p.id}
                  className="p-1.5 text-gray-300 hover:text-red-500 transition disabled:opacity-50" title="Delete permanently" aria-label="Delete permanently">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" role="dialog" aria-modal="true" aria-labelledby="parcel-modal-title">
          <div className="bg-white dark:bg-slate-900 rounded-t-2xl sm:rounded-2xl w-full max-w-md shadow-2xl pb-safe sm:pb-0 animate-owner-sheet-up sm:animate-owner-scale-in">
            <div className="px-6 py-4 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between">
              <h2 id="parcel-modal-title" className="text-base font-bold">Log Parcel</h2>
              <button onClick={() => { setModal(false); resetForm() }} aria-label="Close" className="text-gray-400 text-xl font-bold">×</button>
            </div>
            <div className="p-6 space-y-4">
              {activeId === 'all' && (
                <div>
                  <label className="text-xs font-semibold text-gray-600 block mb-1">Property *</label>
                  <select value={form.property_id} onChange={e => setForm(f => ({ ...f, property_id: e.target.value, tenant_id: '' }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-500">
                    <option value="">Select Property</option>
                    {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1">For Tenant *</label>
                <select value={form.tenant_id} onChange={e => setForm(f => ({ ...f, tenant_id: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-500">
                  <option value="">Select Tenant</option>
                  {tenantsForForm.map(t => <option key={t.id} value={t.id}>{t.name}{t.room?.room_number ? ` (Room ${t.room.room_number})` : ''}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1">Courier</label>
                <input value={form.courier_name} onChange={e => setForm(f => ({ ...f, courier_name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-500" placeholder="e.g. Amazon, Flipkart, Zomato" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1">Tracking Number</label>
                <input value={form.tracking_number} onChange={e => setForm(f => ({ ...f, tracking_number: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-500" placeholder="Optional" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1">Description</label>
                <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-500" placeholder="e.g. 1 small box" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1">Received By</label>
                <input value={form.received_by} onChange={e => setForm(f => ({ ...f, received_by: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-500" placeholder="Your name / security guard" />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-2">
              <button onClick={() => { setModal(false); resetForm() }} className="px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50 rounded-xl transition">Cancel</button>
              <button onClick={handleLog} disabled={saving}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition disabled:opacity-50 flex items-center gap-2">
                {saving && <Loader2 className="w-4 h-4 animate-spin" />} Log Parcel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
