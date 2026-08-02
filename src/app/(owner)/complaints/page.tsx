'use client'
import { useEffect, useState, useCallback } from 'react'
import { useProperty } from '@/components/shared/PropertyContext'
import { getComplaints, addComplaint, resolveComplaint } from '@/lib/supabase/queries'
import { formatDate, cn } from '@/lib/utils'
import { toast } from 'sonner'
import { Plus, Check, X, User, DoorOpen, Calendar, ArrowRight, MessageSquareWarning } from 'lucide-react'
import { sendPushNotification } from '@/lib/push'
import {
  OwnerButton, OwnerIconButton, OwnerBadge, OwnerCard, OwnerInput, OwnerSelect, OwnerTextarea, OwnerEmptyState,
  type OwnerBadgeProps,
} from '@/components/owner/ui'

const PRIORITY_TONE: Record<string, NonNullable<OwnerBadgeProps['tone']>> = {
  low: 'neutral', medium: 'warning', high: 'danger',
}
const STATUS_TONE: Record<string, NonNullable<OwnerBadgeProps['tone']>> = {
  open: 'warning', in_progress: 'info', resolved: 'success',
}

export default function ComplaintsPage() {
  const { activeId, properties } = useProperty()
  const [complaints, setComplaints] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [modal, setModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ property_id: '', issue_type: 'Plumbing', description: '', priority: 'medium', assigned_to: '' })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const ids = activeId === 'all' ? properties.map(p => p.id) : [activeId]
      const data = (await Promise.all(ids.map(getComplaints))).flat()
      setComplaints(data)
    } catch { toast.error('Failed to load') }
    setLoading(false)
  }, [activeId, properties])

  useEffect(() => { load() }, [load])

  const filtered = filter === 'all' ? complaints : complaints.filter(c => c.status === filter)

  async function handleAdd() {
    const propertyId = form.property_id || (activeId !== 'all' ? activeId : '')
    if (!propertyId) { toast.error('Select a property'); return }
    if (!form.issue_type) { toast.error('Select issue type'); return }
    setSaving(true)
    try {
      await addComplaint({ property_id: propertyId, issue_type: form.issue_type, description: form.description, priority: form.priority as any, assigned_to: form.assigned_to })
      toast.success('Complaint added!'); setModal(false); load()
    } catch (e: any) { toast.error(e.message) }
    setSaving(false)
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-extrabold text-owner-fg">Complaints</h1>
          <p className="text-sm text-owner-muted">{complaints.filter(c => c.status !== 'resolved').length} open · {complaints.filter(c => c.status === 'resolved').length} resolved</p>
        </div>
        <OwnerButton onClick={() => setModal(true)} icon={<Plus className="w-4 h-4" />}>
          Add Complaint
        </OwnerButton>
      </div>

      <div className="flex gap-1.5 flex-wrap">
        {['all', 'open', 'in_progress', 'resolved'].map(s => (
          <button key={s} onClick={() => setFilter(s)}
            className={cn('px-3 py-1.5 rounded-owner-full text-xs font-semibold transition-colors', filter === s ? 'bg-owner-primary text-owner-primary-fg' : 'bg-owner-surface-hover text-owner-muted hover:text-owner-fg')}>
            {s === 'all' ? 'All' : s.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-24 rounded-owner-xl bg-owner-surface-hover animate-pulse" />)}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(c => (
            <OwnerCard key={c.id}>
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    <span className="font-bold text-owner-fg text-sm">{c.issue_type}</span>
                    <OwnerBadge tone={PRIORITY_TONE[c.priority]} className="capitalize">{c.priority}</OwnerBadge>
                    <OwnerBadge tone={STATUS_TONE[c.status]}>{c.status.replace('_', ' ')}</OwnerBadge>
                  </div>
                  {c.description && <p className="text-sm text-owner-muted mb-2">{c.description}</p>}
                  <div className="flex gap-3 text-xs text-owner-muted-subtle flex-wrap items-center">
                    {c.tenant && <span className="flex items-center gap-1"><User className="w-3 h-3" /> {c.tenant.name}</span>}
                    {c.room && <span className="flex items-center gap-1"><DoorOpen className="w-3 h-3" /> Room {c.room.room_number}</span>}
                    <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {formatDate(c.created_at)}</span>
                    {c.assigned_to && <span className="flex items-center gap-1 text-owner-primary font-semibold"><ArrowRight className="w-3 h-3" /> {c.assigned_to}</span>}
                  </div>
                </div>
                {c.status !== 'resolved' && (
                  <OwnerButton
                    onClick={async () => {
                      await resolveComplaint(c.id)
                      toast.success('Marked resolved!')
                      if (c.tenant?.auth_user_id) {
                        sendPushNotification({
                          user_ids: [c.tenant.auth_user_id],
                          title: '✅ Complaint Resolved',
                          body: `Your complaint "${c.issue_type}" has been marked resolved.`,
                          url: '/portal', tag: 'complaint',
                        })
                      }
                      load()
                    }}
                    variant="secondary" size="sm" icon={<Check className="w-3.5 h-3.5 text-owner-success" />}
                  >
                    Resolve
                  </OwnerButton>
                )}
              </div>
            </OwnerCard>
          ))}
          {filtered.length === 0 && (
            <OwnerCard>
              <OwnerEmptyState icon={MessageSquareWarning} title="No complaints found" />
            </OwnerCard>
          )}
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-owner-surface-elevated rounded-t-owner-2xl sm:rounded-owner-2xl w-full max-w-md shadow-owner-lg border border-owner-border pb-safe sm:pb-0 animate-owner-sheet-up sm:animate-owner-scale-in">
            <div className="px-6 py-4 border-b border-owner-border flex items-center justify-between">
              <h2 className="text-base font-bold text-owner-fg">Add Complaint</h2>
              <OwnerIconButton aria-label="Close" variant="ghost" size="sm" onClick={() => setModal(false)}>
                <X />
              </OwnerIconButton>
            </div>
            <div className="p-6 space-y-4">
              {activeId === 'all' && (
                <OwnerSelect label="Property *" value={form.property_id} onChange={e => setForm(f => ({ ...f, property_id: e.target.value }))}>
                  <option value="">Select Property</option>
                  {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </OwnerSelect>
              )}
              <OwnerSelect label="Issue Type" value={form.issue_type} onChange={e => setForm(f => ({ ...f, issue_type: e.target.value }))}>
                {['Plumbing', 'Electrical', 'WiFi', 'Cleaning', 'AC', 'Maintenance', 'Other'].map(t => <option key={t}>{t}</option>)}
              </OwnerSelect>
              <div>
                <label className="text-xs font-semibold text-owner-muted block mb-1.5">Priority</label>
                <div className="flex gap-2">
                  {['low', 'medium', 'high'].map(p => (
                    <button key={p} onClick={() => setForm(f => ({ ...f, priority: p }))}
                      className={cn('flex-1 py-2 rounded-owner-lg text-xs font-semibold border transition-colors capitalize', form.priority === p ? 'border-owner-primary bg-owner-primary/10 text-owner-primary' : 'border-owner-border text-owner-muted hover:bg-owner-surface-hover')}>
                      {p}
                    </button>
                  ))}
                </div>
              </div>
              <OwnerTextarea label="Description" rows={3} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Describe the issue…" />
              <OwnerInput label="Assign To" value={form.assigned_to} onChange={e => setForm(f => ({ ...f, assigned_to: e.target.value }))} placeholder="e.g. Plumber Raju" />
            </div>
            <div className="px-6 py-4 border-t border-owner-border flex gap-3">
              <OwnerButton onClick={handleAdd} loading={saving} fullWidth>Submit</OwnerButton>
              <OwnerButton onClick={() => setModal(false)} variant="secondary" fullWidth>Cancel</OwnerButton>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
