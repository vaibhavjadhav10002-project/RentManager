/**
 * Rentivo Experience Engine — Public API (Phase 1)
 * ─────────────────────────────────────────────────────────────────────────
 * This module is not imported by any screen yet (by design — see
 * PROJECT_STATE.md / CHANGELOG.md Phase 1 entry). It exists so a future
 * phase has exactly one import path: `@/lib/experience`.
 */

export { resolveActiveExperience } from './engine'
export type { ResolvedExperience, ResolveExperienceOptions } from './engine'

export { isExperienceEngineEnabled } from './flag'
export type { ExperienceEngineFlagOverride } from './flag'

export { LocalConfigSource } from './configSource'
export type { ExperienceConfigSource } from './configSource'

export { localPacks } from './localPacks'

export { isPackActiveOnDate, filterActivePacks } from './dateResolver'
export { resolveHighestPriorityPack } from './priorityResolver'
export { freezeDeep } from './immutable'

export {
  PACK_CATEGORIES,
  FALLBACK_TIERS,
  CATEGORY_PRIORITY,
  validatePack,
} from './types'
export type {
  PackCategory,
  FallbackTier,
  ExperiencePack,
  ExperienceTokenOverrides,
  AccentPalette,
  GreetingConfig,
  DecorativeAssetRef,
  AnimationProfile,
  AccessibilityOptions,
  DateRule,
  FixedDateRule,
  ExplicitDatesRule,
  DateRangeRule,
  DateTimeRangeRule,
  ManualRule,
} from './types'
