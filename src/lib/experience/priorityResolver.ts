/**
 * Rentivo Experience Engine — Priority Resolver
 * ─────────────────────────────────────────────────────────────────────────
 * Given a set of packs that are ALL already known to be active (enabled +
 * date-matched), pick exactly one — per the product rule "only ONE
 * Experience Pack may be active at a time; never merge themes."
 *
 * Precedence: `priorityOverride` on the pack if present, else
 * `CATEGORY_PRIORITY[category]` (1 = campaign … 5 = season, lower wins).
 * Ties (same effective priority) are broken deterministically by `id`
 * (lexicographic) so the resolver is a pure function — same input always
 * produces the same output, no reliance on array order or Date.now().
 */

import { CATEGORY_PRIORITY, type ExperiencePack } from './types'

function effectivePriority(pack: ExperiencePack): number {
  return pack.priorityOverride ?? CATEGORY_PRIORITY[pack.category]
}

/**
 * Returns the single highest-precedence pack from `activePacks`, or `null`
 * if the list is empty. Does not mutate or re-sort the input array.
 */
export function resolveHighestPriorityPack(
  activePacks: ExperiencePack[]
): ExperiencePack | null {
  if (activePacks.length === 0) return null

  return activePacks.reduce((winner, candidate) => {
    const winnerPriority = effectivePriority(winner)
    const candidatePriority = effectivePriority(candidate)

    if (candidatePriority < winnerPriority) return candidate
    if (candidatePriority > winnerPriority) return winner
    // Exact tie — deterministic tie-break by id.
    return candidate.id < winner.id ? candidate : winner
  })
}
