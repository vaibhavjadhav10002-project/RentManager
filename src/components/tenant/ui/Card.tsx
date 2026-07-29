'use client'

import { forwardRef } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const cardStyles = cva('rounded-tenant-2xl transition-colors', {
  variants: {
    variant: {
      // Standard resting card — the default surface for most content.
      default: 'bg-tenant-surface border border-tenant-border',
      // Raised — modals, sheets, anything that should read "above" the page.
      elevated: 'bg-tenant-surface-elevated border border-tenant-border shadow-tenant-md',
      // Tappable card — a hover/press state signals it leads somewhere.
      interactive:
        'bg-tenant-surface border border-tenant-border hover:bg-tenant-surface-hover active:scale-[0.99] cursor-pointer',
      // Flat, no border — used to group content against the page background.
      ghost: 'bg-transparent',
      // Filled with the primary color — for the one hero card per screen
      // (e.g. "Rent Due"). Use sparingly — this is the loudest card variant.
      primary: 'bg-tenant-primary text-tenant-primary-fg shadow-tenant-glow',
    },
    padding: {
      none: 'p-0',
      sm: 'p-3.5',
      md: 'p-4',
      lg: 'p-5',
    },
  },
  defaultVariants: {
    variant: 'default',
    padding: 'md',
  },
})

export interface CardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardStyles> {}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant, padding, ...props }, ref) => (
    <div ref={ref} className={cn(cardStyles({ variant, padding }), className)} {...props} />
  )
)
Card.displayName = 'Card'

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex items-center justify-between mb-3', className)} {...props} />
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn('text-[15px] font-bold text-tenant-fg', className)} {...props} />
}

export function CardDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('text-xs text-tenant-muted mt-0.5', className)} {...props} />
}
