/**
 * Rentivo Experience Engine — Remembrance Day Packs (Phase 4)
 * ─────────────────────────────────────────────────────────────────────────
 * All 6 Remembrance Day packs from the product brief. Every entry sets
 * `respectfulMode: true` — required by `validatePack()` for every
 * `remembrance`-category pack since Phase 1; a pack missing it fails
 * validation and is skipped by the engine, not rendered.
 *
 * "No celebration animations. No confetti. No flashy effects." from the
 * brief is expressed structurally, not by convention:
 *   - `animationProfile` is omitted entirely on every pack below — there
 *     is no animation to enable or disable.
 *   - `decorativeAssets` use only `'illustration'` (a single static image),
 *     never `'particle'` — no bursts, no floating/falling effects.
 *   - `accentPalette`/`tokens` use muted, low-saturation tones — no bright
 *     festival colors.
 * None of this is enforced by the engine (which has no opinion on
 * decoration) — it's a content discipline applied consistently across
 * every pack in this file, the same way it will need to be applied to any
 * future remembrance pack a content editor adds.
 */

import { fixedDatePack } from './helpers'
import type { ExperiencePack } from '../types'

/** Muted, respectful accent — deliberately low-saturation, no bright/celebratory hues. */
const REMEMBRANCE_ACCENT = { primary: '220 15% 38%', secondary: '0 25% 35%', glow: '220 15% 55%' }

export const remembrancePacks: ExperiencePack[] = [
  fixedDatePack({
    id: 'remembrance-netaji-bose-jayanti',
    name: 'Netaji Subhas Chandra Bose Jayanti',
    category: 'remembrance',
    month: 1,
    day: 23,
    respectfulMode: true,
    accentPalette: REMEMBRANCE_ACCENT,
    greeting: { default: 'Remembering Netaji Subhas Chandra Bose today.' },
    decorativeAssets: [{ type: 'illustration', ref: '/experience/remembrance/netaji-bose-jayanti.svg' }],
  }),
  fixedDatePack({
    id: 'remembrance-pulwama',
    name: 'Pulwama Remembrance Day',
    category: 'remembrance',
    month: 2,
    day: 14,
    respectfulMode: true,
    accentPalette: REMEMBRANCE_ACCENT,
    greeting: { default: 'In memory of the Pulwama martyrs.' },
    decorativeAssets: [{ type: 'illustration', ref: '/experience/remembrance/pulwama.svg' }],
  }),
  fixedDatePack({
    id: 'remembrance-bhagat-singh-rajguru-sukhdev',
    name: 'Bhagat Singh, Rajguru & Sukhdev Martyrdom Day',
    category: 'remembrance',
    month: 3,
    day: 23,
    respectfulMode: true,
    accentPalette: REMEMBRANCE_ACCENT,
    greeting: { default: 'Remembering Bhagat Singh, Rajguru and Sukhdev today.' },
    decorativeAssets: [{ type: 'illustration', ref: '/experience/remembrance/bhagat-singh-rajguru-sukhdev.svg' }],
  }),
  fixedDatePack({
    id: 'remembrance-ambedkar-jayanti',
    name: 'Dr. B. R. Ambedkar Jayanti',
    category: 'remembrance',
    month: 4,
    day: 14,
    respectfulMode: true,
    accentPalette: REMEMBRANCE_ACCENT,
    greeting: { default: 'Remembering Dr. B. R. Ambedkar today.' },
    decorativeAssets: [{ type: 'illustration', ref: '/experience/remembrance/ambedkar-jayanti.svg' }],
  }),
  // Same calendar day as national-gandhi-jayanti (Oct 2) — intentional; the
  // priority resolver picks this pack (remembrance outranks national), per
  // the product brief's ladder. No special-case code makes that happen.
  fixedDatePack({
    id: 'remembrance-lal-bahadur-shastri-jayanti',
    name: 'Lal Bahadur Shastri Jayanti',
    category: 'remembrance',
    month: 10,
    day: 2,
    respectfulMode: true,
    accentPalette: REMEMBRANCE_ACCENT,
    greeting: { default: 'Remembering Lal Bahadur Shastri today.' },
    decorativeAssets: [{ type: 'illustration', ref: '/experience/remembrance/lal-bahadur-shastri-jayanti.svg' }],
  }),
  // Same calendar day as national-constitution-day (Nov 26) — intentional,
  // same reasoning as above.
  fixedDatePack({
    id: 'remembrance-2611-mumbai',
    name: '26/11 Mumbai Terror Attack Remembrance',
    category: 'remembrance',
    month: 11,
    day: 26,
    respectfulMode: true,
    accentPalette: REMEMBRANCE_ACCENT,
    greeting: { default: 'In memory of the victims of the 26/11 attacks.' },
    decorativeAssets: [{ type: 'illustration', ref: '/experience/remembrance/26-11-mumbai.svg' }],
  }),
]
