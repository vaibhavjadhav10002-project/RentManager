'use client'
import { useEffect, useState } from 'react'
import { useProperty } from '@/components/shared/PropertyContext'
import { getDashboardStats, getTenants, getPayments, getFinancialHistory, getComplaints, getExpenses } from '@/lib/supabase/queries'
import { formatINR, formatDate, computeDueDate, getOverdueDays, whatsappLink, rentReminderMsg } from '@/lib/utils'
import EnableNotificationsBanner from '@/components/shared/EnableNotificationsBanner'
import { BedDouble, IndianRupee, AlertTriangle, TrendingDown, Users, Home, UserPlus, Receipt, Wrench } from 'lucide-react'
import type { DashboardStats, Tenant } from '@/types'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts'

function StatCard({ icon: Icon, label, value, sub, iconBg, iconColor }: {
  icon: React.ElementType; label: string; value: string; sub?: string; iconBg: string; iconColor: string
}) {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 p-5 shadow-sm dark:shadow-none hover:shadow-md transition-shadow">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 ${iconBg}`}>
        <Icon className={`w-5 h-5 ${iconColor}`} />
      </div>
      <div className="text-2xl font-extrabold text-gray-900 dark:text-white">{value}</div>
      <div className="text-xs text-gray-500 dark:text-slate-400 font-medium mt-1">{label}</div>
      {sub && <div className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">{sub}</div>}
    </div>
  )
}

interface ActivityItem {
  id: string; type: 'tenant_joined' | 'payment' | 'expense' | 'complaint'
  text: string; time: string; icon: React.ElementType; iconBg: string; iconColor: string
}

