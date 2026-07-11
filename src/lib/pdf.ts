import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import QRCode from 'qrcode'
import { formatINR, formatDate } from '@/lib/utils'

// ─── Shared premium-document helpers ───────────────────────────────────────
function drawLogoBadge(doc: jsPDF, propertyName: string, x: number, y: number) {
  const initials = propertyName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
  doc.setFillColor(37, 99, 235)
  doc.roundedRect(x, y, 14, 14, 3, 3, 'F')
  doc.setTextColor(255, 255, 255).setFontSize(11).setFont('helvetica', 'bold')
  doc.text(initials, x + 7, y + 9.5, { align: 'center' })
  doc.setTextColor(0)
}

function drawWatermark(doc: jsPDF, text: string) {
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  doc.saveGraphicsState()
  ;(doc as any).setGState(new (doc as any).GState({ opacity: 0.06 }))
  doc.setFontSize(64).setFont('helvetica', 'bold').setTextColor(37, 99, 235)
  doc.text(text, pageWidth / 2, pageHeight / 2, { align: 'center', angle: 35 })
  doc.restoreGraphicsState()
  doc.setTextColor(0)
}

async function drawQRCode(doc: jsPDF, content: string, x: number, y: number, size: number) {
  try {
    const dataUrl = await QRCode.toDataURL(content, { margin: 0, width: 200 })
    doc.addImage(dataUrl, 'PNG', x, y, size, size)
  } catch {
    // If QR generation fails for any reason, silently skip it rather than
    // breaking the whole document — the printed fields are still complete.
  }
}

interface AgreementData {
  tenantName: string
  tenantPhone: string
  propertyName: string
  propertyAddress?: string
  roomNumber?: string
  bedLabel?: string
  joiningDate: string
  monthlyRent: number
  depositAmount: number
  noticePeriodDays: number
}

export function generateAgreementPDF(data: AgreementData) {
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()
  let y = 20

  doc.setFontSize(18).setFont('helvetica', 'bold')
  doc.text('Rent Agreement / Occupancy Confirmation', pageWidth / 2, y, { align: 'center' })
  y += 8
  doc.setFontSize(10).setFont('helvetica', 'normal').setTextColor(120)
  doc.text(`Generated on ${formatDate(new Date())}`, pageWidth / 2, y, { align: 'center' })
  doc.setTextColor(0)
  y += 14

  doc.setFontSize(12).setFont('helvetica', 'bold')
  doc.text(data.propertyName, 14, y)
  y += 6
  if (data.propertyAddress) {
    doc.setFontSize(10).setFont('helvetica', 'normal')
    doc.text(data.propertyAddress, 14, y)
    y += 10
  } else {
    y += 4
  }

  const rows: [string, string][] = [
    ['Tenant Name', data.tenantName],
    ['Mobile Number', data.tenantPhone],
    ['Room / Bed', `${data.roomNumber ? `Room ${data.roomNumber}` : '—'}${data.bedLabel ? ` · Bed ${data.bedLabel}` : ''}`],
    ['Joining Date', formatDate(data.joiningDate)],
    ['Monthly Rent', formatINR(data.monthlyRent)],
    ['Security Deposit', formatINR(data.depositAmount)],
    ['Notice Period', `${data.noticePeriodDays} days`],
  ]

  autoTable(doc, {
    startY: y,
    head: [['Detail', 'Value']],
    body: rows,
    theme: 'grid',
    headStyles: { fillColor: [37, 99, 235] },
    styles: { fontSize: 10, cellPadding: 4 },
  })

  const finalY = (doc as any).lastAutoTable.finalY + 12
  doc.setFontSize(9).setFont('helvetica', 'normal').setTextColor(90)
  const terms = [
    `1. The tenant agrees to pay a monthly rent of ${formatINR(data.monthlyRent)}, due on the same date each month as the joining date.`,
    `2. A security deposit of ${formatINR(data.depositAmount)} has been collected and is refundable upon vacating, subject to deductions for damages or dues.`,
    `3. The tenant must provide ${data.noticePeriodDays} days' written notice before vacating the property.`,
    `4. This document confirms occupancy details as recorded in the PG Manager system and does not replace a formal registered rental agreement where legally required.`,
  ]
  let ty = finalY
  terms.forEach(line => {
    const split = doc.splitTextToSize(line, pageWidth - 28)
    doc.text(split, 14, ty)
    ty += split.length * 5 + 3
  })

  doc.save(`Rent-Agreement-${data.tenantName.replace(/\s+/g, '-')}.pdf`)
}

