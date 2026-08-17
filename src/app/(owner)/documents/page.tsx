'use client'
import { useEffect, useState } from 'react'
import { useProperty } from '@/components/shared/PropertyContext'
import { getAgreementsForProperty, getTenants } from '@/lib/supabase/queries'
import { generateFullAgreementPDF, generateAgreementPDF } from '@/lib/pdf'
import { formatDate } from '@/lib/utils'
import { toast } from 'sonner'
import { FileText, Download, Eye, FileWarning, ChevronRight, X } from 'lucide-react'
import {
  OwnerCard, OwnerBadge, OwnerIconButton, OwnerEmptyState, OwnerButton,
  OwnerTable, OwnerTableHead, OwnerTableBody, OwnerTableRow, OwnerTableHeadCell, OwnerTableCell, OwnerTableEmptyRow,
  type OwnerBadgeProps,
} from '@/components/owner/ui'
import { usePullToRefreshHandler } from '@/lib/native/pullToRefresh'

/**
 * Documents — O10. This page did not exist before; there's no /documents
 * route or documents table in this schema. Same conservative approach as
 * Properties (O3): zero new mutations, zero new queries. Everything here
 * comes from getAgreementsForProperty() and getTenants() — both already
 * used elsewhere in the app — joined client-side by tenant_id (rather
 * than editing the shared query to select more fields, since that query
 * is shared code another workstream might also depend on). PDF
 * generation reuses generateFullAgreementPDF()/generateAgreementPDF()
 * verbatim — the exact same functions and call shape the Tenant Portal's
 * own "Download Agreement" button already uses.
 */
const STATUS_TONE: Record<string, NonNullable<OwnerBadgeProps['tone']>> = {
  pending: 'warning', signed: 'info', active: 'success', expired: 'neutral',
}

