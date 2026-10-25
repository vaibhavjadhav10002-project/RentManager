'use client'
import { useEffect, useState, useCallback } from 'react'
import { useProperty } from '@/components/shared/PropertyContext'
import { getExpenses, addExpense, deleteExpense } from '@/lib/supabase/queries'
import { formatINR, formatDate, cn, friendlyErrorMessage } from '@/lib/utils'
import { toast } from 'sonner'
import { Plus, Trash2, Receipt, X } from 'lucide-react'
import {
  OwnerButton, OwnerIconButton, OwnerBadge, OwnerCard, OwnerInput, OwnerSelect, OwnerEmptyState,
  OwnerTable, OwnerTableHead, OwnerTableBody, OwnerTableRow, OwnerTableHeadCell, OwnerTableCell, OwnerTableEmptyRow,
  type OwnerBadgeProps,
} from '@/components/owner/ui'

const CATEGORIES = ['Electricity', 'Water', 'WiFi', 'Cleaning', 'Maintenance', 'Salary', 'Other']

// Explicit local tone map (not the generic ownerStatusTone helper, which
// is for status strings, not free-form categories) — same tone system as
// every other page, just applied to a different kind of label.
const CAT_TONE: Record<string, NonNullable<OwnerBadgeProps['tone']>> = {
  Electricity: 'warning', Water: 'info', WiFi: 'purple', Cleaning: 'success',
  Maintenance: 'danger', Salary: 'neutral', Other: 'neutral',
}

