'use client'

import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeStyles = cva(
  'inline-flex items-center gap-1 font-semibold rounded-tenant-full whitespace-nowrap',
  {
    variants: {
      tone: {
        neutral: 'bg-tenant-surface-hover text-tenant-muted',
        primary: 'bg-tenant-primary/15 text-tenant-primary',
        success: 'bg-tenant-success/15 text-tenant-success',
        warning: 'bg-tenant-warning/15 text-tenant-warning',
        danger: 'bg-tenant-danger/15 text-tenant-danger',
        info: 'bg-tenant-info/15 text-tenant-info',
        purple: 'bg-tenant-purple/15 text-tenant-purple',
        teal: 'bg-tenant-teal/15 text-tenant-teal',
        // Solid fills — for the rare "this needs attention now" badge
        // (e.g. "Due Today"), used sparingly against the tinted set above.
        'solid-danger': 'bg-tenant-danger text-white',
        'solid-primary': 'bg-tenant-primary text-tenant-primary-fg',
      },
      size: {
        sm: 'text-[10px] px-2 py-0.5',
        md: 'text-[11px] px-2.5 py-1',
      },
    },
    defaultVariants: {
      tone: 'neutral',
      size: 'md',
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeStyles> {}

export function Badge({ className, tone, size, ...props }: BadgeProps) {
  return <span className={cn(badgeStyles({ tone, size }), className)} {...props} />
}

/**
 * Maps the app's existing status strings to a badge tone, so every screen
 * that renders a status (payments, complaints, requests, notices) stays
 * visually consistent without re-deriving the mapping each time.
 */
export function statusTone(status: string): NonNullable<BadgeProps['tone']> {
  const s = status.toLowerCase().replace(/_/g, ' ')
  if (['approved', 'paid', 'resolved', 'completed', 'active'].includes(s)) return 'success'
  if (['pending', 'pending approval', 'in progress', 'open'].includes(s)) return 'warning'
  if (['rejected', 'overdue', 'cancelled', 'failed'].includes(s)) return 'danger'
  if (['partial'].includes(s)) return 'info'
  return 'neutral'
}
