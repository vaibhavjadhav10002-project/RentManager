/**
 * Rentivo Experience Engine — Festival Packs (Phase 5)
 * ─────────────────────────────────────────────────────────────────────────
 * All 18 Festival packs from the product brief. Every entry is a pure,
 * immutable `ExperiencePack` (`category: 'festival'`, priority 4) built
 * via `explicitDatePack()` — none of these ids, names, or dates are known
 * to any engine file.
 *
 * WHY `explicit-dates` AND NOT `fixed-date`: every festival below is set
 * by the Hindu lunisolar (panchang) calendar, not the Gregorian calendar —
 * its Gregorian date shifts by roughly 10–20 days every year (and
 * occasionally more, in a leap/Adhik Maas year). A `fixed-date` rule
 * (safe for the Gregorian, law-set National/Remembrance days in Phase 4)
 * would silently be wrong for these. `explicit-dates` requires one
 * `'YYYY-MM-DD'` entry per year instead — correct by construction, at the
 * cost of needing a new date appended once a year.
 *
 * DATES POPULATED: 2026 only, for every pack. Sourced from Drik Panchang
 * (drikpanchang.com — the standard reference panchang used across the
 * Hindu festival-calendar ecosystem), cross-checked against several
 * independent festival-calendar sources for agreement, on 2026-08-02.
 * A handful of festivals (notably Ram Navami and Janmashtami) have a
 * one-day variance between the Smarta and Vaishnav/ISKCON traditions in
 * some years; where that existed, the Smarta (more widely observed)
 * date was used.
 *
 * MAINTENANCE: extending any pack to 2027 and beyond is appending one
 * `'YYYY-MM-DD'` string to that pack's `dates` array — nothing else
 * changes, in this file or any engine file. Do this annually, ideally
 * sourced fresh from Drik Panchang each time rather than projected, since
 * panchang dates are not arithmetic and cannot be safely extrapolated.
 *
 * A few of the most widely multi-day festivals carry a short
 * `windowDaysAfter` (Navratri spans its own 9 nights; Diwali is
 * conventionally a 5-day festival) — ordinary per-pack config, not
 * special-cased engine behavior.
 */

import { explicitDatePack } from './helpers'
import type { ExperiencePack } from '../types'

/** Warm saffron/gold — harvest and solar-transition festivals. */
const HARVEST_ACCENT = { primary: '35 85% 52%', secondary: '43 75% 55%', glow: '38 90% 68%' }
/** Deep vermilion — Shiva-devotional festivals. */
const SHIVA_ACCENT = { primary: '355 55% 40%', secondary: '220 20% 30%', glow: '355 50% 55%' }
/** Vivid multicolor-leaning accent — Holi. */
const HOLI_ACCENT = { primary: '330 75% 55%', secondary: '45 90% 55%', glow: '190 80% 55%' }
/** Fresh green/gold — new-year and spring-opening festivals. */
const NEW_YEAR_ACCENT = { primary: '95 45% 45%', secondary: '43 80% 55%', glow: '95 50% 65%' }
/** Warm devotional saffron — Rama/Hanuman festivals. */
const DEVOTIONAL_ACCENT = { primary: '24 80% 50%', secondary: '43 75% 52%', glow: '24 75% 65%' }
/** Soft white/gold — Buddha Purnima. */
const SERENE_ACCENT = { primary: '43 60% 65%', secondary: '210 25% 55%', glow: '43 65% 78%' }
/** Deep gold — Guru/knowledge-honoring festivals. */
const GURU_ACCENT = { primary: '43 70% 48%', secondary: '30 55% 40%', glow: '43 75% 65%' }
/** Warm rose/gold — sibling-bond festivals. */
const SIBLING_ACCENT = { primary: '350 65% 55%', secondary: '43 75% 55%', glow: '350 60% 70%' }
/** Rich maroon/gold — Krishna/Ganesha festivals. */
const DEITY_ACCENT = { primary: '350 50% 38%', secondary: '43 80% 52%', glow: '350 45% 55%' }
/** Deep red/gold — Durga/Navratri/Dussehra festivals. */
const SHAKTI_ACCENT = { primary: '355 65% 45%', secondary: '43 80% 52%', glow: '355 60% 60%' }
/** Warm amber/copper — Diwali and light festivals. */
const DIWALI_ACCENT = { primary: '38 90% 55%', secondary: '350 55% 45%', glow: '45 95% 68%' }
/** Muted gold/river-blue — Chhath Puja. */
const CHHATH_ACCENT = { primary: '38 75% 50%', secondary: '199 55% 45%', glow: '38 70% 65%' }

