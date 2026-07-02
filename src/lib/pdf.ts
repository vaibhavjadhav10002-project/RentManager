import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { formatINR, formatDate } from '@/lib/utils'

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
  roomNumber?: string
  forMonth?: string
  type: string
  totalDue: number
  amountReceived: number
  method?: string
  paymentDate: string
  approvalStatus: string
  receiptNo: string
}

export function generateReceiptPDF(data: ReceiptData) {
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()
  let y = 20

  doc.setFontSize(18).setFont('helvetica', 'bold')
  doc.text('Payment Receipt', pageWidth / 2, y, { align: 'center' })
  y += 8
  doc.setFontSize(10).setFont('helvetica', 'normal').setTextColor(120)
  doc.text(`Receipt No: ${data.receiptNo}`, pageWidth / 2, y, { align: 'center' })
  doc.setTextColor(0)
  y += 16

  doc.setFontSize(12).setFont('helvetica', 'bold')
  doc.text(data.propertyName, 14, y)
  y += 10

  const rows: [string, string][] = [
    ['Tenant', data.tenantName],
    ['Room', data.roomNumber ? `Room ${data.roomNumber}` : '—'],
    ['Payment Type', data.type.charAt(0).toUpperCase() + data.type.slice(1)],
    ['For Month', data.forMonth ?? '—'],
    ['Total Due', formatINR(data.totalDue)],
    ['Amount Received', formatINR(data.amountReceived)],
    ['Payment Mode', data.method?.replace('_', ' ').toUpperCase() ?? '—'],
    ['Payment Date', formatDate(data.paymentDate)],
    ['Status', data.approvalStatus.replace('_', ' ').toUpperCase()],
  ]

  autoTable(doc, {
    startY: y,
    head: [['Detail', 'Value']],
    body: rows,
    theme: 'grid',
    headStyles: { fillColor: [37, 99, 235] },
    styles: { fontSize: 10, cellPadding: 4 },
  })

  const finalY = (doc as any).lastAutoTable.finalY + 14
  doc.setFontSize(9).setTextColor(120)
  doc.text('This is a system-generated receipt from PG Manager.', 14, finalY)

  doc.save(`Receipt-${data.forMonth?.replace(/\s+/g, '-') ?? data.paymentDate}.pdf`)
}
