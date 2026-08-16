'use client'
import { useEffect, useState } from 'react'
import { friendlyErrorMessage } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { updateProperty, addCollector, deleteCollector, getCollectors } from '@/lib/supabase/queries'
import { useProperty } from '@/components/shared/PropertyContext'
import { toast } from 'sonner'
import { Plus, Trash2, LogOut, Bell, Palette, Building2, Users2, Lock, ShieldAlert } from 'lucide-react'
import {
  OwnerButton, OwnerIconButton, OwnerCard, OwnerInput, OwnerSectionHeader, OwnerThemeToggle,
} from '@/components/owner/ui'
import { getNotificationPermissionState, hasActiveSubscription, enablePushNotifications, disablePushNotifications } from '@/lib/push'

export default function SettingsPage() {
  const { active, refresh } = useProperty()
  const [profile, setProfile] = useState<any>(null)
  const [collectors, setCollectors] = useState<any[]>([])
  const [newCollector, setNewCollector] = useState('')
  const [saving, setSaving] = useState(false)
  const [pwSaving, setPwSaving] = useState(false)
  const [pgForm, setPgForm] = useState({ name: '', address: '', city: '', upi_id: '', late_fee_per_day: '', late_fee_grace_days: '' })
  const [pwForm, setPwForm] = useState({ current: '', newPw: '', confirm: '' })

  const [notifPermission, setNotifPermission] = useState<NotificationPermission | 'unsupported'>('default')
  const [notifSubscribed, setNotifSubscribed] = useState(false)
  const [notifBusy, setNotifBusy] = useState(false)

  useEffect(() => {
    async function checkNotifState() {
      const perm = await getNotificationPermissionState()
      setNotifPermission(perm)
      setNotifSubscribed(await hasActiveSubscription())
    }
    checkNotifState()
  }, [])

  async function handleToggleNotifications() {
    setNotifBusy(true)
    try {
      if (notifSubscribed) {
        await disablePushNotifications()
        setNotifSubscribed(false)
        toast.success('Notifications disabled')
      } else {
        const ok = await enablePushNotifications()
        setNotifSubscribed(ok)
        setNotifPermission(await getNotificationPermissionState())
        if (ok) toast.success('Notifications enabled!')
        else toast.error('Could not enable notifications — check your browser settings')
      }
    } catch (e: any) { toast.error(e.message || 'Something went wrong') }
    setNotifBusy(false)
  }

  useEffect(() => {
    async function load() {
      const sb = createClient()
      const { data: { user } } = await sb.auth.getUser()
      if (!user) return
      const { data: p } = await sb.from('profiles').select('*').eq('id', user.id).single()
      setProfile(p)
    }
    load()
  }, [])

  useEffect(() => {
    if (active) {
      setPgForm({ name: active.name, address: active.address ?? '', city: active.city ?? '', upi_id: active.upi_id ?? '', late_fee_per_day: String(active.late_fee_per_day ?? 0), late_fee_grace_days: String(active.late_fee_grace_days ?? 0) })
      getCollectors(active.id).then(setCollectors)
    }
  }, [active])

  async function savePg() {
    if (!active) { toast.error('Select a specific property first'); return }
    setSaving(true)
    try {
      await updateProperty(active.id, {
        ...pgForm,
        late_fee_per_day: Number(pgForm.late_fee_per_day || 0),
        late_fee_grace_days: Number(pgForm.late_fee_grace_days || 0),
      } as any)
      toast.success('PG details saved!'); refresh()
    } catch (e: any) { toast.error(friendlyErrorMessage(e)) }
    setSaving(false)
  }

  async function handleAddCollector() {
    if (!newCollector.trim() || !active) { toast.error('Enter name and select a property'); return }
    try {
      await addCollector(active.id, newCollector.trim())
      toast.success('Collector added!')
      setNewCollector('')
      getCollectors(active.id).then(setCollectors)
    } catch (e: any) { toast.error(friendlyErrorMessage(e)) }
  }

  async function handleDeleteCollector(id: string) {
    if (!active) return
    if (!confirm('Remove this collector?')) return
    try {
      await deleteCollector(id)
      toast.success('Collector removed')
      getCollectors(active.id).then(setCollectors)
    } catch (e: any) { toast.error(friendlyErrorMessage(e)) }
  }

  async function changePassword() {
    if (pwForm.newPw !== pwForm.confirm) { toast.error('Passwords do not match'); return }
    if (pwForm.newPw.length < 6) { toast.error('Min 6 characters'); return }
    setPwSaving(true)
    const sb = createClient()
    const { error } = await sb.auth.updateUser({ password: pwForm.newPw })
    if (error) { toast.error(friendlyErrorMessage(error)); setPwSaving(false); return }
    if (profile?.id) await sb.from('profiles').update({ must_change_password: false }).eq('id', profile.id)
    toast.success('Password updated!')
    setPwForm({ current: '', newPw: '', confirm: '' })
    setPwSaving(false)
  }

  return (
    <div className="space-y-5 max-w-2xl">
      <div>
        <h1 className="text-xl font-extrabold text-owner-fg">Settings</h1>
        <p className="text-sm text-owner-muted">Manage your PG and account details</p>
      </div>

      {/* Appearance */}
      <OwnerCard>
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 rounded-owner-lg bg-gradient-to-br from-purple-500 to-indigo-600 text-white flex items-center justify-center shrink-0">
            <Palette className="w-4 h-4" />
          </div>
          <OwnerSectionHeader title="Appearance" description="Theme applies across the whole dashboard" className="mb-0" />
        </div>
        <OwnerThemeToggle />
      </OwnerCard>

      {/* Notifications */}
      <OwnerCard className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-owner-lg bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center shrink-0">
              <Bell className="w-4 h-4" />
            </div>
            <div className="font-bold text-sm text-owner-fg">Push Notifications</div>
          </div>
          {notifPermission !== 'unsupported' && notifPermission !== 'denied' && (
            <button onClick={handleToggleNotifications} disabled={notifBusy}
              className={`flex-shrink-0 w-11 h-6 rounded-full transition relative disabled:opacity-50 ${notifSubscribed ? 'bg-owner-primary' : 'bg-owner-bg-subtle border border-owner-border'}`}>
              <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${notifSubscribed ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </button>
          )}
        </div>
        {notifPermission === 'unsupported' ? (
          <p className="text-xs text-owner-muted">Not supported in this browser.</p>
        ) : notifPermission === 'denied' ? (
          <p className="text-xs text-owner-warning">Blocked at the browser level — enable notifications for this site in your browser settings to turn this on.</p>
        ) : (
          <p className="text-xs text-owner-muted">Rent reminders, notices, and complaint updates — even when the app is closed.</p>
        )}
      </OwnerCard>

      {/* PG Details */}
      <OwnerCard className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-owner-lg bg-gradient-to-br from-teal-500 to-emerald-600 text-white flex items-center justify-center shrink-0">
            <Building2 className="w-4 h-4" />
          </div>
          <OwnerSectionHeader
            title="PG Details"
            description={!active ? 'Select a specific property above to edit its details' : undefined}
            className="mb-0"
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <OwnerInput label="PG Name" value={pgForm.name} onChange={e => setPgForm(f => ({ ...f, name: e.target.value }))} />
          <OwnerInput label="City" value={pgForm.city} onChange={e => setPgForm(f => ({ ...f, city: e.target.value }))} />
          <div className="sm:col-span-2">
            <OwnerInput label="Address" value={pgForm.address} onChange={e => setPgForm(f => ({ ...f, address: e.target.value }))} />
          </div>
          <OwnerInput label="UPI ID" value={pgForm.upi_id} onChange={e => setPgForm(f => ({ ...f, upi_id: e.target.value }))} />
          <OwnerInput label="Late Fee (₹ per day)" type="number" value={pgForm.late_fee_per_day} onChange={e => setPgForm(f => ({ ...f, late_fee_per_day: e.target.value }))} />
          <OwnerInput label="Grace Period (days)" type="number" value={pgForm.late_fee_grace_days} onChange={e => setPgForm(f => ({ ...f, late_fee_grace_days: e.target.value }))} />
        </div>
        <OwnerButton onClick={savePg} loading={saving}>
          Save PG Details
        </OwnerButton>
      </OwnerCard>

      {/* Collectors */}
      <OwnerCard className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-owner-lg bg-gradient-to-br from-amber-500 to-orange-600 text-white flex items-center justify-center shrink-0">
            <Users2 className="w-4 h-4" />
          </div>
          <OwnerSectionHeader title="Rent Collectors" description="People who can collect rent (Owner 1, Owner 2, Warden, etc.). Selected when recording a payment." className="mb-0" />
        </div>
        <div className="space-y-2">
          {collectors.map(c => (
            <div key={c.id} className="flex items-center gap-3 bg-owner-bg-subtle rounded-owner-lg px-3 py-2.5">
              <div className="w-7 h-7 rounded-full bg-owner-surface-hover text-owner-muted flex items-center justify-center text-xs font-bold shrink-0">
                {c.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
              </div>
              <span className="text-sm text-owner-fg flex-1">{c.name}</span>
              <OwnerIconButton aria-label={`Remove ${c.name}`} variant="ghost" size="sm" onClick={() => handleDeleteCollector(c.id)} className="hover:text-owner-danger">
                <Trash2 />
              </OwnerIconButton>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <div className="flex-1">
            <OwnerInput value={newCollector} onChange={e => setNewCollector(e.target.value)} placeholder="e.g. Owner — Suresh Kumar" />
          </div>
          <OwnerButton onClick={handleAddCollector} icon={<Plus className="w-4 h-4" />}>Add</OwnerButton>
        </div>
      </OwnerCard>

      {/* Change Password */}
      <OwnerCard className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-owner-lg bg-gradient-to-br from-slate-500 to-slate-700 text-white flex items-center justify-center shrink-0">
            <Lock className="w-4 h-4" />
          </div>
          <OwnerSectionHeader title="Change Password" className="mb-0" />
        </div>
        <div className="space-y-3">
          <OwnerInput label="New Password" type="password" value={pwForm.newPw} onChange={e => setPwForm(f => ({ ...f, newPw: e.target.value }))} />
          <OwnerInput label="Confirm Password" type="password" value={pwForm.confirm} onChange={e => setPwForm(f => ({ ...f, confirm: e.target.value }))} />
        </div>
        <OwnerButton onClick={changePassword} loading={pwSaving}>Update Password</OwnerButton>
      </OwnerCard>

      {/* Logout */}
      <OwnerCard className="border-owner-danger/25">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 rounded-owner-lg bg-owner-danger-subtle text-owner-danger flex items-center justify-center shrink-0">
            <ShieldAlert className="w-4 h-4" />
          </div>
          <div className="font-bold text-sm text-owner-danger">Danger Zone</div>
        </div>
        <OwnerButton
          onClick={async () => { const sb = createClient(); await sb.auth.signOut(); window.location.href = '/login' }}
          variant="destructive" icon={<LogOut className="w-4 h-4" />}
        >
          Logout
        </OwnerButton>
      </OwnerCard>
    </div>
  )
}
