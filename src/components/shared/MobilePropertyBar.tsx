'use client'
import { useState, useEffect } from 'react'
import { Home, Plus, ChevronDown, Layers, Check } from 'lucide-react'
import { useProperty } from './PropertyContext'
import { cn } from '@/lib/utils'
import { getDashboardStats } from '@/lib/supabase/queries'
import AddPropertyModal from './AddPropertyModal'

/**
 * Mobile property switcher strip (screens: Home, All features). Same data
 * and behaviour as the Topbar switcher — useProperty() + AddPropertyModal.
 */
export default function MobilePropertyBar() {
  const { properties, activeId, setActiveId, active, refresh } = useProperty()
  const [open, setOpen] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [occupancy, setOccupancy] = useState<Record<string, number>>({})

  useEffect(() => {
    if (!open || properties.length === 0) return
    Promise.all(properties.map(p => getDashboardStats(p.id).then(s => [p.id, Math.round((s.occupiedBeds / (s.totalBeds || 1)) * 100)] as const)))
      .then(e => setOccupancy(Object.fromEntries(e))).catch(() => {})
  }, [open, properties])

  async function created(id: string) {
    setOpen(false)
    await refresh()
    setActiveId(id)
  }

  const label = properties.length === 0 ? 'No property' : activeId === 'all' ? 'All properties' : active?.name ?? 'Select property'

  return (
    <div className="relative">
      <div className="flex items-center gap-3 rounded-2xl bg-owner-bg-subtle px-3 py-2.5">
        <button
          type="button"
          onClick={() => properties.length > 0 && setOpen(o => !o)}
          className="flex flex-1 min-w-0 items-center gap-3 text-left"
          aria-expanded={open}
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-owner-primary text-white">
            <Home className="h-4 w-4" />
          </span>
          <span className="truncate text-[15px] font-semibold text-owner-fg">{label}</span>
          {properties.length > 0 && <ChevronDown className={cn('h-4 w-4 shrink-0 text-owner-muted transition-transform', open && 'rotate-180')} />}
        </button>
        <button type="button" onClick={() => setAddOpen(true)} className="flex shrink-0 items-center gap-1 text-[15px] font-semibold text-owner-primary">
          <Plus className="h-4 w-4" /> Add property
        </button>
      </div>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-2xl border border-owner-border bg-owner-surface-elevated shadow-owner-lg">
            <button onClick={() => { setActiveId('all'); setOpen(false) }}
              className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-owner-surface-hover">
              <Layers className="h-4 w-4 text-owner-primary" />
              <div className="flex-1">
                <div className="text-sm font-semibold text-owner-fg">All properties</div>
                <div className="text-xs text-owner-muted-subtle">Combined view · {properties.length}</div>
              </div>
              {activeId === 'all' && <Check className="h-4 w-4 text-owner-primary" />}
            </button>
            {properties.map(p => (
              <button key={p.id} onClick={() => { setActiveId(p.id); setOpen(false) }}
                className="flex w-full items-center gap-3 border-t border-owner-border px-4 py-3 text-left active:bg-owner-surface-hover">
                <span className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-owner-primary/12 text-xs font-bold text-owner-primary">{p.name.slice(0, 2).toUpperCase()}</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-owner-fg">{p.name}</div>
                  <div className="text-xs text-owner-muted-subtle">{occupancy[p.id] !== undefined ? `${occupancy[p.id]}% occupied` : p.city}</div>
                </div>
                {activeId === p.id && <Check className="h-4 w-4 text-owner-primary" />}
              </button>
            ))}
          </div>
        </>
      )}

      <AddPropertyModal open={addOpen} onClose={() => setAddOpen(false)} onCreated={created} />
    </div>
  )
}
