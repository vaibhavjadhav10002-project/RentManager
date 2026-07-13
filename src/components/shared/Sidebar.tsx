'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import {
  LayoutDashboard, BedDouble, Users, IndianRupee, ShieldCheck,
  MessageSquareWarning, TrendingDown, BarChart3, Settings, LogOut,
  Building2, X, MessageCircle
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useProperty } from './PropertyContext'
import { getUnreadMessageCountsForProperty } from '@/lib/supabase/queries'

const NAV = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/rooms', label: 'Rooms', icon: BedDouble },
  { href: '/tenants', label: 'Tenants', icon: Users },
  { href: '/payments', label: 'Payments', icon: IndianRupee },
  { href: '/approvals', label: 'Approvals', icon: ShieldCheck, badge: 'new' },
  { href: '/messages', label: 'Messages', icon: MessageCircle },
  { href: '/complaints', label: 'Complaints', icon: MessageSquareWarning },
  { href: '/expenses', label: 'Expenses', icon: TrendingDown },
  { href: '/reports', label: 'Reports', icon: BarChart3 },
  { href: '/settings', label: 'Settings', icon: Settings },
]

interface Props { open: boolean; onClose: () => void; userName: string }

export default function Sidebar({ open, onClose, userName }: Props) {
  const pathname = usePathname()
  const router = useRouter()
  const { activeId, properties } = useProperty()
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    const propIds = activeId === 'all' ? properties.map(p => p.id) : [activeId]
    if (propIds.length === 0 || propIds.some(id => !id)) return
    getUnreadMessageCountsForProperty(propIds).then(rows => {
      setUnreadCount(new Set(rows.map((r: any) => r.tenant_id)).size)
    }).catch(() => setUnreadCount(0))
  }, [activeId, properties])

  async function logout() {
    const sb = createClient()
    await sb.auth.signOut()
    toast.success('Logged out')
    router.push('/login')
  }

  return (
    <>
      {/* Overlay */}
      {open && (
        <div className="fixed inset-0 bg-black/30 z-40 lg:hidden" onClick={onClose} />
      )}

      <aside className={cn(
        'fixed top-0 left-0 bottom-0 w-56 bg-white border-r border-gray-100 z-50 flex flex-col transition-transform duration-200 shadow-sm',
        open ? 'translate-x-0' : '-translate-x-full',
        'lg:translate-x-0'
      )}>
        {/* Logo */}
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center">
              <Building2 className="w-4 h-4 text-white" />
            </div>
            <div>
              <div className="text-sm font-extrabold text-gray-900">PG Manager</div>
              <div className="text-[10px] text-gray-400">Pro Dashboard</div>
            </div>
          </div>
          <button onClick={onClose} className="lg:hidden text-gray-400 hover:text-gray-600">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {NAV.map(item => {
            const active = pathname === item.href || pathname.startsWith(item.href + '/')
            return (
              <Link key={item.href} href={item.href} onClick={onClose}
                className={cn(
                  'flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all group',
                  active
                    ? 'bg-blue-50 text-blue-600 border-l-4 border-blue-600 pl-2'
                    : 'text-gray-600 hover:bg-gray-50 border-l-4 border-transparent'
                )}>
                <item.icon className={cn('w-4 h-4', active ? 'text-blue-600' : 'text-gray-400 group-hover:text-gray-600')} />
                <span className="flex-1">{item.label}</span>
                {item.badge && (
                  <span className="text-[10px] bg-purple-100 text-purple-600 font-bold px-1.5 py-0.5 rounded-full">
                    {item.badge}
                  </span>
                )}
                {item.href === '/messages' && unreadCount > 0 && (
                  <span className="text-[10px] bg-red-500 text-white font-bold w-4 h-4 rounded-full flex items-center justify-center">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </Link>
            )
          })}
        </nav>

        {/* User + Logout */}
        <div className="p-3 border-t border-gray-100 flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
            {(userName || 'PG Owner').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold text-gray-900 truncate">{userName || 'PG Owner'}</div>
            <div className="text-[10px] text-gray-400">PG Owner</div>
          </div>
          <button onClick={logout} className="text-gray-400 hover:text-red-500 transition-colors p-1">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </aside>
    </>
  )
}
