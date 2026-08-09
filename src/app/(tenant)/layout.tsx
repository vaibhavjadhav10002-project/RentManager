import { TenantThemeProvider } from '@/components/tenant/ui'
import './tenant-theme.css'

// Wires up the tenant-* design system (Phase T1, previously unused) around
// portal/page.tsx. `initialPreference="light"` (rather than the system
// default of "dark") because the 8 tabs not yet migrated to the new tokens
// (Tenancy, Payment History, Maintenance, Requests, Documents, Messages,
// Support, Notice Board) still use plain gray-900/white Tailwind classes
// that assume a light background — forcing dark here would make that text
// unreadable until every tab is migrated. Users can still switch to dark
// from Profile once ThemeToggle is wired in (T7).
export default function TenantLayout({ children }: { children: React.ReactNode }) {
  return <TenantThemeProvider initialPreference="light">{children}</TenantThemeProvider>
}