interface ReceiptData {
  tenantName: string
  propertyName: string
  ownerName?: string
  roomNumber?: string
  bedLabel?: string
  forMonth?: string
  type: string
  totalDue: number
  amountReceived: number
  previousDue?: number
  lateFee?: number
  discount?: number
  advanceAdjustment?: number
  depositAdjustment?: number
  remainingBalance?: number
  method?: string
  referenceNumber?: string | null
  paymentDate: string
  approvalStatus: string
  receiptNo: string
}

function monthRangeFromLabel(label?: string): [string, string] | null {
  if (!label) return null
  const parsed = new Date(`1 ${label}`)
  if (isNaN(parsed.getTime())) return null
  const start = new Date(parsed.getFullYear(), parsed.getMonth(), 1)
  const end = new Date(parsed.getFullYear(), parsed.getMonth() + 1, 0)
  return [start.toISOString(), end.toISOString()]
}

export async function generateReceiptPDF(data: ReceiptData) {
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()
  let y = 16

  const isPaid = data.approvalStatus === 'approved'
  if (isPaid) drawWatermark(doc, 'PAID')
  drawLogoBadge(doc, data.propertyName, 14, 10)

  doc.setFontSize(14).setFont('helvetica', 'bold')
  doc.text(data.propertyName, 32, 16)
  doc.setFontSize(9).setFont('helvetica', 'normal').setTextColor(120)
  doc.text('Payment Receipt', 32, 21.5)
  doc.setTextColor(0)

  y = 32
  doc.setDrawColor(230).line(14, y, pageWidth - 14, y)
  y += 7
  doc.setFontSize(9).setTextColor(120)
  doc.text(`Receipt No: ${data.receiptNo}`, 14, y)
  doc.text(`Date & Time: ${new Date().toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`, pageWidth - 14, y, { align: 'right' })
  doc.setTextColor(0)
  y += 8

  const billingRange = monthRangeFromLabel(data.forMonth ?? undefined)

  const rows: [string, string][] = [
    ['Tenant', data.tenantName],
    ['Room / Bed', `${data.roomNumber ? `Room ${data.roomNumber}` : '—'}${data.bedLabel ? ` · Bed ${data.bedLabel}` : ''}`],
    ['Payment Type', data.type.charAt(0).toUpperCase() + data.type.slice(1)],
    ['For Month', data.forMonth ?? '—'],
    ...(billingRange ? [['Billing Period', `${formatDate(billingRange[0])} – ${formatDate(billingRange[1])}`] as [string, string]] : []),
    ['Payment Date', formatDate(data.paymentDate)],
    ['Monthly Rent / Amount Due', formatINR(data.totalDue)],
    ...(data.previousDue ? [['Previous Due', formatINR(data.previousDue)] as [string, string]] : []),
    ...(data.lateFee ? [['Late Fee', formatINR(data.lateFee)] as [string, string]] : []),
    ...(data.discount ? [['Discount', `- ${formatINR(data.discount)}`] as [string, string]] : []),
    ...(data.advanceAdjustment ? [['Advance Adjustment', `- ${formatINR(data.advanceAdjustment)}`] as [string, string]] : []),
    ...(data.depositAdjustment ? [['Deposit Adjustment', `- ${formatINR(data.depositAdjustment)}`] as [string, string]] : []),
    ['Total Amount Paid', formatINR(data.amountReceived)],
    ['Remaining Balance', formatINR(data.remainingBalance ?? Math.max(0, data.totalDue - data.amountReceived))],
    ['Payment Method', data.method?.replace('_', ' ').toUpperCase() ?? '—'],
    ...(data.referenceNumber ? [['Transaction / UPI Reference', data.referenceNumber] as [string, string]] : []),
    ['Status', data.approvalStatus.replace('_', ' ').toUpperCase()],
  ]

  autoTable(doc, {
    startY: y,
    head: [['Detail', 'Value']],
    body: rows,
    theme: 'grid',
    headStyles: { fillColor: [37, 99, 235] },
    styles: { fontSize: 9.5, cellPadding: 3.5 },
    didParseCell: (hook) => {
      if (hook.section === 'body' && (hook.row.raw as any)[0] === 'Total Amount Paid') {
        hook.cell.styles.fontStyle = 'bold'
        hook.cell.styles.textColor = [21, 128, 61]
      }
    },
  })

  let finalY = (doc as any).lastAutoTable.finalY + 16

  doc.setDrawColor(200).line(14, finalY, 64, finalY)
  doc.setFontSize(8).setTextColor(120)
  doc.text('Owner / Manager Signature', 14, finalY + 5)
  doc.setTextColor(0).setFontSize(9)
  doc.text(data.ownerName || 'Authorized Signatory', 14, finalY + 10)

  const qrContent = `PG Manager Receipt\nNo: ${data.receiptNo}\nTenant: ${data.tenantName}\nAmount: ${data.amountReceived}\nDate: ${data.paymentDate}\nStatus: ${data.approvalStatus}`
  await drawQRCode(doc, qrContent, pageWidth - 38, finalY - 12, 22)
  doc.setFontSize(7).setTextColor(150)
  doc.text('Scan to verify', pageWidth - 38, finalY + 13)

  doc.setFontSize(8).setTextColor(150)
  doc.text('This is a system-generated receipt from PG Manager.', 14, finalY + 22)

  doc.save(`Receipt-${data.receiptNo}.pdf`)
}

