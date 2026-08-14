'use client'
import { useEffect, useState } from 'react'
import { resolveActiveExperience, LocalConfigSource, localPacks, type ResolvedExperience } from '@/lib/experience'

/**
 * Client-side hook wiring `resolveActiveExperience()` (the Phase 1 engine,
 * previously built but never called from any screen — see
 * src/lib/experience/index.ts and engine.ts) into React.
 *
 * Returns `null` while resolving/disabled/no pack active, or the active
 * `ExperiencePack` when one is live "today". Safe to call from multiple
 * components at once — each resolves independently (the engine itself is
 * cheap: one in-memory array filter, no network call in Phase 1's
 * `LocalConfigSource`), no shared/global state to coordinate.
 */
export function useActiveExperience() {
  const [resolved, setResolved] = useState<ResolvedExperience>({ active: false, reason: 'flag-disabled' })

  useEffect(() => {
    let cancelled = false
    resolveActiveExperience(new LocalConfigSource(localPacks)).then(res => {
      if (!cancelled) setResolved(res)
    })
    return () => { cancelled = true }
  }, [])

  return resolved.active ? resolved.pack : null
}
