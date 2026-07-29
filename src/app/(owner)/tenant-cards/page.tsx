'use client'
import { useEffect, useState } from 'react'
import { useProperty } from '@/components/shared/PropertyContext'
import { getTenants } from '@/lib/supabase/queries'
import { generateTenantIDCardPDF } from '@/lib/pdf'
import { QrCode, Download, Loader2, User } from 'lucide-react'
import { toast } from 'sonner'
import type { Tenant } from '@/types'

export default function TenantCardsPage() {
  const { active, activeId, properties } = useProperty()
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [loading, setLoading] = useState(true)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const propIds = activeId === 'all' ? properties.map(p => p.id) : [activeId]
        if (propIds.length === 0 || propIds.some(id => !id)) { setTenants([]); setLoading(false); return }
        const lists = await Promise.all(propIds.map(id => getTenants(id)))
        setTenants((lists.flat() as Tenant[]).filter(t => t.status === 'active'))
      } catch { toast.error('Failed to load tenants') }
      setLoading(false)
    }
    load()
  }, [activeId, properties])

  function propertyNameFor(t: Tenant) {
    if (activeId !== 'all') return active?.name ?? 'Property'
    return properties.find(p => p.id === t.property_id)?.name ?? 'Property'
  }

  async function downloadCard(t: Tenant) {
    setDownloadingId(t.id)
    try {
      await generateTenantIDCardPDF({
        tenantId: t.id,
        tenantName: t.name,
        tenantPhone: t.phone,
        tenantPhotoUrl: t.photo_url,
        propertyName: propertyNameFor(t),
        roomNumber: t.room?.room_number,
        bedLabel: t.bed_label ?? undefined,
        joiningDate: t.joining_date,
        status: t.status,
      })
      toast.success('ID card downloaded!')
    } catch (e: any) {
      toast.error('Could not generate the card: ' + e.message)
    }
    setDownloadingId(null)
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-gray-400">
      <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading tenants…
    </div>
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-extrabold text-gray-900">QR Tenant Cards</h1>
        <p className="text-sm text-gray-500">{activeId === 'all' ? 'All properties' : active?.name} · {tenants.length} active tenant{tenants.length === 1 ? '' : 's'}</p>
      </div>

      {tenants.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col items-center justify-center py-16 text-gray-400 gap-2">
          <QrCode className="w-8 h-8" />
          <div className="text-sm">No active tenants to show cards for</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {tenants.map(t => (
            <div key={t.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              {/* Card preview — mirrors the layout of the downloaded PDF */}
              <div className="bg-gradient-to-br from-blue-600 to-blue-700 px-4 py-2.5 flex items-center justify-between">
                <div className="min-w-0">
                  <div className="text-white text-xs font-bold truncate">{propertyNameFor(t)}</div>
                  <div className="text-blue-100 text-[10px]">TENANT ID CARD</div>
                </div>
                <QrCode className="w-5 h-5 text-white/70 flex-shrink-0" />
              </div>
              <div className="p-4 flex gap-3">
                <div className="w-14 h-14 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
                  {t.photo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={t.photo_url} alt={t.name} className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-6 h-6 text-gray-300" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-bold text-gray-900 truncate">{t.name}</div>
                  <div className="text-xs text-gray-500">
                    {t.room?.room_number ? `Room ${t.room.room_number}` : 'Room —'}{t.bed_label ? ` · Bed ${t.bed_label}` : ''}
                  </div>
                  <div className="text-xs text-gray-400">{t.phone}</div>
                </div>
              </div>
              <div className="px-4 pb-4">
                <button onClick={() => downloadCard(t)} disabled={downloadingId === t.id}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-gray-900 hover:bg-gray-800 text-white rounded-xl text-xs font-semibold transition disabled:opacity-50">
                  {downloadingId === t.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                  Download ID Card
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
