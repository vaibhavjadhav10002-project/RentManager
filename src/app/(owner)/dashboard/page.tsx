'use client'
import { useEffect, useState, useCallback } from 'react'
import { useProperty } from '@/components/shared/PropertyContext'
import {
  getDashboardStats, getTenants, getPayments, getComplaints, getExpenses,
} from '@/lib/supabase/queries'
import { formatINR, computeDueDate, getOverdueDays, whatsappLink, rentReminderMsg } from '@/lib/utils'
import {
  Home, Users, BedDouble, IndianRupee, Wallet, AlertTriangle,
  TrendingUp, TrendingDown, UserPlus, Receipt, Wrench, LogIn,
  Bell, ChevronRight, MessageCircle,
} from 'lucide-react'
import type { DashboardStats, Tenant } from '@/types'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell,
} from 'recharts'

// ── Stat card ────────────────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, sub, subColor, iconBg, iconColor }: {
  icon: React.ElementType; label: string; value: string; sub?: string
  subColor?: string; iconBg: string; iconColor: string
}) {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 p-4 shadow-sm dark:shadow-none">
      <div className="flex items-center gap-3">
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${iconBg}`}>
          <Icon className={`w-5 h-5 ${iconColor}`} />
        </div>
        <div className="min-w-0">
          <div className="text-xs text-gray-500 dark:text-slate-400 font-medium truncate">{label}</div>
          <div className="text-xl font-extrabold text-gray-900 dark:text-white leading-tight">{value}</div>
        </div>
      </div>
      {sub && (
        <div className={`text-xs font-semibold mt-2.5 ${subColor ?? 'text-gray-400 dark:text-slate-500'}`}>{sub}</div>
      )}
    </div>
  )
}

// ── Merged "Recent Activities" feed item ─────────────────────────────────────
interface ActivityItem {
  id: string
  type: 'tenant_joined' | 'payment' | 'expense' | 'complaint'
  text: string
  time: string
  icon: React.ElementType
  iconBg: string
  iconColor: string
}

export default function DashboardPage() {
  const { activeId, active, properties } = useProperty()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [pendingTenants, setPendingTenants] = useState<(Tenant & { dueDate: string; overdueDays: number })[]>([])
  const [recentPayments, setRecentPayments] = useState<any[]>([])
  const [activities, setActivities] = useState<ActivityItem[]>([])
  const [tenantsOnNotice, setTenantsOnNotice] = useState<any[]>([])
  const [openComplaints, setOpenComplaints] = useState<any[]>([])
  const [chartData, setChartData] = useState<{ date: string; income: number; expense: number }[]>([])
  const [loading, setLoading] = useState(true)

  const zeroStats: DashboardStats = {
    totalRooms: 0, totalBeds: 0, occupiedBeds: 0, vacantBeds: 0,
    monthlyRevenue: 0, pendingRent: 0, openComplaints: 0, totalTenants: 0,
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const propIds = activeId === 'all' ? properties.map(p => p.id) : (activeId ? [activeId] : [])

      if (propIds.length === 0) {
        setStats(zeroStats)
        setPendingTenants([]); setRecentPayments([]); setActivities([])
        setTenantsOnNotice([]); setOpenComplaints([])
        setChartData(last30Days().map(d => ({ date: d, income: 0, expense: 0 })))
        setLoading(false)
        return
      }

      const [statsResults, allTenants, allPayments, allComplaints, allExpenses] = await Promise.all([
        Promise.all(propIds.map(getDashboardStats)),
        Promise.all(propIds.map(getTenants)).then(r => r.flat()),
        Promise.all(propIds.map(getPayments)).then(r => r.flat()),
        Promise.all(propIds.map(getComplaints)).then(r => r.flat()),
        Promise.all(propIds.map(getExpenses)).then(r => r.flat()),
      ])

      const agg = statsResults.reduce((acc, s) => ({
        totalRooms: acc.totalRooms + s.totalRooms,
        totalBeds: acc.totalBeds + s.totalBeds,
        occupiedBeds: acc.occupiedBeds + s.occupiedBeds,
        vacantBeds: acc.vacantBeds + s.vacantBeds,
        monthlyRevenue: acc.monthlyRevenue + s.monthlyRevenue,
        pendingRent: acc.pendingRent + s.pendingRent,
        openComplaints: acc.openComplaints + s.openComplaints,
        totalTenants: acc.totalTenants + s.totalTenants,
      }), zeroStats)
      setStats(agg)

      // Pending rent sorted by due date (oldest first) — due date = same
      // day-of-month as each tenant's joining date.
      const today = new Date()
      const pending = allTenants
        .filter(t => t.status === 'active')
        .map(t => ({
          ...t,
          dueDate: computeDueDate(t.joining_date, today).toISOString().slice(0, 10),
          overdueDays: getOverdueDays(t.joining_date, today),
        }))
        .filter(t => {
          const thisMonth = today.toLocaleString('en-IN', { month: 'long', year: 'numeric' })
          const paidThisMonth = allPayments
            .filter(p => p.tenant_id === t.id && p.for_month === thisMonth && p.approval_status === 'approved')
            .reduce((s, p) => s + p.amount_received, 0)
          return paidThisMonth < t.monthly_rent
        })
        .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
      setPendingTenants(pending)

      setRecentPayments(
        allPayments.filter(p => p.approval_status === 'approved')
          .sort((a, b) => new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime())
          .slice(0, 5)
      )

      setTenantsOnNotice(allTenants.filter(t => t.status === 'leaving').slice(0, 5))
      setOpenComplaints(allComplaints.filter(c => c.status !== 'resolved').slice(0, 5))

      // ── Build the real "Recent Activities" feed from actual rows ─────────
      const feed: ActivityItem[] = []
      allTenants
        .slice().sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 5)
        .forEach(t => feed.push({
          id: `tenant-${t.id}`, type: 'tenant_joined',
          text: `${t.name} added${t.room ? ' to Room ' + t.room.room_number : ''}`,
          time: t.created_at,
          icon: UserPlus, iconBg: 'bg-blue-50 dark:bg-blue-500/10', iconColor: 'text-blue-600 dark:text-blue-400',
        }))
      allPayments
        .filter(p => p.approval_status === 'approved')
        .slice().sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 5)
        .forEach(p => feed.push({
          id: `payment-${p.id}`, type: 'payment',
          text: `Rent ${formatINR(p.amount_received)} collected from ${p.tenant?.name ?? 'a tenant'}`,
          time: p.created_at,
          icon: IndianRupee, iconBg: 'bg-green-50 dark:bg-green-500/10', iconColor: 'text-green-600 dark:text-green-400',
        }))
      allExpenses
        .slice().sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 5)
        .forEach(e => feed.push({
          id: `expense-${e.id}`, type: 'expense',
          text: `Expense ${formatINR(e.amount)} added for ${e.category}`,
          time: e.created_at,
          icon: Receipt, iconBg: 'bg-amber-50 dark:bg-amber-500/10', iconColor: 'text-amber-600 dark:text-amber-400',
        }))
      allComplaints
        .slice().sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 5)
        .forEach(c => feed.push({
          id: `complaint-${c.id}`, type: 'complaint',
          text: `Complaint raised: ${c.issue_type}${c.room ? ' in Room ' + c.room.room_number : ''}`,
          time: c.created_at,
          icon: Wrench, iconBg: 'bg-red-50 dark:bg-red-500/10', iconColor: 'text-red-600 dark:text-red-400',
        }))
      feed.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
      setActivities(feed.slice(0, 6))

      // ── Income vs Expense — last 30 days, real payments & expenses ───────
      const days = last30Days()
      const series = days.map(dateKey => {
        const income = allPayments
          .filter(p => p.approval_status === 'approved' && p.payment_date === dateKey)
          .reduce((s, p) => s + p.amount_received, 0)
        const expense = allExpenses
          .filter(e => e.expense_date === dateKey)
          .reduce((s, e) => s + e.amount, 0)
        return { date: dateKey, income, expense }
      })
      setChartData(series)
    } catch {
      setStats(zeroStats)
      setChartData(last30Days().map(d => ({ date: d, income: 0, expense: 0 })))
    }
    setLoading(false)
  }, [activeId, properties])

  useEffect(() => { load() }, [load])

  function last30Days() {
    const out: string[] = []
    const now = new Date()
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now)
      d.setDate(now.getDate() - i)
      out.push(d.toISOString().slice(0, 10))
    }
    return out
  }

  const s = stats ?? zeroStats
  const occupancyPct = s.totalBeds > 0 ? Math.round((s.occupiedBeds / s.totalBeds) * 100) : 0
  const donutData = s.totalBeds > 0
    ? [{ name: 'Occupied', value: s.occupiedBeds }, { name: 'Vacant', value: s.vacantBeds }]
    : [{ name: 'Occupied', value: 0 }, { name: 'Vacant', value: 1 }]

  function timeAgo(iso: string) {
    const diffMs = Date.now() - new Date(iso).getTime()
    const mins = Math.floor(diffMs / 60000)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    const days = Math.floor(hrs / 24)
    return `${days}d ago`
  }

  return (
    <div className="space-y-5">
      {/* Greeting */}
      <div>
        <h1 className="text-xl font-extrabold text-gray-900 dark:text-white">Good Morning! 👋</h1>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
          {activeId === 'all'
            ? `Here's what's happening across your ${properties.length} propert${properties.length === 1 ? 'y' : 'ies'} today.`
            : `Here's what's happening at ${active?.name} today.`}
        </p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        <StatCard icon={IndianRupee} label="This Month's Revenue" value={formatINR(s.monthlyRevenue)}
          iconBg="bg-green-50 dark:bg-green-500/10" iconColor="text-green-600 dark:text-green-400" />
        <StatCard icon={Home} label="Total PGs" value={activeId === 'all' ? String(properties.length) : '1'} sub="All PGs" subColor="text-blue-500"
          iconBg="bg-blue-50 dark:bg-blue-500/10" iconColor="text-blue-600 dark:text-blue-400" />
        <StatCard icon={BedDouble} label="Total Rooms" value={String(s.totalRooms)} sub="All Rooms" subColor="text-purple-500"
          iconBg="bg-purple-50 dark:bg-purple-500/10" iconColor="text-purple-600 dark:text-purple-400" />
        <StatCard icon={Users} label="Occupancy" value={`${occupancyPct}%`} sub={`${s.occupiedBeds} / ${s.totalBeds} Beds`} subColor="text-amber-500"
          iconBg="bg-amber-50 dark:bg-amber-500/10" iconColor="text-amber-600 dark:text-amber-400" />
        <StatCard icon={Users} label="Active Tenants" value={String(s.totalTenants)} sub="All Tenants" subColor="text-green-500"
          iconBg="bg-green-50 dark:bg-green-500/10" iconColor="text-green-600 dark:text-green-400" />
        <StatCard icon={Wallet} label="Rent Due" value={String(pendingTenants.length)} sub={pendingTenants.length > 0 ? `${formatINR(s.pendingRent)} pending` : 'All caught up'} subColor="text-red-500"
          iconBg="bg-red-50 dark:bg-red-500/10" iconColor="text-red-600 dark:text-red-400" />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* Income vs Expense area chart */}
        <div className="xl:col-span-2 bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 p-5 shadow-sm dark:shadow-none">
          <div className="flex items-center justify-between mb-1">
            <div className="font-bold text-sm text-gray-900 dark:text-white">Income vs Expense</div>
          </div>
          <div className="text-xs text-gray-400 dark:text-slate-500 mb-4">Last 30 days</div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#22c55e" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#22c55e" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="expenseGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ef4444" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="text-gray-100 dark:text-slate-800" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false}
                tickFormatter={v => new Date(v).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                interval={4} />
              <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={v => `₹${v >= 1000 ? (v / 1000) + 'k' : v}`} />
              <Tooltip
                formatter={(v: number) => formatINR(v)}
                labelFormatter={v => new Date(v).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                contentStyle={{ borderRadius: 12, border: 'none', fontSize: 12, boxShadow: '0 4px 16px rgba(0,0,0,0.12)' }}
              />
              <Area type="monotone" dataKey="income" name="Income" stroke="#22c55e" strokeWidth={2} fill="url(#incomeGrad)" />
              <Area type="monotone" dataKey="expense" name="Expense" stroke="#ef4444" strokeWidth={2} fill="url(#expenseGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Occupancy donut */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 p-5 shadow-sm dark:shadow-none flex flex-col">
          <div className="font-bold text-sm text-gray-900 dark:text-white mb-1">Occupancy Overview</div>
          <div className="text-xs text-gray-400 dark:text-slate-500 mb-2">
            {activeId === 'all' ? 'All properties' : active?.name}
          </div>
          <div className="flex-1 flex flex-col items-center justify-center">
            <div className="relative">
              <ResponsiveContainer width={150} height={150}>
                <PieChart>
                  <Pie data={donutData} cx="50%" cy="50%" innerRadius={48} outerRadius={68}
                    startAngle={90} endAngle={-270} dataKey="value" stroke="none">
                    <Cell fill="#22c55e" />
                    <Cell fill="#ef4444" />
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <div className="text-2xl font-extrabold text-gray-900 dark:text-white">{s.totalBeds}</div>
                <div className="text-[10px] text-gray-400 dark:text-slate-500">Total Beds</div>
              </div>
            </div>
            <div className="w-full space-y-2 mt-4">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-green-500 flex-shrink-0" />
                <span className="text-xs text-gray-600 dark:text-slate-300 flex-1">Occupied</span>
                <span className="text-xs font-bold text-gray-900 dark:text-white">{s.occupiedBeds} ({occupancyPct}%)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-red-400 flex-shrink-0" />
                <span className="text-xs text-gray-600 dark:text-slate-300 flex-1">Vacant</span>
                <span className="text-xs font-bold text-gray-900 dark:text-white">{s.vacantBeds} ({100 - occupancyPct}%)</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom row: Recent Collections / Recent Activities / Upcoming Reminders */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* Recent Rent Collections */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm dark:shadow-none overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between">
            <span className="font-bold text-sm text-gray-900 dark:text-white">Recent Rent Collections</span>
          </div>
          <div className="p-2">
            {recentPayments.length === 0 ? (
              <div className="text-center py-8 text-xs text-gray-400 dark:text-slate-500">No payments recorded yet</div>
            ) : recentPayments.map(p => (
              <div key={p.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-800/60 transition">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                  {(p.tenant?.name ?? '?').split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-gray-900 dark:text-white truncate">{p.tenant?.name ?? 'Unknown'}</div>
                  <div className="text-[11px] text-gray-400 dark:text-slate-500">Room {p.tenant?.room?.room_number ?? '—'}</div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-xs font-bold text-gray-900 dark:text-white">{formatINR(p.amount_received)}</div>
                  <div className="text-[10px] text-gray-400 dark:text-slate-500">{timeAgo(p.created_at)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Activities */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm dark:shadow-none overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 dark:border-slate-800">
            <span className="font-bold text-sm text-gray-900 dark:text-white">Recent Activities</span>
          </div>
          <div className="p-2">
            {activities.length === 0 ? (
              <div className="text-center py-8 text-xs text-gray-400 dark:text-slate-500">No activity yet</div>
            ) : activities.map(a => (
              <div key={a.id} className="flex items-start gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-800/60 transition">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${a.iconBg}`}>
                  <a.icon className={`w-4 h-4 ${a.iconColor}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-gray-700 dark:text-slate-300 leading-snug">{a.text}</div>
                  <div className="text-[10px] text-gray-400 dark:text-slate-500 mt-0.5">{timeAgo(a.time)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Upcoming Reminders — built from real pending rent + notice-period tenants + open complaints */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm dark:shadow-none overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 dark:border-slate-800">
            <span className="font-bold text-sm text-gray-900 dark:text-white">Upcoming Reminders</span>
          </div>
          <div className="p-2">
            {pendingTenants.length === 0 && tenantsOnNotice.length === 0 && openComplaints.length === 0 ? (
              <div className="text-center py-8 text-xs text-gray-400 dark:text-slate-500">🎉 Nothing needs your attention right now</div>
            ) : (
              <>
                {pendingTenants.slice(0, 2).map(t => (
                  <a key={`due-${t.id}`}
                    href={whatsappLink(t.phone, rentReminderMsg(t.name, t.monthly_rent, t.property?.name ?? active?.name ?? 'your PG'))}
                    target="_blank" rel="noreferrer"
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-800/60 transition">
                    <div className="w-8 h-8 rounded-lg bg-red-50 dark:bg-red-500/10 flex items-center justify-center flex-shrink-0">
                      <Wallet className="w-4 h-4 text-red-600 dark:text-red-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-gray-700 dark:text-slate-300">Rent due from {t.name}</div>
                      <div className="text-[10px] text-gray-400 dark:text-slate-500">{t.overdueDays > 0 ? `${t.overdueDays}d overdue` : 'Due today'}</div>
                    </div>
                    <MessageCircle className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                  </a>
                ))}
                {tenantsOnNotice.slice(0, 2).map((t: any) => (
                  <div key={`notice-${t.id}`} className="flex items-center gap-3 px-3 py-2.5 rounded-xl">
                    <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                      <LogIn className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-gray-700 dark:text-slate-300">{t.name} is on notice period</div>
                      <div className="text-[10px] text-gray-400 dark:text-slate-500">Leaving {t.leaving_date ? new Date(t.leaving_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : 'soon'}</div>
                    </div>
                  </div>
                ))}
                {openComplaints.slice(0, 2).map((c: any) => (
                  <div key={`complaint-${c.id}`} className="flex items-center gap-3 px-3 py-2.5 rounded-xl">
                    <div className="w-8 h-8 rounded-lg bg-purple-50 dark:bg-purple-500/10 flex items-center justify-center flex-shrink-0">
                      <Wrench className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-gray-700 dark:text-slate-300">{c.issue_type} — Room {c.room?.room_number ?? '—'}</div>
                      <div className="text-[10px] text-gray-400 dark:text-slate-500 capitalize">{c.status.replace('_', ' ')}</div>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
