'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Building2, Lock, User, LogIn } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const [role, setRole] = useState<'owner' | 'tenant'>('owner')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin() {
    if (!username || !password) { toast.error('Please fill all fields'); return }
    setLoading(true)
    const sb = createClient()

    // For tenants: username = phone, we construct the synthetic email
    const email = role === 'tenant'
      ? `${username.replace(/\D/g, '')}@pgmanager.local`
      : username

    const { data, error } = await sb.auth.signInWithPassword({ email, password })
    if (error) { toast.error(error.message); setLoading(false); return }

    const { data: profile } = await sb
      .from('profiles').select('role').eq('id', data.user.id).single()

    if (profile?.role === 'super_admin') router.push('/admin')
    else if (profile?.role === 'tenant') router.push('/portal')
    else router.push('/dashboard')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-purple-50 p-4">
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center shadow-lg mb-3">
            <Building2 className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-xl font-extrabold text-gray-900">PG Manager</h1>
          <p className="text-sm text-gray-500 mt-1">Smart property management</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">

          {/* Role toggle */}
          <div className="flex gap-1 p-1 bg-gray-100 rounded-xl mb-6">
            {(['owner', 'tenant'] as const).map(r => (
              <button key={r} onClick={() => setRole(r)}
                className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
                  role === r ? 'bg-white shadow text-blue-600' : 'text-gray-500'
                }`}>
                {r === 'owner' ? 'PG Owner' : 'Tenant'}
              </button>
            ))}
          </div>

          <div className="space-y-4">
            {/* Username */}
            <div>
              <label className="text-xs font-semibold text-gray-600 tracking-wide block mb-1.5">
                {role === 'owner' ? 'Email Address' : 'Mobile Number'}
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type={role === 'owner' ? 'email' : 'tel'}
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder={role === 'owner' ? 'owner@email.com' : '9876543210'}
                  onKeyDown={e => e.key === 'Enter' && handleLogin()}
                  className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="text-xs font-semibold text-gray-600 tracking-wide block mb-1.5">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Enter password"
                  onKeyDown={e => e.key === 'Enter' && handleLogin()}
                  className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>
              {role === 'tenant' && (
                <p className="text-xs text-gray-400 mt-1.5">Your username is your mobile number. Get credentials from your PG owner.</p>
              )}
            </div>

            <button
              onClick={handleLogin}
              disabled={loading}
              className="w-full py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 hover:opacity-90 transition disabled:opacity-50 mt-2"
            >
              <LogIn className="w-4 h-4" />
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </div>
        </div>

        <p className="text-center text-xs text-gray-400 mt-4">
          Don't have access? Contact your PG owner or admin.
        </p>
      </div>
    </div>
  )
}
