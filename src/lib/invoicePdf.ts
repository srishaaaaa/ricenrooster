import { jsPDF } from 'jspdf'
import html2canvas from 'html2canvas'
import { BRAND_ADDRESS, BRAND_EN, BRAND_EMAIL, BRAND_PHONE_DISPLAY } from './brand'
import { formatQuantityDisplay, normalizeStructuredOrderItem, formatInvoiceNo } from './retail'
import { LOGO_BASE64 } from './logoBase64'
import { formatPhoneDisplay } from './phone'

export type InvoicePdfData = {
  invoiceNo: string
  date: string
  customerName: string
  phone: string
  address: string
  items: Array<Record<string, unknown>>
  subtotal: number
  shipping: number
  total: number
  discountAmount?: number
  manualDiscountAmount?: number
  gstAmount?: number
  couponCode?: string | null
  paymentMode?: string
}

// jsPDF's built-in Helvetica font can't render the ₹ glyph (it's outside
// WinAnsiEncoding), so swap it for the ASCII-safe "Rs." in generated PDFs.
const money = (value: number) =>
  `Rs. ${Number(value || 0).toFixed(2)}`

/** Creates a compact A4 invoice that can be attached as a file to WhatsApp. */
export function createInvoicePdf(data: InvoicePdfData): Blob {
  const formattedNo = formatInvoiceNo(data.invoiceNo)
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })

  const pageWidth = 210
  const left = 14
  const right = 196
  const contentW = right - left

  // Brand colours
  const RED   = '#D6402E'
  const DARK  = '#141414'
  const INK   = '#1a1a2e'
  const MUTED = '#555555'
  const LIGHT = '#888888'

  // Extra top clearance: mobile PDF viewers (e.g. WhatsApp's in-app browser)
  // draw their own "1 of 1" page badge over the top-left corner of the page.
  let y = 20

  // ── TOP BAR: TAX INVOICE | Invoice # ─────────────────────────────
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(RED)
  doc.text('TAX INVOICE', left, y)
  doc.text(`Invoice: #${formattedNo}`, right, y, { align: 'right' })
  y += 5
  doc.setDrawColor('#d0d0d0')
  doc.setLineWidth(0.3)
  doc.line(left, y, right, y)
  y += 8

  // ── BRAND ROW: Logo + Name/Address (left) | Date/Payment (right) ─
  const logoSize = 20
  try {
    doc.addImage(LOGO_BASE64, 'PNG', left, y, logoSize, logoSize)
  } catch {
    // logo unavailable — skip silently
  }

  const brandX = left + logoSize + 5
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.setTextColor(RED)
  doc.text(BRAND_EN, brandX, y + 5)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(MUTED)
  const addressLines = doc.splitTextToSize(BRAND_ADDRESS, 90) as string[]
  doc.text(addressLines, brandX, y + 11)
  const afterAddress = y + 11 + addressLines.length * 3.5
  doc.text(`Phone: ${BRAND_PHONE_DISPLAY}`, brandX, afterAddress)
  if (BRAND_EMAIL) {
    doc.text(`Email: ${BRAND_EMAIL}`, brandX, afterAddress + 4)
  }

  // Right side: date + payment
  const dateStr = (() => {
    try { return new Date(data.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'numeric', year: 'numeric' }) }
    catch { return new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'numeric', year: 'numeric' }) }
  })()
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(MUTED)
  doc.text(`Date: ${dateStr}`, right, y + 4, { align: 'right' })
  if (data.paymentMode) {
    doc.text(`Payment: ${data.paymentMode}`, right, y + 9, { align: 'right' })
  }

  y += logoSize + 9

  // ── BILL TO CARD ──────────────────────────────────────────────────
  const customerName    = String(data.customerName || 'Walk-in Customer').trim()
  const customerPhone   = data.phone ? formatPhoneDisplay(String(data.phone).trim()) : '—'
  const customerAddress = String(data.address || '').trim()

  const nameLines    = doc.splitTextToSize(customerName, contentW - 12) as string[]
  const addrLines    = customerAddress
    ? doc.splitTextToSize(`Address: ${customerAddress}`, contentW - 12) as string[]
    : []
  const cardHeight   = 8 + nameLines.length * 5 + 5 + (addrLines.length > 0 ? addrLines.length * 4 + 2 : 0) + 4

  doc.setFillColor('#FFF8F6')
  doc.setDrawColor('#FDDBB4')
  doc.setLineWidth(0.4)
  doc.roundedRect(left, y, contentW, cardHeight, 2, 2, 'FD')

  // "BILL TO" label
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(6.5)
  doc.setTextColor(LIGHT)
  doc.text('BILL TO', left + 5, y + 6)

  // Customer name
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(INK)
  doc.text(nameLines, left + 5, y + 12)

  // Phone
  const phoneY = y + 12 + nameLines.length * 5 + 1
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(MUTED)
  doc.text(`Mobile Number: ${customerPhone}`, left + 5, phoneY)

  // Address
  if (addrLines.length > 0) {
    doc.text(addrLines, left + 5, phoneY + 5)
  }

  y += cardHeight + 9

  // ── ITEMS TABLE ───────────────────────────────────────────────────
  // Column x positions (right-aligned for qty/rate/amount)
  const colNum    = left + 4          // # (left)
  const colDesc   = left + 13         // Item description (left)
  const colQtyR   = 140               // Qty (right-align)
  const colRateR  = 165               // Rate (right-align)
  const colAmtR   = right - 3        // Amount (right-align)

  // Header row
  doc.setFillColor(DARK)
  doc.rect(left, y, contentW, 9, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7)
  doc.setTextColor(RED)
  doc.text('#',               colNum,   y + 6)
  doc.text('ITEM DESCRIPTION',colDesc,  y + 6)
  doc.text('QTY',             colQtyR,  y + 6, { align: 'right' })
  doc.text('RATE',            colRateR, y + 6, { align: 'right' })
  doc.text('AMOUNT',          colAmtR,  y + 6, { align: 'right' })
  y += 12

  data.items.forEach((raw, index) => {
    const item = normalizeStructuredOrderItem(raw)
    if (y > 255) { doc.addPage(); y = 20 }

    // Alternating row background
    if (index % 2 !== 0) {
      const nameL   = doc.splitTextToSize(item.name || 'Item', 80) as string[]
      const rowH    = Math.max(9, nameL.length * 4 + 5)
      doc.setFillColor('#fafafa')
      doc.rect(left, y - 3, contentW, rowH, 'F')
    }

    const nameLines2 = doc.splitTextToSize(item.name || 'Item', 80) as string[]

    // Row number
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(LIGHT)
    doc.text(String(index + 1), colNum, y)

    // Item name
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(INK)
    doc.text(nameLines2, colDesc, y)

    // Tamil name (if different)
    const tamilName = item.tamil_name
    if (tamilName && tamilName !== item.name) {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(6.5)
      doc.setTextColor(LIGHT)
      doc.text(String(tamilName), colDesc, y + nameLines2.length * 4 + 0.5)
    }

    // Qty
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(MUTED)
    doc.text(
      formatQuantityDisplay(item.quantity, item.unit, item.unit_type),
      colQtyR, y, { align: 'right' }
    )

    // Rate
    doc.text(money(item.base_price), colRateR, y, { align: 'right' })

    // Amount — red bold
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(RED)
    doc.text(money(item.line_total), colAmtR, y, { align: 'right' })

    const rowHeight = Math.max(10, nameLines2.length * 4 + 5)
    y += rowHeight

    // Row separator
    doc.setDrawColor('#f0f0f0')
    doc.setLineWidth(0.2)
    doc.line(left, y - 2, right, y - 2)
  })

  // ── TOTALS BLOCK ─────────────────────────────────────────────────
  y = Math.max(y + 6, 190)

  const totalsLabelX = 155
  const totalsValueX = right - 3

  const drawTotalRow = (
    label: string,
    value: string,
    color: string,
    bold = false,
  ) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal')
    doc.setFontSize(8.5)
    doc.setTextColor(color)
    doc.text(label, totalsLabelX, y, { align: 'right' })
    doc.text(value,  totalsValueX, y, { align: 'right' })
    y += 7
  }

  // Separator above totals
  doc.setDrawColor('#e8e8e8')
  doc.setLineWidth(0.3)
  doc.line(left, y - 3, right, y - 3)

  drawTotalRow('Subtotal', money(data.subtotal), INK)

  if ((data.discountAmount || 0) > 0) {
    const couponLabel = `Coupon${data.couponCode ? ` (${data.couponCode})` : ''}`
    drawTotalRow(couponLabel, `-${money(data.discountAmount || 0)}`, RED)
  }
  if ((data.manualDiscountAmount || 0) > 0) {
    drawTotalRow('Manual Discount', `-${money(data.manualDiscountAmount || 0)}`, RED)
  }
  if ((data.gstAmount || 0) > 0) {
    drawTotalRow('GST', `+${money(data.gstAmount || 0)}`, INK)
  }

  const effectiveDelivery = data.shipping || 0
  drawTotalRow(
    'Delivery',
    effectiveDelivery > 0 ? money(effectiveDelivery) : 'FREE',
    effectiveDelivery > 0 ? INK : RED,
  )

  // Thick red separator before TOTAL
  doc.setDrawColor(RED)
  doc.setLineWidth(0.8)
  doc.line(118, y - 3, right, y - 3)

  // TOTAL row — large, red, bold
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.setTextColor(RED)
  doc.text('TOTAL',          totalsLabelX, y + 5, { align: 'right' })
  doc.text(money(data.total), totalsValueX, y + 5, { align: 'right' })

  // ── FOOTER ────────────────────────────────────────────────────────
  const footerY = 282
  doc.setDrawColor('#d0d0d0')
  doc.setLineWidth(0.25)
  doc.line(left, footerY, right, footerY)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(RED)
  doc.text('THANK YOU FOR SHOPPING WITH US', pageWidth / 2, footerY + 8, { align: 'center' })

  return doc.output('blob')
}