export const festivalPacks: ExperiencePack[] = [
  explicitDatePack({
    id: 'festival-makar-sankranti',
    name: 'Makar Sankranti',
    category: 'festival',
    dates: ['2026-01-14'],
    accentPalette: HARVEST_ACCENT,
    greeting: { default: 'Happy Makar Sankranti.' },
    decorativeAssets: [
      { type: 'illustration', ref: '/experience/festival/makar-sankranti.svg' },
      { type: 'particle', ref: '/experience/festival/makar-sankranti-kites.json' },
    ],
    animationProfile: { enabled: true, style: 'drift', intensity: 'subtle', gpuFriendly: true, respectsReducedMotion: true },
  }),
  explicitDatePack({
    id: 'festival-maha-shivratri',
    name: 'Maha Shivratri',
    category: 'festival',
    dates: ['2026-02-15'],
    accentPalette: SHIVA_ACCENT,
    greeting: { default: 'Happy Maha Shivratri.', night: 'A sacred Shivratri night.' },
    decorativeAssets: [{ type: 'illustration', ref: '/experience/festival/maha-shivratri.svg' }],
    animationProfile: { enabled: true, style: 'glow', intensity: 'subtle', gpuFriendly: true, respectsReducedMotion: true },
  }),
  explicitDatePack({
    id: 'festival-holi',
    name: 'Holi',
    category: 'festival',
    dates: ['2026-03-04'],
    accentPalette: HOLI_ACCENT,
    greeting: { default: 'Happy Holi — full of color today.' },
    decorativeAssets: [
      { type: 'illustration', ref: '/experience/festival/holi.svg' },
      { type: 'particle', ref: '/experience/festival/holi-colors.json' },
    ],
    animationProfile: { enabled: true, style: 'burst', intensity: 'subtle', gpuFriendly: true, respectsReducedMotion: true },
  }),
  explicitDatePack({
    id: 'festival-gudi-padwa-ugadi',
    name: 'Gudi Padwa / Ugadi',
    category: 'festival',
    dates: ['2026-03-19'],
    accentPalette: NEW_YEAR_ACCENT,
    greeting: { default: 'Happy New Year — Gudi Padwa / Ugadi.' },
    decorativeAssets: [{ type: 'illustration', ref: '/experience/festival/gudi-padwa-ugadi.svg' }],
    animationProfile: { enabled: true, style: 'glow', intensity: 'subtle', gpuFriendly: true, respectsReducedMotion: true },
  }),
  explicitDatePack({
    id: 'festival-ram-navami',
    name: 'Ram Navami',
    category: 'festival',
    dates: ['2026-03-26'],
    accentPalette: DEVOTIONAL_ACCENT,
    greeting: { default: 'Happy Ram Navami.' },
    decorativeAssets: [{ type: 'illustration', ref: '/experience/festival/ram-navami.svg' }],
    animationProfile: { enabled: true, style: 'glow', intensity: 'subtle', gpuFriendly: true, respectsReducedMotion: true },
  }),
  explicitDatePack({
    id: 'festival-hanuman-jayanti',
    name: 'Hanuman Jayanti',
    category: 'festival',
    dates: ['2026-04-02'],
    accentPalette: DEVOTIONAL_ACCENT,
    greeting: { default: 'Happy Hanuman Jayanti.' },
    decorativeAssets: [{ type: 'illustration', ref: '/experience/festival/hanuman-jayanti.svg' }],
    animationProfile: { enabled: true, style: 'glow', intensity: 'subtle', gpuFriendly: true, respectsReducedMotion: true },
  }),
  explicitDatePack({
    id: 'festival-buddha-purnima',
    name: 'Buddha Purnima',
    category: 'festival',
    dates: ['2026-05-01'],
    accentPalette: SERENE_ACCENT,
    greeting: { default: 'Happy Buddha Purnima.' },
    decorativeAssets: [{ type: 'illustration', ref: '/experience/festival/buddha-purnima.svg' }],
    animationProfile: { enabled: true, style: 'glow', intensity: 'subtle', gpuFriendly: true, respectsReducedMotion: true },
  }),
  explicitDatePack({
    id: 'festival-guru-purnima',
    name: 'Guru Purnima',
    category: 'festival',
    dates: ['2026-07-29'],
    accentPalette: GURU_ACCENT,
    greeting: { default: 'Happy Guru Purnima.' },
    decorativeAssets: [{ type: 'illustration', ref: '/experience/festival/guru-purnima.svg' }],
    animationProfile: { enabled: true, style: 'glow', intensity: 'subtle', gpuFriendly: true, respectsReducedMotion: true },
  }),
  explicitDatePack({
    id: 'festival-raksha-bandhan',
    name: 'Raksha Bandhan',
    category: 'festival',
    dates: ['2026-08-28'],
    accentPalette: SIBLING_ACCENT,
    greeting: { default: 'Happy Raksha Bandhan.' },
    decorativeAssets: [{ type: 'illustration', ref: '/experience/festival/raksha-bandhan.svg' }],
    animationProfile: { enabled: true, style: 'glow', intensity: 'subtle', gpuFriendly: true, respectsReducedMotion: true },
  }),
  explicitDatePack({
    id: 'festival-janmashtami',
    name: 'Janmashtami',
    category: 'festival',
    dates: ['2026-09-04'],
    accentPalette: DEITY_ACCENT,
    greeting: { default: 'Happy Janmashtami.', night: 'A blessed Janmashtami night.' },
    decorativeAssets: [{ type: 'illustration', ref: '/experience/festival/janmashtami.svg' }],
    animationProfile: { enabled: true, style: 'glow', intensity: 'subtle', gpuFriendly: true, respectsReducedMotion: true },
  }),
  explicitDatePack({
    id: 'festival-ganesh-chaturthi',
    name: 'Ganesh Chaturthi',
    category: 'festival',
    dates: ['2026-09-14'],
    accentPalette: DEITY_ACCENT,
    greeting: { default: 'Happy Ganesh Chaturthi.' },
    decorativeAssets: [
      { type: 'illustration', ref: '/experience/festival/ganesh-chaturthi.svg' },
      { type: 'particle', ref: '/experience/festival/ganesh-chaturthi-confetti.json' },
    ],
    animationProfile: { enabled: true, style: 'burst', intensity: 'subtle', gpuFriendly: true, respectsReducedMotion: true },
  }),
  explicitDatePack({
    id: 'festival-navratri',
    name: 'Navratri',
    category: 'festival',
    dates: ['2026-10-11'],
    // Spans the 9 nights of Navratri itself (Oct 11 – Oct 19); Dussehra
    // the following day is its own separate pack.
    windowDaysAfter: 8,
    accentPalette: SHAKTI_ACCENT,
    greeting: { default: 'Happy Navratri.' },
    decorativeAssets: [{ type: 'illustration', ref: '/experience/festival/navratri.svg' }],
    animationProfile: { enabled: true, style: 'glow', intensity: 'subtle', gpuFriendly: true, respectsReducedMotion: true },
  }),
  explicitDatePack({
    id: 'festival-dussehra',
    name: 'Dussehra',
    category: 'festival',
    dates: ['2026-10-20'],
    accentPalette: SHAKTI_ACCENT,
    greeting: { default: 'Happy Dussehra.' },
    decorativeAssets: [{ type: 'illustration', ref: '/experience/festival/dussehra.svg' }],
    animationProfile: { enabled: true, style: 'glow', intensity: 'subtle', gpuFriendly: true, respectsReducedMotion: true },
  }),
  explicitDatePack({
    id: 'festival-karwa-chauth',
    name: 'Karwa Chauth',
    category: 'festival',
    dates: ['2026-10-29'],
    accentPalette: SIBLING_ACCENT,
    greeting: { default: 'Happy Karwa Chauth.', evening: 'A blessed Karwa Chauth evening.' },
    decorativeAssets: [{ type: 'illustration', ref: '/experience/festival/karwa-chauth.svg' }],
    animationProfile: { enabled: true, style: 'glow', intensity: 'subtle', gpuFriendly: true, respectsReducedMotion: true },
  }),
  explicitDatePack({
    id: 'festival-diwali',
    name: 'Diwali',
    category: 'festival',
    dates: ['2026-11-08'],
    // Conventionally a 5-day festival (Dhanteras through Bhai Dooj); Bhai
    // Dooj itself is its own separate pack a few days later, so the
    // window here stays short and centered on the main Lakshmi Puja day.
    windowDaysBefore: 1,
    windowDaysAfter: 1,
    accentPalette: DIWALI_ACCENT,
    greeting: { default: 'Happy Diwali.', evening: 'A radiant Diwali evening.' },
    decorativeAssets: [
      { type: 'illustration', ref: '/experience/festival/diwali.svg' },
      { type: 'particle', ref: '/experience/festival/diwali-diyas.json' },
    ],
    animationProfile: { enabled: true, style: 'twinkle', intensity: 'subtle', gpuFriendly: true, respectsReducedMotion: true },
  }),
  explicitDatePack({
    id: 'festival-bhai-dooj',
    name: 'Bhai Dooj',
    category: 'festival',
    dates: ['2026-11-11'],
    accentPalette: SIBLING_ACCENT,
    greeting: { default: 'Happy Bhai Dooj.' },
    decorativeAssets: [{ type: 'illustration', ref: '/experience/festival/bhai-dooj.svg' }],
    animationProfile: { enabled: true, style: 'glow', intensity: 'subtle', gpuFriendly: true, respectsReducedMotion: true },
  }),
  explicitDatePack({
    id: 'festival-chhath-puja',
    name: 'Chhath Puja',
    category: 'festival',
    dates: ['2026-11-15'],
    accentPalette: CHHATH_ACCENT,
    greeting: { default: 'Happy Chhath Puja.' },
    decorativeAssets: [{ type: 'illustration', ref: '/experience/festival/chhath-puja.svg' }],
    animationProfile: { enabled: true, style: 'glow', intensity: 'subtle', gpuFriendly: true, respectsReducedMotion: true },
  }),
  explicitDatePack({
    id: 'festival-tulsi-vivah',
    name: 'Tulsi Vivah',
    category: 'festival',
    dates: ['2026-11-21'],
    accentPalette: DEVOTIONAL_ACCENT,
    greeting: { default: 'Happy Tulsi Vivah.' },
    decorativeAssets: [{ type: 'illustration', ref: '/experience/festival/tulsi-vivah.svg' }],
    animationProfile: { enabled: true, style: 'glow', intensity: 'subtle', gpuFriendly: true, respectsReducedMotion: true },
  }),
]
