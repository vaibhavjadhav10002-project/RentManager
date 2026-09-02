'use client'
import { useEffect, useState } from 'react'
import { useProperty } from '@/components/shared/PropertyContext'
import { getTenants, getAllTenants, getMessagesForTenant, sendMessageAsOwner, markMessagesReadByOwner } from '@/lib/supabase/queries'
import { formatDate, friendlyErrorMessage } from '@/lib/utils'
import { toast } from 'sonner'
import { Send, Loader2, MessageCircle, Search } from 'lucide-react'
import type { Tenant } from '@/types'
import { SkeletonList } from '@/components/shared/Skeleton'
import { usePullToRefreshHandler } from '@/lib/native/pullToRefresh'

export default function MessagesPage() {
  const { activeId, properties } = useProperty()
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [refreshKey, setRefreshKey] = useState(0)
  usePullToRefreshHandler(() => setRefreshKey(k => k + 1))
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Tenant | null>(null)
  const [thread, setThread] = useState<any[]>([])
  const [threadLoading, setThreadLoading] = useState(false)
  const [newMessage, setNewMessage] = useState('')
  const [sending, setSending] = useState(false)

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const list = activeId === 'all'
          ? await getAllTenants()
          : await getTenants(activeId)
        const active = (list ?? []).filter((t: Tenant) => t.status === 'active')
        setTenants(active)
      } catch { setTenants([]) }
      setLoading(false)
    }
    if (properties.length > 0 || activeId !== 'all') load()
  }, [activeId, properties, refreshKey])

  async function openThread(t: Tenant) {
    setSelected(t)
    setThreadLoading(true)
    try {
      const msgs = await getMessagesForTenant(t.id)
      setThread(msgs ?? [])
      await markMessagesReadByOwner(t.id)
    } catch { setThread([]) }
    setThreadLoading(false)
  }

  async function handleSend() {
    if (!newMessage.trim() || !selected) return
    setSending(true)
    try {
      const msg = await sendMessageAsOwner(selected.id, selected.property_id, newMessage.trim())
      setThread(prev => [...prev, msg])
      setNewMessage('')
    } catch (e: any) { toast.error(friendlyErrorMessage(e)) }
    setSending(false)
  }

  const filteredTenants = tenants.filter(t => t.name.toLowerCase().includes(search.toLowerCase()) || t.phone.includes(search))

  return (
    <div className="h-[calc(100vh-7rem)] flex gap-4">
      {/* Tenant list */}
      <div className="w-full sm:w-72 flex-shrink-0 bg-owner-surface rounded-2xl border border-owner-border shadow-sm flex flex-col overflow-hidden">
        <div className="p-4 border-b border-owner-border">
          <h1 className="text-base font-bold text-owner-fg mb-2">Messages</h1>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-owner-muted-subtle" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search tenants…"
              className="w-full pl-8 pr-3 py-2 bg-owner-surface-hover border border-owner-border rounded-xl text-xs focus:outline-none focus:border-owner-primary" />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <SkeletonList rows={4} />
          ) : filteredTenants.length === 0 ? (
            <div className="text-center py-8 text-sm text-owner-muted-subtle">No active tenants</div>
          ) : filteredTenants.map(t => (
            <button key={t.id} onClick={() => openThread(t)}
              className={`w-full text-left px-4 py-3 border-b border-owner-border hover:bg-owner-surface-hover transition flex items-center gap-3 ${selected?.id === t.id ? 'bg-owner-primary/10' : ''}`}>
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-owner-primary to-purple-600 flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
                {t.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-owner-fg truncate">{t.name}</div>
                <div className="text-xs text-owner-muted-subtle">Room {t.room?.room_number ?? '—'}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Thread */}
      <div className="flex-1 bg-owner-surface rounded-2xl border border-owner-border shadow-sm flex flex-col overflow-hidden">
        {!selected ? (
          <div className="flex-1 flex flex-col items-center justify-center text-owner-muted-subtle">
            <MessageCircle className="w-10 h-10 mb-2" />
            <p className="text-sm">Select a tenant to view messages</p>
          </div>
        ) : (
          <>
            <div className="px-5 py-3.5 border-b border-owner-border flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-owner-primary to-purple-600 flex items-center justify-center text-white font-bold text-xs">
                {selected.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
              </div>
              <div>
                <div className="text-sm font-bold text-owner-fg">{selected.name}</div>
                <div className="text-xs text-owner-muted-subtle">{selected.phone}</div>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-3 bg-owner-surface-hover">
              {threadLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-owner-muted-subtle" /></div>
              ) : thread.length === 0 ? (
                <div className="text-center py-8 text-sm text-owner-muted-subtle">No messages yet — say hello!</div>
              ) : thread.map(m => (
                <div key={m.id} className={`flex ${m.sender === 'owner' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm ${m.sender === 'owner' ? 'bg-owner-primary text-owner-primary-fg' : 'bg-owner-surface border border-owner-border text-owner-fg'}`}>
                    {m.body}
                    <div className={`text-[10px] mt-1 ${m.sender === 'owner' ? 'text-white/70' : 'text-owner-muted-subtle'}`}>{formatDate(m.created_at)}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="p-3 border-t border-owner-border flex gap-2">
              <input value={newMessage} onChange={e => setNewMessage(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSend()}
                placeholder="Type a message…"
                className="flex-1 px-4 py-2.5 bg-owner-surface-hover border border-owner-border rounded-xl text-sm focus:outline-none focus:border-owner-primary" />
              <button onClick={handleSend} disabled={sending || !newMessage.trim()}
                className="px-4 py-2.5 bg-owner-primary hover:bg-owner-primary-hover text-owner-primary-fg rounded-owner-lg disabled:opacity-50 transition">
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
