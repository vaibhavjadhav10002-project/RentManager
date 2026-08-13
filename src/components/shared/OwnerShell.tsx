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
      {/* h-[100dvh] + overflow-hidden here, NOT min-h-screen: this makes
          <main>'s scroll region a FIXED, viewport-derived height from the
          very first paint via flexbox math, instead of relying on the
          browser to notice — after async data changes the document's
          natural height — that a scrollbar is now needed. That "notice
          after the fact" step is exactly what was getting stuck on some
          Android WebView/Chrome-mobile builds (scroll only "woke up"
          after some unrelated DOM change, like opening the property
          dropdown, forced a reflow). With a fixed-height flex parent,
          <main>'s own overflow-y is live/deterministic from CSS alone —
          there's nothing for the engine to "notice" late. `position:
          fixed` elements (Sidebar, bottom nav, modals) are unaffected —
          they stay relative to the real viewport either way. */}
      <div className="h-[100dvh] overflow-hidden bg-gray-50 dark:bg-gray-900 flex">
        <Sidebar
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          userName={profile.full_name}
        />
        <div className="flex-1 flex flex-col lg:ml-56 min-w-0 h-full">
          <Topbar onMenuClick={() => setSidebarOpen(true)} />
          <main id="main-content" className="flex-1 min-h-0 overflow-y-auto p-5 pb-28 lg:p-7 lg:pb-7 animate-fade-in">
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
