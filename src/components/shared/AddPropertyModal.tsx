'use client'
import { useState } from 'react'
import { X } from 'lucide-react'
import { addProperty } from '@/lib/supabase/queries'
import { toast } from 'sonner'
import { OwnerButton, OwnerIconButton, OwnerInput } from '@/components/owner/ui'
import { validateName, validateUPI, friendlyError } from '@/lib/validation'

interface Props {
  open: boolean
  onClose: () => void
  /** Called after a property is successfully created, with its new id. */
  onCreated: (id: string) => void
}

/**
 * Shared Add Property form, used by both the Topbar property switcher and
 * the Properties page (O3). Exactly the same `addProperty()` call and form
 * fields that used to live inline in Topbar.tsx — extracted here so
 * neither surface duplicates this logic, which matters given another
 * account may also be touching property-creation flows in parallel.
 */
export default function AddPropertyModal({ open, onClose, onCreated }: Props) {
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ name: '', address: '', city: '', upi_id: '' })

  if (!open) return null

  async function handleAdd() {
    const nameError = validateName(form.name, { label: 'Property name' })
    if (nameError) { toast.error(nameError); return }
    const upiError = validateUPI(form.upi_id, { required: false })
    if (upiError) { toast.error(upiError); return }
    setSaving(true)
    try {
      const created = await addProperty({ ...form, name: form.name.trim() })
      toast.success('Property added!')
      setForm({ name: '', address: '', city: '', upi_id: '' })
      onClose()
      if (created?.id) onCreated(created.id)
    } catch (e) {
      toast.error(friendlyError(e, 'Failed to add property'))
    }
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-owner-surface-elevated rounded-owner-2xl w-full max-w-sm shadow-owner-lg border border-owner-border animate-owner-scale-in">
        <div className="px-5 py-4 border-b border-owner-border flex items-center justify-between">
          <h2 className="text-base font-bold text-owner-fg">Add Property</h2>
          <OwnerIconButton aria-label="Close" variant="ghost" size="sm" onClick={onClose}>
            <X />
          </OwnerIconButton>
        </div>
        <div className="p-5 space-y-3">
          {[
            { key: 'name', label: 'Property Name *' },
            { key: 'address', label: 'Address' },
            { key: 'city', label: 'City' },
            { key: 'upi_id', label: 'UPI ID' },
          ].map(({ key, label }) => (
            <OwnerInput
              key={key}
              label={label}
              value={(form as any)[key]}
              onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
            />
          ))}
        </div>
        <div className="px-5 py-4 border-t border-owner-border flex gap-3">
          <OwnerButton onClick={handleAdd} loading={saving} fullWidth>
            {saving ? 'Adding…' : 'Add Property'}
          </OwnerButton>
          <OwnerButton onClick={onClose} variant="secondary" fullWidth>
            Cancel
          </OwnerButton>
        </div>
      </div>
    </div>
  )
}
