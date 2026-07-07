'use client'
import { useState, useEffect } from 'react'
import { Menu, Bell, HelpCircle, Sun, Moon } from 'lucide-react'
import { useProperty } from './PropertyContext'
import PropertySwitcherCard from './PropertySwitcherCard'
import { getPendingApprovals, getRooms, getTenants } from '@/lib/supabase/queries'
import { createClient } from '@/lib/supabase/client'
import { useRouter, usePathname } from 'next/navigation'

interface Props {
  onMenuClick: () => void
  darkMode: boolean
  onToggleDark: () => void
  userName: string
}

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard', '/rooms': 'Rooms & Beds', '/tenants': 'Tenants',
  '/payments': 'Rent Collection', '/approvals': 'Approvals', '/complaints': 'Complaints',
  '/expenses': 'Expenses', '/reports': 'Reports & Analytics', '/settings': 'Settings',
}

export default function Topbar({ onMenuClick, darkMode, onToggleDark, userName }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const { properties } = useProperty()
  const [notifOpen, setNotifOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [notifItems, setNotifItems] = useState<{ label: string; sub: string }[]>([])
  const [occupancy, setOccupancy] = useState<Record<string, number>>({})

  const pageTitle = PAGE_TITLES[pathname] ?? 'Dashboard'

  useEffect(() => {
    async function loadTopbarData() {
      if (properties.length === 0) return
      try {
        const sb = createClient()
        const ids = properties.map(p => p.id)
        const [payments, pendingTenants] = await Promise.all([
          Promise.all(ids.map(id => getPendingApprovals(id))).then(r => r.flat()),
          Promise.all(ids.map(id =>
            sb.from('tenants').select('name, property:properties(name)').eq('property_id', id).eq('status', 'pending_approval').then(r => r.data ?? [])
          )).then(r => r.flat()),
        ])
        setNotifItems([
          ...payments.map((p: any) => ({ label: (p.tenant?.name ?? 'A tenant') + ' marked rent as paid', sub: 'Needs your approval' })),
          ...pendingTenants.map((t: any) => ({ label: t.name + ' wants to join ' + (t.property?.name ?? 'your PG'), sub: 'New tenant request' })),
        ])

        // Occupancy % per property, shown inside the Select Property dropdown
        const occ: Record<string, number> = {}
        for (const p of properties) {
          const [rooms, tenants] = await Promise.all([getRooms(p.id), getTenants(p.id)])
          const totalBeds = rooms.reduce((s, r) => s + r.total_beds, 0)
          const occupiedCount = tenants.filter(t => t.status === 'active').length
          occ[p.id] = totalBeds > 0 ? Math.round((occupiedCount / totalBeds) * 100) : 0
        }
        setOccupancy(occ)
      } catch { /* ignore */ }
    }
    loadTopbarData()
  }, [properties])

  return (
    <header className="h-16 bg-white dark:bg-slate-900 border-b border-gray-100 dark:border-slate-800 flex items-center px-4 lg:px-6 gap-3 sticky top-0 z-30 transition-colors">
      {/* Hamburger (mobile) */}
      <button onClick={onMenuClick} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-500 dark:text-slate-400 lg:hidden">
        <Menu className="w-5 h-5" />
      </button>

      <h1 className="text-lg font-bold text-gray-900 dark:text-white hidden sm:block">{pageTitle}</h1>

      <div className="ml-auto flex items-center gap-3">
        {/* Select Property card */}
        <PropertySwitcherCard occupancy={occupancy} darkMode={darkMode} />

        {/* Dark mode toggle */}
        <button onClick={onToggleDark} title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
          className="p-2.5 rounded-full hover:bg-gray-100 dark:hover:bg-slate-800 transition text-gray-500 dark:text-slate-400">
          {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </button>

        {/* Notifications */}
        <div className="relative">
          <button onClick={() => setNotifOpen(o => !o)}
            className="relative p-2.5 rounded-full hover:bg-gray-100 dark:hover:bg-slate-800 transition text-gray-500 dark:text-slate-400">
            <Bell className="w-5 h-5" />
            {notifItems.length > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white dark:border-slate-900">
                {notifItems.length}
              </span>
            )}
          </button>
          {notifOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setNotifOpen(false)} />
              <div className="absolute top-full right-0 mt-2 w-72 bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-gray-100 dark:border-slate-700 z-50 overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100 dark:border-slate-700 font-bold text-sm text-gray-900 dark:text-white">Notifications</div>
                {notifItems.length === 0 ? (
                  <div className="px-4 py-6 text-center text-xs text-gray-400 dark:text-slate-500">You're all caught up 🎉</div>
                ) : (
                  <div className="max-h-72 overflow-y-auto">
                    {notifItems.map((n, i) => (
                      <button key={i} onClick={() => { setNotifOpen(false); router.push('/approvals') }}
                        className="w-full text-left px-4 py-3 border-b border-gray-50 dark:border-slate-700/50 last:border-0 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition">
                        <div className="text-xs font-semibold text-gray-800 dark:text-slate-200">{n.label}</div>
                        <div className="text-[11px] text-gray-400 dark:text-slate-500 mt-0.5">{n.sub}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Help */}
        <button onClick={() => setHelpOpen(true)} className="p-2.5 rounded-full hover:bg-gray-100 dark:hover:bg-slate-800 transition text-gray-500 dark:text-slate-400 hidden sm:block">
          <HelpCircle className="w-5 h-5" />
        </button>

        {/* User */}
        <div className="flex items-center gap-2.5 pl-3 border-l border-gray-100 dark:border-slate-800">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
            {userName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
          </div>
          <div className="hidden sm:block">
            <div className="text-sm font-bold text-gray-900 dark:text-white leading-tight">{userName}</div>
            <div className="text-[11px] text-gray-400 dark:text-slate-500">Owner</div>
          </div>
        </div>
      </div>

      {/* Help modal */}
      {helpOpen && (
        <div className="fixed inset-0 bg-black/40 z-[100] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-sm shadow-2xl">
            <div className="px-6 py-4 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between">
              <h2 className="text-base font-bold text-gray-900 dark:text-white">Need Help?</h2>
              <button onClick={() => setHelpOpen(false)} className="text-gray-400 dark:text-slate-500 text-xl font-bold">×</button>
            </div>
            <div className="p-6 space-y-3 text-sm text-gray-600 dark:text-slate-300">
              <p>Quick pointers while you're getting set up:</p>
              <ul className="list-disc pl-5 space-y-1.5">
                <li>Add a property first (top-left switcher → "Add Property") before adding rooms or tenants.</li>
                <li>Add your UPI ID in <span className="font-semibold text-gray-800 dark:text-slate-100">Settings</span> so tenants can scan-to-pay.</li>
                <li>Share the QR/join link from <span className="font-semibold text-gray-800 dark:text-slate-100">Approvals</span> so tenants can request to join themselves.</li>
                <li>Every payment claim a tenant submits needs your approval in <span className="font-semibold text-gray-800 dark:text-slate-100">Approvals</span> before it counts as collected.</li>
              </ul>
              <p className="text-xs text-gray-400 dark:text-slate-500 pt-2 border-t border-gray-100 dark:border-slate-700">For anything else, check the README that came with this project.</p>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 dark:border-slate-700">
              <button onClick={() => setHelpOpen(false)} className="w-full py-2.5 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 text-gray-700 dark:text-slate-200 rounded-xl text-sm font-semibold transition">Got it</button>
            </div>
          </div>
        </div>
      )}
    </header>
  )
}
