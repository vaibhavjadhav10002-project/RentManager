'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useProperty } from '@/components/shared/PropertyContext'
import {
  getDashboardStats, getTenants, getPayments, getFinancialHistory, getComplaints, getExpenses,
  getOwnerNotifications, getAgreementsForProperty, getRooms, getLeaveRequests, getRentExtensionRequests,
  getMoveOutRequests, renewAgreement,
} from '@/lib/supabase/queries'
import { sendPushNotification } from '@/lib/push'
import { toast } from 'sonner'
import { formatINR, formatDate, computeDueDate, getOverdueDays, whatsappLink, rentReminderMsg, cn } from '@/lib/utils'
import EnableNotificationsBanner from '@/components/shared/EnableNotificationsBanner'
import {
  BedDouble, IndianRupee, AlertTriangle, TrendingDown, Users, Home, UserPlus, Receipt, Wrench,
  ShieldCheck, BarChart3, Megaphone, Clock, Bell, CalendarClock, Users2, Percent,
} from 'lucide-react'
import type { DashboardStats, Tenant } from '@/types'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line,
} from 'recharts'
import { OwnerStatCard, OwnerCard, OwnerChartTooltip, OwnerEmptyState, OwnerCalendar, OwnerBadge, OwnerAvatar, OwnerButton } from '@/components/owner/ui'

// Static class lookups for the Quick Actions tiles — kept as full literal
// strings (not built with template interpolation) so Tailwind's static
// scanner can actually see and generate them.
const TONE_BG = {
  primary: 'bg-owner-primary/12', success: 'bg-owner-success/12', warning: 'bg-owner-warning/12',
  purple: 'bg-owner-purple/12', info: 'bg-owner-info/12', teal: 'bg-owner-teal/12', danger: 'bg-owner-danger/12',
} as const
const TONE_FG = {
  primary: 'text-owner-primary', success: 'text-owner-success', warning: 'text-owner-warning',
  purple: 'text-owner-purple', info: 'text-owner-info', teal: 'text-owner-teal', danger: 'text-owner-danger',
} as const

interface ActivityItem {
  id: string; type: 'tenant_joined' | 'payment' | 'expense' | 'complaint' | 'leave' | 'extension' | 'moveout'
  text: string; time: string; icon: React.ElementType; tone: keyof typeof TONE_BG
}

// Pure presentational helper for the hero card — no data fetching, just
// reads the local clock to pick a time-appropriate greeting.
function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good Morning'
  if (h < 17) return 'Good Afternoon'
  return 'Good Evening'
}

