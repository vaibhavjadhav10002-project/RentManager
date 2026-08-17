'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { useProperty } from '@/components/shared/PropertyContext'
import { getFinancialHistory, getDashboardStats, getExpenses, getPayments, getTenants } from '@/lib/supabase/queries'
import { Download, Loader2, TrendingUp, TrendingDown, Scale, History, ChevronRight, Building2, Users2, Clock } from 'lucide-react'
import { formatINR } from '@/lib/utils'
import { toast } from 'sonner'
import type { DashboardStats } from '@/types'
import { SkeletonCardGrid, SkeletonChart } from '@/components/shared/Skeleton'
import { usePullToRefreshHandler } from '@/lib/native/pullToRefresh'

const ReportsOverviewChart = dynamic(() => import('@/components/owner/ReportCharts').then(m => m.ReportsOverviewChart), {
  ssr: false, loading: () => <div className="h-[220px] animate-pulse bg-owner-surface-hover rounded-owner-lg" />,
})

// Report modules — each is its own dedicated page (built in its own phase).
// Kept here so the dashboard always reflects the true set of available reports.
const REPORT_MODULES = [
  { href: '/reports/income', label: 'Income Report', desc: 'Rent, deposits & other collections', icon: TrendingUp, color: 'text-green-600 bg-green-50' },
  { href: '/reports/expenses', label: 'Expense Report', desc: 'Spending by category & property', icon: TrendingDown, color: 'text-red-600 bg-red-50' },
  { href: '/reports/profit-loss', label: 'Profit & Loss', desc: 'Income vs. expenses, net margin', icon: Scale, color: 'text-purple-600 bg-purple-50' },
  { href: '/reports/activity-log', label: 'Activity Logs', desc: 'Who did what, and when', icon: History, color: 'text-blue-600 bg-blue-50' },
]

