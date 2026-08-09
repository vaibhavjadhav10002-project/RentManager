/**
 * Rentivo Experience Engine — Campaign Packs (Phase 6)
 * ─────────────────────────────────────────────────────────────────────────
 * All 11 Campaign packs from the product brief. `category: 'campaign'`,
 * priority 1 — the single highest-precedence tier in the whole ladder.
 * Every pack uses `dateRule: { type: 'manual' }` via `manualPack()`: there
 * is no calendar date to derive activation from (unlike every prior
 * phase's packs) — a campaign runs when whoever manages the config
 * (currently: hand-editing this file; later: an Admin Panel) sets
 * `enabled: true`, and stops the moment it's set back to `false`.
 *
 * ⚠️ EVERY PACK BELOW SHIPS WITH `enabled: false`. This is deliberate and
 * important, not an oversight: because Campaign outranks every other
 * category, an `enabled: true` campaign is unconditionally the active
 * experience the instant the feature flag is on — it doesn't compete on
 * a date, it just wins. Shipping any of these pre-enabled would mean
 * turning the master flag on turns this campaign on everywhere,
 * immediately, for everyone. `manualPack()` defaults `enabled` to `false`
 * for exactly this reason (see `helpers.ts`).
 *
 * Two of these — Cricket Fever and Cinema Week — are intentionally
 * generic and copyright-safe per the brief: no team names/logos, no
 * movie titles/studio branding. Content (`greeting`, `decorativeAssets`)
 * below stays deliberately generic for both.
 *
 * "Only ONE Experience Pack may be active at a time" still holds even
 * within this file: if an editor enables two campaigns simultaneously,
 * `priorityResolver.ts`'s deterministic id tie-break (unmodified since
 * Phase 1) picks exactly one — it does not merge them. Editors should
 * still treat "one active campaign at a time" as an operating discipline,
 * since nothing here prevents enabling two, and it's not asserted to be
 * an error case that Phase 6 need be tested against.
 */

import { manualPack } from './helpers'
import type { ExperiencePack } from '../types'

/** Confident blue/gold — admissions, onboarding, growth campaigns. */
const GROWTH_ACCENT = { primary: '215 70% 45%', secondary: '43 80% 52%', glow: '215 65% 62%' }
/** Warm coral/orange — social/community campaigns. */
const COMMUNITY_ACCENT = { primary: '14 80% 55%', secondary: '43 80% 55%', glow: '14 75% 68%' }
/** Fresh green — generic sport/energy campaign (no team branding). */
const SPORT_ACCENT = { primary: '145 55% 42%', secondary: '43 75% 52%', glow: '145 50% 58%' }
/** Deep plum — generic entertainment campaign (no studio/film branding). */
const ENTERTAINMENT_ACCENT = { primary: '270 45% 42%', secondary: '43 70% 52%', glow: '270 40% 58%' }
/** Warm red/gold — food-themed campaign. */
const FOOD_ACCENT = { primary: '5 70% 50%', secondary: '43 85% 55%', glow: '5 65% 65%' }
/** Rich gold — anniversary/celebration campaigns. */
const CELEBRATION_ACCENT = { primary: '43 75% 48%', secondary: '30 60% 42%', glow: '43 80% 65%' }
/** Confident amber — limited-time offer/urgency campaigns. */
const OFFER_ACCENT = { primary: '30 85% 50%', secondary: '5 70% 48%', glow: '30 80% 65%' }

