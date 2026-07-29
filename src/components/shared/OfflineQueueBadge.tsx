'use client'
import { useEffect, useState, useCallback } from 'react'
import { getQueuedActions, subscribeToQueueChanges, flushOfflineQueue } from '@/lib/offlineQueue'
import { checkInVisitor, logParcel } from '@/lib/supabase/queries'
import { sendPushNotification } from '@/lib/push'
import { CloudOff, RefreshCw, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

// Keyed by the same `type` strings used when queuing (see Visitors/Parcels pages).
const EXECUTORS: Record<string, (payload: any) => Promise<void>> = {
  visitor_checkin: async (payload) => { await checkInVisitor(payload) },
  parcel_log: async (payload) => {
    // Mirrors the online path in the Parcels page — the tenant should still get
    // notified once this actually reaches the server, just later than usual.
    const parcel = await logParcel(payload) as any
    if (parcel?.tenant?.auth_user_id) {
      sendPushNotification({
        user_ids: [parcel.tenant.auth_user_id],
        title: '📦 Parcel Arrived',
        body: `A parcel${payload.courier_name ? ` from ${payload.courier_name}` : ''} is waiting for you at the office.`,
        url: '/portal', tag: 'parcel',
      })
    }
  },
}

export default function OfflineQueueBadge() {
  const [count, setCount] = useState(0)
  const [syncing, setSyncing] = useState(false)
  const [isOnline, setIsOnline] = useState(true)

  const refresh = useCallback(() => {
    setCount(getQueuedActions().length)
    setIsOnline(typeof navigator === 'undefined' ? true : navigator.onLine)
  }, [])

  const sync = useCallback(async () => {
    if (getQueuedActions().length === 0) return
    setSyncing(true)
    const { synced, failed } = await flushOfflineQueue(EXECUTORS)
    setSyncing(false)
    refresh()
    if (synced > 0) toast.success(`Synced ${synced} item${synced === 1 ? '' : 's'} recorded while offline`)
    if (failed > 0) toast.error(`${failed} item${failed === 1 ? '' : 's'} still couldn't sync — will retry later`)
  }, [refresh])

  useEffect(() => {
    refresh()
    const unsubscribe = subscribeToQueueChanges(refresh)
    window.addEventListener('online', sync)
    return () => { unsubscribe(); window.removeEventListener('online', sync) }
  }, [refresh, sync])

  if (count === 0) return null

  return (
    <button onClick={sync} disabled={syncing}
      className="flex items-center gap-1.5 px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-xl text-xs font-semibold transition disabled:opacity-60 flex-shrink-0"
      title={isOnline ? 'Tap to sync now' : 'Will sync automatically once you\'re back online'}>
      {syncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : isOnline ? <RefreshCw className="w-3.5 h-3.5" /> : <CloudOff className="w-3.5 h-3.5" />}
      {count} pending
    </button>
  )
}
