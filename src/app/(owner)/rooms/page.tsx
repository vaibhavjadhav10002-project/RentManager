'use client'
import { useEffect, useState, useCallback } from 'react'
import { useProperty } from '@/components/shared/PropertyContext'
import { getRooms, addRoom, updateRoom, deleteRoom } from '@/lib/supabase/queries'
import { formatINR } from '@/lib/utils'
import { toast } from 'sonner'
import { Plus, Trash2, Pencil, BedDouble, X, ChevronRight } from 'lucide-react'
import type { Room } from '@/types'
import {
  OwnerButton, OwnerIconButton, OwnerBadge, OwnerEmptyState,
  OwnerTable, OwnerTableHead, OwnerTableBody, OwnerTableRow, OwnerTableHeadCell, OwnerTableCell,
  OwnerInput, OwnerSelect,
} from '@/components/owner/ui'

// NOTE: this schema has no separate Bed entity — bed count lives on
// Room.total_beds, and individual bed assignment lives on Tenant.bed_label.
// The `status` calculation below (`vacant` only when total_beds === 0,
// `partial` otherwise) is exactly what the app already computed before
// this redesign — it doesn't account for actual tenant occupancy per
// room, which would need a new query joining tenants to rooms. That's
// real business logic, not a UI concern, so it's left untouched here
// rather than "fixed" — flagged in the changelog instead.
const STATUS_LABEL: Record<string, string> = { full: 'Full', partial: 'Occupied', vacant: 'Vacant' }
const STATUS_TONE: Record<string, 'danger' | 'warning' | 'success'> = { full: 'danger', partial: 'warning', vacant: 'success' }

