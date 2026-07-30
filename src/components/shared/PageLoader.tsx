import { Loader2 } from 'lucide-react'

/**
 * Shown by Next.js during route transitions (see each route group's
 * loading.tsx) — the moment between navigating and the destination page's
 * own component mounting. Before this phase there was no loading.tsx
 * anywhere, so slower connections/devices would show a blank white screen
 * during that gap instead of anything at all.
 *
 * Deliberately just a centered spinner, matching the exact look every page
 * in the app already uses for its own in-component loading state — this
 * isn't a new visual language, just filling the one gap those per-page
 * spinners can't cover (the instant before the page component exists yet).
 */
export default function PageLoader() {
  return (
    <div className="flex items-center justify-center h-screen text-gray-400">
      <Loader2 className="w-6 h-6 animate-spin" />
    </div>
  )
}
