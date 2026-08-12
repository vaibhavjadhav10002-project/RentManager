'use client'
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { formatINR } from '@/lib/utils'

// Same idea as DashboardCharts.tsx — keeps `recharts` out of each report
// page's main bundle by loading it as a separate async chunk via
// next/dynamic(..., { ssr: false }) at the call site.

export function ReportsOverviewChart({ chartData }: { chartData: { month: string; revenue: number; expenses: number; profit: number }[] }) {
  return (
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
  )
}

export function ExpensesByCategoryChart({ byCategory }: { byCategory: { cat: string; total: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={140}>
      <BarChart data={byCategory} layout="vertical" margin={{ left: 0 }}>
        <XAxis type="number" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={v => `₹${v / 1000}k`} />
        <YAxis type="category" dataKey="cat" width={80} tick={{ fontSize: 11, fill: '#475569' }} axisLine={false} tickLine={false} />
        <Tooltip formatter={(v: number) => formatINR(v)} />
        <Bar dataKey="total" fill="#EF4444" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

export function ProfitLossChart({ visible }: { visible: { month: string; income: number; expenses: number; profit: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={visible} barGap={2}>
        <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={v => `₹${v / 1000}k`} />
        <Tooltip formatter={(v: number) => formatINR(v)} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="income" fill="#10B981" radius={[4, 4, 0, 0]} name="Income" />
        <Bar dataKey="expenses" fill="#EF4444" radius={[4, 4, 0, 0]} name="Expenses" />
        <Bar dataKey="profit" fill="#2563EB" radius={[4, 4, 0, 0]} name="Net Profit" />
      </BarChart>
    </ResponsiveContainer>
  )
}
