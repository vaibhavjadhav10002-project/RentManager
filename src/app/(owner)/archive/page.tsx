'use client'
import { useEffect, useState, useCallback, useMemo } from 'react'
import { useProperty } from '@/components/shared/PropertyContext'
import {
  getVisitors, getParcels, getWaitingList,
  restoreVisitor, restoreParcel, restoreWaitingListEntry,
} from '@/lib/supabase/queries'
import { toast } from 'sonner'
import { Archive, RotateCcw, Loader2, UserCheck, Package, Users2 } from 'lucide-react'
import type { Visitor, Parcel, WaitingListEntry } from '@/types'
import { SkeletonList } from '@/components/shared/Skeleton'
import { usePullToRefreshHandler } from '@/lib/native/pullToRefresh'

type Kind = 'visitor' | 'parcel' | 'waiting'
interface ArchivedItem { id: string; kind: Kind; title: string; subtitle: string; archivedAt: string }

const KIND_META: Record<Kind, { label: string; icon: typeof UserCheck; color: string }> = {
  visitor: { label: 'Visitors', icon: UserCheck, color: 'text-blue-600 bg-blue-50' },
  parcel: { label: 'Parcels', icon: Package, color: 'text-amber-600 bg-amber-50' },
  waiting: { label: 'Waiting List', icon: Users2, color: 'text-purple-600 bg-purple-50' },
}

/**
 * Archive & Restore is scoped to the three operational tables built earlier in this
 * phase (Visitors, Parcels, Waiting List) — the ones this account actually owns end
 * to end. Nothing here touches Complaints, Notices, or any tenant/dashboard feature.
 */
export default function ArchivePage() {
  const { activeId, properties } = useProperty()
  const [items, setItems] = useState<ArchivedItem[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | Kind>('all')
  const [actioningId, setActioningId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const ids = activeId === 'all' ? properties.map(p => p.id) : [activeId]
      if (ids.length === 0 || ids.some(id => !id)) { setItems([]); setLoading(false); return }

      const [visitorLists, parcelLists, waitingLists] = await Promise.all([
        Promise.all(ids.map(id => getVisitors(id, true))),
        Promise.all(ids.map(id => getParcels(id, true))),
        Promise.all(ids.map(id => getWaitingList(id, true))),
      ])

      const out: ArchivedItem[] = []
      ;(visitorLists.flat() as Visitor[]).filter(v => v.archived_at).forEach(v => {
        out.push({ id: v.id, kind: 'visitor', title: v.visitor_name, subtitle: v.purpose || 'No purpose noted', archivedAt: v.archived_at! })
      })
      ;(parcelLists.flat() as Parcel[]).filter(p => p.archived_at).forEach(p => {
        out.push({ id: p.id, kind: 'parcel', title: p.tenant?.name ?? 'Unknown tenant', subtitle: p.courier_name || 'Courier not noted', archivedAt: p.archived_at! })
      })
      ;(waitingLists.flat() as WaitingListEntry[]).filter(w => w.archived_at).forEach(w => {
        out.push({ id: w.id, kind: 'waiting', title: w.name, subtitle: `${w.phone} · ${w.status}`, archivedAt: w.archived_at! })
      })

      out.sort((a, b) => (a.archivedAt < b.archivedAt ? 1 : -1))
      setItems(out)
    } catch { toast.error('Failed to load archived items') }
    setLoading(false)
  }, [activeId, properties])

  useEffect(() => { load() }, [load])
  usePullToRefreshHandler(load)

  const filtered = useMemo(() => (filter === 'all' ? items : items.filter(i => i.kind === filter)), [items, filter])
  const counts = useMemo(() => {
    const c: Record<Kind, number> = { visitor: 0, parcel: 0, waiting: 0 }
    items.forEach(i => { c[i.kind]++ })
    return c
  }, [items])

  async function handleRestore(item: ArchivedItem) {
    setActioningId(item.id)
    const prev = items
    setItems(its => its.filter(i => i.id !== item.id))
    try {
      if (item.kind === 'visitor') await restoreVisitor(item.id)
      else if (item.kind === 'parcel') await restoreParcel(item.id)
      else await restoreWaitingListEntry(item.id)
      toast.success('Restored')
    } catch (e: any) { setItems(prev); toast.error(e.message || 'Failed to restore') }
    setActioningId(null)
  }

  if (loading) return (
    <SkeletonList rows={5} />
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-extrabold text-owner-fg">Archive &amp; Restore</h1>
        <p className="text-sm text-owner-muted">Archived visitors, parcels, and waiting-list entries live here</p>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <button onClick={() => setFilter('all')}
          className={`px-3 py-1.5 rounded-owner-full text-xs font-semibold transition active:scale-[0.97] ${filter === 'all' ? 'bg-owner-primary text-owner-primary-fg' : 'bg-owner-surface-hover text-owner-muted hover:text-owner-fg'}`}>
          All ({items.length})
        </button>
        {(Object.keys(KIND_META) as Kind[]).map(k => (
          <button key={k} onClick={() => setFilter(k)}
            className={`px-3 py-1.5 rounded-owner-full text-xs font-semibold transition active:scale-[0.97] ${filter === k ? 'bg-owner-primary text-owner-primary-fg' : 'bg-owner-surface-hover text-owner-muted hover:text-owner-fg'}`}>
            {KIND_META[k].label} ({counts[k]})
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="bg-owner-surface rounded-owner-xl border border-owner-border shadow-owner-xs flex flex-col items-center justify-center py-16 text-owner-muted-subtle gap-2">
          <Archive className="w-8 h-8" />
          <div className="text-sm">Nothing archived{filter !== 'all' ? ` in ${KIND_META[filter as Kind].label}` : ''}</div>
        </div>
      ) : (
        <div className="bg-owner-surface rounded-owner-xl border border-owner-border shadow-owner-xs divide-y divide-owner-border">
          {filtered.map(item => {
            const meta = KIND_META[item.kind]
            return (
              <div key={`${item.kind}-${item.id}`} className="flex items-center gap-3 px-5 py-4">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${meta.color}`}>
                  <meta.icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-owner-fg">{item.title}</div>
                  <div className="text-xs text-owner-muted-subtle">
                    {item.subtitle} · Archived {new Date(item.archivedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </div>
                </div>
                <button onClick={() => handleRestore(item)} disabled={actioningId === item.id}
                  className="flex items-center gap-1 px-3 py-1.5 bg-owner-primary/10 hover:bg-owner-primary/15 text-owner-primary rounded-owner-md text-xs font-semibold transition disabled:opacity-50 flex-shrink-0">
                  {actioningId === item.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />} Restore
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
