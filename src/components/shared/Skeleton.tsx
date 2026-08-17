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

/**
 * A header row + N data rows of column-shaped bars — for report pages that
 * render an actual `<table>` (income/expenses transaction tables), where a
 * circle-avatar SkeletonRow reads as the wrong shape entirely (those
 * tables have no avatars, just aligned text columns).
 */
export function SkeletonTable({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  const widths = ['w-16', 'w-24', 'w-14', 'w-20', 'w-16', 'w-20']
  return (
    <div className="rounded-xl border border-gray-100 dark:border-gray-800 overflow-hidden">
      <div className="flex gap-4 px-5 py-3 border-b border-gray-100 dark:border-gray-800">
        {Array.from({ length: cols }).map((_, i) => <Skeleton key={i} className={`h-3 ${widths[i % widths.length]}`} />)}
      </div>
      <div className="divide-y divide-gray-100 dark:divide-gray-800">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="flex gap-4 px-5 py-3.5">
            {Array.from({ length: cols }).map((_, c) => <Skeleton key={c} className={`h-3.5 ${widths[(c + r) % widths.length]}`} />)}
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * A row of variable-height shimmer bars — for report pages with an actual
 * bar/line chart (profit-loss), so the loading state previews "a chart is
 * coming here" instead of a generic list shape that has nothing to do
 * with what's about to render.
 */
export function SkeletonChart() {
  const heights = [40, 65, 45, 80, 55, 70, 50, 90, 60, 75, 48, 66]
  return (
    <div className="rounded-xl border border-gray-100 dark:border-gray-800 p-5">
      <div className="flex items-end gap-2 h-40">
        {heights.map((h, i) => (
          <div key={i} className="skeleton rounded-t flex-1" style={{ height: `${h}%` }} />
        ))}
      </div>
    </div>
  )
}

/**
 * Mirrors the ID-card grid on the Tenant Cards page — colored header
 * strip + avatar-square + two text lines + a button — rather than a
 * generic list row, since that page's real cards look nothing like a
 * simple list.
 */
export function SkeletonProfileCard() {
  return (
    <div className="rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden">
      <div className="skeleton h-9" />
      <div className="p-4 flex gap-3">
        <Skeleton className="w-14 h-14 rounded-xl shrink-0" />
        <div className="flex-1 space-y-2 pt-1">
          <Skeleton className="h-3.5 w-2/3" />
          <Skeleton className="h-3 w-1/2" />
          <Skeleton className="h-3 w-1/3" />
        </div>
      </div>
      <div className="px-4 pb-4">
        <Skeleton className="h-8 w-full rounded-xl" />
      </div>
    </div>
  )
}

export function SkeletonProfileGrid({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: count }).map((_, i) => <SkeletonProfileCard key={i} />)}
    </div>
  )
}