export default function DashboardPage() {
  const { activeId, active, properties } = useProperty()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [activities, setActivities] = useState<ActivityItem[]>([])
  const [pendingTenants, setPendingTenants] = useState<(Tenant & { dueDate: string; overdueDays: number; remainingDue: number })[]>([])
  const [chartData, setChartData] = useState<{ month: string; revenue: number; expenses: number }[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const propIds = activeId === 'all' ? properties.map(p => p.id) : [activeId]
        getFinancialHistory(propIds).then(setChartData).catch(() => setChartData([]))

        if (activeId === 'all') {
          // Aggregate across all properties
          const results = await Promise.all(properties.map(p => getDashboardStats(p.id)))
          const agg: DashboardStats = results.reduce((acc, s) => ({
            totalRooms: acc.totalRooms + s.totalRooms,
            totalBeds: acc.totalBeds + s.totalBeds,
            occupiedBeds: acc.occupiedBeds + s.occupiedBeds,
            vacantBeds: acc.vacantBeds + s.vacantBeds,
            monthlyRevenue: acc.monthlyRevenue + s.monthlyRevenue,
            pendingRent: acc.pendingRent + s.pendingRent,
            openComplaints: acc.openComplaints + s.openComplaints,
            totalTenants: acc.totalTenants + s.totalTenants,
          }), { totalRooms: 0, totalBeds: 0, occupiedBeds: 0, vacantBeds: 0, monthlyRevenue: 0, pendingRent: 0, openComplaints: 0, totalTenants: 0 })
          setStats(agg)

          // Pending tenants across all props
          const [allTenants, allPayments] = await Promise.all([
            Promise.all(properties.map(p => getTenants(p.id))).then(r => r.flat()),
            Promise.all(properties.map(p => getPayments(p.id))).then(r => r.flat()),
          ])
          buildPending(allTenants, allPayments)
          buildActivities(allTenants, allPayments, 'all')
        } else {
          const [s, tenants, payments] = await Promise.all([
            getDashboardStats(activeId),
            getTenants(activeId),
            getPayments(activeId),
          ])
          setStats(s)
          buildPending(tenants, payments)
          buildActivities(tenants, payments, activeId)
        }
      } catch {}
      setLoading(false)
    }

    async function buildActivities(tenants: Tenant[], payments: any[], propId: string) {
      try {
        const [complaints, expenses] = await Promise.all([
          activeId !== 'all' ? getComplaints(propId) : Promise.resolve([]),
          activeId !== 'all' ? getExpenses(propId) : Promise.resolve([]),
        ])
        const items: ActivityItem[] = [
          ...tenants.slice(0, 5).map(t => ({
            id: `t-${t.id}`, type: 'tenant_joined' as const, text: `${t.name} joined`,
            time: t.joining_date, icon: UserPlus, iconBg: 'bg-blue-50', iconColor: 'text-blue-600',
          })),
          ...payments.filter(p => p.approval_status === 'approved').slice(0, 5).map(p => ({
            id: `p-${p.id}`, type: 'payment' as const,
            text: `${p.tenant?.name ?? 'Tenant'} paid ${formatINR(p.amount_received)}`,
            time: p.payment_date, icon: Receipt, iconBg: 'bg-green-50', iconColor: 'text-green-600',
          })),
          ...(expenses ?? []).slice(0, 5).map((e: any) => ({
            id: `e-${e.id}`, type: 'expense' as const, text: `${e.category}: ${formatINR(e.amount)}`,
            time: e.expense_date, icon: Wrench, iconBg: 'bg-orange-50', iconColor: 'text-orange-600',
          })),
          ...(complaints ?? []).slice(0, 5).map((c: any) => ({
            id: `c-${c.id}`, type: 'complaint' as const, text: `Complaint: ${c.issue_type}`,
            time: c.created_at, icon: AlertTriangle, iconBg: 'bg-red-50', iconColor: 'text-red-600',
          })),
        ]
        setActivities(items.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()).slice(0, 8))
      } catch { setActivities([]) }
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
      setStats({ totalRooms: 0, totalBeds: 0, occupiedBeds: 0, vacantBeds: 0, monthlyRevenue: 0, pendingRent: 0, openComplaints: 0, totalTenants: 0 })
      setPendingTenants([])
      setChartData([])
      setLoading(false)
      return
    }
    load()
  }, [activeId, properties])

  if (loading) return (
    <div className="space-y-4">
      <div className="h-8 w-48 bg-gray-200 rounded-xl animate-pulse" />
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {[...Array(6)].map((_, i) => <div key={i} className="h-32 bg-gray-200 rounded-2xl animate-pulse" />)}
      </div>
    </div>
  )

  const occupancyPct = stats ? Math.round((stats.occupiedBeds / (stats.totalBeds || 1)) * 100) : 0

  return (
    <div className="space-y-6">
      <EnableNotificationsBanner />
      {/* Header */}
      <div>
        <h1 className="text-xl font-extrabold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">
          {activeId === 'all' ? `All ${properties.length} properties overview` : `${active?.name} — ${active?.city}`}
        </p>
      </div>

      {properties.length === 0 && (
        <div className="bg-blue-50 border border-blue-100 rounded-2xl p-5 text-center">
          <div className="text-sm font-bold text-blue-900">No properties yet</div>
          <p className="text-xs text-blue-700 mt-1">Add your first PG property from the property switcher at the top to start tracking rooms, tenants and rent.</p>
        </div>
      )}

      {/* Stat Cards */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          <StatCard icon={Home} label="Total Rooms" value={String(stats.totalRooms)} iconBg="bg-blue-50 dark:bg-blue-500/10" iconColor="text-blue-600 dark:text-blue-400" />
          <StatCard icon={BedDouble} label="Occupied Beds" value={String(stats.occupiedBeds)} sub={`of ${stats.totalBeds}`} iconBg="bg-purple-50 dark:bg-purple-500/10" iconColor="text-purple-600 dark:text-purple-400" />
          <StatCard icon={BedDouble} label="Vacant Beds" value={String(stats.vacantBeds)} iconBg="bg-green-50 dark:bg-green-500/10" iconColor="text-green-600 dark:text-green-400" />
          <StatCard icon={IndianRupee} label="Monthly Revenue" value={formatINR(stats.monthlyRevenue)} iconBg="bg-blue-50 dark:bg-blue-500/10" iconColor="text-blue-600 dark:text-blue-400" />
          <StatCard icon={TrendingDown} label="Pending Rent" value={formatINR(stats.pendingRent)} iconBg="bg-yellow-50 dark:bg-yellow-500/10" iconColor="text-yellow-600 dark:text-yellow-400" />
          <StatCard icon={AlertTriangle} label="Open Complaints" value={String(stats.openComplaints)} iconBg="bg-red-50 dark:bg-red-500/10" iconColor="text-red-600 dark:text-red-400" />
        </div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Revenue chart */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <div className="font-bold text-sm text-gray-900 mb-1">Revenue vs Expenses</div>
          <div className="text-xs text-gray-400 mb-4">Last 6 months</div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={chartData} barGap={2}>
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={v => `₹${v/1000}k`} />
              <Tooltip formatter={(v: number) => formatINR(v)} />
              <Bar dataKey="revenue" fill="#2563EB" radius={[4, 4, 0, 0]} name="Revenue" />
              <Bar dataKey="expenses" fill="#7C3AED44" radius={[4, 4, 0, 0]} name="Expenses" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Occupancy donut */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm flex flex-col items-center justify-center">
          <div className="font-bold text-sm text-gray-900 mb-1 self-start">Occupancy</div>
          <div className="text-xs text-gray-400 mb-4 self-start">Beds occupied</div>
          <PieChart width={140} height={140}>
            <Pie data={[{ value: occupancyPct }, { value: 100 - occupancyPct }]}
              cx={65} cy={65} innerRadius={45} outerRadius={65} startAngle={90} endAngle={-270} dataKey="value">
              <Cell fill="#2563EB" />
              <Cell fill="#E2E8F0" />
            </Pie>
          </PieChart>
          <div className="text-3xl font-extrabold text-gray-900 -mt-2">{occupancyPct}%</div>
          <div className="text-xs text-gray-400">{stats?.occupiedBeds}/{stats?.totalBeds} beds</div>
        </div>
      </div>

      {/* Pending Rent (date-sorted) */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="font-bold text-sm text-gray-900">Pending Rent</div>
            <div className="text-xs text-gray-400">Sorted by due date — oldest first</div>
          </div>
          <span className="text-xs bg-blue-50 text-blue-600 font-bold px-2.5 py-1 rounded-full">
            {pendingTenants.length} tenants
          </span>
        </div>
        {pendingTenants.length === 0 ? (
          <div className="text-center py-8 text-gray-400 text-sm">🎉 All caught up — no pending rent!</div>
        ) : (
          <div className="space-y-2">
            {pendingTenants.map(t => (
              <div key={t.id} className={`flex items-center gap-3 p-3 rounded-xl ${t.overdueDays > 5 ? 'bg-red-50' : 'bg-yellow-50'}`}>
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-purple-600 text-white font-bold text-xs flex items-center justify-center flex-shrink-0">
                  {(t.name || '?').split(' ').map(n => n[0]).join('').slice(0, 2)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-gray-900 truncate">{t.name}</div>
                  <div className="text-xs text-gray-500">Room {t.room?.room_number} · Due {t.dueDate}</div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-sm font-bold text-gray-900">{formatINR(t.remainingDue)}</div>
                  <span className={`text-xs font-bold ${t.overdueDays > 5 ? 'text-red-600' : 'text-yellow-600'}`}>
                    {t.overdueDays}d overdue
                  </span>
                </div>
                <a href={whatsappLink(t.phone, rentReminderMsg(t.name, t.remainingDue, active?.name ?? 'PG'))}
                  target="_blank" rel="noreferrer"
                  className="p-2 bg-green-100 rounded-xl hover:bg-green-200 transition flex-shrink-0" title="WhatsApp Reminder">
                  <svg className="w-4 h-4 text-green-600" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
                    <path d="M12 0C5.373 0 0 5.373 0 12c0 2.119.553 4.107 1.523 5.84L0 24l6.335-1.509A11.944 11.944 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.89 0-3.66-.493-5.19-1.355l-.372-.22-3.761.896.952-3.658-.243-.387A9.936 9.936 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z" />
                  </svg>
                </a>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent Activities */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 p-5 shadow-sm dark:shadow-none">
        <h2 className="text-sm font-bold text-gray-900 dark:text-white mb-3">Recent Activities</h2>
        {activities.length === 0 ? (
          <div className="text-center py-6 text-gray-400 dark:text-slate-500 text-sm">No recent activity</div>
        ) : (
          <div className="space-y-1">
            {activities.map(a => (
              <div key={a.id} className="flex items-center gap-3 py-2">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${a.iconBg}`}>
                  <a.icon className={`w-3.5 h-3.5 ${a.iconColor}`} />
                </div>
                <div className="flex-1 min-w-0 text-sm text-gray-700 dark:text-slate-300 truncate">{a.text}</div>
                <div className="text-xs text-gray-400 dark:text-slate-500 flex-shrink-0">{formatDate(a.time)}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
