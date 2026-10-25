import {
  LayoutDashboard, BedDouble, Users, IndianRupee, ShieldCheck,
  MessageSquareWarning, TrendingDown, BarChart3, Settings,
  Building2, MessageCircle, Megaphone, FileText,
  QrCode, UserCheck, Package, Users2, Repeat, DownloadCloud, UploadCloud, Archive,
  Inbox, Bell,
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

/** Destinations pinned to the mobile bottom nav (Home, Tenants, Properties, Finances). */
export const OWNER_BOTTOM_NAV_HREFS = ['/dashboard', '/tenants', '/properties', '/payments']

export const OWNER_MORE_NAV = OWNER_NAV.filter(item => !OWNER_BOTTOM_NAV_HREFS.includes(item.href))

export interface OwnerFeatureGroup {
  title: string
  items: { href: string; title: string; subtitle: string; icon: React.ComponentType<{ className?: string }>; tone: 'primary' | 'info' | 'success' | 'warning' | 'purple' | 'teal' | 'danger' }[]
}

/**
 * Grouped list for the mobile "All features" page (/more). Every href here
 * is an existing route from OWNER_NAV — grouping only, no new pages.
 */
export const OWNER_FEATURE_GROUPS: OwnerFeatureGroup[] = [
  {
    title: 'Operations',
    items: [
      { href: '/properties', title: 'Properties', subtitle: 'Manage your PGs', icon: Building2, tone: 'primary' },
      { href: '/rooms', title: 'Rooms & Beds', subtitle: 'Occupancy and vacancies', icon: BedDouble, tone: 'primary' },
      { href: '/complaints', title: 'Issues', subtitle: 'Track and resolve', icon: MessageSquareWarning, tone: 'info' },
      { href: '/visitors', title: 'Visitors', subtitle: 'Visitor log', icon: UserCheck, tone: 'success' },
      { href: '/parcels', title: 'Parcels', subtitle: 'Deliveries for tenants', icon: Package, tone: 'info' },
      { href: '/room-change', title: 'Room Change', subtitle: 'Moves between rooms', icon: Repeat, tone: 'teal' },
    ],
  },
  {
    title: 'Growth',
    items: [
      { href: '/waiting-list', title: 'Waiting List', subtitle: 'Capture and convert inquiries', icon: Users2, tone: 'success' },
    ],
  },
  {
    title: 'Finance',
    items: [
      { href: '/payments', title: 'Payments', subtitle: 'Rent and dues', icon: IndianRupee, tone: 'success' },
      { href: '/approvals', title: 'Approvals', subtitle: 'Payments and tenant requests', icon: ShieldCheck, tone: 'purple' },
      { href: '/expenses', title: 'Expenses', subtitle: 'Track what you spend', icon: TrendingDown, tone: 'warning' },
      { href: '/reports', title: 'Reports & Analytics', subtitle: 'P&L, dues, collections', icon: BarChart3, tone: 'info' },
    ],
  },
  {
    title: 'Tenant experience',
    items: [
      { href: '/messages', title: 'Messages', subtitle: 'Chat with tenants', icon: MessageCircle, tone: 'success' },
      { href: '/inbox', title: 'Inbox', subtitle: 'Requests from tenants', icon: Inbox, tone: 'info' },
      { href: '/notices', title: 'Notices', subtitle: 'Post to the notice board', icon: Megaphone, tone: 'purple' },
      { href: '/documents', title: 'Documents', subtitle: 'Agreements and files', icon: FileText, tone: 'teal' },
      { href: '/tenant-cards', title: 'Tenant Cards', subtitle: 'QR and ID cards', icon: QrCode, tone: 'primary' },
      { href: '/notifications', title: 'Notifications', subtitle: 'All alerts', icon: Bell, tone: 'warning' },
    ],
  },
  {
    title: 'Data & account',
    items: [
      { href: '/backup', title: 'Backup', subtitle: 'Download your data', icon: DownloadCloud, tone: 'teal' },
      { href: '/restore', title: 'Restore', subtitle: 'Restore from a backup', icon: UploadCloud, tone: 'teal' },
      { href: '/archive', title: 'Archive', subtitle: 'Archived records', icon: Archive, tone: 'info' },
      { href: '/settings', title: 'Settings', subtitle: 'Profile and preferences', icon: Settings, tone: 'primary' },
    ],
  },
]