export default function DashboardPage() {
  const router = useRouter()
  const { activeId, active, properties } = useProperty()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [activities, setActivities] = useState<ActivityItem[]>([])
  const [pendingTenants, setPendingTenants] = useState<(Tenant & { dueDate: string; overdueDays: number; remainingDue: number })[]>([])
  const [chartData, setChartData] = useState<{ month: string; revenue: number; expenses: number; profit: number }[]>([])
  const [thisMonthExpenses, setThisMonthExpenses] = useState(0)
  const [loading, setLoading] = useState(true)
  const [dashNotifications, setDashNotifications] = useState<any[]>([])
  const [expiringAgreements, setExpiringAgreements] = useState<any[]>([])
  const [occupancyTrend, setOccupancyTrend] = useState<{ month: string; occupancyPct: number }[]>([])
  const [sharingBreakdown, setSharingBreakdown] = useState<{ sharing_type: string; totalBeds: number; occupiedBeds: number }[]>([])
  const [pendingApprovalsCount, setPendingApprovalsCount] = useState(0)
  const [pendingTenantJoinsCount, setPendingTenantJoinsCount] = useState(0)
  const [renewModal, setRenewModal] = useState<any>(null)
  const [renewForm, setRenewForm] = useState({ start_date: '', end_date: '', monthly_rent: '' })
  const [renewing, setRenewing] = useState(false)

  // Notification Widget + Upcoming Events — both reuse existing, already-
  // implemented queries (the same getOwnerNotifications() Topbar uses,
  // and getAgreementsForProperty() from the Documents/Agreement flow).
  // No new business logic: just fetching real data for a new widget.
  useEffect(() => {
    const propIds = activeId === 'all' ? properties.map(p => p.id) : [activeId]
    if (propIds.length === 0 || propIds.some(id => !id)) return

    getOwnerNotifications(propIds).then(setDashNotifications).catch(() => setDashNotifications([]))

    Promise.all(propIds.map(id => getAgreementsForProperty(id))).then(results => {
      const today = new Date()
      const cutoff = new Date(today.getTime() + 45 * 24 * 60 * 60 * 1000)
      const upcoming = results.flat()
        .filter((a: any) => a.status === 'active' && a.end_date && new Date(a.end_date) >= today && new Date(a.end_date) <= cutoff)
        .sort((a: any, b: any) => new Date(a.end_date).getTime() - new Date(b.end_date).getTime())
        .slice(0, 5)
      setExpiringAgreements(upcoming)
    }).catch(() => setExpiringAgreements([]))
  }, [activeId, properties])

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const propIds = activeId === 'all' ? properties.map(p => p.id) : [activeId]
        getFinancialHistory(propIds).then(setChartData).catch(() => setChartData([]))

        const monthStart = new Date(); monthStart.setDate(1)
        const monthStartStr = monthStart.toISOString().slice(0, 10)

        // Single parallel wave for every data source the dashboard needs —
        // each fetched exactly once and reused across every card/chart that
        // needs it, instead of stats/tenants/payments/rooms resolving first
        // and activities/expenses/leave-etc. only starting to fetch after
        // that first batch finished (a sequential waterfall, not a single
        // concurrent load).
        const [statsResults, tenants, payments, rooms, complaints, expenses, leaves, extensions, moveOuts] = await Promise.all([
          activeId === 'all' ? Promise.all(properties.map(p => getDashboardStats(p.id))) : getDashboardStats(activeId).then(s => [s]),
          Promise.all(propIds.map(id => getTenants(id))).then(r => r.flat()),
          Promise.all(propIds.map(id => getPayments(id))).then(r => r.flat()),
          Promise.all(propIds.map(id => getRooms(id))).then(r => r.flat()),
          Promise.all(propIds.map(id => getComplaints(id))).then(r => r.flat()),
          Promise.all(propIds.map(id => getExpenses(id))).then(r => r.flat()),
          Promise.all(propIds.map(id => getLeaveRequests(id))).then(r => r.flat()),
          Promise.all(propIds.map(id => getRentExtensionRequests(id))).then(r => r.flat()),
          Promise.all(propIds.map(id => getMoveOutRequests(id))).then(r => r.flat()),
        ])

        const raw = statsResults.reduce((acc, s) => ({
          totalRooms: acc.totalRooms + s.totalRooms,
          totalBeds: acc.totalBeds + s.totalBeds,
          occupiedBeds: acc.occupiedBeds + s.occupiedBeds,
          vacantBeds: acc.vacantBeds + s.vacantBeds,
          monthlyRevenue: acc.monthlyRevenue + s.monthlyRevenue,
          pendingRent: acc.pendingRent + s.pendingRent,
          openComplaints: acc.openComplaints + s.openComplaints,
          totalTenants: acc.totalTenants + s.totalTenants,
          lastMonthRevenue: acc.lastMonthRevenue + s.lastMonthRevenue,
          activeRentSum: acc.activeRentSum + s.activeRentSum,
        }), { totalRooms: 0, totalBeds: 0, occupiedBeds: 0, vacantBeds: 0, monthlyRevenue: 0, pendingRent: 0, openComplaints: 0, totalTenants: 0, lastMonthRevenue: 0, activeRentSum: 0 })
        const expected = raw.monthlyRevenue + raw.pendingRent
        setStats({
          ...raw,
          revenueTrendPct: raw.lastMonthRevenue > 0 ? Math.round(((raw.monthlyRevenue - raw.lastMonthRevenue) / raw.lastMonthRevenue) * 100) : null,
          collectionRatePct: expected > 0 ? Math.round((raw.monthlyRevenue / expected) * 100) : 100,
          avgRentPerBed: raw.occupiedBeds > 0 ? Math.round(raw.activeRentSum / raw.occupiedBeds) : 0,
        })

        buildPending(tenants, payments)
        buildActivities(tenants, payments, complaints, expenses, leaves, extensions, moveOuts)
        buildOccupancyAnalytics(tenants, rooms)
        setPendingApprovalsCount(payments.filter((p: any) => p.approval_status === 'pending_approval').length)
        setPendingTenantJoinsCount(tenants.filter(t => t.status === 'pending_approval').length)
        setThisMonthExpenses(expenses.filter((e: any) => e.expense_date >= monthStartStr).reduce((s: number, e: any) => s + e.amount, 0))
      } catch {}
      setLoading(false)
    }

    function buildActivities(tenants: Tenant[], payments: any[], complaints: any[], expenses: any[], leaves: any[], extensions: any[], moveOuts: any[]) {
      const items: ActivityItem[] = [
        ...tenants.slice(0, 5).map(t => ({
          id: `t-${t.id}`, type: 'tenant_joined' as const, text: `${t.name} joined`,
          time: t.joining_date, icon: UserPlus, tone: 'info' as const,
        })),
        ...payments.filter(p => p.approval_status === 'approved').slice(0, 5).map(p => ({
          id: `p-${p.id}`, type: 'payment' as const,
          text: `${p.tenant?.name ?? 'Tenant'} paid ${formatINR(p.amount_received)}`,
          time: p.payment_date, icon: Receipt, tone: 'success' as const,
        })),
        ...(expenses ?? []).slice(0, 5).map((e: any) => ({
          id: `e-${e.id}`, type: 'expense' as const, text: `${e.category}: ${formatINR(e.amount)}`,
          time: e.expense_date, icon: Wrench, tone: 'warning' as const,
        })),
        ...(complaints ?? []).slice(0, 5).map((c: any) => ({
          id: `c-${c.id}`, type: 'complaint' as const, text: `Complaint: ${c.issue_type}`,
          time: c.created_at, icon: AlertTriangle, tone: 'danger' as const,
        })),
        ...(leaves ?? []).slice(0, 5).map((l: any) => ({
          id: `l-${l.id}`, type: 'leave' as const, text: `${l.tenant?.name ?? 'Tenant'} requested leave`,
          time: l.created_at, icon: Users2, tone: 'purple' as const,
        })),
        ...(extensions ?? []).slice(0, 5).map((x: any) => ({
          id: `x-${x.id}`, type: 'extension' as const, text: `${x.tenant?.name ?? 'Tenant'} requested a rent extension`,
          time: x.created_at, icon: CalendarClock, tone: 'info' as const,
        })),
        ...(moveOuts ?? []).slice(0, 5).map((m: any) => ({
          id: `m-${m.id}`, type: 'moveout' as const, text: `${m.tenant?.name ?? 'Tenant'} requested to move out`,
          time: m.created_at, icon: Home, tone: 'warning' as const,
        })),
      ]
      setActivities(items.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()).slice(0, 8))
    }

    // Occupancy analytics — trend derived retroactively from each tenant's
    // joining_date/leaving_date (no historical snapshot table exists, so
    // current room/bed counts are applied across the lookback window as an
    // approximation), plus a current breakdown by sharing type.
    function buildOccupancyAnalytics(tenants: Tenant[], rooms: any[]) {
      const totalBeds = rooms.reduce((s, r) => s + r.total_beds, 0)
      const trend: { month: string; occupancyPct: number }[] = []
      const cursor = new Date()
      cursor.setDate(1)
      for (let i = 5; i >= 0; i--) {
        const monthDate = new Date(cursor.getFullYear(), cursor.getMonth() - i, 1)
        const monthStart = monthDate
        const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0)
        const occupied = tenants.filter(t => {
          if (t.status === 'pending_approval') return false
          const joined = new Date(t.joining_date)
          if (joined > monthEnd) return false
          if (t.leaving_date && new Date(t.leaving_date) < monthStart) return false
          return true
        }).length
        trend.push({
          month: monthDate.toLocaleString('en-IN', { month: 'short' }),
          occupancyPct: totalBeds > 0 ? Math.round((occupied / totalBeds) * 100) : 0,
        })
      }
      setOccupancyTrend(trend)

      const bySharingType = new Map<string, { totalBeds: number; occupiedBeds: number }>()
      rooms.forEach(r => {
        const cur = bySharingType.get(r.sharing_type) ?? { totalBeds: 0, occupiedBeds: 0 }
        cur.totalBeds += r.total_beds
        bySharingType.set(r.sharing_type, cur)
      })
      tenants.filter(t => t.status === 'active' && t.room_id).forEach(t => {
        const room = rooms.find(r => r.id === t.room_id)
        if (!room) return
        const cur = bySharingType.get(room.sharing_type) ?? { totalBeds: 0, occupiedBeds: 0 }
        cur.occupiedBeds += 1
        bySharingType.set(room.sharing_type, cur)
      })
      setSharingBreakdown([...bySharingType.entries()].map(([sharing_type, v]) => ({ sharing_type, ...v })))
    }

    function buildPending(tenants: Tenant[], payments: any[]) {
      const today = new Date()
      const thisMonth = today.toLocaleString('en-IN', { month: 'long', year: 'numeric' })

      // Sum actual approved rent payments per tenant for this month —
      // a tenant who has fully paid should NOT appear in "Pending Rent",
      // and a partial payer should only show their remaining balance.
      const paidByTenant = new Map<string, number>()
      payments.forEach(p => {
        if (p.for_month === thisMonth && p.approval_status === 'approved' && p.type === 'rent') {
          paidByTenant.set(p.tenant_id, (paidByTenant.get(p.tenant_id) ?? 0) + p.amount_received)
        }
      })

      const pending = tenants
        .filter(t => t.status === 'active' && (paidByTenant.get(t.id) ?? 0) < t.monthly_rent)
        .map(t => ({
          ...t,
          dueDate: computeDueDate(t.joining_date, today).toISOString().slice(0, 10),
          overdueDays: getOverdueDays(t.joining_date, today),
          remainingDue: t.monthly_rent - (paidByTenant.get(t.id) ?? 0),
        }))
        .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
      setPendingTenants(pending)
    }

    if (activeId === 'all' && properties.length === 0) {
      // New owner with no properties yet — show a real zero-state instead
      // of getting stuck on the loading skeleton forever.
      setStats({
        totalRooms: 0, totalBeds: 0, occupiedBeds: 0, vacantBeds: 0, monthlyRevenue: 0, pendingRent: 0,
        openComplaints: 0, totalTenants: 0, lastMonthRevenue: 0, activeRentSum: 0,
        revenueTrendPct: null, collectionRatePct: 100, avgRentPerBed: 0,
      })
      setPendingTenants([])
      setChartData([])
      setLoading(false)
      return
    }
    load()
  }, [activeId, properties])

  function openRenew(a: any) {
    const oldEnd = new Date(a.end_date)
    const newStart = new Date(oldEnd); newStart.setDate(newStart.getDate() + 1)
    const newEnd = new Date(newStart); newEnd.setMonth(newEnd.getMonth() + (a.duration_months || 11))
    setRenewModal(a)
    setRenewForm({
      start_date: newStart.toISOString().slice(0, 10),
      end_date: newEnd.toISOString().slice(0, 10),
      monthly_rent: String(a.monthly_rent),
    })
  }

  async function submitRenew() {
    if (!renewModal || !renewForm.start_date || !renewForm.end_date) { toast.error('Pick both dates'); return }
    setRenewing(true)
    try {
      await renewAgreement(renewModal, renewForm.start_date, renewForm.end_date, Number(renewForm.monthly_rent))
      toast.success(`Agreement renewed for ${renewModal.tenant?.name}`)
      setExpiringAgreements(prev => prev.filter(a => a.id !== renewModal.id))
      if (renewModal.tenant?.auth_user_id) {
        sendPushNotification({
          user_ids: [renewModal.tenant.auth_user_id],
          title: '📄 Agreement Renewed',
          body: `Your rental agreement has been renewed through ${formatDate(renewForm.end_date)}.`,
          url: '/portal', tag: 'agreement-renewal',
        })
      }
      setRenewModal(null)
    } catch (e: any) { toast.error(e.message) }
    setRenewing(false)
  }

  if (loading) return (
    <div className="space-y-6">
      <div className="h-7 w-40 rounded-owner-md bg-owner-surface-hover animate-pulse" />
      <div className="h-32 rounded-owner-2xl bg-owner-surface-hover animate-pulse" />
      <div className="h-24 rounded-owner-xl bg-owner-surface-hover animate-pulse" />
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
        {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-16 rounded-owner-xl bg-owner-surface-hover animate-pulse" />)}
      </div>
      <div className="h-40 rounded-owner-xl bg-owner-surface-hover animate-pulse" />
      <div className="h-40 rounded-owner-xl bg-owner-surface-hover animate-pulse" />
      <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-4">
        {Array.from({ length: 9 }).map((_, i) => <div key={i} className="h-28 rounded-owner-xl bg-owner-surface-hover animate-pulse" />)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 h-52 rounded-owner-xl bg-owner-surface-hover animate-pulse" />
        <div className="h-52 rounded-owner-xl bg-owner-surface-hover animate-pulse" />
      </div>
    </div>
  )

  const occupancyPct = stats ? Math.round((stats.occupiedBeds / (stats.totalBeds || 1)) * 100) : 0
  const netProfit = (stats?.monthlyRevenue ?? 0) - thisMonthExpenses
  const overdueCount = pendingTenants.filter(t => t.overdueDays > 5).length
  const alerts = [
    pendingApprovalsCount > 0 && { text: `${pendingApprovalsCount} payment${pendingApprovalsCount > 1 ? 's' : ''} awaiting your approval`, href: '/approvals', tone: 'warning' as const },
    pendingTenantJoinsCount > 0 && { text: `${pendingTenantJoinsCount} new tenant request${pendingTenantJoinsCount > 1 ? 's' : ''} waiting`, href: '/approvals', tone: 'purple' as const },
    overdueCount > 0 && { text: `${overdueCount} tenant${overdueCount > 1 ? 's are' : ' is'} more than 5 days overdue on rent`, href: '/payments', tone: 'danger' as const },
    (stats?.openComplaints ?? 0) > 0 && { text: `${stats!.openComplaints} complaint${stats!.openComplaints > 1 ? 's' : ''} still open`, href: '/complaints', tone: 'warning' as const },
    expiringAgreements.length > 0 && { text: `${expiringAgreements.length} agreement${expiringAgreements.length > 1 ? 's' : ''} expiring soon — see Upcoming Events below`, href: null, tone: 'info' as const },
  ].filter(Boolean) as { text: string; href: string | null; tone: 'warning' | 'purple' | 'danger' | 'info' }[]

  return (
    <div className="space-y-6">
      <EnableNotificationsBanner />
      {/* Header */}
      <div>
        <h1 className="text-xl font-extrabold text-owner-fg">Dashboard</h1>
        <p className="text-sm text-owner-muted mt-1">
          {activeId === 'all' ? `All ${properties.length} properties overview` : `${active?.name} — ${active?.city}`}
        </p>
      </div>

      {/* Hero card — greeting + at-a-glance occupancy, built entirely from
          the `stats` object already fetched below (no new data/queries) */}
      {stats && (
        <div className="rounded-owner-2xl bg-gradient-to-br from-owner-primary to-indigo-600 p-5 text-white shadow-owner-md relative overflow-hidden">
          <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-white/10" aria-hidden="true" />
          <div className="absolute -right-2 -bottom-10 w-24 h-24 rounded-full bg-white/10" aria-hidden="true" />
          <div className="relative">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-base font-bold">{greeting()} 👋</div>
                <div className="text-xs text-white/80 mt-0.5">
                  {activeId === 'all' ? `Across all ${properties.length} properties` : active?.name}
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-2xl font-extrabold owner-numeric">{stats.totalBeds > 0 ? Math.round((stats.occupiedBeds / stats.totalBeds) * 100) : 0}%</div>
                <div className="text-[10px] text-white/70 font-semibold uppercase tracking-wide">Occupancy</div>
              </div>
            </div>
            <div className="flex items-center gap-4 mt-4 pt-4 border-t border-white/15">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-owner-lg bg-white/15 flex items-center justify-center shrink-0">
                  <Users className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-sm font-bold owner-numeric">{stats.totalTenants}</div>
                  <div className="text-[10px] text-white/70">Active Tenants</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-owner-lg bg-white/15 flex items-center justify-center shrink-0">
                  <BedDouble className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-sm font-bold owner-numeric">{stats.vacantBeds}</div>
                  <div className="text-[10px] text-white/70">Vacant Beds</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {properties.length === 0 && (
        <OwnerCard className="bg-owner-info-subtle border-owner-info/25 text-center">
          <div className="text-sm font-bold text-owner-fg">No properties yet</div>
          <p className="text-xs text-owner-muted mt-1">Add your first PG property from the property switcher at the top to start tracking rooms, tenants and rent.</p>
        </OwnerCard>
      )}

      {/* Smart Alerts — only the things most likely to need attention right now */}
      {alerts.length > 0 && (
        <OwnerCard>
          <div className="text-xs font-bold text-owner-muted-subtle uppercase tracking-wide mb-3">Needs Your Attention</div>
          <div className="space-y-2">
            {alerts.map((a, i) => a.href ? (
              <Link key={i} href={a.href}
                className={cn('flex items-center justify-between gap-2 px-3 py-2.5 rounded-owner-lg text-sm font-semibold transition-colors', TONE_BG[a.tone], TONE_FG[a.tone])}>
                <span>{a.text}</span>
                <span className="text-xs">→</span>
              </Link>
            ) : (
              <div key={i} className={cn('flex items-center justify-between gap-2 px-3 py-2.5 rounded-owner-lg text-sm font-semibold', TONE_BG[a.tone], TONE_FG[a.tone])}>
                <span>{a.text}</span>
              </div>
            ))}
          </div>
        </OwnerCard>
      )}

      {/* Quick Actions */}
      <OwnerCard>
        <div className="font-bold text-sm text-owner-fg mb-4">Quick Actions</div>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
          {[
            { href: '/tenants', label: 'Add Tenant', icon: UserPlus, tone: 'primary' as const },
            { href: '/payments', label: 'Record Payment', icon: Receipt, tone: 'success' as const },
            { href: '/expenses', label: 'Add Expense', icon: TrendingDown, tone: 'warning' as const },
            { href: '/notices', label: 'Post Notice', icon: Megaphone, tone: 'purple' as const },
            { href: '/approvals', label: 'Approvals', icon: ShieldCheck, tone: 'info' as const },
            { href: '/reports', label: 'View Reports', icon: BarChart3, tone: 'teal' as const },
          ].map(({ href, label, icon: Icon, tone }) => (
            <Link key={href} href={href} className="flex flex-col items-center gap-2 py-1 group">
              <span className={cn(
                'w-11 h-11 rounded-owner-xl flex items-center justify-center transition-transform group-hover:scale-105',
                TONE_BG[tone]
              )}>
                <Icon className={cn('w-5 h-5', TONE_FG[tone])} />
              </span>
              <span className="text-[11px] font-semibold text-owner-fg text-center leading-tight">{label}</span>
            </Link>
          ))}
        </div>
      </OwnerCard>

      {/* Pending Rent (date-sorted) */}
      <OwnerCard>
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="font-bold text-sm text-owner-fg">Pending Rent</div>
            <div className="text-xs text-owner-muted-subtle">Sorted by due date — oldest first</div>
          </div>
          <OwnerBadge tone="primary">{pendingTenants.length} tenants</OwnerBadge>
        </div>
        {pendingTenants.length === 0 ? (
          <OwnerEmptyState icon={IndianRupee} title="All caught up — no pending rent!" className="py-8" />
        ) : (
          <div className="space-y-2">
            {pendingTenants.map(t => (
              <div key={t.id} className={cn(
                'flex items-center gap-3 p-3 rounded-owner-lg',
                t.overdueDays > 5 ? 'bg-owner-danger-subtle' : 'bg-owner-warning-subtle'
              )}>
                <OwnerAvatar name={t.name} size="md" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-owner-fg truncate">{t.name}</div>
                  <div className="text-xs text-owner-muted">Room {t.room?.room_number} · Due {t.dueDate}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-sm font-bold text-owner-fg owner-numeric">{formatINR(t.remainingDue)}</div>
                  <span className={cn('text-xs font-bold', t.overdueDays > 5 ? 'text-owner-danger' : 'text-owner-warning')}>
                    {t.overdueDays}d overdue
                  </span>
                </div>
                <a href={whatsappLink(t.phone, rentReminderMsg(t.name, t.remainingDue, active?.name ?? 'PG'))}
                  target="_blank" rel="noreferrer"
                  className="p-2 bg-owner-success/15 rounded-owner-lg hover:bg-owner-success/25 transition-colors shrink-0" title="WhatsApp Reminder">
                  <svg className="w-4 h-4 text-owner-success" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
                    <path d="M12 0C5.373 0 0 5.373 0 12c0 2.119.553 4.107 1.523 5.84L0 24l6.335-1.509A11.944 11.944 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.89 0-3.66-.493-5.19-1.355l-.372-.22-3.761.896.952-3.658-.243-.387A9.936 9.936 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z" />
                  </svg>
                </a>
              </div>
            ))}
          </div>
        )}
      </OwnerCard>

      {/* Recent Activities */}
      <OwnerCard>
        <h2 className="text-sm font-bold text-owner-fg mb-1">Recent Activities</h2>
        <p className="text-xs text-owner-muted-subtle mb-3">Latest tenant, payment, expense, complaint and request events — across all your properties</p>
        {activities.length === 0 ? (
          <OwnerEmptyState icon={Clock} title="No recent activity" className="py-8" />
        ) : (
          <div className="divide-y divide-owner-border">
            {activities.map(a => (
              <div key={a.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                <div className={cn('w-9 h-9 rounded-owner-lg flex items-center justify-center shrink-0', TONE_BG[a.tone])}>
                  <a.icon className={cn('w-4 h-4', TONE_FG[a.tone])} />
                </div>
                <div className="flex-1 min-w-0 text-sm text-owner-fg truncate">{a.text}</div>
                <div className="text-xs text-owner-muted-subtle shrink-0">{formatDate(a.time)}</div>
              </div>
            ))}
          </div>
        )}
      </OwnerCard>

      {/* Stat Cards */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-4">
          <OwnerStatCard icon={Home} label="Total Rooms" value={String(stats.totalRooms)} tone="info" />
          <OwnerStatCard icon={Users} label="Total Tenants" value={String(stats.totalTenants)} tone="teal" />
          <OwnerStatCard icon={BedDouble} label="Occupied Beds" value={String(stats.occupiedBeds)} sub={`of ${stats.totalBeds}`} tone="purple" />
          <OwnerStatCard icon={BedDouble} label="Vacant Beds" value={String(stats.vacantBeds)} tone="success" />
          <OwnerStatCard icon={IndianRupee} label="Monthly Revenue" value={formatINR(stats.monthlyRevenue)} tone="primary"
            trend={stats.revenueTrendPct !== null ? { value: stats.revenueTrendPct, label: 'vs last month' } : undefined} />
          <OwnerStatCard icon={TrendingDown} label="Pending Rent" value={formatINR(stats.pendingRent)} tone="warning" />
          <OwnerStatCard icon={AlertTriangle} label="Open Complaints" value={String(stats.openComplaints)} tone="danger" />
          <OwnerStatCard icon={Percent} label="Collection Rate" value={`${stats.collectionRatePct}%`} sub="of this month's rent" tone="teal" />
          <OwnerStatCard icon={IndianRupee} label="Avg Rent / Bed" value={formatINR(stats.avgRentPerBed)} sub="occupied beds only" tone="info" />
        </div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Revenue chart */}
        <OwnerCard className="lg:col-span-2">
          <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
            <div>
              <div className="font-bold text-sm text-owner-fg">Income vs Expense</div>
              <div className="text-xs text-owner-muted-subtle mt-0.5">Last 6 months</div>
            </div>
            <div className="text-left sm:text-right">
              <div className="text-xs text-owner-muted-subtle">Net Profit (this month)</div>
              <div className={cn('text-base font-extrabold owner-numeric', netProfit >= 0 ? 'text-owner-success' : 'text-owner-danger')}>
                {formatINR(netProfit)}
              </div>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData} barGap={2}>
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'hsl(var(--owner-muted-subtle))' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--owner-muted-subtle))' }} axisLine={false} tickLine={false} tickFormatter={v => `₹${v / 1000}k`} />
              <Tooltip content={<OwnerChartTooltip formatter={formatINR} />} cursor={{ fill: 'hsl(var(--owner-surface-hover))' }} />
              <Bar dataKey="revenue" fill="hsl(var(--owner-primary))" radius={[4, 4, 0, 0]} name="Revenue" />
              <Bar dataKey="expenses" fill="hsl(var(--owner-accent-purple) / 0.6)" radius={[4, 4, 0, 0]} name="Expenses" />
              <Bar dataKey="profit" fill="hsl(var(--owner-success))" radius={[4, 4, 0, 0]} name="Profit" />
            </BarChart>
          </ResponsiveContainer>
        </OwnerCard>

        {/* Occupancy donut */}
        <OwnerCard className="flex flex-col items-center justify-center">
          <div className="font-bold text-sm text-owner-fg mb-1 self-start">Occupancy</div>
          <div className="text-xs text-owner-muted-subtle mb-4 self-start">Beds occupied</div>
          <div className="relative">
            <PieChart width={140} height={140}>
              <Pie data={[{ value: occupancyPct }, { value: 100 - occupancyPct }]}
                cx={65} cy={65} innerRadius={45} outerRadius={65} startAngle={90} endAngle={-270} dataKey="value" stroke="none">
                <Cell fill="hsl(var(--owner-primary))" />
                <Cell fill="hsl(var(--owner-border))" />
              </Pie>
            </PieChart>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className="text-2xl font-extrabold text-owner-fg owner-numeric">{occupancyPct}%</div>
            </div>
          </div>
          <div className="text-xs text-owner-muted-subtle mt-1">{stats?.occupiedBeds}/{stats?.totalBeds} beds</div>
        </OwnerCard>
      </div>

      {/* Occupancy Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <OwnerCard className="lg:col-span-2">
          <div className="font-bold text-sm text-owner-fg mb-1">Occupancy Trend</div>
          <div className="text-xs text-owner-muted-subtle mb-4">Last 6 months</div>
          {occupancyTrend.length === 0 || occupancyTrend.every(d => d.occupancyPct === 0) ? (
            <OwnerEmptyState icon={BedDouble} title="Not enough tenant history yet" className="py-10" />
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={occupancyTrend}>
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'hsl(var(--owner-muted-subtle))' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--owner-muted-subtle))' }} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} domain={[0, 100]} />
                <Tooltip content={<OwnerChartTooltip formatter={(v: number) => `${v}%`} />} />
                <Line type="monotone" dataKey="occupancyPct" stroke="hsl(var(--owner-primary))" strokeWidth={2.5} dot={{ r: 3 }} name="Occupancy" />
              </LineChart>
            </ResponsiveContainer>
          )}
        </OwnerCard>

        <OwnerCard>
          <div className="font-bold text-sm text-owner-fg mb-1">By Sharing Type</div>
          <div className="text-xs text-owner-muted-subtle mb-4">Occupied vs total beds</div>
          {sharingBreakdown.length === 0 ? (
            <OwnerEmptyState icon={Users} title="No rooms yet" className="py-8" />
          ) : (
            <div className="space-y-3">
              {sharingBreakdown.map(s => {
                const pct = s.totalBeds > 0 ? Math.round((s.occupiedBeds / s.totalBeds) * 100) : 0
                return (
                  <div key={s.sharing_type}>
                    <div className="flex justify-between text-xs font-semibold text-owner-muted mb-1">
                      <span>{s.sharing_type}</span>
                      <span>{s.occupiedBeds}/{s.totalBeds}</span>
                    </div>
                    <div className="h-2 bg-owner-surface-hover rounded-owner-full overflow-hidden">
                      <div className="h-full bg-owner-primary rounded-owner-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </OwnerCard>
      </div>

      {/* Calendar · Notifications · Upcoming Events */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <OwnerCard>
          <OwnerCalendar />
        </OwnerCard>

        <OwnerCard padding="none" className="flex flex-col">
          <div className="p-5 pb-3 flex items-center justify-between">
            <div className="font-bold text-sm text-owner-fg">Notifications</div>
            <button
              onClick={() => router.push('/notifications')}
              className="text-xs font-semibold text-owner-primary hover:underline"
            >
              View All
            </button>
          </div>
          <div className="flex-1 overflow-y-auto max-h-64">
            {dashNotifications.length === 0 ? (
              <OwnerEmptyState icon={Bell} title="You're all caught up!" className="py-8" />
            ) : (
              dashNotifications.slice(0, 5).map((n: any) => (
                <div key={n.id} className="px-5 py-2.5 border-t border-owner-border first:border-t-0">
                  <div className="text-sm font-semibold text-owner-fg truncate">{n.title}</div>
                  <div className="text-xs text-owner-muted mt-0.5 truncate">{n.subtitle}</div>
                </div>
              ))
            )}
          </div>
        </OwnerCard>

        <OwnerCard padding="none" className="flex flex-col">
          <div className="p-5 pb-3">
            <div className="font-bold text-sm text-owner-fg">Upcoming Events</div>
            <div className="text-xs text-owner-muted-subtle mt-0.5">Agreements expiring in the next 45 days</div>
          </div>
          <div className="flex-1 overflow-y-auto max-h-64">
            {expiringAgreements.length === 0 ? (
              <OwnerEmptyState icon={CalendarClock} title="Nothing expiring soon" className="py-8" />
            ) : (
              expiringAgreements.map((a: any) => (
                <div key={a.id} className="flex items-center gap-3 px-5 py-2.5 border-t border-owner-border first:border-t-0">
                  <div className="w-8 h-8 rounded-owner-lg bg-owner-warning/12 flex items-center justify-center shrink-0">
                    <CalendarClock className="w-3.5 h-3.5 text-owner-warning" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-owner-fg truncate">{a.tenant?.name ?? 'Tenant'}</div>
                    <div className="text-xs text-owner-muted-subtle">Agreement ends {formatDate(a.end_date)}</div>
                  </div>
                  <OwnerButton size="sm" variant="secondary" onClick={() => openRenew(a)} className="shrink-0">Renew</OwnerButton>
                </div>
              ))
            )}
          </div>
        </OwnerCard>
      </div>

      {/* Renew Agreement Modal */}
      {renewModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-owner-surface-elevated rounded-owner-xl w-full max-w-sm shadow-owner-md border border-owner-border">
            <div className="px-5 py-4 border-b border-owner-border flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-owner-fg">Renew Agreement</h2>
                <p className="text-xs text-owner-muted-subtle">{renewModal.tenant?.name} · Room {renewModal.tenant?.room?.room_number ?? '—'}</p>
              </div>
              <button onClick={() => setRenewModal(null)} aria-label="Close" className="text-owner-muted-subtle text-xl font-bold">×</button>
            </div>
            <div className="p-5 space-y-4">
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-xs font-semibold text-owner-muted block mb-1">New Start Date</label>
                  <input type="date" value={renewForm.start_date} onChange={e => setRenewForm(f => ({ ...f, start_date: e.target.value }))}
                    className="w-full px-3 py-2 bg-owner-surface border border-owner-border rounded-owner-lg text-sm text-owner-fg focus:outline-none focus:border-owner-primary" />
                </div>
                <div className="flex-1">
                  <label className="text-xs font-semibold text-owner-muted block mb-1">New End Date</label>
                  <input type="date" value={renewForm.end_date} onChange={e => setRenewForm(f => ({ ...f, end_date: e.target.value }))}
                    className="w-full px-3 py-2 bg-owner-surface border border-owner-border rounded-owner-lg text-sm text-owner-fg focus:outline-none focus:border-owner-primary" />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-owner-muted block mb-1">Monthly Rent (₹)</label>
                <input type="number" value={renewForm.monthly_rent} onChange={e => setRenewForm(f => ({ ...f, monthly_rent: e.target.value }))}
                  className="w-full px-3 py-2 bg-owner-surface border border-owner-border rounded-owner-lg text-sm text-owner-fg focus:outline-none focus:border-owner-primary" />
              </div>
              <div className="text-xs text-owner-muted-subtle">
                All other terms (deposit, charges, due day, late fee policy) carry over from the current agreement.
              </div>
            </div>
            <div className="px-5 py-4 border-t border-owner-border">
              <OwnerButton fullWidth loading={renewing} onClick={submitRenew}>
                Renew Agreement
              </OwnerButton>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
