/**
 * Rentivo Experience Engine — Pack Authoring Helper
 * ─────────────────────────────────────────────────────────────────────────
 * A plain factory function that assembles an `ExperiencePack` object
 * literal from a shorter input shape, purely to cut boilerplate across the
 * ~20+ fixed-date National/Remembrance packs in this and future phases.
 *
 * This is NOT engine logic — it lives entirely under `packs/`, is never
 * imported by `engine.ts`, `dateResolver.ts`, or `priorityResolver.ts`,
 * and every pack it produces is still just a plain, pure, immutable
 * (frozen once it reaches `localPacks`) configuration object indistinguishable
 * from one written by hand. Using it does not introduce any category-
 * specific behavior into the engine — the engine still only ever sees
 * `ExperiencePack` objects and still has no idea this helper exists.
 */

import type { ExperiencePack, PackCategory } from '../types'

export interface FixedDatePackInput {
  id: string
  name: string
  category: PackCategory
  /** 1–12 */
  month: number
  /** 1–31 */
  day: number
  windowDaysBefore?: number
  windowDaysAfter?: number
  respectfulMode?: boolean
  tokens?: ExperiencePack['tokens']
  accentPalette?: ExperiencePack['accentPalette']
  greeting?: ExperiencePack['greeting']
  decorativeAssets?: ExperiencePack['decorativeAssets']
  animationProfile?: ExperiencePack['animationProfile']
}

export function fixedDatePack(input: FixedDatePackInput): ExperiencePack {
  const pack: ExperiencePack = {
    id: input.id,
    name: input.name,
    category: input.category,
    enabled: true,
    timezone: 'Asia/Kolkata',
    dateRule: {
      type: 'fixed-date',
      month: input.month,
      day: input.day,
      windowDaysBefore: input.windowDaysBefore ?? 0,
      windowDaysAfter: input.windowDaysAfter ?? 0,
    },
    tokens: input.tokens,
    accentPalette: input.accentPalette,
    greeting: input.greeting,
    decorativeAssets: input.decorativeAssets,
    animationProfile: input.animationProfile,
    accessibility: {
      respectsReducedMotion: true,
      decorativeOnly: true,
      minContrastCompliant: true,
    },
  }
  if (input.respectfulMode) pack.respectfulMode = true
  return pack
}

/**
 * Same authoring convenience as `fixedDatePack()`, but for the
 * `explicit-dates` rule type required by lunar/panchang-based festivals
 * (Diwali, Holi, Navratri, etc.) whose Gregorian date shifts every year.
 * `dates` takes one `'YYYY-MM-DD'` string per year the pack should be
 * active — extending a festival pack to a future year is appending one
 * string to this array, nothing else.
 */
export interface ExplicitDatePackInput {
  id: string
  name: string
  category: PackCategory
  dates: string[]
  windowDaysBefore?: number
  windowDaysAfter?: number
  tokens?: ExperiencePack['tokens']
  accentPalette?: ExperiencePack['accentPalette']
  greeting?: ExperiencePack['greeting']
  decorativeAssets?: ExperiencePack['decorativeAssets']
  animationProfile?: ExperiencePack['animationProfile']
}

export function explicitDatePack(input: ExplicitDatePackInput): ExperiencePack {
  return {
    id: input.id,
    name: input.name,
    category: input.category,
    enabled: true,
    timezone: 'Asia/Kolkata',
    dateRule: {
      type: 'explicit-dates',
      dates: input.dates,
      windowDaysBefore: input.windowDaysBefore ?? 0,
      windowDaysAfter: input.windowDaysAfter ?? 0,
    },
    tokens: input.tokens,
    accentPalette: input.accentPalette,
    greeting: input.greeting,
    decorativeAssets: input.decorativeAssets,
    animationProfile: input.animationProfile,
    accessibility: {
      respectsReducedMotion: true,
      decorativeOnly: true,
      minContrastCompliant: true,
    },
  }
}

/**
 * Authoring convenience for `manual`-rule (Campaign) packs — the one
 * category with no calendar date at all: "the on/off switch IS the
 * schedule" (see `types.ts`'s `ManualRule`). `enabled` defaults to
 * `false` here, deliberately opposite to `fixedDatePack()`/
 * `explicitDatePack()` (which default to `true`): a Campaign is
 * `category: 'campaign'`, priority 1 — the single highest-precedence
 * category in the whole ladder. If a campaign pack shipped `enabled: true`
 * by default, turning the feature flag on would immediately make that
 * campaign the active experience everywhere, unconditionally, overriding
 * every calendar-driven pack. Defaulting to `false` means every campaign
 * in `packs/campaign.ts` is inert until someone deliberately flips it on.
 */
export interface ManualPackInput {
  id: string
  name: string
  enabled?: boolean
  tokens?: ExperiencePack['tokens']
  accentPalette?: ExperiencePack['accentPalette']
  greeting?: ExperiencePack['greeting']
  decorativeAssets?: ExperiencePack['decorativeAssets']
  animationProfile?: ExperiencePack['animationProfile']
}

export function manualPack(input: ManualPackInput): ExperiencePack {
  return {
    id: input.id,
    name: input.name,
    category: 'campaign',
    enabled: input.enabled ?? false,
    timezone: 'Asia/Kolkata',
    dateRule: { type: 'manual' },
    tokens: input.tokens,
    accentPalette: input.accentPalette,
    greeting: input.greeting,
    decorativeAssets: input.decorativeAssets,
    animationProfile: input.animationProfile,
    accessibility: {
      respectsReducedMotion: true,
      decorativeOnly: true,
      minContrastCompliant: true,
    },
  }
}
