'use client'
import { upiPaymentLinks } from '@/lib/utils'
import { Smartphone } from 'lucide-react'

interface Props {
  upiId: string
  payeeName: string
  amount: number
  note: string
  compact?: boolean
}

export default function UpiPayButtons({ upiId, payeeName, amount, note, compact }: Props) {
  const links = upiPaymentLinks(upiId, payeeName, amount, note)

  const apps = [
    { key: 'gpay', label: 'GPay', link: links.gpay },
    { key: 'phonepe', label: 'PhonePe', link: links.phonepe },
    { key: 'paytm', label: 'Paytm', link: links.paytm },
  ]

  if (compact) {
    return (
      <a href={links.generic} className="px-3 py-1.5 bg-tenant-primary/10 hover:bg-tenant-primary/20 text-tenant-primary rounded-xl text-xs font-bold transition flex items-center gap-1">
        <Smartphone className="w-3 h-3" /> UPI
      </a>
    )
  }

  return (
    <div>
      <div className="grid grid-cols-3 gap-2">
        {apps.map(a => (
          <a key={a.key} href={a.link} className="py-2.5 rounded-xl text-xs font-bold text-center transition hover:shadow-tenant-sm bg-tenant-surface border border-tenant-border text-tenant-fg hover:bg-tenant-surface-hover">
            {a.label}
          </a>
        ))}
      </div>
      <a href={links.generic} className="mt-2 w-full block text-center py-2.5 bg-tenant-primary text-tenant-primary-fg rounded-xl text-sm font-bold hover:bg-tenant-primary-hover transition">
        Pay via any UPI app
      </a>
      <p className="text-[11px] text-tenant-muted-subtle text-center mt-1.5">Opens your UPI app with the amount pre-filled. Works only if the app is installed.</p>
    </div>
  )
}
