'use client'

import { cn } from '@/lib/utils'

export interface BottomNavItem {
  key: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  badge?: number | boolean
}

export interface BottomNavProps {
  items: BottomNavItem[]
  activeKey: string
  onChange: (key: string) => void
  className?: string
}

/**
 * Fixed bottom tab bar, native-Android style: 4-5 items max, icon + label,
 * active item picked out with a tinted pill behind the icon plus a thin
 * top indicator bar (reads more "app", less "website tabs"). Matches
 * OwnerBottomNav's treatment exactly for cross-portal consistency.
 */
export function BottomNav({ items, activeKey, onChange, className }: BottomNavProps) {
  return (
    <nav
      className={cn(
        'tenant-safe-bottom fixed bottom-0 left-0 right-0 z-30 bg-tenant-surface-elevated/95 backdrop-blur-md border-t border-tenant-border',
        className
      )}
    >
      <div className="flex items-stretch justify-around px-1 sm:max-w-2xl sm:mx-auto">
        {items.map(({ key, label, icon: Icon, badge }) => {
          const active = key === activeKey
          return (
            <button
              key={key}
              onClick={() => onChange(key)}
              className="relative flex flex-col items-center justify-center gap-1 flex-1 min-h-[52px] py-2.5 min-w-0"
              aria-current={active ? 'page' : undefined}
            >
              <span
                className={cn(
                  'absolute top-0 left-1/2 -translate-x-1/2 h-[3px] rounded-full bg-tenant-primary transition-all duration-300 ease-out',
                  active ? 'w-6 opacity-100' : 'w-0 opacity-0'
                )}
                aria-hidden="true"
              />
              <span
                className={cn(
                  'relative flex items-center justify-center h-8 w-11 rounded-tenant-full transition-colors',
                  active && 'bg-tenant-primary/15'
                )}
              >
                <Icon className={cn('h-[19px] w-[19px] transition-colors', active ? 'text-tenant-primary' : 'text-tenant-muted')} />
                {badge ? (
                  <span
                    className={cn(
                      'absolute -top-0.5 right-1.5 flex items-center justify-center rounded-tenant-full bg-tenant-danger text-white font-bold ring-2 ring-tenant-surface-elevated',
                      typeof badge === 'number' && badge > 0 ? 'min-w-[15px] h-[15px] text-[9px] px-0.5' : 'h-2 w-2'
                    )}
                  >
                    {typeof badge === 'number' && badge > 0 ? (badge > 9 ? '9+' : badge) : null}
                  </span>
                ) : null}
              </span>
              <span className={cn('text-[10.5px] font-semibold truncate max-w-full', active ? 'text-tenant-primary' : 'text-tenant-muted')}>
                {label}
              </span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
