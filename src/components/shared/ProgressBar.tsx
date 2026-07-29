'use client'
// Phase 8.5 — Profile Completion Progress Indicator.
// Deliberately framework-agnostic (plain divs, no design-system import) so
// it renders correctly in both the owner dashboard (plain Tailwind) and the
// tenant portal (tenant-* design tokens) without pulling either system into
// the other's screens.

import { cn } from '@/lib/utils'

interface ProgressBarProps {
  percent: number
  className?: string
  trackClassName?: string
  fillClassName?: string
  label?: string
  size?: 'sm' | 'md'
}

export function ProgressBar({ percent, className, trackClassName, fillClassName, label, size = 'md' }: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, Math.round(percent)))
  const height = size === 'sm' ? 'h-1.5' : 'h-2'
  return (
    <div className={cn('w-full', className)}>
      {label && (
        <div className="flex items-center justify-between mb-1">
          <span className="text-[11px] font-semibold text-gray-500">{label}</span>
          <span className="text-[11px] font-bold text-gray-700">{clamped}%</span>
        </div>
      )}
      <div className={cn('w-full rounded-full bg-gray-100 overflow-hidden', height, trackClassName)}>
        <div
          role="progressbar"
          aria-valuenow={clamped}
          aria-valuemin={0}
          aria-valuemax={100}
          className={cn('h-full rounded-full transition-all duration-500 ease-out bg-gradient-to-r from-teal-500 to-blue-500', fillClassName)}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  )
}
