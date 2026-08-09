'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Building2, X, LogOut } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useProperty } from './PropertyContext'
import { getUnreadMessageCountsForProperty } from '@/lib/supabase/queries'
import { OwnerAvatar, OwnerIconButton, OwnerBadge } from '@/components/owner/ui'
import { OWNER_NAV as NAV } from './ownerNav'

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
      {open && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={onClose} />
      )}

      <aside className={cn(
        'fixed top-0 left-0 bottom-0 w-56 bg-owner-surface border-r border-owner-border z-50 flex flex-col transition-transform duration-200',
        open ? 'translate-x-0' : '-translate-x-full',
        'lg:translate-x-0'
      )}>
        {/* Logo */}
        <div className="h-14 px-4 border-b border-owner-border flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-owner-lg bg-owner-primary flex items-center justify-center shrink-0 shadow-owner-glow">
              <Building2 className="w-4 h-4 text-white" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-extrabold text-owner-fg truncate">Rentivo</div>
              <div className="text-[10px] text-owner-muted-subtle">Pro Dashboard</div>
            </div>
          </div>
          <OwnerIconButton aria-label="Close menu" variant="ghost" size="sm" onClick={onClose} className="lg:hidden">
            <X />
          </OwnerIconButton>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-2.5 space-y-0.5 overflow-y-auto">
          {NAV.map(item => {
            const active = pathname === item.href || pathname.startsWith(item.href + '/')
            return (
              <Link key={item.href} href={item.href} onClick={onClose}
                className={cn(
                  'flex items-center gap-2.5 px-3 py-2.5 rounded-owner-lg text-sm font-medium transition-colors group relative',
                  active
                    ? 'bg-owner-primary/12 text-owner-primary'
                    : 'text-owner-muted hover:bg-owner-surface-hover hover:text-owner-fg'
                )}>
                {active && <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-full bg-owner-primary" />}
                <item.icon className={cn('w-4 h-4 shrink-0', active ? 'text-owner-primary' : 'text-owner-muted-subtle group-hover:text-owner-muted')} />
                <span className="flex-1 truncate">{item.label}</span>
                {item.badge && (
                  <OwnerBadge tone="purple" size="sm">{item.badge}</OwnerBadge>
                )}
                {item.href === '/messages' && unreadCount > 0 && (
                  <OwnerBadge tone="solid-danger" size="sm" className="px-1.5 py-0 min-w-[18px] h-[18px] justify-center">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </OwnerBadge>
                )}
              </Link>
            )
          })}
        </nav>

        {/* User + Logout */}
        <div className="p-2.5 pb-safe border-t border-owner-border flex items-center gap-2.5 shrink-0">
          <OwnerAvatar name={userName || 'PG Owner'} size="sm" />
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold text-owner-fg truncate">{userName || 'PG Owner'}</div>
            <div className="text-[10px] text-owner-muted-subtle">PG Owner</div>
          </div>
          <OwnerIconButton aria-label="Log out" variant="ghost" size="sm" onClick={logout} className="hover:text-owner-danger">
            <LogOut />
          </OwnerIconButton>
        </div>
      </aside>
    </>
  )
}
