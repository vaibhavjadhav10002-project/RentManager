'use client'
import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getProperties, getBackupRuns, getBackupFileUrl } from '@/lib/supabase/queries'
import { toast } from 'sonner'
import { UploadCloud, Loader2, AlertTriangle, CheckCircle2, History, FileJson } from 'lucide-react'
import type { Property, BackupRun } from '@/types'

// Backups from the two producers (Manual 5.12, Automatic 5.13) key their tables slightly
// differently (camelCase vs snake_case) — normalize both to real table names here rather
// than editing either already-shipped backup producer.
const KEY_TO_TABLE: Record<string, string> = {
  rooms: 'rooms', tenants: 'tenants', payments: 'payments', expenses: 'expenses',
  complaints: 'complaints', notices: 'notices', visitors: 'visitors', parcels: 'parcels',
  waitingList: 'waiting_list', waiting_list: 'waiting_list',
  roomChanges: 'room_changes', room_changes: 'room_changes',
}
// Columns that only exist in the backup because a query joined them in — never real columns.
const JOINED_KEYS = ['room', 'tenant', 'from_room', 'to_room', 'property']

interface ParsedBackup {
  exported_at: string
  property_count: number
  data: Array<{ property: { id: string; name: string }; [key: string]: any }>
}

interface TableResult { table: string; upserted: number; failed: number; firstError?: string }

