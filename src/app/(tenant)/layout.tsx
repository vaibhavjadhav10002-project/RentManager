import { TenantThemeProvider } from '@/components/tenant/ui'
import './tenant-theme.css'

// All 10 tabs + modals now use tenant-* tokens (Phase T2–T6 complete), so
// the theme engine can default to the device's actual preference instead
// of being pinned to light. Users can override from My Tenancy > Appearance.
export default function TenantLayout({ children }: { children: React.ReactNode }) {
  return <TenantThemeProvider initialPreference="system">{children}</TenantThemeProvider>
}
