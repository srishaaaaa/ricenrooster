import { formatInvoiceNo } from './retail'

export type WhatsAppLineItem = {
  name: string
  qty: number
  unit: string
  unitType: 'unit' | 'weight' | 'volume' | 'bundle'
  rate: number
  lineTotal: number
}

export type BuildWhatsAppMessageInput = {
  customerName?: string
  phone?: string
  invoiceNumber: string
  invoiceDate?: string
  invoiceUrl?: string
  paymentMode?: string
  items?: WhatsAppLineItem[]
  subtotal?: number
  couponDiscount?: number
  manualDiscountAmount?: number
  shipping?: number
  gstAmount?: number
  total?: number
}

export type AdvanceDepositWhatsAppInput = {
  customerName?: string
  depositId: string
  productName: string
  totalAmount: number
  depositAmount: number
  remainingBalance: number
  expectedDeliveryDate: string
  paymentMethod?: string
}

export const publicInvoiceUrl = (invoiceNumber: string) => {
  const formatted = formatInvoiceNo(invoiceNumber)
  const origin =
    typeof window !== 'undefined' && window.location?.origin && !window.location.origin.includes('localhost')
      ? window.location.origin
      : 'https://ricenrooster.vercel.app'
  return `${origin}/invoice/${encodeURIComponent(formatted)}`
}

export const buildProfessionalWhatsAppMessage = (input: BuildWhatsAppMessageInput) => {
  const customerName = input.customerName?.trim() || 'Valued Customer'
  const invoiceUrl = input.invoiceUrl || publicInvoiceUrl(input.invoiceNumber)
  const formattedNo = formatInvoiceNo(input.invoiceNumber)

  // Each item shows its ORIGINAL price (rate × qty), NOT the discounted line total
  const itemsText = input.items && input.items.length > 0
    ? input.items.map(item => {
        const originalLineAmt = Number(item.rate || 0) * Number(item.qty || 1)
        return `• ${item.name} (x${item.qty}) – ₹${originalLineAmt.toFixed(2)}`
      }).join('\n')
    : ''

  // Build totals section separately
  const subtotal = input.subtotal ?? 0
  const couponDisc = input.couponDiscount ?? 0
  const manualDisc = input.manualDiscountAmount ?? 0
  const totalDiscount = couponDisc + manualDisc
  const shipping = input.shipping ?? 0
  const gst = input.gstAmount ?? 0
  const total = input.total ?? 0

  const totalsLines: string[] = []
  if (input.items && input.items.length > 0) {
    totalsLines.push(`Subtotal: ₹${subtotal.toFixed(2)}`)
  }
  if (totalDiscount > 0) {
    totalsLines.push(`Discount: -₹${totalDiscount.toFixed(2)}`)
  }
  if (shipping > 0) {
    totalsLines.push(`Shipping: ₹${shipping.toFixed(2)}`)
  }
  if (gst > 0) {
    totalsLines.push(`GST: ₹${gst.toFixed(2)}`)
  }
  if (input.total !== undefined) {
    totalsLines.push(`*Total Amount: ₹${total.toFixed(2)}*`)
  }

  const totalsText = totalsLines.join('\n')

  return `✨ *RICE N' ROOSTER* ✨
🍗 *Official Purchase Invoice & Receipt* 🍗

Dear ${customerName},

Thank you for shopping with Rice n' Rooster! We truly appreciate your order.

🧾 *INVOICE DETAILS*
📌 *Invoice No:* #${formattedNo}
${input.invoiceDate ? `📅 *Date:* ${new Date(input.invoiceDate).toLocaleDateString('en-MY')}\n` : ''}${input.paymentMode ? `💳 *Payment Mode:* ${input.paymentMode}\n` : ''}
${itemsText ? `📦 *ITEMS ORDERED:*\n${itemsText}\n\n${totalsText}\n` : input.total !== undefined ? `💰 *Total Amount:* ₹${total.toFixed(2)}\n` : ''}
📄 *View & Download Digital Invoice / PDF:*
👉 ${invoiceUrl}

🙏 Thank you, and we hope to see you again soon!

Follow us on Instagram:
https://www.instagram.com/ricenrooster`
}

export const buildAdvanceDepositWhatsAppMessage = (input: AdvanceDepositWhatsAppInput) => {
  const customerName = input.customerName?.trim() || 'Valued Customer'
  const deliveryDateFormatted = input.expectedDeliveryDate
    ? (() => {
        try {
          return new Date(`${input.expectedDeliveryDate}T00:00:00`).toLocaleDateString('en-MY', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
          })
        } catch {
          return input.expectedDeliveryDate
        }
      })()
    : '-'

  return `🍗 Thank You for Your Advance Order with Rice n' Rooster! 🍗

Dear ${customerName},

✨ Thank you for choosing Rice n' Rooster. We have successfully received your initial advance payment!

🧾 Advance Deposit Details 👇
📦 Deposit ID: ${input.depositId}
🍽️ Product: ${input.productName}
💵 Total Order Amount: ₹${input.totalAmount}
💰 Advance Paid: ₹${input.depositAmount}${input.paymentMethod ? ` (${input.paymentMethod.toLowerCase() === 'upi' ? 'QR' : input.paymentMethod.toUpperCase()})` : ''}
🔴 Balance to Pay on Delivery: ₹${input.remainingBalance}
📅 Expected Delivery Date: ${deliveryDateFormatted}

.

🍳 Preparation for your order is now underway. We will have everything ready on or before ${deliveryDateFormatted} for final payment and delivery/pickup!

.

🙏 Thank you for paying the initial amount as advance!`
}

export const BUSINESS_PHONE = '919363400210'
