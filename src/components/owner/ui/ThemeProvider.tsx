'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useActiveExperience } from '@/lib/experience/useActiveExperience'
import { getDayAccentPalette } from '@/lib/theme/dayAccent'

export type OwnerThemePreference = 'dark' | 'light' | 'system'
type ResolvedTheme = 'dark' | 'light'

const STORAGE_KEY = 'owner-theme-preference'

function resolveSystemTheme(): ResolvedTheme {
  if (typeof window === 'undefined') return 'dark'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function resolveTheme(pref: OwnerThemePreference): ResolvedTheme {
  return pref === 'system' ? resolveSystemTheme() : pref
}

interface OwnerThemeContextValue {
  preference: OwnerThemePreference
  resolvedTheme: ResolvedTheme
  setPreference: (pref: OwnerThemePreference) => void
}

const OwnerThemeContext = createContext<OwnerThemeContextValue | null>(null)

/**
 * Scoped theme engine for the Owner Dashboard. Same pattern as
 * TenantThemeProvider (see src/components/tenant/ui/ThemeProvider.tsx):
 * defaults to dark, persists dark/light/system under its own localStorage
 * key, tracks `prefers-color-scheme` live while "system" is selected, and
 * writes `data-theme` on the wrapping `.owner-shell` element rather than
 * `<html>`.
 *
 * One addition versus the tenant version: this ALSO toggles the literal
 * global `.dark` class on the same wrapper. That's because some existing
 * owner pages (e.g. the current Dashboard, before its own redesign phase)
 * already use Tailwind's global `dark:` variant classes driven by that
 * class. Keeping it in sync means those pages keep working exactly as
 * before while the rest of the Owner UI migrates to `owner-*` tokens
 * phase by phase. This can be removed once every owner page is migrated.
 */
export function OwnerThemeProvider({
  children,
  initialPreference = 'dark',
}: {
  children: React.ReactNode
  initialPreference?: OwnerThemePreference
}) {
  const [preference, setPreferenceState] = useState<OwnerThemePreference>(initialPreference)
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(
    initialPreference === 'system' ? 'dark' : initialPreference
  )
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY) as OwnerThemePreference | null
      if (saved === 'dark' || saved === 'light' || saved === 'system') {
        setPreferenceState(saved)
        setResolvedTheme(resolveTheme(saved))
      }
    } catch {
      // localStorage unavailable — fall back to default.
    }
  }, [])

  useEffect(() => {
    if (preference !== 'system') return
    const mql = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => setResolvedTheme(mql.matches ? 'dark' : 'light')
    onChange()
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [preference])

  const setPreference = useCallback((pref: OwnerThemePreference) => {
    setPreferenceState(pref)
    setResolvedTheme(resolveTheme(pref))
    try {
      window.localStorage.setItem(STORAGE_KEY, pref)
    } catch {
      // ignore
    }
  }, [])

  const value = useMemo(
    () => ({ preference, resolvedTheme, setPreference }),
    [preference, resolvedTheme, setPreference]
  )

  const activeTheme = mounted ? resolvedTheme : initialPreference === 'system' ? 'dark' : initialPreference

  // Day-of-week accent rotation (see src/lib/theme/dayAccent.ts) — the
  // "default" look for an ordinary day, applied before any Experience
  // Pack so a festival/campaign color (below) always wins when active.
  // Gated on `mounted` (same pattern as activeTheme above) so the server
  // render — which may run in a different timezone/day than the visitor —
  // never disagrees with the client; the static CSS default shows first
  // and the day color applies right after hydration.
  const dayAccent = mounted ? getDayAccentPalette(activeTheme) : null
  const dayStyle: React.CSSProperties | undefined = dayAccent
    ? ({
        '--owner-primary': dayAccent.primary,
        '--owner-primary-hover': dayAccent.hover,
        '--owner-primary-foreground': dayAccent.foreground,
        '--owner-ring': dayAccent.ring,
        '--owner-glow': dayAccent.glow,
      } as React.CSSProperties)
    : undefined

  // Same accent-color-override approach as TenantThemeProvider — see the
  // comment there. Applying it here means the whole Owner Dashboard
  // (buttons, badges, active sidebar/bottom-nav state, ...) picks up the
  // active Experience Pack's seasonal color with zero per-screen changes.
  const activePack = useActiveExperience()
  const accentStyle = activePack?.accentPalette?.primary
    ? ({
        '--owner-primary': activePack.accentPalette.primary,
        '--owner-primary-hover': activePack.accentPalette.secondary ?? activePack.accentPalette.primary,
      } as React.CSSProperties)
    : undefined

  return (
    <OwnerThemeContext.Provider value={value}>
      <div
        className={`owner-shell min-h-screen ${activeTheme === 'dark' ? 'dark' : ''}`}
        data-theme={activeTheme}
        style={{ ...dayStyle, ...accentStyle }}
        suppressHydrationWarning
      >
        {children}
      </div>
    </OwnerThemeContext.Provider>
  )
}

export function useOwnerTheme() {
  const ctx = useContext(OwnerThemeContext)
  if (!ctx) throw new Error('useOwnerTheme must be used within an OwnerThemeProvider')
  return ctx
}
