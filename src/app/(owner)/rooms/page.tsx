'use client'
import { useEffect, useState, useCallback } from 'react'
import { useProperty } from '@/components/shared/PropertyContext'
import { getRooms, addRoom, updateRoom, deleteRoom } from '@/lib/supabase/queries'
import { formatINR } from '@/lib/utils'
import { toast } from 'sonner'
import { Plus, Trash2, Pencil, BedDouble, X } from 'lucide-react'
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
      )}

      {modal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-owner-surface-elevated rounded-owner-2xl w-full max-w-md shadow-owner-lg border border-owner-border animate-owner-scale-in">
            <div className="px-6 py-4 border-b border-owner-border flex items-center justify-between">
              <h2 className="text-base font-bold text-owner-fg">{editingId ? 'Edit Room' : 'Add Room'}</h2>
              <OwnerIconButton aria-label="Close" variant="ghost" size="sm" onClick={closeModal}>
                <X />
              </OwnerIconButton>
            </div>
            <div className="p-6 grid grid-cols-2 gap-4">
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
            <div className="px-6 py-4 border-t border-owner-border flex gap-3">
              <OwnerButton onClick={handleSave} loading={saving} fullWidth>
                {editingId ? 'Save Changes' : 'Add Room'}
              </OwnerButton>
              <OwnerButton onClick={closeModal} variant="secondary" fullWidth>Cancel</OwnerButton>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
