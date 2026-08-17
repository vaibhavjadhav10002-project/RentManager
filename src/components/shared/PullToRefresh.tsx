'use client'
import { useRef, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { triggerActiveRefresh } from '@/lib/native/pullToRefresh'
import { tapHaptic } from '@/lib/native/haptics'

const TRIGGER_DISTANCE = 70   // px of pull before release triggers a refresh
const MAX_PULL = 110          // px — content stops following the finger past this

/**
 * Wraps a scrollable container so pulling down while already at the very
 * top of the scroll triggers a refresh — the one gesture every native app
 * has that a web app doesn't get for free. Calls whatever page-level
 * load()/fetchData() is currently registered via usePullToRefreshHandler;
 * if no page has registered one, the gesture still shows/hides but is a
 * harmless no-op rather than an error.
 *
 * Pure touch events (not a library) — this only needs to track one
 * finger's Y position against the container's scrollTop, which is a much
 * smaller problem than a general-purpose gesture library solves.
 * `touchAction: 'pan-x pan-y'` (not 'none') on the wrapper deliberately
 * still allows the browser's own vertical scroll to keep working; this
 * only intercepts the *rubber-band* pull that happens once scrollTop is
 * already 0, not scrolling in general.
 */
export default function PullToRefresh({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const startY = useRef<number | null>(null)
  const [pull, setPull] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const hapticFiredRef = useRef(false)

  const onTouchStart = (e: React.TouchEvent) => {
    if (refreshing) return
    const el = containerRef.current
    if (!el || el.scrollTop > 0) { startY.current = null; return }
    startY.current = e.touches[0].clientY
    hapticFiredRef.current = false
  }

  const onTouchMove = (e: React.TouchEvent) => {
    if (startY.current === null || refreshing) return
    const el = containerRef.current
    if (!el || el.scrollTop > 0) { startY.current = null; setPull(0); return }
    const delta = e.touches[0].clientY - startY.current
    if (delta <= 0) { setPull(0); return }
    // Diminishing return past MAX_PULL so the indicator doesn't just
    // follow the finger forever — matches the "rubber band" resistance
    // feel of native pull-to-refresh instead of a linear 1:1 drag.
    const eased = delta < MAX_PULL ? delta : MAX_PULL + (delta - MAX_PULL) * 0.15
    setPull(eased)
    if (eased >= TRIGGER_DISTANCE && !hapticFiredRef.current) {
      hapticFiredRef.current = true
      tapHaptic()
    }
  }

  const onTouchEnd = async () => {
    if (startY.current === null) return
    const shouldRefresh = pull >= TRIGGER_DISTANCE
    startY.current = null
    if (shouldRefresh) {
      setRefreshing(true)
      setPull(TRIGGER_DISTANCE)
      try { await triggerActiveRefresh() } finally {
        setRefreshing(false)
        setPull(0)
      }
    } else {
      setPull(0)
    }
  }

  const indicatorProgress = Math.min(pull / TRIGGER_DISTANCE, 1)

  return (
    <div
      ref={containerRef}
      className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain"
      style={{ touchAction: 'pan-x pan-y' }}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      <div
        className="flex items-center justify-center overflow-hidden transition-[height] duration-200"
        style={{ height: pull > 0 ? Math.min(pull, MAX_PULL) : 0 }}
        aria-hidden={pull === 0}
      >
        <RefreshCw
          className="w-5 h-5 text-owner-muted"
          style={{
            opacity: indicatorProgress,
            transform: `rotate(${indicatorProgress * 220}deg)`,
            animation: refreshing ? 'spin 0.7s linear infinite' : undefined,
          }}
        />
      </div>
      <div className={className}>{children}</div>
    </div>
  )
}
