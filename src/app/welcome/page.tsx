'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Building2, Users2, QrCode, BarChart3, Sparkles, ArrowRight } from 'lucide-react'
import { enterExploreMode, markOnboarded } from '@/lib/explore/cookies'

const SCREENS = [
  {
    icon: Building2,
    title: 'Welcome to Rentivo',
    body: 'Smart PG & Property Management',
  },
  {
    icon: Building2,
    title: 'One place for everything',
    body: 'Manage unlimited properties, PGs, rooms and beds from one place.',
  },
  {
    icon: Users2,
    title: 'Stay on top of every tenant',
    body: 'Track tenants, rent collection, deposits, agreements and documents.',
  },
  {
    icon: QrCode,
    title: 'Get paid, effortlessly',
    body: 'Collect rent using QR, monitor occupancy and generate reports instantly.',
  },
  {
    icon: BarChart3,
    title: 'Beautifully organized',
    body: 'Everything your PG business needs — beautifully organized in one app.',
  },
] as const

export default function WelcomePage() {
  const [step, setStep] = useState(0)
  const router = useRouter()
  const isLast = step === SCREENS.length
  const current = SCREENS[step]

  function skip() {
    markOnboarded()
    router.push('/login')
  }

  function next() {
    if (step < SCREENS.length) setStep(step + 1)
  }

  function explore() {
    enterExploreMode()
    router.push('/dashboard')
  }

  function goLogin(mode?: 'signup') {
    markOnboarded()
    router.push(mode === 'signup' ? '/login?mode=signup' : '/login')
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 text-white relative overflow-hidden">
      {!isLast && (
        <button onClick={skip} className="absolute top-6 right-6 z-10 text-sm font-medium text-white/80 native-safe-top">
          Skip
        </button>
      )}

      <div className="flex-1 flex flex-col items-center justify-center px-8 text-center">
        {!isLast && current && (
          <div key={step} className="flex flex-col items-center animate-fade-in">
            <div className="mb-8 flex h-24 w-24 items-center justify-center rounded-3xl bg-white/15 backdrop-blur">
              <current.icon size={44} strokeWidth={1.75} />
            </div>
            <h1 className="text-3xl font-bold mb-4 max-w-sm leading-tight">{current.title}</h1>
            <p className="text-white/85 text-base max-w-xs leading-relaxed">{current.body}</p>
          </div>
        )}

        {isLast && (
          <div className="flex flex-col items-center animate-fade-in w-full max-w-sm">
            <div className="mb-8 flex h-24 w-24 items-center justify-center rounded-3xl bg-white/15 backdrop-blur">
              <Sparkles size={44} strokeWidth={1.75} />
            </div>
            <h1 className="text-3xl font-bold mb-3">Ready when you are</h1>
            <p className="text-white/85 text-base mb-10">
              Take a look around with real sample data, or jump straight in.
            </p>
            <div className="w-full flex flex-col gap-3">
              <button
                onClick={explore}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-white py-3.5 text-sm font-semibold text-indigo-700 active:scale-[0.98] transition-transform"
              >
                <Sparkles size={16} /> Explore Rentivo
              </button>
              <button
                onClick={() => goLogin('signup')}
                className="w-full rounded-xl border border-white/40 py-3.5 text-sm font-semibold text-white active:scale-[0.98] transition-transform"
              >
                Create Account
              </button>
              <button
                onClick={() => goLogin()}
                className="w-full py-2 text-sm font-medium text-white/75"
              >
                Login
              </button>
            </div>
          </div>
        )}
      </div>

      {!isLast && (
        <div className="pb-safe px-8 pb-10 flex flex-col items-center gap-6">
          <div className="flex gap-2">
            {SCREENS.map((_, i) => (
              <div key={i} className={`h-1.5 rounded-full transition-all ${i === step ? 'w-6 bg-white' : 'w-1.5 bg-white/35'}`} />
            ))}
          </div>
          <button
            onClick={next}
            className="w-full max-w-sm flex items-center justify-center gap-2 rounded-xl bg-white py-3.5 text-sm font-semibold text-indigo-700 active:scale-[0.98] transition-transform"
          >
            {step === SCREENS.length - 1 ? "Let's go" : 'Continue'} <ArrowRight size={16} />
          </button>
        </div>
      )}
    </div>
  )
}
