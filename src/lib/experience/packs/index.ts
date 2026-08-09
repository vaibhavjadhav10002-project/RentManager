/**
 * Rentivo Experience Engine — Pack Registry Aggregator
 * ─────────────────────────────────────────────────────────────────────────
 * One array combining every pack category that exists so far. Phase 3
 * adds `seasonalPacks`; future phases add `festivalPacks`,
 * `nationalPacks`, `remembrancePacks`, `campaignPacks` the same way —
 * each in its own file under this directory, each imported and spread in
 * here. `localPacks.ts` imports only `allPacks`, never a specific
 * category file directly, so adding a category is a two-line change in
 * this file and nowhere else.
 */

import { seasonalPacks } from './seasonal'
import { nationalPacks } from './national'
import { remembrancePacks } from './remembrance'
import { festivalPacks } from './festival'
import { campaignPacks } from './campaign'
import type { ExperiencePack } from '../types'

export const allPacks: ExperiencePack[] = [
  ...seasonalPacks,
  ...nationalPacks,
  ...remembrancePacks,
  ...festivalPacks,
  ...campaignPacks,
]
