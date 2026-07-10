import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Toaster } from 'sonner'
import PWARegister from '@/components/shared/PWARegister'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'PG Manager — Smart PG Management',
  description: 'Manage your PG properties, tenants, payments and more.',
  manifest: '/manifest.json',
  icons: {
    icon: '/favicon-32.png',
    apple: '/icons/apple-touch-icon.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'PG Manager',
  },
}

export const viewport: Viewport = {
  themeColor: '#2563EB',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        {children}
        <Toaster richColors position="bottom-right" />
        <PWARegister />
      </body>
    </html>
  )
}
