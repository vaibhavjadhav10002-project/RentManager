/**
 * Shimmering placeholder blocks (see `.skeleton` in globals.css) — used
 * wherever a page/section is waiting on its first data fetch, in place of a
 * bare spinner. A shape that roughly previews the eventual content reads as
 * "already loading the real thing" instead of "nothing has happened yet",
 * which is most of what makes native apps feel fast even at the same
 * network speed. Pure presentational — no data awareness needed.
 */
export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton rounded-lg ${className}`} />
}

/** A single list-row shaped skeleton — avatar/icon + two text lines. */
export function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 p-3">
      <Skeleton className="w-10 h-10 rounded-full shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-3.5 w-1/3" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    </div>
  )
}

/** N stacked SkeletonRows — the common case for tenant/payment/complaint lists. */
export function SkeletonList({ rows = 5 }: { rows?: number }) {
  return (
    <div className="divide-y divide-gray-100 dark:divide-gray-800">
      {Array.from({ length: rows }).map((_, i) => <SkeletonRow key={i} />)}
    </div>
  )
}

/** A card-shaped skeleton — for stat tiles / dashboard summary cards. */
export function SkeletonCard() {
  return (
    <div className="rounded-2xl border border-gray-100 dark:border-gray-800 p-4 space-y-3">
      <Skeleton className="h-3 w-1/2" />
      <Skeleton className="h-6 w-2/3" />
    </div>
  )
}

/** A grid of SkeletonCards — for dashboard-style stat-tile rows. */
export function SkeletonCardGrid({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {Array.from({ length: count }).map((_, i) => <SkeletonCard key={i} />)}
    </div>
  )
}
