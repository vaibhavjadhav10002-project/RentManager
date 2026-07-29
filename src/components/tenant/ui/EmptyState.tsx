'use client'

export function EmptyState({
  icon: Icon,
  title,
  subtitle,
  className = 'py-12',
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  subtitle?: string
  className?: string
}) {
  return (
    <div className={`flex flex-col items-center justify-center text-center px-6 ${className}`}>
      <div className="w-11 h-11 rounded-tenant-xl bg-tenant-surface-hover flex items-center justify-center mb-3">
        <Icon className="w-5 h-5 text-tenant-muted" />
      </div>
      <div className="text-sm font-semibold text-tenant-fg">{title}</div>
      {subtitle && <div className="text-xs text-tenant-muted mt-1">{subtitle}</div>}
    </div>
  )
}
