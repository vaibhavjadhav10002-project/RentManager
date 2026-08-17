'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  getProperties, getRooms, getTenants, getPayments, getExpenses,
  getComplaints, getNoticesForProperty, getVisitors, getParcels, getWaitingList, getRoomChanges,
  getBackupSettings, upsertBackupSettings, getBackupRuns, getBackupFileUrl,
} from '@/lib/supabase/queries'
import { toast } from 'sonner'
import { DownloadCloud, Loader2, ShieldCheck, FileJson, Clock, CheckCircle2, XCircle, ExternalLink } from 'lucide-react'
import type { BackupSettings, BackupRun } from '@/types'
import { saveBlob } from '@/lib/native/share'
import { usePullToRefreshHandler } from '@/lib/native/pullToRefresh'

/**
 * Manual Backup exports every property the owner has, in full — not scoped to the
 * currently-selected property, since a backup that silently excludes properties
 * would be worse than no backup at all. Every table read here already exists;
 * this page only orchestrates and packages, it adds no new queries or schema.
 */
export default function BackupPage() {
  const [refreshKey, setRefreshKey] = useState(0)
  usePullToRefreshHandler(() => setRefreshKey(k => k + 1))
  const [exporting, setExporting] = useState(false)
  const [lastExport, setLastExport] = useState<{ at: string; properties: number; records: number } | null>(null)

  const [ownerId, setOwnerId] = useState<string | null>(null)
  const [settings, setSettings] = useState<BackupSettings | null>(null)
  const [runs, setRuns] = useState<BackupRun[]>([])
  const [settingsLoading, setSettingsLoading] = useState(true)
  const [savingSettings, setSavingSettings] = useState(false)

  useEffect(() => {
    async function loadAutoBackupData() {
      setSettingsLoading(true)
      try {
        const sb = createClient()
        const { data: { user } } = await sb.auth.getUser()
        if (!user) { setSettingsLoading(false); return }
        setOwnerId(user.id)
        const [s, r] = await Promise.all([getBackupSettings(user.id), getBackupRuns(user.id)])
        setSettings(s as BackupSettings | null)
        setRuns((r ?? []) as BackupRun[])
      } catch { toast.error('Failed to load automatic backup settings') }
      setSettingsLoading(false)
    }
    loadAutoBackupData()
  }, [refreshKey])

  async function toggleEnabled(enabled: boolean) {
    if (!ownerId) return
    setSavingSettings(true)
    try {
      const updated = await upsertBackupSettings(ownerId, { enabled, frequency: settings?.frequency ?? 'daily', retention_count: settings?.retention_count ?? 7 })
      setSettings(updated as BackupSettings)
      toast.success(enabled ? 'Automatic backup enabled' : 'Automatic backup disabled')
    } catch (e: any) { toast.error(e.message || 'Failed to update settings') }
    setSavingSettings(false)
  }

  async function changeFrequency(frequency: 'daily' | 'weekly') {
    if (!ownerId) return
    setSavingSettings(true)
    try {
      const updated = await upsertBackupSettings(ownerId, { enabled: settings?.enabled ?? false, frequency, retention_count: settings?.retention_count ?? 7 })
      setSettings(updated as BackupSettings)
      toast.success('Frequency updated')
    } catch (e: any) { toast.error(e.message || 'Failed to update settings') }
    setSavingSettings(false)
  }

  async function downloadRun(filePath: string) {
    try {
      const url = await getBackupFileUrl(filePath)
      window.open(url, '_blank')
    } catch (e: any) { toast.error('Could not open this backup: ' + e.message) }
  }

  async function runBackup() {
    setExporting(true)
    try {
      const properties = await getProperties()
      if (!properties || properties.length === 0) { toast.error('No properties to back up'); setExporting(false); return }

      let recordCount = 0
      const bundle = await Promise.all(properties.map(async (property: any) => {
        const [rooms, tenants, payments, expenses, complaints, notices, visitors, parcels, waitingList, roomChanges] = await Promise.all([
          getRooms(property.id), getTenants(property.id), getPayments(property.id), getExpenses(property.id),
          getComplaints(property.id), getNoticesForProperty(property.id), getVisitors(property.id, true),
          getParcels(property.id, true), getWaitingList(property.id, true), getRoomChanges(property.id),
        ])
        const counts = [rooms, tenants, payments, expenses, complaints, notices, visitors, parcels, waitingList, roomChanges]
        counts.forEach(c => { recordCount += (c?.length ?? 0) })
        return { property, rooms, tenants, payments, expenses, complaints, notices, visitors, parcels, waitingList, roomChanges }
      }))

      const exportedAt = new Date().toISOString()
      const payload = {
        backup_format: 'pg-manager-saas-v1',
        exported_at: exportedAt,
        property_count: properties.length,
        data: bundle,
      }

      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
      await saveBlob(blob, `rentivo-backup-${exportedAt.slice(0, 10)}.json`)

      setLastExport({ at: exportedAt, properties: properties.length, records: recordCount })
      toast.success('Backup downloaded!')
    } catch (e: any) {
      toast.error('Backup failed: ' + e.message)
    }
    setExporting(false)
  }

  return (
    <div className="space-y-6 max-w-xl">
      <div>
        <h1 className="text-xl font-extrabold text-owner-fg">Manual Backup</h1>
        <p className="text-sm text-owner-muted">Download a full copy of your data, any time</p>
      </div>

      <div className="bg-owner-surface rounded-owner-xl border border-owner-border shadow-owner-xs p-6 space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-xl bg-owner-primary/10 text-owner-primary flex items-center justify-center flex-shrink-0">
            <FileJson className="w-5 h-5" />
          </div>
          <div>
            <div className="text-sm font-bold text-owner-fg">Everything, in one file</div>
            <p className="text-xs text-owner-muted mt-1">
              Properties, rooms, tenants, payments, expenses, complaints, notices, visitors, parcels,
              waiting list, and room-change history — for every property you own, packaged as a single
              JSON file you can store wherever you like.
            </p>
          </div>
        </div>

        <button onClick={runBackup} disabled={exporting}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-owner-primary hover:bg-owner-primary-hover text-white rounded-owner-lg text-sm font-semibold transition disabled:opacity-50">
          {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <DownloadCloud className="w-4 h-4" />}
          {exporting ? 'Preparing backup…' : 'Download Backup Now'}
        </button>

        {lastExport && (
          <div className="flex items-center gap-2 text-xs text-green-700 bg-green-50 rounded-xl px-3 py-2.5">
            <ShieldCheck className="w-4 h-4 flex-shrink-0" />
            Last backup: {new Date(lastExport.at).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
            {' '}· {lastExport.properties} propert{lastExport.properties === 1 ? 'y' : 'ies'} · {lastExport.records} records
          </div>
        )}
      </div>

      {/* Automatic Backup (Phase 5.13) */}
      <div className="bg-owner-surface rounded-owner-xl border border-owner-border shadow-owner-xs p-6 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center flex-shrink-0">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-bold text-owner-fg">Automatic Backup</div>
              <p className="text-xs text-owner-muted mt-1">
                Runs on its own schedule and stores backups in secure cloud storage — nothing to remember.
              </p>
            </div>
          </div>
          {settingsLoading ? (
            <Loader2 className="w-4 h-4 animate-spin text-owner-muted-subtle flex-shrink-0" />
          ) : (
            <button onClick={() => toggleEnabled(!settings?.enabled)} disabled={savingSettings}
              className={`flex-shrink-0 w-11 h-6 rounded-full transition relative disabled:opacity-50 ${settings?.enabled ? 'bg-owner-primary' : 'bg-owner-bg-subtle'}`}>
              <span className={`absolute top-0.5 w-5 h-5 bg-owner-surface rounded-full shadow transition-transform ${settings?.enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </button>
          )}
        </div>

        {settings?.enabled && (
          <div className="flex items-center gap-2 pl-14">
            <span className="text-xs font-semibold text-owner-muted">Frequency:</span>
            {(['daily', 'weekly'] as const).map(f => (
              <button key={f} onClick={() => changeFrequency(f)} disabled={savingSettings}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition disabled:opacity-50 ${settings.frequency === f ? 'bg-owner-primary text-owner-primary-fg' : 'bg-owner-surface-hover text-owner-muted hover:opacity-80'}`}>
                {f === 'daily' ? 'Daily' : 'Weekly'}
              </button>
            ))}
          </div>
        )}

        {settings?.last_run_at && (
          <p className="text-xs text-owner-muted-subtle pl-14">
            Last automatic backup: {new Date(settings.last_run_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </p>
        )}

        {runs.length > 0 && (
          <div className="pl-14 space-y-1.5 pt-1">
            <div className="text-xs font-semibold text-owner-muted mb-1">Recent runs</div>
            {runs.slice(0, 5).map(r => (
              <div key={r.id} className="flex items-center justify-between text-xs gap-2">
                <div className="flex items-center gap-1.5 text-owner-muted">
                  {r.status === 'success' ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500" /> : r.status === 'failed' ? <XCircle className="w-3.5 h-3.5 text-red-500" /> : <Loader2 className="w-3.5 h-3.5 animate-spin text-owner-muted-subtle" />}
                  {new Date(r.started_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                  {r.status === 'success' && r.record_count != null && <span>· {r.record_count} records</span>}
                  {r.status === 'failed' && r.error_message && <span className="text-red-500 truncate max-w-[160px]">· {r.error_message}</span>}
                </div>
                {r.status === 'success' && r.file_path && (
                  <button onClick={() => downloadRun(r.file_path!)} className="flex items-center gap-1 text-owner-primary hover:text-owner-primary-hover font-semibold flex-shrink-0">
                    <ExternalLink className="w-3 h-3" /> Open
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <p className="text-xs text-owner-muted-subtle">
        Manual Backup above is an on-demand export. Automatic Backup runs unattended on the schedule you
        choose and keeps the most recent backups in cloud storage. Restoring from either is handled separately.
      </p>
    </div>
  )
}
