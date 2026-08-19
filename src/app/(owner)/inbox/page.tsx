'use client'
import { useEffect, useState, useCallback } from 'react'
import { useProperty } from '@/components/shared/PropertyContext'
import { getTenants, getMessageTemplates, ensureDefaultTemplates, addMessageTemplate, updateMessageTemplate, deleteMessageTemplate, getCommunicationSettings, upsertCommunicationSettings, getPayments } from '@/lib/supabase/queries'
import { CommunicationService, ReminderEngine, extractVariables, isFullyRendered, STANDARD_VARIABLES, type ReminderCandidate } from '@/lib/communication'
import { formatINR, formatDate, cn, friendlyErrorMessage } from '@/lib/utils'
import { toast } from 'sonner'
import { Inbox as InboxIcon, MessageCircle, Bell, FileText, History as HistoryIcon, Plus, Pencil, Trash2, X, Settings2, Sparkles, Search, ExternalLink, CheckCheck, RotateCcw, AlertTriangle } from 'lucide-react'
import type { MessageTemplate, TemplateCategory, TemplateVariables, CommunicationLogEntry, CommunicationStatus, CommunicationQueueItem } from '@/types'
import { createClient } from '@/lib/supabase/client'
import {
  OwnerButton, OwnerIconButton, OwnerBadge, OwnerCard, OwnerInput, OwnerSelect, OwnerTextarea, OwnerEmptyState, OwnerAvatar,
  type OwnerBadgeProps,
} from '@/components/owner/ui'
import { usePullToRefreshHandler } from '@/lib/native/pullToRefresh'

type InboxTab = 'whatsapp' | 'reminders' | 'templates' | 'history'

const CATEGORY_TONE: Record<TemplateCategory, NonNullable<OwnerBadgeProps['tone']>> = {
  rent_reminder: 'primary', due_today: 'warning', overdue: 'danger',
  welcome: 'success', notice: 'purple', general: 'neutral', custom: 'teal',
}
const CATEGORY_LABEL: Record<TemplateCategory, string> = {
  rent_reminder: 'Rent Reminder', due_today: 'Due Today', overdue: 'Overdue',
  welcome: 'Welcome', notice: 'Notice', general: 'General', custom: 'Custom',
}

