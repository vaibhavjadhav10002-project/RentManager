'use client'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useProperty } from '@/components/shared/PropertyContext'
import { getPayments, getTenants, getComplaints, getExpenses, getNoticesForProperty } from '@/lib/supabase/queries'
import { formatINR } from '@/lib/utils'
import {
  ChevronLeft, History, IndianRupee, UserPlus, MessageSquareWarning,
  CheckCircle2, TrendingDown, Megaphone, Loader2,
} from 'lucide-react'
import { toast } from 'sonner'
import type { LucideIcon } from 'lucide-react'

type EventKind = 'payment' | 'tenant' | 'complaint' | 'expense' | 'notice'

interface ActivityEvent {
  id: string
  timestamp: string
  kind: EventKind
  title: string
  subtitle: string
  icon: LucideIcon
  color: string
}

const KIND_LABEL: Record<EventKind, string> = {
  payment: 'Payments', tenant: 'Tenants', complaint: 'Complaints', expense: 'Expenses', notice: 'Notices',
}

/**
 * Activity Logs is not backed by a dedicated audit table — the project has none, and adding one plus
 * triggers on every mutating table would be a much bigger schema change than a read-only report
 * warrants. Instead this synthesizes a real, non-fabricated feed from timestamps that already exist
 * on payments, tenants, complaints, expenses and notices (created_at / resolved_at / approved_at).
 * Every event links back to something that actually happened — nothing here is invented.
 */
