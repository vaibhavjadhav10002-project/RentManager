'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Users, IndianRupee, ShieldCheck, MoreHorizontal } from 'lucide-react'
import { cn } from '@/lib/utils'
import { OWNER_BOTTOM_NAV_HREFS } from './ownerNav'

const ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/tenants', label: 'Tenants', icon: Users },
  { href: '/payments', label: 'Payments', icon: IndianRupee },
  { href: '/approvals', label: 'Approvals', icon: ShieldCheck },
]

const MORE_KEY = '__more'

/**
 * Floating premium bottom navigation (V1 milestone). Previously the app
 * had no persistent mobile nav at all — only a hamburger-triggered
 * Sidebar drawer. This adds a PhonePe/CRED-style floating rounded bar
 * with the 4 most-used destinations + a "More" entry that opens
 * OwnerMoreSheet, covering every other page via the shared
 * `ownerNav.ts` config. Pure navigation chrome — no new routes, no new
 * business logic, every destination already existed.
 *
 * Uses next/link (not router.push in an onClick) so Next.js prefetches
 * each destination's JS + RSC payload as soon as this bar is on screen —
 * this is what makes tapping a tab feel instant instead of visibly
 * loading, since the page is already fetched by the time you tap it.
 */
export function OwnerBottomNav({ onMoreClick }: { onMoreClick: () => void }) {
  const pathname = usePathname()

  const pinnedMatch = OWNER_BOTTOM_NAV_HREFS.find(href => pathname?.startsWith(href))
  const activeKey = pinnedMatch ?? MORE_KEY

  return (
    <nav
      className="lg:hidden fixed inset-x-3 z-30 bg-owner-surface-elevated/95 backdrop-blur-md rounded-full shadow-owner-lg border border-owner-border flex items-stretch justify-around px-1.5 py-1.5"
      style={{ bottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
    >
      {ITEMS.map(({ href, label, icon: Icon }) => {
        const active = href === activeKey
        return (
          <Link
            key={href}
            href={href}
            prefetch
            aria-current={active ? 'page' : undefined}
            className="relative flex-1 flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-full min-w-0 overflow-hidden before:absolute before:inset-0 before:rounded-full before:bg-owner-fg/5 before:scale-0 before:opacity-0 active:before:scale-100 active:before:opacity-100 before:transition before:duration-300"
          >
            <span
              className={cn(
                'flex items-center justify-center h-8 w-8 rounded-full transition-all duration-300 ease-out',
                active ? 'bg-owner-primary scale-100' : 'scale-90'
              )}
            >
              <Icon className={cn('transition-all duration-300', active ? 'h-4 w-4 text-white' : 'h-[18px] w-[18px] text-owner-muted')} />
            </span>
            <span className={cn('text-[10px] font-semibold truncate max-w-full transition-colors', active ? 'text-owner-primary' : 'text-owner-muted')}>
              {label}
            </span>
          </Link>
        )
      })}
      <button
        onClick={onMoreClick}
        aria-current={activeKey === MORE_KEY ? 'page' : undefined}
        className="relative flex-1 flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-full min-w-0 overflow-hidden before:absolute before:inset-0 before:rounded-full before:bg-owner-fg/5 before:scale-0 before:opacity-0 active:before:scale-100 active:before:opacity-100 before:transition before:duration-300"
      >
        <span
          className={cn(
            'flex items-center justify-center h-8 w-8 rounded-full transition-all duration-300 ease-out',
            activeKey === MORE_KEY ? 'bg-owner-primary scale-100' : 'scale-90'
          )}
        >
          <MoreHorizontal className={cn('transition-all duration-300', activeKey === MORE_KEY ? 'h-4 w-4 text-white' : 'h-[18px] w-[18px] text-owner-muted')} />
        </span>
        <span className={cn('text-[10px] font-semibold truncate max-w-full transition-colors', activeKey === MORE_KEY ? 'text-owner-primary' : 'text-owner-muted')}>
          More
        </span>
      </button>
    </nav>
  )
}
