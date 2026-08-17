'use client'
import { usePathname } from 'next/navigation'

/**
 * Wraps route content so every navigation gets a quick, native-feeling
 * fade+slide-up (see `.animate-page-in` in globals.css) instead of Next.js's
 * default hard content-swap. `key={pathname}` is what makes this actually
 * fire on every navigation: React only re-runs a CSS animation on mount, so
 * without a changing key this div would just silently update in place and
 * the animation would only ever play once, on the very first load.
 *
 * Deliberately just a div + CSS animation rather than a library
 * (framer-motion, etc.) — this is a single compositor-only `transform`/
 * `opacity` animation, which is exactly what CSS already does well, and
 * skips shipping extra JS to every page for a 220ms effect.
 */
export default function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  return (
    <div key={pathname} className="animate-page-in">
      {children}
    </div>
  )
}
