'use client'
import { useProperty } from '@/components/shared/PropertyContext'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { Download } from 'lucide-react'
import { formatINR } from '@/lib/utils'
import { toast } from 'sonner'

const MONTHLY = [
  { month: 'Jan', revenue: 52000, expenses: 28000, profit: 24000 },
  { month: 'Feb', revenue: 58000, expenses: 29500, profit: 28500 },
  { month: 'Mar', revenue: 61000, expenses: 31000, profit: 30000 },
  { month: 'Apr', revenue: 59000, expenses: 30000, profit: 29000 },
  { month: 'May', revenue: 63000, expenses: 32000, profit: 31000 },
  { month: 'Jun', revenue: 65000, expenses: 28700, profit: 36300 },
]

export default function ReportsPage() {
  const { active, activeId, properties } = useProperty()

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-extrabold text-gray-900">Reports</h1>
          <p className="text-sm text-gray-500">{activeId === 'all' ? 'All properties' : active?.name}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => toast.success('PDF downloading…')} className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-semibold transition">
            <Download className="w-4 h-4" /> PDF
          </button>
          <button onClick={() => toast.success('Excel downloading…')} className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-semibold transition">
            <Download className="w-4 h-4" /> Excel
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {[
          { label: 'Monthly Revenue', value: formatINR(65000), trend: '+12%', color: 'text-green-600' },
          { label: 'Occupancy Rate', value: '83%', trend: '+8%', color: 'text-blue-600' },
          { label: 'Total Expenses', value: formatINR(28700), trend: '+3%', color: 'text-red-600' },
          { label: 'Net Profit', value: formatINR(36300), trend: '+18%', color: 'text-purple-600' },
          { label: 'Pending Rent', value: formatINR(19500), trend: '-5%', color: 'text-yellow-600' },
          { label: 'Active Tenants', value: '6', trend: '0%', color: 'text-gray-700' },
        ].map(r => (
          <div key={r.label} className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm hover:shadow-md transition-shadow">
            <div className="text-xs text-gray-500 font-semibold uppercase tracking-wide">{r.label}</div>
            <div className={`text-2xl font-extrabold mt-1 ${r.color}`}>{r.value}</div>
            <div className={`text-xs font-bold mt-1 ${r.trend.startsWith('+') ? 'text-green-500' : r.trend === '0%' ? 'text-gray-400' : 'text-red-500'}`}>{r.trend} vs last month</div>
          </div>
        ))}
      </div>

      {/* Chart */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
        <div className="font-bold text-sm text-gray-900 mb-1">Revenue, Expenses & Profit — 6 Months</div>
        <div className="text-xs text-gray-400 mb-4">Jan – Jun 2024</div>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={MONTHLY} barGap={2}>
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={v => `₹${v / 1000}k`} />
            <Tooltip formatter={(v: number) => formatINR(v)} />
            <Bar dataKey="revenue" fill="#2563EB" radius={[4, 4, 0, 0]} name="Revenue" />
            <Bar dataKey="expenses" fill="#EF444466" radius={[4, 4, 0, 0]} name="Expenses" />
            <Bar dataKey="profit" fill="#10B981" radius={[4, 4, 0, 0]} name="Profit" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Report download tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {['Monthly Revenue Report', 'Occupancy Report', 'Pending Rent Report', 'Expense Report', 'Profit & Loss', 'Tenant Summary'].map(r => (
          <button key={r} onClick={() => toast.success(`${r} downloading…`)} className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center justify-between shadow-sm hover:shadow-md transition text-left">
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
