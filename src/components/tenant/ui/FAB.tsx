'use client'

import { forwardRef } from 'react'
import { cn } from '@/lib/utils'

export interface FABProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: React.ReactNode
  label?: string
  /** Sits above the bottom nav bar by default; set false for pages without one. */
  aboveBottomNav?: boolean
}

/**
 * Floating action button — use for exactly one primary creation action per
 * screen (e.g. "New Complaint"). Extends into a labeled pill on wider
 * screens if `label` is given, stays icon-only on narrow phones.
 */
export const FAB = forwardRef<HTMLButtonElement, FABProps>(
  ({ icon, label, aboveBottomNav = true, className, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        'fixed right-4 sm:right-[max(1rem,calc(50vw-20rem))] z-30 flex items-center gap-2 h-14 px-4 rounded-tenant-full bg-tenant-primary text-tenant-primary-fg shadow-tenant-glow-lg active:scale-95 transition-transform font-semibold text-sm',
        aboveBottomNav ? 'bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px))]' : 'bottom-6',
        !label && 'w-14 px-0 justify-center',
        className
      )}
      {...props}
    >
      <span className="[&_svg]:h-5 [&_svg]:w-5 shrink-0">{icon}</span>
      {label && <span className="whitespace-nowrap">{label}</span>}
    </button>
  )
)
FAB.displayName = 'FAB'