export default function InboxPage() {
  const { activeId, active, properties } = useProperty()
  const [tab, setTab] = useState<InboxTab>('whatsapp')
  const [tenants, setTenants] = useState<any[]>([])
  const [templates, setTemplates] = useState<MessageTemplate[]>([])
  const [logs, setLogs] = useState<CommunicationLogEntry[]>([])
  const [payments, setPayments] = useState<any[]>([])
  const [queue, setQueue] = useState<CommunicationQueueItem[]>([])
  const [reminderLeadDays, setReminderLeadDays] = useState(3)
  const [loading, setLoading] = useState(true)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [templateModal, setTemplateModal] = useState<'new' | MessageTemplate | null>(null)
  const [ownerId, setOwnerId] = useState<string | undefined>(undefined)

  useEffect(() => {
    const sb = createClient()
    sb.auth.getUser().then(({ data }) => setOwnerId(data.user?.id))
  }, [])

  const propertyId = activeId === 'all' ? properties[0]?.id : activeId

  const load = useCallback(async () => {
    if (!propertyId) { setLoading(false); return }
    setLoading(true)
    try {
      await ensureDefaultTemplates(propertyId)
      const [tenantData, templateData, logData, paymentData, queueData, settingsData] = await Promise.all([
        getTenants(propertyId),
        getMessageTemplates(propertyId),
        CommunicationService.getHistory(propertyId),
        getPayments(propertyId),
        CommunicationService.getQueue(propertyId),
        getCommunicationSettings(propertyId),
      ])
      setTenants(tenantData.filter((t: any) => t.status === 'active'))
      setTemplates(templateData)
      setLogs(logData as any)
      setPayments(paymentData)
      setQueue(queueData as any)
      setReminderLeadDays(settingsData?.default_reminder_days ?? 3)
    } catch (e: any) {
      toast.error('Failed to load Inbox: ' + e.message)
    }
    setLoading(false)
  }, [propertyId])

  useEffect(() => { load() }, [load])
  usePullToRefreshHandler(load)

  const tabs: { key: InboxTab; label: string; icon: typeof MessageCircle }[] = [
    { key: 'whatsapp', label: 'WhatsApp', icon: MessageCircle },
    { key: 'reminders', label: 'Reminders', icon: Bell },
    { key: 'templates', label: 'Templates', icon: FileText },
    { key: 'history', label: 'History', icon: HistoryIcon },
  ]

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-extrabold text-owner-fg flex items-center gap-2">
            <InboxIcon className="w-5 h-5 text-owner-primary" /> Inbox
          </h1>
          <p className="text-sm text-owner-muted mt-1">
            {activeId === 'all' ? `Communication for ${active?.name ?? 'your first property'}` : active?.name}
          </p>
        </div>
        <OwnerIconButton aria-label="Communication settings" variant="surface" size="md" onClick={() => setSettingsOpen(true)}>
          <Settings2 />
        </OwnerIconButton>
      </div>

      {!propertyId ? (
        <OwnerCard>
          <OwnerEmptyState icon={InboxIcon} title="Add a property first" subtitle="The Inbox works per-property — add or select one to get started." />
        </OwnerCard>
      ) : (
        <>
          <div className="flex gap-1.5 flex-wrap">
            {tabs.map(t => (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-owner-full text-xs font-semibold transition-colors',
                  tab === t.key ? 'bg-owner-primary text-owner-primary-fg' : 'bg-owner-surface-hover text-owner-muted hover:text-owner-fg')}>
                <t.icon className="w-3.5 h-3.5" /> {t.label}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-16 rounded-owner-xl bg-owner-surface-hover animate-pulse" />)}
            </div>
          ) : tab === 'whatsapp' ? (
            <WhatsAppTab
              tenants={tenants}
              templates={templates}
              logs={logs}
              propertyId={propertyId}
              propertyName={active?.name ?? properties.find(p => p.id === propertyId)?.name ?? 'PG'}
              ownerId={ownerId}
              onSent={load}
            />
          ) : tab === 'reminders' ? (
            <RemindersTab
              tenants={tenants}
              templates={templates}
              payments={payments}
              logs={logs}
              queue={queue}
              propertyId={propertyId}
              propertyName={active?.name ?? properties.find(p => p.id === propertyId)?.name ?? 'PG'}
              ownerId={ownerId}
              reminderLeadDays={reminderLeadDays}
              onSent={load}
            />
          ) : tab === 'templates' ? (
            <TemplatesTab templates={templates} onEdit={setTemplateModal} onReload={load} />
          ) : (
            <HistoryTab logs={logs} />
          )}
        </>
      )}

      {templateModal && propertyId && (
        <TemplateModal
          propertyId={propertyId}
          existing={templateModal === 'new' ? null : templateModal}
          onClose={() => setTemplateModal(null)}
          onSaved={() => { setTemplateModal(null); load() }}
        />
      )}

      {settingsOpen && propertyId && (
        <SettingsModal propertyId={propertyId} onClose={() => setSettingsOpen(false)} onSaved={load} />
      )}
    </div>
  )
}

