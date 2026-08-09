/**
 * Rentivo Experience Engine — Core
 * ─────────────────────────────────────────────────────────────────────────
 * The single entry point everything else in this module builds toward.
 * `resolveActiveExperience()` ties the feature flag, a config source, the
 * date resolver, and the priority resolver together and answers one
 * question: "what, if anything, should be visually active right now?"
 *
 * This file has NO knowledge of React, CSS variables, Tailwind, or any
 * specific screen — per the roadmap, wiring this output into the UI is a
 * later phase. Nothing here imports from `src/components/` or `src/app/`.
 *
 * Behavior when the flag is off (default): returns `{ active: false,
 * reason: 'flag-disabled' }` immediately, without calling the config
 * source at all — so a slow/broken remote config source can never affect
 * the app while the engine is disabled.
 */

import { isExperienceEngineEnabled, type ExperienceEngineFlagOverride } from './flag'
import type { ExperienceConfigSource } from './configSource'
import { filterActivePacks } from './dateResolver'
import { resolveHighestPriorityPack } from './priorityResolver'
import { validatePack, type ExperiencePack } from './types'
import { freezeDeep } from './immutable'

/**
 * The engine's output. When `active: true`, `pack` — and every object it
 * transitively contains (`dateRule`, `tokens`, `meta`) — is deep-frozen.
 * Callers get read-only data by construction, not by convention: any
 * attempted mutation throws in strict mode / silently no-ops otherwise.
 * The resolved object itself is frozen too, so callers can't reassign
 * `resolved.pack` or `resolved.active` either. This is what guarantees the
 * Website and the Android APK — both future consumers of this same engine
 * — can never observe a pack mutated by another caller.
 */
export type ResolvedExperience =
  | { active: false; reason: 'flag-disabled' | 'no-pack-active' }
  | { active: true; pack: ExperiencePack }

export interface ResolveExperienceOptions {
  /** Point in time to evaluate against. Defaults to `new Date()`. */
  instant?: Date
  /** Bypasses the env-based flag — see `flag.ts`. Intended for tests. */
  flagOverride?: ExperienceEngineFlagOverride
}

/**
 * Resolves the single active Experience Pack (if any) from `configSource`
 * at `options.instant` (default: now).
 *
 * Malformed packs from the config source are skipped defensively (logged
 * as a warning, never thrown) rather than crashing resolution — important
 * once a remote/admin-editable source exists, where a bad row should
 * degrade gracefully rather than take down every screen that asks the
 * engine for the current experience.
 */
export async function resolveActiveExperience(
  configSource: ExperienceConfigSource,
  options: ResolveExperienceOptions = {}
): Promise<ResolvedExperience> {
  if (!isExperienceEngineEnabled(options.flagOverride)) {
    return freezeDeep({ active: false, reason: 'flag-disabled' } as const)
  }

  const rawPacks = await configSource.getPacks()
  const validPacks = rawPacks
    .filter((pack) => {
      const problems = validatePack(pack)
      if (problems.length > 0) {
        // eslint-disable-next-line no-console
        console.warn(`[experience-engine] skipping invalid pack "${pack?.id ?? '(no id)'}":`, problems)
        return false
      }
      return true
    })
    // Freeze immediately after validation, before any resolver touches a
    // pack — no code path downstream of this line can ever hold a mutable
    // reference to a pack, regardless of where it came from.
    .map((pack) => freezeDeep(pack))

  const activePacks = filterActivePacks(validPacks, options.instant ?? new Date())
  const winner = resolveHighestPriorityPack(activePacks)

  if (!winner) {
    return freezeDeep({ active: false, reason: 'no-pack-active' } as const)
  }

  return freezeDeep({ active: true, pack: winner } as const)
}