export default function RestorePage() {
  const [myProperties, setMyProperties] = useState<Property[]>([])
  const [runs, setRuns] = useState<BackupRun[]>([])
  const [loading, setLoading] = useState(true)
  const [parsed, setParsed] = useState<ParsedBackup | null>(null)
  const [parseError, setParseError] = useState('')
  const [restoring, setRestoring] = useState(false)
  const [results, setResults] = useState<TableResult[] | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const sb = createClient()
        const { data: { user } } = await sb.auth.getUser()
        const props = await getProperties()
        setMyProperties(props as Property[])
        if (user) setRuns((await getBackupRuns(user.id)).filter((r: BackupRun) => r.status === 'success') as BackupRun[])
      } catch { toast.error('Failed to load your properties') }
      setLoading(false)
    }
    load()
  }, [])

  function parseBackupJson(text: string) {
    setResults(null)
    try {
      const json = JSON.parse(text)
      if (json.backup_format !== 'pg-manager-saas-v1' || !Array.isArray(json.data)) {
        setParseError('This file doesn\'t look like a PG Manager backup.')
        setParsed(null)
        return
      }
      setParsed(json as ParsedBackup)
      setParseError('')
    } catch {
      setParseError('Could not read that file — is it valid JSON?')
      setParsed(null)
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const text = await file.text()
    parseBackupJson(text)
  }

  async function handleLoadRun(run: BackupRun) {
    if (!run.file_path) return
    setLoading(true)
    try {
      const url = await getBackupFileUrl(run.file_path)
      const res = await fetch(url)
      const text = await res.text()
      parseBackupJson(text)
    } catch { toast.error('Could not load that backup file') }
    setLoading(false)
  }

  // Only properties the CURRENT owner still owns — Supabase RLS (owns_property())
  // enforces this on every insert too, so this is a friendlier UI-level filter on
  // top of a hard guarantee, not the only thing standing between backups and the
  // multi-tenant boundary.
  const matchingProperties = parsed
    ? parsed.data.filter(d => myProperties.some(p => p.id === d.property.id))
    : []
  const orphanedProperties = parsed
    ? parsed.data.filter(d => !myProperties.some(p => p.id === d.property.id))
    : []

  function stripJoinedKeys(row: Record<string, any>) {
    const clean = { ...row }
    JOINED_KEYS.forEach(k => delete clean[k])
    return clean
  }

  async function handleRestore() {
    if (!parsed) return
    if (!confirm(
      'This will restore data from the backup into your account.\n\n' +
      'Existing records with the same ID will be overwritten with the backup\'s values. ' +
      'Nothing currently in your account will be deleted — records not in the backup are left untouched.\n\n' +
      'Continue?'
    )) return

    setRestoring(true)
    const sb = createClient()
    const tableTotals = new Map<string, TableResult>()

    for (const propertyBundle of matchingProperties) {
      for (const [key, rows] of Object.entries(propertyBundle)) {
        if (key === 'property') continue
        const table = KEY_TO_TABLE[key]
        if (!table || !Array.isArray(rows) || rows.length === 0) continue

        const acc = tableTotals.get(table) ?? { table, upserted: 0, failed: 0 }
        for (const row of rows) {
          try {
            const { error } = await sb.from(table).upsert(stripJoinedKeys(row), { onConflict: 'id' })
            if (error) throw error
            acc.upserted++
          } catch (e: any) {
            acc.failed++
            if (!acc.firstError) acc.firstError = e.message
          }
        }
        tableTotals.set(table, acc)
      }
    }

    setResults(Array.from(tableTotals.values()))
    setRestoring(false)
    toast.success('Restore finished — see the summary below')
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-gray-400">
      <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading…
    </div>
  )

  return (
    <div className="space-y-6 max-w-xl">
      <div>
        <h1 className="text-xl font-extrabold text-gray-900">Backup Restore</h1>
        <p className="text-sm text-gray-500">Bring back data from a Manual or Automatic backup file</p>
      </div>

      <div className="flex items-start gap-2 bg-amber-50 border border-amber-100 rounded-2xl px-4 py-3 text-xs text-amber-700">
        <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
        <div>
          This is a <strong>merge restore</strong>: records from the backup are added back or overwrite
          current records with the same ID. Nothing currently in your account is ever deleted by a restore.
        </div>
      </div>

      {/* Choose a source */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
        <div className="text-sm font-bold text-gray-900">1. Choose a backup</div>

        <button onClick={() => fileInputRef.current?.click()}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-semibold transition">
          <UploadCloud className="w-4 h-4" /> Upload a Manual Backup file (.json)
        </button>
        <input ref={fileInputRef} type="file" accept="application/json" onChange={handleFileUpload} className="hidden" />

        {runs.length > 0 && (
          <div>
            <div className="text-xs font-semibold text-gray-500 mb-2 flex items-center gap-1"><History className="w-3.5 h-3.5" /> Or pick an Automatic Backup</div>
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {runs.map(r => (
                <button key={r.id} onClick={() => handleLoadRun(r)}
                  className="w-full flex items-center justify-between px-3 py-2 border border-gray-200 rounded-xl text-xs hover:bg-gray-50 transition">
                  <span className="text-gray-600">{new Date(r.started_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                  <span className="text-gray-400">{r.record_count} records</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {parseError && <p className="text-xs text-red-500">{parseError}</p>}
      </div>

      {/* Preview */}
      {parsed && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
          <div className="text-sm font-bold text-gray-900 flex items-center gap-2"><FileJson className="w-4 h-4" /> 2. Review before restoring</div>
          <p className="text-xs text-gray-500">
            Backup taken {new Date(parsed.exported_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
            {' '}· {parsed.property_count} propert{parsed.property_count === 1 ? 'y' : 'ies'} in the file
          </p>

          {matchingProperties.length === 0 ? (
            <p className="text-xs text-amber-600">None of the properties in this backup belong to your account — there's nothing to restore.</p>
          ) : (
            <div className="space-y-2">
              {matchingProperties.map(pb => {
                const total = Object.entries(pb).filter(([k]) => k !== 'property').reduce((s, [, v]) => s + (Array.isArray(v) ? v.length : 0), 0)
                return (
                  <div key={pb.property.id} className="flex items-center justify-between text-xs bg-gray-50 rounded-xl px-3 py-2">
                    <span className="font-semibold text-gray-700">{pb.property.name}</span>
                    <span className="text-gray-400">{total} records</span>
                  </div>
                )
              })}
            </div>
          )}

          {orphanedProperties.length > 0 && (
            <p className="text-xs text-gray-400">
              {orphanedProperties.length} propert{orphanedProperties.length === 1 ? 'y' : 'ies'} in this backup no longer belong to your account and will be skipped.
            </p>
          )}

          {matchingProperties.length > 0 && (
            <button onClick={handleRestore} disabled={restoring}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-semibold transition disabled:opacity-50">
              {restoring ? <Loader2 className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />}
              {restoring ? 'Restoring…' : 'Restore This Backup'}
            </button>
          )}
        </div>
      )}

      {/* Results */}
      {results && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-2">
          <div className="text-sm font-bold text-gray-900 flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-green-500" /> Restore Summary</div>
          {results.map(r => (
            <div key={r.table} className="flex items-center justify-between text-xs">
              <span className="text-gray-600 capitalize">{r.table.replace('_', ' ')}</span>
              <span className="text-gray-500">
                {r.upserted} restored{r.failed > 0 && <span className="text-red-500"> · {r.failed} failed</span>}
              </span>
            </div>
          ))}
          {results.some(r => r.failed > 0) && (
            <p className="text-xs text-gray-400 pt-1">
              Some rows failed — usually because something they referenced (like a room or tenant) no longer exists. Everything else restored successfully.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
