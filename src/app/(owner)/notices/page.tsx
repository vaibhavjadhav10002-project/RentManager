'use client'
import { useEffect, useState } from 'react'
import { useProperty } from '@/components/shared/PropertyContext'
import { getNoticesForProperty, addNotice, deleteNotice } from '@/lib/supabase/queries'
import { createClient } from '@/lib/supabase/client'
import { formatDate } from '@/lib/utils'
import { toast } from 'sonner'
import { Plus, Loader2, Megaphone, Trash2, Paperclip, X } from 'lucide-react'

const CATEGORIES = ['General', 'Maintenance', 'Rent', 'Electricity', 'Emergency', 'Event']
const PRIORITIES = ['Normal', 'Important', 'Urgent']

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
          <h1 className="text-xl font-extrabold text-gray-900">Notice Board</h1>
          <p className="text-sm text-gray-500">Announcements sent to all tenants at {active?.name ?? 'this property'}</p>
        </div>
        <button onClick={() => { if (activeId === 'all') { toast.error('Select a specific property first'); return } setModal(true) }}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold transition">
          <Plus className="w-4 h-4" /> New Notice
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-gray-300" /></div>
      ) : activeId === 'all' ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center text-sm text-gray-400 shadow-sm">
          Select a specific property to manage its notice board
        </div>
      ) : notices.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center text-sm text-gray-400 shadow-sm">
          No notices yet — publish your first announcement
        </div>
      ) : (
        <div className="space-y-3">
          {notices.map(n => {
            const expired = n.expiry_date && n.expiry_date < today
            const scheduled = n.publish_date > today
            return (
              <div key={n.id} className={`bg-white rounded-2xl border border-gray-100 shadow-sm p-5 ${expired ? 'opacity-60' : ''}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1.5">
                      <h3 className="text-sm font-bold text-gray-900">{n.title}</h3>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        n.priority === 'Urgent' ? 'bg-red-100 text-red-700' : n.priority === 'Important' ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-600'
                      }`}>{n.priority}</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">{n.category}</span>
                      {expired && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">Expired</span>}
                      {scheduled && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-600">Scheduled</span>}
                    </div>
                    <p className="text-sm text-gray-600 whitespace-pre-wrap">{n.description}</p>
                    {n.attachment_url && (
                      <a href={n.attachment_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:underline mt-2">
                        <Paperclip className="w-3.5 h-3.5" /> {n.attachment_name || 'Attachment'}
                      </a>
                    )}
                    <div className="text-xs text-gray-400 mt-2">
                      Published {formatDate(n.publish_date)}{n.expiry_date ? ` · Expires ${formatDate(n.expiry_date)}` : ' · No expiry'}
                    </div>
                  </div>
                  <button onClick={() => handleDelete(n.id)} aria-label="Delete notice" className="p-1.5 hover:bg-red-50 rounded-lg transition flex-shrink-0">
                    <Trash2 className="w-4 h-4 text-gray-400 hover:text-red-500" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* New Notice Modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
              <h2 className="text-base font-bold flex items-center gap-2"><Megaphone className="w-4 h-4 text-indigo-600" /> New Notice</h2>
              <button onClick={() => setModal(false)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="p-6 space-y-4 overflow-y-auto">
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1">Title *</label>
                <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="e.g. Water supply maintenance on Sunday"
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1">Description *</label>
                <textarea rows={4} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Full details of the announcement…"
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500 resize-none" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-gray-600 block mb-1">Category</label>
                  <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500">
                    {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 block mb-1">Priority</label>
                  <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500">
                    {PRIORITIES.map(p => <option key={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 block mb-1">Publish Date</label>
                  <input type="date" value={form.publish_date} onChange={e => setForm(f => ({ ...f, publish_date: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 block mb-1">Expiry Date (optional)</label>
                  <input type="date" value={form.expiry_date} onChange={e => setForm(f => ({ ...f, expiry_date: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500" />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1">Attachment (optional)</label>
                {attachment ? (
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                    <span className="text-sm text-gray-700 flex items-center gap-2 truncate"><Paperclip className="w-3.5 h-3.5 flex-shrink-0" /> {attachment.name}</span>
                    <button onClick={() => setAttachment(null)}><X className="w-4 h-4 text-gray-400" /></button>
                  </div>
                ) : (
                  <label className="flex items-center justify-center gap-2 py-3 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:bg-gray-50 transition text-sm text-gray-500">
                    <input type="file" className="hidden" onChange={e => handleAttachmentSelect(e.target.files?.[0] ?? null)} disabled={uploading} />
                    {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />}
                    {uploading ? 'Uploading…' : 'Attach a file (image, PDF, etc.)'}
                  </label>
                )}
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex gap-3 flex-shrink-0">
              <button onClick={handleCreate} disabled={saving || uploading}
                className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50 transition">
                {saving && <Loader2 className="w-4 h-4 animate-spin" />} Publish Notice
              </button>
              <button onClick={() => setModal(false)} className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-semibold transition">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
