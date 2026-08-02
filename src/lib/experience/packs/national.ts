/**
 * Rentivo Experience Engine — National Day Packs (Phase 4)
 * ─────────────────────────────────────────────────────────────────────────
 * All 21 National Day packs from the product brief. Every entry is a pure,
 * immutable `ExperiencePack` (`category: 'national'`, priority 3) built via
 * `fixedDatePack()` — no engine file knows any of these ids, names, or
 * dates exist. Two days (Independence Day, Republic Day) get a 1-day
 * pre-window ramp-up as ordinary per-pack config; every other day is exact
 * (`windowDaysBefore/After: 0`). All animation is `intensity: 'subtle'`
 * and GPU-friendly (transform/opacity only), reduced-motion respecting,
 * decorative-only — enforced generically by `validatePack()`, not
 * hardcoded here beyond satisfying that generic contract.
 *
 * Two intentional same-day collisions with Phase 4's own Remembrance packs
 * exist here on purpose (Lal Bahadur Shastri Jayanti / Gandhi Jayanti both
 * on Oct 2; 26/11 Remembrance / Constitution Day both on Nov 26) — real
 * calendar facts, not a bug. `priorityResolver.ts` resolves both correctly
 * in favor of the Remembrance pack, per the product brief's priority
 * ladder, with zero special-case code anywhere.
 */

import { fixedDatePack } from './helpers'
import type { ExperiencePack } from '../types'

/** Muted tricolor-inspired palette shared by the highest-profile civic days. */
const TRICOLOR_ACCENT = { primary: '24 85% 52%', secondary: '135 45% 35%', glow: '220 70% 45%' }
/** Warm gold, for days celebrating achievement/technology/knowledge. */
const GOLD_ACCENT = { primary: '43 85% 52%', secondary: '38 70% 45%', glow: '45 90% 65%' }
/** Deep navy, for the armed-forces days. */
const NAVY_ACCENT = { primary: '215 60% 32%', secondary: '210 40% 45%', glow: '215 55% 55%' }

