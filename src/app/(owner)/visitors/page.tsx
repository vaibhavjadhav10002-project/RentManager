'use client'
import { useEffect, useState, useCallback, useMemo } from 'react'
import { useProperty } from '@/components/shared/PropertyContext'
import { getVisitors, checkInVisitor, checkOutVisitor, deleteVisitor, archiveVisitor, getTenants } from '@/lib/supabase/queries'
import { queueOfflineAction } from '@/lib/offlineQueue'
import { toast } from 'sonner'
import { Plus, LogOut, Trash2, Loader2, UserCheck, Clock, Archive, ChevronRight, X } from 'lucide-react'
import { OwnerBadge, OwnerIconButton } from '@/components/owner/ui'
import type { Visitor, Tenant } from '@/types'

export default function VisitorsPage() {
  const { activeId, properties } = useProperty()
  const [visitors, setVisitors] = useState<Visitor[]>([])
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'in' | 'all'>('in')
  const [modal, setModal] = useState(false)
  const [visitorDetail, setVisitorDetail] = useState<Visitor | null>(null)
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
          <h1 className="text-xl font-extrabold text-owner-fg">Visitor Management</h1>
          <p className="text-sm text-owner-muted">{currentlyInCount} currently on the property</p>
        </div>
        <button onClick={() => setModal(true)} className="flex items-center gap-2 px-4 py-2 bg-owner-primary hover:opacity-90 active:scale-[0.98] text-white rounded-owner-lg text-sm font-semibold transition">
          <Plus className="w-4 h-4" /> Log Visitor
        </button>
      </div>

      <div className="flex gap-1.5 flex-wrap">
        <button onClick={() => setFilter('in')}
          className={`px-3 py-1.5 rounded-owner-full text-xs font-semibold transition active:scale-[0.97] ${filter === 'in' ? 'bg-owner-primary text-owner-primary-fg' : 'bg-owner-surface-hover text-owner-muted hover:text-owner-fg'}`}>
          Currently In ({currentlyInCount})
        </button>
        <button onClick={() => setFilter('all')}
          className={`px-3 py-1.5 rounded-owner-full text-xs font-semibold transition active:scale-[0.97] ${filter === 'all' ? 'bg-owner-primary text-owner-primary-fg' : 'bg-owner-surface-hover text-owner-muted hover:text-owner-fg'}`}>
          All History
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48 text-owner-muted"><Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="bg-owner-surface rounded-owner-xl border border-owner-border shadow-owner-xs flex flex-col items-center justify-center py-16 text-owner-muted-subtle gap-2">
          <UserCheck className="w-8 h-8" />
          <div className="text-sm">{filter === 'in' ? 'No one is currently checked in' : 'No visitor records yet'}</div>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(v => (
            <button key={v.id} onClick={() => setVisitorDetail(v)}
              className="w-full bg-owner-surface border border-owner-border rounded-owner-lg p-3.5 flex items-center gap-3 text-left transition active:scale-[0.99] active:bg-owner-surface-hover">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center shrink-0">
                <UserCheck className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-owner-fg truncate">{v.visitor_name}</div>
                <div className="text-xs text-owner-muted-subtle truncate">
                  {v.purpose || 'No purpose noted'}{v.tenant?.name ? ` · Visiting ${v.tenant.name}` : ''}
                </div>
              </div>
              <OwnerBadge tone={v.check_out_time ? 'neutral' : 'success'} className="shrink-0">
                {v.check_out_time ? 'Checked Out' : 'In'}
              </OwnerBadge>
              <ChevronRight className="w-4 h-4 text-owner-muted-subtle shrink-0" />
            </button>
          ))}
        </div>
      )}

      {/* Visitor Detail sheet */}
      {visitorDetail && (() => {
        const v = visitorDetail
        const isActing = actioningId === v.id
        return (
          <>
            <div onClick={() => setVisitorDetail(null)} className="fixed inset-0 bg-black/40 z-50 transition-opacity" />
            <div className="fixed inset-x-0 bottom-0 z-50 bg-owner-surface-elevated rounded-t-3xl shadow-owner-lg max-h-[85vh] flex flex-col animate-owner-scale-in">
              <div className="flex justify-center pt-2.5 pb-1 shrink-0">
                <div className="h-1 w-9 rounded-full bg-owner-border-strong" />
              </div>
              <div className="px-5 pb-4 pt-1 flex items-center gap-3 border-b border-owner-border shrink-0">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center shrink-0">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] font-bold text-owner-muted uppercase tracking-wide">Visitor Details</div>
                  <div className="font-bold text-owner-fg truncate">{v.visitor_name}</div>
                </div>
                <OwnerBadge tone={v.check_out_time ? 'neutral' : 'success'} className="shrink-0">
                  {v.check_out_time ? 'Checked Out' : 'In'}
                </OwnerBadge>
                <OwnerIconButton aria-label="Close" variant="ghost" size="sm" onClick={() => setVisitorDetail(null)}>
                  <X />
                </OwnerIconButton>
              </div>
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-owner-surface-hover rounded-xl p-3">
                    <div className="text-[10px] text-owner-muted-subtle uppercase font-bold">Phone</div>
                    <div className="text-sm font-semibold text-owner-fg mt-0.5">{v.visitor_phone || '—'}</div>
                  </div>
                  <div className="bg-owner-surface-hover rounded-xl p-3">
                    <div className="text-[10px] text-owner-muted-subtle uppercase font-bold">Visiting</div>
                    <div className="text-sm font-semibold text-owner-fg mt-0.5">{v.tenant?.name ?? 'Not specified'}</div>
                  </div>
                  <div className="bg-owner-surface-hover rounded-xl p-3 col-span-2">
                    <div className="text-[10px] text-owner-muted-subtle uppercase font-bold">Purpose</div>
                    <div className="text-sm font-semibold text-owner-fg mt-0.5">{v.purpose || 'No purpose noted'}</div>
                  </div>
                  <div className="bg-owner-surface-hover rounded-xl p-3 col-span-2">
                    <div className="text-[10px] text-owner-muted-subtle uppercase font-bold flex items-center gap-1"><Clock className="w-3 h-3" /> Check-In / Out</div>
                    <div className="text-sm font-semibold text-owner-fg mt-0.5">
                      In: {new Date(v.check_in_time).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </div>
                    {v.check_out_time && (
                      <div className="text-sm font-semibold text-owner-fg mt-0.5">
                        Out: {new Date(v.check_out_time).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="px-5 py-4 border-t border-owner-border shrink-0 space-y-2.5" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
                {!v.check_out_time && (
                  <button onClick={async () => { await handleCheckOut(v.id); setVisitorDetail(null) }} disabled={isActing}
                    className="w-full h-12 flex items-center justify-center gap-1.5 bg-owner-primary hover:opacity-90 active:scale-[0.98] text-white rounded-2xl text-sm font-bold transition disabled:opacity-50">
                    {isActing ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />} Check Out
                  </button>
                )}
                <div className="flex gap-2.5">
                  <button onClick={async () => { await handleArchive(v.id); setVisitorDetail(null) }} disabled={isActing}
                    className="flex-1 h-11 flex items-center justify-center gap-1.5 bg-owner-surface-hover hover:opacity-80 active:scale-[0.98] text-owner-fg rounded-2xl text-xs font-bold transition disabled:opacity-50">
                    <Archive className="w-3.5 h-3.5" /> Archive
                  </button>
                  <button onClick={async () => { await handleDelete(v.id); setVisitorDetail(null) }} disabled={isActing}
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
          <div className="fixed inset-x-0 bottom-0 z-50 bg-owner-surface-elevated rounded-t-3xl shadow-owner-lg max-h-[85vh] flex flex-col animate-owner-scale-in" role="dialog" aria-modal="true" aria-labelledby="visitor-modal-title">
            <div className="flex justify-center pt-2.5 pb-1 shrink-0">
              <div className="h-1 w-9 rounded-full bg-owner-border-strong" />
            </div>
            <div className="px-5 pb-4 pt-1 flex items-center gap-3 border-b border-owner-border shrink-0">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center shrink-0">
                <UserCheck className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[11px] font-bold text-owner-muted uppercase tracking-wide">New Entry</div>
                <div id="visitor-modal-title" className="font-bold text-owner-fg">Log Visitor</div>
              </div>
              <OwnerIconButton aria-label="Close" variant="ghost" size="sm" onClick={() => { setModal(false); resetForm() }}>
                <X />
              </OwnerIconButton>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {activeId === 'all' && (
                <div>
                  <label htmlFor="visitor-property" className="text-xs font-semibold text-owner-muted block mb-1">Property *</label>
                  <select id="visitor-property" value={form.property_id} onChange={e => setForm(f => ({ ...f, property_id: e.target.value, tenant_id: '' }))}
                    className="w-full px-3 py-2 border border-owner-border rounded-owner-lg text-sm bg-owner-surface text-owner-fg focus:outline-none focus:border-owner-primary">
                    <option value="">Select Property</option>
                    {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label htmlFor="visitor-name" className="text-xs font-semibold text-owner-muted block mb-1">Visitor Name *</label>
                <input id="visitor-name" value={form.visitor_name} onChange={e => setForm(f => ({ ...f, visitor_name: e.target.value }))}
                  className="w-full px-3 py-2 border border-owner-border rounded-owner-lg text-sm bg-owner-surface text-owner-fg focus:outline-none focus:border-owner-primary" placeholder="e.g. Ramesh Kumar" />
              </div>
              <div>
                <label htmlFor="visitor-phone" className="text-xs font-semibold text-owner-muted block mb-1">Phone</label>
                <input id="visitor-phone" value={form.visitor_phone} onChange={e => setForm(f => ({ ...f, visitor_phone: e.target.value }))}
                  className="w-full px-3 py-2 border border-owner-border rounded-owner-lg text-sm bg-owner-surface text-owner-fg focus:outline-none focus:border-owner-primary" placeholder="Optional" />
              </div>
              <div>
                <label htmlFor="visitor-tenant" className="text-xs font-semibold text-owner-muted block mb-1">Visiting Tenant</label>
                <select id="visitor-tenant" value={form.tenant_id} onChange={e => setForm(f => ({ ...f, tenant_id: e.target.value }))}
                  className="w-full px-3 py-2 border border-owner-border rounded-owner-lg text-sm bg-owner-surface text-owner-fg focus:outline-none focus:border-owner-primary">
                  <option value="">Not specified</option>
                  {tenantsForForm.map(t => <option key={t.id} value={t.id}>{t.name}{t.room?.room_number ? ` (Room ${t.room.room_number})` : ''}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="visitor-purpose" className="text-xs font-semibold text-owner-muted block mb-1">Purpose</label>
                <input id="visitor-purpose" value={form.purpose} onChange={e => setForm(f => ({ ...f, purpose: e.target.value }))}
                  className="w-full px-3 py-2 border border-owner-border rounded-owner-lg text-sm bg-owner-surface text-owner-fg focus:outline-none focus:border-owner-primary" placeholder="e.g. Family visit, delivery, maintenance" />
              </div>
              <div>
                <label htmlFor="visitor-logged-by" className="text-xs font-semibold text-owner-muted block mb-1">Logged By</label>
                <input id="visitor-logged-by" value={form.logged_by} onChange={e => setForm(f => ({ ...f, logged_by: e.target.value }))}
                  className="w-full px-3 py-2 border border-owner-border rounded-owner-lg text-sm bg-owner-surface text-owner-fg focus:outline-none focus:border-owner-primary" placeholder="Your name / security guard" />
              </div>
            </div>
            <div className="px-5 py-4 border-t border-owner-border shrink-0 flex gap-2.5" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
              <button onClick={() => { setModal(false); resetForm() }}
                className="flex-1 h-12 flex items-center justify-center gap-1.5 bg-owner-surface-hover hover:opacity-80 active:scale-[0.98] text-owner-fg rounded-2xl text-sm font-bold transition">
                Cancel
              </button>
              <button onClick={handleCheckIn} disabled={saving}
                className="flex-1 h-12 flex items-center justify-center gap-1.5 bg-owner-primary hover:opacity-90 active:scale-[0.98] text-white rounded-2xl text-sm font-bold transition disabled:opacity-50">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Check In
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
