import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Called by the service worker's `pushsubscriptionchange` handler (see
 * public/sw.js) when the browser silently rotates or invalidates a push
 * subscription — without this, a user who'd already enabled notifications
 * would just stop receiving them with no visible sign anything broke.
 *
 * Uses the cookie-based server client (not the service-role client) because
 * a same-origin fetch from a service worker still carries the browser's
 * session cookies, so we can identify the user normally. If there's no
 * session available (e.g. it expired while the app was closed), this is a
 * no-op — there's nothing meaningful to do without a signed-in user, and
 * the next time they open the app, EnableNotificationsBanner-style flows
 * can pick it back up.
 */
export async function POST(req: NextRequest) {
  try {
    const { old_endpoint, endpoint, p256dh, auth_key } = await req.json()
    if (!endpoint || !p256dh || !auth_key) {
      return NextResponse.json({ error: 'endpoint, p256dh, and auth_key are required' }, { status: 400 })
    }

    const sb = await createClient()
    const { data: { user } } = await sb.auth.getUser()
    if (!user) return NextResponse.json({ skipped: true, reason: 'No active session' })

    if (old_endpoint && old_endpoint !== endpoint) {
      await sb.from('push_subscriptions').delete().eq('endpoint', old_endpoint)
    }
    const { error } = await sb.from('push_subscriptions').upsert({
      user_id: user.id, endpoint, p256dh, auth_key,
    }, { onConflict: 'user_id,endpoint' })
    if (error) throw error

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? 'Failed to resubscribe' }, { status: 500 })
  }
}
