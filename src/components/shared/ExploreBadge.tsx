'use client'
import { Sparkles } from 'lucide-react'
import { useExploreMode } from '@/lib/explore/context'

/** Mounted once in the root layout. Renders nothing outside Explore Mode. */
export default function ExploreBadge() {
  const { isExploring } = useExploreMode()
  if (!isExploring) return null

  return (
    <div
      className="fixed left-1/2 -translate-x-1/2 z-50 flex items-center gap-1.5 rounded-full bg-gray-900/90 dark:bg-white/90 backdrop-blur px-3.5 py-1.5 text-xs font-semibold text-white dark:text-gray-900 shadow-lg pointer-events-none"
      style={{ top: 'max(0.75rem, calc(0.75rem + env(safe-area-inset-top, 0px)))' }}
    >
      <Sparkles size={12} />
      Explore Mode
    </div>
  )
}
