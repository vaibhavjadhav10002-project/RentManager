'use client'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useProperty } from '@/components/shared/PropertyContext'
import { getPayments } from '@/lib/supabase/queries'
import { formatINR, formatDate } from '@/lib/utils'
import { ChevronLeft, Download, Loader2, IndianRupee } from 'lucide-react'
import { toast } from 'sonner'
import type { Payment, PaymentType } from '@/types'

const TYPE_LABEL: Record<PaymentType, string> = { rent: 'Rent', deposit: 'Deposit', advance: 'Advance' }
const TYPE_BADGE: Record<PaymentType, string> = {
  rent: 'bg-blue-50 text-blue-600',
  deposit: 'bg-purple-50 text-purple-600',
  advance: 'bg-amber-50 text-amber-600',
}

export default function IncomeReportPage() {
  const { active, activeId, properties } = useProperty()
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [month, setMonth] = useState<string>('all') // 'all' or 'YYYY-M'
  const [typeFilter, setTypeFilter] = useState<'all' | PaymentType>('all')

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const propIds = activeId === 'all' ? properties.map(p => p.id) : [activeId]
        if (propIds.length === 0 || propIds.some(id => !id)) { setPayments([]); setLoading(false); return }
        const lists = await Promise.all(propIds.map(id => getPayments(id)))
        // Income = only payments that actually count as collected money — approved, not pending/rejected.
        const approved = (lists.flat() as Payment[]).filter(p => p.approval_status === 'approved')
        setPayments(approved)
      } catch { toast.error('Failed to load income data') }
      setLoading(false)
    }
    load()
  }, [activeId, properties])

  // Distinct months present in the data, newest first — built from payment_date (reliable),
  // not the free-text for_month field which is only ever filled in for rent.
  const monthOptions = useMemo(() => {
    const map = new Map<string, string>() // key "YYYY-M" -> label
    payments.forEach(p => {
      const d = new Date(p.payment_date)
      const key = `${d.getFullYear()}-${d.getMonth()}`
      if (!map.has(key)) map.set(key, d.toLocaleString('en-IN', { month: 'long', year: 'numeric' }))
    })
    return Array.from(map.entries())
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .map(([key, label]) => ({ key, label }))
  }, [payments])

  const filtered = useMemo(() => {
    return payments.filter(p => {
      if (typeFilter !== 'all' && p.type !== typeFilter) return false
      if (month !== 'all') {
        const d = new Date(p.payment_date)
        if (`${d.getFullYear()}-${d.getMonth()}` !== month) return false
      }
      return true
    }).sort((a, b) => (a.payment_date < b.payment_date ? 1 : -1))
  }, [payments, typeFilter, month])

  const totals = useMemo(() => {
    const byType: Record<PaymentType, number> = { rent: 0, deposit: 0, advance: 0 }
    let total = 0
    filtered.forEach(p => { byType[p.type] += p.amount_received; total += p.amount_received })
    return { byType, total, count: filtered.length }
  }, [filtered])

  async function exportExcel() {
    if (loading) { toast.error('Still loading data — try again in a moment'); return }
    if (filtered.length === 0) { toast.error('Nothing to export for this filter'); return }
    setExporting(true)
    try {
      const XLSX = await import('xlsx')
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
        filtered.map(p => ({
          Date: p.payment_date, Tenant: p.tenant?.name ?? '—', Room: p.tenant?.room?.room_number ?? '—',
          Type: TYPE_LABEL[p.type], Month: p.for_month ?? '—', Method: p.method ?? '—',
          Reference: p.reference_number ?? '—', 'Amount Received': p.amount_received,
        }))
      ), 'Income')
      const propLabel = activeId === 'all' ? 'All-Properties' : (active?.name ?? 'Property').replace(/\s+/g, '-')
      const monthLabel = month === 'all' ? 'All-Time' : (monthOptions.find(m => m.key === month)?.label ?? 'Filtered').replace(/\s+/g, '-')
      XLSX.writeFile(wb, `Income-Report-${propLabel}-${monthLabel}.xlsx`)
      toast.success('Income report downloaded!')
    } catch (e: any) {
      toast.error('Could not generate the export: ' + e.message)
    }
    setExporting(false)
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-gray-400">
      <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading income data…
    </div>
  )

  return (
    <div className="space-y-6">
      <Link href="/reports" className="inline-flex items-center gap-1 text-sm font-semibold text-gray-500 hover:text-gray-700 transition">
        <ChevronLeft className="w-4 h-4" /> Reports Dashboard
      </Link>

      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-extrabold text-gray-900">Income Report</h1>
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
          {(['all', 'rent', 'deposit', 'advance'] as const).map(t => (
            <button key={t} onClick={() => setTypeFilter(t)}
              className={`px-3 py-2 rounded-xl text-sm font-semibold transition ${
                typeFilter === t ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}>
              {t === 'all' ? 'All Types' : TYPE_LABEL[t]}
            </button>
          ))}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <div className="text-xs text-gray-500 font-semibold uppercase tracking-wide">Total Income</div>
          <div className="text-2xl font-extrabold mt-1 text-green-600">{formatINR(totals.total)}</div>
          <div className="text-xs text-gray-400 mt-0.5">{totals.count} transaction{totals.count === 1 ? '' : 's'}</div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <div className="text-xs text-gray-500 font-semibold uppercase tracking-wide">Rent</div>
          <div className="text-2xl font-extrabold mt-1 text-blue-600">{formatINR(totals.byType.rent)}</div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <div className="text-xs text-gray-500 font-semibold uppercase tracking-wide">Deposit</div>
          <div className="text-2xl font-extrabold mt-1 text-purple-600">{formatINR(totals.byType.deposit)}</div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <div className="text-xs text-gray-500 font-semibold uppercase tracking-wide">Advance</div>
          <div className="text-2xl font-extrabold mt-1 text-amber-600">{formatINR(totals.byType.advance)}</div>
        </div>
      </div>

      {/* Transactions table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 font-bold text-sm text-gray-900 border-b border-gray-100">Transactions</div>
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400 gap-2">
            <IndianRupee className="w-8 h-8" />
            <div className="text-sm">No income matches this filter</div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-400 uppercase tracking-wide border-b border-gray-100">
                  <th className="px-5 py-3 font-semibold">Date</th>
                  <th className="px-5 py-3 font-semibold">Tenant</th>
                  <th className="px-5 py-3 font-semibold">Room</th>
                  <th className="px-5 py-3 font-semibold">Type</th>
                  <th className="px-5 py-3 font-semibold">Method</th>
                  <th className="px-5 py-3 font-semibold text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => (
                  <tr key={p.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
                    <td className="px-5 py-3 text-gray-600 whitespace-nowrap">{formatDate(p.payment_date)}</td>
                    <td className="px-5 py-3 font-medium text-gray-800">{p.tenant?.name ?? '—'}</td>
                    <td className="px-5 py-3 text-gray-500">{p.tenant?.room?.room_number ?? '—'}</td>
                    <td className="px-5 py-3">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${TYPE_BADGE[p.type]}`}>{TYPE_LABEL[p.type]}</span>
                    </td>
                    <td className="px-5 py-3 text-gray-500 capitalize">{p.method?.replace('_', ' ') ?? '—'}</td>
                    <td className="px-5 py-3 text-right font-semibold text-gray-900">{formatINR(p.amount_received)}</td>
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
