/**
 * Rentivo Experience Engine — Type & Configuration Schema
 * ─────────────────────────────────────────────────────────────────────────
 * This file defines the shape of an "Experience Pack" (a themeable moment —
 * a national day, a festival, a season, a remembrance day, or a manual
 * campaign) and the rules the engine uses to decide whether one is active
 * "today".
 *
 * Nothing in this file renders anything or touches the DOM/Tailwind — it is
 * pure data shape. The engine (`engine.ts`) consumes these types; the UI
 * layer (a later phase) will consume the engine's *output*, never these
 * types directly.
 *
 * Adding a new event/season/campaign in the future should only ever require
 * adding one new `ExperiencePack` object to a config source — never editing
 * this file or the engine.
 */

/**
 * The seven-tier priority ladder from the product brief. Lower `PackCategory`
 * in this list = higher precedence. "base" and "default" are not packs at
 * all — they represent existing app behavior (the user's chosen light/dark
 * preference, or the current premium-dark look) and are what the app falls
 * back to when the engine resolves to "no pack active". They exist here
 * only as named constants so the rest of the codebase has one vocabulary.
 */
export const PACK_CATEGORIES = [
  'campaign', // 1. Manual Campaign — highest precedence
  'remembrance', // 2. Remembrance Day
  'national', // 3. National Day
  'festival', // 4. Festival
  'season', // 5. Season — lowest precedence among real packs
] as const

export type PackCategory = (typeof PACK_CATEGORIES)[number]

/** Non-pack fallback tiers, for reference by consumers of the engine's output. */
export const FALLBACK_TIERS = ['base', 'default'] as const
export type FallbackTier = (typeof FALLBACK_TIERS)[number]

/**
 * Default numeric priority per category (lower = wins). A pack may override
 * this via `priorityOverride` for rare cases (e.g. two campaigns that must
 * never overlap in time anyway, but want an explicit tie-break).
 */
export const CATEGORY_PRIORITY: Record<PackCategory, number> = {
  campaign: 1,
  remembrance: 2,
  national: 3,
  festival: 4,
  season: 5,
}

// ───────────────────────────────────────────────────────────────────────
// Date / activation rules
// ───────────────────────────────────────────────────────────────────────

/**
 * Recurs every year on the same Gregorian month/day (safe for national and
 * remembrance days, which are fixed-date by law/convention). `windowDays`
 * optionally extends activation to N days before/after the exact date
 * (e.g. a 2-day Independence Day ramp-up), defaulting to the exact day only.
 */
export interface FixedDateRule {
  type: 'fixed-date'
  /** 1–12 */
  month: number
  /** 1–31 */
  day: number
  windowDaysBefore?: number
  windowDaysAfter?: number
}

/**
 * An explicit list of ISO dates ('YYYY-MM-DD'), one per year the pack should
 * be active. Required for lunar/panchang-based festivals (Diwali, Holi,
 * Eid-adjacent, etc.) whose Gregorian date shifts annually and cannot be
 * safely computed with a fixed rule. Extending a festival to future years
 * is purely a config edit — add more dates to this array.
 */
export interface ExplicitDatesRule {
  type: 'explicit-dates'
  /** 'YYYY-MM-DD', one entry per occurrence (add a new one each year). */
  dates: string[]
  windowDaysBefore?: number
  windowDaysAfter?: number
}

/**
 * A recurring month/day range for seasonal packs. Supports wrap-around
 * (e.g. Winter: start 12-01, end 02-28).
 */
export interface DateRangeRule {
  type: 'date-range'
  /** 'MM-DD' */
  start: string
  /** 'MM-DD' */
  end: string
}

/**
 * A precise, one-off (non-recurring) datetime window. Used for manual
 * campaigns ("Offer Week", "Pizza Night") that run once between two exact
 * timestamps rather than recurring annually.
 */
