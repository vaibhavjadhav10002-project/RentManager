'use client'

import { TrendingUp, TrendingDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { OwnerCard } from './Card'

const TONE_CLASSES = {
  primary: { bg: 'bg-owner-primary/12', fg: 'text-owner-primary' },
  success: { bg: 'bg-owner-success/12', fg: 'text-owner-success' },
  warning: { bg: 'bg-owner-warning/12', fg: 'text-owner-warning' },
  danger: { bg: 'bg-owner-danger/12', fg: 'text-owner-danger' },
  info: { bg: 'bg-owner-info/12', fg: 'text-owner-info' },
  purple: { bg: 'bg-owner-purple/12', fg: 'text-owner-purple' },
  teal: { bg: 'bg-owner-teal/12', fg: 'text-owner-teal' },
} as const

export interface OwnerStatCardProps {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
  sub?: string
  tone?: keyof typeof TONE_CLASSES
  /**
   * Optional — intentionally not populated by any page yet. Once real
   * period-over-period comparisons exist (analytics logic, separate
   * workstream), a page can pass this in without any change here.
   */
  trend?: { value: number; label?: string }
  className?: string
}

export function OwnerStatCard({ icon: Icon, label, value, sub, tone = 'primary', trend, className }: OwnerStatCardProps) {
  const t = TONE_CLASSES[tone]
  return (
    <OwnerCard className={cn('relative overflow-hidden', className)}>
      <div className="flex items-start justify-between">
        <div className={cn('w-10 h-10 rounded-owner-lg flex items-center justify-center', t.bg)}>
          <Icon className={cn('w-5 h-5', t.fg)} />
        </div>
        {trend && (
          <div className={cn(
            'flex items-center gap-0.5 text-xs font-bold',
            trend.value >= 0 ? 'text-owner-success' : 'text-owner-danger'
          )}>
            {trend.value >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {Math.abs(trend.value)}%
          </div>
        )}
      </div>
      <div className="owner-numeric text-xl sm:text-2xl font-extrabold text-owner-fg mt-4 break-words">{value}</div>
      <div className="text-xs text-owner-muted font-medium mt-1">{label}</div>
      {sub && <div className="text-xs text-owner-muted-subtle mt-0.5">{sub}</div>}
      {trend?.label && <div className="text-[10px] text-owner-muted-subtle mt-0.5">{trend.label}</div>}
    </OwnerCard>
  )
}
