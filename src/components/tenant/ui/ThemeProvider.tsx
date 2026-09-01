'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useActiveExperience } from '@/lib/experience/useActiveExperience'
import { getDayAccentPalette } from '@/lib/theme/dayAccent'

export type TenantThemePreference = 'dark' | 'light' | 'system'
type ResolvedTheme = 'dark' | 'light'

const STORAGE_KEY = 'tenant-theme-preference'

function resolveSystemTheme(): ResolvedTheme {
  if (typeof window === 'undefined') return 'dark'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function resolveTheme(pref: TenantThemePreference): ResolvedTheme {
  return pref === 'system' ? resolveSystemTheme() : pref
}

interface TenantThemeContextValue {
  /** What the user picked: 'dark' | 'light' | 'system' */
  preference: TenantThemePreference
  /** What's actually rendered right now: 'dark' | 'light' */
  resolvedTheme: ResolvedTheme
  setPreference: (pref: TenantThemePreference) => void
}

const TenantThemeContext = createContext<TenantThemeContextValue | null>(null)

/**
 * Scoped theme engine for the Tenant Mobile UI.
 *
 * - Defaults to **dark** (per the design brief) on first visit.
 * - Persists the user's choice (dark / light / system) to localStorage
 *   under a tenant-only key, so it never collides with any Owner/Admin
 *   theme preference that might be added later.
 * - Writes the resolved theme as `data-theme` on the wrapping
 *   `.tenant-portal` element — never on `<html>` — so Tailwind's global
 *   `darkMode: 'class'` toggle (which owner/admin components may rely on)
 *   is completely unaffected.
 * - Tracks `prefers-color-scheme` live while "system" is selected.
 */
export function TenantThemeProvider({
  children,
  initialPreference = 'dark',
}: {
  children: React.ReactNode
  initialPreference?: TenantThemePreference
}) {
  const [preference, setPreferenceState] = useState<TenantThemePreference>(initialPreference)
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(
    initialPreference === 'system' ? 'dark' : initialPreference
  )
  const [mounted, setMounted] = useState(false)

  // Read saved preference on mount (client only — keeps SSR markup stable).
  useEffect(() => {
    setMounted(true)
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY) as TenantThemePreference | null
      if (saved === 'dark' || saved === 'light' || saved === 'system') {
        setPreferenceState(saved)
        setResolvedTheme(resolveTheme(saved))
      }
    } catch {
      // localStorage unavailable (private mode, etc.) — fall back to default.
    }
  }, [])

  // Keep resolvedTheme in sync with OS setting while "system" is active.
  useEffect(() => {
    if (preference !== 'system') return
    const mql = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => setResolvedTheme(mql.matches ? 'dark' : 'light')
    onChange()
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [preference])

  const setPreference = useCallback((pref: TenantThemePreference) => {
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

  // Day-of-week accent rotation (see src/lib/theme/dayAccent.ts) — the
  // "default" look for an ordinary day, applied before any Experience
  // Pack so a festival/campaign color (below) always wins when active.
  const dayAccent = getDayAccentPalette(resolvedTheme)
  const dayStyle: React.CSSProperties = {
    '--tenant-primary': dayAccent.primary,
    '--tenant-primary-hover': dayAccent.hover,
    '--tenant-primary-foreground': dayAccent.foreground,
    '--tenant-ring': dayAccent.ring,
    '--tenant-glow': dayAccent.glow,
  } as React.CSSProperties

  // Applying the active Experience Pack's accent color as a CSS variable
  // override right here — rather than in each individual screen — means
  // every `bg-tenant-primary`/`text-tenant-primary`/etc. class already
  // used throughout the tenant portal (buttons, badges, active nav state,
  // the bottom-nav "Pay Now" FAB, ...) picks up the seasonal color
  // automatically, with zero changes needed anywhere else. See
  // src/lib/experience/ and useActiveExperience.ts.
  const activePack = useActiveExperience()
  const accentStyle = activePack?.accentPalette?.primary
    ? ({
        '--tenant-primary': activePack.accentPalette.primary,
        '--tenant-primary-hover': activePack.accentPalette.secondary ?? activePack.accentPalette.primary,
      } as React.CSSProperties)
    : undefined

  return (
    <TenantThemeContext.Provider value={value}>
      {/* suppressHydrationWarning: resolvedTheme can legitimately differ
          between the server render (always "dark") and the client's first
          paint (saved preference / OS setting), same tradeoff as next-themes. */}
      <div
        className="tenant-portal min-h-screen"
        data-theme={mounted ? resolvedTheme : initialPreference === 'system' ? undefined : initialPreference}
        style={{ ...dayStyle, ...accentStyle }}
        suppressHydrationWarning
      >
        {children}
      </div>
    </TenantThemeContext.Provider>
  )
}

export function useTenantTheme() {
  const ctx = useContext(TenantThemeContext)
  if (!ctx) throw new Error('useTenantTheme must be used within a TenantThemeProvider')
  return ctx
}
