'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Users, Building2, Wallet, LayoutGrid } from 'lucide-react'
import { cn } from '@/lib/utils'

const ITEMS = [
  { key: 'home', href: '/dashboard', label: 'Home', icon: Home, match: ['/dashboard'] },
  { key: 'tenants', href: '/tenants', label: 'Tenants', icon: Users, match: ['/tenants'] },
  { key: 'properties', href: '/properties', label: 'Properties', icon: Building2, match: ['/properties'] },
  { key: 'finances', href: '/payments', label: 'Finances', icon: Wallet, match: ['/payments', '/expenses', '/approvals'] },
  { key: 'more', href: '/more', label: 'More', icon: LayoutGrid, match: ['/more'] },
]

/**
 * Flat 5-tab bottom bar (Home · Tenants · Properties · Finances · More).
 * "More" now opens the /more "All features" page; every other destination
 * (Rooms, Approvals, Reports, …) lives there. `onMoreClick` is kept in the
 * signature so OwnerShell's props don't change, but is no longer needed.
 */
export function OwnerBottomNav({ onMoreClick: _unused }: { onMoreClick?: () => void }) {
  const pathname = usePathname() ?? ''
  const pinned = ITEMS.find(i => i.match.some(m => pathname === m || pathname.startsWith(m + '/')))
  const activeKey = pinned?.key ?? 'more'

  return (
    <nav
      className="lg:hidden fixed inset-x-0 bottom-0 z-30 border-t border-owner-border bg-owner-surface/95 backdrop-blur-md"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex items-stretch justify-around px-2 pt-2 pb-2">
        {ITEMS.map(({ key, href, label, icon: Icon }) => {
          const active = key === activeKey
          return (
            <Link key={key} href={href} prefetch aria-current={active ? 'page' : undefined}
              className="flex min-w-0 flex-1 flex-col items-center gap-1 py-1 active:opacity-70">
              <Icon className={cn('h-6 w-6', active ? 'text-owner-primary' : 'text-owner-muted')} strokeWidth={active ? 2.2 : 1.8} />
              <span className={cn('truncate text-xs', active ? 'font-bold text-owner-primary' : 'font-medium text-owner-muted')}>{label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
