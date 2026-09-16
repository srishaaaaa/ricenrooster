import React from 'react'
import { BRAND_ADDRESS, BRAND_EMAIL, BRAND_EN, BRAND_LOGO, BRAND_PHONE_DISPLAY } from '../lib/brand'
import { formatQuantityDisplay, normalizeStructuredOrderItem, formatInvoiceNo } from '../lib/retail'
import { formatPhoneDisplay } from '../lib/phone'

export interface InvoiceItem {
  id?: number | string
  product_id?: number | null
  name: string
  nameTa?: string | null
  tamil_name?: string | null
  qty: number
  quantity?: number
  unit?: string
  unit_type?: 'unit' | 'weight' | 'volume' | 'bundle'
  base_quantity?: number
  base_price?: number
  line_total?: number
  price: number
  offerPrice?: number | null
}

export interface InvoiceProps {
  invoiceNo: string
  date: string
  customerName: string
  phone: string
  address: string
  items: InvoiceItem[]
  subtotal: number
  shipping: number
  total: number
  status?: string
  userId?: string
  deliveryCharge?: number
  discountAmount?: number
  couponCode?: string | null
  manualDiscountAmount?: number
  gstAmount?: number
  paymentMode?: string
  onPrintReceipt?: () => void
}

export const Invoice: React.FC<InvoiceProps> = ({
  invoiceNo,
  date,
  customerName,
  phone,
  address,
  items,
  subtotal,
  shipping,
  total,
  status = 'Pending',
  userId,
  deliveryCharge = 0,
  discountAmount = 0,
  couponCode,
  manualDiscountAmount = 0,
  gstAmount = 0,
  paymentMode,
  onPrintReceipt,
}) => {
  const formattedInvoiceNo = formatInvoiceNo(invoiceNo)
  const dateStr = (() => {
    try {
      return new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'numeric', year: 'numeric' })
    } catch {
      return new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'numeric', year: 'numeric' })
    }
  })()

  const effectiveDelivery = deliveryCharge || shipping

  // Project brand colors
  const RED  = '#D6402E'
  const DARK = '#141414'
  const GRAY = '#555555'

  const fmtRs = (val: number) => `Rs. ${val.toFixed(2)}`

  return (
    <div
      id="invoice-print-root"
      className="w-full max-w-[680px] mx-auto bg-white box-border flex flex-col flex-1 print:p-0 print:max-w-full overflow-hidden"
      style={{
        fontFamily: "'Inter', 'Segoe UI', Arial, sans-serif",
        fontSize: 13,
        color: '#1a1a2e',
        // Fills the parent's height (when the parent sets one, e.g. the A4
        // page-shaped wrapper on the digital invoice) so the footer's
        // marginTop: 'auto' below has room to push into and actually lands
        // at the bottom of the page instead of right under the totals.
        minHeight: '100%',
        // Extra top clearance: mobile PDF viewers (e.g. WhatsApp's in-app
        // browser opening a shared invoice) draw their own "1 of 1" page
        // badge over the top-left corner of the page, which otherwise
        // lands right on top of the TAX INVOICE heading.
        paddingTop: 'clamp(34px, 9vw, 48px)',
        paddingRight: 'clamp(12px, 4vw, 28px)',
        paddingBottom: 'clamp(14px, 4vw, 24px)',
        paddingLeft: 'clamp(12px, 4vw, 28px)',
      }}
    >
      {/* ── TOP BAR: TAX INVOICE | Invoice # ─────────────────────── */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '1px solid #d0d0d0',
          paddingBottom: 7,
          marginBottom: 16,
        }}
      >
        <span style={{ fontSize: 11, fontWeight: 700, color: RED, letterSpacing: 0.6 }}>
          TAX INVOICE
        </span>
        <span style={{ fontSize: 11, fontWeight: 600, color: RED }}>
          Invoice: #{formattedInvoiceNo}
        </span>
      </div>

      {/* ── BRAND ROW: Logo + Name/Address (left) | Date/Payment (right) ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
        {/* Left: logo + brand info */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 8,
              border: '1px solid #FDDBB4',
              overflow: 'hidden',
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: '#fff',
              boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
            }}
          >
            <img
              src={BRAND_LOGO}
              alt={`${BRAND_EN} logo`}
              style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
            />
          </div>
          <div>
            <div style={{ fontSize: 17, fontWeight: 800, color: RED, lineHeight: 1.2 }}>{BRAND_EN}</div>
            <div style={{ fontSize: 10, color: '#4b5563', marginTop: 3, maxWidth: 290, lineHeight: 1.55 }}>{BRAND_ADDRESS}</div>
            <div style={{ fontSize: 10, color: GRAY, marginTop: 2 }}>Phone: {BRAND_PHONE_DISPLAY}</div>
            {BRAND_EMAIL && (
              <div style={{ fontSize: 10, color: GRAY }}>Email: {BRAND_EMAIL}</div>
            )}
          </div>
        </div>

        {/* Right: Date / Payment / Status */}
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontSize: 11, color: GRAY }}>
            <span style={{ fontWeight: 600 }}>Date: </span>{dateStr}
          </div>
          {paymentMode && (
            <div style={{ fontSize: 11, color: GRAY, marginTop: 3 }}>
              <span style={{ fontWeight: 600 }}>Payment: </span>{paymentMode}
            </div>
          )}
          {status && (
            <div style={{ fontSize: 10, marginTop: 4 }}>
              <span
                style={{
                  display: 'inline-block',
                  padding: '2px 10px',
                  borderRadius: 99,
                  border: `1.5px solid ${RED}`,
                  color: RED,
                  fontSize: 9,
                  fontWeight: 800,
                  letterSpacing: 0.8,
                  textTransform: 'uppercase',
                }}
              >
                {status}
              </span>
            </div>
          )}
          {userId && (
            <div style={{ fontSize: 9, color: '#999', marginTop: 4, maxWidth: 160, wordBreak: 'break-all' }}>
              {userId}
            </div>
          )}
        </div>
      </div>

      {/* ── BILL TO ────────────────────────────────────────────────── */}
      <div
        style={{
          background: '#FFF8F6',
          border: '1px solid #FDDBB4',
          borderRadius: 6,
          padding: '10px 14px',
          marginBottom: 20,
        }}
      >
        <div
          style={{
            fontSize: 9, fontWeight: 700, color: '#888',
            textTransform: 'uppercase', letterSpacing: 1, marginBottom: 5,
          }}
        >
          Bill To
        </div>
        <div style={{ fontSize: 14, fontWeight: 800, color: '#1a1a2e' }}>
          {customerName || 'Walk-in Customer'}
        </div>
        <div style={{ fontSize: 11, color: '#4b5563', marginTop: 3 }}>
          Mobile Number: {phone ? formatPhoneDisplay(phone) : '—'}
        </div>
        {address && (
          <div style={{ fontSize: 11, color: '#4b5563', marginTop: 2 }}>
            Address: {address}
          </div>
        )}
      </div>

      {/* ── ITEMS TABLE ───────────────────────────────────────────── */}
      <div className="w-full overflow-x-auto">
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 300 }}>
          <thead>
            <tr style={{ background: DARK }}>
              <th style={{ padding: '9px 6px', textAlign: 'left',   fontSize: 10, fontWeight: 800, color: RED, textTransform: 'uppercase', letterSpacing: 0.8, width: 22 }}>#</th>
              <th style={{ padding: '9px 6px', textAlign: 'left',   fontSize: 10, fontWeight: 800, color: RED, textTransform: 'uppercase', letterSpacing: 0.8 }}>Item Description</th>
              <th style={{ padding: '9px 6px', textAlign: 'center', fontSize: 10, fontWeight: 800, color: RED, textTransform: 'uppercase', letterSpacing: 0.8, width: 58 }}>Qty</th>
              <th style={{ padding: '9px 6px', textAlign: 'right',  fontSize: 10, fontWeight: 800, color: RED, textTransform: 'uppercase', letterSpacing: 0.8, width: 78 }}>Rate</th>
              <th style={{ padding: '9px 6px', textAlign: 'right',  fontSize: 10, fontWeight: 800, color: RED, textTransform: 'uppercase', letterSpacing: 0.8, width: 82 }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => {
              const normalized = normalizeStructuredOrderItem(item as unknown as Record<string, unknown>)
              const displayName = normalized.tamil_name || item.nameTa || normalized.name
              const rowBg = idx % 2 === 0 ? '#ffffff' : '#fafafa'
              return (
                <tr key={idx} style={{ borderBottom: '1px solid #f0f0f0', background: rowBg }}>
                  <td style={{ padding: '10px 6px', fontSize: 11, color: '#999', verticalAlign: 'top' }}>{idx + 1}</td>
                  <td style={{ padding: '10px 6px', verticalAlign: 'top' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#1a1a2e' }}>{normalized.name}</div>
                    {displayName && displayName !== normalized.name && (
                      <div style={{ fontSize: 10, color: '#888', marginTop: 2 }}>{displayName}</div>
                    )}
                    {item.offerPrice && item.price !== item.offerPrice && (
                      <div style={{ fontSize: 10, color: '#aaa', textDecoration: 'line-through', marginTop: 2 }}>
                        Rs. {item.price.toFixed(2)}
                      </div>
                    )}
                  </td>
                  <td style={{ padding: '10px 6px', fontSize: 12, fontWeight: 600, color: '#555', textAlign: 'center', verticalAlign: 'top' }}>
                    {formatQuantityDisplay(normalized.quantity, normalized.unit, normalized.unit_type)}
                  </td>
                  <td style={{ padding: '10px 6px', fontSize: 12, fontWeight: 600, color: GRAY, textAlign: 'right', verticalAlign: 'top' }}>
                    {fmtRs(normalized.base_price)}
                  </td>
                  <td style={{ padding: '10px 6px', fontSize: 13, fontWeight: 800, color: RED, textAlign: 'right', verticalAlign: 'top' }}>
                    {fmtRs(normalized.line_total)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* ── TOTALS ────────────────────────────────────────────────── */}
      <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end' }}>
        <div style={{ minWidth: 260, width: '100%', maxWidth: 320 }}>

          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid #f0f0f0' }}>
            <span style={{ fontSize: 12, color: GRAY }}>Subtotal</span>
            <span style={{ fontSize: 12, fontWeight: 700 }}>{fmtRs(subtotal)}</span>
          </div>

          {discountAmount > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid #f0f0f0' }}>
              <span style={{ fontSize: 12, color: RED }}>
                Coupon{couponCode ? ` (${couponCode})` : ''}
              </span>
              <span style={{ fontSize: 12, fontWeight: 700, color: RED }}>-{fmtRs(discountAmount)}</span>
            </div>
          )}

          {manualDiscountAmount > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid #f0f0f0' }}>
              <span style={{ fontSize: 12, color: RED }}>Manual Discount</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: RED }}>-{fmtRs(manualDiscountAmount)}</span>
            </div>
          )}

          {gstAmount > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid #f0f0f0' }}>
              <span style={{ fontSize: 12, color: GRAY }}>GST</span>
              <span style={{ fontSize: 12, fontWeight: 700 }}>+{fmtRs(gstAmount)}</span>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid #f0f0f0' }}>
            <span style={{ fontSize: 12, color: GRAY }}>Delivery</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: effectiveDelivery > 0 ? '#1a1a2e' : RED }}>
              {effectiveDelivery > 0 ? fmtRs(effectiveDelivery) : 'FREE'}
            </span>
          </div>

          {/* TOTAL row */}
          <div
            style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              borderTop: `2px solid ${RED}`, paddingTop: 10, marginTop: 6,
            }}
          >
            <span style={{ fontSize: 15, fontWeight: 900, color: RED, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              TOTAL
            </span>
            <span style={{ fontSize: 20, fontWeight: 900, color: RED }}>
              {fmtRs(total)}
            </span>
          </div>
        </div>
      </div>

      {/* ── FOOTER ────────────────────────────────────────────────── */}
      {/* marginTop: 'auto' pins this to the bottom of the page instead of
          floating right under the totals — the invoice card is sized to a
          full A4 page, so short invoices leave a lot of empty space above
          a fixed-offset footer otherwise. */}
      <div
        style={{
          marginTop: 'auto',
          paddingTop: 14,
          borderTop: '1px dashed #d0d0d0',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: 12, fontWeight: 800, color: RED, letterSpacing: 0.5, textTransform: 'uppercase' }}>
          Thank you for shopping with us
        </div>
        {onPrintReceipt && (
          <button
            type="button"
            onClick={onPrintReceipt}
            className="print:hidden"
            style={{
              marginTop: 14,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: 0,
              borderRadius: 999,
              padding: '9px 18px',
              background: RED,
              color: '#fff',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Print Receipt
          </button>
        )}
      </div>
    </div>
  )
}
