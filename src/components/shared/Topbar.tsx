'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Menu, Search, Bell, Sun, Moon, ChevronDown, Building2, Layers, Plus, Loader2 } from 'lucide-react'
import { useProperty } from './PropertyContext'
import { cn } from '@/lib/utils'
import { addProperty, getOwnerNotifications } from '@/lib/supabase/queries'
import { toast } from 'sonner'

interface Props {
  onMenuClick: () => void
  darkMode: boolean
  onToggleDark: () => void
}

export default function Topbar({ onMenuClick, darkMode, onToggleDark }: Props) {
  const router = useRouter()
  const { properties, activeId, setActiveId, active, refresh } = useProperty()
  const [propOpen, setPropOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ name: '', address: '', city: '', upi_id: '' })
  const [notifOpen, setNotifOpen] = useState(false)
  const [notifications, setNotifications] = useState<any[]>([])

  useEffect(() => {
    const propIds = activeId === 'all' ? properties.map(p => p.id) : [activeId]
    if (propIds.length === 0 || propIds.some(id => !id)) return
    getOwnerNotifications(propIds).then(setNotifications).catch(() => setNotifications([]))
  }, [activeId, properties])

  async function handleAddProperty() {
    if (!form.name.trim()) { toast.error('Property name is required'); return }
    setSaving(true)
    try {
      const created = await addProperty(form)
      toast.success('Property added!')
      setForm({ name: '', address: '', city: '', upi_id: '' })
      setAddOpen(false)
      setPropOpen(false)
      await refresh()
      if (created?.id) setActiveId(created.id)
    } catch (e: any) {
      toast.error(e.message ?? 'Failed to add property')
    }
    setSaving(false)
  }

  return (
    <header className="h-14 bg-white border-b border-gray-100 flex items-center px-4 gap-3 sticky top-0 z-30 shadow-sm">
      {/* Hamburger */}
      <button onClick={onMenuClick} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 lg:hidden">
        <Menu className="w-5 h-5" />
      </button>

      {/* Property Switcher */}
      <div className="relative">
        <button onClick={() => setPropOpen(o => !o)}
          className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-xl hover:bg-gray-100 transition min-w-[160px]">
          <Building2 className="w-4 h-4 text-blue-600" />
          <div className="flex-1 text-left">
            <div className="text-xs font-bold text-gray-900 leading-tight">
              {activeId === 'all' ? 'All Properties' : active?.name ?? 'Select PG'}
            </div>
            {activeId !== 'all' && active && (
              <div className="text-[10px] text-gray-400">{active.city}</div>
            )}
          </div>
          <ChevronDown className={cn('w-3.5 h-3.5 text-gray-400 transition-transform', propOpen && 'rotate-180')} />
        </button>

        {propOpen && (
          <div className="absolute top-full left-0 mt-1.5 w-64 bg-white rounded-xl shadow-lg border border-gray-200 z-50 overflow-hidden">
            {/* All Properties */}
            <button onClick={() => { setActiveId('all'); setPropOpen(false) }}
              className={cn('w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 text-left',
                activeId === 'all' && 'bg-blue-50')}>
              <Layers className="w-4 h-4 text-blue-500" />
              <div>
                <div className="text-sm font-semibold text-gray-900">All Properties</div>
                <div className="text-xs text-gray-400">Combined view · {properties.length} PGs</div>
              </div>
            </button>
            <div className="border-t border-gray-100" />
            {properties.map(p => (
              <button key={p.id} onClick={() => { setActiveId(p.id); setPropOpen(false) }}
                className={cn('w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 text-left border-b border-gray-50 last:border-0',
                  activeId === p.id && 'bg-blue-50')}>
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
                  {p.name.slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-gray-900 truncate">{p.name}</div>
                  <div className="text-xs text-gray-400">{p.city}</div>
                </div>
              </button>
            ))}
            <div className="border-t border-gray-100">
              <button onClick={() => { setAddOpen(true); setPropOpen(false) }}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-blue-600 text-sm font-semibold hover:bg-blue-50 transition">
                <Plus className="w-4 h-4" /> Add Property
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Search */}
      <div className="relative flex-1 max-w-xs hidden sm:block">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search tenants, rooms…"
          className="w-full pl-8 pr-3 py-1.5 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:outline-none focus:border-blue-500 transition" />
      </div>

      <div className="ml-auto flex items-center gap-2">
        {/* Dark mode */}
        <button onClick={onToggleDark}
          className="p-2 rounded-xl bg-gray-100 hover:bg-gray-200 transition text-gray-500">
          {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        {/* Notifications */}
        <div className="relative">
          <button onClick={() => setNotifOpen(o => !o)} aria-label="Notifications" className="relative p-2 rounded-xl bg-gray-100 hover:bg-gray-200 transition text-gray-500">
            <Bell className="w-4 h-4" />
            {notifications.length > 0 && (
              <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 bg-red-500 rounded-full border-2 border-white text-[9px] text-white font-bold flex items-center justify-center">
                {notifications.length > 9 ? '9+' : notifications.length}
              </span>
            )}
          </button>
          {notifOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setNotifOpen(false)} />
              <div className="absolute top-full right-0 mt-1.5 w-80 bg-white rounded-xl shadow-lg border border-gray-200 z-50 overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100 font-bold text-sm text-gray-900">Notifications</div>
                <div className="max-h-80 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="text-center py-8 text-sm text-gray-400">You're all caught up!</div>
                  ) : notifications.map(n => (
                    <button key={n.id} onClick={() => { setNotifOpen(false); router.push(n.link) }}
                      className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b border-gray-50 last:border-0 transition">
                      <div className="text-sm font-semibold text-gray-900">{n.title}</div>
                      <div className="text-xs text-gray-500 mt-0.5">{n.subtitle}</div>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Add Property Modal */}
      {addOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-base font-bold text-gray-900">Add Property</h2>
              <button onClick={() => setAddOpen(false)} className="text-gray-400 hover:text-gray-600 text-xl font-bold">×</button>
            </div>
            <div className="p-5 space-y-3">
              {[
                { key: 'name', label: 'Property Name *' },
                { key: 'address', label: 'Address' },
                { key: 'city', label: 'City' },
                { key: 'upi_id', label: 'UPI ID' },
              ].map(({ key, label }) => (
                <div key={key}>
                  <label className="text-xs font-semibold text-gray-600 block mb-1">{label}</label>
                  <input value={(form as any)[key]}
                    onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-500" />
                </div>
              ))}
            </div>
            <div className="px-5 py-4 border-t border-gray-100 flex gap-3">
              <button onClick={handleAddProperty} disabled={saving}
                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition disabled:opacity-50">
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                {saving ? 'Adding…' : 'Add Property'}
              </button>
              <button onClick={() => setAddOpen(false)}
                className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-semibold transition">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  )
}
