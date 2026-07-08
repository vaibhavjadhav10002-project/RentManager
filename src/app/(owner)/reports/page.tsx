'use client'
import { useEffect, useState } from 'react'
import { useProperty } from '@/components/shared/PropertyContext'
import { getFinancialHistory, getDashboardStats, getExpenses } from '@/lib/supabase/queries'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { Download, Loader2 } from 'lucide-react'
import { formatINR } from '@/lib/utils'
import { toast } from 'sonner'
import type { DashboardStats } from '@/types'

export default function ReportsPage() {
  const { active, activeId, properties } = useProperty()
  const [chartData, setChartData] = useState<{ month: string; revenue: number; expenses: number; profit: number }[]>([])
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [thisMonthExpenses, setThisMonthExpenses] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const propIds = activeId === 'all' ? properties.map(p => p.id) : [activeId]
        if (propIds.length === 0 || propIds.some(id => !id)) { setLoading(false); return }

        const history = await getFinancialHistory(propIds)
        setChartData(history)

        const statsResults = await Promise.all(propIds.map(id => getDashboardStats(id)))
        const agg = statsResults.reduce((acc, s) => ({
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

        const thisMonth = new Date()
        const monthStart = new Date(thisMonth.getFullYear(), thisMonth.getMonth(), 1).toISOString().slice(0, 10)
        const expensesLists = await Promise.all(propIds.map(id => getExpenses(id)))
        const totalExp = expensesLists.flat().filter(e => e.expense_date >= monthStart).reduce((s, e) => s + e.amount, 0)
        setThisMonthExpenses(totalExp)
      } catch { toast.error('Failed to load report data') }
      setLoading(false)
    }
    load()
  }, [activeId, properties])

  const occupancyPct = stats ? Math.round((stats.occupiedBeds / (stats.totalBeds || 1)) * 100) : 0
  const netProfit = (stats?.monthlyRevenue ?? 0) - thisMonthExpenses

  const summaryCards = [
    { label: 'Monthly Revenue', value: formatINR(stats?.monthlyRevenue ?? 0), color: 'text-green-600' },
    { label: 'Occupancy Rate', value: `${occupancyPct}%`, color: 'text-blue-600' },
    { label: 'Total Expenses', value: formatINR(thisMonthExpenses), color: 'text-red-600' },
    { label: 'Net Profit', value: formatINR(netProfit), color: netProfit >= 0 ? 'text-purple-600' : 'text-red-600' },
    { label: 'Pending Rent', value: formatINR(stats?.pendingRent ?? 0), color: 'text-yellow-600' },
    { label: 'Active Tenants', value: String(stats?.totalTenants ?? 0), color: 'text-gray-700' },
  ]

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-gray-400">
      <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading report…
    </div>
  )

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-extrabold text-gray-900">Reports</h1>
          <p className="text-sm text-gray-500">{activeId === 'all' ? 'All properties' : active?.name}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => toast.success('PDF export coming soon')} className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-semibold transition">
            <Download className="w-4 h-4" /> PDF
          </button>
          <button onClick={() => toast.success('Excel export coming soon')} className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-semibold transition">
            <Download className="w-4 h-4" /> Excel
          </button>
        </div>
      </div>

      {/* Summary cards — all real, computed from the database */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {summaryCards.map(r => (
          <div key={r.label} className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm hover:shadow-md transition-shadow">
            <div className="text-xs text-gray-500 font-semibold uppercase tracking-wide">{r.label}</div>
            <div className={`text-2xl font-extrabold mt-1 ${r.color}`}>{r.value}</div>
          </div>
        ))}
      </div>

      {/* Chart — real revenue/expenses from payments & expenses tables */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
        <div className="font-bold text-sm text-gray-900 mb-1">Revenue, Expenses & Profit</div>
        <div className="text-xs text-gray-400 mb-4">Last 6 months</div>
        {chartData.every(d => d.revenue === 0 && d.expenses === 0) ? (
          <div className="text-center py-12 text-gray-400 text-sm">No payment or expense records yet for this period</div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} barGap={2}>
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={v => `₹${v / 1000}k`} />
              <Tooltip formatter={(v: number) => formatINR(v)} />
              <Bar dataKey="revenue" fill="#2563EB" radius={[4, 4, 0, 0]} name="Revenue" />
              <Bar dataKey="expenses" fill="#EF444466" radius={[4, 4, 0, 0]} name="Expenses" />
              <Bar dataKey="profit" fill="#10B981" radius={[4, 4, 0, 0]} name="Profit" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Report download tiles — export generation not built yet */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {['Monthly Revenue Report', 'Occupancy Report', 'Pending Rent Report', 'Expense Report', 'Profit & Loss', 'Tenant Summary'].map(r => (
          <button key={r} onClick={() => toast.success(`${r} export coming soon`)} className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center justify-between shadow-sm hover:shadow-md transition text-left">
            <div>
              <div className="text-sm font-semibold text-gray-800">{r}</div>
              <div className="text-xs text-gray-400">PDF & Excel</div>
            </div>
            <Download className="w-4 h-4 text-blue-500 flex-shrink-0" />
          </button>
        ))}
      </div>
    </div>
  )
}
