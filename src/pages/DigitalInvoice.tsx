import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { Invoice } from '../components/Invoice'
import { Printer, ArrowLeft, MessageCircle, Download } from 'lucide-react'
import { printThermalReceipt } from '../lib/thermalPrint'
import { invoicePdfFile, invoicePdfFileFromElement } from '../lib/invoicePdf'
import { uploadInvoicePdf } from '../lib/storage'
import { isUuid, normalizeStructuredOrderItem, formatInvoiceNo } from '../lib/retail'
import { buildProfessionalWhatsAppMessage } from '../lib/whatsappMessage'
import { toWhatsAppUrl } from '../lib/phone'

export default function DigitalInvoice() {
  const { id } = useParams()
  const navigate = useNavigate()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [invoice, setInvoice] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const invoiceElementRef = useRef<HTMLDivElement>(null)
  // A4 is 210x297mm — mirror that ratio as a *minimum* height (not a fixed
  // aspect-ratio, which clips instead of growing) so the on-screen card and
  // the PDF captured from it both read as a full page, while still letting
  // longer invoices push past one page's worth of content instead of clipping.
  const [pageMinHeight, setPageMinHeight] = useState<number>()

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1)
    } else {
      navigate('/dashboard')
    }
  }

  useEffect(() => {
    async function loadInvoice() {
      if (!isSupabaseConfigured) {
        setError('Database connection not configured')
        setLoading(false)
        return
      }
      try {
        const identifier = decodeURIComponent(id || '').trim()
        const formattedIdentifier = formatInvoiceNo(identifier)
        const strippedIdentifier = identifier.replace(/^INV/i, '')

        const tryRpc = async (invNo: string) => supabase.rpc('get_public_invoice_by_number', { p_invoice_no: invNo })

        let rpcResult = await tryRpc(identifier)
        if (!rpcResult.data || (Array.isArray(rpcResult.data) && rpcResult.data.length === 0)) {
          if (strippedIdentifier && strippedIdentifier !== identifier) {
             rpcResult = await tryRpc(strippedIdentifier)
          }
        }
        if (!rpcResult.data || (Array.isArray(rpcResult.data) && rpcResult.data.length === 0)) {
          if (formattedIdentifier && formattedIdentifier !== identifier && formattedIdentifier !== strippedIdentifier) {
             rpcResult = await tryRpc(formattedIdentifier)
          }
        }

        const { data: rpcData, error: rpcError } = rpcResult
        let row = Array.isArray(rpcData) ? rpcData[0] : rpcData

        // Keep existing links working when the public-invoice RPC has not yet
        // been applied to the target project.
        if (!row || rpcError) {
          const tryTable = async (invNo: string) => supabase.from('orders').select('*').eq('invoice_no', invNo).maybeSingle()
          
          let tableResult = await tryTable(identifier)
          if (!tableResult.data && strippedIdentifier && strippedIdentifier !== identifier) {
            tableResult = await tryTable(strippedIdentifier)
          }
          if (!tableResult.data && formattedIdentifier && formattedIdentifier !== identifier && formattedIdentifier !== strippedIdentifier) {
            tableResult = await tryTable(formattedIdentifier)
          }
          
          row = tableResult.data

          if (!row && isUuid(identifier)) {
            const { data: idData } = await supabase
              .from('orders')
              .select('*')
              .eq('id', identifier)
              .maybeSingle()
            row = idData
          }

          if (!row) throw new Error('Invoice not found')
        }

        setInvoice(row)
      } catch (err: unknown) {
        if (err instanceof Error) {
          setError(err.message)
        } else {
          setError('Invoice not found')
        }
      } finally {
        setLoading(false)
      }
    }
    if (id) loadInvoice()
  }, [id])

  useEffect(() => {
    const el = invoiceElementRef.current
    if (!el) return
    const updateMinHeight = () => setPageMinHeight(el.offsetWidth * (297 / 210))
    updateMinHeight()
    const observer = new ResizeObserver(updateMinHeight)
    observer.observe(el)
    return () => observer.disconnect()
  }, [invoice])

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <span className="w-8 h-8 border-4 border-[#FDDBB4] border-t-[#D6402E] rounded-full animate-spin" />
      </div>
    )
  }

  if (error || !invoice) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center text-center p-6">
        <h1 className="text-2xl font-bold text-[#111111] mb-2">Invoice Not Found</h1>
        <p className="text-gray-500 mb-6">The requested invoice could not be found.</p>
        <button
          onClick={handleBack}
          className="inline-flex items-center gap-2 px-6 py-2 bg-[#141414] border border-[#E2503B] text-[#E2503B] rounded-full font-bold hover:bg-black transition cursor-pointer"
        >
          <ArrowLeft size={16} /> Back
        </button>
      </div>
    )
  }

  const invoiceItems = (Array.isArray(invoice.items) ? invoice.items : [])
    .map((item: Record<string, unknown>) => normalizeStructuredOrderItem(item))
  const subtotal = invoiceItems.reduce((sum: number, item: ReturnType<typeof normalizeStructuredOrderItem>) => sum + item.line_total, 0)

  const downloadPdf = async () => {
    if (!invoiceElementRef.current) return
    try {
      const file = await invoicePdfFileFromElement(invoiceElementRef.current, invoice.invoice_no)
      const url = URL.createObjectURL(file)
      const link = document.createElement('a')
      link.href = url
      link.download = file.name
      link.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (err) {
      console.error('Failed to generate invoice PDF:', err)
      alert('Could not generate the PDF. Please try again.')
    }
  }

  const shareViaWhatsApp = async () => {
    // Open the tab synchronously, in direct response to the click, so
    // Safari/Chrome popup blockers don't swallow it — everything below is
    // async (canvas render, upload), and by the time it resolves the
    // browser no longer considers this a user-gesture-initiated window.open.
    // No `noopener` here: that flag makes window.open() return null, which
    // would defeat the whole point of keeping a handle to navigate later.
    const shareWindow = window.open('', '_blank')

    try {
      const items = invoiceItems.map((item: ReturnType<typeof normalizeStructuredOrderItem>) => ({
        name: item.name,
        qty: item.quantity,
        unit: item.unit,
        unitType: item.unit_type,
        rate: item.base_price,
        lineTotal: item.line_total,
      }))
      const message = buildProfessionalWhatsAppMessage({
        customerName: invoice.customer_name,
        phone: invoice.phone,
        invoiceNumber: invoice.invoice_no,
        invoiceDate: invoice.created_at,
        items,
        subtotal,
        couponDiscount: invoice.discount_amount,
        manualDiscountAmount: invoice.manual_discount_amount,
        shipping: invoice.delivery_charge,
        gstAmount: invoice.total_gst || invoice.gst_amount || 0,
        total: invoice.total,
        paymentMode: invoice.payment_mode || invoice.payment_method,
      })

      const file = invoiceElementRef.current
        ? await invoicePdfFileFromElement(invoiceElementRef.current, invoice.invoice_no)
        : invoicePdfFile({
        invoiceNo: invoice.invoice_no,
        date: invoice.created_at,
        customerName: invoice.customer_name,
        phone: invoice.phone,
        address: invoice.address,
        items: invoiceItems as unknown as Array<Record<string, unknown>>,
        subtotal,
        shipping: Number(invoice.delivery_charge || 0),
        total: Number(invoice.total || 0),
        discountAmount: Number(invoice.discount_amount || 0),
        manualDiscountAmount: Number(invoice.manual_discount_amount || 0),
        gstAmount: Number(invoice.total_gst || invoice.gst_amount || 0),
        couponCode: invoice.coupon_code || undefined,
        paymentMode: invoice.payment_mode || invoice.payment_method || undefined,
        })

      let downloadLink = ''
      try {
        downloadLink = await uploadInvoicePdf(file, invoice.invoice_no)
      } catch (err) {
        console.warn('Failed to upload invoice PDF:', err)
      }

      const whatsappMessage = downloadLink
        ? `${message}\n\n📄 Download Invoice: ${downloadLink}`
        : `${message}\n\nThe PDF was downloaded. Please attach it in this chat before sending.`

      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        shareWindow?.close()
        try {
          await navigator.share({ files: [file], title: `Invoice ${invoice.invoice_no}`, text: whatsappMessage })
          return
        } catch { /* fall through to the WhatsApp web link below */ }
      }

      const downloadUrl = URL.createObjectURL(file)
      const link = document.createElement('a')
      link.href = downloadUrl
      link.download = file.name
      link.click()
      setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000)

      const waUrl = toWhatsAppUrl(invoice.phone, whatsappMessage)
      if (shareWindow && !shareWindow.closed) {
        shareWindow.location.href = waUrl
      } else {
        window.open(waUrl, '_blank', 'noopener,noreferrer')
      }
    } catch (err) {
      console.error('Failed to share invoice via WhatsApp:', err)
      shareWindow?.close()
      alert('Could not prepare the invoice for WhatsApp. Please try again.')
    }
  }

  const printReceipt = () => {
    const subtotal = invoice.total - (invoice.delivery_charge || 0) + (invoice.discount_amount || 0)
    printThermalReceipt({
      invoiceNo: invoice.invoice_no,
      date: invoice.created_at,
      customerName: invoice.customer_name,
      phone: invoice.phone,
      items: (invoice.items || []).map((item: Record<string, unknown>) => ({
        name: item.name || item.product_name,
        qty: item.qty || item.quantity,
        unit: item.unit,
        price: item.price || item.base_price || 0,
        line_total: item.line_total
      })),
      subtotal,
      shipping: invoice.delivery_charge || 0,
      couponDiscount: invoice.discount_amount || 0,
      totalGst: invoice.total_gst || invoice.gst_amount || 0,
      total: invoice.total > 0 ? invoice.total : (subtotal + (invoice.delivery_charge || 0) + (invoice.total_gst || invoice.gst_amount || 0) - (invoice.discount_amount || 0) - (invoice.manual_discount_amount || 0))
    })
  }

  return (
    <div className="app-scroll-root h-full overflow-y-auto hide-scrollbar bg-white font-sans pb-12 print:bg-white print:pb-0">
      {/* Top action bar */}
      <div className="bg-white border-b border-[#FDDBB4]/40 p-3 sm:p-4 sticky top-0 z-50 print:hidden flex flex-wrap items-center justify-between gap-2 max-w-4xl mx-auto">
        <button onClick={handleBack} className="flex items-center gap-2 text-[#374151] hover:text-[#111111] font-semibold text-sm transition-colors bg-white border border-[#FDDBB4]/60 px-3 sm:px-4 py-2 rounded-full shadow-sm cursor-pointer">
          <ArrowLeft size={16} /> Back
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={downloadPdf}
            className="flex items-center gap-2 bg-[#141414] border border-[#E2503B] text-[#E2503B] px-4 sm:px-5 py-2 rounded-full font-bold text-sm shadow-md hover:bg-black transition-colors"
          >
            <Download size={16} /> PDF
          </button>
          <button
            onClick={printReceipt}
            className="flex items-center gap-2 bg-white border border-[#FDDBB4]/60 text-[#374151] px-4 sm:px-5 py-2 rounded-full font-bold text-sm shadow-sm hover:bg-[#F9FAFB] transition-colors"
          >
            <Printer size={16} /> Print
          </button>
          <button
            onClick={shareViaWhatsApp}
            className="flex items-center gap-2 bg-green-500 text-white px-4 sm:px-5 py-2 rounded-full font-bold text-sm shadow-md hover:bg-green-600 transition-colors"
          >
            <MessageCircle size={16} /> WhatsApp
          </button>
        </div>
      </div>

      <div className="max-w-3xl mx-auto mt-4 print:mt-0 px-2 sm:px-0">
        <div
          ref={invoiceElementRef}
          className="flex flex-col bg-white shadow-xl rounded-2xl overflow-hidden print:shadow-none print:rounded-none border border-[#FDDBB4]/40 print:border-none print:!min-h-0"
          style={{ minHeight: pageMinHeight }}
        >
          <Invoice
            invoiceNo={invoice.invoice_no}
            date={invoice.created_at}
            customerName={invoice.customer_name}
            phone={invoice.phone}
            address={invoice.address}
            items={invoice.items || []}
            subtotal={subtotal}
            shipping={invoice.delivery_charge || 0}
            discountAmount={invoice.discount_amount || 0}
            manualDiscountAmount={invoice.manual_discount_amount || 0}
            gstAmount={invoice.total_gst || invoice.gst_amount || 0}
            couponCode={invoice.coupon_code}
            total={invoice.total > 0 ? invoice.total : (subtotal + (invoice.delivery_charge || 0) + (invoice.total_gst || invoice.gst_amount || 0) - (invoice.discount_amount || 0) - (invoice.manual_discount_amount || 0))}
            // Status pill and the in-card "Print Receipt" button are left out
            // of the WhatsApp-shared invoice: Print now lives in the action
            // bar above (outside the captured PDF/screenshot area), and the
            // status badge cluttered the plain document look customers see.
            status=""
            paymentMode={invoice.payment_mode || invoice.payment_method}
          />
        </div>
      </div>
    </div>
  )
}
