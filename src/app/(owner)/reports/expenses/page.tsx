'use client'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useProperty } from '@/components/shared/PropertyContext'
import { getExpenses } from '@/lib/supabase/queries'
import { formatINR, formatDate } from '@/lib/utils'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { ChevronLeft, Download, Loader2, TrendingDown } from 'lucide-react'
import { toast } from 'sonner'
import type { Expense } from '@/types'

// Same categories & colors as the Expenses page, so a category reads identically everywhere in the app.
const CATEGORIES = ['Electricity', 'Water', 'WiFi', 'Cleaning', 'Maintenance', 'Salary', 'Other']
const CAT_COLOR: Record<string, string> = {
  Electricity: 'bg-yellow-100 text-yellow-700', Water: 'bg-blue-100 text-blue-700',
  WiFi: 'bg-purple-100 text-purple-700', Cleaning: 'bg-green-100 text-green-700',
  Maintenance: 'bg-red-100 text-red-700', Salary: 'bg-gray-100 text-gray-700', Other: 'bg-gray-100 text-gray-600',
}

interface ExpenseRow extends Expense { property_name: string }

export default function ExpenseReportPage() {
  const { active, activeId, properties } = useProperty()
  const [expenses, setExpenses] = useState<ExpenseRow[]>([])
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [month, setMonth] = useState<string>('all')
  const [category, setCategory] = useState<string>('all')

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const propIds = activeId === 'all' ? properties.map(p => p.id) : [activeId]
        if (propIds.length === 0 || propIds.some(id => !id)) { setExpenses([]); setLoading(false); return }
        const lists = await Promise.all(propIds.map(id => getExpenses(id)))
        const nameOf = (id: string) => properties.find(p => p.id === id)?.name ?? '—'
        const rows = lists.flat().map(e => ({ ...e, property_name: nameOf(e.property_id) })) as ExpenseRow[]
        setExpenses(rows)
      } catch { toast.error('Failed to load expense data') }
      setLoading(false)
    }
    load()
  }, [activeId, properties])

  const monthOptions = useMemo(() => {
    const map = new Map<string, string>()
    expenses.forEach(e => {
      const d = new Date(e.expense_date)
      const key = `${d.getFullYear()}-${d.getMonth()}`
      if (!map.has(key)) map.set(key, d.toLocaleString('en-IN', { month: 'long', year: 'numeric' }))
    })
    return Array.from(map.entries()).sort((a, b) => (a[0] < b[0] ? 1 : -1)).map(([key, label]) => ({ key, label }))
  }, [expenses])

  const filtered = useMemo(() => {
    return expenses.filter(e => {
      if (category !== 'all' && e.category !== category) return false
      if (month !== 'all') {
        const d = new Date(e.expense_date)
        if (`${d.getFullYear()}-${d.getMonth()}` !== month) return false
      }
      return true
    }).sort((a, b) => (a.expense_date < b.expense_date ? 1 : -1))
  }, [expenses, category, month])

  const total = filtered.reduce((s, e) => s + e.amount, 0)
  const byCategory = CATEGORIES
    .map(cat => ({ cat, total: filtered.filter(e => e.category === cat).reduce((s, e) => s + e.amount, 0) }))
    .filter(c => c.total > 0)
    .sort((a, b) => b.total - a.total)

  async function exportExcel() {
    if (loading) { toast.error('Still loading data — try again in a moment'); return }
    if (filtered.length === 0) { toast.error('Nothing to export for this filter'); return }
    setExporting(true)
    try {
      const XLSX = await import('xlsx')
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
        filtered.map(e => ({
          Date: e.expense_date, Property: e.property_name, Category: e.category,
          Amount: e.amount, Notes: e.notes ?? '—',
        }))
      ), 'Expenses')
      const propLabel = activeId === 'all' ? 'All-Properties' : (active?.name ?? 'Property').replace(/\s+/g, '-')
      const monthLabel = month === 'all' ? 'All-Time' : (monthOptions.find(m => m.key === month)?.label ?? 'Filtered').replace(/\s+/g, '-')
      XLSX.writeFile(wb, `Expense-Report-${propLabel}-${monthLabel}.xlsx`)
      toast.success('Expense report downloaded!')
    } catch (e: any) {
      toast.error('Could not generate the export: ' + e.message)
    }
    setExporting(false)
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-gray-400">
      <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading expense data…
    </div>
  )

  return (
    <div className="space-y-6">
      <Link href="/reports" className="inline-flex items-center gap-1 text-sm font-semibold text-gray-500 hover:text-gray-700 transition">
        <ChevronLeft className="w-4 h-4" /> Reports Dashboard
      </Link>

      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-extrabold text-gray-900">Expense Report</h1>
          <p className="text-sm text-gray-500">{activeId === 'all' ? 'All properties' : active?.name}</p>
        </div>
        <button onClick={exportExcel} disabled={exporting} className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-semibold transition disabled:opacity-50">
          {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} Excel
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <select value={month} onChange={e => setMonth(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:border-blue-500">
          <option value="all">All Time</option>
          {monthOptions.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
        </select>
        <div className="flex gap-1.5 flex-wrap">
          <button onClick={() => setCategory('all')}
            className={`px-3 py-2 rounded-xl text-sm font-semibold transition ${category === 'all' ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
            All Categories
          </button>
          {CATEGORIES.map(cat => (
            <button key={cat} onClick={() => setCategory(cat)}
              className={`px-3 py-2 rounded-xl text-sm font-semibold transition ${category === cat ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Summary + category breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <div className="text-xs text-gray-500 font-semibold uppercase tracking-wide">Total Expenses</div>
          <div className="text-2xl font-extrabold mt-1 text-red-600">{formatINR(total)}</div>
          <div className="text-xs text-gray-400 mt-0.5">{filtered.length} record{filtered.length === 1 ? '' : 's'}</div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm lg:col-span-2">
          <div className="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-2">By Category</div>
          {byCategory.length === 0 ? (
            <div className="text-sm text-gray-400 py-4 text-center">No expenses match this filter</div>
          ) : (
            <ResponsiveContainer width="100%" height={140}>
              <BarChart data={byCategory} layout="vertical" margin={{ left: 0 }}>
                <XAxis type="number" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={v => `₹${v / 1000}k`} />
                <YAxis type="category" dataKey="cat" width={80} tick={{ fontSize: 11, fill: '#475569' }} axisLine={false} tickLine={false} />
                <Tooltip formatter={(v: number) => formatINR(v)} />
                <Bar dataKey="total" fill="#EF4444" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Transactions table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 font-bold text-sm text-gray-900 border-b border-gray-100">Expense Records</div>
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400 gap-2">
            <TrendingDown className="w-8 h-8" />
            <div className="text-sm">No expenses match this filter</div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-400 uppercase tracking-wide border-b border-gray-100">
                  <th className="px-5 py-3 font-semibold">Date</th>
                  {activeId === 'all' && <th className="px-5 py-3 font-semibold">Property</th>}
                  <th className="px-5 py-3 font-semibold">Category</th>
                  <th className="px-5 py-3 font-semibold">Notes</th>
                  <th className="px-5 py-3 font-semibold text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(e => (
                  <tr key={e.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
                    <td className="px-5 py-3 text-gray-600 whitespace-nowrap">{formatDate(e.expense_date)}</td>
                    {activeId === 'all' && <td className="px-5 py-3 text-gray-500">{e.property_name}</td>}
                    <td className="px-5 py-3"><span className={`text-xs font-bold px-2.5 py-1 rounded-full ${CAT_COLOR[e.category] ?? 'bg-gray-100 text-gray-600'}`}>{e.category}</span></td>
                    <td className="px-5 py-3 text-gray-500 max-w-xs truncate">{e.notes ?? '—'}</td>
                    <td className="px-5 py-3 text-right font-semibold text-gray-900">{formatINR(e.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
