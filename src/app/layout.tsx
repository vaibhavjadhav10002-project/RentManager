import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Toaster } from 'sonner'
import PWARegister from '@/components/shared/PWARegister'
import NativeBootstrap from '@/components/shared/NativeBootstrap'
import { ExploreModeProvider } from '@/lib/explore/context'
import ExploreBadge from '@/components/shared/ExploreBadge'
import ExploreLockSheet from '@/components/shared/ExploreLockSheet'
import AppUpdateChecker from '@/components/shared/AppUpdateChecker'
import { ExperienceProvider } from '@/components/shared/ExperienceProvider'

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
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <a href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:px-4 focus:py-2 focus:bg-blue-600 focus:text-white focus:rounded-xl focus:text-sm focus:font-semibold">
          Skip to content
        </a>
        <ExperienceProvider>
          <ExploreModeProvider>
            {children}
            <Toaster richColors position="bottom-right" />
            <PWARegister />
            <NativeBootstrap />
            <ExploreBadge />
            <ExploreLockSheet />
            <AppUpdateChecker />
          </ExploreModeProvider>
        </ExperienceProvider>
      </body>
    </html>
  )
}