export default function RoomsPage() {
  const { activeId, properties } = useProperty()
  const [rooms, setRooms] = useState<Room[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [roomDetail, setRoomDetail] = useState<Room | null>(null)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({
    property_id: '', room_number: '', floor: '1',
    sharing_type: '2 Sharing', total_beds: '2', monthly_rent: '', notes: '',
  })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const ids = activeId === 'all' ? properties.map(p => p.id) : [activeId]
      const data = (await Promise.all(ids.map(getRooms))).flat()
      setRooms(data)
    } catch { toast.error('Failed to load rooms') }
    setLoading(false)
  }, [activeId, properties])

  useEffect(() => { load() }, [load])

  function openEdit(room: Room) {
    setEditingId(room.id)
    setForm({
      property_id: room.property_id, room_number: room.room_number, floor: String(room.floor),
      sharing_type: room.sharing_type, total_beds: String(room.total_beds),
      monthly_rent: String(room.monthly_rent), notes: room.notes ?? '',
    })
    setModal(true)
  }

  function closeModal() {
    setModal(false)
    setEditingId(null)
    setForm({ property_id: '', room_number: '', floor: '1', sharing_type: '2 Sharing', total_beds: '2', monthly_rent: '', notes: '' })
  }

  async function handleSave() {
    const propertyId = form.property_id || (activeId !== 'all' ? activeId : '')
    if (!propertyId) { toast.error('Select a property'); return }
    if (!form.room_number.trim()) { toast.error('Room number is required'); return }
    if (!form.monthly_rent || Number(form.monthly_rent) <= 0) { toast.error('Enter a valid monthly rent'); return }
    if (!form.total_beds || Number(form.total_beds) <= 0) { toast.error('Total beds must be at least 1'); return }
    if (form.floor && Number(form.floor) < 0) { toast.error('Floor cannot be negative'); return }
    setSaving(true)
    try {
      const payload = {
        property_id: propertyId,
        room_number: form.room_number.trim(),
        floor: Number(form.floor) || 0,
        sharing_type: form.sharing_type as Room['sharing_type'],
        total_beds: Number(form.total_beds),
        monthly_rent: Number(form.monthly_rent),
        notes: form.notes,
      }
      if (editingId) {
        await updateRoom(editingId, payload)
        toast.success('Room updated!')
      } else {
        await addRoom(payload)
        toast.success('Room added!')
      }
      closeModal()
      load()
    } catch (e: any) {
      if (e.code === '23505') toast.error('A room with this number already exists in this property')
      else toast.error(e.message)
    }
    setSaving(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this room?')) return
    try { await deleteRoom(id); toast.success('Room deleted'); load() }
    catch (e: any) { toast.error(e.message) }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-extrabold text-owner-fg">Rooms &amp; Beds</h1>
          <p className="text-sm text-owner-muted mt-1">{rooms.length} rooms · {rooms.reduce((s, r) => s + r.total_beds, 0)} total beds</p>
        </div>
        <OwnerButton onClick={() => setModal(true)} icon={<Plus className="w-4 h-4" />}>
          Add Room
        </OwnerButton>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-12 rounded-owner-lg bg-owner-surface-hover animate-pulse" />)}
        </div>
      ) : rooms.length === 0 ? (
        <OwnerEmptyState
          icon={BedDouble}
          title="No rooms yet"
          subtitle='Click "Add Room" to get started.'
          action={<OwnerButton onClick={() => setModal(true)} icon={<Plus className="w-4 h-4" />}>Add Room</OwnerButton>}
        />
      ) : (
        <>
          {/* Mobile: stacked card list, no horizontal scroll */}
          <div className="sm:hidden space-y-2">
            {rooms.map(room => {
              const status = room.total_beds === 0 ? 'vacant' : 'partial'
              return (
                <button key={room.id} onClick={() => setRoomDetail(room)}
                  className="w-full bg-owner-surface border border-owner-border rounded-owner-lg p-3.5 flex items-center gap-3 text-left transition active:scale-[0.99] active:bg-owner-surface-hover">
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center shrink-0">
                    <BedDouble className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-owner-fg truncate">{room.room_number}</div>
                    <div className="text-xs text-owner-muted-subtle truncate">{room.sharing_type} · Floor {room.floor} · {formatINR(room.monthly_rent)}/mo</div>
                  </div>
                  <OwnerBadge tone={STATUS_TONE[status]} className="shrink-0">{STATUS_LABEL[status]}</OwnerBadge>
                  <ChevronRight className="w-4 h-4 text-owner-muted-subtle shrink-0" />
                </button>
              )
            })}
          </div>
          {/* Desktop/tablet: full table */}
          <div className="hidden sm:block">
            <OwnerTable>
              <OwnerTableHead>
                <tr>
                  <OwnerTableHeadCell>Room No.</OwnerTableHeadCell>
                  <OwnerTableHeadCell>Room Type</OwnerTableHeadCell>
                  <OwnerTableHeadCell>Beds</OwnerTableHeadCell>
                  <OwnerTableHeadCell>Status</OwnerTableHeadCell>
                  <OwnerTableHeadCell>Rent (Monthly)</OwnerTableHeadCell>
                  <OwnerTableHeadCell>Actions</OwnerTableHeadCell>
                </tr>
              </OwnerTableHead>
              <OwnerTableBody>
                {rooms.map(room => {
                  const status = room.total_beds === 0 ? 'vacant' : 'partial'
                  return (
                    <OwnerTableRow key={room.id}>
                      <OwnerTableCell className="font-semibold">{room.room_number}</OwnerTableCell>
                      <OwnerTableCell className="text-owner-muted">{room.sharing_type} · Floor {room.floor}</OwnerTableCell>
                      <OwnerTableCell>
                        <div className="flex items-center gap-1">
                          {Array.from({ length: room.total_beds }).map((_, i) => (
                            <BedDouble key={i} className="w-3.5 h-3.5 text-owner-primary" />
                          ))}
                        </div>
                      </OwnerTableCell>
                      <OwnerTableCell>
                        <OwnerBadge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</OwnerBadge>
                      </OwnerTableCell>
                      <OwnerTableCell className="font-semibold owner-numeric">{formatINR(room.monthly_rent)}</OwnerTableCell>
                      <OwnerTableCell>
                        <div className="flex items-center gap-1">
                          <OwnerIconButton aria-label={`Edit room ${room.room_number}`} variant="ghost" size="sm" onClick={() => openEdit(room)}>
                            <Pencil />
                          </OwnerIconButton>
                          <OwnerIconButton aria-label={`Delete room ${room.room_number}`} variant="ghost" size="sm" onClick={() => handleDelete(room.id)} className="hover:text-owner-danger">
                            <Trash2 />
                          </OwnerIconButton>
                        </div>
                      </OwnerTableCell>
                    </OwnerTableRow>
                  )
                })}
              </OwnerTableBody>
            </OwnerTable>
          </div>
        </>
      )}

      {modal && (
        <>
          <div onClick={closeModal} className="fixed inset-0 bg-black/40 z-50 transition-opacity" />
          <div className="fixed inset-x-0 bottom-0 z-50 bg-owner-surface-elevated rounded-t-3xl shadow-owner-lg max-h-[85vh] flex flex-col animate-owner-scale-in">
            <div className="flex justify-center pt-2.5 pb-1 shrink-0">
              <div className="h-1 w-9 rounded-full bg-owner-border-strong" />
            </div>
            <div className="px-5 pb-4 pt-1 flex items-center gap-3 border-b border-owner-border shrink-0">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center shrink-0">
                <BedDouble className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[11px] font-bold text-owner-muted uppercase tracking-wide">{editingId ? 'Edit' : 'New Room'}</div>
                <div className="font-bold text-owner-fg">{editingId ? 'Edit Room' : 'Add Room'}</div>
              </div>
              <OwnerIconButton aria-label="Close" variant="ghost" size="sm" onClick={closeModal}>
                <X />
              </OwnerIconButton>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4 grid grid-cols-2 gap-4">
              {activeId === 'all' && !editingId && (
                <div className="col-span-2">
                  <OwnerSelect
                    label="Property *"
                    value={form.property_id}
                    onChange={e => setForm(f => ({ ...f, property_id: e.target.value }))}
                  >
                    <option value="">Select Property</option>
                    {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </OwnerSelect>
                </div>
              )}
              {[
                { key: 'room_number', label: 'Room Number *', placeholder: '101' },
                { key: 'floor', label: 'Floor', placeholder: '1', type: 'number' },
                { key: 'monthly_rent', label: 'Monthly Rent (₹) *', placeholder: '8000', type: 'number' },
                { key: 'total_beds', label: 'Total Beds *', placeholder: '2', type: 'number' },
              ].map(f => (
                <OwnerInput
                  key={f.key}
                  label={f.label}
                  type={f.type ?? 'text'}
                  placeholder={f.placeholder}
                  value={(form as any)[f.key]}
                  onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                />
              ))}
              <div className="col-span-2">
                <label className="text-xs font-semibold text-owner-muted block mb-1.5">Sharing Type</label>
                <div className="flex gap-2">
                  {['1 Sharing', '2 Sharing', '3 Sharing', '4 Sharing'].map(t => (
                    <button key={t} onClick={() => setForm(f => ({ ...f, sharing_type: t, total_beds: t.split(' ')[0] }))}
                      className={`flex-1 py-2 rounded-owner-lg text-xs font-semibold border transition-colors ${form.sharing_type === t ? 'border-owner-primary bg-owner-primary/10 text-owner-primary' : 'border-owner-border text-owner-muted hover:bg-owner-surface-hover'}`}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              <div className="col-span-2">
                <OwnerInput
                  label="Notes"
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="AC, attached bathroom…"
                />
              </div>
            </div>
            <div className="px-5 py-4 border-t border-owner-border shrink-0 flex gap-2.5" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
              <button onClick={closeModal}
                className="flex-1 h-12 flex items-center justify-center gap-1.5 bg-owner-surface-hover hover:opacity-80 active:scale-[0.98] text-owner-fg rounded-2xl text-sm font-bold transition">
                Cancel
              </button>
              <button onClick={handleSave} disabled={saving}
                className="flex-1 h-12 flex items-center justify-center gap-1.5 bg-owner-primary hover:opacity-90 active:scale-[0.98] text-white rounded-2xl text-sm font-bold transition disabled:opacity-50">
                {editingId ? 'Save Changes' : 'Add Room'}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Room Detail sheet — List → Detail pattern. Beds shown as a simple
          count (matches list view); actual per-tenant occupancy isn't
          shown here since that needs a new tenants↔rooms query — same
          scope boundary already documented at the top of this file. */}
      {roomDetail && (() => {
        const room = roomDetail
        const status = room.total_beds === 0 ? 'vacant' : 'partial'
        return (
          <>
            <div onClick={() => setRoomDetail(null)} className="fixed inset-0 bg-black/40 z-50 transition-opacity" />
            <div className="fixed inset-x-0 bottom-0 z-50 bg-owner-surface-elevated rounded-t-3xl shadow-owner-lg max-h-[85vh] flex flex-col animate-owner-scale-in">
              <div className="flex justify-center pt-2.5 pb-1 shrink-0">
                <div className="h-1 w-9 rounded-full bg-owner-border-strong" />
              </div>
              <div className="px-5 pb-4 pt-1 flex items-center gap-3 border-b border-owner-border shrink-0">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center shrink-0">
                  <BedDouble className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] font-bold text-owner-muted uppercase tracking-wide">Room Details</div>
                  <div className="font-bold text-owner-fg truncate">Room {room.room_number}</div>
                </div>
                <OwnerBadge tone={STATUS_TONE[status]} className="shrink-0">{STATUS_LABEL[status]}</OwnerBadge>
                <OwnerIconButton aria-label="Close" variant="ghost" size="sm" onClick={() => setRoomDetail(null)}>
                  <X />
                </OwnerIconButton>
              </div>
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
                <div className="bg-owner-surface-hover rounded-2xl p-4 text-center">
                  <div className="text-xs text-owner-muted-subtle font-semibold uppercase tracking-wide">Monthly Rent</div>
                  <div className="text-3xl font-extrabold text-owner-fg mt-1 owner-numeric">{formatINR(room.monthly_rent)}</div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-owner-surface-hover rounded-xl p-3">
                    <div className="text-[10px] text-owner-muted-subtle uppercase font-bold">Sharing Type</div>
                    <div className="text-sm font-semibold text-owner-fg mt-0.5">{room.sharing_type}</div>
                  </div>
                  <div className="bg-owner-surface-hover rounded-xl p-3">
                    <div className="text-[10px] text-owner-muted-subtle uppercase font-bold">Floor</div>
                    <div className="text-sm font-semibold text-owner-fg mt-0.5">{room.floor}</div>
                  </div>
                  <div className="bg-owner-surface-hover rounded-xl p-3 col-span-2">
                    <div className="text-[10px] text-owner-muted-subtle uppercase font-bold mb-1.5">Beds ({room.total_beds})</div>
                    <div className="flex items-center gap-1.5">
                      {Array.from({ length: room.total_beds }).map((_, i) => (
                        <BedDouble key={i} className="w-5 h-5 text-owner-primary" />
                      ))}
                      {room.total_beds === 0 && <span className="text-sm text-owner-muted-subtle">No beds configured</span>}
                    </div>
                  </div>
                  {room.notes && (
                    <div className="bg-owner-surface-hover rounded-xl p-3 col-span-2">
                      <div className="text-[10px] text-owner-muted-subtle uppercase font-bold">Notes</div>
                      <div className="text-sm text-owner-fg mt-0.5">{room.notes}</div>
                    </div>
                  )}
                </div>
              </div>
              <div className="px-5 py-4 border-t border-owner-border shrink-0 flex gap-2.5" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
                <button onClick={() => { setRoomDetail(null); handleDelete(room.id) }}
                  className="flex-1 h-12 flex items-center justify-center gap-1.5 bg-owner-danger-subtle hover:opacity-80 active:scale-[0.98] text-owner-danger rounded-2xl text-sm font-bold transition">
                  <Trash2 className="w-4 h-4" /> Delete
                </button>
                <button onClick={() => { setRoomDetail(null); openEdit(room) }}
                  className="flex-1 h-12 flex items-center justify-center gap-1.5 bg-owner-primary hover:opacity-90 active:scale-[0.98] text-white rounded-2xl text-sm font-bold transition">
                  <Pencil className="w-4 h-4" /> Edit Room
                </button>
              </div>
            </div>
          </>
        )
      })()}
    </div>
  )
}
