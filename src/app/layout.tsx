import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import Script from 'next/script'
import './globals.css'
import { Toaster } from 'sonner'
import PWARegister from '@/components/shared/PWARegister'
import NativeBootstrap from '@/components/shared/NativeBootstrap'
import { ExploreModeProvider } from '@/lib/explore/context'
import ExploreBadge from '@/components/shared/ExploreBadge'
import ExploreLockSheet from '@/components/shared/ExploreLockSheet'
import AppUpdateChecker from '@/components/shared/AppUpdateChecker'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Rentivo — Smart PG & Property Management',
  description: 'Manage your PG properties, tenants, payments and more.',
  manifest: '/manifest.json',
  icons: {
    icon: '/favicon-32.png',
    apple: '/icons/apple-touch-icon.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Rentivo',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#2563EB',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // Read at render time so this always reflects whatever project the app is
  // actually deployed against — never hardcode a project ref here, since a
  // wrong/stale hostname would silently do nothing (worse: waste a
  // connection slot on a domain that's never actually used).
  const supabaseHost = (() => {
    try { return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || '').origin } catch { return null }
  })()

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Opens the HTTPS connection to Supabase (DNS + TLS handshake)
            while the rest of the page is still parsing, so the very first
            actual data fetch each page makes doesn't pay that ~100-300ms
            setup cost on top of the request itself. */}
        {supabaseHost && <link rel="preconnect" href={supabaseHost} crossOrigin="anonymous" />}
      </head>
      <body className={inter.className}>
        {/* Runs before React hydrates — the earliest point any of our own
            JS can execute. On the native shell this hides the splash
            screen the moment the destination page's HTML has actually
            arrived and started rendering, instead of waiting for full
            React hydration + NativeBootstrap's useEffect to run (which
            could be another several hundred ms on a slower device/network,
            all spent staring at a static splash image with no actual
            progress). Guarded so it's a total no-op on web/PWA where
            `window.Capacitor` doesn't exist. Also guarded against the
            plugin not being ready yet (`catch` — bootstrapNative's own
            SplashScreen.hide() call remains as the reliable fallback). */}
        <Script id="early-splash-hide" strategy="beforeInteractive">
          {`try { window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.SplashScreen && window.Capacitor.Plugins.SplashScreen.hide(); } catch (e) {}`}
        </Script>
        <a href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:px-4 focus:py-2 focus:bg-blue-600 focus:text-white focus:rounded-xl focus:text-sm focus:font-semibold">
          Skip to content
        </a>
        <ExploreModeProvider>
          {children}
          <Toaster richColors position="bottom-right" />
          <PWARegister />
          <NativeBootstrap />
          <ExploreBadge />
          <ExploreLockSheet />
          <AppUpdateChecker />
        </ExploreModeProvider>
      </body>
    </html>
  )
}
