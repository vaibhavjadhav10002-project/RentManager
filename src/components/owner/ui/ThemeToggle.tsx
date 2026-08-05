'use client'

import { Moon, Sun, Monitor } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useOwnerTheme, type OwnerThemePreference } from './ThemeProvider'

const options: { key: OwnerThemePreference; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: 'light', label: 'Light', icon: Sun },
  { key: 'dark', label: 'Dark', icon: Moon },
  { key: 'system', label: 'System', icon: Monitor },
]

/** Three-way segmented control for the Owner theme engine. Not wired into
 * the Topbar yet — that happens when the Topbar itself is redesigned — but
 * fully functional against OwnerThemeProvider as soon as it's dropped in. */
export function OwnerThemeToggle({ className }: { className?: string }) {
  const { preference, setPreference } = useOwnerTheme()

  return (
    <div className={cn('flex items-center gap-1 p-1 bg-owner-bg-subtle rounded-owner-lg border border-owner-border', className)}>
      {options.map(({ key, label, icon: Icon }) => {
        const active = preference === key
        return (
          <button
            key={key}
            onClick={() => setPreference(key)}
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 h-8 rounded-owner-md text-xs font-semibold transition-colors',
              active ? 'bg-owner-primary text-owner-primary-fg shadow-owner-xs' : 'text-owner-muted hover:text-owner-fg'
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
