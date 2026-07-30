'use client'
import { Rocket, ShieldAlert } from 'lucide-react'
import type { AppVersionConfig } from '@/lib/update/types'
import { startUpdate } from '@/lib/update/trigger'
import { recordDismissal } from '@/lib/update/dismissal'

interface Props {
  mode: 'optional' | 'force'
  installedVersion: string
  config: AppVersionConfig
  onDismiss: () => void
}

export default function AppUpdateDialog({ mode, installedVersion, config, onDismiss }: Props) {
  function handleLater() {
    recordDismissal(config.versionCode)
    onDismiss()
  }

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end justify-center bg-black/50 backdrop-blur-sm animate-fade-in"
      onClick={mode === 'optional' ? handleLater : undefined}
    >
      <div
        className="w-full max-w-lg bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl rounded-t-3xl p-8 pb-safe shadow-2xl border-t border-white/20 animate-owner-sheet-up"
        onClick={e => e.stopPropagation()}
      >
        {mode === 'optional' && (
          <div className="mx-auto mb-6 h-1.5 w-12 rounded-full bg-gray-200 dark:bg-slate-700" />
        )}

        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-purple-600 text-white shrink-0">
            <Rocket size={20} />
          </div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">🚀 New Version Available</h2>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-5 text-sm">
          <div className="rounded-xl bg-gray-50 dark:bg-slate-800 p-3">
            <div className="text-xs text-gray-500 dark:text-gray-400">Current Version</div>
            <div className="font-semibold text-gray-900 dark:text-white">{installedVersion}</div>
          </div>
          <div className="rounded-xl bg-gray-50 dark:bg-slate-800 p-3">
            <div className="text-xs text-gray-500 dark:text-gray-400">Latest Version</div>
            <div className="font-semibold text-gray-900 dark:text-white">{config.latestVersion}</div>
          </div>
          <div className="rounded-xl bg-gray-50 dark:bg-slate-800 p-3">
            <div className="text-xs text-gray-500 dark:text-gray-400">Release Date</div>
            <div className="font-semibold text-gray-900 dark:text-white">{config.releaseDate}</div>
          </div>
          <div className="rounded-xl bg-gray-50 dark:bg-slate-800 p-3">
            <div className="text-xs text-gray-500 dark:text-gray-400">Update Size</div>
            <div className="font-semibold text-gray-900 dark:text-white">{config.apkSizeMB ? `${config.apkSizeMB} MB` : '—'}</div>
          </div>
        </div>

        {config.releaseNotes.length > 0 && (
          <div className="mb-6">
            <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">What&rsquo;s New</div>
            <ul className="space-y-1.5">
              {config.releaseNotes.map((note, i) => (
                <li key={i} className="text-sm text-gray-700 dark:text-gray-300 flex gap-2">
                  <span className="text-blue-600 dark:text-blue-400">•</span>{note}
                </li>
              ))}
            </ul>
          </div>
        )}

        {mode === 'force' && (
          <div className="mb-5 flex items-start gap-2.5 rounded-xl bg-amber-50 dark:bg-amber-900/20 p-3.5 text-sm text-amber-800 dark:text-amber-300">
            <ShieldAlert size={18} className="shrink-0 mt-0.5" />
            This update is required to continue using Rentivo.
          </div>
        )}

        <div className="flex flex-col gap-3">
          <button
            onClick={() => startUpdate(config.apkDownloadUrl)}
            className="w-full rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 py-3.5 text-sm font-semibold text-white active:scale-[0.98] transition-transform"
          >
            Update Now
          </button>
          {mode === 'optional' && (
            <button
              onClick={handleLater}
              className="w-full py-2 text-sm font-medium text-gray-500 dark:text-gray-400"
            >
              Later
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
