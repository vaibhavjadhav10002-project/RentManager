'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Building2, Plus, MapPin, Users, BedDouble, IndianRupee, Pencil, LayoutDashboard } from 'lucide-react'
import { useProperty } from '@/components/shared/PropertyContext'
import { getDashboardStats } from '@/lib/supabase/queries'
import { formatINR } from '@/lib/utils'
import AddPropertyModal from '@/components/shared/AddPropertyModal'
import { OwnerCard, OwnerButton, OwnerIconButton, OwnerBadge, OwnerEmptyState } from '@/components/owner/ui'
import type { DashboardStats } from '@/types'
import { usePullToRefreshHandler } from '@/lib/native/pullToRefresh'

/**
 * Properties — O3. This page did not exist before; the app previously
 * only had the property switcher (Topbar) and per-property editing
 * inside Settings. Both of those still work exactly as before. This page
 * is a read-oriented directory layered on top of the same real data
 * (`getDashboardStats()` — already used by Dashboard and the Topbar
 * switcher) with "Edit" and "View Dashboard" actions that navigate to the
 * existing Settings/Dashboard pages (via `setActiveId`) rather than
 * duplicating any edit form or business logic here.
 */
export default function PropertiesPage() {
  const router = useRouter()
  const { properties, setActiveId, refresh } = useProperty()
  const [statsByProperty, setStatsByProperty] = useState<Record<string, DashboardStats>>({})
  const [refreshKey, setRefreshKey] = useState(0)
  usePullToRefreshHandler(() => setRefreshKey(k => k + 1))
  const [loading, setLoading] = useState(true)
  const [addOpen, setAddOpen] = useState(false)

  useEffect(() => {
    if (properties.length === 0) { setLoading(false); return }
    setLoading(true)
    Promise.all(properties.map(p => getDashboardStats(p.id).then(s => [p.id, s] as const)))
      .then(entries => setStatsByProperty(Object.fromEntries(entries)))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [properties, refreshKey])

  function goToSettings(propertyId: string) {
    setActiveId(propertyId)
    router.push('/settings')
  }

  function goToDashboard(propertyId: string) {
    setActiveId(propertyId)
    router.push('/dashboard')
  }

  async function handleCreated(id: string) {
    await refresh()
    setActiveId(id)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-extrabold text-owner-fg">Properties</h1>
          <p className="text-sm text-owner-muted mt-1">{properties.length} PG {properties.length === 1 ? 'property' : 'properties'}</p>
        </div>
        <OwnerButton onClick={() => setAddOpen(true)} icon={<Plus className="w-4 h-4" />}>
          Add Property
        </OwnerButton>
      </div>

      {properties.length === 0 ? (
        <OwnerCard>
          <OwnerEmptyState
            icon={Building2}
            title="No properties yet"
            subtitle="Add your first PG property to start tracking rooms, tenants and rent."
            action={<OwnerButton onClick={() => setAddOpen(true)} icon={<Plus className="w-4 h-4" />}>Add Property</OwnerButton>}
          />
        </OwnerCard>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {properties.map(p => {
            const stats = statsByProperty[p.id]
            const occupancyPct = stats ? Math.round((stats.occupiedBeds / (stats.totalBeds || 1)) * 100) : null
            return (
              <OwnerCard key={p.id} className="flex flex-col">
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-11 h-11 rounded-owner-lg bg-owner-primary flex items-center justify-center text-owner-primary-fg font-bold shrink-0">
                      {p.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-owner-fg truncate">{p.name}</div>
                      {(p.city || p.address) && (
                        <div className="text-xs text-owner-muted-subtle flex items-center gap-1 truncate">
                          <MapPin className="w-3 h-3 shrink-0" /> {[p.address, p.city].filter(Boolean).join(', ')}
                        </div>
                      )}
                    </div>
                  </div>
                  <OwnerIconButton aria-label={`Edit ${p.name}`} variant="surface" size="sm" onClick={() => goToSettings(p.id)}>
                    <Pencil />
                  </OwnerIconButton>
                </div>

                {loading ? (
                  <div className="grid grid-cols-3 gap-2 mb-4">
                    {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-14 rounded-owner-lg bg-owner-surface-hover animate-pulse" />)}
                  </div>
                ) : stats ? (
                  <div className="grid grid-cols-3 gap-2 mb-4">
                    <div className="bg-owner-bg-subtle rounded-owner-lg p-2.5 text-center">
                      <BedDouble className="w-3.5 h-3.5 text-owner-purple mx-auto mb-1" />
                      <div className="text-xs font-bold text-owner-fg owner-numeric">{stats.occupiedBeds}/{stats.totalBeds}</div>
                      <div className="text-[10px] text-owner-muted-subtle">Beds</div>
                    </div>
                    <div className="bg-owner-bg-subtle rounded-owner-lg p-2.5 text-center">
                      <Users className="w-3.5 h-3.5 text-owner-teal mx-auto mb-1" />
                      <div className="text-xs font-bold text-owner-fg owner-numeric">{stats.totalTenants}</div>
                      <div className="text-[10px] text-owner-muted-subtle">Tenants</div>
                    </div>
                    <div className="bg-owner-bg-subtle rounded-owner-lg p-2.5 text-center">
                      <IndianRupee className="w-3.5 h-3.5 text-owner-primary mx-auto mb-1" />
                      <div className="text-xs font-bold text-owner-fg owner-numeric">{formatINR(stats.monthlyRevenue).replace('₹', '')}</div>
                      <div className="text-[10px] text-owner-muted-subtle">Revenue</div>
                    </div>
                  </div>
                ) : null}

                <div className="mt-auto flex items-center justify-between gap-3">
                  {occupancyPct !== null && (
                    <OwnerBadge tone={occupancyPct >= 90 ? 'success' : occupancyPct < 50 ? 'danger' : 'warning'}>
                      {occupancyPct}% occupied
                    </OwnerBadge>
                  )}
                  <button
                    onClick={() => goToDashboard(p.id)}
                    className="ml-auto flex items-center gap-1.5 text-xs font-semibold text-owner-primary hover:underline"
                  >
                    <LayoutDashboard className="w-3.5 h-3.5" /> View Dashboard
                  </button>
                </div>
              </OwnerCard>
            )
          })}
        </div>
      )}

      <AddPropertyModal open={addOpen} onClose={() => setAddOpen(false)} onCreated={handleCreated} />
    </div>
  )
}
