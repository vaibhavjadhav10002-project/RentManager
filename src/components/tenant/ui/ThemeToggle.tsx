'use client'

import { Moon, Sun, SmartphoneNfc } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTenantTheme, type TenantThemePreference } from './ThemeProvider'

const options: { key: TenantThemePreference; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: 'light', label: 'Light', icon: Sun },
  { key: 'dark', label: 'Dark', icon: Moon },
  { key: 'system', label: 'System', icon: SmartphoneNfc },
]

/**
 * Three-way segmented control for the theme engine. Drop this into the
 * Profile & Settings screen (Phase T7) — it's fully wired to
 * TenantThemeProvider already, nothing else to connect.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { preference, setPreference } = useTenantTheme()

  return (
    <div className={cn('flex items-center gap-1 p-1 bg-tenant-bg-subtle rounded-tenant-xl border border-tenant-border', className)}>
      {options.map(({ key, label, icon: Icon }) => {
        const active = preference === key
        return (
          <button
            key={key}
            onClick={() => setPreference(key)}
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 h-9 rounded-tenant-lg text-xs font-semibold transition-colors',
              active ? 'bg-tenant-primary text-tenant-primary-fg shadow-tenant-sm' : 'text-tenant-muted hover:text-tenant-fg'
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        )
      })}
    </div>
  )
}