export const campaignPacks: ExperiencePack[] = [
  manualPack({
    id: 'campaign-admission-open',
    name: 'Admission Open',
    accentPalette: GROWTH_ACCENT,
    greeting: { default: 'Admissions are open — book your room today.' },
    decorativeAssets: [{ type: 'illustration', ref: '/experience/campaign/admission-open.svg' }],
    animationProfile: { enabled: true, style: 'glow', intensity: 'subtle', gpuFriendly: true, respectsReducedMotion: true },
  }),
  manualPack({
    id: 'campaign-limited-rooms',
    name: 'Limited Rooms Available',
    accentPalette: OFFER_ACCENT,
    greeting: { default: 'Limited rooms available — enquire soon.' },
    decorativeAssets: [{ type: 'illustration', ref: '/experience/campaign/limited-rooms.svg' }],
    animationProfile: { enabled: true, style: 'glow', intensity: 'subtle', gpuFriendly: true, respectsReducedMotion: true },
  }),
  manualPack({
    id: 'campaign-freshers-welcome',
    name: 'Freshers Welcome',
    accentPalette: GROWTH_ACCENT,
    greeting: { default: 'Welcome, freshers — glad to have you here.' },
    decorativeAssets: [{ type: 'illustration', ref: '/experience/campaign/freshers-welcome.svg' }],
    animationProfile: { enabled: true, style: 'glow', intensity: 'subtle', gpuFriendly: true, respectsReducedMotion: true },
  }),
  manualPack({
    id: 'campaign-refer-and-earn',
    name: 'Refer & Earn',
    accentPalette: COMMUNITY_ACCENT,
    greeting: { default: 'Refer a friend and earn rewards.' },
    decorativeAssets: [{ type: 'illustration', ref: '/experience/campaign/refer-and-earn.svg' }],
    animationProfile: { enabled: true, style: 'glow', intensity: 'subtle', gpuFriendly: true, respectsReducedMotion: true },
  }),
  manualPack({
    id: 'campaign-cricket-fever',
    name: 'Cricket Fever',
    // Generic only — no team names, logos, or league branding.
    accentPalette: SPORT_ACCENT,
    greeting: { default: 'Cricket season is here — catch every match.' },
    decorativeAssets: [{ type: 'illustration', ref: '/experience/campaign/cricket-fever.svg' }],
    animationProfile: { enabled: true, style: 'glow', intensity: 'subtle', gpuFriendly: true, respectsReducedMotion: true },
  }),
  manualPack({
    id: 'campaign-cinema-week',
    name: 'Cinema Week',
    // Copyright-safe — no movie titles, posters, or studio branding.
    accentPalette: ENTERTAINMENT_ACCENT,
    greeting: { default: 'Movie night, every night, this week.' },
    decorativeAssets: [{ type: 'illustration', ref: '/experience/campaign/cinema-week.svg' }],
    animationProfile: { enabled: true, style: 'glow', intensity: 'subtle', gpuFriendly: true, respectsReducedMotion: true },
  }),
  manualPack({
    id: 'campaign-pizza-night',
    name: 'Pizza Night',
    accentPalette: FOOD_ACCENT,
    greeting: { default: "It's pizza night." },
    decorativeAssets: [{ type: 'illustration', ref: '/experience/campaign/pizza-night.svg' }],
    animationProfile: { enabled: true, style: 'glow', intensity: 'subtle', gpuFriendly: true, respectsReducedMotion: true },
  }),
  manualPack({
    id: 'campaign-weekend-event',
    name: 'Weekend Event',
    accentPalette: COMMUNITY_ACCENT,
    greeting: { default: "There's something on this weekend." },
    decorativeAssets: [{ type: 'illustration', ref: '/experience/campaign/weekend-event.svg' }],
    animationProfile: { enabled: true, style: 'glow', intensity: 'subtle', gpuFriendly: true, respectsReducedMotion: true },
  }),
  manualPack({
    id: 'campaign-anniversary',
    name: 'Anniversary',
    // No specific date is known for any given property's anniversary —
    // deliberately left as a pure manual toggle rather than guessing a
    // date, exactly what `manual` rules exist for.
    accentPalette: CELEBRATION_ACCENT,
    greeting: { default: "Celebrating another year — thank you for being with us." },
    decorativeAssets: [
      { type: 'illustration', ref: '/experience/campaign/anniversary.svg' },
      { type: 'particle', ref: '/experience/campaign/anniversary-confetti.json' },
    ],
    animationProfile: { enabled: true, style: 'burst', intensity: 'subtle', gpuFriendly: true, respectsReducedMotion: true },
  }),
  manualPack({
    id: 'campaign-offer-week',
    name: 'Offer Week',
    accentPalette: OFFER_ACCENT,
    greeting: { default: 'Offer week is on — check the details.' },
    decorativeAssets: [{ type: 'illustration', ref: '/experience/campaign/offer-week.svg' }],
    animationProfile: { enabled: true, style: 'glow', intensity: 'subtle', gpuFriendly: true, respectsReducedMotion: true },
  }),
  manualPack({
    id: 'campaign-new-facility-launch',
    name: 'New Facility Launch',
    accentPalette: GROWTH_ACCENT,
    greeting: { default: "There's something new here — take a look." },
    decorativeAssets: [{ type: 'illustration', ref: '/experience/campaign/new-facility-launch.svg' }],
    animationProfile: { enabled: true, style: 'glow', intensity: 'subtle', gpuFriendly: true, respectsReducedMotion: true },
  }),
]