export default function DocumentsPage() {
  const { activeId, properties, active } = useProperty()
  const [rows, setRows] = useState<{ agreement: any; tenant: any }[]>([])
  const [unagreementedTenants, setUnagreementedTenants] = useState<any[]>([])
  const [refreshKey, setRefreshKey] = useState(0)
  usePullToRefreshHandler(() => setRefreshKey(k => k + 1))
  const [loading, setLoading] = useState(true)
  const [documentDetail, setDocumentDetail] = useState<{ agreement: any; tenant: any } | null>(null)

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const propIds = activeId === 'all' ? properties.map(p => p.id) : [activeId]
        if (propIds.length === 0 || propIds.some(id => !id)) { setLoading(false); return }

        const [agreementLists, tenantLists] = await Promise.all([
          Promise.all(propIds.map(getAgreementsForProperty)),
          Promise.all(propIds.map(getTenants)),
        ])
        const allTenants = tenantLists.flat()
        const tenantById = new Map(allTenants.map(t => [t.id, t]))

        const joined = agreementLists.flat()
          .map(a => ({ agreement: a, tenant: tenantById.get(a.tenant_id) }))
          .filter(r => r.tenant) // only show rows where we have full tenant data to render/export

        joined.sort((a, b) => new Date(b.agreement.created_at).getTime() - new Date(a.agreement.created_at).getTime())
        setRows(joined)

        const agreementTenantIds = new Set(joined.map(r => r.tenant.id))
        setUnagreementedTenants(allTenants.filter(t => t.status === 'active' && !agreementTenantIds.has(t.id)))
      } catch { toast.error('Failed to load documents') }
      setLoading(false)
    }
    load()
  }, [activeId, properties, refreshKey])

  function downloadFull(agreement: any, tenant: any) {
    generateFullAgreementPDF({
      agreementNumber: agreement.agreement_number,
      creationDate: agreement.created_at,
      tenantName: tenant.name, tenantPhone: tenant.phone, tenantEmail: tenant.email ?? undefined,
      tenantPhotoUrl: tenant.photo_url ?? undefined,
      governmentId: agreement.government_id ? 'Photo on file' : undefined,
      emergencyContact: tenant.emergency_contact ?? undefined,
      propertyName: tenant.property?.name ?? active?.name ?? 'PG', propertyAddress: tenant.property?.address ?? undefined,
      roomNumber: tenant.room?.room_number, bedLabel: tenant.bed_label ?? undefined,
      joiningDate: tenant.joining_date,
      startDate: agreement.start_date, endDate: agreement.end_date,
      durationMonths: agreement.duration_months, rentCycle: agreement.rent_cycle,
      monthlyRent: agreement.monthly_rent, securityDeposit: agreement.security_deposit,
      electricityCharges: agreement.electricity_charges, maintenanceCharges: agreement.maintenance_charges,
      otherCharges: agreement.other_charges, otherChargesNote: agreement.other_charges_note ?? undefined,
      dueDay: agreement.due_day, lateFeePolicy: agreement.late_fee_policy,
      termsVersion: agreement.terms_version,
      tenantSignature: agreement.tenant_signature, tenantSignedName: agreement.tenant_signed_name,
      tenantSignedAt: agreement.tenant_signed_at, status: agreement.status,
    })
    toast.success('Agreement downloaded')
  }

  function downloadBasic(tenant: any) {
    generateAgreementPDF({
      tenantName: tenant.name, tenantPhone: tenant.phone,
      propertyName: tenant.property?.name ?? active?.name ?? 'PG', propertyAddress: tenant.property?.address,
      roomNumber: tenant.room?.room_number, bedLabel: tenant.bed_label,
      joiningDate: tenant.joining_date, monthlyRent: tenant.monthly_rent,
      depositAmount: tenant.deposit_amount, noticePeriodDays: tenant.notice_period_days,
    })
    toast.success('Basic agreement downloaded')
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-extrabold text-owner-fg">Documents</h1>
        <p className="text-sm text-owner-muted mt-1">Tenant agreements &amp; KYC — {activeId === 'all' ? 'all properties' : active?.name}</p>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-12 rounded-owner-lg bg-owner-surface-hover animate-pulse" />)}
        </div>
      ) : rows.length === 0 ? (
        <OwnerCard>
          <OwnerEmptyState icon={FileText} title="No agreements on file yet" subtitle="Agreements are created automatically when a tenant is added." />
        </OwnerCard>
      ) : (
        <>
          {/* Mobile: stacked card list, no horizontal scroll */}
          <div className="sm:hidden space-y-2">
            {rows.map(({ agreement, tenant }) => (
              <button key={agreement.id} onClick={() => setDocumentDetail({ agreement, tenant })}
                className="w-full bg-owner-surface border border-owner-border rounded-owner-lg p-3.5 flex items-center gap-3 text-left transition active:scale-[0.99] active:bg-owner-surface-hover">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 text-white flex items-center justify-center shrink-0">
                  <FileText className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-owner-fg truncate">{tenant.name}</div>
                  <div className="text-xs text-owner-muted-subtle truncate">Room {tenant.room?.room_number ?? '—'} · {agreement.agreement_number}</div>
                </div>
                <OwnerBadge tone={STATUS_TONE[agreement.status] ?? 'neutral'} className="capitalize shrink-0">{agreement.status}</OwnerBadge>
                <ChevronRight className="w-4 h-4 text-owner-muted-subtle shrink-0" />
              </button>
            ))}
          </div>
          {/* Desktop/tablet: full table */}
          <div className="hidden sm:block">
            <OwnerTable>
              <OwnerTableHead>
                <tr>
                  {['Tenant', 'Room', 'Agreement #', 'Period', 'Status', 'Government ID', 'Download'].map(h => <OwnerTableHeadCell key={h}>{h}</OwnerTableHeadCell>)}
                </tr>
              </OwnerTableHead>
              <OwnerTableBody>
                {rows.map(({ agreement, tenant }) => (
                  <OwnerTableRow key={agreement.id}>
                    <OwnerTableCell className="font-semibold">{tenant.name}</OwnerTableCell>
                    <OwnerTableCell className="text-owner-muted">{tenant.room?.room_number ?? '—'}</OwnerTableCell>
                    <OwnerTableCell className="font-mono text-xs">{agreement.agreement_number}</OwnerTableCell>
                    <OwnerTableCell className="text-xs text-owner-muted">{formatDate(agreement.start_date)} – {formatDate(agreement.end_date)}</OwnerTableCell>
                    <OwnerTableCell><OwnerBadge tone={STATUS_TONE[agreement.status] ?? 'neutral'} className="capitalize">{agreement.status}</OwnerBadge></OwnerTableCell>
                    <OwnerTableCell>
                      {agreement.government_id ? (
                        <a href={agreement.government_id} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-owner-primary hover:underline">
                          <Eye className="w-3.5 h-3.5" /> View
                        </a>
                      ) : <span className="text-xs text-owner-muted-subtle">Not uploaded</span>}
                    </OwnerTableCell>
                    <OwnerTableCell>
                      <OwnerIconButton aria-label={`Download agreement for ${tenant.name}`} variant="ghost" size="sm" onClick={() => downloadFull(agreement, tenant)}>
                        <Download />
                      </OwnerIconButton>
                    </OwnerTableCell>
                  </OwnerTableRow>
                ))}
              </OwnerTableBody>
            </OwnerTable>
          </div>
        </>
      )}

      {/* Document Detail sheet */}
      {documentDetail && (() => {
        const { agreement, tenant } = documentDetail
        return (
          <>
            <div onClick={() => setDocumentDetail(null)} className="fixed inset-0 bg-black/40 z-50 transition-opacity" />
            <div className="fixed inset-x-0 bottom-0 z-50 bg-owner-surface-elevated rounded-t-3xl shadow-owner-lg max-h-[85vh] flex flex-col animate-owner-scale-in">
              <div className="flex justify-center pt-2.5 pb-1 shrink-0">
                <div className="h-1 w-9 rounded-full bg-owner-border-strong" />
              </div>
              <div className="px-5 pb-4 pt-1 flex items-center gap-3 border-b border-owner-border shrink-0">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 text-white flex items-center justify-center shrink-0">
                  <FileText className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] font-bold text-owner-muted uppercase tracking-wide">Document Details</div>
                  <div className="font-bold text-owner-fg truncate">{tenant.name}</div>
                </div>
                <OwnerBadge tone={STATUS_TONE[agreement.status] ?? 'neutral'} className="capitalize shrink-0">{agreement.status}</OwnerBadge>
                <OwnerIconButton aria-label="Close" variant="ghost" size="sm" onClick={() => setDocumentDetail(null)}>
                  <X />
                </OwnerIconButton>
              </div>
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-owner-surface-hover rounded-xl p-3">
                    <div className="text-[10px] text-owner-muted-subtle uppercase font-bold">Room</div>
                    <div className="text-sm font-semibold text-owner-fg mt-0.5">{tenant.room?.room_number ?? '—'}</div>
                  </div>
                  <div className="bg-owner-surface-hover rounded-xl p-3">
                    <div className="text-[10px] text-owner-muted-subtle uppercase font-bold">Agreement #</div>
                    <div className="text-sm font-mono font-semibold text-owner-fg mt-0.5">{agreement.agreement_number}</div>
                  </div>
                  <div className="bg-owner-surface-hover rounded-xl p-3 col-span-2">
                    <div className="text-[10px] text-owner-muted-subtle uppercase font-bold">Agreement Period</div>
                    <div className="text-sm font-semibold text-owner-fg mt-0.5">{formatDate(agreement.start_date)} – {formatDate(agreement.end_date)}</div>
                  </div>
                  <div className="bg-owner-surface-hover rounded-xl p-3">
                    <div className="text-[10px] text-owner-muted-subtle uppercase font-bold">Monthly Rent</div>
                    <div className="text-sm font-semibold text-owner-fg mt-0.5 owner-numeric">₹{agreement.monthly_rent?.toLocaleString('en-IN') ?? '—'}</div>
                  </div>
                  <div className="bg-owner-surface-hover rounded-xl p-3">
                    <div className="text-[10px] text-owner-muted-subtle uppercase font-bold">Security Deposit</div>
                    <div className="text-sm font-semibold text-owner-fg mt-0.5 owner-numeric">₹{agreement.security_deposit?.toLocaleString('en-IN') ?? '—'}</div>
                  </div>
                </div>
              </div>
              <div className="px-5 py-4 border-t border-owner-border shrink-0 flex gap-2.5" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
                {agreement.government_id ? (
                  <a href={agreement.government_id} target="_blank" rel="noreferrer"
                    className="flex-1 h-12 flex items-center justify-center gap-1.5 bg-owner-surface-hover hover:opacity-80 active:scale-[0.98] text-owner-fg rounded-2xl text-sm font-bold transition">
                    <Eye className="w-4 h-4" /> Preview ID
                  </a>
                ) : (
                  <div className="flex-1 h-12 flex items-center justify-center text-xs text-owner-muted-subtle">Government ID not uploaded</div>
                )}
                <button onClick={() => downloadFull(agreement, tenant)}
                  className="flex-1 h-12 flex items-center justify-center gap-1.5 bg-owner-primary hover:opacity-90 active:scale-[0.98] text-white rounded-2xl text-sm font-bold transition">
                  <Download className="w-4 h-4" /> Download
                </button>
              </div>
            </div>
          </>
        )
      })()}

      {!loading && unagreementedTenants.length > 0 && (
        <OwnerCard>
          <div className="flex items-center gap-2 mb-3">
            <FileWarning className="w-4 h-4 text-owner-warning" />
            <div className="font-bold text-sm text-owner-fg">Active Tenants Without a Formal Agreement ({unagreementedTenants.length})</div>
          </div>
          <p className="text-xs text-owner-muted-subtle mb-3">
            These tenants have no agreement record — a basic system-generated summary can still be downloaded from their details.
          </p>
          <div className="space-y-2">
            {unagreementedTenants.map(t => (
              <div key={t.id} className="flex items-center justify-between p-3 bg-owner-bg-subtle rounded-owner-lg">
                <div>
                  <div className="text-sm font-semibold text-owner-fg">{t.name}</div>
                  <div className="text-xs text-owner-muted-subtle">Room {t.room?.room_number ?? '—'}</div>
                </div>
                <OwnerButton onClick={() => downloadBasic(t)} variant="secondary" size="sm" icon={<Download className="w-3.5 h-3.5" />}>
                  Basic PDF
                </OwnerButton>
              </div>
            ))}
          </div>
        </OwnerCard>
      )}
    </div>
  )
}
