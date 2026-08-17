'use client'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useProperty } from '@/components/shared/PropertyContext'
import { getPayments } from '@/lib/supabase/queries'
import { formatINR, formatDate } from '@/lib/utils'
import { ChevronLeft, Download, Loader2, IndianRupee } from 'lucide-react'
import { toast } from 'sonner'
import type { Payment, PaymentType } from '@/types'
import { SkeletonList, SkeletonCardGrid } from '@/components/shared/Skeleton'

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
    let lateFees = 0
    filtered.forEach(p => { byType[p.type] += p.amount_received; total += p.amount_received; lateFees += p.late_fee_amount || 0 })
    // "Rent" here means actual rent collected, with the late-fee portion
    // (if any was folded into the same payment) broken out separately —
    // late fees shouldn't inflate the rent-revenue figure.
    return { byType, total, count: filtered.length, lateFees, rentExclLateFee: byType.rent - lateFees }
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
          'Late Fee Included': p.late_fee_amount || 0,
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
    <div className="space-y-4"><SkeletonCardGrid count={4} /><SkeletonList rows={4} /></div>
  )

  return (
    <div className="space-y-6">
      <Link href="/reports" className="inline-flex items-center gap-1 text-sm font-semibold text-owner-muted hover:text-owner-fg transition">
        <ChevronLeft className="w-4 h-4" /> Reports Dashboard
      </Link>

      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-extrabold text-owner-fg">Income Report</h1>
          <p className="text-sm text-owner-muted">{activeId === 'all' ? 'All properties' : active?.name}</p>
        </div>
        <button onClick={exportExcel} disabled={exporting} className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-owner-lg text-sm font-semibold transition disabled:opacity-50">
          {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} Excel
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <select value={month} onChange={e => setMonth(e.target.value)}
          className="px-3 py-2 border border-owner-border rounded-owner-lg text-sm bg-owner-surface focus:outline-none focus:border-owner-primary">
          <option value="all">All Time</option>
          {monthOptions.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
        </select>
        <div className="flex gap-1.5 flex-wrap">
          {(['all', 'rent', 'deposit', 'advance'] as const).map(t => (
            <button key={t} onClick={() => setTypeFilter(t)}
              className={`px-3 py-1.5 rounded-owner-full text-xs font-semibold transition active:scale-[0.97] ${
                typeFilter === t ? 'bg-owner-primary text-owner-primary-fg' : 'bg-owner-surface-hover text-owner-muted hover:text-owner-fg'
              }`}>
              {t === 'all' ? 'All Types' : TYPE_LABEL[t]}
            </button>
          ))}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-owner-surface rounded-owner-xl border border-owner-border p-5 shadow-owner-xs">
          <div className="text-xs text-owner-muted font-semibold uppercase tracking-wide">Total Income</div>
          <div className="text-2xl font-extrabold mt-1 text-green-600">{formatINR(totals.total)}</div>
          <div className="text-xs text-owner-muted-subtle mt-0.5">{totals.count} transaction{totals.count === 1 ? '' : 's'}</div>
        </div>
        <div className="bg-owner-surface rounded-owner-xl border border-owner-border p-5 shadow-owner-xs">
          <div className="text-xs text-owner-muted font-semibold uppercase tracking-wide">Rent</div>
          <div className="text-2xl font-extrabold mt-1 text-blue-600">{formatINR(totals.rentExclLateFee)}</div>
          {totals.lateFees > 0 && <div className="text-xs text-owner-muted-subtle mt-0.5">+ {formatINR(totals.lateFees)} late fees</div>}
        </div>
        <div className="bg-owner-surface rounded-owner-xl border border-owner-border p-5 shadow-owner-xs">
          <div className="text-xs text-owner-muted font-semibold uppercase tracking-wide">Deposit</div>
          <div className="text-2xl font-extrabold mt-1 text-purple-600">{formatINR(totals.byType.deposit)}</div>
        </div>
        <div className="bg-owner-surface rounded-owner-xl border border-owner-border p-5 shadow-owner-xs">
          <div className="text-xs text-owner-muted font-semibold uppercase tracking-wide">Advance</div>
          <div className="text-2xl font-extrabold mt-1 text-amber-600">{formatINR(totals.byType.advance)}</div>
        </div>
      </div>

      {/* Transactions table */}
      <div className="bg-owner-surface rounded-owner-xl border border-owner-border shadow-owner-xs overflow-hidden">
        <div className="px-5 py-4 font-bold text-sm text-owner-fg border-b border-owner-border">Transactions</div>
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-owner-muted-subtle gap-2">
            <IndianRupee className="w-8 h-8" />
            <div className="text-sm">No income matches this filter</div>
          </div>
        ) : (
          <>
            {/* Mobile: stacked card list, no horizontal scroll */}
            <div className="sm:hidden divide-y divide-owner-border">
              {filtered.map(p => (
                <div key={p.id} className="px-5 py-3 flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-owner-fg truncate">{p.tenant?.name ?? '—'}</div>
                    <div className="text-xs text-owner-muted-subtle mt-0.5">{formatDate(p.payment_date)} · Room {p.tenant?.room?.room_number ?? '—'}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${TYPE_BADGE[p.type]}`}>{TYPE_LABEL[p.type]}</span>
                      <span className="text-xs text-owner-muted capitalize">{p.method?.replace('_', ' ') ?? '—'}</span>
                    </div>
                  </div>
                  <div className="text-sm font-semibold text-owner-fg shrink-0">{formatINR(p.amount_received)}</div>
                </div>
              ))}
            </div>
            {/* Desktop/tablet: full table */}
            <table className="w-full text-sm hidden sm:table">
              <thead>
                <tr className="text-left text-xs text-owner-muted-subtle uppercase tracking-wide border-b border-owner-border">
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
                  <tr key={p.id} className="border-b border-owner-border last:border-0 hover:bg-owner-surface-hover/50">
                    <td className="px-5 py-3 text-owner-muted whitespace-nowrap">{formatDate(p.payment_date)}</td>
                    <td className="px-5 py-3 font-medium text-owner-fg">{p.tenant?.name ?? '—'}</td>
                    <td className="px-5 py-3 text-owner-muted">{p.tenant?.room?.room_number ?? '—'}</td>
                    <td className="px-5 py-3">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${TYPE_BADGE[p.type]}`}>{TYPE_LABEL[p.type]}</span>
                    </td>
                    <td className="px-5 py-3 text-owner-muted capitalize">{p.method?.replace('_', ' ') ?? '—'}</td>
                    <td className="px-5 py-3 text-right font-semibold text-owner-fg">{formatINR(p.amount_received)}</td>
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
