import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Node runtime — needed for the service-role client and larger response bodies.
export const runtime = 'nodejs'
// Backups across many owners/properties can take a while; keep this generous.
export const maxDuration = 300

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createClient(url, key, { auth: { persistSession: false } })
}

const TABLES = ['rooms', 'tenants', 'payments', 'expenses', 'complaints', 'notices', 'visitors', 'parcels', 'waiting_list', 'room_changes'] as const

function isDue(settings: { frequency: string; last_run_at: string | null }) {
  if (!settings.last_run_at) return true
  const hoursSince = (Date.now() - new Date(settings.last_run_at).getTime()) / 36e5
  return settings.frequency === 'weekly' ? hoursSince >= 24 * 7 : hoursSince >= 24
}

/**
 * Scheduled by vercel.json (see repo root) once a day; Vercel automatically sends
 * `Authorization: Bearer $CRON_SECRET` on cron-triggered requests, which is what
 * we check for below — this endpoint is a no-op for any other caller.
 *
 * Reuses the exact same set of tables as the Manual Backup page (5.12) and the
 * exact same JSON bundle shape, just written server-side with the service-role
 * client instead of the browser client (this runs with no logged-in user).
 */
export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'Missing SUPABASE_SERVICE_ROLE_KEY' }, { status: 500 })
  }

  const sb = serviceClient()
  const { data: allSettings, error: settingsError } = await sb.from('backup_settings').select('*').eq('enabled', true)
  if (settingsError) return NextResponse.json({ error: settingsError.message }, { status: 500 })

  const due = (allSettings ?? []).filter(isDue)
  const results: { owner_id: string; status: string; error?: string }[] = []

  for (const settings of due) {
    const runInsert = await sb.from('backup_runs')
      .insert({ owner_id: settings.owner_id, status: 'running' })
      .select().single()
    const runId = runInsert.data?.id

    try {
      const { data: properties, error: propError } = await sb.from('properties').select('*').eq('owner_id', settings.owner_id)
      if (propError) throw propError
      if (!properties || properties.length === 0) throw new Error('No properties found for this owner')

      let recordCount = 0
      const bundle = await Promise.all(properties.map(async (property) => {
        const perTable = await Promise.all(TABLES.map(t => sb.from(t).select('*').eq('property_id', property.id)))
        const tableData: Record<string, any> = {}
        perTable.forEach((res, i) => {
          if (res.error) throw res.error
          tableData[TABLES[i]] = res.data
          recordCount += res.data?.length ?? 0
        })
        return { property, ...tableData }
      }))

      const exportedAt = new Date().toISOString()
      const payload = { backup_format: 'pg-manager-saas-v1', exported_at: exportedAt, property_count: properties.length, data: bundle }
      const filePath = `${settings.owner_id}/backup-${exportedAt.slice(0, 19).replace(/[:T]/g, '-')}.json`

      const { error: uploadError } = await sb.storage.from('automatic-backups')
        .upload(filePath, JSON.stringify(payload, null, 2), { contentType: 'application/json' })
      if (uploadError) throw uploadError

      // Retention: keep only the newest N files for this owner.
      const { data: existingFiles } = await sb.storage.from('automatic-backups').list(settings.owner_id, { sortBy: { column: 'created_at', order: 'desc' } })
      if (existingFiles && existingFiles.length > settings.retention_count) {
        const toDelete = existingFiles.slice(settings.retention_count).map(f => `${settings.owner_id}/${f.name}`)
        if (toDelete.length > 0) await sb.storage.from('automatic-backups').remove(toDelete)
      }

      if (runId) {
        await sb.from('backup_runs').update({
          status: 'success', finished_at: new Date().toISOString(), file_path: filePath,
          property_count: properties.length, record_count: recordCount,
        }).eq('id', runId)
      }
      await sb.from('backup_settings').update({ last_run_at: exportedAt }).eq('owner_id', settings.owner_id)
      results.push({ owner_id: settings.owner_id, status: 'success' })
    } catch (e: any) {
      if (runId) {
        await sb.from('backup_runs').update({
          status: 'failed', finished_at: new Date().toISOString(), error_message: e.message,
        }).eq('id', runId)
      }
      results.push({ owner_id: settings.owner_id, status: 'failed', error: e.message })
      // Keep going — one owner's failure shouldn't stop everyone else's backup.
    }
  }

  return NextResponse.json({ checked: allSettings?.length ?? 0, due: due.length, results })
}
