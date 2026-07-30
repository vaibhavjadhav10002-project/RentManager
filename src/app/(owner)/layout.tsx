import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import OwnerShell from '@/components/shared/OwnerShell'
import { EXPLORE_PROFILE } from '@/lib/explore/sample-data'
import './owner-theme.css'

export default async function OwnerLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    const cookieStore = await cookies()
    const isExploring = cookieStore.get('rentivo_explore')?.value === '1'
    if (isExploring) {
      return <OwnerShell profile={EXPLORE_PROFILE}>{children}</OwnerShell>
    }
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles').select('*').eq('id', user.id).single()

  if (!profile || profile.role === 'tenant') redirect('/portal')
  if (profile.role === 'super_admin') redirect('/admin')
  if (!profile.is_active) {
    await supabase.auth.signOut()
    redirect('/login?deactivated=1')
  }

  return <OwnerShell profile={profile}>{children}</OwnerShell>
}
