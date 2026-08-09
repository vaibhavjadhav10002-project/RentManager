import {
  LayoutDashboard, BedDouble, Users, IndianRupee, ShieldCheck,
  MessageSquareWarning, TrendingDown, BarChart3, Settings,
  Building2, MessageCircle, Megaphone, FileText,
  QrCode, UserCheck, Package, Users2, Repeat, DownloadCloud, UploadCloud, Archive,
  Inbox,
} from 'lucide-react'

export interface OwnerNavItem {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  badge?: string
}

/**
 * Single source of truth for every Owner Dashboard destination — used by
 * the desktop Sidebar (full list) and the mobile floating bottom nav +
 * "More" sheet (4 pinned items + everything else). Keeping one array
 * means adding/renaming a page only ever happens in one place.
 */
export const OWNER_NAV: OwnerNavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/properties', label: 'Properties', icon: Building2 },
  { href: '/rooms', label: 'Rooms', icon: BedDouble },
  { href: '/tenants', label: 'Tenants', icon: Users },
  { href: '/payments', label: 'Payments', icon: IndianRupee },
  { href: '/approvals', label: 'Approvals', icon: ShieldCheck, badge: 'new' },
  { href: '/messages', label: 'Messages', icon: MessageCircle },
  { href: '/inbox', label: 'Inbox', icon: Inbox },
  { href: '/complaints', label: 'Complaints', icon: MessageSquareWarning },
  { href: '/notices', label: 'Notices', icon: Megaphone },
  { href: '/documents', label: 'Documents', icon: FileText },
  { href: '/expenses', label: 'Expenses', icon: TrendingDown },
  { href: '/reports', label: 'Reports', icon: BarChart3 },
  { href: '/tenant-cards', label: 'Tenant Cards', icon: QrCode },
  { href: '/visitors', label: 'Visitors', icon: UserCheck },
  { href: '/parcels', label: 'Parcels', icon: Package },
  { href: '/waiting-list', label: 'Waiting List', icon: Users2 },
  { href: '/room-change', label: 'Room Change', icon: Repeat },
  { href: '/backup', label: 'Backup', icon: DownloadCloud },
  { href: '/restore', label: 'Restore', icon: UploadCloud },
  { href: '/archive', label: 'Archive', icon: Archive },
  { href: '/settings', label: 'Settings', icon: Settings },
]

/** The 4 destinations pinned to the mobile floating bottom nav. */
export const OWNER_BOTTOM_NAV_HREFS = ['/dashboard', '/tenants', '/payments', '/approvals']

export const OWNER_MORE_NAV = OWNER_NAV.filter(item => !OWNER_BOTTOM_NAV_HREFS.includes(item.href))
