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
    { key: 'gpay', label: 'GPay', link: links.gpay, color: 'bg-white border border-gray-200 text-gray-700' },
    { key: 'phonepe', label: 'PhonePe', link: links.phonepe, color: 'bg-white border border-gray-200 text-gray-700' },
    { key: 'paytm', label: 'Paytm', link: links.paytm, color: 'bg-white border border-gray-200 text-gray-700' },
  ]

  if (compact) {
    return (
      <a href={links.generic} className="px-3 py-1.5 bg-purple-100 hover:bg-purple-200 text-purple-700 rounded-xl text-xs font-bold transition flex items-center gap-1">
        <Smartphone className="w-3 h-3" /> UPI
      </a>
    )
  }

  return (
    <div>
      <div className="grid grid-cols-3 gap-2">
        {apps.map(a => (
          <a key={a.key} href={a.link} className={`py-2.5 rounded-xl text-xs font-bold text-center transition hover:shadow-sm ${a.color}`}>
            {a.label}
          </a>
        ))}
      </div>
      <a href={links.generic} className="mt-2 w-full block text-center py-2.5 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl text-sm font-bold hover:opacity-90 transition">
        Pay via any UPI app
      </a>
      <p className="text-[11px] text-gray-400 text-center mt-1.5">Opens your UPI app with the amount pre-filled. Works only if the app is installed.</p>
    </div>
  )
}
