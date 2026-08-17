'use client'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { useProperty } from '@/components/shared/PropertyContext'
import { getPayments, getExpenses } from '@/lib/supabase/queries'
import { formatINR } from '@/lib/utils'
import { ChevronLeft, Download, Loader2, Scale } from 'lucide-react'
import { toast } from 'sonner'
import type { Payment } from '@/types'
import { SkeletonCardGrid, SkeletonChart, SkeletonTable } from '@/components/shared/Skeleton'
import { usePullToRefreshHandler } from '@/lib/native/pullToRefresh'

const ProfitLossChart = dynamic(() => import('@/components/owner/ReportCharts').then(m => m.ProfitLossChart), {
  ssr: false, loading: () => <div className="h-[240px] animate-pulse bg-owner-surface-hover rounded-owner-lg" />,
})

interface MonthRow { key: string; month: string; income: number; expenses: number; profit: number; margin: number }

const RANGE_OPTIONS = [
  { label: '3 Months', value: 3 },
  { label: '6 Months', value: 6 },
  { label: '12 Months', value: 12 },
]

export default function ProfitLossReportPage() {
  const { active, activeId, properties } = useProperty()
  const [rows, setRows] = useState<MonthRow[]>([])
  const [refreshKey, setRefreshKey] = useState(0)
  usePullToRefreshHandler(() => setRefreshKey(k => k + 1))
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [rangeMonths, setRangeMonths] = useState(6)

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const propIds = activeId === 'all' ? properties.map(p => p.id) : [activeId]
        if (propIds.length === 0 || propIds.some(id => !id)) { setRows([]); setLoading(false); return }

        const monthsBack = 12 // fetch a full year once; range selector just changes how much of it we show
        const since = new Date()
        since.setMonth(since.getMonth() - (monthsBack - 1))
        since.setDate(1)

        const [paymentsLists, expensesLists] = await Promise.all([
          Promise.all(propIds.map(id => getPayments(id))),
          Promise.all(propIds.map(id => getExpenses(id))),
        ])
        // Income here is ALL approved collections (rent + deposit + advance) — a true P&L needs every
        // rupee that came in, not just rent (which is all the main dashboard's chart tracks).
        const payments = (paymentsLists.flat() as Payment[]).filter(p => p.approval_status === 'approved')
        const expenses = expensesLists.flat()

        const buckets: MonthRow[] = []
        const cursor = new Date(since)
        for (let i = 0; i < monthsBack; i++) {
          buckets.push({
            key: `${cursor.getFullYear()}-${cursor.getMonth()}`,
            month: cursor.toLocaleString('en-IN', { month: 'short', year: '2-digit' }),
            income: 0, expenses: 0, profit: 0, margin: 0,
          })
          cursor.setMonth(cursor.getMonth() + 1)
        }
        const bucketMap = new Map(buckets.map(b => [b.key, b]))

        payments.forEach(p => {
          const d = new Date(p.payment_date)
          const b = bucketMap.get(`${d.getFullYear()}-${d.getMonth()}`)
          if (b) b.income += p.amount_received
        })
        expenses.forEach(e => {
          const d = new Date(e.expense_date)
          const b = bucketMap.get(`${d.getFullYear()}-${d.getMonth()}`)
          if (b) b.expenses += e.amount
        })
        buckets.forEach(b => {
          b.profit = b.income - b.expenses
          b.margin = b.income > 0 ? Math.round((b.profit / b.income) * 100) : 0
        })
        setRows(buckets)
      } catch { toast.error('Failed to load profit & loss data') }
      setLoading(false)
    }
    load()
  }, [activeId, properties, refreshKey])

  const visible = useMemo(() => rows.slice(-rangeMonths), [rows, rangeMonths])

  const totals = useMemo(() => {
    const income = visible.reduce((s, r) => s + r.income, 0)
    const expenses = visible.reduce((s, r) => s + r.expenses, 0)
    const profit = income - expenses
    const margin = income > 0 ? Math.round((profit / income) * 100) : 0
    return { income, expenses, profit, margin }
  }, [visible])

  async function exportExcel() {
    if (loading) { toast.error('Still loading data — try again in a moment'); return }
    setExporting(true)
    try {
      const XLSX = await import('xlsx')
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
        visible.map(r => ({ Month: r.month, Income: r.income, Expenses: r.expenses, 'Net Profit': r.profit, 'Margin %': r.margin }))
      ), 'Profit & Loss')
      const propLabel = activeId === 'all' ? 'All-Properties' : (active?.name ?? 'Property').replace(/\s+/g, '-')
      XLSX.writeFile(wb, `Profit-Loss-${propLabel}-${rangeMonths}mo.xlsx`)
      toast.success('P&L report downloaded!')
    } catch (e: any) {
      toast.error('Could not generate the export: ' + e.message)
    }
    setExporting(false)
  }

  if (loading) return (
    <div className="space-y-4"><SkeletonCardGrid count={4} /><SkeletonChart /><SkeletonTable rows={5} cols={5} /></div>
  )

  return (
    <div className="space-y-6">
      <Link href="/reports" className="inline-flex items-center gap-1 text-sm font-semibold text-owner-muted hover:text-owner-fg transition">
        <ChevronLeft className="w-4 h-4" /> Reports Dashboard
      </Link>

      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-extrabold text-owner-fg">Profit &amp; Loss Report</h1>
          <p className="text-sm text-owner-muted">{activeId === 'all' ? 'All properties' : active?.name}</p>
        </div>
        <button onClick={exportExcel} disabled={exporting} className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-owner-lg text-sm font-semibold transition disabled:opacity-50">
          {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} Excel
        </button>
      </div>

      {/* Range selector */}
      <div className="flex gap-1.5 flex-wrap">
        {RANGE_OPTIONS.map(r => (
          <button key={r.value} onClick={() => setRangeMonths(r.value)}
            className={`px-3 py-1.5 rounded-owner-full text-xs font-semibold transition active:scale-[0.97] ${
              rangeMonths === r.value ? 'bg-owner-primary text-owner-primary-fg' : 'bg-owner-surface-hover text-owner-muted hover:text-owner-fg'
            }`}>
            {r.label}
          </button>
        ))}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-owner-surface rounded-owner-xl border border-owner-border p-5 shadow-owner-xs">
          <div className="text-xs text-owner-muted font-semibold uppercase tracking-wide">Total Income</div>
          <div className="text-2xl font-extrabold mt-1 text-green-600">{formatINR(totals.income)}</div>
        </div>
        <div className="bg-owner-surface rounded-owner-xl border border-owner-border p-5 shadow-owner-xs">
          <div className="text-xs text-owner-muted font-semibold uppercase tracking-wide">Total Expenses</div>
          <div className="text-2xl font-extrabold mt-1 text-red-600">{formatINR(totals.expenses)}</div>
        </div>
        <div className="bg-owner-surface rounded-owner-xl border border-owner-border p-5 shadow-owner-xs">
          <div className="text-xs text-owner-muted font-semibold uppercase tracking-wide">Net Profit</div>
          <div className={`text-2xl font-extrabold mt-1 ${totals.profit >= 0 ? 'text-purple-600' : 'text-red-600'}`}>{formatINR(totals.profit)}</div>
        </div>
        <div className="bg-owner-surface rounded-owner-xl border border-owner-border p-5 shadow-owner-xs">
          <div className="text-xs text-owner-muted font-semibold uppercase tracking-wide">Profit Margin</div>
          <div className={`text-2xl font-extrabold mt-1 ${totals.margin >= 0 ? 'text-blue-600' : 'text-red-600'}`}>{totals.margin}%</div>
        </div>
      </div>

      {/* Chart */}
      <div className="bg-owner-surface rounded-owner-xl border border-owner-border p-5 shadow-owner-xs">
        <div className="font-bold text-sm text-owner-fg mb-1">Income vs. Expenses</div>
        <div className="text-xs text-owner-muted-subtle mb-4">Last {rangeMonths} months</div>
        {visible.every(r => r.income === 0 && r.expenses === 0) ? (
          <div className="text-center py-12 text-owner-muted-subtle text-sm">No income or expense records yet for this period</div>
        ) : (
          <ProfitLossChart visible={visible} />
        )}
      </div>

      {/* Monthly table */}
      <div className="bg-owner-surface rounded-owner-xl border border-owner-border shadow-owner-xs overflow-hidden">
        <div className="px-5 py-4 font-bold text-sm text-owner-fg border-b border-owner-border">Month-by-Month</div>
        {visible.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-owner-muted-subtle gap-2">
            <Scale className="w-8 h-8" />
            <div className="text-sm">No data for this period</div>
          </div>
        ) : (
          <>
            {/* Mobile: stacked card list, no horizontal scroll */}
            <div className="sm:hidden divide-y divide-owner-border">
              {visible.map(r => (
                <div key={r.key} className="px-5 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-medium text-owner-fg">{r.month}</div>
                    <div className={`text-sm font-semibold ${r.profit >= 0 ? 'text-owner-fg' : 'text-red-600'}`}>
                      {formatINR(r.profit)} <span className={`text-xs font-normal ${r.margin >= 0 ? 'text-owner-muted' : 'text-red-500'}`}>({r.margin}%)</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 mt-1 text-xs">
                    <span className="text-green-600">Income {formatINR(r.income)}</span>
                    <span className="text-red-600">Expenses {formatINR(r.expenses)}</span>
                  </div>
                </div>
              ))}
            </div>
            {/* Desktop/tablet: full table */}
            <table className="w-full text-sm hidden sm:table">
              <thead>
                <tr className="text-left text-xs text-owner-muted-subtle uppercase tracking-wide border-b border-owner-border">
                  <th className="px-5 py-3 font-semibold">Month</th>
                  <th className="px-5 py-3 font-semibold text-right">Income</th>
                  <th className="px-5 py-3 font-semibold text-right">Expenses</th>
                  <th className="px-5 py-3 font-semibold text-right">Net Profit</th>
                  <th className="px-5 py-3 font-semibold text-right">Margin</th>
                </tr>
              </thead>
              <tbody>
                {visible.map(r => (
                  <tr key={r.key} className="border-b border-owner-border last:border-0 hover:bg-owner-surface-hover/50">
                    <td className="px-5 py-3 font-medium text-owner-fg">{r.month}</td>
                    <td className="px-5 py-3 text-right text-green-600">{formatINR(r.income)}</td>
                    <td className="px-5 py-3 text-right text-red-600">{formatINR(r.expenses)}</td>
                    <td className={`px-5 py-3 text-right font-semibold ${r.profit >= 0 ? 'text-owner-fg' : 'text-red-600'}`}>{formatINR(r.profit)}</td>
                    <td className={`px-5 py-3 text-right ${r.margin >= 0 ? 'text-owner-muted' : 'text-red-500'}`}>{r.margin}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>
    </div>
  )
}
