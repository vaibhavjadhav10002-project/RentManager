'use client'

import { cn } from '@/lib/utils'

export function OwnerDivider({ className }: { className?: string }) {
  return <div className={cn('h-px w-full bg-owner-border', className)} />
}

export function OwnerSectionHeader({
  title,
  description,
  action,
  className,
}: {
  title: React.ReactNode
  description?: React.ReactNode
  action?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex items-center justify-between gap-4 mb-4', className)}>
      <div>
        <h2 className="text-base font-bold text-owner-fg tracking-tight">{title}</h2>
        {description && <p className="text-xs text-owner-muted mt-0.5">{description}</p>}
      </div>
      {action}
    </div>
  )
}

export function OwnerEmptyState({
  icon: Icon,
  title,
  subtitle,
  action,
  className = 'py-16',
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  subtitle?: string
  action?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center text-center px-6', className)}>
      <div className="w-12 h-12 rounded-owner-xl bg-owner-surface-hover flex items-center justify-center mb-3">
        <Icon className="w-5 h-5 text-owner-muted" />
      </div>
      <div className="text-sm font-semibold text-owner-fg">{title}</div>
      {subtitle && <div className="text-xs text-owner-muted mt-1 max-w-xs">{subtitle}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
