/**
 * Day-of-week accent rotation
 * ─────────────────────────────────────────────────────────────────────────
 * A lightweight, always-on brand refresh: the *primary* accent (buttons,
 * active nav state, links, focus rings) rotates through 7 curated,
 * trending hues — one per day of the week — so the app feels a little
 * fresh and "alive" day to day without ever touching status/semantic
 * colors (success/warning/danger/info stay exactly as defined in
 * owner-theme.css / tenant-theme.css, so "overdue = red" etc. never
 * changes meaning).
 *
 * This intentionally sits *underneath* the Experience Pack system
 * (see src/lib/experience/): if a festival/campaign/national-day pack is
 * active "today", its accentPalette still wins — this is only the
 * fallback "default" look for ordinary days, matching the priority
 * ladder described in experience/types.ts (packs > base/default).
 *
 * Colors were chosen to stay clearly clear of the semantic hues already
 * in use (danger ~0°, warning ~40°, success ~142°, info ~217°,
 * accent-purple ~271°, accent-teal ~172°) so a Tuesday/Thursday primary
 * button is never confusable with a warning or danger badge.
 */

export type ResolvedShellTheme = 'dark' | 'light'

interface DayAccentDef {
  name: string
  hue: number
  sat: number
  /** Primary lightness in dark-mode / light-mode shells. */
  lightDark: number
  lightLight: number
  /** true = use dark text on this accent (bright/light hues like lime). */
  darkForeground?: boolean
}

// Index 0 = Sunday ... 6 = Saturday (matches Date#getDay()).
const DAY_ACCENTS: DayAccentDef[] = [
  { name: 'Royal Violet', hue: 280, sat: 85, lightDark: 66, lightLight: 50 }, // Sun
  { name: 'Electric Indigo', hue: 243, sat: 96, lightDark: 62, lightLight: 55 }, // Mon
  { name: 'Azure Blue', hue: 205, sat: 92, lightDark: 58, lightLight: 46 }, // Tue
  { name: 'Turquoise Teal', hue: 188, sat: 85, lightDark: 54, lightLight: 38 }, // Wed
  { name: 'Magenta Orchid', hue: 322, sat: 82, lightDark: 62, lightLight: 48 }, // Thu
  { name: 'Berry Rose', hue: 338, sat: 88, lightDark: 62, lightLight: 48 }, // Fri
  { name: 'Lime Chartreuse', hue: 84, sat: 58, lightDark: 52, lightLight: 40, darkForeground: true }, // Sat
]

export interface DayAccentPalette {
  name: string
  primary: string
  hover: string
  foreground: string
  ring: string
  glow: string
}

export function getDayAccentPalette(
  theme: ResolvedShellTheme,
  date: Date = new Date()
): DayAccentPalette {
  const d = DAY_ACCENTS[date.getDay()]
  const lightness = theme === 'dark' ? d.lightDark : d.lightLight
  const hoverLightness =
    theme === 'dark' ? Math.min(lightness + 6, 92) : Math.max(lightness - 6, 8)

  const primary = `${d.hue} ${d.sat}% ${lightness}%`
  const hover = `${d.hue} ${d.sat}% ${hoverLightness}%`
  const foreground = d.darkForeground ? '222 47% 12%' : '0 0% 100%'

  return { name: d.name, primary, hover, foreground, ring: primary, glow: primary }
}