export interface DateTimeRangeRule {
  type: 'datetime-range'
  /** ISO 8601 datetime */
  start: string
  /** ISO 8601 datetime */
  end: string
}

/**
 * Always-evaluates-true while `enabled: true` on the pack itself. Intended
 * for manual campaigns an owner/admin toggles on/off directly rather than
 * scheduling — the on/off switch IS the schedule.
 */
export interface ManualRule {
  type: 'manual'
}

export type DateRule =
  | FixedDateRule
  | ExplicitDatesRule
  | DateRangeRule
  | DateTimeRangeRule
  | ManualRule

// ───────────────────────────────────────────────────────────────────────
// Experience Pack
// ───────────────────────────────────────────────────────────────────────

/**
 * Token overrides a pack may contribute once the engine is wired to the UI
 * (Phase 2+). Deliberately loose (`Record<string,string>`) at the schema
 * level — Phase 1 only needs the shape to exist for forward-compatibility;
 * validating specific token keys against `experience-tokens.css` is a later
 * phase's concern. Left empty/omitted, a pack contributes no visual change.
 */
export type ExperienceTokenOverrides = Record<string, string>

/**
 * A small set of semantic accent colors a pack contributes, as raw HSL
 * triplets ("H S% L%") — the same convention already used throughout
 * `tenant-theme.css` / `owner-theme.css` (`hsl(var(--x))`). This is
 * intentionally a *narrower*, more curated surface than `tokens` (which
 * can override any CSS variable): `accentPalette` is the handful of colors
 * a future renderer is expected to actually use (primary accent, a
 * secondary/complementary tone, a soft glow color for shadows/highlights).
 * Category-agnostic — a festival, a national day, or a campaign pack uses
 * exactly the same shape.
 */
export interface AccentPalette {
  primary?: string
  secondary?: string
  glow?: string
}

/**
 * A short greeting/copy set a pack may contribute for a future dashboard
 * greeting component to render verbatim. Optional time-of-day variants;
 * a renderer with no time-of-day logic can always fall back to `default`.
 * Category-agnostic.
 */
export interface GreetingConfig {
  default: string
  morning?: string
  afternoon?: string
  evening?: string
  night?: string
}

/**
 * A placeholder reference to a decorative asset (illustration, particle
 * sprite, icon, background pattern). `ref` is just a string identifier/path
 * — Phase 3 packs use placeholder paths; resolving them to real files is a
 * later, UI-side concern. Category-agnostic.
 */
export interface DecorativeAssetRef {
  type: 'illustration' | 'particle' | 'icon' | 'pattern'
  ref: string
  alt?: string
}

/**
 * Describes how (or whether) a pack's decoration may animate. `style` is a
 * free-form string on purpose — the engine never branches on its value;
 * only a future renderer interprets it. The two boolean flags encode this
 * project's non-negotiable performance/accessibility rules and are
 * enforced generically for every category by `validatePack()` below —
 * this is a schema-level rule, not season-specific logic.
 */
export interface AnimationProfile {
  enabled: boolean
  style?: string
  intensity?: 'subtle' | 'moderate'
  /** Must be true — decoration must be implementable with transform/opacity only, never layout-triggering properties. */
  gpuFriendly: boolean
  /** Must be true — decoration must fully honor `prefers-reduced-motion`. */
  respectsReducedMotion: boolean
}

/**
 * Accessibility constraints a pack's decoration must satisfy. Also
 * category-agnostic and validated generically.
 */
export interface AccessibilityOptions {
  respectsReducedMotion: boolean
  /** Decoration must never be the sole carrier of meaning/information — purely aesthetic. */
  decorativeOnly: boolean
  minContrastCompliant?: boolean
}

