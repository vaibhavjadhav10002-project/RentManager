'use client'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line,
} from 'recharts'
import { BedDouble } from 'lucide-react'
import { OwnerCard, OwnerChartTooltip, OwnerEmptyState } from '@/components/owner/ui'
import { formatINR, cn } from '@/lib/utils'

// Pulled out of dashboard/page.tsx and loaded via next/dynamic(..., { ssr: false })
// so `recharts` (~100kB) ships as its own async chunk instead of blocking the
// main Dashboard bundle — Dashboard is the first page every owner sees after
// login, so keeping its initial JS as small as possible matters most here.

export function RevenueChartCard({
  chartData, netProfit,
}: {
  chartData: { month: string; revenue: number; expenses: number; profit: number }[]
  netProfit: number
}) {
  return (
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
  )
}

export function OccupancyDonutCard({
  occupancyPct, occupiedBeds, totalBeds,
}: {
  occupancyPct: number
  occupiedBeds?: number
  totalBeds?: number
}) {
  return (
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
      <div className="text-xs text-owner-muted-subtle mt-1">{occupiedBeds}/{totalBeds} beds</div>
    </OwnerCard>
  )
}

export function OccupancyTrendCard({
  occupancyTrend,
}: {
  occupancyTrend: { month: string; occupancyPct: number }[]
}) {
  return (
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
  )
}
