'use client'

import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeStyles = cva(
  'inline-flex items-center gap-1 font-semibold rounded-owner-full whitespace-nowrap',
  {
    variants: {
      tone: {
        neutral: 'bg-owner-surface-hover text-owner-muted',
        primary: 'bg-owner-primary/15 text-owner-primary',
        success: 'bg-owner-success/15 text-owner-success',
        warning: 'bg-owner-warning/15 text-owner-warning',
        danger: 'bg-owner-danger/15 text-owner-danger',
        info: 'bg-owner-info/15 text-owner-info',
        purple: 'bg-owner-purple/15 text-owner-purple',
        teal: 'bg-owner-teal/15 text-owner-teal',
        'solid-danger': 'bg-owner-danger text-white',
        'solid-primary': 'bg-owner-primary text-owner-primary-fg',
      },
      size: {
        sm: 'text-[10px] px-2 py-0.5',
        md: 'text-[11px] px-2.5 py-1',
      },
    },
    defaultVariants: { tone: 'neutral', size: 'md' },
  }
)

export interface OwnerBadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeStyles> {}

export function OwnerBadge({ className, tone, size, ...props }: OwnerBadgeProps) {
  return <span className={cn(badgeStyles({ tone, size }), className)} {...props} />
}

/**
 * Maps the app's existing status strings (tenants, payments, complaints,
 * rooms, approvals, etc.) to a badge tone, so every table/list that
 * renders a status stays visually consistent without re-deriving the
 * mapping in every page.
 */
export function ownerStatusTone(status: string): NonNullable<OwnerBadgeProps['tone']> {
  const s = status.toLowerCase().replace(/_/g, ' ')
  if (['approved', 'paid', 'resolved', 'completed', 'active', 'occupied', 'verified'].includes(s)) return 'success'
  if (['pending', 'pending approval', 'in progress', 'open', 'partially occupied', 'partial'].includes(s)) return 'warning'
  if (['rejected', 'overdue', 'cancelled', 'failed', 'vacated', 'blocked'].includes(s)) return 'danger'
  if (['vacant', 'maintenance'].includes(s)) return 'info'
  return 'neutral'
}