export default function ActivityLogPage() {
  const { activeId, properties } = useProperty()
  const [events, setEvents] = useState<ActivityEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | EventKind>('all')

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const propIds = activeId === 'all' ? properties.map(p => p.id) : [activeId]
        if (propIds.length === 0 || propIds.some(id => !id)) { setEvents([]); setLoading(false); return }

        const [paymentsLists, tenantsLists, complaintsLists, expensesLists, noticesLists] = await Promise.all([
          Promise.all(propIds.map(id => getPayments(id))),
          Promise.all(propIds.map(id => getTenants(id))),
          Promise.all(propIds.map(id => getComplaints(id))),
          Promise.all(propIds.map(id => getExpenses(id))),
          Promise.all(propIds.map(id => getNoticesForProperty(id))),
        ])

        const out: ActivityEvent[] = []

        paymentsLists.flat().forEach((p: any) => {
          const statusWord = p.approval_status === 'approved' ? 'recorded' : p.approval_status === 'rejected' ? 'rejected' : 'submitted for approval'
          out.push({
            id: `payment-${p.id}`, timestamp: p.created_at, kind: 'payment',
            title: `${formatINR(p.amount_received)} ${p.type} payment ${statusWord}`,
            subtitle: p.tenant?.name ? `${p.tenant.name}${p.tenant.room?.room_number ? ' · Room ' + p.tenant.room.room_number : ''}` : 'Tenant',
            icon: IndianRupee, color: 'text-green-600 bg-green-50',
          })
        })

        tenantsLists.flat().forEach((t: any) => {
          out.push({
            id: `tenant-${t.id}`, timestamp: t.created_at, kind: 'tenant',
            title: `Tenant added: ${t.name}`,
            subtitle: t.room?.room_number ? `Room ${t.room.room_number}` : 'Unassigned room',
            icon: UserPlus, color: 'text-blue-600 bg-blue-50',
          })
          if (t.approved_at) {
            out.push({
              id: `tenant-approved-${t.id}`, timestamp: t.approved_at, kind: 'tenant',
              title: `Tenant approved: ${t.name}`,
              subtitle: 'Joined via QR link',
              icon: CheckCircle2, color: 'text-blue-600 bg-blue-50',
            })
          }
        })

        complaintsLists.flat().forEach((c: any) => {
          out.push({
            id: `complaint-${c.id}`, timestamp: c.created_at, kind: 'complaint',
            title: `Complaint raised: ${c.issue_type}`,
            subtitle: c.tenant?.name ?? 'Tenant',
            icon: MessageSquareWarning, color: 'text-amber-600 bg-amber-50',
          })
          if (c.resolved_at) {
            out.push({
              id: `complaint-resolved-${c.id}`, timestamp: c.resolved_at, kind: 'complaint',
              title: `Complaint resolved: ${c.issue_type}`,
              subtitle: c.tenant?.name ?? 'Tenant',
              icon: CheckCircle2, color: 'text-green-600 bg-green-50',
            })
          }
        })

        expensesLists.flat().forEach((e: any) => {
          out.push({
            id: `expense-${e.id}`, timestamp: e.created_at, kind: 'expense',
            title: `Expense recorded: ${e.category} — ${formatINR(e.amount)}`,
            subtitle: e.notes || 'No notes',
            icon: TrendingDown, color: 'text-red-600 bg-red-50',
          })
        })

        noticesLists.flat().forEach((n: any) => {
          out.push({
            id: `notice-${n.id}`, timestamp: n.created_at, kind: 'notice',
            title: `Notice published: ${n.title}`,
            subtitle: n.category,
            icon: Megaphone, color: 'text-purple-600 bg-purple-50',
          })
        })

        out.sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1))
        setEvents(out)
      } catch { toast.error('Failed to load activity logs') }
      setLoading(false)
    }
    load()
  }, [activeId, properties])

  const filtered = useMemo(() => (filter === 'all' ? events : events.filter(e => e.kind === filter)).slice(0, 200), [events, filter])
  const counts = useMemo(() => {
    const c: Record<EventKind, number> = { payment: 0, tenant: 0, complaint: 0, expense: 0, notice: 0 }
    events.forEach(e => { c[e.kind]++ })
    return c
  }, [events])

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-owner-muted">
      <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading activity…
    </div>
  )

  return (
    <div className="space-y-6">
      <Link href="/reports" className="inline-flex items-center gap-1 text-sm font-semibold text-owner-muted hover:text-owner-fg transition">
        <ChevronLeft className="w-4 h-4" /> Reports Dashboard
      </Link>

      <div>
        <h1 className="text-xl font-extrabold text-owner-fg">Activity Logs</h1>
        <p className="text-sm text-owner-muted">A timeline of key actions across your properties</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-1.5">
        <button onClick={() => setFilter('all')}
          className={`px-3 py-1.5 rounded-owner-full text-xs font-semibold transition active:scale-[0.97] ${filter === 'all' ? 'bg-owner-primary text-owner-primary-fg' : 'bg-owner-surface-hover text-owner-muted hover:text-owner-fg'}`}>
          All ({events.length})
        </button>
        {(Object.keys(KIND_LABEL) as EventKind[]).map(k => (
          <button key={k} onClick={() => setFilter(k)}
            className={`px-3 py-1.5 rounded-owner-full text-xs font-semibold transition active:scale-[0.97] ${filter === k ? 'bg-owner-primary text-owner-primary-fg' : 'bg-owner-surface-hover text-owner-muted hover:text-owner-fg'}`}>
            {KIND_LABEL[k]} ({counts[k]})
          </button>
        ))}
      </div>

      {/* Timeline */}
      <div className="bg-owner-surface rounded-owner-xl border border-owner-border shadow-owner-xs overflow-hidden">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-owner-muted-subtle gap-2">
            <History className="w-8 h-8" />
            <div className="text-sm">No activity yet</div>
          </div>
        ) : (
          <div className="divide-y divide-owner-border">
            {filtered.map(e => (
              <div key={e.id} className="flex items-start gap-3 px-5 py-4">
                <div className={`w-9 h-9 rounded-owner-lg flex items-center justify-center shrink-0 ${e.color}`}>
                  <e.icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-owner-fg">{e.title}</div>
                  <div className="text-xs text-owner-muted-subtle">{e.subtitle}</div>
                </div>
                <div className="text-xs text-owner-muted-subtle whitespace-nowrap shrink-0">
                  {new Date(e.timestamp).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      {events.length > 200 && filtered.length === 200 && (
        <p className="text-xs text-owner-muted-subtle text-center">Showing the 200 most recent events for this filter.</p>
      )}
    </div>
  )
}
