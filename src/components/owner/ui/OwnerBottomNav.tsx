'use client'

import { cn } from '@/lib/utils'

export interface OwnerBottomNavItem {
  key: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  badge?: number | boolean
}

export interface OwnerBottomNavProps {
  items: OwnerBottomNavItem[]
  activeKey: string
  onChange: (key: string) => void
  className?: string
}

/**
 * Owner-side equivalent of tenant/ui/BottomNav.tsx — same structure and
 * behavior, re-themed to owner-* tokens (safe here since
 * (owner)/layout.tsx already loads owner-theme.css for every owner
 * route, unlike the Tenant Portal page — see MOBILE_UX_AUDIT_REPORT.md).
 *
 * Fixed bottom tab bar, native-Android style:
 * - Active tab gets an animated tinted pill (scales in, not just fades)
 *   plus its icon "pops" slightly larger — a cheap but effective way to
 *   fake spring-like motion with pure CSS transitions, no animation
 *   library needed.
 * - Tap gets a CSS-only ripple (a `before:` pseudo-element that expands
 *   and fades on `:active`) — a reasonable approximation of Material
 *   ripple without adding a JS dependency to track tap coordinates.
 * - Elevation via a soft upward shadow (a bottom bar's shadow should
 *   read as "in front of" the content above it), plus the existing
 *   hairline border for definition on very bright/white content.
 */
export function OwnerBottomNav({ items, activeKey, onChange, className }: OwnerBottomNavProps) {
  return (
    <nav
      className={cn(
        'native-safe-bottom fixed bottom-0 left-0 right-0 z-30 bg-owner-surface/95 backdrop-blur-md border-t border-owner-border shadow-[0_-8px_24px_-8px_rgba(0,0,0,0.12)] lg:hidden',
        className
      )}
    >
      <div className="flex items-stretch justify-around px-1">
        {items.map(({ key, label, icon: Icon, badge }) => {
          const active = key === activeKey
          return (
            <button
              key={key}
              onClick={() => onChange(key)}
              className={cn(
                'relative flex flex-col items-center justify-center gap-1 flex-1 py-2.5 min-w-0 overflow-hidden',
                'before:absolute before:inset-0 before:rounded-owner-lg before:bg-owner-fg/5 before:scale-0 before:opacity-0',
                'active:before:scale-100 active:before:opacity-100 before:transition before:duration-300'
              )}
              aria-current={active ? 'page' : undefined}
            >
              <span
                className={cn(
                  'relative flex items-center justify-center h-8 w-11 rounded-owner-full transition-all duration-300 ease-out',
                  active ? 'bg-owner-primary/15 scale-100' : 'scale-90'
                )}
              >
                <Icon
                  className={cn(
                    'transition-all duration-300 ease-out',
                    active ? 'h-5 w-5 text-owner-primary' : 'h-[19px] w-[19px] text-owner-muted'
                  )}
                />
                {badge ? (
                  <span
                    className={cn(
                      'absolute -top-0.5 right-1.5 flex items-center justify-center rounded-owner-full bg-red-500 text-white font-bold ring-2 ring-owner-surface',
                      typeof badge === 'number' && badge > 0 ? 'min-w-[15px] h-[15px] text-[9px] px-0.5' : 'h-2 w-2'
                    )}
                  >
                    {typeof badge === 'number' && badge > 0 ? (badge > 9 ? '9+' : badge) : null}
                  </span>
                ) : null}
              </span>
              <span
                className={cn(
                  'text-[10.5px] font-semibold truncate max-w-full transition-colors duration-300',
                  active ? 'text-owner-primary' : 'text-owner-muted'
                )}
              >
                {label}
              </span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
