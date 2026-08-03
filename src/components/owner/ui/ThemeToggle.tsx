'use client'

import { Moon, Sun } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useOwnerTheme } from './ThemeProvider'

/**
 * Read-only theme indicator for the Owner Dashboard.
 *
 * Theme now follows the device's OS setting only (see ThemeProvider) —
 * there is no manual toggle. This component just reflects the currently
 * active theme so it can still be dropped into headers/toolbars without
 * implying it's clickable.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme } = useOwnerTheme()
  const isDark = resolvedTheme === 'dark'

  return (
    <div
      className={cn(
        'inline-flex items-center justify-center w-9 h-9 rounded-full bg-gray-50 dark:bg-slate-800 text-gray-500 dark:text-slate-400',
        className
      )}
      title={isDark ? 'Dark mode (follows device setting)' : 'Light mode (follows device setting)'}
      aria-label={isDark ? 'Dark mode' : 'Light mode'}
    >
      {isDark ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
    </div>
  )
}
