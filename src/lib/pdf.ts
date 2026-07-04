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

// ─── Full PG Rental Agreement (with terms & digital signature) ────────────────
interface FullAgreementData {
  agreementNumber: string
  tenantName: string
  tenantPhone: string
  tenantEmail?: string
  governmentId?: string
  emergencyContact?: string
  propertyName: string
  propertyAddress?: string
  roomNumber?: string
  bedLabel?: string
  ownerName?: string
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

export function generateFullAgreementPDF(data: FullAgreementData) {
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  let y = 18

  doc.setFontSize(16).setFont('helvetica', 'bold')
  doc.text('PG Rental Agreement', pageWidth / 2, y, { align: 'center' })
  y += 6
  doc.setFontSize(9).setFont('helvetica', 'normal').setTextColor(120)
  doc.text(`Agreement No: ${data.agreementNumber}  ·  Version ${data.termsVersion}`, pageWidth / 2, y, { align: 'center' })
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
    ['Government ID', data.governmentId || '—'],
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
    ['Start Date', formatDate(data.startDate)],
    ['End Date', formatDate(data.endDate)],
    ['Duration', `${data.durationMonths} months`],
    ['Rent Cycle', data.rentCycle],
  ])

  section('4. Financial Details')
  rows([
    ['Monthly Rent', formatINR(data.monthlyRent)],
    ['Security Deposit', formatINR(data.securityDeposit)],
    ['Electricity Charges', data.electricityCharges],
    ['Maintenance Charges', formatINR(data.maintenanceCharges)],
    ...(data.otherCharges > 0 ? [['Other Charges', `${formatINR(data.otherCharges)}${data.otherChargesNote ? ` (${data.otherChargesNote})` : ''}`] as [string, string]] : []),
    ['Due Date', `${data.dueDay}${['th', 'st', 'nd', 'rd'][(data.dueDay % 10 > 3 || Math.floor(data.dueDay / 10) === 1) ? 0 : data.dueDay % 10]} of every month`],
    ['Late Fee Policy', data.lateFeePolicy],
  ])

  if (y > pageHeight - 90) { doc.addPage(); y = 20 }
  section('5. Terms & Conditions')
  doc.setFontSize(9).setFont('helvetica', 'normal')
  TERMS.forEach((t, i) => {
    if (y > pageHeight - 20) { doc.addPage(); y = 20 }
    const lines = doc.splitTextToSize(`${i + 1}. ${t}`, pageWidth - 32)
    doc.text(lines, 16, y)
    y += lines.length * 4.5 + 2
  })
  y += 4

  if (y > pageHeight - 70) { doc.addPage(); y = 20 }
  section('6. Digital Acceptance')
  doc.setFontSize(9.5).setFont('helvetica', 'normal')
  doc.text('I have read, understood, and agree to the PG Agreement & Terms and Conditions.', 16, y)
  y += 8

  if (data.tenantSignature) {
    try { doc.addImage(data.tenantSignature, 'PNG', 16, y, 55, 22) } catch {}
  }
  doc.setFontSize(8).setTextColor(120)
  doc.text('Tenant Signature', 16, y + 26)
  doc.setTextColor(0).setFontSize(9)
  doc.text(data.tenantSignedName || data.tenantName, 16, y + 31)
  doc.setFontSize(8).setTextColor(120)
  doc.text(data.tenantSignedAt ? `Signed on ${formatDate(data.tenantSignedAt)}` : '', 16, y + 36)

  doc.setTextColor(120).setFontSize(8)
  doc.text('Owner / Manager Signature', pageWidth - 80, y + 26)
  doc.setTextColor(0).setFontSize(9)
  doc.text('Pending owner approval', pageWidth - 80, y + 31)

  doc.setFontSize(8).setTextColor(150)
  doc.text(`Status: ${data.status.toUpperCase()}`, 14, pageHeight - 10)

  doc.save(`${data.agreementNumber}.pdf`)
}
