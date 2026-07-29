'use client'
import { AlertTriangle, RefreshCw } from 'lucide-react'

/**
 * Shown by Next.js's error.tsx boundaries (one per route group — see each
 * group's error.tsx) when a component throws during render. Before this
 * phase there was no error.tsx anywhere, so any render-time bug would fall
 * through to Next's default error handling instead of anything belonging
 * to the app — same gap shape as the missing loading.tsx files in 6.4.
 *
 * Deliberately generic and safe: never renders `error.message` directly to
 * the page (an error message could leak internal details), just a calm,
 * branded "something went wrong" with a real recovery action.
 */
export default function ErrorFallback({ reset, homeHref = '/' }: { reset: () => void; homeHref?: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-screen text-center px-6 gap-3">
      <div className="w-14 h-14 rounded-2xl bg-red-50 text-red-500 flex items-center justify-center">
        <AlertTriangle className="w-7 h-7" />
      </div>
      <h1 className="text-lg font-extrabold text-gray-900">Something went wrong</h1>
      <p className="text-sm text-gray-500 max-w-sm">
        This screen hit an unexpected error. Your data is safe — try again, or head back home.
      </p>
      <div className="flex gap-2 mt-2">
        <button onClick={reset}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition">
          <RefreshCw className="w-4 h-4" /> Try Again
        </button>
        <a href={homeHref}
          className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-semibold transition">
          Go Home
        </a>
      </div>
    </div>
  )
}
