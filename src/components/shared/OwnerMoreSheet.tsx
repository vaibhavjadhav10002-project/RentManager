'use client'
import { useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { LogOut } from 'lucide-react'
import { cn } from '@/lib/utils'
import { OwnerAvatar, OwnerBadge } from '@/components/owner/ui'
import { OWNER_MORE_NAV } from './ownerNav'

interface Props {
  open: boolean
  onClose: () => void
  userName: string
}

/**
 * Mobile-only "More" destination for the Owner bottom nav (Phase 2, Premium
 * UI Upgrade). Not a new page/route — a native-style bottom sheet that
 * lists every owner destination NOT already pinned to the bottom nav
 * (Dashboard/Payments/Tenants/Approvals), reusing the exact same
 * `OWNER_MORE_NAV` config the desktop Sidebar renders, and the same
 * `Link` navigation + logout logic Sidebar already used. No duplicate
 * pages, no new routes, no business logic — purely a mobile-friendly
 * surface for links that already exist.
 */
export default function OwnerMoreSheet({ open, onClose, userName }: Props) {
  const pathname = usePathname()
  const router = useRouter()

  // Lock background scroll while the sheet is open — standard native
  // bottom-sheet behavior.
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [open])

  async function logout() {
    const sb = createClient()
    await sb.auth.signOut()
    toast.success('Logged out')
    router.push('/login')
  }

  return (
    <>
      {/* Backdrop — fades in/out with the sheet */}
      <div
        aria-hidden={!open}
        onClick={onClose}
        className={cn(
          'fixed inset-0 z-40 bg-black/40 transition-opacity duration-300 lg:hidden',
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        )}
      />

      {/* Sheet — slides up from below the bottom nav, native Android feel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="More"
        className={cn(
          'fixed inset-x-0 bottom-0 z-50 lg:hidden',
          'bg-owner-surface rounded-t-owner-2xl shadow-owner-lg',
          'max-h-[80vh] flex flex-col',
          'transition-transform duration-300 ease-out',
          open ? 'translate-y-0' : 'translate-y-full'
        )}
      >
        {/* Grab handle */}
        <div className="flex justify-center pt-2.5 pb-1 shrink-0">
          <div className="h-1 w-9 rounded-owner-full bg-owner-border-strong" />
        </div>

        <div className="px-4 pb-1.5 pt-1 shrink-0">
          <h2 className="text-sm font-extrabold text-owner-fg">More</h2>
        </div>

        <div className="flex-1 overflow-y-auto px-3 pb-1">
          <div className="grid grid-cols-4 gap-y-4 py-2">
            {OWNER_MORE_NAV.map(item => {
              const active = pathname === item.href || pathname.startsWith(item.href + '/')
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onClose}
                  className="flex flex-col items-center gap-1.5 px-1 py-1 rounded-owner-lg active:bg-owner-surface-hover transition-colors"
                >
                  <span
                    className={cn(
                      'relative flex items-center justify-center h-11 w-11 rounded-owner-xl transition-colors',
                      active ? 'bg-owner-primary/15' : 'bg-owner-bg-subtle'
                    )}
                  >
                    <item.icon className={cn('h-5 w-5', active ? 'text-owner-primary' : 'text-owner-muted')} />
                    {item.badge && (
                      <span className="absolute -top-1 -right-1">
                        <OwnerBadge tone="purple" size="sm">{item.badge}</OwnerBadge>
                      </span>
                    )}
                  </span>
                  <span className={cn('text-[10.5px] font-semibold text-center leading-tight', active ? 'text-owner-primary' : 'text-owner-muted')}>
                    {item.label}
                  </span>
                </Link>
              )
            })}
          </div>
        </div>

        {/* User + Logout footer */}
        <div className="native-safe-bottom border-t border-owner-border shrink-0">
          <div className="flex items-center gap-2.5 px-4 py-3">
            <OwnerAvatar name={userName || 'PG Owner'} size="sm" />
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-owner-fg truncate">{userName || 'PG Owner'}</div>
              <div className="text-[10px] text-owner-muted-subtle">PG Owner</div>
            </div>
            <button
              onClick={logout}
              aria-label="Log out"
              className="flex items-center gap-1.5 px-3 py-2 rounded-owner-lg text-owner-danger text-xs font-semibold active:bg-owner-danger-subtle transition-colors"
            >
              <LogOut className="w-4 h-4" /> Logout
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
