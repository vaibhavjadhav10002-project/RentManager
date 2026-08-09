/**
 * Rentivo Experience Engine — Seasonal Packs (Phase 3)
 * ─────────────────────────────────────────────────────────────────────────
 * Four pure, immutable `ExperiencePack` configuration objects — no engine
 * code anywhere in this module, no season-specific branching anywhere in
 * the engine either. Each object below is just data; `dateResolver.ts`
 * evaluates the same `date-range` rule type for all four, and any future
 * Festival/National/Remembrance/Campaign pack will be consumed through the
 * exact same schema with zero changes to `engine.ts`.
 *
 * Date ranges (recurring `MM-DD`, IST, matching the Indian seasonal
 * calendar this product targets) are contiguous and non-overlapping,
 * covering the full year exactly once, so there is always exactly one
 * seasonal pack date-eligible on any given day — which of the four
 * "wins" beyond that is irrelevant, since only one is ever active at a
 * time by construction:
 *
 *   Winter   Oct 01 – Feb 14  (wraps the year boundary)
 *   Spring   Feb 15 – Mar 31
 *   Summer   Apr 01 – Jun 15
 *   Monsoon  Jun 16 – Sep 30
 *
 * All four share `category: 'season'` (priority 5 — the lowest of the
 * five real categories), so any active Campaign/Remembrance/National/
 * Festival pack always outranks a seasonal one, per the product brief's
 * priority ladder. That precedence is enforced by `priorityResolver.ts`,
 * not by anything in this file.
 *
 * `accentPalette` values follow the existing project convention of raw
 * HSL triplets ("H S% L%"), the same format already used throughout
 * `tenant-theme.css` / `owner-theme.css`. `decorativeAssets` use
 * placeholder paths — no actual asset files are created this phase, per
 * the brief ("placeholder references are fine"). `animationProfile` and
 * `accessibility` on every pack below satisfy the schema-level rules
 * `validatePack()` enforces generically (GPU-friendly, reduced-motion
 * respecting, decorative-only) — nothing season-specific about that
 * enforcement.
 */

import type { ExperiencePack } from '../types'

export const springPack: ExperiencePack = {
  id: 'season-spring',
  name: 'Spring',
  category: 'season',
  enabled: true,
  dateRule: { type: 'date-range', start: '02-15', end: '03-31' },
  timezone: 'Asia/Kolkata',
  tokens: {
    'season-accent': '150 55% 45%',
    'season-accent-glow': '150 60% 60%',
  },
  accentPalette: {
    primary: '150 55% 45%',
    secondary: '95 45% 55%',
    glow: '150 60% 68%',
  },
  greeting: {
    default: 'Fresh season, fresh start.',
    morning: 'A bright spring morning ahead.',
  },
  decorativeAssets: [
    { type: 'illustration', ref: '/experience/seasonal/spring-blossom.svg', alt: 'Blossoming branch illustration' },
    { type: 'particle', ref: '/experience/seasonal/spring-petals.json', alt: 'Drifting petal particles' },
  ],
  animationProfile: {
    enabled: true,
    style: 'drift',
    intensity: 'subtle',
    gpuFriendly: true,
    respectsReducedMotion: true,
  },
  accessibility: {
    respectsReducedMotion: true,
    decorativeOnly: true,
    minContrastCompliant: true,
  },
}

export const summerPack: ExperiencePack = {
  id: 'season-summer',
  name: 'Summer',
  category: 'season',
  enabled: true,
  dateRule: { type: 'date-range', start: '04-01', end: '06-15' },
  timezone: 'Asia/Kolkata',
  tokens: {
    'season-accent': '38 92% 55%',
    'season-accent-glow': '45 95% 65%',
  },
  accentPalette: {
    primary: '38 92% 55%',
    secondary: '199 85% 55%',
    glow: '45 95% 70%',
  },
  greeting: {
    default: 'Sunny days, steady rent days.',
    afternoon: 'Peak summer — stay cool.',
  },
  decorativeAssets: [
    { type: 'illustration', ref: '/experience/seasonal/summer-sun.svg', alt: 'Stylized sun illustration' },
    { type: 'pattern', ref: '/experience/seasonal/summer-shimmer.svg', alt: 'Soft heat-shimmer background pattern' },
  ],
  animationProfile: {
    enabled: true,
    style: 'shimmer',
    intensity: 'subtle',
    gpuFriendly: true,
    respectsReducedMotion: true,
  },
  accessibility: {
    respectsReducedMotion: true,
    decorativeOnly: true,
    minContrastCompliant: true,
  },
}

export const monsoonPack: ExperiencePack = {
  id: 'season-monsoon',
  name: 'Monsoon',
  category: 'season',
  enabled: true,
  dateRule: { type: 'date-range', start: '06-16', end: '09-30' },
  timezone: 'Asia/Kolkata',
  tokens: {
    'season-accent': '199 75% 50%',
    'season-accent-glow': '199 70% 62%',
  },
  accentPalette: {
    primary: '199 75% 50%',
    secondary: '210 30% 55%',
    glow: '199 70% 66%',
  },
  greeting: {
    default: 'Rainy days ahead — stay dry.',
    evening: 'Monsoon evening — cozy in.',
  },
  decorativeAssets: [
    { type: 'illustration', ref: '/experience/seasonal/monsoon-cloud.svg', alt: 'Rain cloud illustration' },
    { type: 'particle', ref: '/experience/seasonal/monsoon-rain.json', alt: 'Gentle falling-rain particles' },
  ],
  animationProfile: {
    enabled: true,
    style: 'rain',
    intensity: 'subtle',
    gpuFriendly: true,
    respectsReducedMotion: true,
  },
  accessibility: {
    respectsReducedMotion: true,
    decorativeOnly: true,
    minContrastCompliant: true,
  },
}

export const winterPack: ExperiencePack = {
  id: 'season-winter',
  name: 'Winter',
  category: 'season',
  enabled: true,
  // Wraps the year boundary (Oct → Feb) — exercised explicitly by the
  // date-resolver tests in Phase 1/2 for this exact rule shape.
  dateRule: { type: 'date-range', start: '10-01', end: '02-14' },
  timezone: 'Asia/Kolkata',
  tokens: {
    'season-accent': '243 75% 61%',
    'season-accent-glow': '243 78% 72%',
  },
  accentPalette: {
    primary: '243 75% 61%',
    secondary: '271 81% 68%',
    glow: '243 78% 74%',
  },
  greeting: {
    default: 'Winter is here — stay warm.',
    night: 'A quiet winter night.',
  },
  decorativeAssets: [
    { type: 'illustration', ref: '/experience/seasonal/winter-frost.svg', alt: 'Frost-edge illustration' },
    { type: 'particle', ref: '/experience/seasonal/winter-sparkle.json', alt: 'Subtle sparkle particles' },
  ],
  animationProfile: {
    enabled: true,
    style: 'twinkle',
    intensity: 'subtle',
    gpuFriendly: true,
    respectsReducedMotion: true,
  },
  accessibility: {
    respectsReducedMotion: true,
    decorativeOnly: true,
    minContrastCompliant: true,
  },
}

export const seasonalPacks: ExperiencePack[] = [springPack, summerPack, monsoonPack, winterPack]