export function invoicePdfFile(data: InvoicePdfData): File {
  return new File([createInvoicePdf(data)], `Invoice-${formatInvoiceNo(data.invoiceNo)}.pdf`, { type: 'application/pdf' })
}

/** Captures the rendered invoice so the downloaded PDF matches the visible view. */
export async function invoicePdfFileFromElement(
  element: HTMLElement,
  invoiceNo: string,
): Promise<File> {
  const formattedNo = formatInvoiceNo(invoiceNo)
  await document.fonts?.ready
  const canvas = await html2canvas(element, {
    backgroundColor: '#ffffff',
    scale: 2,
    useCORS: true,
    logging: false,
    windowWidth: element.scrollWidth,
    windowHeight: element.scrollHeight,
  })

  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' })
  const pageWidth = 210
  const pageHeight = 297
  const image = canvas.toDataURL('image/png')

  // Always fit the whole invoice on a single page: scale by whichever
  // dimension (width or height) is more restrictive, then center it.
  const widthFitHeight = (canvas.height * pageWidth) / canvas.width
  let drawWidth = pageWidth
  let drawHeight = widthFitHeight
  if (widthFitHeight > pageHeight) {
    drawHeight = pageHeight
    drawWidth = (canvas.width * pageHeight) / canvas.height
  }
  const offsetX = (pageWidth - drawWidth) / 2
  const offsetY = (pageHeight - drawHeight) / 2
  doc.addImage(image, 'PNG', offsetX, offsetY, drawWidth, drawHeight, undefined, 'FAST')

  return new File([doc.output('blob')], `Invoice-${formattedNo}.pdf`, { type: 'application/pdf' })
}
