'use client'

import { createContext, useContext, useEffect, useMemo, useState } from 'react'

type ResolvedTheme = 'dark' | 'light'

interface TenantThemeContextValue {
  /** What's actually rendered right now: 'dark' | 'light'. Always mirrors the device/OS setting. */
  resolvedTheme: ResolvedTheme
}

const TenantThemeContext = createContext<TenantThemeContextValue | null>(null)

/**
 * Scoped theme engine for the Tenant Mobile UI (tenant/ui design-system
 * components — not yet wired into the live `(tenant)/portal` page, which
 * currently manages its own local dark-mode state; see
 * PREMIUM_UI_UPGRADE_PHASE_LOG.md for the plan to unify these).
 *
 * Phase 1 (Premium UI Upgrade): the theme now follows the device's
 * `prefers-color-scheme` setting only — there is no manual toggle and no
 * stored override. Writes the resolved theme as `data-theme` on the
 * wrapping `.tenant-portal` element — never on `<html>` — so Tailwind's
 * global `darkMode: 'class'` toggle (which owner/admin components may rely
 * on) is completely unaffected.
 */
export function TenantThemeProvider({ children }: { children: React.ReactNode }) {
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
  const activeTheme = mounted ? resolvedTheme : 'dark'

  return (
    <TenantThemeContext.Provider value={value}>
      <div className="tenant-portal min-h-screen" data-theme={activeTheme} suppressHydrationWarning>
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
