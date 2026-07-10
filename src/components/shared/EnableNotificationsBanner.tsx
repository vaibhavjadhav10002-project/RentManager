'use client'
import { useEffect, useState } from 'react'
import { Bell, X, Loader2 } from 'lucide-react'
import { isPushSupported, getNotificationPermissionState, enablePushNotifications } from '@/lib/push'
import { toast } from 'sonner'

export default function EnableNotificationsBanner() {
  const [show, setShow] = useState(false)
  const [enabling, setEnabling] = useState(false)

  useEffect(() => {
    async function check() {
      if (!isPushSupported()) return
      if (sessionStorage.getItem('notif-banner-dismissed')) return
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

  function dismiss() {
    sessionStorage.setItem('notif-banner-dismissed', '1')
    setShow(false)
  }

  if (!show) return null

  return (
    <div className="flex items-center gap-3 bg-blue-50 border border-blue-100 rounded-2xl px-4 py-3 mb-4">
      <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
        <Bell className="w-4 h-4 text-blue-600" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-gray-900">Stay updated</div>
        <div className="text-xs text-gray-500">Enable notifications for rent reminders, notices, and complaint updates — even when the app is closed.</div>
      </div>
      <button onClick={handleEnable} disabled={enabling}
        className="flex-shrink-0 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition disabled:opacity-50">
        {enabling && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Enable
      </button>
      <button onClick={dismiss} aria-label="Dismiss" className="flex-shrink-0 text-gray-400 hover:text-gray-600">
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}
