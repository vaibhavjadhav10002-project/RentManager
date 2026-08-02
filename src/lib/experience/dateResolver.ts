/**
 * Rentivo Experience Engine — Date / Event Resolver
 * ─────────────────────────────────────────────────────────────────────────
 * Pure functions that answer one question: "given a pack's DateRule and a
 * point in time, is this pack active?" No knowledge of priority, config
 * sources, or the feature flag lives here — this module only understands
 * calendars.
 *
 * Timezone handling: every rule is evaluated in the pack's own `timezone`
 * (default `Asia/Kolkata`, since all current event categories are India-
 * specific per the product brief). We deliberately avoid adding a timezone
 * library — `Intl.DateTimeFormat` (built into Node/browsers) is sufficient
 * to project a UTC instant onto a calendar date in an arbitrary IANA zone,
 * which is all fixed/explicit/range rules need.
 */

import type { DateRule, ExperiencePack } from './types'

const DEFAULT_TIMEZONE = 'Asia/Kolkata'

/** Y/M/D as seen in a specific IANA timezone, for a given instant. */
interface ZonedYMD {
  year: number
  month: number // 1–12
  day: number // 1–31
}

function toZonedYMD(date: Date, timeZone: string): ZonedYMD {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)

  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value)
  return { year: get('year'), month: get('month'), day: get('day') }
}

function ymdToDayOfYearComparable(y: number, m: number, d: number): number {
  // Comparable-but-not-calendar-accurate integer, sufficient for ordering
  // within a single year or across the small windows this engine deals with.
  return y * 10000 + m * 100 + d
}

/** Adds `days` calendar days to a Y/M/D triple using UTC arithmetic (avoids DST-style pitfalls; India has no DST). */
function addDays(ymd: ZonedYMD, days: number): ZonedYMD {
  const utc = new Date(Date.UTC(ymd.year, ymd.month - 1, ymd.day))
  utc.setUTCDate(utc.getUTCDate() + days)
  return { year: utc.getUTCFullYear(), month: utc.getUTCMonth() + 1, day: utc.getUTCDate() }
}

function isWithinWindow(
  today: ZonedYMD,
  target: ZonedYMD,
  windowDaysBefore = 0,
  windowDaysAfter = 0
): boolean {
  const windowStart = addDays(target, -windowDaysBefore)
  const windowEnd = addDays(target, windowDaysAfter)
  const t = ymdToDayOfYearComparable(today.year, today.month, today.day)
  return (
    t >= ymdToDayOfYearComparable(windowStart.year, windowStart.month, windowStart.day) &&
    t <= ymdToDayOfYearComparable(windowEnd.year, windowEnd.month, windowEnd.day)
  )
}

function evaluateFixedDate(
  rule: Extract<DateRule, { type: 'fixed-date' }>,
  today: ZonedYMD
): boolean {
  // The target occurrence in "today"'s own year — windows that cross a
  // year boundary (e.g. Dec 30 + 3 days) are handled by addDays operating
  // on real calendar arithmetic, not by clamping to Dec 31.
  const target: ZonedYMD = { year: today.year, month: rule.month, day: rule.day }
  return isWithinWindow(today, target, rule.windowDaysBefore ?? 0, rule.windowDaysAfter ?? 0)
}

function evaluateExplicitDates(
  rule: Extract<DateRule, { type: 'explicit-dates' }>,
  today: ZonedYMD
): boolean {
  return rule.dates.some((iso) => {
    const [y, m, d] = iso.split('-').map(Number)
    if (!y || !m || !d) return false
    return isWithinWindow(
      today,
      { year: y, month: m, day: d },
      rule.windowDaysBefore ?? 0,
      rule.windowDaysAfter ?? 0
    )
  })
}

function evaluateDateRange(rule: Extract<DateRule, { type: 'date-range' }>, today: ZonedYMD): boolean {
  const [startMonth, startDay] = rule.start.split('-').map(Number)
  const [endMonth, endDay] = rule.end.split('-').map(Number)

  const todayKey = today.month * 100 + today.day
  const startKey = startMonth * 100 + startDay
  const endKey = endMonth * 100 + endDay

  if (startKey <= endKey) {
    // Simple range within one calendar year, e.g. Mar 01 – May 31.
    return todayKey >= startKey && todayKey <= endKey
  }
  // Wrap-around range, e.g. Dec 01 – Feb 28.
  return todayKey >= startKey || todayKey <= endKey
}

function evaluateDateTimeRange(
  rule: Extract<DateRule, { type: 'datetime-range' }>,
  instant: Date
): boolean {
  const start = Date.parse(rule.start)
  const end = Date.parse(rule.end)
  if (Number.isNaN(start) || Number.isNaN(end)) return false
  const t = instant.getTime()
  return t >= start && t <= end
}

/**
 * Is `pack` active at `instant` (defaults to now)? Does NOT check
 * `pack.enabled` — callers (the engine) are expected to filter disabled
 * packs before calling this, keeping this function purely about calendars.
 */
export function isPackActiveOnDate(pack: ExperiencePack, instant: Date = new Date()): boolean {
  const timeZone = pack.timezone ?? DEFAULT_TIMEZONE
  const rule = pack.dateRule

  switch (rule.type) {
    case 'fixed-date':
      return evaluateFixedDate(rule, toZonedYMD(instant, timeZone))
    case 'explicit-dates':
      return evaluateExplicitDates(rule, toZonedYMD(instant, timeZone))
    case 'date-range':
      return evaluateDateRange(rule, toZonedYMD(instant, timeZone))
    case 'datetime-range':
      return evaluateDateTimeRange(rule, instant)
    case 'manual':
      // A manual pack's activation window IS its enabled flag — always
      // "active" date-wise once enabled; the engine's enabled-filter does
      // the real gating.
      return true
    default:
      return false
  }
}

/** Convenience filter: packs that are both enabled and date-active right now. */
export function filterActivePacks(
  packs: ExperiencePack[],
  instant: Date = new Date()
): ExperiencePack[] {
  return packs.filter((pack) => pack.enabled && isPackActiveOnDate(pack, instant))
}
