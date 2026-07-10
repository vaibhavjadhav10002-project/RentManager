'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Bell, Check } from 'lucide-react'
import { formatDate } from '@/lib/utils'

export default function NotificationBell() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<any[]>([])
  const [userId, setUserId] = useState<string | null>(null)

  async function load() {
    const sb = createClient()
    const { data: { user } } = await sb.auth.getUser()
    if (!user) return
    setUserId(user.id)
    const { data } = await sb.from('notification_log').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(25)
    setItems(data ?? [])
  }

  useEffect(() => {
    load()
    // Light polling instead of a persistent realtime channel — simpler,
    // free-tier friendly, and sufficient for a bell that just needs to feel
    // current without maintaining an open websocket per tab.
    const interval = setInterval(load, 30000)
    return () => clearInterval(interval)
  }, [])

  const unreadCount = items.filter(n => !n.read).length

  async function markAllRead() {
    if (!userId) return
    const sb = createClient()
    await sb.from('notification_log').update({ read: true }).eq('user_id', userId).eq('read', false)
    setItems(prev => prev.map(n => ({ ...n, read: true })))
  }

  async function handleClick(n: any) {
    setOpen(false)
    if (!n.read) {
      const sb = createClient()
      await sb.from('notification_log').update({ read: true }).eq('id', n.id)
      setItems(prev => prev.map(i => i.id === n.id ? { ...i, read: true } : i))
    }
    if (n.url) router.push(n.url)
  }

  return (
    <div className="relative">
      <button onClick={() => setOpen(o => !o)} aria-label="Notifications"
        className="relative p-2 rounded-xl bg-gray-100 hover:bg-gray-200 transition text-gray-500">
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 bg-red-500 rounded-full border-2 border-white text-[9px] text-white font-bold flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute top-full right-0 mt-1.5 w-80 bg-white rounded-xl shadow-lg border border-gray-200 z-50 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <span className="font-bold text-sm text-gray-900">Notifications</span>
              {unreadCount > 0 && (
                <button onClick={markAllRead} className="text-xs font-semibold text-blue-600 hover:underline flex items-center gap-1">
                  <Check className="w-3 h-3" /> Mark all read
                </button>
              )}
            </div>
            <div className="max-h-80 overflow-y-auto">
              {items.length === 0 ? (
                <div className="text-center py-8 text-sm text-gray-400">You're all caught up!</div>
              ) : items.map(n => (
                <button key={n.id} onClick={() => handleClick(n)}
                  className={`w-full text-left px-4 py-3 hover:bg-gray-50 border-b border-gray-50 last:border-0 transition ${!n.read ? 'bg-blue-50/40' : ''}`}>
                  <div className="flex items-start gap-2">
                    {!n.read && <span className="w-1.5 h-1.5 rounded-full bg-blue-600 mt-1.5 flex-shrink-0" />}
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-gray-900">{n.title}</div>
                      <div className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.body}</div>
                      <div className="text-[10px] text-gray-400 mt-1">{formatDate(n.created_at)}</div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
