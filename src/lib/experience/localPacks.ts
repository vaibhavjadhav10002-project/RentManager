/**
 * Rentivo Experience Engine — Local Pack Registry
 * ─────────────────────────────────────────────────────────────────────────
 * The actual list of Experience Packs, consumed via `LocalConfigSource`
 * (see `configSource.ts`). Empty through Phase 1–2 while the engine,
 * schema, and resolvers were verified in isolation. Phase 3 populates it
 * with the four Seasonal packs (`packs/seasonal.ts`) via the aggregator
 * in `packs/index.ts`. Frozen on export — reinforces the immutable-
 * configuration guarantee at the source, not just at the engine's output
 * boundary (see `immutable.ts`).
 *
 * Adding a future category (Festival, National, Remembrance, Campaign) is
 * purely: create `packs/<category>.ts`, export its array, add it to the
 * spread in `packs/index.ts`. This file never changes.
 */

import type { ExperiencePack } from './types'
import { freezeDeep } from './immutable'
import { allPacks } from './packs'

export const localPacks: ExperiencePack[] = freezeDeep(allPacks)
