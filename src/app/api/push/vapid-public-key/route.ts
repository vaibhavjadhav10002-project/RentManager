import { NextResponse } from 'next/server'

// The VAPID *public* key is not secret — it's already shipped to every client via
// NEXT_PUBLIC_VAPID_PUBLIC_KEY and sent in the clear during subscription. This
// endpoint just gives the service worker (which has no access to Next.js env
// vars at runtime, unlike bundled client code) a way to fetch it when it needs
// to silently resubscribe after the browser invalidates a push subscription.
export async function GET() {
  const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  if (!key) return NextResponse.json({ error: 'Push not configured' }, { status: 500 })
  return NextResponse.json({ key })
}
