'use client'
import { useState } from 'react'
import { Menu, Search, Bell, Sun, Moon, ChevronDown, Building2, Layers, Plus } from 'lucide-react'
import { useProperty } from './PropertyContext'
import { cn } from '@/lib/utils'

interface Props {
  onMenuClick: () => void
  darkMode: boolean
  onToggleDark: () => void
}

export default function Topbar({ onMenuClick, darkMode, onToggleDark }: Props) {
  const { properties, activeId, setActiveId, active } = useProperty()
  const [propOpen, setPropOpen] = useState(false)
  const [search, setSearch] = useState('')

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
              <button className="w-full flex items-center gap-2 px-4 py-2.5 text-blue-600 text-sm font-semibold hover:bg-blue-50 transition">
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
        <button className="relative p-2 rounded-xl bg-gray-100 hover:bg-gray-200 transition text-gray-500">
          <Bell className="w-4 h-4" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white" />
        </button>
      </div>
    </header>
  )
}
