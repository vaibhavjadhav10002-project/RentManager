'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Sparkles } from 'lucide-react'
import { onExploreLockRequested } from './lock-bus'
import { exitExploreMode } from './cookies'

/**
 * Mounted once in the root layout (next to NativeBootstrap/PWARegister —
 * same pattern). Listens for the lock-bus event the mock Supabase client
 * fires whenever a write is attempted anywhere in the app, and shows this
 * instead of letting the write silently fail or throw a raw error toast.
 */
export default function ExploreLockSheet() {
  const [open, setOpen] = useState(false)
  const router = useRouter()

  useEffect(() => onExploreLockRequested(() => setOpen(true)), [])

  if (!open) return null

  function goTo(path: string) {
    exitExploreMode()
    setOpen(false)
    router.push(path)
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/40 animate-fade-in" onClick={() => setOpen(false)}>
      <div
        className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-t-3xl p-8 pb-safe shadow-2xl animate-owner-sheet-up"
        onClick={e => e.stopPropagation()}
      >
        <div className="mx-auto mb-6 h-1.5 w-12 rounded-full bg-gray-200 dark:bg-slate-700" />
        <div className="flex items-center gap-3 mb-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-purple-600 text-white">
            <Sparkles size={20} />
          </div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">Unlock the full Rentivo experience</h2>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-7 leading-relaxed">
          You&rsquo;re currently exploring Rentivo. Create a free account to start managing your own PGs, tenants and properties.
        </p>
        <div className="flex flex-col gap-3">
          <button
            onClick={() => goTo('/login?mode=signup')}
            className="w-full rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 py-3.5 text-sm font-semibold text-white active:scale-[0.98] transition-transform"
          >
            Create Account
          </button>
          <button
            onClick={() => goTo('/login')}
            className="w-full rounded-xl border border-gray-200 dark:border-slate-700 py-3.5 text-sm font-semibold text-gray-900 dark:text-white active:scale-[0.98] transition-transform"
          >
            Login
          </button>
          <button
            onClick={() => setOpen(false)}
            className="w-full py-2 text-sm font-medium text-gray-500 dark:text-gray-400"
          >
            Continue Exploring
          </button>
        </div>
      </div>
    </div>
  )
}