// ─── Full PG Rental Agreement (premium — logo, photo, QR, watermark) ─────────
interface FullAgreementData {
  agreementNumber: string
  creationDate?: string
  tenantName: string
  tenantPhone: string
  tenantEmail?: string
  tenantPhotoUrl?: string | null
  governmentId?: string
  emergencyContact?: string
  propertyName: string
  propertyAddress?: string
  roomNumber?: string
  bedLabel?: string
  ownerName?: string
  joiningDate?: string
  startDate: string
  endDate: string
  durationMonths: number
  rentCycle: string
  monthlyRent: number
  securityDeposit: number
  electricityCharges: string
  maintenanceCharges: number
  otherCharges: number
  otherChargesNote?: string
  dueDay: number
  lockInMonths?: number
  lateFeePolicy: string
  termsVersion: string
  tenantSignature?: string | null
  tenantSignedName?: string
  tenantSignedAt?: string
  status: string
}

const TERMS: string[] = [
  '30-day notice period is required before vacating the room.',
  'Rent must be paid on or before the due date each month.',
  'The security deposit is refundable after move-out inspection, less any pending dues or damages.',
  'Electricity charges will be billed separately as per meter reading or the plan configured above.',
  'The tenant is responsible for maintaining the room and furniture in good condition.',
  'Any damage to property will be recovered from the security deposit.',
  'Smoking, illegal activities, and nuisance of any kind are strictly prohibited on the premises.',
  'Guests are allowed only in accordance with the PG\'s guest policy.',
  'All outstanding dues must be cleared in full before checkout.',
  'The owner/manager may inspect the room with prior notice to the tenant.',
  'Renewal of this agreement beyond the end date is subject to the owner\'s approval.',
]

function ordinalDay(n: number) {
  return `${n}${['th', 'st', 'nd', 'rd'][(n % 10 > 3 || Math.floor(n / 10) === 1) ? 0 : n % 10]}`
}

async function tryFetchImageAsDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url)
    const blob = await res.blob()
    return await new Promise((resolve) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result as string)
      reader.onerror = () => resolve(null)
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

