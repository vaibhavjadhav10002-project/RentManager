'use client'
import { useEffect, useState, useCallback, useMemo } from 'react'
import { useProperty } from '@/components/shared/PropertyContext'
import { getWaitingList, addWaitingListEntry, updateWaitingListStatus, deleteWaitingListEntry, archiveWaitingListEntry, getRooms, getTenants } from '@/lib/supabase/queries'
import { formatINR } from '@/lib/utils'
import { toast } from 'sonner'
import { Plus, Users2, Trash2, Loader2, Phone, Archive } from 'lucide-react'
import type { WaitingListEntry, WaitingListStatus, Room, Tenant } from '@/types'

const STATUS_COLOR: Record<WaitingListStatus, string> = {
  waiting: 'bg-amber-50 text-amber-600',
  contacted: 'bg-blue-50 text-blue-600',
  converted: 'bg-green-50 text-green-600',
  expired: 'bg-gray-100 text-gray-500',
}
const SHARING_OPTIONS = ['Any', '1 Sharing', '2 Sharing', '3 Sharing', '4 Sharing']

export default function WaitingListPage() {
  const { active, activeId, properties } = useProperty()
  const [entries, setEntries] = useState<WaitingListEntry[]>([])
  const [rooms, setRooms] = useState<Room[]>([])
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<'active' | 'all'>('active')
  const [modal, setModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [actioningId, setActioningId] = useState<string | null>(null)
  const [form, setForm] = useState({ property_id: '', name: '', phone: '', preferred_sharing: 'Any', budget: '', notes: '' })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const ids = activeId === 'all' ? properties.map(p => p.id) : [activeId]
      if (ids.length === 0 || ids.some(id => !id)) { setEntries([]); setRooms([]); setTenants([]); setLoading(false); return }
      const [entryLists, roomLists, tenantLists] = await Promise.all([
        Promise.all(ids.map(id => getWaitingList(id))),
        Promise.all(ids.map(getRooms)),
        Promise.all(ids.map(getTenants)),
      ])
      setEntries(entryLists.flat() as WaitingListEntry[])
      setRooms(roomLists.flat() as Room[])
      setTenants((tenantLists.flat() as Tenant[]).filter(t => t.status === 'active'))
    } catch { toast.error('Failed to load waiting list') }
    setLoading(false)
  }, [activeId, properties])

  useEffect(() => { load() }, [load])

  // Vacancy reference — reuses the same occupied-vs-total-beds logic already used on
  // the main dashboard, just grouped by sharing type instead of totalled up.
  const vacanciesBySharing = useMemo(() => {
    const occupiedByRoom = new Map<string, number>()
    tenants.forEach(t => { if (t.room_id) occupiedByRoom.set(t.room_id, (occupiedByRoom.get(t.room_id) ?? 0) + 1) })
    const bySharing = new Map<string, number>()
    rooms.forEach(r => {
      const vacant = r.total_beds - (occupiedByRoom.get(r.id) ?? 0)
      if (vacant > 0) bySharing.set(r.sharing_type, (bySharing.get(r.sharing_type) ?? 0) + vacant)
    })
    return Array.from(bySharing.entries())
  }, [rooms, tenants])

  const filtered = useMemo(
    () => (statusFilter === 'active' ? entries.filter(e => e.status === 'waiting' || e.status === 'contacted') : entries),
    [entries, statusFilter]
  )

  function resetForm() {
    setForm({ property_id: '', name: '', phone: '', preferred_sharing: 'Any', budget: '', notes: '' })
  }

  async function handleAdd() {
    const propertyId = form.property_id || (activeId !== 'all' ? activeId : '')
    if (!propertyId) { toast.error('Select a property'); return }
    if (!form.name.trim() || !form.phone.trim()) { toast.error('Name and phone are required'); return }
    setSaving(true)
    try {
      await addWaitingListEntry({
        property_id: propertyId,
        name: form.name.trim(),
        phone: form.phone.trim(),
        preferred_sharing: form.preferred_sharing,
        budget: form.budget ? Number(form.budget) : undefined,
        notes: form.notes.trim() || undefined,
      })
      toast.success('Added to waiting list')
      setModal(false)
      resetForm()
      load()
    } catch (e: any) { toast.error(e.message || 'Failed to add entry') }
    setSaving(false)
  }

  async function handleStatusChange(id: string, status: WaitingListStatus) {
    setActioningId(id)
    try {
      await updateWaitingListStatus(id, status)
      toast.success(`Marked as ${status}`)
      load()
    } catch (e: any) { toast.error(e.message || 'Failed to update status') }
    setActioningId(null)
  }

  async function handleArchive(id: string) {
    setActioningId(id)
    try {
      await archiveWaitingListEntry(id)
      toast.success('Archived — find it later in Archive & Restore')
      load()
    } catch (e: any) { toast.error(e.message || 'Failed to archive entry') }
    setActioningId(null)
  }

  async function handleDelete(id: string) {
    if (!confirm('Remove this person from the waiting list? This cannot be undone.')) return
    setActioningId(id)
    try {
      await deleteWaitingListEntry(id)
      toast.success('Removed')
      load()
    } catch (e: any) { toast.error(e.message || 'Failed to remove entry') }
    setActioningId(null)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-extrabold text-gray-900">Waiting List</h1>
          <p className="text-sm text-gray-500">{activeId === 'all' ? 'All properties' : active?.name}</p>
        </div>
        <button onClick={() => setModal(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition">
          <Plus className="w-4 h-4" /> Add to List
        </button>
      </div>

      {/* Vacancy reference */}
      {vacanciesBySharing.length > 0 && (
        <div className="bg-blue-50 border border-blue-100 rounded-2xl px-4 py-3 flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-blue-700">Currently vacant:</span>
          {vacanciesBySharing.map(([type, count]) => (
            <span key={type} className="text-xs font-semibold px-2.5 py-1 bg-white rounded-full text-blue-700">{count} × {type}</span>
          ))}
        </div>
      )}

      <div className="flex gap-1.5">
        <button onClick={() => setStatusFilter('active')}
          className={`px-3 py-2 rounded-xl text-sm font-semibold transition ${statusFilter === 'active' ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
          Active
        </button>
        <button onClick={() => setStatusFilter('all')}
          className={`px-3 py-2 rounded-xl text-sm font-semibold transition ${statusFilter === 'all' ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
          All
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48 text-gray-400"><Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col items-center justify-center py-16 text-gray-400 gap-2">
          <Users2 className="w-8 h-8" />
          <div className="text-sm">Nobody on the waiting list yet</div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-50">
          {filtered.map(e => (
            <div key={e.id} className="flex items-start gap-3 px-5 py-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="text-sm font-semibold text-gray-800">{e.name}</div>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${STATUS_COLOR[e.status]}`}>{e.status}</span>
                </div>
                <div className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                  <Phone className="w-3 h-3" /> {e.phone}
                  {e.preferred_sharing && <span> · Wants {e.preferred_sharing}</span>}
                  {e.budget != null && <span> · Budget {formatINR(e.budget)}</span>}
                </div>
                {e.notes && <div className="text-xs text-gray-400 mt-1">{e.notes}</div>}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <select value={e.status} onChange={ev => handleStatusChange(e.id, ev.target.value as WaitingListStatus)} disabled={actioningId === e.id}
                  className="px-2 py-1.5 border border-gray-200 rounded-lg text-xs bg-white focus:outline-none focus:border-blue-500 disabled:opacity-50">
                  <option value="waiting">Waiting</option>
                  <option value="contacted">Contacted</option>
                  <option value="converted">Converted</option>
                  <option value="expired">Expired</option>
                </select>
                <button onClick={() => handleArchive(e.id)} disabled={actioningId === e.id}
                  className="p-1.5 text-gray-300 hover:text-blue-500 transition disabled:opacity-50" title="Archive" aria-label="Archive">
                  <Archive className="w-4 h-4" />
                </button>
                <button onClick={() => handleDelete(e.id)} disabled={actioningId === e.id}
                  className="p-1.5 text-gray-300 hover:text-red-500 transition disabled:opacity-50" title="Delete permanently" aria-label="Delete permanently">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" role="dialog" aria-modal="true" aria-labelledby="waitlist-modal-title">
          <div className="bg-white dark:bg-slate-900 rounded-t-2xl sm:rounded-2xl w-full max-w-md shadow-2xl pb-safe sm:pb-0 animate-owner-sheet-up sm:animate-owner-scale-in">
            <div className="px-6 py-4 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between">
              <h2 id="waitlist-modal-title" className="text-base font-bold">Add to Waiting List</h2>
              <button onClick={() => { setModal(false); resetForm() }} aria-label="Close" className="text-gray-400 text-xl font-bold">×</button>
            </div>
            <div className="p-6 space-y-4">
              {activeId === 'all' && (
                <div>
                  <label className="text-xs font-semibold text-gray-600 block mb-1">Property *</label>
                  <select value={form.property_id} onChange={e => setForm(f => ({ ...f, property_id: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-500">
                    <option value="">Select Property</option>
                    {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1">Name *</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-500" placeholder="e.g. Priya Sharma" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1">Phone *</label>
                <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-500" placeholder="10-digit mobile number" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1">Preferred Sharing</label>
                <select value={form.preferred_sharing} onChange={e => setForm(f => ({ ...f, preferred_sharing: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-500">
                  {SHARING_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1">Budget (₹/month)</label>
                <input type="number" value={form.budget} onChange={e => setForm(f => ({ ...f, budget: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-500" placeholder="Optional" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1">Notes</label>
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-500" placeholder="Optional" />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-2">
              <button onClick={() => { setModal(false); resetForm() }} className="px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50 rounded-xl transition">Cancel</button>
              <button onClick={handleAdd} disabled={saving}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition disabled:opacity-50 flex items-center gap-2">
                {saving && <Loader2 className="w-4 h-4 animate-spin" />} Add
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