export default function ReportsPage() {
  const { active, activeId, properties } = useProperty()
  const [chartData, setChartData] = useState<{ month: string; revenue: number; expenses: number; profit: number }[]>([])
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  usePullToRefreshHandler(() => setRefreshKey(k => k + 1))
  const [thisMonthExpenses, setThisMonthExpenses] = useState(0)
  const [rawData, setRawData] = useState<{ payments: any[]; expenses: any[]; tenants: any[] }>({ payments: [], expenses: [], tenants: [] })
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const propIds = activeId === 'all' ? properties.map(p => p.id) : [activeId]
        if (propIds.length === 0 || propIds.some(id => !id)) { setLoading(false); return }

        const history = await getFinancialHistory(propIds)
        setChartData(history)

        const statsResults = await Promise.all(propIds.map(id => getDashboardStats(id)))
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
        const agg: DashboardStats = {
          ...raw,
          revenueTrendPct: raw.lastMonthRevenue > 0 ? Math.round(((raw.monthlyRevenue - raw.lastMonthRevenue) / raw.lastMonthRevenue) * 100) : null,
          collectionRatePct: expected > 0 ? Math.round((raw.monthlyRevenue / expected) * 100) : 100,
          avgRentPerBed: raw.occupiedBeds > 0 ? Math.round(raw.activeRentSum / raw.occupiedBeds) : 0,
        }
        setStats(agg)

        const thisMonth = new Date()
        const monthStart = new Date(thisMonth.getFullYear(), thisMonth.getMonth(), 1).toISOString().slice(0, 10)
        const [paymentsLists, expensesLists, tenantsLists] = await Promise.all([
          Promise.all(propIds.map(id => getPayments(id))),
          Promise.all(propIds.map(id => getExpenses(id))),
          Promise.all(propIds.map(id => getTenants(id))),
        ])
        const allExpenses = expensesLists.flat()
        const totalExp = allExpenses.filter(e => e.expense_date >= monthStart).reduce((s, e) => s + e.amount, 0)
        setThisMonthExpenses(totalExp)
        setRawData({ payments: paymentsLists.flat(), expenses: allExpenses, tenants: tenantsLists.flat() })
      } catch { toast.error('Failed to load report data') }
      setLoading(false)
    }
    load()
  }, [activeId, properties, refreshKey])

  const occupancyPct = stats ? Math.round((stats.occupiedBeds / (stats.totalBeds || 1)) * 100) : 0
  const netProfit = (stats?.monthlyRevenue ?? 0) - thisMonthExpenses

  async function exportExcel() {
    if (loading) { toast.error('Still loading data — try again in a moment'); return }
    setExporting(true)
    try {
      const XLSX = await import('xlsx')
      const wb = XLSX.utils.book_new()

      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
        chartData.map(d => ({ Month: d.month, Revenue: d.revenue, Expenses: d.expenses, Profit: d.profit }))
      ), 'Monthly Summary')

      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
        rawData.payments.map(p => ({
          Tenant: p.tenant?.name ?? '—', Room: p.tenant?.room?.room_number ?? '—',
          Type: p.type, Month: p.for_month ?? '—', 'Total Due': p.total_due,
          'Amount Received': p.amount_received, Method: p.method ?? '—',
          Status: p.approval_status, Date: p.payment_date,
        }))
      ), 'Payments')

      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
        rawData.expenses.map(e => ({ Category: e.category, Amount: e.amount, Date: e.expense_date, Notes: e.notes ?? '—' }))
      ), 'Expenses')

      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
        rawData.tenants.map(t => ({
          Name: t.name, Phone: t.phone, Room: t.room?.room_number ?? '—',
          'Monthly Rent': t.monthly_rent, 'Deposit Paid': t.deposit_paid, 'Deposit Total': t.deposit_amount,
          Status: t.status, 'Joining Date': t.joining_date,
        }))
      ), 'Tenants')

      const propLabel = activeId === 'all' ? 'All-Properties' : (active?.name ?? 'Property').replace(/\s+/g, '-')
      XLSX.writeFile(wb, `PG-Report-${propLabel}-${new Date().toISOString().slice(0, 10)}.xlsx`)
      toast.success('Excel report downloaded!')
    } catch (e: any) {
      toast.error('Could not generate the export: ' + e.message)
    }
    setExporting(false)
  }

  const summaryCards = [
    { label: 'Monthly Revenue', value: formatINR(stats?.monthlyRevenue ?? 0), icon: TrendingUp, tone: 'text-green-600 bg-green-50' },
    { label: 'Occupancy Rate', value: `${occupancyPct}%`, icon: Building2, tone: 'text-blue-600 bg-blue-50' },
    { label: 'Total Expenses', value: formatINR(thisMonthExpenses), icon: TrendingDown, tone: 'text-red-600 bg-red-50' },
    { label: 'Net Profit', value: formatINR(netProfit), icon: Scale, tone: netProfit >= 0 ? 'text-purple-600 bg-purple-50' : 'text-red-600 bg-red-50' },
    { label: 'Pending Rent', value: formatINR(stats?.pendingRent ?? 0), icon: Clock, tone: 'text-yellow-600 bg-yellow-50' },
    { label: 'Active Tenants', value: String(stats?.totalTenants ?? 0), icon: Users2, tone: 'text-owner-fg bg-owner-surface-hover' },
  ]

  if (loading) return (
    <div className="space-y-4"><SkeletonCardGrid count={6} /><SkeletonChart /></div>
  )

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-extrabold text-owner-fg">Reports Dashboard</h1>
          <p className="text-sm text-owner-muted">{activeId === 'all' ? 'All properties' : active?.name}</p>
        </div>
      </div>

      {/* Summary cards — all real, computed from the database */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {summaryCards.map(r => (
          <div key={r.label} className="bg-owner-surface rounded-owner-xl border border-owner-border p-4 shadow-owner-xs hover:shadow-owner-sm transition-shadow">
            <div className={`w-9 h-9 rounded-owner-lg flex items-center justify-center mb-2 ${r.tone}`}>
              <r.icon className="w-4 h-4" />
            </div>
            <div className="text-xs text-owner-muted font-semibold uppercase tracking-wide">{r.label}</div>
            <div className="text-xl font-extrabold mt-0.5 text-owner-fg owner-numeric">{r.value}</div>
          </div>
        ))}
      </div>

      {/* Chart — real revenue/expenses from payments & expenses tables */}
      <div className="bg-owner-surface rounded-owner-xl border border-owner-border p-5 shadow-owner-xs">
        <div className="font-bold text-sm text-owner-fg mb-1">Revenue, Expenses & Profit</div>
        <div className="text-xs text-owner-muted-subtle mb-4">Last 6 months</div>
        {chartData.every(d => d.revenue === 0 && d.expenses === 0) ? (
          <div className="text-center py-12 text-owner-muted-subtle text-sm">No payment or expense records yet for this period</div>
        ) : (
          <ReportsOverviewChart chartData={chartData} />
        )}
      </div>

      {/* Report modules — each links to its own dedicated report page */}
      <div>
        <div className="font-bold text-sm text-owner-fg mb-3">Report Modules</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {REPORT_MODULES.map(m => (
            <Link key={m.href} href={m.href}
              className="bg-owner-surface rounded-owner-xl border border-owner-border p-4 flex items-center gap-3 shadow-owner-xs hover:shadow-owner-sm active:scale-[0.99] transition text-left">
              <div className={`w-10 h-10 rounded-owner-lg flex items-center justify-center shrink-0 ${m.color}`}>
                <m.icon className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-owner-fg">{m.label}</div>
                <div className="text-xs text-owner-muted-subtle truncate">{m.desc}</div>
              </div>
              <ChevronRight className="w-4 h-4 text-owner-muted-subtle shrink-0" />
            </Link>
          ))}
        </div>
      </div>

      {/* Quick full-data export — everything in one workbook */}
      <div className="bg-owner-surface rounded-owner-xl border border-owner-border p-4 flex items-center justify-between gap-3 shadow-owner-xs">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-owner-fg">Full Data Export</div>
          <div className="text-xs text-owner-muted-subtle truncate">Monthly summary, payments, expenses & tenants in one Excel file</div>
        </div>
        <button onClick={exportExcel} disabled={exporting}
          className="flex items-center gap-2 px-4 py-2.5 bg-owner-surface-hover hover:opacity-80 active:scale-[0.98] text-owner-fg rounded-owner-lg text-sm font-semibold transition disabled:opacity-50 shrink-0">
          {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} Export
        </button>
      </div>
    </div>
  )
}