export async function generateFullAgreementPDF(data: FullAgreementData) {
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  let y = 18

  drawWatermark(doc, 'DIGITALLY GENERATED')
  drawLogoBadge(doc, data.propertyName, 14, 12)

  doc.setFontSize(15).setFont('helvetica', 'bold')
  doc.text(data.propertyName, 32, 18)
  doc.setFontSize(9).setFont('helvetica', 'normal').setTextColor(120)
  doc.text('PG Rental Agreement', 32, 24)
  doc.setTextColor(0)

  // Tenant photo, top-right, if available
  if (data.tenantPhotoUrl) {
    const photoData = await tryFetchImageAsDataUrl(data.tenantPhotoUrl)
    if (photoData) {
      try { doc.addImage(photoData, pageWidth - 34, 10, 20, 20) } catch {}
    }
  }

  y = 34
  doc.setDrawColor(230).line(14, y, pageWidth - 14, y)
  y += 6
  doc.setFontSize(9).setFont('helvetica', 'normal').setTextColor(120)
  doc.text(`Agreement No: ${data.agreementNumber}  ·  Version ${data.termsVersion}  ·  Generated ${formatDate(data.creationDate ?? new Date().toISOString())}`, pageWidth / 2, y, { align: 'center' })
  doc.setTextColor(0)
  y += 10

  const section = (title: string) => {
    doc.setFontSize(11).setFont('helvetica', 'bold').setFillColor(243, 244, 246)
    doc.rect(14, y - 5, pageWidth - 28, 7, 'F')
    doc.text(title, 16, y)
    y += 9
  }

  const rows = (pairs: [string, string][]) => {
    autoTable(doc, {
      startY: y,
      body: pairs,
      theme: 'plain',
      styles: { fontSize: 9.5, cellPadding: 1.5 },
      columnStyles: { 0: { fontStyle: 'bold', cellWidth: 55 } },
      margin: { left: 14, right: 14 },
    })
    y = (doc as any).lastAutoTable.finalY + 6
  }

  section('1. Tenant Information')
  rows([
    ['Full Name', data.tenantName],
    ['Mobile Number', data.tenantPhone],
    ['Email', data.tenantEmail || '—'],
    ['Government ID', data.governmentId ? (data.governmentId.startsWith('http') ? 'Verified — photo on file' : data.governmentId) : '—'],
    ['Emergency Contact', data.emergencyContact || '—'],
  ])

  section('2. Property Information')
  rows([
    ['PG Name', data.propertyName],
    ['Address', data.propertyAddress || '—'],
    ['Room Number', data.roomNumber || 'To be assigned'],
    ['Bed Number', data.bedLabel || 'To be assigned'],
    ['Owner / Manager', data.ownerName || '—'],
  ])

  section('3. Agreement Details')
  rows([
    ['Check-in / Joining Date', formatDate(data.joiningDate ?? data.startDate)],
    ['Agreement Start Date', formatDate(data.startDate)],
    ['Agreement End Date', formatDate(data.endDate)],
    ['Duration', `${data.durationMonths} months`],
    ['Rent Cycle', data.rentCycle],
    ...(data.lockInMonths ? [['Lock-in Period', `${data.lockInMonths} months`] as [string, string]] : []),
  ])

  section('4. Financial Details')
  rows([
    ['Monthly Rent', formatINR(data.monthlyRent)],
    ['Security Deposit', formatINR(data.securityDeposit)],
    ['Electricity Charges', data.electricityCharges],
    ['Maintenance Charges', formatINR(data.maintenanceCharges)],
    ...(data.otherCharges > 0 ? [['Other Charges', `${formatINR(data.otherCharges)}${data.otherChargesNote ? ` (${data.otherChargesNote})` : ''}`] as [string, string]] : []),
    ['Monthly Payment Due Date', `${ordinalDay(data.dueDay)} of every month`],
    ['Late Fee Policy', data.lateFeePolicy],
  ])

  if (y > pageHeight - 90) { doc.addPage(); drawWatermark(doc, 'DIGITALLY GENERATED'); y = 20 }
  section('5. Terms & Conditions')
  doc.setFontSize(9).setFont('helvetica', 'normal')
  TERMS.forEach((t, i) => {
    if (y > pageHeight - 20) { doc.addPage(); drawWatermark(doc, 'DIGITALLY GENERATED'); y = 20 }
    const lines = doc.splitTextToSize(`${i + 1}. ${t}`, pageWidth - 32)
    doc.text(lines, 16, y)
    y += lines.length * 4.5 + 2
  })
  y += 4

  if (y > pageHeight - 75) { doc.addPage(); drawWatermark(doc, 'DIGITALLY GENERATED'); y = 20 }
  section('6. Digital Acceptance')
  doc.setFontSize(9.5).setFont('helvetica', 'normal')
  doc.text('I have read, understood, and agree to the PG Agreement & Terms and Conditions.', 16, y)
  y += 8

  if (data.tenantSignature) {
    try { doc.addImage(data.tenantSignature, 'PNG', 16, y, 50, 20) } catch {}
  }
  doc.setDrawColor(200).line(16, y + 22, 66, y + 22)
  doc.setFontSize(8).setTextColor(120)
  doc.text('Tenant Signature', 16, y + 27)
  doc.setTextColor(0).setFontSize(9)
  doc.text(data.tenantSignedName || data.tenantName, 16, y + 32)
  doc.setFontSize(8).setTextColor(120)
  doc.text(data.tenantSignedAt ? `Signed on ${formatDate(data.tenantSignedAt)}` : '', 16, y + 37)

  doc.setDrawColor(200).line(pageWidth - 80, y + 22, pageWidth - 20, y + 22)
  doc.setTextColor(120).setFontSize(8)
  doc.text('Owner / Manager Signature', pageWidth - 80, y + 27)
  doc.setTextColor(0).setFontSize(9)
  doc.text(data.ownerName || 'Authorized Signatory', pageWidth - 80, y + 32)

  // QR verification — encodes a summary so the printed page can be
  // cross-checked against the digital record without needing a public
  // verification website.
  const qrY = y + 42
  if (qrY < pageHeight - 30) {
    const qrContent = `PG Manager Agreement\nNo: ${data.agreementNumber}\nTenant: ${data.tenantName}\nProperty: ${data.propertyName}\nRoom: ${data.roomNumber ?? '—'}\nStart: ${data.startDate}\nRent: ${data.monthlyRent}\nStatus: ${data.status}`
    await drawQRCode(doc, qrContent, pageWidth - 38, qrY, 24)
    doc.setFontSize(7).setTextColor(150)
    doc.text('Scan to verify', pageWidth - 38, qrY + 28)
  }

  doc.setFontSize(8).setTextColor(150)
  doc.text(`Status: ${data.status.toUpperCase()}`, 14, pageHeight - 10)

  doc.save(`${data.agreementNumber}.pdf`)
}
