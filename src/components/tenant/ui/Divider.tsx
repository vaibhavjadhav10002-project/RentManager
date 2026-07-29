'use client'

import { cn } from '@/lib/utils'

export function Divider({ className }: { className?: string }) {
  return <div className={cn('h-px w-full bg-tenant-border', className)} />
}

export function SectionHeader({
  title,
  action,
  className,
}: {
  title: React.ReactNode
  action?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex items-center justify-between mb-3', className)}>
      <h2 className="text-[13px] font-bold text-tenant-fg tracking-tight">{title}</h2>
      {action && <div className="text-xs font-semibold text-tenant-primary">{action}</div>}
    </div>
  )
}