export interface ExperiencePack {
  /** Stable, unique, kebab-case id. Never reused across packs. */
  id: string
  /** Human-readable name, e.g. "Independence Day". */
  name: string
  category: PackCategory
  /** Master per-pack switch — disabled packs are never considered active, regardless of date. */
  enabled: boolean
  dateRule: DateRule
  /**
   * Remembrance-only constraint from the product brief: respectful themes
   * must never carry celebratory decoration (confetti, particles, etc.).
   * The engine does not enforce this by itself (it has no opinion on
   * decorations), but any pack in the `remembrance` category MUST set this
   * to `true` — validated by `validatePack()` below.
   */
  respectfulMode?: boolean
  /** Optional priority override; defaults to `CATEGORY_PRIORITY[category]` when omitted. */
  priorityOverride?: number
  /** IANA timezone the pack's dates are evaluated in. Defaults to 'Asia/Kolkata'. */
  timezone?: string
  tokens?: ExperienceTokenOverrides
  accentPalette?: AccentPalette
  greeting?: GreetingConfig
  decorativeAssets?: DecorativeAssetRef[]
  animationProfile?: AnimationProfile
  accessibility?: AccessibilityOptions
  /** Free-form metadata for anything not covered above. Untyped on purpose. */
  meta?: Record<string, unknown>
}

/**
 * Lightweight structural + business-rule validation for a single pack.
 * Returns a list of human-readable problems; empty array = valid. Used by
 * the engine defensively (a malformed remote-config pack should be skipped,
 * not crash the app) and by tests.
 */
export function validatePack(pack: ExperiencePack): string[] {
  const problems: string[] = []

  if (!pack.id || typeof pack.id !== 'string') problems.push('id is required')
  if (!pack.name || typeof pack.name !== 'string') problems.push('name is required')
  if (!PACK_CATEGORIES.includes(pack.category)) {
    problems.push(`category "${pack.category}" is not a recognized PackCategory`)
  }
  if (typeof pack.enabled !== 'boolean') problems.push('enabled must be a boolean')

  if (pack.category === 'remembrance' && pack.respectfulMode !== true) {
    problems.push('remembrance-category packs must set respectfulMode: true')
  }

  // Generic performance/accessibility rules — apply to every category
  // identically, never special-cased per season/festival/etc.
  if (pack.animationProfile) {
    if (pack.animationProfile.gpuFriendly !== true) {
      problems.push('animationProfile.gpuFriendly must be true (transform/opacity-only decoration)')
    }
    if (pack.animationProfile.respectsReducedMotion !== true) {
      problems.push('animationProfile.respectsReducedMotion must be true')
    }
  }
  if (pack.accessibility && pack.accessibility.respectsReducedMotion !== true) {
    problems.push('accessibility.respectsReducedMotion must be true')
  }
  if (pack.accessibility && pack.accessibility.decorativeOnly !== true) {
    problems.push('accessibility.decorativeOnly must be true — decoration must never be the sole carrier of meaning')
  }

  const rule = pack.dateRule
  if (!rule || typeof rule !== 'object') {
    problems.push('dateRule is required')
  } else {
    switch (rule.type) {
      case 'fixed-date':
        if (rule.month < 1 || rule.month > 12) problems.push('dateRule.month must be 1–12')
        if (rule.day < 1 || rule.day > 31) problems.push('dateRule.day must be 1–31')
        break
      case 'explicit-dates':
        if (!Array.isArray(rule.dates) || rule.dates.length === 0) {
          problems.push('dateRule.dates must be a non-empty array')
        }
        break
      case 'date-range':
        if (!/^\d{2}-\d{2}$/.test(rule.start) || !/^\d{2}-\d{2}$/.test(rule.end)) {
          problems.push('dateRule.start/end must be "MM-DD"')
        }
        break
      case 'datetime-range':
        if (Number.isNaN(Date.parse(rule.start)) || Number.isNaN(Date.parse(rule.end))) {
          problems.push('dateRule.start/end must be valid ISO datetimes')
        }
        break
      case 'manual':
        break
      default:
        problems.push(`dateRule.type "${(rule as { type?: string }).type}" is not recognized`)
    }
  }

  return problems
}
