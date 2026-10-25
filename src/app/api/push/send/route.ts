import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'
import webpush from 'web-push'
import { sendFcmNotifications } from '@/lib/fcm'

// Node runtime required — web-push uses Node's crypto module, not available on edge.
export const runtime = 'nodejs'

const vapidPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
const vapidPrivate = process.env.VAPID_PRIVATE_KEY
const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:owner@example.com'

if (vapidPublic && vapidPrivate) {
  webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate)
}

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createClient(url, key, { auth: { persistSession: false } })
}

interface SendPushBody {
  user_ids: string[]
  title: string
  body: string
  url?: string
  tag?: string
}

export async function POST(req: NextRequest) {
  try {
    if (!vapidPublic || !vapidPrivate) {
      return NextResponse.json({ error: 'Push notifications are not configured (missing VAPID keys)' }, { status: 500 })
    }
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: 'Missing SUPABASE_SERVICE_ROLE_KEY' }, { status: 500 })
    }

    // This previously had no auth check at all — anyone who found the URL could
    // POST arbitrary user_ids/title/body and both spam another user's device
    // and pollute their notification history, with fully attacker-controlled
    // message content. Now requires a real session, and (unless the caller is
    // a super_admin) only allows notifying tenants of properties the caller
    // actually owns — matching the same ownership boundary every RLS policy in
    // this app already enforces at the database level.
    const authedClient = await createServerClient()
    const { data: { user } } = await authedClient.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const payload: SendPushBody = await req.json()
    let { user_ids, title, body, url = '/', tag } = payload

    if (!user_ids?.length || !title || !body) {
      return NextResponse.json({ error: 'user_ids, title, and body are required' }, { status: 400 })
    }

    const sb = serviceClient()

    const { data: callerProfile } = await sb.from('profiles').select('role').eq('id', user.id).single()
    if (callerProfile?.role !== 'super_admin') {
      const { data: ownedProperties } = await sb.from('properties').select('id').eq('owner_id', user.id)
      const ownedPropertyIds = (ownedProperties ?? []).map(p => p.id)
      const { data: ownedTenants } = ownedPropertyIds.length > 0
        ? await sb.from('tenants').select('auth_user_id').in('auth_user_id', user_ids).in('property_id', ownedPropertyIds)
        : { data: [] as { auth_user_id: string | null }[] }
      const allowedIds = new Set((ownedTenants ?? []).map(t => t.auth_user_id))
      user_ids = user_ids.filter(id => allowedIds.has(id))
      if (user_ids.length === 0) {
        return NextResponse.json({ error: 'None of the given user_ids belong to a tenant you own' }, { status: 403 })
      }
    }

    // Log to notification_log for every recipient regardless of push
    // delivery outcome — this is what powers the notification bell/history,
    // so it should never be missing even if the browser blocked the push.
    await sb.from('notification_log').insert(
      user_ids.map(user_id => ({ user_id, title, body, url }))
    )

    const { data: subs } = await sb
      .from('push_subscriptions')
      .select('id, user_id, endpoint, p256dh, auth_key, native_token, native_platform')
      .in('user_id', user_ids)

    if (!subs || subs.length === 0) {
      return NextResponse.json({ sent: 0, logged: user_ids.length })
    }

    // Web Push (browser/PWA) subscriptions — unchanged from before.
    const webSubs = subs.filter(s => s.p256dh && s.auth_key)
    // Native app (Capacitor) device tokens — see native/push.ts. These
    // can't go through web-push at all; they need FCM (Android) / APNs
    // (iOS) delivery, which requires a Firebase project + APNs key that
    // don't exist yet in this codebase (account-level setup, not code).
    const nativeSubs = subs.filter(s => s.native_token && s.native_platform)

    const results = await Promise.allSettled(
      webSubs.map(sub =>
        webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh!, auth: sub.auth_key! },
          },
          JSON.stringify({ title, body, url, tag })
        )
      )
    )

    // Clean up subscriptions that are no longer valid (uninstalled/expired)
    const deadEndpoints: string[] = []
    results.forEach((r, i) => {
      if (r.status === 'rejected') {
        const statusCode = (r.reason as any)?.statusCode
        if (statusCode === 404 || statusCode === 410) deadEndpoints.push(webSubs[i].endpoint)
      }
    })
    if (deadEndpoints.length > 0) {
      await sb.from('push_subscriptions').delete().in('endpoint', deadEndpoints)
    }

    let nativeSent = 0
    if (nativeSubs.length > 0) {
      // Android → real FCM delivery via Firebase Admin SDK (see
      // src/lib/fcm.ts). iOS/APNs is still unimplemented — needs
      // APNS_KEY_ID/APNS_TEAM_ID/APNS_PRIVATE_KEY from an Apple Developer
      // account, which this app doesn't have configured; those tokens are
      // silently skipped below exactly as before, so nothing regresses.
      const androidSubs = nativeSubs.filter(s => s.native_platform === 'android')
      if (androidSubs.length > 0 && process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
        const { sent, deadTokens } = await sendFcmNotifications(
          androidSubs.map(s => s.native_token!),
          { title, body, url, tag }
        )
        nativeSent += sent
        if (deadTokens.length > 0) {
          await sb.from('push_subscriptions').delete().in('native_token', deadTokens)
        }
      }
    }

    const sent = results.filter(r => r.status === 'fulfilled').length + nativeSent
    return NextResponse.json({ sent, logged: user_ids.length, nativeTokensSkipped: nativeSubs.length })
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? 'Failed to send notification' }, { status: 500 })
  }
}