// ─── WhatsApp tab ───────────────────────────────────────────────────────────
// Phase 9.2: Manual Send is live. Owner picks a tenant + template, reviews
// the preview, presses "Open in WhatsApp" — WhatsApp opens with the message
// already typed in, and the owner presses Send themselves, inside WhatsApp.
// This function never transmits anything on the owner's behalf.
function WhatsAppTab({ tenants, templates, logs, propertyId, propertyName, ownerId, onSent }: {
  tenants: any[]; templates: MessageTemplate[]; logs: CommunicationLogEntry[]
  propertyId: string; propertyName: string; ownerId?: string; onSent: () => void
}) {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'contacted' | 'not_contacted'>('all')
  const [tenantId, setTenantId] = useState('')
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? '')
  const [sending, setSending] = useState(false)

  const contactedIds = new Set(logs.filter(l => l.tenant_id).map(l => l.tenant_id))

  const filtered = tenants.filter(t => {
    if (filter === 'contacted' && !contactedIds.has(t.id)) return false
    if (filter === 'not_contacted' && contactedIds.has(t.id)) return false
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      return t.name?.toLowerCase().includes(q) || t.phone?.includes(q) || t.room?.room_number?.toLowerCase?.().includes(q)
    }
    return true
  })

  if (tenants.length === 0) {
    return <OwnerCard><OwnerEmptyState icon={MessageCircle} title="No active tenants yet" /></OwnerCard>
  }

  const tenant = tenants.find(t => t.id === tenantId)
  const template = templates.find(t => t.id === templateId)
  const variables: TemplateVariables = tenant ? {
    'Tenant Name': tenant.name,
    'Property Name': propertyName,
    'Room Number': tenant.room?.room_number ?? '—',
    'Amount': formatINR(tenant.monthly_rent),
    'Due Date': 'the 5th',
  } : {}
  const preview = tenant && template ? CommunicationService.render(template, variables) : ''

  async function handleSend() {
    if (!tenant || !template) return
    if (!isFullyRendered(template.body, variables)) {
      toast.error('This template uses a variable that has no value yet — check the preview before sending')
      return
    }
    setSending(true)
    try {
      const { message, chatLink } = CommunicationService.prepareWhatsAppSend({ template, variables, phone: tenant.phone })
      window.open(chatLink, '_blank', 'noopener,noreferrer')
      await CommunicationService.confirmSent({ propertyId, tenantId: tenant.id, templateId: template.id, message, sentBy: ownerId })
      toast.success('WhatsApp opened — press Send inside WhatsApp to complete it')
      onSent()
    } catch (e: any) {
      toast.error('Could not open WhatsApp: ' + e.message)
    }
    setSending(false)
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
      {/* Tenant list — Search + Filters */}
      <OwnerCard padding="none" className="lg:col-span-2 flex flex-col max-h-[32rem]">
        <div className="p-4 pb-3 space-y-3 shrink-0">
          <OwnerInput value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, phone, room…" leftIcon={<Search />} />
          <div className="flex gap-1.5 flex-wrap">
            {([
              { key: 'all', label: 'All' },
              { key: 'not_contacted', label: 'Not Contacted' },
              { key: 'contacted', label: 'Contacted' },
            ] as const).map(f => (
              <button key={f.key} onClick={() => setFilter(f.key)}
                className={cn('px-3 py-1 rounded-owner-full text-xs font-semibold transition-colors',
                  filter === f.key ? 'bg-owner-primary text-owner-primary-fg' : 'bg-owner-surface-hover text-owner-muted hover:text-owner-fg')}>
                {f.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto border-t border-owner-border">
          {filtered.length === 0 ? (
            <OwnerEmptyState icon={Search} title="No tenants match" className="py-10" />
          ) : filtered.map(t => (
            <button key={t.id} onClick={() => setTenantId(t.id)}
              className={cn('w-full flex items-center gap-3 px-4 py-3 border-b border-owner-border last:border-0 text-left transition-colors',
                tenantId === t.id ? 'bg-owner-primary/10' : 'hover:bg-owner-surface-hover')}>
              <OwnerAvatar name={t.name} size="sm" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-owner-fg truncate">{t.name}</div>
                <div className="text-xs text-owner-muted-subtle">Room {t.room?.room_number ?? '—'} · {t.phone}</div>
              </div>
              {contactedIds.has(t.id) && <CheckCheck className="w-3.5 h-3.5 text-owner-success shrink-0" />}
            </button>
          ))}
        </div>
      </OwnerCard>

      {/* Compose + Preview + Send */}
      <OwnerCard className="lg:col-span-3 flex flex-col">
        <div className="font-bold text-sm text-owner-fg mb-3">Compose</div>
        <div className="mb-4">
          <OwnerSelect label="Template" value={templateId} onChange={e => setTemplateId(e.target.value)}>
            <option value="">Select template</option>
            {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </OwnerSelect>
        </div>

        {!tenant ? (
          <div className="flex-1 flex items-center justify-center text-sm text-owner-muted-subtle text-center px-4 py-8">
            Pick a tenant from the list to preview and send a message
          </div>
        ) : preview ? (
          <div className="flex-1 bg-owner-success/10 border border-owner-success/20 rounded-owner-xl p-4 text-sm text-owner-fg whitespace-pre-wrap">
            {preview}
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-sm text-owner-muted-subtle text-center px-4 py-8">
            Pick a template to preview the message
          </div>
        )}

        <div className="mt-4">
          <OwnerButton onClick={handleSend} disabled={!tenant || !template} loading={sending} fullWidth icon={<ExternalLink className="w-4 h-4" />}>
            Open in WhatsApp
          </OwnerButton>
        </div>
        <p className="text-xs text-owner-muted-subtle text-center mt-2">
          Opens WhatsApp with this message ready to go — you press Send yourself, inside WhatsApp. Nothing is sent automatically.
        </p>
      </OwnerCard>
    </div>
  )
}

// ─── Reminders tab ──────────────────────────────────────────────────────────
// Phase 9.3: real Reminder Engine + Retry Queue. Candidates are computed by
// `ReminderEngine.findCandidates` from data the page already fetched (no
// new queries here). Sending a reminder still goes through the same
// click-to-chat, press-Send-yourself flow as everywhere else in the Inbox.
function RemindersTab({ tenants, templates, payments, logs, queue, propertyId, propertyName, ownerId, reminderLeadDays, onSent }: {
  tenants: any[]; templates: MessageTemplate[]; payments: any[]; logs: CommunicationLogEntry[]
  queue: CommunicationQueueItem[]; propertyId: string; propertyName: string; ownerId?: string
  reminderLeadDays: number; onSent: () => void
}) {
  const [sendingId, setSendingId] = useState<string | null>(null)
  const defaultTemplate = templates.find(t => t.category === 'overdue') ?? templates.find(t => t.category === 'rent_reminder') ?? templates[0]

  const candidates: ReminderCandidate[] = ReminderEngine.findCandidates({
    tenants, payments, logs, templates, reminderLeadDays,
  })
  const failedQueue = queue.filter(q => q.status === 'failed')

  async function handleSend(candidate: ReminderCandidate) {
    const tenant = tenants.find(t => t.id === candidate.tenantId)
    if (!tenant || !defaultTemplate) return
    const variables: TemplateVariables = {
      'Tenant Name': tenant.name,
      'Property Name': propertyName,
      'Room Number': tenant.room?.room_number ?? '—',
      'Amount': formatINR(tenant.monthly_rent),
      'Due Date': candidate.overdueDays > 0 ? `${candidate.overdueDays} day${candidate.overdueDays === 1 ? '' : 's'} ago` : 'today',
    }
    if (!isFullyRendered(defaultTemplate.body, variables)) {
      toast.error(`"${defaultTemplate.name}" uses a variable Reminders can't fill in automatically — edit the template or send it manually from the WhatsApp tab instead`)
      return
    }
    setSendingId(candidate.tenantId)
    try {
      const result = await CommunicationService.sendReminder({
        propertyId, tenantId: tenant.id, phone: tenant.phone, template: defaultTemplate, variables, sentBy: ownerId,
      })
      if (result.opened) toast.success(`Reminder opened in WhatsApp for ${tenant.name}`)
      else toast.error(`Couldn't queue a reminder for ${tenant.name} — no phone on file`)
      onSent()
    } catch (e: any) {
      toast.error(friendlyErrorMessage(e))
    }
    setSendingId(null)
  }

  async function handleRetry(item: CommunicationQueueItem) {
    if (!item.tenant_id) {
      toast.error('This item has no tenant on record and cannot be retried')
      return
    }
    setSendingId(item.id)
    try {
      const result = await CommunicationService.retryQueueItem({
        queueId: item.id, propertyId, tenantId: item.tenant_id, phone: item.tenant?.phone,
        message: item.rendered_message, templateId: item.template_id, sentBy: ownerId,
      })
      if (result.opened) toast.success('Reopened in WhatsApp')
      else toast.error('Still no phone number on file for this tenant')
      onSent()
    } catch (e: any) {
      toast.error(friendlyErrorMessage(e))
    }
    setSendingId(null)
  }

  if (!defaultTemplate) {
    return <OwnerCard><OwnerEmptyState icon={FileText} title="Add a template first" subtitle="The Reminders tab needs at least one template to send with — create one in the Templates tab." /></OwnerCard>
  }

  return (
    <div className="space-y-5">
      <OwnerCard>
        <div className="flex items-center gap-2 mb-1">
          <Bell className="w-4 h-4 text-owner-primary" />
          <div className="font-bold text-sm text-owner-fg">Needs a Reminder ({candidates.length})</div>
        </div>
        <p className="text-xs text-owner-muted-subtle mb-4">
          Unpaid for the current month, not reminded in the last {reminderLeadDays} day{reminderLeadDays === 1 ? '' : 's'}. Uses the &quot;{defaultTemplate.name}&quot; template — change the default in Templates.
        </p>
        {candidates.length === 0 ? (
          <OwnerEmptyState icon={Sparkles} title="Nobody needs a reminder right now" className="py-8" />
        ) : (
          <div className="space-y-2">
            {candidates.map(c => {
              const tenant = tenants.find(t => t.id === c.tenantId)
              if (!tenant) return null
              // Days-only urgency gradient (no amount data here) — same
              // warning→danger blend used on Dashboard/Payments, capping
              // out at 14 days so it matches those screens visually.
              const pct = Math.round(Math.min(Math.max(c.overdueDays, 0) / 14, 1) * 100)
              const urgencyColor = `color-mix(in hsl, hsl(var(--owner-warning)), hsl(var(--owner-danger)) ${pct}%)`
              return (
                <div key={c.tenantId} className="flex items-center gap-3 p-3 bg-owner-bg-subtle rounded-owner-lg">
                  <OwnerAvatar name={tenant.name} size="sm" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-owner-fg truncate">{tenant.name}</div>
                    <div className="text-xs text-owner-muted-subtle">Room {tenant.room?.room_number ?? '—'}</div>
                  </div>
                  <OwnerBadge size="sm" className="shrink-0"
                    style={{ color: urgencyColor, backgroundColor: `color-mix(in srgb, ${urgencyColor} 15%, transparent)` }}>
                    {c.overdueDays > 0 ? `${c.overdueDays}d overdue` : 'Due today'}
                  </OwnerBadge>
                  <OwnerButton onClick={() => handleSend(c)} loading={sendingId === c.tenantId} size="sm" icon={<ExternalLink className="w-3.5 h-3.5" />}>
                    Remind
                  </OwnerButton>
                </div>
              )
            })}
          </div>
        )}
      </OwnerCard>

      {/* Retry Queue */}
      <OwnerCard>
        <div className="flex items-center gap-2 mb-1">
          <AlertTriangle className="w-4 h-4 text-owner-danger" />
          <div className="font-bold text-sm text-owner-fg">Retry Queue ({failedQueue.length})</div>
        </div>
        <p className="text-xs text-owner-muted-subtle mb-4">Messages that couldn&apos;t be prepared — usually a missing phone number.</p>
        {failedQueue.length === 0 ? (
          <OwnerEmptyState icon={CheckCheck} title="Nothing to retry" className="py-8" />
        ) : (
          <div className="space-y-2">
            {failedQueue.map(item => (
              <div key={item.id} className="flex items-center gap-3 p-3 bg-owner-danger-subtle rounded-owner-lg">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-owner-fg truncate">{item.tenant?.name ?? 'Unknown tenant'}</div>
                  <div className="text-xs text-owner-danger">{item.last_error ?? 'Failed'} · {item.attempt_count} attempt{item.attempt_count === 1 ? '' : 's'}</div>
                </div>
                <OwnerButton onClick={() => handleRetry(item)} loading={sendingId === item.id} size="sm" variant="secondary" icon={<RotateCcw className="w-3.5 h-3.5" />}>
                  Retry
                </OwnerButton>
              </div>
            ))}
          </div>
        )}
      </OwnerCard>
    </div>
  )
}

// ─── Templates tab ──────────────────────────────────────────────────────────
function TemplatesTab({ templates, onEdit, onReload }: { templates: MessageTemplate[]; onEdit: (t: 'new' | MessageTemplate) => void; onReload: () => void }) {
  async function handleDelete(t: MessageTemplate) {
    if (t.is_system_default) { toast.error("Default templates can't be deleted — edit or duplicate instead"); return }
    if (!confirm(`Delete "${t.name}"?`)) return
    try { await deleteMessageTemplate(t.id); toast.success('Template deleted'); onReload() }
    catch (e: any) { toast.error(friendlyErrorMessage(e)) }
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <OwnerButton onClick={() => onEdit('new')} icon={<Plus className="w-4 h-4" />}>New Template</OwnerButton>
      </div>
      {templates.length === 0 ? (
        <OwnerCard><OwnerEmptyState icon={FileText} title="No templates yet" /></OwnerCard>
      ) : templates.map(t => (
        <OwnerCard key={t.id}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1.5">
                <span className="font-bold text-sm text-owner-fg">{t.name}</span>
                <OwnerBadge tone={CATEGORY_TONE[t.category]} size="sm">{CATEGORY_LABEL[t.category]}</OwnerBadge>
                <OwnerBadge tone="neutral" size="sm" className="capitalize">{t.channel}</OwnerBadge>
                {t.is_system_default && <OwnerBadge tone="info" size="sm">Default</OwnerBadge>}
              </div>
              <p className="text-sm text-owner-muted whitespace-pre-wrap">{t.body}</p>
            </div>
            <div className="flex gap-1 shrink-0">
              <OwnerIconButton aria-label={`Edit ${t.name}`} variant="ghost" size="sm" onClick={() => onEdit(t)}><Pencil /></OwnerIconButton>
              {!t.is_system_default && (
                <OwnerIconButton aria-label={`Delete ${t.name}`} variant="ghost" size="sm" onClick={() => handleDelete(t)} className="hover:text-owner-danger"><Trash2 /></OwnerIconButton>
              )}
            </div>
          </div>
        </OwnerCard>
      ))}
    </div>
  )
}

function TemplateModal({ propertyId, existing, onClose, onSaved }: { propertyId: string; existing: MessageTemplate | null; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(existing?.name ?? '')
  const [category, setCategory] = useState<TemplateCategory>(existing?.category ?? 'general')
  const [body, setBody] = useState(existing?.body ?? '')
  const [saving, setSaving] = useState(false)

  const usedVariables = extractVariables(body)

  function insertVariable(v: string) {
    setBody(prev => `${prev}{{${v}}}`)
  }

  async function handleSave() {
    if (!name.trim()) { toast.error('Name is required'); return }
    if (!body.trim()) { toast.error('Message body is required'); return }
    setSaving(true)
    try {
      if (existing) {
        await updateMessageTemplate(existing.id, { name: name.trim(), category, body })
        toast.success('Template updated')
      } else {
        await addMessageTemplate({ property_id: propertyId, name: name.trim(), category, channel: 'whatsapp', body })
        toast.success('Template created')
      }
      onSaved()
    } catch (e: any) { toast.error(friendlyErrorMessage(e)) }
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-owner-surface-elevated rounded-owner-2xl w-full max-w-lg shadow-owner-lg border border-owner-border max-h-[90vh] flex flex-col animate-owner-scale-in">
        <div className="px-6 py-4 border-b border-owner-border flex items-center justify-between shrink-0">
          <h2 className="text-base font-bold text-owner-fg">{existing ? 'Edit Template' : 'New Template'}</h2>
          <OwnerIconButton aria-label="Close" variant="ghost" size="sm" onClick={onClose}><X /></OwnerIconButton>
        </div>
        <div className="p-6 space-y-4 overflow-y-auto">
          <OwnerInput label="Template Name *" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Friendly Rent Reminder" />
          <OwnerSelect label="Category" value={category} onChange={e => setCategory(e.target.value as TemplateCategory)}>
            {(Object.keys(CATEGORY_LABEL) as TemplateCategory[]).map(c => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
          </OwnerSelect>
          <div>
            <label className="text-xs font-semibold text-owner-muted block mb-1.5">Insert Variable</label>
            <div className="flex gap-1.5 flex-wrap">
              {STANDARD_VARIABLES.map(v => (
                <button key={v} onClick={() => insertVariable(v)}
                  className="px-2.5 py-1 rounded-owner-full text-xs font-semibold bg-owner-primary/10 text-owner-primary hover:bg-owner-primary/20 transition-colors">
                  {v}
                </button>
              ))}
            </div>
          </div>
          <OwnerTextarea label="Message Body *" rows={5} value={body} onChange={e => setBody(e.target.value)} placeholder="Hi {{Tenant Name}}, …" />
          {usedVariables.length > 0 && (
            <div className="text-xs text-owner-muted-subtle">Uses: {usedVariables.join(', ')}</div>
          )}
        </div>
        <div className="px-6 py-4 border-t border-owner-border flex gap-3 shrink-0">
          <OwnerButton onClick={handleSave} loading={saving} fullWidth>{existing ? 'Save Changes' : 'Create Template'}</OwnerButton>
          <OwnerButton onClick={onClose} variant="secondary" fullWidth>Cancel</OwnerButton>
        </div>
      </div>
    </div>
  )
}

// ─── History tab ────────────────────────────────────────────────────────────
function HistoryTab({ logs }: { logs: CommunicationLogEntry[] }) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | CommunicationStatus>('all')

  if (logs.length === 0) {
    return (
      <OwnerCard>
        <OwnerEmptyState icon={HistoryIcon} title="No messages sent yet" subtitle="Every message sent from the WhatsApp tab will show up here permanently, separate from the Notification Bell's real-time alerts." />
      </OwnerCard>
    )
  }

  const filtered = logs.filter(l => {
    if (statusFilter !== 'all' && l.status !== statusFilter) return false
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      return l.tenant?.name?.toLowerCase().includes(q) || l.rendered_message.toLowerCase().includes(q)
    }
    return true
  })

  return (
    <div className="space-y-3">
      <div className="flex gap-3 flex-wrap items-center">
        <div className="flex-1 min-w-[200px]">
          <OwnerInput value={search} onChange={e => setSearch(e.target.value)} placeholder="Search tenant or message…" leftIcon={<Search />} />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {(['all', 'sent', 'failed', 'pending', 'cancelled'] as const).map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={cn('px-3 py-1.5 rounded-owner-full text-xs font-semibold capitalize transition-colors',
                statusFilter === s ? 'bg-owner-primary text-owner-primary-fg' : 'bg-owner-surface-hover text-owner-muted hover:text-owner-fg')}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <OwnerCard><OwnerEmptyState icon={Search} title="No messages match" className="py-10" /></OwnerCard>
      ) : filtered.map(l => (
        <OwnerCard key={l.id} padding="sm" className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-owner-fg truncate">{l.tenant?.name ?? 'Unknown tenant'}</div>
            <div className="text-xs text-owner-muted truncate">{l.rendered_message}</div>
          </div>
          <div className="text-right shrink-0">
            <OwnerBadge tone={l.status === 'sent' ? 'success' : l.status === 'failed' ? 'danger' : 'neutral'} size="sm" className="capitalize">{l.status}</OwnerBadge>
            <div className="text-[11px] text-owner-muted-subtle mt-1">{formatDate(l.created_at)}</div>
          </div>
        </OwnerCard>
      ))}
    </div>
  )
}

// ─── Communication Settings modal ──────────────────────────────────────────
function SettingsModal({ propertyId, onClose, onSaved }: { propertyId: string; onClose: () => void; onSaved: () => void }) {
  const [whatsappEnabled, setWhatsappEnabled] = useState(true)
  const [pushEnabled, setPushEnabled] = useState(true)
  const [reminderDays, setReminderDays] = useState('3')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getCommunicationSettings(propertyId).then(s => {
      if (s) {
        setWhatsappEnabled(s.whatsapp_enabled)
        setPushEnabled(s.push_enabled)
        setReminderDays(String(s.default_reminder_days))
      }
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [propertyId])

  async function handleSave() {
    setSaving(true)
    try {
      await upsertCommunicationSettings(propertyId, {
        whatsapp_enabled: whatsappEnabled,
        push_enabled: pushEnabled,
        default_reminder_days: Number(reminderDays) || 3,
      })
      toast.success('Communication settings saved')
      onSaved()
      onClose()
    } catch (e: any) { toast.error(friendlyErrorMessage(e)) }
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-owner-surface-elevated rounded-owner-2xl w-full max-w-sm shadow-owner-lg border border-owner-border animate-owner-scale-in">
        <div className="px-6 py-4 border-b border-owner-border flex items-center justify-between">
          <h2 className="text-base font-bold text-owner-fg">Communication Settings</h2>
          <OwnerIconButton aria-label="Close" variant="ghost" size="sm" onClick={onClose}><X /></OwnerIconButton>
        </div>
        {loading ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-10 rounded-owner-lg bg-owner-surface-hover animate-pulse" />)}
          </div>
        ) : (
          <div className="p-6 space-y-4">
            <label className="flex items-center justify-between p-3 bg-owner-bg-subtle rounded-owner-lg cursor-pointer">
              <span className="text-sm font-medium text-owner-fg">WhatsApp (click-to-chat)</span>
              <input type="checkbox" checked={whatsappEnabled} onChange={e => setWhatsappEnabled(e.target.checked)} className="accent-owner-primary w-4 h-4" />
            </label>
            <label className="flex items-center justify-between p-3 bg-owner-bg-subtle rounded-owner-lg cursor-pointer">
              <span className="text-sm font-medium text-owner-fg">Push Notifications</span>
              <input type="checkbox" checked={pushEnabled} onChange={e => setPushEnabled(e.target.checked)} className="accent-owner-primary w-4 h-4" />
            </label>
            <OwnerInput
              label="Default Reminder Lead Time (days)"
              type="number"
              value={reminderDays}
              onChange={e => setReminderDays(e.target.value)}
              hint="Minimum days between reminders to the same tenant — used by the Reminders tab"
            />
          </div>
        )}
        <div className="px-6 py-4 border-t border-owner-border">
          <OwnerButton onClick={handleSave} loading={saving} fullWidth disabled={loading}>Save Settings</OwnerButton>
        </div>
      </div>
    </div>
  )
}
