import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const { pathname } = request.nextUrl

  // Public routes — always accessible
  const publicPaths = ['/login', '/join', '/welcome']
  const isPublic = publicPaths.some(p => pathname.startsWith(p))

  // Explore Mode: an unauthenticated visitor who tapped "Explore Rentivo"
  // on the first-launch screen (src/lib/explore/cookies.ts is the only
  // thing that ever sets this cookie). A real session is always checked
  // first above, so a real login always takes priority. Scoped to the
  // owner-area routes only (not /admin, not /portal).
  const isExploring = request.cookies.get('rentivo_explore')?.value === '1'
  const isOwnerArea = !pathname.startsWith('/admin') && !pathname.startsWith('/portal') && !isPublic

  if (!user && !isPublic) {
    if (isExploring && isOwnerArea) {
      return supabaseResponse
    }
    if (pathname === '/') {
      // Same decision RootPage.tsx used to make server-side (explore
      // cookie → dashboard, onboarded cookie → login, else → welcome) —
      // moved here so it happens using the SAME getUser() call already
      // made above, instead of RootPage doing its own redundant
      // getUser() + a second full request cycle before even reaching
      // this logic. This is the biggest single win for cold-launch
      // speed: was 4 sequential auth network round-trips before any
      // real content started loading, now it's 1.
      if (request.cookies.get('rentivo_onboarded')?.value !== '1') {
        return NextResponse.redirect(new URL('/welcome', request.url))
      }
      return NextResponse.redirect(new URL('/login', request.url))
    }
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (user && (pathname === '/login' || pathname === '/')) {
    // Redirect logged-in users to their dashboard based on role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role === 'super_admin') return NextResponse.redirect(new URL('/admin', request.url))
    if (profile?.role === 'tenant') return NextResponse.redirect(new URL('/portal', request.url))
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  // Protect admin routes
  if (pathname.startsWith('/admin')) {
    const { data: profile } = await supabase
      .from('profiles').select('role').eq('id', user!.id).single()
    if (profile?.role !== 'super_admin')
      return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  // Protect tenant portal
  if (pathname.startsWith('/portal')) {
    const { data: profile } = await supabase
      .from('profiles').select('role').eq('id', user!.id).single()
    if (profile?.role !== 'tenant')
      return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
