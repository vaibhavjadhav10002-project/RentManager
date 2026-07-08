import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('role, is_active').eq('id', user.id).single()

  if (!profile || profile.role !== 'super_admin') redirect('/login')
  if (!profile.is_active) {
    await supabase.auth.signOut()
    redirect('/login?deactivated=1')
  }

  return <>{children}</>
}
