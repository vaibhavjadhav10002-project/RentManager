'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { LocalConfigSource, localPacks, resolveActiveExperience } from '@/lib/experience'
import type { ResolvedExperience } from '@/lib/experience'

/**
 * ExperienceProvider — Phase 2
 * ─────────────────────────────────────────────────────────────────────────
 * Deliberately dumb. This component contains NO date logic, NO priority
 * logic, NO event matching, and NO theme-selection logic — all of that
 * lives in `src/lib/experience/engine.ts` and is out of scope for this
 * file by design (see EXPERIENCE_ENGINE.md). This component's entire job:
 *
 *   1. Ask the engine which Experience Pack (if any) is active.
 *   2. Reflect that as a `data-experience` attribute on `<html>`.
 *   3. Reflect that pack's `tokens` (if any) as `--exp-*` CSS custom
 *      properties on `<html>`.
 *   4. Expose the resolved result through context, for any future
 *      component that wants to read it without re-resolving.
 *
 * Renders NO DOM of its own (a Context.Provider has no DOM footprint) —
 * `children` pass straight through. Combined with the engine's flag
 * short-circuit and the empty `localPacks` registry, this means: with the
 * flag off (default), or with the flag on and no packs configured, this
 * component sets no attribute, sets no CSS variable, and renders no
 * element — the app is pixel- and behavior-identical to not having this
 * provider mounted at all.
 *
 * Attribute/variable target: `document.documentElement` (`<html>`), not a
 * wrapper `<div>`. This avoids inserting any new element into the tree
 * (which could otherwise disturb flex/height chains in the Owner, Tenant,
 * or Admin shells) and avoids colliding with those shells' own
 * `data-theme` attribute, which lives on their own wrapper elements, not
 * on `<html>`.
 */

const DEFAULT_RESOLVED: ResolvedExperience = { active: false, reason: 'flag-disabled' }

const ExperienceContext = createContext<ResolvedExperience>(DEFAULT_RESOLVED)

// One shared config source for the app's lifetime — Phase 1's
// `LocalConfigSource` over the (currently empty) `localPacks` registry.
// Swapping to a remote source later means changing this one line, not
// this component's logic.
const configSource = new LocalConfigSource(localPacks)

export function ExperienceProvider({ children }: { children: React.ReactNode }) {
  const [resolved, setResolved] = useState<ResolvedExperience>(DEFAULT_RESOLVED)

  // Step 1: ask the engine. All decision-making happens inside
  // resolveActiveExperience() — this effect only calls it and stores
  // whatever it returns.
  useEffect(() => {
    let cancelled = false
    resolveActiveExperience(configSource).then((result) => {
      if (!cancelled) setResolved(result)
    })
    return () => {
      cancelled = true
    }
  }, [])

  // Steps 2 & 3: reflect the resolved result onto <html>. Pure DOM
  // read/write of what the engine already decided — no decisions made
  // here.
  useEffect(() => {
    const root = document.documentElement
    const injectedCssVars: string[] = []

    if (resolved.active) {
      root.setAttribute('data-experience', resolved.pack.id)
      const tokens = resolved.pack.tokens ?? {}
      for (const [key, value] of Object.entries(tokens)) {
        const cssVar = `--exp-${key}`
        root.style.setProperty(cssVar, value)
        injectedCssVars.push(cssVar)
      }
    }

    return () => {
      root.removeAttribute('data-experience')
      injectedCssVars.forEach((cssVar) => root.style.removeProperty(cssVar))
    }
  }, [resolved])

  // Step 4: expose via context. No DOM node added.
  return <ExperienceContext.Provider value={resolved}>{children}</ExperienceContext.Provider>
}

/** Reads the currently resolved experience. Never throws outside a provider — falls back to the same "inactive" default the provider starts with. */
export function useExperience(): ResolvedExperience {
  return useContext(ExperienceContext)
}
