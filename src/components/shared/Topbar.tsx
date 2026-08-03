'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Menu, Search, Bell, ChevronDown, Building2, Layers, Plus, Loader2, Users, BedDouble } from 'lucide-react'
import { useProperty } from './PropertyContext'
import { cn } from '@/lib/utils'
import { getOwnerNotifications, getDashboardStats, getTenants, getRooms } from '@/lib/supabase/queries'
import { OwnerIconButton, OwnerInput } from '@/components/owner/ui'
import AddPropertyModal from './AddPropertyModal'
import OfflineQueueBadge from './OfflineQueueBadge'
import type { Tenant, Room } from '@/types'

interface Props {
  onMenuClick: () => void
}

export default function Topbar({ onMenuClick }: Props) {
  const router = useRouter()
  const { properties, activeId, setActiveId, active, refresh } = useProperty()
  const [propOpen, setPropOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [notifications, setNotifications] = useState<any[]>([])
  const [occupancy, setOccupancy] = useState<Record<string, number>>({})
  const [searchFocused, setSearchFocused] = useState(false)
  const [searching, setSearching] = useState(false)
  const [searchResults, setSearchResults] = useState<{ tenants: Tenant[]; rooms: Room[] }>({ tenants: [], rooms: [] })

  useEffect(() => {
    const propIds = activeId === 'all' ? properties.map(p => p.id) : [activeId]
    if (propIds.length === 0 || propIds.some(id => !id)) return
    getOwnerNotifications(propIds).then(setNotifications).catch(() => setNotifications([]))
  }, [activeId, properties])

  // Global Search (Phase 5.7) — debounced so we don't hit the database on every
  // keystroke. Scoped to the currently selected property/properties, same as
  // every other page in the app. Ported forward from the pre-Phase-7 Topbar,
  // since Phase 7's redesigned search box was cosmetic-only (no results).
  useEffect(() => {
    const query = search.trim().toLowerCase()
    if (query.length < 2) { setSearchResults({ tenants: [], rooms: [] }); setSearching(false); return }
    const propIds = activeId === 'all' ? properties.map(p => p.id) : [activeId]
    if (propIds.length === 0 || propIds.some(id => !id)) return

    setSearching(true)
    const handle = setTimeout(async () => {
      try {
        const [tenantLists, roomLists] = await Promise.all([
          Promise.all(propIds.map(id => getTenants(id))),
          Promise.all(propIds.map(id => getRooms(id))),
        ])
        const tenants = (tenantLists.flat() as Tenant[])
          .filter(t => t.name.toLowerCase().includes(query) || t.phone.includes(query))
          .slice(0, 5)
        const rooms = (roomLists.flat() as Room[])
          .filter(r => r.room_number.toLowerCase().includes(query))
          .slice(0, 5)
        setSearchResults({ tenants, rooms })
      } catch {
        setSearchResults({ tenants: [], rooms: [] })
      }
      setSearching(false)
    }, 300)
    return () => clearTimeout(handle)
  }, [search, activeId, properties])

  function goToTenants() {
    setSearchFocused(false); setSearch('')
    router.push('/tenants')
  }
  function goToRooms() {
    setSearchFocused(false); setSearch('')
    router.push('/rooms')
  }

  useEffect(() => {
    if (!propOpen || properties.length === 0) return
    Promise.all(properties.map(p => getDashboardStats(p.id).then(s => [p.id, Math.round((s.occupiedBeds / (s.totalBeds || 1)) * 100)] as const)))
      .then(entries => setOccupancy(Object.fromEntries(entries)))
      .catch(() => {})
  }, [propOpen, properties])

  async function handlePropertyCreated(id: string) {
    setPropOpen(false)
    await refresh()
    setActiveId(id)
  }


  return (
    <header className="min-h-14 native-safe-top bg-owner-surface border-b border-owner-border flex items-center px-4 gap-3 sticky top-0 z-30">
      {/* Hamburger */}
      <OwnerIconButton aria-label="Open menu" variant="ghost" size="md" onClick={onMenuClick} className="lg:hidden">
        <Menu />
      </OwnerIconButton>

      {/* Property Switcher */}
      <div className="relative">
        <button onClick={() => setPropOpen(o => !o)}
          className="flex items-center gap-2 px-3 py-1.5 bg-owner-bg-subtle border border-owner-border rounded-owner-lg hover:bg-owner-surface-hover transition-colors min-w-[160px]">
          <Building2 className="w-4 h-4 text-owner-primary shrink-0" />
          <div className="flex-1 text-left min-w-0">
            <div className="text-xs font-bold text-owner-fg leading-tight truncate">
              {activeId === 'all' ? 'All Properties' : active?.name ?? 'Select PG'}
            </div>
            {activeId !== 'all' && active && (
              <div className="text-[10px] text-owner-muted-subtle truncate">{active.city}</div>
            )}
          </div>
          <ChevronDown className={cn('w-3.5 h-3.5 text-owner-muted shrink-0 transition-transform', propOpen && 'rotate-180')} />
        </button>

        {propOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setPropOpen(false)} />
            <div className="absolute top-full left-0 mt-1.5 w-64 bg-owner-surface-elevated rounded-owner-xl shadow-owner-lg border border-owner-border z-50 overflow-hidden animate-owner-fade-in">
              <button onClick={() => { setActiveId('all'); setPropOpen(false) }}
                className={cn('w-full flex items-center gap-3 px-4 py-3 hover:bg-owner-surface-hover text-left transition-colors',
                  activeId === 'all' && 'bg-owner-primary/10')}>
                <Layers className="w-4 h-4 text-owner-primary shrink-0" />
                <div>
                  <div className="text-sm font-semibold text-owner-fg">All Properties</div>
                  <div className="text-xs text-owner-muted-subtle">Combined view · {properties.length} PGs</div>
                </div>
              </button>
              <div className="border-t border-owner-border" />
              {properties.map(p => (
                <button key={p.id} onClick={() => { setActiveId(p.id); setPropOpen(false) }}
                  className={cn('w-full flex items-center gap-3 px-4 py-3 hover:bg-owner-surface-hover text-left border-b border-owner-border last:border-0 transition-colors',
                    activeId === p.id && 'bg-owner-primary/10')}>
                  <div className="w-8 h-8 rounded-owner-md bg-owner-primary flex items-center justify-center text-white font-bold text-xs shrink-0">
                    {p.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-owner-fg truncate">{p.name}</div>
                    <div className={cn('text-xs font-medium',
                      occupancy[p.id] !== undefined && occupancy[p.id] >= 90 ? 'text-owner-success' :
                      occupancy[p.id] !== undefined && occupancy[p.id] < 50 ? 'text-owner-danger' : 'text-owner-muted-subtle')}>
                      {occupancy[p.id] !== undefined ? `${occupancy[p.id]}% Occupied` : p.city}
                    </div>
                  </div>
                </button>
              ))}
              <div className="border-t border-owner-border">
                <button onClick={() => { setAddOpen(true); setPropOpen(false) }}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-owner-primary text-sm font-semibold hover:bg-owner-primary/10 transition-colors">
                  <Plus className="w-4 h-4" /> Add Property
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Search (Phase 5.7 results dropdown restored on top of Phase 7's OwnerInput) */}
      <div className="relative flex-1 max-w-xs hidden sm:block">
        <OwnerInput
          value={search}
          onChange={e => setSearch(e.target.value)}
          onFocus={() => setSearchFocused(true)}
          placeholder="Search tenants, rooms…"
          leftIcon={<Search />}
          className="h-8 bg-owner-bg-subtle"
        />

        {searchFocused && search.trim().length >= 2 && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setSearchFocused(false)} />
            <div className="absolute top-full left-0 mt-1.5 w-80 bg-owner-surface-elevated rounded-owner-xl shadow-owner-lg border border-owner-border z-50 overflow-hidden">
              {searching ? (
                <div className="flex items-center justify-center py-6 text-owner-muted text-sm gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> Searching…
                </div>
              ) : searchResults.tenants.length === 0 && searchResults.rooms.length === 0 ? (
                <div className="text-center py-6 text-sm text-owner-muted">No matches for &ldquo;{search}&rdquo;</div>
              ) : (
                <div className="max-h-80 overflow-y-auto">
                  {searchResults.tenants.length > 0 && (
                    <div>
                      <div className="px-4 pt-3 pb-1 text-[10px] font-bold text-owner-muted-subtle uppercase tracking-wide">Tenants</div>
                      {searchResults.tenants.map(t => (
                        <button key={t.id} onClick={goToTenants}
                          className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-owner-surface-hover text-left transition-colors">
                          <Users className="w-3.5 h-3.5 text-owner-primary shrink-0" />
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-semibold text-owner-fg truncate">{t.name}</div>
                            <div className="text-xs text-owner-muted-subtle">{t.phone}{t.room?.room_number ? ` · Room ${t.room.room_number}` : ''}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                  {searchResults.rooms.length > 0 && (
                    <div>
                      <div className="px-4 pt-3 pb-1 text-[10px] font-bold text-owner-muted-subtle uppercase tracking-wide border-t border-owner-border">Rooms</div>
                      {searchResults.rooms.map(r => (
                        <button key={r.id} onClick={goToRooms}
                          className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-owner-surface-hover text-left transition-colors">
                          <BedDouble className="w-3.5 h-3.5 text-owner-primary shrink-0" />
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-semibold text-owner-fg truncate">Room {r.room_number}</div>
                            <div className="text-xs text-owner-muted-subtle">{r.sharing_type} · {r.total_beds} bed{r.total_beds === 1 ? '' : 's'}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <div className="ml-auto flex items-center gap-1.5">
        <OfflineQueueBadge />

        {/* Notifications */}
        <div className="relative">
          <OwnerIconButton aria-label="Notifications" variant="surface" size="md" badge={notifications.length} onClick={() => setNotifOpen(o => !o)}>
            <Bell />
          </OwnerIconButton>
          {notifOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setNotifOpen(false)} />
              <div className="absolute top-full right-0 mt-1.5 w-80 bg-owner-surface-elevated rounded-owner-xl shadow-owner-lg border border-owner-border z-50 overflow-hidden animate-owner-fade-in">
                <div className="px-4 py-3 border-b border-owner-border font-bold text-sm text-owner-fg">Notifications</div>
                <div className="max-h-80 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="text-center py-8 text-sm text-owner-muted">You&apos;re all caught up!</div>
                  ) : notifications.map(n => (
                    <button key={n.id} onClick={() => { setNotifOpen(false); router.push(n.link) }}
                      className="w-full text-left px-4 py-3 hover:bg-owner-surface-hover border-b border-owner-border last:border-0 transition-colors">
                      <div className="text-sm font-semibold text-owner-fg">{n.title}</div>
                      <div className="text-xs text-owner-muted mt-0.5">{n.subtitle}</div>
                    </button>
                  ))}
                </div>
                {notifications.length > 0 && (
                  <button onClick={() => { setNotifOpen(false); router.push('/notifications') }}
                    className="w-full text-center py-2.5 text-xs font-semibold text-owner-primary hover:bg-owner-surface-hover border-t border-owner-border transition-colors">
                    View All
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      <AddPropertyModal open={addOpen} onClose={() => setAddOpen(false)} onCreated={handlePropertyCreated} />
    </header>
  )
}
