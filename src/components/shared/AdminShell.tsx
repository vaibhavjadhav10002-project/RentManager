'use client'
import { useState } from 'react'
import AdminSidebar from './AdminSidebar'
import AdminTopbar from './AdminTopbar'
import PageTransition from './PageTransition'
import PullToRefresh from './PullToRefresh'

export default function AdminShell({ children, adminEmail }: { children: React.ReactNode; adminEmail: string }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <AdminSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} adminEmail={adminEmail} />
      <div className="flex-1 flex flex-col lg:ml-64 h-screen">
        <AdminTopbar onMenuClick={() => setSidebarOpen(true)} adminEmail={adminEmail} />
        <main className="flex-1 min-h-0 flex flex-col">
          <PullToRefresh className="p-5 lg:p-7">
            <PageTransition>{children}</PageTransition>
          </PullToRefresh>
        </main>
      </div>
    </div>
  )
}
