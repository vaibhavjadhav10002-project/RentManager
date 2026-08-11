'use client'
import { useState } from 'react'
import Sidebar from './Sidebar'
import Topbar from './Topbar'
import { OwnerBottomNav } from './OwnerBottomNav'
import OwnerMoreSheet from './OwnerMoreSheet'
import { PropertyProvider } from './PropertyContext'
import ForcePasswordChangeModal from './ForcePasswordChangeModal'
import { OwnerThemeProvider } from '@/components/owner/ui'
import type { Profile } from '@/types'

function OwnerShellInner({ children, profile }: { children: React.ReactNode; profile: Profile }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const [mustChangePw, setMustChangePw] = useState(profile.must_change_password)

  return (
    <PropertyProvider>
      {mustChangePw && (
        <ForcePasswordChangeModal userId={profile.id} onDone={() => setMustChangePw(false)} />
      )}
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex">
        <Sidebar
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          userName={profile.full_name}
        />
        <div className="flex-1 flex flex-col lg:ml-56">
          <Topbar onMenuClick={() => setSidebarOpen(true)} />
          <main id="main-content" className="flex-1 p-5 pb-28 lg:p-7 lg:pb-7 animate-fade-in">
            {children}
          </main>
        </div>
        <OwnerBottomNav onMoreClick={() => setMoreOpen(true)} />
        <OwnerMoreSheet open={moreOpen} onClose={() => setMoreOpen(false)} userName={profile.full_name} />
      </div>
    </PropertyProvider>
  )
}

/**
 * OwnerShell wraps everything in OwnerThemeProvider (introduced O1.1).
 * The provider defaults to dark, persists dark/light/system separately
 * from the Tenant Portal's theme, and also keeps the global `.dark` class
 * in sync so pages not yet migrated to `owner-*` tokens keep rendering
 * exactly as before. Sidebar and Topbar were redesigned in O1.3 and now
 * read `owner-*` tokens directly; Topbar manages its own theme-menu state
 * via useOwnerTheme() rather than taking darkMode/onToggleDark as props.
 */
export default function OwnerShell(props: { children: React.ReactNode; profile: Profile }) {
  return (
    <OwnerThemeProvider initialPreference="system">
      <OwnerShellInner {...props} />
    </OwnerThemeProvider>
  )
}
