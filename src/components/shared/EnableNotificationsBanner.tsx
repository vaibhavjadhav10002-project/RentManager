'use client'
import { useEffect, useState } from 'react'
import { Bell, Loader2 } from 'lucide-react'
import { isPushSupported, getNotificationPermissionState, enablePushNotifications } from '@/lib/push'
import { toast } from 'sonner'

// Dismissing no longer hides this for good — "Not now" only postpones it
// for a few days (localStorage, so it survives app restarts, not just
// this tab/session) and then it comes back. Without native
// notifications enabled, a tenant/owner simply won't get rent reminders,
// approvals, or messages while the app is closed — worth being
// persistent about rather than a one-tap-forever dismiss.
const SNOOZE_DAYS = 3
const SNOOZE_KEY = 'notif-banner-snoozed-until'

export default function EnableNotificationsBanner() {
  const [show, setShow] = useState(false)
  const [enabling, setEnabling] = useState(false)

  useEffect(() => {
    async function check() {
      if (!isPushSupported()) return
      const snoozedUntil = Number(localStorage.getItem(SNOOZE_KEY) ?? 0)
      if (Date.now() < snoozedUntil) return
      const state = await getNotificationPermissionState()
      if (state === 'default') setShow(true)
    }
    check()
  }, [])

  async function handleEnable() {
    setEnabling(true)
    const ok = await enablePushNotifications()
    setEnabling(false)
    if (ok) {
      toast.success('Notifications enabled!')
      setShow(false)
    } else {
      toast.error('Could not enable notifications — check your browser settings')
    }
  }

  function snooze() {
    localStorage.setItem(SNOOZE_KEY, String(Date.now() + SNOOZE_DAYS * 24 * 60 * 60 * 1000))
    setShow(false)
  }

  if (!show) return null

  return (
    <div className="flex items-center gap-3 bg-blue-50 border border-blue-100 rounded-2xl px-4 py-3 mb-4">
      <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
        <Bell className="w-4 h-4 text-blue-600" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-gray-900">Turn on notifications</div>
        <div className="text-xs text-gray-500">Without this you won&apos;t get rent reminders, approvals, or messages while the app is closed.</div>
      </div>
      <div className="flex-shrink-0 flex flex-col items-stretch gap-1">
        <button onClick={handleEnable} disabled={enabling}
          className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition disabled:opacity-50">
          {enabling && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Enable
        </button>
        <button onClick={snooze} className="text-[11px] text-gray-400 hover:text-gray-600 text-center">
          Not now
        </button>
      </div>
    </div>
  )
}
