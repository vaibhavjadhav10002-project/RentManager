'use client'

import { forwardRef } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const iconButtonStyles = cva(
  'inline-flex items-center justify-center rounded-owner-lg transition-colors active:scale-95 disabled:opacity-40 disabled:pointer-events-none relative shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-owner-primary/40 focus-visible:ring-offset-2',
  {
    variants: {
      variant: {
        ghost: 'text-owner-muted hover:bg-owner-surface-hover hover:text-owner-fg',
        surface: 'bg-owner-surface-hover text-owner-muted border border-owner-border hover:text-owner-fg',
        primary: 'bg-owner-primary text-owner-primary-fg hover:bg-owner-primary-hover',
      },
      size: {
        sm: 'h-7 w-7 [&_svg]:h-3.5 [&_svg]:w-3.5',
        md: 'h-9 w-9 [&_svg]:h-4 [&_svg]:w-4',
        lg: 'h-11 w-11 [&_svg]:h-[18px] [&_svg]:w-[18px]',
      },
    },
    defaultVariants: { variant: 'ghost', size: 'md' },
  }
)

export interface OwnerIconButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof iconButtonStyles> {
  badge?: number | boolean
  'aria-label': string
}

export const OwnerIconButton = forwardRef<HTMLButtonElement, OwnerIconButtonProps>(
  ({ className, variant, size, badge, children, ...props }, ref) => (
    <button ref={ref} className={cn(iconButtonStyles({ variant, size }), className)} {...props}>
      {children}
      {badge ? (
        <span
          className={cn(
            'absolute -top-0.5 -right-0.5 flex items-center justify-center rounded-owner-full bg-owner-danger text-white font-bold ring-2 ring-owner-bg',
            typeof badge === 'number' && badge > 0 ? 'min-w-[16px] h-4 text-[9px] px-1' : 'h-2.5 w-2.5'
          )}
        >
          {typeof badge === 'number' && badge > 0 ? (badge > 9 ? '9+' : badge) : null}
        </span>
      ) : null}
    </button>
  )
)
OwnerIconButton.displayName = 'OwnerIconButton'
