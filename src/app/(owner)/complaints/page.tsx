'use client'
import { useEffect, useState, useCallback } from 'react'
import { useProperty } from '@/components/shared/PropertyContext'
import { getComplaints, addComplaint, resolveComplaint } from '@/lib/supabase/queries'
import { formatDate, cn } from '@/lib/utils'
import { toast } from 'sonner'
import { Plus, Check, X, MessageSquareWarning, ChevronRight } from 'lucide-react'
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
  const [complaintDetail, setComplaintDetail] = useState<any | null>(null)
  const [resolvingId, setResolvingId] = useState<string | null>(null)
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
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-20 rounded-owner-xl bg-owner-surface-hover animate-pulse" />)}
        </div>
      ) : (
        <div className="space-y-2.5">
          {filtered.map(c => (
            <button key={c.id} onClick={() => setComplaintDetail(c)}
              className="w-full bg-owner-surface border border-owner-border rounded-owner-lg p-3.5 flex items-center gap-3 text-left transition active:scale-[0.99] active:bg-owner-surface-hover">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-orange-500 to-red-500 text-white flex items-center justify-center shrink-0">
                <MessageSquareWarning className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-owner-fg truncate">{c.issue_type}</div>
                <div className="text-xs text-owner-muted-subtle truncate">
                  {c.tenant?.name ?? '—'}{c.room ? ` · Room ${c.room.room_number}` : ''} · {formatDate(c.created_at)}
                </div>
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                <OwnerBadge tone={PRIORITY_TONE[c.priority]} className="capitalize">{c.priority}</OwnerBadge>
                <OwnerBadge tone={STATUS_TONE[c.status]}>{c.status.replace('_', ' ')}</OwnerBadge>
              </div>
              <ChevronRight className="w-4 h-4 text-owner-muted-subtle shrink-0" />
            </button>
          ))}
          {filtered.length === 0 && (
            <OwnerCard>
              <OwnerEmptyState icon={MessageSquareWarning} title="No complaints found" />
            </OwnerCard>
          )}
        </div>
      )}

      {/* Complaint Detail sheet — full info + simple 3-step status progress
          (Open → In Progress → Resolved). Not a timestamped history log —
          complaints only track a current status, not a change history, so
          this reflects where the complaint sits right now rather than
          fabricating a timeline that doesn't exist in the data. */}
      {complaintDetail && (() => {
        const c = complaintDetail
        const isResolving = resolvingId === c.id
        const steps = ['open', 'in_progress', 'resolved']
        const stepIdx = steps.indexOf(c.status)
        return (
          <>
            <div onClick={() => setComplaintDetail(null)} className="fixed inset-0 bg-black/40 z-50 transition-opacity" />
            <div className="fixed inset-x-0 bottom-0 z-50 bg-owner-surface-elevated rounded-t-3xl shadow-owner-lg max-h-[85vh] flex flex-col animate-owner-scale-in">
              <div className="flex justify-center pt-2.5 pb-1 shrink-0">
                <div className="h-1 w-9 rounded-full bg-owner-border-strong" />
              </div>
              <div className="px-5 pb-4 pt-1 flex items-center gap-3 border-b border-owner-border shrink-0">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-orange-500 to-red-500 text-white flex items-center justify-center shrink-0">
                  <MessageSquareWarning className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] font-bold text-owner-muted uppercase tracking-wide">Complaint Details</div>
                  <div className="font-bold text-owner-fg truncate">{c.issue_type}</div>
                </div>
                <OwnerBadge tone={PRIORITY_TONE[c.priority]} className="capitalize shrink-0">{c.priority}</OwnerBadge>
                <OwnerIconButton aria-label="Close" variant="ghost" size="sm" onClick={() => setComplaintDetail(null)}>
                  <X />
                </OwnerIconButton>
              </div>
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
                {/* Simple status progress */}
                <div className="flex items-center gap-1.5">
                  {steps.map((s, i) => (
                    <div key={s} className="flex-1 flex items-center gap-1.5">
                      <div className="flex-1">
                        <div className={`h-1.5 rounded-full ${i <= stepIdx ? 'bg-owner-primary' : 'bg-owner-surface-hover'}`} />
                        <div className={`text-[10px] font-semibold mt-1 capitalize ${i <= stepIdx ? 'text-owner-fg' : 'text-owner-muted-subtle'}`}>{s.replace('_', ' ')}</div>
                      </div>
                    </div>
                  ))}
                </div>
                {c.description && (
                  <div className="bg-owner-surface-hover rounded-xl p-3">
                    <div className="text-[10px] text-owner-muted-subtle uppercase font-bold">Description</div>
                    <div className="text-sm text-owner-fg mt-0.5">{c.description}</div>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-owner-surface-hover rounded-xl p-3">
                    <div className="text-[10px] text-owner-muted-subtle uppercase font-bold">Tenant</div>
                    <div className="text-sm font-semibold text-owner-fg mt-0.5">{c.tenant?.name ?? '—'}</div>
                  </div>
                  <div className="bg-owner-surface-hover rounded-xl p-3">
                    <div className="text-[10px] text-owner-muted-subtle uppercase font-bold">Room</div>
                    <div className="text-sm font-semibold text-owner-fg mt-0.5">{c.room ? `Room ${c.room.room_number}` : '—'}</div>
                  </div>
                  <div className="bg-owner-surface-hover rounded-xl p-3">
                    <div className="text-[10px] text-owner-muted-subtle uppercase font-bold">Raised On</div>
                    <div className="text-sm font-semibold text-owner-fg mt-0.5">{formatDate(c.created_at)}</div>
                  </div>
                  <div className="bg-owner-surface-hover rounded-xl p-3">
                    <div className="text-[10px] text-owner-muted-subtle uppercase font-bold">Assigned To</div>
                    <div className="text-sm font-semibold text-owner-fg mt-0.5">{c.assigned_to || 'Unassigned'}</div>
                  </div>
                </div>
              </div>
              {c.status !== 'resolved' && (
                <div className="px-5 py-4 border-t border-owner-border shrink-0" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
                  <button
                    onClick={async () => {
                      setResolvingId(c.id)
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
                      await load()
                      setResolvingId(null)
                      setComplaintDetail(null)
                    }}
                    disabled={isResolving}
                    className="w-full h-12 flex items-center justify-center gap-1.5 bg-owner-success hover:opacity-90 active:scale-[0.98] text-white rounded-2xl text-sm font-bold transition disabled:opacity-50">
                    <Check className="w-4 h-4" /> Mark Resolved
                  </button>
                </div>
              )}
            </div>
          </>
        )
      })()}

      {modal && (
        <>
          <div onClick={() => setModal(false)} className="fixed inset-0 bg-black/40 z-50 transition-opacity" />
          <div className="fixed inset-x-0 bottom-0 z-50 bg-owner-surface-elevated rounded-t-3xl shadow-owner-lg max-h-[85vh] flex flex-col animate-owner-scale-in">
            <div className="flex justify-center pt-2.5 pb-1 shrink-0">
              <div className="h-1 w-9 rounded-full bg-owner-border-strong" />
            </div>
            <div className="px-5 pb-4 pt-1 flex items-center gap-3 border-b border-owner-border shrink-0">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-orange-500 to-red-500 text-white flex items-center justify-center shrink-0">
                <MessageSquareWarning className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[11px] font-bold text-owner-muted uppercase tracking-wide">New Entry</div>
                <div className="font-bold text-owner-fg">Add Complaint</div>
              </div>
              <OwnerIconButton aria-label="Close" variant="ghost" size="sm" onClick={() => setModal(false)}>
                <X />
              </OwnerIconButton>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
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
            <div className="px-5 py-4 border-t border-owner-border shrink-0 flex gap-2.5" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
              <button onClick={() => setModal(false)}
                className="flex-1 h-12 flex items-center justify-center gap-1.5 bg-owner-surface-hover hover:opacity-80 active:scale-[0.98] text-owner-fg rounded-2xl text-sm font-bold transition">
                Cancel
              </button>
              <button onClick={handleAdd} disabled={saving}
                className="flex-1 h-12 flex items-center justify-center gap-1.5 bg-owner-primary hover:opacity-90 active:scale-[0.98] text-white rounded-2xl text-sm font-bold transition disabled:opacity-50">
                Submit
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
