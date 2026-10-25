import { SkeletonCardGrid, SkeletonList } from './Skeleton'

/**
 * Shown by Next.js during route transitions (see each route group's
 * loading.tsx) — the moment between navigating and the destination page's
 * own component mounting.
 *
 * Upgraded from a bare centered spinner to a generic shimmer skeleton
 * (stat-tile row + list rows) that roughly matches the shape of most pages
 * in this app (dashboard/tenants/payments/etc. are all "some tiles + a
 * list"). A shimmering near-approximation of the destination content reads
 * as "already loading the real page" rather than "nothing has happened
 * yet" — the same trick every native app's skeleton screens use — even
 * though the actual wait time is unchanged.
 */
export default function PageLoader() {
  return (
    <div className="space-y-4 p-1" role="status" aria-label="Loading">
      <SkeletonCardGrid count={4} />
      <SkeletonList rows={6} />
    </div>
  )
}
