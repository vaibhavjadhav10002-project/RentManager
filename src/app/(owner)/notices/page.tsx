'use client'
import { useEffect, useState } from 'react'
import { useProperty } from '@/components/shared/PropertyContext'
import { getNoticesForProperty, addNotice, deleteNotice } from '@/lib/supabase/queries'
import { createClient } from '@/lib/supabase/client'
import { formatDate } from '@/lib/utils'
import { toast } from 'sonner'
import { Plus, Loader2, Megaphone, Trash2, Paperclip, X, Building2 } from 'lucide-react'
import { sendPushNotification } from '@/lib/push'
import {
  OwnerButton, OwnerIconButton, OwnerBadge, OwnerCard, OwnerInput, OwnerSelect, OwnerTextarea, OwnerEmptyState,
  type OwnerBadgeProps,
} from '@/components/owner/ui'

const CATEGORIES = ['General', 'Maintenance', 'Rent', 'Electricity', 'Emergency', 'Event']
const PRIORITIES = ['Normal', 'Important', 'Urgent']

const PRIORITY_TONE: Record<string, NonNullable<OwnerBadgeProps['tone']>> = {
  Urgent: 'danger', Important: 'warning', Normal: 'neutral',
}

export default function NoticesPage() {
  const { activeId, active } = useProperty()
  const [notices, setNotices] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [form, setForm] = useState({
    title: '', description: '', category: 'General', priority: 'Normal',
    publish_date: new Date().toISOString().slice(0, 10), expiry_date: '',
  })
  const [attachment, setAttachment] = useState<{ url: string; name: string } | null>(null)

  function load() {
    if (activeId === 'all' || !activeId) { setNotices([]); setLoading(false); return }
    setLoading(true)
    getNoticesForProperty(activeId).then(setNotices).catch(() => setNotices([])).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [activeId])

  async function handleAttachmentSelect(file: File | null) {
    if (!file) return
    if (file.size > 10 * 1024 * 1024) { toast.error('File must be under 10MB'); return }
    setUploading(true)
    try {
      const sb = createClient()
      const ext = file.name.split('.').pop() || 'file'
      const path = `${crypto.randomUUID()}.${ext}`
      const { error } = await sb.storage.from('notice-attachments').upload(path, file)
      if (error) throw error
      const { data } = sb.storage.from('notice-attachments').getPublicUrl(path)
      setAttachment({ url: data.publicUrl, name: file.name })
    } catch (e: any) { toast.error('Upload failed: ' + e.message) }
    setUploading(false)
  }

  async function handleCreate() {
    if (activeId === 'all' || !activeId) { toast.error('Select a specific property first'); return }
    if (!form.title.trim()) { toast.error('Title is required'); return }
    if (!form.description.trim()) { toast.error('Description is required'); return }
    setSaving(true)
    try {
      const sb = createClient()
      const { data: { user } } = await sb.auth.getUser()
      const { data: prof } = user ? await sb.from('profiles').select('full_name').eq('id', user.id).single() : { data: null }

      await addNotice({
        property_id: activeId,
        title: form.title.trim(),
        description: form.description.trim(),
        category: form.category,
        priority: form.priority,
        publish_date: form.publish_date,
        expiry_date: form.expiry_date || null,
        attachment_url: attachment?.url ?? null,
        attachment_name: attachment?.name ?? null,
        created_by: prof?.full_name ?? undefined,
      })

      // Instant push to every active tenant at this property — best-effort,
      // never blocks the notice from being published if it fails.
      const { data: tenantsHere } = await sb.from('tenants').select('auth_user_id').eq('property_id', activeId).eq('status', 'active').not('auth_user_id', 'is', null)
      const userIds = (tenantsHere ?? []).map((t: any) => t.auth_user_id).filter(Boolean)
      if (userIds.length > 0) {
        sendPushNotification({ user_ids: userIds, title: `📢 ${form.title.trim()}`, body: form.description.trim().slice(0, 120), url: '/portal', tag: 'notice' })
      }

      toast.success('Notice published!')
      setModal(false)
      setForm({ title: '', description: '', category: 'General', priority: 'Normal', publish_date: new Date().toISOString().slice(0, 10), expiry_date: '' })
      setAttachment(null)
      load()
    } catch (e: any) { toast.error(e.message) }
    setSaving(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this notice? Tenants will no longer see it.')) return
    try {
      await deleteNotice(id)
      toast.success('Notice deleted')
      setNotices(prev => prev.filter(n => n.id !== id))
    } catch (e: any) { toast.error(e.message) }
  }

  const today = new Date().toISOString().slice(0, 10)

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-extrabold text-owner-fg">Notice Board</h1>
          <p className="text-sm text-owner-muted">Announcements sent to all tenants at {active?.name ?? 'this property'}</p>
        </div>
        <OwnerButton
          onClick={() => { if (activeId === 'all') { toast.error('Select a specific property first'); return } setModal(true) }}
          icon={<Plus className="w-4 h-4" />}
        >
          New Notice
        </OwnerButton>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-28 rounded-owner-xl bg-owner-surface-hover animate-pulse" />)}
        </div>
      ) : activeId === 'all' ? (
        <OwnerCard>
          <OwnerEmptyState icon={Building2} title="Select a specific property to manage its notice board" />
        </OwnerCard>
      ) : notices.length === 0 ? (
        <OwnerCard>
          <OwnerEmptyState icon={Megaphone} title="No notices yet" subtitle="Publish your first announcement" />
        </OwnerCard>
      ) : (
        <div className="space-y-3">
          {notices.map(n => {
            const expired = n.expiry_date && n.expiry_date < today
            const scheduled = n.publish_date > today
            return (
              <OwnerCard key={n.id} className={expired ? 'opacity-60' : undefined}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1.5">
                      <h3 className="text-sm font-bold text-owner-fg">{n.title}</h3>
                      <OwnerBadge tone={PRIORITY_TONE[n.priority]} size="sm">{n.priority}</OwnerBadge>
                      <OwnerBadge tone="primary" size="sm">{n.category}</OwnerBadge>
                      {expired && <OwnerBadge tone="neutral" size="sm">Expired</OwnerBadge>}
                      {scheduled && <OwnerBadge tone="info" size="sm">Scheduled</OwnerBadge>}
                    </div>
                    <p className="text-sm text-owner-muted whitespace-pre-wrap">{n.description}</p>
                    {n.attachment_url && (
                      <a href={n.attachment_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-xs font-semibold text-owner-primary hover:underline mt-2">
                        <Paperclip className="w-3.5 h-3.5" /> {n.attachment_name || 'Attachment'}
                      </a>
                    )}
                    <div className="text-xs text-owner-muted-subtle mt-2">
                      Published {formatDate(n.publish_date)}{n.expiry_date ? ` · Expires ${formatDate(n.expiry_date)}` : ' · No expiry'}
                    </div>
                  </div>
                  <OwnerIconButton aria-label="Delete notice" variant="ghost" size="sm" onClick={() => handleDelete(n.id)} className="hover:text-owner-danger shrink-0">
                    <Trash2 />
                  </OwnerIconButton>
                </div>
              </OwnerCard>
            )
          })}
        </div>
      )}

      {/* New Notice Modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-owner-surface-elevated rounded-owner-2xl w-full max-w-lg shadow-owner-lg border border-owner-border max-h-[90vh] flex flex-col animate-owner-scale-in">
            <div className="px-6 py-4 border-b border-owner-border flex items-center justify-between shrink-0">
              <h2 className="text-base font-bold text-owner-fg flex items-center gap-2"><Megaphone className="w-4 h-4 text-owner-primary" /> New Notice</h2>
              <OwnerIconButton aria-label="Close" variant="ghost" size="sm" onClick={() => setModal(false)}>
                <X />
              </OwnerIconButton>
            </div>
            <div className="p-6 space-y-4 overflow-y-auto">
              <OwnerInput
                label="Title *"
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="e.g. Water supply maintenance on Sunday"
              />
              <OwnerTextarea
                label="Description *"
                rows={4}
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Full details of the announcement…"
              />
              <div className="grid grid-cols-2 gap-4">
                <OwnerSelect label="Category" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                  {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                </OwnerSelect>
                <OwnerSelect label="Priority" value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}>
                  {PRIORITIES.map(p => <option key={p}>{p}</option>)}
                </OwnerSelect>
                <OwnerInput label="Publish Date" type="date" value={form.publish_date} onChange={e => setForm(f => ({ ...f, publish_date: e.target.value }))} />
                <OwnerInput label="Expiry Date (optional)" type="date" value={form.expiry_date} onChange={e => setForm(f => ({ ...f, expiry_date: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-semibold text-owner-muted block mb-1.5">Attachment (optional)</label>
                {attachment ? (
                  <div className="flex items-center justify-between p-3 bg-owner-bg-subtle rounded-owner-lg">
                    <span className="text-sm text-owner-fg flex items-center gap-2 truncate"><Paperclip className="w-3.5 h-3.5 shrink-0" /> {attachment.name}</span>
                    <button onClick={() => setAttachment(null)} aria-label="Remove attachment"><X className="w-4 h-4 text-owner-muted hover:text-owner-fg" /></button>
                  </div>
                ) : (
                  <label className="flex items-center justify-center gap-2 py-3 border-2 border-dashed border-owner-border rounded-owner-lg cursor-pointer hover:bg-owner-surface-hover transition-colors text-sm text-owner-muted">
                    <input type="file" className="hidden" onChange={e => handleAttachmentSelect(e.target.files?.[0] ?? null)} disabled={uploading} />
                    {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />}
                    {uploading ? 'Uploading…' : 'Attach a file (image, PDF, etc.)'}
                  </label>
                )}
              </div>
            </div>
            <div className="px-6 py-4 border-t border-owner-border flex gap-3 shrink-0">
              <OwnerButton onClick={handleCreate} loading={saving || uploading} fullWidth>Publish Notice</OwnerButton>
              <OwnerButton onClick={() => setModal(false)} variant="secondary" fullWidth>Cancel</OwnerButton>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
