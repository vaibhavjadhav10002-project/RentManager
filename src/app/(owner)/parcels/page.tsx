'use client'
import { useEffect, useState, useCallback, useMemo } from 'react'
import { useProperty } from '@/components/shared/PropertyContext'
import { getParcels, logParcel, collectParcel, deleteParcel, archiveParcel, getTenants } from '@/lib/supabase/queries'
import { queueOfflineAction } from '@/lib/offlineQueue'
import { sendPushNotification } from '@/lib/push'
import { toast } from 'sonner'
import { Plus, Package, PackageCheck, Trash2, Loader2, Clock, Archive, ChevronRight, X } from 'lucide-react'
import { OwnerBadge, OwnerIconButton } from '@/components/owner/ui'
import type { Parcel, Tenant } from '@/types'
import { SkeletonList } from '@/components/shared/Skeleton'

export default function ParcelsPage() {
  const { activeId, properties } = useProperty()
  const [parcels, setParcels] = useState<Parcel[]>([])
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'pending' | 'all'>('pending')
  const [modal, setModal] = useState(false)
  const [parcelDetail, setParcelDetail] = useState<Parcel | null>(null)
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
    const prev = parcels
    setParcels(ps => ps.map(p => p.id === id ? { ...p, collected_at: new Date().toISOString() } : p))
    try {
      await collectParcel(id)
      toast.success('Marked as collected')
    } catch (e: any) { setParcels(prev); toast.error(e.message || 'Failed to update parcel') }
    setActioningId(null)
  }

  async function handleArchive(id: string) {
    setActioningId(id)
    const prev = parcels
    setParcels(ps => ps.filter(p => p.id !== id))
    try {
      await archiveParcel(id)
      toast.success('Archived — find it later in Archive & Restore')
    } catch (e: any) { setParcels(prev); toast.error(e.message || 'Failed to archive record') }
    setActioningId(null)
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this parcel record? This cannot be undone.')) return
    setActioningId(id)
    const prev = parcels
    setParcels(ps => ps.filter(p => p.id !== id))
    try {
      await deleteParcel(id)
      toast.success('Record deleted')
    } catch (e: any) { setParcels(prev); toast.error(e.message || 'Failed to delete record') }
    setActioningId(null)
  }

  const formPropertyId = form.property_id || (activeId !== 'all' ? activeId : '')
  const tenantsForForm = tenants.filter(t => !formPropertyId || t.property_id === formPropertyId)

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-extrabold text-owner-fg">Parcel Management</h1>
          <p className="text-sm text-owner-muted">{pendingCount} awaiting collection</p>
        </div>
        <button onClick={() => setModal(true)} className="flex items-center gap-2 px-4 py-2 bg-owner-primary hover:opacity-90 active:scale-[0.98] text-white rounded-owner-lg text-sm font-semibold transition">
          <Plus className="w-4 h-4" /> Log Parcel
        </button>
      </div>

      <div className="flex gap-1.5 flex-wrap">
        <button onClick={() => setFilter('pending')}
          className={`px-3 py-1.5 rounded-owner-full text-xs font-semibold transition active:scale-[0.97] ${filter === 'pending' ? 'bg-owner-primary text-owner-primary-fg' : 'bg-owner-surface-hover text-owner-muted hover:text-owner-fg'}`}>
          Awaiting Collection ({pendingCount})
        </button>
        <button onClick={() => setFilter('all')}
          className={`px-3 py-1.5 rounded-owner-full text-xs font-semibold transition active:scale-[0.97] ${filter === 'all' ? 'bg-owner-primary text-owner-primary-fg' : 'bg-owner-surface-hover text-owner-muted hover:text-owner-fg'}`}>
          All History
        </button>
      </div>

      {loading ? (
        <SkeletonList rows={5} />
      ) : filtered.length === 0 ? (
        <div className="bg-owner-surface rounded-owner-xl border border-owner-border shadow-owner-xs flex flex-col items-center justify-center py-16 text-owner-muted-subtle gap-2">
          <Package className="w-8 h-8" />
          <div className="text-sm">{filter === 'pending' ? 'No parcels waiting for collection' : 'No parcel records yet'}</div>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(p => (
            <button key={p.id} onClick={() => setParcelDetail(p)}
              className="w-full bg-owner-surface border border-owner-border rounded-owner-lg p-3.5 flex items-center gap-3 text-left transition active:scale-[0.99] active:bg-owner-surface-hover">
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${p.collected_at ? 'bg-gradient-to-br from-green-500 to-emerald-600' : 'bg-gradient-to-br from-amber-500 to-orange-500'} text-white`}>
                {p.collected_at ? <PackageCheck className="w-5 h-5" /> : <Package className="w-5 h-5" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-owner-fg truncate">
                  {p.tenant?.name ?? 'Unknown tenant'}{p.tenant?.room?.room_number ? ` · Room ${p.tenant.room.room_number}` : ''}
                </div>
                <div className="text-xs text-owner-muted-subtle truncate">
                  {p.courier_name || 'Courier not noted'}{p.description ? ` · ${p.description}` : ''}
                </div>
              </div>
              <OwnerBadge tone={p.collected_at ? 'success' : 'warning'} className="shrink-0">
                {p.collected_at ? 'Collected' : 'Pending'}
              </OwnerBadge>
              <ChevronRight className="w-4 h-4 text-owner-muted-subtle shrink-0" />
            </button>
          ))}
        </div>
      )}

      {/* Parcel Detail sheet */}
      {parcelDetail && (() => {
        const p = parcelDetail
        const isActing = actioningId === p.id
        return (
          <>
            <div onClick={() => setParcelDetail(null)} className="fixed inset-0 bg-black/40 z-50 transition-opacity" />
            <div className="fixed inset-x-0 bottom-0 z-50 bg-owner-surface-elevated rounded-t-3xl shadow-owner-lg max-h-[85vh] flex flex-col animate-owner-scale-in">
              <div className="flex justify-center pt-2.5 pb-1 shrink-0">
                <div className="h-1 w-9 rounded-full bg-owner-border-strong" />
              </div>
              <div className="px-5 pb-4 pt-1 flex items-center gap-3 border-b border-owner-border shrink-0">
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${p.collected_at ? 'bg-gradient-to-br from-green-500 to-emerald-600' : 'bg-gradient-to-br from-amber-500 to-orange-500'} text-white`}>
                  {p.collected_at ? <PackageCheck className="w-5 h-5" /> : <Package className="w-5 h-5" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] font-bold text-owner-muted uppercase tracking-wide">Parcel Details</div>
                  <div className="font-bold text-owner-fg truncate">{p.tenant?.name ?? 'Unknown tenant'}</div>
                </div>
                <OwnerBadge tone={p.collected_at ? 'success' : 'warning'} className="shrink-0">{p.collected_at ? 'Collected' : 'Pending'}</OwnerBadge>
                <OwnerIconButton aria-label="Close" variant="ghost" size="sm" onClick={() => setParcelDetail(null)}>
                  <X />
                </OwnerIconButton>
              </div>
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-owner-surface-hover rounded-xl p-3">
                    <div className="text-[10px] text-owner-muted-subtle uppercase font-bold">Room</div>
                    <div className="text-sm font-semibold text-owner-fg mt-0.5">{p.tenant?.room?.room_number ? `Room ${p.tenant.room.room_number}` : '—'}</div>
                  </div>
                  <div className="bg-owner-surface-hover rounded-xl p-3">
                    <div className="text-[10px] text-owner-muted-subtle uppercase font-bold">Courier</div>
                    <div className="text-sm font-semibold text-owner-fg mt-0.5">{p.courier_name || '—'}</div>
                  </div>
                  {p.tracking_number && (
                    <div className="bg-owner-surface-hover rounded-xl p-3 col-span-2">
                      <div className="text-[10px] text-owner-muted-subtle uppercase font-bold">Tracking Number</div>
                      <div className="text-sm font-mono font-semibold text-owner-fg mt-0.5">{p.tracking_number}</div>
                    </div>
                  )}
                  {p.description && (
                    <div className="bg-owner-surface-hover rounded-xl p-3 col-span-2">
                      <div className="text-[10px] text-owner-muted-subtle uppercase font-bold">Description</div>
                      <div className="text-sm font-semibold text-owner-fg mt-0.5">{p.description}</div>
                    </div>
                  )}
                  <div className="bg-owner-surface-hover rounded-xl p-3 col-span-2">
                    <div className="text-[10px] text-owner-muted-subtle uppercase font-bold flex items-center gap-1"><Clock className="w-3 h-3" /> Received / Collected</div>
                    <div className="text-sm font-semibold text-owner-fg mt-0.5">
                      Received: {new Date(p.received_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </div>
                    {p.collected_at && (
                      <div className="text-sm font-semibold text-owner-fg mt-0.5">
                        Collected: {new Date(p.collected_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="px-5 py-4 border-t border-owner-border shrink-0 space-y-2.5" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
                {!p.collected_at && (
                  <button onClick={async () => { await handleCollect(p.id); setParcelDetail(null) }} disabled={isActing}
                    className="w-full h-12 flex items-center justify-center gap-1.5 bg-owner-success hover:opacity-90 active:scale-[0.98] text-white rounded-2xl text-sm font-bold transition disabled:opacity-50">
                    {isActing ? <Loader2 className="w-4 h-4 animate-spin" /> : <PackageCheck className="w-4 h-4" />} Mark Collected
                  </button>
                )}
                <div className="flex gap-2.5">
                  <button onClick={async () => { await handleArchive(p.id); setParcelDetail(null) }} disabled={isActing}
                    className="flex-1 h-11 flex items-center justify-center gap-1.5 bg-owner-surface-hover hover:opacity-80 active:scale-[0.98] text-owner-fg rounded-2xl text-xs font-bold transition disabled:opacity-50">
                    <Archive className="w-3.5 h-3.5" /> Archive
                  </button>
                  <button onClick={async () => { await handleDelete(p.id); setParcelDetail(null) }} disabled={isActing}
                    className="flex-1 h-11 flex items-center justify-center gap-1.5 bg-owner-danger-subtle hover:opacity-80 active:scale-[0.98] text-owner-danger rounded-2xl text-xs font-bold transition disabled:opacity-50">
                    <Trash2 className="w-3.5 h-3.5" /> Delete
                  </button>
                </div>
              </div>
            </div>
          </>
        )
      })()}

      {modal && (
        <>
          <div onClick={() => { setModal(false); resetForm() }} className="fixed inset-0 bg-black/40 z-50 transition-opacity" />
          <div className="fixed inset-x-0 bottom-0 z-50 bg-owner-surface-elevated rounded-t-3xl shadow-owner-lg max-h-[85vh] flex flex-col animate-owner-scale-in" role="dialog" aria-modal="true" aria-labelledby="parcel-modal-title">
            <div className="flex justify-center pt-2.5 pb-1 shrink-0">
              <div className="h-1 w-9 rounded-full bg-owner-border-strong" />
            </div>
            <div className="px-5 pb-4 pt-1 flex items-center gap-3 border-b border-owner-border shrink-0">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 text-white flex items-center justify-center shrink-0">
                <Package className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[11px] font-bold text-owner-muted uppercase tracking-wide">New Entry</div>
                <div id="parcel-modal-title" className="font-bold text-owner-fg">Log Parcel</div>
              </div>
              <OwnerIconButton aria-label="Close" variant="ghost" size="sm" onClick={() => { setModal(false); resetForm() }}>
                <X />
              </OwnerIconButton>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {activeId === 'all' && (
                <div>
                  <label htmlFor="parcel-property" className="text-xs font-semibold text-owner-muted block mb-1">Property *</label>
                  <select id="parcel-property" value={form.property_id} onChange={e => setForm(f => ({ ...f, property_id: e.target.value, tenant_id: '' }))}
                    className="w-full px-3 py-2 border border-owner-border rounded-owner-lg text-sm bg-owner-surface text-owner-fg focus:outline-none focus:border-owner-primary">
                    <option value="">Select Property</option>
                    {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label htmlFor="parcel-tenant" className="text-xs font-semibold text-owner-muted block mb-1">For Tenant *</label>
                <select id="parcel-tenant" value={form.tenant_id} onChange={e => setForm(f => ({ ...f, tenant_id: e.target.value }))}
                  className="w-full px-3 py-2 border border-owner-border rounded-owner-lg text-sm bg-owner-surface text-owner-fg focus:outline-none focus:border-owner-primary">
                  <option value="">Select Tenant</option>
                  {tenantsForForm.map(t => <option key={t.id} value={t.id}>{t.name}{t.room?.room_number ? ` (Room ${t.room.room_number})` : ''}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="parcel-courier" className="text-xs font-semibold text-owner-muted block mb-1">Courier</label>
                <input id="parcel-courier" value={form.courier_name} onChange={e => setForm(f => ({ ...f, courier_name: e.target.value }))}
                  className="w-full px-3 py-2 border border-owner-border rounded-owner-lg text-sm bg-owner-surface text-owner-fg focus:outline-none focus:border-owner-primary" placeholder="e.g. Amazon, Flipkart, Zomato" />
              </div>
              <div>
                <label htmlFor="parcel-tracking" className="text-xs font-semibold text-owner-muted block mb-1">Tracking Number</label>
                <input id="parcel-tracking" value={form.tracking_number} onChange={e => setForm(f => ({ ...f, tracking_number: e.target.value }))}
                  className="w-full px-3 py-2 border border-owner-border rounded-owner-lg text-sm bg-owner-surface text-owner-fg focus:outline-none focus:border-owner-primary" placeholder="Optional" />
              </div>
              <div>
                <label htmlFor="parcel-description" className="text-xs font-semibold text-owner-muted block mb-1">Description</label>
                <input id="parcel-description" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  className="w-full px-3 py-2 border border-owner-border rounded-owner-lg text-sm bg-owner-surface text-owner-fg focus:outline-none focus:border-owner-primary" placeholder="e.g. 1 small box" />
              </div>
              <div>
                <label htmlFor="parcel-received-by" className="text-xs font-semibold text-owner-muted block mb-1">Received By</label>
                <input id="parcel-received-by" value={form.received_by} onChange={e => setForm(f => ({ ...f, received_by: e.target.value }))}
                  className="w-full px-3 py-2 border border-owner-border rounded-owner-lg text-sm bg-owner-surface text-owner-fg focus:outline-none focus:border-owner-primary" placeholder="Your name / security guard" />
              </div>
            </div>
            <div className="px-5 py-4 border-t border-owner-border shrink-0 flex gap-2.5" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
              <button onClick={() => { setModal(false); resetForm() }}
                className="flex-1 h-12 flex items-center justify-center gap-1.5 bg-owner-surface-hover hover:opacity-80 active:scale-[0.98] text-owner-fg rounded-2xl text-sm font-bold transition">
                Cancel
              </button>
              <button onClick={handleLog} disabled={saving}
                className="flex-1 h-12 flex items-center justify-center gap-1.5 bg-owner-primary hover:opacity-90 active:scale-[0.98] text-white rounded-2xl text-sm font-bold transition disabled:opacity-50">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Log Parcel
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