export const nationalPacks: ExperiencePack[] = [
  fixedDatePack({
    id: 'national-new-year',
    name: "New Year",
    category: 'national',
    month: 1,
    day: 1,
    accentPalette: GOLD_ACCENT,
    greeting: { default: 'Happy New Year — here\u2019s to a great year ahead.' },
    decorativeAssets: [{ type: 'illustration', ref: '/experience/national/new-year.svg' }],
    animationProfile: { enabled: true, style: 'glow', intensity: 'subtle', gpuFriendly: true, respectsReducedMotion: true },
  }),
  fixedDatePack({
    id: 'national-army-day',
    name: 'Army Day',
    category: 'national',
    month: 1,
    day: 15,
    accentPalette: NAVY_ACCENT,
    greeting: { default: 'Honouring the Indian Army today.' },
    decorativeAssets: [{ type: 'illustration', ref: '/experience/national/army-day.svg' }],
    animationProfile: { enabled: true, style: 'glow', intensity: 'subtle', gpuFriendly: true, respectsReducedMotion: true },
  }),
  fixedDatePack({
    id: 'national-youth-day',
    name: 'National Youth Day',
    category: 'national',
    month: 1,
    day: 12,
    accentPalette: GOLD_ACCENT,
    greeting: { default: 'Celebrating the energy of India\u2019s youth.' },
    decorativeAssets: [{ type: 'illustration', ref: '/experience/national/youth-day.svg' }],
    animationProfile: { enabled: true, style: 'glow', intensity: 'subtle', gpuFriendly: true, respectsReducedMotion: true },
  }),
  fixedDatePack({
    id: 'national-republic-day',
    name: 'Republic Day',
    category: 'national',
    month: 1,
    day: 26,
    windowDaysBefore: 1,
    accentPalette: TRICOLOR_ACCENT,
    greeting: { default: 'Happy Republic Day.', morning: 'A proud Republic Day morning.' },
    decorativeAssets: [
      { type: 'illustration', ref: '/experience/national/republic-day.svg' },
      { type: 'particle', ref: '/experience/national/republic-day-tricolor.json' },
    ],
    animationProfile: { enabled: true, style: 'glow', intensity: 'subtle', gpuFriendly: true, respectsReducedMotion: true },
  }),
  fixedDatePack({
    id: 'national-martyrs-day',
    name: "Martyrs' Day",
    category: 'national',
    month: 1,
    day: 30,
    accentPalette: { primary: '220 15% 40%', secondary: '220 10% 55%', glow: '220 20% 60%' },
    greeting: { default: 'A day of remembrance for the nation\u2019s martyrs.' },
    decorativeAssets: [{ type: 'illustration', ref: '/experience/national/martyrs-day.svg' }],
  }),
  fixedDatePack({
    id: 'national-maharashtra-day',
    name: 'Maharashtra Day',
    category: 'national',
    month: 5,
    day: 1,
    accentPalette: TRICOLOR_ACCENT,
    greeting: { default: 'Happy Maharashtra Day.' },
    decorativeAssets: [{ type: 'illustration', ref: '/experience/national/maharashtra-day.svg' }],
    animationProfile: { enabled: true, style: 'glow', intensity: 'subtle', gpuFriendly: true, respectsReducedMotion: true },
  }),
  fixedDatePack({
    id: 'national-technology-day',
    name: 'National Technology Day',
    category: 'national',
    month: 5,
    day: 11,
    accentPalette: GOLD_ACCENT,
    greeting: { default: 'Celebrating Indian innovation today.' },
    decorativeAssets: [{ type: 'illustration', ref: '/experience/national/technology-day.svg' }],
    animationProfile: { enabled: true, style: 'glow', intensity: 'subtle', gpuFriendly: true, respectsReducedMotion: true },
  }),
  fixedDatePack({
    id: 'national-yoga-day',
    name: 'International Yoga Day',
    category: 'national',
    month: 6,
    day: 21,
    accentPalette: { primary: '150 45% 45%', secondary: '175 40% 50%', glow: '150 50% 65%' },
    greeting: { default: 'Happy International Yoga Day.' },
    decorativeAssets: [{ type: 'illustration', ref: '/experience/national/yoga-day.svg' }],
    animationProfile: { enabled: true, style: 'glow', intensity: 'subtle', gpuFriendly: true, respectsReducedMotion: true },
  }),
  fixedDatePack({
    id: 'national-kargil-vijay-diwas',
    name: 'Kargil Vijay Diwas',
    category: 'national',
    month: 7,
    day: 26,
    accentPalette: NAVY_ACCENT,
    greeting: { default: 'Honouring the heroes of Kargil.' },
    decorativeAssets: [{ type: 'illustration', ref: '/experience/national/kargil-vijay-diwas.svg' }],
    animationProfile: { enabled: true, style: 'glow', intensity: 'subtle', gpuFriendly: true, respectsReducedMotion: true },
  }),
  fixedDatePack({
    id: 'national-independence-day',
    name: 'Independence Day',
    category: 'national',
    month: 8,
    day: 15,
    windowDaysBefore: 1,
    accentPalette: TRICOLOR_ACCENT,
    greeting: { default: 'Happy Independence Day.', morning: 'A proud Independence Day morning.' },
    decorativeAssets: [
      { type: 'illustration', ref: '/experience/national/independence-day.svg' },
      { type: 'particle', ref: '/experience/national/independence-day-tricolor.json' },
    ],
    animationProfile: { enabled: true, style: 'glow', intensity: 'subtle', gpuFriendly: true, respectsReducedMotion: true },
  }),
  fixedDatePack({
    id: 'national-teachers-day',
    name: "Teacher's Day",
    category: 'national',
    month: 9,
    day: 5,
    accentPalette: GOLD_ACCENT,
    greeting: { default: 'Happy Teacher\u2019s Day.' },
    decorativeAssets: [{ type: 'illustration', ref: '/experience/national/teachers-day.svg' }],
    animationProfile: { enabled: true, style: 'glow', intensity: 'subtle', gpuFriendly: true, respectsReducedMotion: true },
  }),
  fixedDatePack({
    id: 'national-hindi-diwas',
    name: 'Hindi Diwas',
    category: 'national',
    month: 9,
    day: 14,
    accentPalette: TRICOLOR_ACCENT,
    greeting: { default: 'Happy Hindi Diwas.' },
    decorativeAssets: [{ type: 'illustration', ref: '/experience/national/hindi-diwas.svg' }],
    animationProfile: { enabled: true, style: 'glow', intensity: 'subtle', gpuFriendly: true, respectsReducedMotion: true },
  }),
  fixedDatePack({
    id: 'national-gandhi-jayanti',
    name: 'Gandhi Jayanti',
    category: 'national',
    month: 10,
    day: 2,
    accentPalette: { primary: '220 15% 40%', secondary: '43 70% 50%', glow: '220 20% 60%' },
    greeting: { default: 'Remembering Mahatma Gandhi today.' },
    decorativeAssets: [{ type: 'illustration', ref: '/experience/national/gandhi-jayanti.svg' }],
  }),
  fixedDatePack({
    id: 'national-air-force-day',
    name: 'Indian Air Force Day',
    category: 'national',
    month: 10,
    day: 8,
    accentPalette: NAVY_ACCENT,
    greeting: { default: 'Saluting the Indian Air Force.' },
    decorativeAssets: [{ type: 'illustration', ref: '/experience/national/air-force-day.svg' }],
    animationProfile: { enabled: true, style: 'glow', intensity: 'subtle', gpuFriendly: true, respectsReducedMotion: true },
  }),
  fixedDatePack({
    id: 'national-police-commemoration-day',
    name: 'Police Commemoration Day',
    category: 'national',
    month: 10,
    day: 21,
    accentPalette: { primary: '220 15% 40%', secondary: '215 30% 45%', glow: '220 20% 60%' },
    greeting: { default: 'Honouring the police forces today.' },
    decorativeAssets: [{ type: 'illustration', ref: '/experience/national/police-commemoration-day.svg' }],
  }),
  fixedDatePack({
    id: 'national-unity-day',
    name: 'National Unity Day',
    category: 'national',
    month: 10,
    day: 31,
    accentPalette: TRICOLOR_ACCENT,
    greeting: { default: 'Happy National Unity Day.' },
    decorativeAssets: [{ type: 'illustration', ref: '/experience/national/unity-day.svg' }],
    animationProfile: { enabled: true, style: 'glow', intensity: 'subtle', gpuFriendly: true, respectsReducedMotion: true },
  }),
  fixedDatePack({
    id: 'national-constitution-day',
    name: 'Constitution Day',
    category: 'national',
    month: 11,
    day: 26,
    accentPalette: TRICOLOR_ACCENT,
    greeting: { default: 'Happy Constitution Day.' },
    decorativeAssets: [{ type: 'illustration', ref: '/experience/national/constitution-day.svg' }],
    animationProfile: { enabled: true, style: 'glow', intensity: 'subtle', gpuFriendly: true, respectsReducedMotion: true },
  }),
  fixedDatePack({
    id: 'national-navy-day',
    name: 'Indian Navy Day',
    category: 'national',
    month: 12,
    day: 4,
    accentPalette: NAVY_ACCENT,
    greeting: { default: 'Saluting the Indian Navy.' },
    decorativeAssets: [{ type: 'illustration', ref: '/experience/national/navy-day.svg' }],
    animationProfile: { enabled: true, style: 'glow', intensity: 'subtle', gpuFriendly: true, respectsReducedMotion: true },
  }),
  fixedDatePack({
    id: 'national-armed-forces-flag-day',
    name: 'Armed Forces Flag Day',
    category: 'national',
    month: 12,
    day: 7,
    accentPalette: NAVY_ACCENT,
    greeting: { default: 'Supporting our armed forces today.' },
    decorativeAssets: [{ type: 'illustration', ref: '/experience/national/armed-forces-flag-day.svg' }],
    animationProfile: { enabled: true, style: 'glow', intensity: 'subtle', gpuFriendly: true, respectsReducedMotion: true },
  }),
  fixedDatePack({
    id: 'national-christmas',
    name: 'Christmas',
    category: 'national',
    month: 12,
    day: 25,
    accentPalette: { primary: '0 55% 45%', secondary: '150 40% 35%', glow: '43 80% 60%' },
    greeting: { default: 'Merry Christmas.' },
    decorativeAssets: [
      { type: 'illustration', ref: '/experience/national/christmas.svg' },
      { type: 'particle', ref: '/experience/national/christmas-snow.json' },
    ],
    animationProfile: { enabled: true, style: 'twinkle', intensity: 'subtle', gpuFriendly: true, respectsReducedMotion: true },
  }),
  fixedDatePack({
    id: 'national-new-years-eve',
    name: "New Year's Eve",
    category: 'national',
    month: 12,
    day: 31,
    accentPalette: GOLD_ACCENT,
    greeting: { default: 'Ringing out the year — happy New Year\u2019s Eve.', evening: 'One more year, well spent.' },
    decorativeAssets: [{ type: 'particle', ref: '/experience/national/new-years-eve-sparkle.json' }],
    animationProfile: { enabled: true, style: 'twinkle', intensity: 'subtle', gpuFriendly: true, respectsReducedMotion: true },
  }),
]
