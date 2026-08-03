'use client'

import { createContext, useContext, useEffect, useMemo, useState } from 'react'

type ResolvedTheme = 'dark' | 'light'

interface OwnerThemeContextValue {
  /** What's actually rendered right now: 'dark' | 'light'. Always mirrors the device/OS setting. */
  resolvedTheme: ResolvedTheme
}

const OwnerThemeContext = createContext<OwnerThemeContextValue | null>(null)

/**
 * Scoped theme engine for the Owner Dashboard.
 *
 * Phase 1 (Premium UI Upgrade): the theme now follows the device's
 * `prefers-color-scheme` setting only — there is no manual toggle and no
 * stored override. This tracks the OS setting live, so a scheduled
 * light/dark switch on the phone updates the app without a reload.
 *
 * Still writes `data-theme` + the literal `.dark` class on the wrapping
 * `.owner-shell` element rather than `<html>`, so any page still relying on
 * Tailwind's global `dark:` variant keeps working unchanged.
 */
export function OwnerThemeProvider({ children }: { children: React.ReactNode }) {
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>('dark')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const mql = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => setResolvedTheme(mql.matches ? 'dark' : 'light')
    onChange()
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [])

  const value = useMemo(() => ({ resolvedTheme }), [resolvedTheme])

  // Before mount, render server-safe 'dark' default (matches previous
  // behavior) to avoid a hydration flash; corrects to the real OS value
  // on the client immediately after mount.
  const activeTheme = mounted ? resolvedTheme : 'dark'

  return (
    <OwnerThemeContext.Provider value={value}>
      <div
        className={`owner-shell min-h-screen ${activeTheme === 'dark' ? 'dark' : ''}`}
        data-theme={activeTheme}
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
