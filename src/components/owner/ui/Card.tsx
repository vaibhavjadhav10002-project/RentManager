'use client'

import { forwardRef } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const cardStyles = cva('rounded-owner-xl transition-colors', {
  variants: {
    variant: {
      default: 'bg-owner-surface border border-owner-border shadow-owner-xs',
      elevated: 'bg-owner-surface-elevated border border-owner-border shadow-owner-md',
      interactive: 'bg-owner-surface border border-owner-border shadow-owner-xs hover:shadow-owner-sm hover:border-owner-border-strong cursor-pointer',
      ghost: 'bg-transparent',
      // Filled hero variant — reserved for a single "this is the headline
      // number" card per screen (rare on a data-dense dashboard).
      primary: 'bg-owner-primary text-owner-primary-fg shadow-owner-glow',
    },
    padding: {
      none: 'p-0',
      sm: 'p-3.5',
      md: 'p-5',
      lg: 'p-6',
    },
  },
  defaultVariants: { variant: 'default', padding: 'md' },
})

export interface OwnerCardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardStyles> {}

export const OwnerCard = forwardRef<HTMLDivElement, OwnerCardProps>(
  ({ className, variant, padding, ...props }, ref) => (
    <div ref={ref} className={cn(cardStyles({ variant, padding }), className)} {...props} />
  )
)
OwnerCard.displayName = 'OwnerCard'

export function OwnerCardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex items-center justify-between mb-4', className)} {...props} />
}

export function OwnerCardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn('text-sm font-bold text-owner-fg', className)} {...props} />
}

export function OwnerCardDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('text-xs text-owner-muted mt-0.5', className)} {...props} />
}
