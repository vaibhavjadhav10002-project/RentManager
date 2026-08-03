'use client'
import { useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { LayoutDashboard, IndianRupee, Users, ShieldCheck, MoreHorizontal } from 'lucide-react'
import Sidebar from './Sidebar'
import Topbar from './Topbar'
import OwnerMoreSheet from './OwnerMoreSheet'
import { OWNER_BOTTOM_NAV_HREFS } from './ownerNav'
import { PropertyProvider } from './PropertyContext'
import ForcePasswordChangeModal from './ForcePasswordChangeModal'
import { OwnerThemeProvider } from '@/components/owner/ui'
import { OwnerBottomNav } from '@/components/owner/ui/OwnerBottomNav'
import type { Profile } from '@/types'

// Phase 2 (Premium UI Upgrade): the 4 primary owner destinations, matching
// real existing routes exactly (no new pages), plus a 5th "More" entry
// that opens OwnerMoreSheet instead of navigating — every other existing
// page (Settings, Properties, Reports, etc.) is reachable from there,
// reusing Sidebar's own nav config (see ownerNav.ts) rather than
// duplicating it.
const MORE_KEY = '__more'
const BOTTOM_NAV_ITEMS = [
  { key: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: '/payments', label: 'Payments', icon: IndianRupee },
  { key: '/tenants', label: 'Tenants', icon: Users },
  { key: '/approvals', label: 'Approvals', icon: ShieldCheck },
  { key: MORE_KEY, label: 'More', icon: MoreHorizontal },
]

function OwnerShellInner({ children, profile }: { children: React.ReactNode; profile: Profile }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const [mustChangePw, setMustChangePw] = useState(profile.must_change_password)
  const pathname = usePathname()
  const router = useRouter()

  // Active tab: one of the 4 pinned routes if we're on it, otherwise
  // "More" is highlighted whenever we're on any of the other owner pages
  // (Settings, Properties, Reports, ...) so the bar always shows where
  // the person actually is.
  const pinnedMatch = OWNER_BOTTOM_NAV_HREFS.find(href => pathname?.startsWith(href))
  const activeBottomNavKey = pinnedMatch ?? MORE_KEY

  function handleBottomNavChange(key: string) {
    if (key === MORE_KEY) {
      setMoreOpen(true)
      return
    }
    router.push(key)
  }

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
        <div className="flex-1 flex flex-col lg:ml-56 min-w-0">
          <Topbar onMenuClick={() => setSidebarOpen(true)} />
          <main id="main-content" className="flex-1 min-w-0 p-5 pb-24 lg:p-7 lg:pb-7 animate-fade-in">
            {children}
          </main>
        </div>
        <OwnerBottomNav
          items={BOTTOM_NAV_ITEMS}
          activeKey={activeBottomNavKey}
          onChange={handleBottomNavChange}
        />
        <OwnerMoreSheet open={moreOpen} onClose={() => setMoreOpen(false)} userName={profile.full_name} />
      </div>
    </PropertyProvider>
  )
}

/**
 * OwnerShell wraps everything in OwnerThemeProvider (introduced O1.1,
 * made system-only in Premium UI Upgrade Phase 1). Sidebar and Topbar
 * were redesigned in O1.3 and read `owner-*` tokens directly; Phase 2
 * adds the mobile "More" sheet alongside the existing desktop Sidebar,
 * both now driven by the same `ownerNav.ts` config.
 */
export default function OwnerShell(props: { children: React.ReactNode; profile: Profile }) {
  return (
    <OwnerThemeProvider>
      <OwnerShellInner {...props} />
    </OwnerThemeProvider>
  )
}
