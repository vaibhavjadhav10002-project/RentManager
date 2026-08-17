'use client'
import { useEffect, useState, useCallback, useMemo } from 'react'
import { useProperty } from '@/components/shared/PropertyContext'
import { getTenants, getRooms, getRoomChanges, changeTenantRoom } from '@/lib/supabase/queries'
import { toast } from 'sonner'
import { ArrowRight, Repeat, Loader2, History } from 'lucide-react'
import type { Tenant, Room, RoomChange } from '@/types'
import { SkeletonList } from '@/components/shared/Skeleton'
import { usePullToRefreshHandler } from '@/lib/native/pullToRefresh'

export default function RoomChangePage() {
  const { active, activeId, properties } = useProperty()
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [rooms, setRooms] = useState<Room[]>([])
  const [history, setHistory] = useState<RoomChange[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [tenantId, setTenantId] = useState('')
  const [toRoomId, setToRoomId] = useState('')
  const [reason, setReason] = useState('')
  const [changedBy, setChangedBy] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const ids = activeId === 'all' ? properties.map(p => p.id) : [activeId]
      if (ids.length === 0 || ids.some(id => !id)) { setTenants([]); setRooms([]); setHistory([]); setLoading(false); return }
      const [tenantLists, roomLists, historyLists] = await Promise.all([
        Promise.all(ids.map(getTenants)),
        Promise.all(ids.map(getRooms)),
        Promise.all(ids.map(getRoomChanges)),
      ])
      setTenants((tenantLists.flat() as Tenant[]).filter(t => t.status === 'active'))
      setRooms(roomLists.flat() as Room[])
      setHistory(historyLists.flat() as RoomChange[])
    } catch { toast.error('Failed to load room change data') }
    setLoading(false)
  }, [activeId, properties])

  useEffect(() => { load() }, [load])
  usePullToRefreshHandler(load)

  const selectedTenant = tenants.find(t => t.id === tenantId)

  // Vacancy per room, excluding the selected tenant's own current room (they don't
  // count as "occupying" a slot they're about to leave, once they move).
  const occupiedByRoom = useMemo(() => {
    const map = new Map<string, number>()
    tenants.forEach(t => { if (t.room_id) map.set(t.room_id, (map.get(t.room_id) ?? 0) + 1) })
    return map
  }, [tenants])

  const eligibleRooms = useMemo(() => {
    const scopedRooms = selectedTenant ? rooms.filter(r => r.property_id === selectedTenant.property_id) : []
    return scopedRooms
      .filter(r => r.id !== selectedTenant?.room_id)
      .map(r => ({ room: r, vacant: r.total_beds - (occupiedByRoom.get(r.id) ?? 0) }))
      .filter(r => r.vacant > 0)
  }, [rooms, selectedTenant, occupiedByRoom])

  function reset() {
    setTenantId(''); setToRoomId(''); setReason(''); setChangedBy('')
  }

  async function handleMove() {
    if (!selectedTenant) { toast.error('Select a tenant'); return }
    if (!toRoomId) { toast.error('Select the new room'); return }
    setSaving(true)
    try {
      await changeTenantRoom({
        property_id: selectedTenant.property_id,
        tenant_id: selectedTenant.id,
        from_room_id: selectedTenant.room_id,
        to_room_id: toRoomId,
        reason: reason.trim() || undefined,
        changed_by: changedBy.trim() || undefined,
      })
      toast.success(`${selectedTenant.name} moved to the new room`)
      reset()
      load()
    } catch (e: any) { toast.error(e.message || 'Failed to change room') }
    setSaving(false)
  }

  if (loading) return (
    <SkeletonList rows={4} />
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-extrabold text-owner-fg">Room Change Workflow</h1>
        <p className="text-sm text-owner-muted">{activeId === 'all' ? 'All properties' : active?.name}</p>
      </div>

      {/* Move form */}
      <div className="bg-owner-surface rounded-2xl border border-owner-border shadow-sm p-5 space-y-4">
        <div>
          <label className="text-xs font-semibold text-owner-muted block mb-1">Tenant *</label>
          <select value={tenantId} onChange={e => { setTenantId(e.target.value); setToRoomId('') }}
            className="w-full px-3 py-2 border border-owner-border rounded-xl text-sm focus:outline-none focus:border-owner-primary">
            <option value="">Select tenant</option>
            {tenants.map(t => (
              <option key={t.id} value={t.id}>{t.name}{t.room?.room_number ? ` — currently Room ${t.room.room_number}` : ' — unassigned'}</option>
            ))}
          </select>
        </div>

        {selectedTenant && (
          <div className="flex items-center gap-3 text-sm bg-owner-surface-hover rounded-xl px-4 py-3">
            <span className="font-semibold text-owner-fg">{selectedTenant.room?.room_number ? `Room ${selectedTenant.room.room_number}` : 'Unassigned'}</span>
            <ArrowRight className="w-4 h-4 text-owner-muted-subtle" />
            <span className="font-semibold text-owner-primary">{toRoomId ? `Room ${rooms.find(r => r.id === toRoomId)?.room_number}` : 'Select new room →'}</span>
          </div>
        )}

        <div>
          <label className="text-xs font-semibold text-owner-muted block mb-1">New Room *</label>
          <select value={toRoomId} onChange={e => setToRoomId(e.target.value)} disabled={!selectedTenant}
            className="w-full px-3 py-2 border border-owner-border rounded-xl text-sm focus:outline-none focus:border-owner-primary disabled:opacity-50">
            <option value="">{selectedTenant ? 'Select a room with a vacancy' : 'Select a tenant first'}</option>
            {eligibleRooms.map(({ room, vacant }) => (
              <option key={room.id} value={room.id}>Room {room.room_number} · {room.sharing_type} · {vacant} vacant</option>
            ))}
          </select>
          {selectedTenant && eligibleRooms.length === 0 && (
            <p className="text-xs text-amber-600 mt-1">No other rooms currently have a vacancy.</p>
          )}
        </div>

        <div>
          <label className="text-xs font-semibold text-owner-muted block mb-1">Reason</label>
          <input value={reason} onChange={e => setReason(e.target.value)}
            className="w-full px-3 py-2 border border-owner-border rounded-xl text-sm focus:outline-none focus:border-owner-primary" placeholder="e.g. Tenant requested a quieter room" />
        </div>
        <div>
          <label className="text-xs font-semibold text-owner-muted block mb-1">Changed By</label>
          <input value={changedBy} onChange={e => setChangedBy(e.target.value)}
            className="w-full px-3 py-2 border border-owner-border rounded-xl text-sm focus:outline-none focus:border-owner-primary" placeholder="Your name" />
        </div>

        <p className="text-xs text-owner-muted-subtle">
          This updates the tenant&rsquo;s assigned room only. Rent and deposit amounts are unaffected — adjust those separately if the new room&rsquo;s rate differs.
        </p>

        <button onClick={handleMove} disabled={saving || !selectedTenant || !toRoomId}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-owner-primary hover:bg-owner-primary-hover text-white rounded-xl text-sm font-semibold transition disabled:opacity-50">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Repeat className="w-4 h-4" />} Move Tenant
        </button>
      </div>

      {/* History */}
      <div className="bg-owner-surface rounded-2xl border border-owner-border shadow-sm overflow-hidden">
        <div className="px-5 py-4 font-bold text-sm text-owner-fg border-b border-owner-border flex items-center gap-2">
          <History className="w-4 h-4" /> Change History
        </div>
        {history.length === 0 ? (
          <div className="text-center py-10 text-sm text-owner-muted-subtle">No room changes recorded yet</div>
        ) : (
          <div className="divide-y divide-owner-border">
            {history.map(h => (
              <div key={h.id} className="px-5 py-3 text-sm">
                <div className="font-semibold text-owner-fg">{h.tenant?.name ?? 'Former tenant'}</div>
                <div className="text-xs text-owner-muted flex items-center gap-1.5 mt-0.5">
                  <span>{h.from_room?.room_number ? `Room ${h.from_room.room_number}` : 'Unassigned'}</span>
                  <ArrowRight className="w-3 h-3" />
                  <span>{h.to_room?.room_number ? `Room ${h.to_room.room_number}` : 'Unassigned'}</span>
                  <span>· {new Date(h.changed_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                </div>
                {h.reason && <div className="text-xs text-owner-muted-subtle mt-1">{h.reason}</div>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
