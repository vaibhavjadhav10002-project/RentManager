'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useProperty } from '@/components/shared/PropertyContext'
import { getOwnerNotifications } from '@/lib/supabase/queries'
import { formatDate } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { CheckCircle, IndianRupee, UserPlus, MessageSquareWarning } from 'lucide-react'
import { OwnerCard, OwnerEmptyState } from '@/components/owner/ui'
import { usePullToRefreshHandler } from '@/lib/native/pullToRefresh'

/**
 * Notification Center — O12. No dedicated page existed before (Topbar has
 * a dropdown, Dashboard has a widget — both from earlier phases). This
 * reuses the exact same getOwnerNotifications() both of those already
 * call — same real data (pending payment claims, pending tenant
 * approvals, open complaints), including its real `type` and `createdAt`
 * fields, which made a genuine categorized timeline possible without
 * inferring anything client-side. Zero new queries.
 *
 * Read/unread is session-only local state, same honest caveat as the
 * Tenant Portal's Notification Center (T6) — there's no notifications
 * table or read-state column in this schema, so nothing here is
 * persisted across a refresh.
 */
const CATEGORY_META = {
  payment: { label: 'Payments', icon: IndianRupee, bg: 'bg-owner-primary/12', fg: 'text-owner-primary' },
  tenant: { label: 'Approvals', icon: UserPlus, bg: 'bg-owner-info/12', fg: 'text-owner-info' },
  complaint: { label: 'Complaints', icon: MessageSquareWarning, bg: 'bg-owner-warning/12', fg: 'text-owner-warning' },
} as const

export default function NotificationsPage() {
  const router = useRouter()
  const { activeId, properties } = useProperty()
  const [items, setItems] = useState<any[]>([])
  const [refreshKey, setRefreshKey] = useState(0)
  usePullToRefreshHandler(() => setRefreshKey(k => k + 1))
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | keyof typeof CATEGORY_META>('all')
  const [readIds, setReadIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    const propIds = activeId === 'all' ? properties.map(p => p.id) : [activeId]
    if (propIds.length === 0 || propIds.some(id => !id)) { setLoading(false); return }
    setLoading(true)
    getOwnerNotifications(propIds).then(setItems).catch(() => setItems([])).finally(() => setLoading(false))
  }, [activeId, properties, refreshKey])

  const filtered = filter === 'all' ? items : items.filter(n => n.type === filter)
  const unreadCount = items.filter(n => !readIds.has(n.id)).length

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-extrabold text-owner-fg">Notifications</h1>
          <p className="text-sm text-owner-muted">{unreadCount > 0 ? `${unreadCount} need your attention` : 'All caught up'}</p>
        </div>
        {unreadCount > 0 && (
          <button onClick={() => setReadIds(new Set(items.map(n => n.id)))} className="text-xs font-semibold text-owner-primary hover:underline">
            Mark all read
          </button>
        )}
      </div>

      <div className="flex gap-2 flex-wrap">
        {(['all', 'payment', 'tenant', 'complaint'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={cn('px-3.5 h-8 rounded-owner-full text-xs font-semibold transition-colors',
              filter === f ? 'bg-owner-primary text-owner-primary-fg' : 'bg-owner-surface-hover text-owner-muted hover:text-owner-fg')}>
            {f === 'all' ? 'All' : CATEGORY_META[f].label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-16 rounded-owner-xl bg-owner-surface-hover animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <OwnerCard>
          <OwnerEmptyState icon={CheckCircle} title="You're all caught up!" subtitle="Nothing needs your attention right now." />
        </OwnerCard>
      ) : (
        <div className="relative pl-4">
          <div className="absolute left-[7px] top-2 bottom-2 w-px bg-owner-border" />
          <div className="space-y-2.5">
            {filtered.map(n => {
              const isRead = readIds.has(n.id)
              const meta = CATEGORY_META[n.type as keyof typeof CATEGORY_META] ?? CATEGORY_META.complaint
              const Icon = meta.icon
              return (
                <div key={n.id} className="relative flex gap-3">
                  <span className={cn('absolute -left-4 top-5 w-2.5 h-2.5 rounded-full ring-4 ring-owner-bg', isRead ? 'bg-owner-border-strong' : 'bg-owner-primary')} />
                  <button
                    onClick={() => { setReadIds(prev => new Set(prev).add(n.id)); router.push(n.link) }}
                    className={cn('flex-1 text-left flex items-start gap-3 p-4 rounded-owner-xl border transition-colors',
                      isRead ? 'bg-owner-surface/60 border-owner-border' : 'bg-owner-surface border-owner-border shadow-owner-xs')}
                  >
                    <div className={cn('w-9 h-9 rounded-owner-lg flex items-center justify-center shrink-0', meta.bg)}>
                      <Icon className={cn('w-4 h-4', meta.fg)} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className={cn('text-sm truncate', isRead ? 'font-medium text-owner-muted' : 'font-bold text-owner-fg')}>{n.title}</div>
                      <div className="text-xs text-owner-muted mt-0.5">{n.subtitle}</div>
                      <div className="text-[11px] text-owner-muted-subtle mt-1">{formatDate(n.createdAt)}</div>
                    </div>
                    {!isRead && <span className="w-2 h-2 rounded-full bg-owner-danger shrink-0 mt-1.5" />}
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
