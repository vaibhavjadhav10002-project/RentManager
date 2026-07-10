import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import webpush from 'web-push'

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

    const payload: SendPushBody = await req.json()
    const { user_ids, title, body, url = '/', tag } = payload

    if (!user_ids?.length || !title || !body) {
      return NextResponse.json({ error: 'user_ids, title, and body are required' }, { status: 400 })
    }

    const sb = serviceClient()

    // Log to notification_log for every recipient regardless of push
    // delivery outcome — this is what powers the notification bell/history,
    // so it should never be missing even if the browser blocked the push.
    await sb.from('notification_log').insert(
      user_ids.map(user_id => ({ user_id, title, body, url }))
    )

    const { data: subs } = await sb
      .from('push_subscriptions')
      .select('id, user_id, endpoint, p256dh, auth_key')
      .in('user_id', user_ids)

    if (!subs || subs.length === 0) {
      return NextResponse.json({ sent: 0, logged: user_ids.length })
    }

    const results = await Promise.allSettled(
      subs.map(sub =>
        webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth_key },
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
        if (statusCode === 404 || statusCode === 410) deadEndpoints.push(subs[i].endpoint)
      }
    })
    if (deadEndpoints.length > 0) {
      await sb.from('push_subscriptions').delete().in('endpoint', deadEndpoints)
    }

    const sent = results.filter(r => r.status === 'fulfilled').length
    return NextResponse.json({ sent, logged: user_ids.length })
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? 'Failed to send notification' }, { status: 500 })
  }
}
