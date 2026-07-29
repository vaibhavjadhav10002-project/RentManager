'use client'
// Phase 8.5 — Profile Status System: Owner Timeline + Tenant Timeline.
// One component, two variants, backed by the same profile_status_history
// rows (supabase/32_profile_status_history.sql) and the same status ladder
// (src/lib/utils/profileStatus.ts). Mobile-responsive: vertical list on
// narrow screens works the same as on wide ones, no separate mobile layout
// needed since it's already a single column.

import { Check, Clock, AlertTriangle, Circle } from 'lucide-react'
import { cn, formatDate } from '@/lib/utils'
import { PROFILE_STATUS_STEPS, profileStatusLabel } from '@/lib/utils/profileStatus'
import { ProgressBar } from './ProgressBar'
import type { ProfileStatusHistory } from '@/types'

export type ProfileStatusHistoryEntry = ProfileStatusHistory

interface StatusTimelineProps {
  currentStatus: string | null | undefined
  history: ProfileStatusHistoryEntry[]
  completionPercent?: number
  variant?: 'owner' | 'tenant'
  className?: string
}

function iconFor(status: string, isCurrent: boolean, isPast: boolean) {
  if (status === 'correction_requested') return AlertTriangle
  if (isPast || isCurrent) return Check
  return Circle
}

export function StatusTimeline({ currentStatus, history, completionPercent, variant = 'owner', className }: StatusTimelineProps) {
  // Render order: the fixed main-line steps, but if the tenant is currently
  // sitting in a correction/resubmission loop, show that as an inserted
  // step right after "Submitted" rather than hiding it.
  const visibleSteps = PROFILE_STATUS_STEPS.filter(s => {
    if (s.key === 'resubmitted') return currentStatus === 'resubmitted' || history.some(h => h.to_status === 'resubmitted')
    if (s.key === 'correction_requested') return currentStatus === 'correction_requested' || history.some(h => h.to_status === 'correction_requested')
    return true
  })
  const currentIdx = visibleSteps.findIndex(s => s.key === currentStatus)

  const historyByStatus = new Map(history.map(h => [h.to_status, h]))

  const isTenant = variant === 'tenant'

  return (
    <div className={cn('w-full', isTenant ? 'text-tenant-fg' : 'text-gray-900', className)}>
      {typeof completionPercent === 'number' && (
        <div className="mb-4">
          <ProgressBar
            percent={completionPercent}
            label="Profile Completion"
            fillClassName={isTenant ? 'bg-tenant-primary' : undefined}
            trackClassName={isTenant ? 'bg-tenant-surface-hover' : undefined}
          />
        </div>
      )}

      <ol className="space-y-0">
        {visibleSteps.map((step, i) => {
          const isPast = currentIdx !== -1 && i < currentIdx
          const isCurrent = i === currentIdx
          const isFuture = currentIdx !== -1 && i > currentIdx
          const entry = historyByStatus.get(step.key)
          const Icon = iconFor(step.key, isCurrent, isPast)
          const isLast = i === visibleSteps.length - 1

          const dotClasses = isCurrent
            ? step.key === 'correction_requested'
              ? (isTenant ? 'bg-tenant-warning text-white' : 'bg-amber-500 text-white')
              : (isTenant ? 'bg-tenant-primary text-tenant-primary-fg' : 'bg-teal-600 text-white')
            : isPast
              ? (isTenant ? 'bg-tenant-success/20 text-tenant-success' : 'bg-green-100 text-green-600')
              : (isTenant ? 'bg-tenant-surface-hover text-tenant-muted-subtle' : 'bg-gray-100 text-gray-300')

          return (
            <li key={step.key} className="relative flex gap-3 pb-5 last:pb-0">
              {!isLast && (
                <span
                  className={cn(
                    'absolute left-[13px] top-6 w-0.5 h-full -translate-x-1/2',
                    isPast ? (isTenant ? 'bg-tenant-success/40' : 'bg-green-200') : (isTenant ? 'bg-tenant-border' : 'bg-gray-100')
                  )}
                />
              )}
              <span className={cn('relative z-10 flex items-center justify-center w-[26px] h-[26px] rounded-full shrink-0', dotClasses)}>
                <Icon className="w-3.5 h-3.5" strokeWidth={2.5} />
              </span>
              <div className={cn('flex-1 min-w-0', isFuture && (isTenant ? 'opacity-50' : 'opacity-40'))}>
                <div className={cn('text-sm font-bold', isCurrent && (isTenant ? 'text-tenant-primary' : 'text-teal-700'))}>
                  {profileStatusLabel(step.key, variant)}
                </div>
                {entry && (
                  <div className={cn('text-xs mt-0.5', isTenant ? 'text-tenant-muted' : 'text-gray-400')}>
                    {formatDate(entry.changed_at)}
                  </div>
                )}
                {step.key === 'correction_requested' && entry?.note && (
                  <div className={cn('text-xs mt-1 italic rounded-lg px-2.5 py-1.5', isTenant ? 'bg-tenant-warning/10 text-tenant-fg' : 'bg-amber-50 text-amber-800')}>
                    "{entry.note}"
                  </div>
                )}
              </div>
            </li>
          )
        })}
      </ol>

      {history.length === 0 && (
        <div className={cn('flex items-center gap-2 text-xs mt-2', isTenant ? 'text-tenant-muted-subtle' : 'text-gray-400')}>
          <Clock className="w-3.5 h-3.5" />
          No status history yet
        </div>
      )}
    </div>
  )
}
