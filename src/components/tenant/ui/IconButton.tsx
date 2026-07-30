'use client'

import { forwardRef } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const iconButtonStyles = cva(
  'inline-flex items-center justify-center rounded-tenant-full transition-all active:scale-90 disabled:opacity-40 disabled:pointer-events-none relative shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tenant-primary/40 focus-visible:ring-offset-2',
  {
    variants: {
      variant: {
        ghost: 'text-tenant-fg hover:bg-tenant-surface-hover',
        surface: 'bg-tenant-surface-elevated text-tenant-fg border border-tenant-border hover:bg-tenant-surface-hover',
        primary: 'bg-tenant-primary text-tenant-primary-fg shadow-tenant-glow hover:bg-tenant-primary-hover',
      },
      size: {
        sm: 'h-8 w-8 [&_svg]:h-4 [&_svg]:w-4',
        md: 'h-10 w-10 [&_svg]:h-[18px] [&_svg]:w-[18px]',
        lg: 'h-12 w-12 [&_svg]:h-5 [&_svg]:w-5',
      },
    },
    defaultVariants: { variant: 'ghost', size: 'md' },
  }
)

export interface IconButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof iconButtonStyles> {
  /** Shows a small dot/count badge in the top-right corner (e.g. unread count). */
  badge?: number | boolean
  'aria-label': string
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ className, variant, size, badge, children, ...props }, ref) => (
    <button ref={ref} className={cn(iconButtonStyles({ variant, size }), className)} {...props}>
      {children}
      {badge ? (
        <span
          className={cn(
            'absolute -top-0.5 -right-0.5 flex items-center justify-center rounded-tenant-full bg-tenant-danger text-white font-bold ring-2 ring-tenant-bg',
            typeof badge === 'number' && badge > 0 ? 'min-w-[16px] h-4 text-[9px] px-1' : 'h-2.5 w-2.5'
          )}
        >
          {typeof badge === 'number' && badge > 0 ? (badge > 9 ? '9+' : badge) : null}
        </span>
      ) : null}
    </button>
  )
)
IconButton.displayName = 'IconButton'
