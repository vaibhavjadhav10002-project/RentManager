'use client'

import { cn } from '@/lib/utils'

export interface TopAppBarProps {
  /** Left slot — usually a back/menu IconButton, or omitted on the home tab. */
  leading?: React.ReactNode
  title?: React.ReactNode
  subtitle?: React.ReactNode
  /** Right slot — usually 1-2 IconButtons (notifications, more). */
  actions?: React.ReactNode
  /** Large title mode (home dashboard "Hello, Rahul") vs a compact centered title (inner pages). */
  variant?: 'large' | 'compact'
  className?: string
}

export function TopAppBar({ leading, title, subtitle, actions, variant = 'compact', className }: TopAppBarProps) {
  return (
    <header
      className={cn(
        'tenant-safe-top sticky top-0 z-20 bg-tenant-bg/85 backdrop-blur-md border-b border-tenant-border',
        className
      )}
    >
      <div
        className={cn(
          'flex items-center gap-3 px-4 sm:max-w-2xl sm:mx-auto',
          variant === 'large' ? 'h-16' : 'h-14'
        )}
      >
        {leading}
        <div className="flex-1 min-w-0">
          {title && (
            <div
              className={cn(
                'truncate font-bold text-tenant-fg',
                variant === 'large' ? 'text-lg' : 'text-[15px] text-center'
              )}
            >
              {title}
            </div>
          )}
          {subtitle && <div className="text-xs text-tenant-muted truncate">{subtitle}</div>}
        </div>
        {actions && <div className="flex items-center gap-1.5">{actions}</div>}
      </div>
    </header>
  )
}
