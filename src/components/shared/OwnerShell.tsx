'use client'
import { useState, useEffect } from 'react'
import Sidebar from './Sidebar'
import Topbar from './Topbar'
import { PropertyProvider } from './PropertyContext'
import type { Profile } from '@/types'

const DARK_MODE_KEY = 'pg-manager-dark-mode'

export default function OwnerShell({ children, profile }: { children: React.ReactNode; profile: Profile }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [darkMode, setDarkMode] = useState(false)
  const [mounted, setMounted] = useState(false)

  // Read the saved preference once on mount. Guarded behind `mounted` so the
  // server-rendered HTML and the first client render match (avoids a
  // hydration mismatch flash), then we apply the real preference right after.
  useEffect(() => {
    const saved = localStorage.getItem(DARK_MODE_KEY)
    if (saved === 'true') setDarkMode(true)
    setMounted(true)
  }, [])

  function toggleDark() {
    setDarkMode(d => {
      const next = !d
      localStorage.setItem(DARK_MODE_KEY, String(next))
      return next
    })
  }

  return (
    <PropertyProvider>
      <div className={mounted && darkMode ? 'dark' : ''}>
        <div className="min-h-screen bg-gray-50 dark:bg-slate-950 flex transition-colors">
          <Sidebar
            open={sidebarOpen}
            onClose={() => setSidebarOpen(false)}
            userName={profile.full_name}
          />
          <div className="flex-1 flex flex-col lg:ml-64">
            <Topbar
              onMenuClick={() => setSidebarOpen(true)}
              darkMode={darkMode}
              onToggleDark={toggleDark}
              userName={profile.full_name}
            />
            <main className="flex-1 p-5 lg:p-7 animate-fade-in">
              {children}
            </main>
          </div>
        </div>
      </div>
    </PropertyProvider>
  )
}
