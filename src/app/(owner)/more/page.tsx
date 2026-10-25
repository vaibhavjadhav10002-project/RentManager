'use client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ChevronRight, Settings, LogOut } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import MobilePropertyBar from '@/components/shared/MobilePropertyBar'
import { OWNER_FEATURE_GROUPS } from '@/components/shared/ownerNav'
import { useOwnerUser } from '@/components/shared/OwnerUserContext'
import { OwnerThemeToggle } from '@/components/owner/ui'

const TONE_BG = {
  primary: 'bg-owner-primary/12', success: 'bg-owner-success/12', warning: 'bg-owner-warning/12',
  purple: 'bg-owner-purple/12', info: 'bg-owner-info/12', teal: 'bg-owner-teal/12', danger: 'bg-owner-danger/12',
} as const
const TONE_FG = {
  primary: 'text-owner-primary', success: 'text-owner-success', warning: 'text-owner-warning',
  purple: 'text-owner-purple', info: 'text-owner-info', teal: 'text-owner-teal', danger: 'text-owner-danger',
} as const

export default function MorePage() {
  const router = useRouter()
  const { name } = useOwnerUser()

  async function logout() {
    const sb = createClient()
    await sb.auth.signOut()
    toast.success('Logged out')
    router.push('/login')
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-[28px] font-extrabold tracking-tight text-owner-fg">All features</h1>
        <Link href="/settings" aria-label="Settings"
          className="flex h-12 w-12 items-center justify-center rounded-full border border-owner-border bg-owner-surface text-owner-fg active:bg-owner-surface-hover">
          <Settings className="h-5 w-5" />
        </Link>
      </div>

      <div className="lg:hidden"><MobilePropertyBar /></div>

      {OWNER_FEATURE_GROUPS.map(group => (
        <section key={group.title}>
          <h2 className="mb-2 px-1 text-sm font-semibold text-owner-muted">{group.title}</h2>
          <div className="overflow-hidden rounded-3xl border border-owner-border bg-owner-surface">
            {group.items.map((item, i) => (
              <Link key={item.href} href={item.href} prefetch
                className={cn('flex items-center gap-4 px-4 py-4 active:bg-owner-surface-hover', i > 0 && 'border-t border-owner-border/60')}>
                <span className={cn('flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl', TONE_BG[item.tone])}>
                  <item.icon className={cn('h-6 w-6', TONE_FG[item.tone])} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-base font-semibold text-owner-fg">{item.title}</span>
                  <span className="block truncate text-sm text-owner-muted">{item.subtitle}</span>
                </span>
                <ChevronRight className="h-5 w-5 shrink-0 text-owner-muted-subtle" />
              </Link>
            ))}
          </div>
        </section>
      ))}

      <section className="overflow-hidden rounded-3xl border border-owner-border bg-owner-surface">
        <div className="flex items-center justify-between px-4 py-3.5">
          <span className="text-base font-semibold text-owner-fg">Appearance</span>
          <OwnerThemeToggle />
        </div>
        <button onClick={logout} className="flex w-full items-center gap-3 border-t border-owner-border/60 px-4 py-4 text-left text-owner-danger active:bg-owner-danger-subtle">
          <LogOut className="h-5 w-5" />
          <span className="text-base font-semibold">Log out{name ? ` (${name})` : ''}</span>
        </button>
      </section>
    </div>
  )
}