export default function ExpensesPage() {
  const { activeId, properties } = useProperty()
  const [expenses, setExpenses] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ property_id: '', category: 'Electricity', amount: '', notes: '', expense_date: new Date().toISOString().slice(0, 10) })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const ids = activeId === 'all' ? properties.map(p => p.id) : [activeId]
      const data = (await Promise.all(ids.map(getExpenses))).flat().sort((a, b) => new Date(b.expense_date).getTime() - new Date(a.expense_date).getTime())
      setExpenses(data)
    } catch { toast.error('Failed to load') }
    setLoading(false)
  }, [activeId, properties])

  useEffect(() => { load() }, [load])

  const total = expenses.reduce((s, e) => s + e.amount, 0)
  const byCategory = CATEGORIES.map(cat => ({ cat, total: expenses.filter(e => e.category === cat).reduce((s, e) => s + e.amount, 0) })).filter(c => c.total > 0)

  async function handleAdd() {
    const propertyId = form.property_id || (activeId !== 'all' ? activeId : '')
    if (!propertyId) { toast.error('Select a property'); return }
    if (!form.amount || Number(form.amount) <= 0) { toast.error('Enter a valid amount'); return }
    if (!form.expense_date) { toast.error('Select a date'); return }
    setSaving(true)
    try {
      await addExpense({ property_id: propertyId, category: form.category, amount: Number(form.amount), notes: form.notes, expense_date: form.expense_date })
      toast.success('Expense added!'); setModal(false); load()
    } catch (e: any) { toast.error(friendlyErrorMessage(e)) }
    setSaving(false)
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-extrabold text-owner-fg">Expenses</h1>
          <p className="text-sm text-owner-muted owner-numeric">Total: {formatINR(total)}</p>
        </div>
        <OwnerButton onClick={() => setModal(true)} icon={<Plus className="w-4 h-4" />}>
          Add Expense
        </OwnerButton>
      </div>

      {/* Breakdown */}
      {byCategory.length > 0 && (
        <OwnerCard>
          <div className="font-bold text-sm text-owner-fg mb-4">Breakdown by Category</div>
          <div className="space-y-3">
            {byCategory.map(({ cat, total: catTotal }) => (
              <div key={cat} className="flex items-center gap-3">
                <OwnerBadge tone={CAT_TONE[cat] ?? 'neutral'} className="shrink-0 w-24 justify-center">{cat}</OwnerBadge>
                <div className="flex-1 h-2 bg-owner-surface-hover rounded-owner-full overflow-hidden">
                  <div className="h-full bg-owner-primary rounded-owner-full" style={{ width: `${(catTotal / total) * 100}%` }} />
                </div>
                <span className="text-sm font-bold text-owner-fg owner-numeric min-w-[80px] text-right">{formatINR(catTotal)}</span>
              </div>
            ))}
          </div>
        </OwnerCard>
      )}

      {/* Table */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-12 rounded-owner-lg bg-owner-surface-hover animate-pulse" />)}
        </div>
      ) : expenses.length === 0 ? (
        <OwnerEmptyState icon={Receipt} title="No expenses yet" action={<OwnerButton onClick={() => setModal(true)} icon={<Plus className="w-4 h-4" />}>Add Expense</OwnerButton>} />
      ) : (
        <>
          {/* Mobile: stacked card list, no horizontal scroll */}
          <div className="sm:hidden space-y-2">
            {expenses.map(e => (
              <div key={e.id} className="bg-owner-surface border border-owner-border rounded-owner-lg p-3.5 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <OwnerBadge tone={CAT_TONE[e.category] ?? 'neutral'}>{e.category}</OwnerBadge>
                  <div className="text-xs text-owner-muted mt-1">{formatDate(e.expense_date)}</div>
                  {e.notes && <div className="text-xs text-owner-muted-subtle mt-1 truncate">{e.notes}</div>}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <div className="font-bold owner-numeric text-owner-fg">{formatINR(e.amount)}</div>
                  <OwnerIconButton
                    aria-label="Delete expense"
                    variant="ghost"
                    size="sm"
                    onClick={async () => { await deleteExpense(e.id); toast.success('Deleted'); load() }}
                    className="hover:text-owner-danger"
                  >
                    <Trash2 />
                  </OwnerIconButton>
                </div>
              </div>
            ))}
          </div>
          {/* Desktop/tablet: full table */}
          <div className="hidden sm:block">
            <OwnerTable>
              <OwnerTableHead>
                <tr>
                  {['Category', 'Amount', 'Date', 'Notes', 'Actions'].map(h => <OwnerTableHeadCell key={h}>{h}</OwnerTableHeadCell>)}
                </tr>
              </OwnerTableHead>
              <OwnerTableBody>
                {expenses.map(e => (
                  <OwnerTableRow key={e.id}>
                    <OwnerTableCell><OwnerBadge tone={CAT_TONE[e.category] ?? 'neutral'}>{e.category}</OwnerBadge></OwnerTableCell>
                    <OwnerTableCell className="font-bold owner-numeric">{formatINR(e.amount)}</OwnerTableCell>
                    <OwnerTableCell className="text-xs text-owner-muted">{formatDate(e.expense_date)}</OwnerTableCell>
                    <OwnerTableCell className="text-xs text-owner-muted-subtle">{e.notes || '—'}</OwnerTableCell>
                    <OwnerTableCell>
                      <OwnerIconButton
                        aria-label="Delete expense"
                        variant="ghost"
                        size="sm"
                        onClick={async () => { await deleteExpense(e.id); toast.success('Deleted'); load() }}
                        className="hover:text-owner-danger"
                      >
                        <Trash2 />
                      </OwnerIconButton>
                    </OwnerTableCell>
                  </OwnerTableRow>
                ))}
              </OwnerTableBody>
            </OwnerTable>
          </div>
        </>
      )}

      {modal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-owner-surface-elevated rounded-owner-2xl w-full max-w-md shadow-owner-lg border border-owner-border animate-owner-scale-in">
            <div className="px-6 py-4 border-b border-owner-border flex items-center justify-between">
              <h2 className="text-base font-bold text-owner-fg">Add Expense</h2>
              <OwnerIconButton aria-label="Close" variant="ghost" size="sm" onClick={() => setModal(false)}>
                <X />
              </OwnerIconButton>
            </div>
            <div className="p-6 space-y-4">
              {activeId === 'all' && (
                <OwnerSelect label="Property *" value={form.property_id} onChange={e => setForm(f => ({ ...f, property_id: e.target.value }))}>
                  <option value="">Select Property</option>
                  {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </OwnerSelect>
              )}
              <div>
                <label className="text-xs font-semibold text-owner-muted block mb-1.5">Category</label>
                <div className="grid grid-cols-3 gap-2">
                  {CATEGORIES.map(cat => (
                    <button key={cat} onClick={() => setForm(f => ({ ...f, category: cat }))}
                      className={cn('py-2 rounded-owner-lg text-xs font-semibold border transition-colors', form.category === cat ? 'border-owner-primary bg-owner-primary/10 text-owner-primary' : 'border-owner-border text-owner-muted hover:bg-owner-surface-hover')}>
                      {cat}
                    </button>
                  ))}
                </div>
              </div>
              <OwnerInput label="Amount (₹) *" type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
              <OwnerInput label="Date" type="date" value={form.expense_date} onChange={e => setForm(f => ({ ...f, expense_date: e.target.value }))} />
              <OwnerInput label="Notes" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional description" />
            </div>
            <div className="px-6 py-4 border-t border-owner-border flex gap-3">
              <OwnerButton onClick={handleAdd} loading={saving} fullWidth>Add Expense</OwnerButton>
              <OwnerButton onClick={() => setModal(false)} variant="secondary" fullWidth>Cancel</OwnerButton>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
