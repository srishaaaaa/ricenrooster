import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
import { Link, useNavigate } from 'react-router-dom'
import {
  Search, Trash2, Plus, Receipt, Printer, Minus, User,
  RefreshCw, ShoppingBag, MessageCircle, CheckCircle2,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  Wifi, WifiOff, Layers, X, ChevronDown, Power, LogOut, Volume2, VolumeX
} from 'lucide-react'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import { debounce } from '../lib/debounce'
import { useProductStore, useVariantStore, useAdminAuthStore, type Product } from '../store/store'
import { Invoice } from '../components/Invoice'
import CatalogModal from '../components/CatalogModal'
import AddProductModal from '../components/AddProductModal'
import { Button } from '../components/ui/Button'
import { IconButton } from '../components/ui/IconButton'
import { Card } from '../components/ui/Card'
import { Input } from '../components/ui/Input'
import { Select } from '../components/ui/Select'
import { Toggle } from '../components/ui/Toggle'
import { useToast } from '../components/ui/useToast'
import { invoicePdfFile } from '../lib/invoicePdf'
import { uploadInvoicePdf } from '../lib/storage'
import { createOrderWithStock } from '../services/orderService'
import { createAdvanceOrder, type AdvanceOrder, type AdvancePaymentMethod } from '../services/advanceOrderService'
import { printAdvanceReceipt } from '../lib/advanceReceipt'
import { printThermalReceipt } from '../lib/thermalPrint'
import {
  buildStructuredOrderItem,
  calculateLineTotal,
  formatCurrency,
  formatQuantityDisplay,
  formatInvoiceNo,
} from '../lib/retail'
import { buildProfessionalWhatsAppMessage, buildAdvanceDepositWhatsAppMessage } from '../lib/whatsappMessage'
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
import { getProductImage, onImgError } from '../lib/productImages'
import { normalizePhone, toWhatsAppUrl } from '../lib/phone'
import type { ProductVariant } from '../services/variantService'

// ── Types ──────────────────────────────────────────────────────────────────
type PosItem = Product & {
  qty: number
  selectedUnit: string
  basePrice: number | string
  lineTotal: number
  source?: 'catalogue' | 'manual'
  note?: string | null
  variantId?: string         // product_variants.id
  variantName?: string       // snapshot
  parentProductId?: string   // products.id (before synthetic override)
}

type InvoiceSnap = {
  id: string
  invoiceNo: string
  orderType: 'online_request' | 'pos_sale' | 'manual_sale'
  date: string
  items: PosItem[]
  subtotal: number
  shipping: number
  couponCode?: string
  couponDiscount: number
  manualDiscountAmount: number
  manualDiscountType: 'flat' | 'percent'
  manualDiscountValue: number
  gstAmount: number
  total: number
  customerName: string
  phone: string
  address: string
  amountReceived: number
  balanceReturned: number
  paymentMode: string
  paymentMethod?: string
  invoicePdfUrl?: string
}

// ── Helpers ────────────────────────────────────────────────────────────────
// Returns the product ID if it looks like a real DB identifier (UUID or numeric),
// or null for synthetic/manual IDs like "manual-<timestamp>".
const toProductId = (v: string | number): string | null => {
  const s = String(v ?? '').trim()
  if (!s) return null
  // Accept pure-numeric strings (BIGINT products.id)
  if (/^\d+$/.test(s)) return s
  // Accept UUID format (product_variants.id and UUID-keyed products)
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s)) return s
  // Anything else (e.g. "manual-1786182383886") is a client-side synthetic ID — not a real DB row
  return null
}

const makePosItem = (p: Product, qty?: number): PosItem => {
  const basePrice = p.offerPrice || p.price
  const q = Math.max(1, Math.round(qty ?? 1))
  const packLabel = p.predefinedOptions[0]?.label ?? p.unitLabel
  return { ...p, qty: q, selectedUnit: packLabel, basePrice, lineTotal: calculateLineTotal(q, p.unitType, p.baseQuantity, basePrice) }
}

const recalc = (item: PosItem, nextQty: number): PosItem => {
  const q = Math.max(1, Math.round(nextQty))
  return { ...item, qty: q, lineTotal: calculateLineTotal(q, item.unitType, item.baseQuantity, item.basePrice) }
}


// ── Billing panel payment modes ────────────────────────────────────────────
const BILLING_PAYMENT_METHODS = ['Cash', 'Credit Card', 'Debit Card', 'GPay', 'Others'] as const

// ── Category colours ───────────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
const CAT_COLOR: Record<string, string> = {
  'Bridal Shawl': '#7C3AED', 'Shawl': '#D97706', 'Dress': '#0D9488',
  'Saree': '#DC2626', 'Tops': '#92400E',
  'Bottoms': '#B45309', 'Accessories': '#1D4ED8',
}

// ══════════════════════════════════════════════════════════════════════════
type PosProps = {
  isEmbedded?: boolean
}

export default function Pos(props: PosProps = {}) {
  const { toast } = useToast()
  const { products, fetchProducts } = useProductStore()
  const { getVariants, fetchVariants } = useVariantStore()
  const l = (en: string, _ta: string) => en
  const navigate = useNavigate()
  const { logout, role } = useAdminAuthStore()
  const embeddedMode = Boolean(props.isEmbedded)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [billingAdjOpen, setBillingAdjOpen] = useState(false)

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [search, setSearch] = useState('')
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [activeCategory, setActiveCategory] = useState('All')
  const [items, setItems] = useState<PosItem[]>([])
  const [customer, setCustomer] = useState({ name: '', phone: '', address: '' })
  const [remarks, setRemarks] = useState('')
  const [referenceNumber, setReferenceNumber] = useState('')
  const [billingDate, setBillingDate] = useState('') // '' = use current date/time
  const [billingTime, setBillingTime] = useState('') // '' = midnight when a date is set, else current time
  const [paymentType, setPaymentType] = useState<string>('Cash')
  const [saving, setSaving] = useState(false)
  const [shipping, setShipping] = useState<string>('0')
  const [couponInput, setCouponInput] = useState('')
  const [couponLoading, setCouponLoading] = useState(false)
  const [couponError, setCouponError] = useState('')
  const [availableCoupons, setAvailableCoupons] = useState<{code: string}[]>([])
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; percentage: number; minOrderValue: number; discount?: number } | null>(null)
  const [manualDiscountType, setManualDiscountType] = useState<'flat' | 'percent'>('flat')
  const [manualDiscountValue, setManualDiscountValue] = useState('')
  const [error, setError] = useState('')
  const [invoice, setInvoice] = useState<InvoiceSnap | null>(null)
  const [cashReceived, setCashReceived] = useState<string>('')
  const [mobilePanelView, setMobilePanelView] = useState<'catalogue' | 'bill'>('catalogue')
  const [ordermode, setOrdermode] = useState<'online' | 'offline'>('offline')
  const [variantPickerProduct, setVariantPickerProduct] = useState<Product | null>(null)
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null)
  const [variantPickerQty, setVariantPickerQty] = useState(1)
  const [billGstEnabled, setBillGstEnabled] = useState(false)
  const [gstInput, setGstInput] = useState('')
  const [gstType, setGstType] = useState<'percent' | 'flat'>('percent')
  const [catalogOpen, setCatalogOpen] = useState(false)
  const [addProductOpen, setAddProductOpen] = useState(false)
  const [depositOpen, setDepositOpen] = useState(false)
  const [depositCreated, setDepositCreated] = useState<AdvanceOrder | null>(null)
  const [depositForm, setDepositForm] = useState({ amount: '', expectedDeliveryDate: '', paymentMethod: 'Cash' as AdvancePaymentMethod, address: '', remarks: '', referenceNumber: '' })
  const [dbCategories, setDbCategories] = useState<string[]>([])
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    void fetchProducts()
    void fetchVariants()
    if (!isSupabaseConfigured) return

    supabase.from('coupons').select('code').eq('is_active', true).order('created_at', { ascending: false }).limit(20)
      .then(({ data, error }) => {
        if (error) console.error('Failed to fetch coupons', error)
        else if (data) setAvailableCoupons(data)
      })

    // Completing a sale updates one product row per line item, which would
    // otherwise fire a full products re-fetch — and a re-render of the whole
    // catalogue/cart — once per row while the cashier is mid-checkout.
    const debouncedFetchProducts = debounce(() => void fetchProducts(), 400)
    const productChannel = supabase.channel('pos-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, () => debouncedFetchProducts())
      .subscribe()

    // Load active categories in sort_order
    supabase.from('categories').select('name_en').eq('is_active', true).order('sort_order')
      .then(({ data }) => {
        if (data) setDbCategories(data.map(c => c.name_en as string))
      })

    return () => { void supabase.removeChannel(productChannel) }
  }, [fetchProducts, fetchVariants])

  // ── Derived data ──────────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const categories = useMemo(() => {
    // Use DB active categories in sort_order; fall back to product categories if DB returns nothing
    if (dbCategories.length > 0) return ['All', ...dbCategories]
    const cats = Array.from(new Set(products.filter(p => p.isActive).map(p => p.category))).filter(Boolean)
    return ['All', ...cats]
  }, [dbCategories, products])

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    let src = products.filter(p => p.isActive)
    if (activeCategory !== 'All') src = src.filter(p => p.category === activeCategory)
    if (q) src = src.filter(p =>
      p.name.toLowerCase().includes(q) ||
      (p.nameTa || '').toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q)
    )
    return src.slice(0, 120)
  }, [products, search, activeCategory])

  const subtotal = items.reduce((s, i) => s + i.lineTotal, 0)
  const isValidCoupon = appliedCoupon && subtotal >= (appliedCoupon.minOrderValue || 0)
  const couponDiscount = isValidCoupon
    ? ((appliedCoupon.percentage || 0) > 0
        ? Math.round((subtotal * (appliedCoupon.percentage || 0) / 100) * 100) / 100
        : (appliedCoupon.discount || 0))
    : 0
  const manualDiscountNumeric = Math.max(0, Number(manualDiscountValue) || 0)
  const manualDiscountAmount = manualDiscountType === 'percent'
    ? Math.max(0, Math.round((subtotal * manualDiscountNumeric / 100) * 100) / 100)
    : manualDiscountNumeric

  const discountedSubtotal = Math.max(0, subtotal - couponDiscount - manualDiscountAmount)

  const totalGst = billGstEnabled
    ? (gstType === 'percent'
      ? Math.max(0, Math.round((discountedSubtotal * (Math.max(0, Number(gstInput) || 0) / 100)) * 100) / 100)
      : Math.max(0, Number(gstInput) || 0))
    : 0
  const total = Math.max(0, discountedSubtotal + (Number(shipping || 0) || 0) + totalGst)

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const itemQtyMap = useMemo(() => {
    const m: Record<string | number, number> = {}
    items.forEach(i => { m[i.id] = i.qty })
    return m
  }, [items])

  // ── Cart actions ──────────────────────────────────────────────────────
  const addItem = (product: Product) => {
    // For variant products, open variant picker instead of adding directly
    if (product.hasVariants) {
      const variants = getVariants(String(product.id))
      if (variants.length > 0) {
        setVariantPickerProduct(product)
        setSelectedVariant(variants[0])
        setVariantPickerQty(1)
        return
      }
    }
    setError('')
    setMobilePanelView('catalogue')
    setItems(cur => {
      const ex = cur.find(i => i.id === product.id)
      if (!ex) return [...cur, makePosItem(product)]
      return cur.map(i => i.id === product.id ? recalc(i, i.qty + 1) : i)
    })
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const addVariantToItems = () => {
    if (!variantPickerProduct || !selectedVariant) return
    setError('')
    const variantProduct: Product = {
      ...variantPickerProduct,
      id: selectedVariant.id,
      name: `${variantPickerProduct.name} - ${selectedVariant.variantName}`,
      price: selectedVariant.price,
      offerPrice: null,
      stock: selectedVariant.stock,
      stockQuantity: selectedVariant.stock,
      hasVariants: false,
      unitType: 'unit',
      baseQuantity: 1,
      unitLabel: selectedVariant.sizeLabel || variantPickerProduct.unitLabel || 'piece',
    }
    const addQty = Math.max(1, variantPickerQty)
    setItems(cur => {
      const ex = cur.find(i => i.id === variantProduct.id)
      if (!ex) {
        const item = makePosItem(variantProduct, addQty)
        item.variantId       = selectedVariant.id
        item.variantName     = selectedVariant.variantName
        item.parentProductId = String(variantPickerProduct.id)
        return [...cur, item]
      }
      return cur.map(i => i.id === variantProduct.id ? recalc(i, i.qty + addQty) : i)
    })
    setVariantPickerProduct(null)
    setSelectedVariant(null)
    setVariantPickerQty(1)
    setMobilePanelView('catalogue')
  }

  // Manual product addition (minimal, non-destructive)
  const [manualName, setManualName] = useState('')
  const [manualPrice, setManualPrice] = useState('')
  const [customItemOpen, setCustomItemOpen] = useState(false)
  const addManualItem = () => {
    setError('')
    const name = manualName.trim()
    const price = Number(manualPrice || 0)
    if (!name) { setError(l('Enter product name', 'பொருள் பெயர் உள்ளிடவும்')); return }
    if (price < 0) { setError(l('Enter valid price', 'சரியான விலை உள்ளிடவும்')); return }
    const prod: Product = {
      id: `manual-${Date.now()}`,
      name,
      category: 'Manual',
      remedy: [],
      price,
      offerPrice: null,
      unitType: 'unit',
      unitLabel: 'pc',
      baseQuantity: 1,
      stockQuantity: 999,
      stockUnit: 'pc',
      allowDecimalQuantity: false,
      predefinedOptions: [],
      isActive: true,
      sortOrder: 0,
      unit: '1pc',
      rating: 5,
      stock: 999,
      description: '',
      benefits: '',
      image: '/product-placeholder.svg',
      imageUrl: undefined,
      source: 'manual',
    }
    setManualName('')
    setManualPrice('')
    setCustomItemOpen(false)
    setItems(cur => [...cur, { ...makePosItem(prod), source: 'manual' }])
    setMobilePanelView('catalogue')
  }

  const removeItem = (id: string | number) => setItems(cur => cur.filter(i => i.id !== id))

  const updateItem = (id: string | number, field: 'name' | 'basePrice' | 'qty', value: string | number) => {
    setItems(cur => cur.map((item) => {
      if (item.id !== id) return item
      const nextItem = { ...item, [field]: value } as PosItem
      return field === 'basePrice' || field === 'qty' ? recalc(nextItem, nextItem.qty) : nextItem
    }))
  }

  const bumpQty = (id: string | number, delta: number) => {
    setItems(cur => {
      const ex = cur.find(i => i.id === id)
      if (!ex) return cur
      const next = ex.qty + delta
      if (next <= 0) return cur.filter(i => i.id !== id)
      return cur.map(i => i.id === id ? recalc(i, next) : i)
    })
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const setQty = (id: string | number, val: number) => {
    if (val <= 0) { removeItem(id); return }
    setItems(cur => cur.map(i => i.id === id ? recalc(i, val) : i))
  }

  const clearAll = () => {
    setItems([])
    setCustomer({ name: '', phone: '', address: '' })
    setInvoice(null)
    setCashReceived('')
    setCouponInput('')
    setAppliedCoupon(null)
    setCouponError('')
    setManualDiscountValue('')
    setManualDiscountType('flat')
    setError('')
    setShipping('0')
    setRemarks('')
    setReferenceNumber('')
    setBillingDate('')
    setBillingTime('')
    setBillGstEnabled(false)
    setGstInput('')
    setGstType('percent')
    setOrdermode('offline')
    setMobilePanelView('catalogue')
    searchRef.current?.focus()
  }

  const applyCoupon = async (overrideCode?: string) => {
    const code = (typeof overrideCode === 'string' ? overrideCode : couponInput).trim().toUpperCase()
    if (!code) { setCouponError('Enter a coupon code'); return }

    setCouponLoading(true)
    setCouponError('')
    setAppliedCoupon(null)

    try {
      if (!isSupabaseConfigured) {
        setCouponError('Coupon validation requires a live connection')
        return
      }

      const { data, error: dbErr } = await supabase
        .from('coupons')
        .select('*')
        .eq('is_active', true)
        .ilike('code', code)
        .single()

      if (dbErr || !data) {
        setCouponError('Invalid or expired coupon code')
        return
      }

      if (data.expiry_date && new Date(data.expiry_date) < new Date()) {
        setCouponError('This coupon has expired')
        return
      }

      if (data.usage_limit && data.usage_count >= data.usage_limit) {
        setCouponError('Coupon usage limit has been reached')
        return
      }

      if (data.min_order_value && subtotal < Number(data.min_order_value)) {
        setCouponError(`Minimum order of ${formatCurrency(Number(data.min_order_value))} required`)
        return
      }

      setAppliedCoupon({ code: String(data.code), percentage: Number(data.percentage), minOrderValue: Number(data.min_order_value || 0), discount: Number(data.discount || 0) })
    } catch {
      setCouponError('Failed to validate coupon. Try again.')
    } finally {
      setCouponLoading(false)
    }
  }

  const removeCoupon = () => {
    setAppliedCoupon(null)
    setCouponInput('')
    setCouponError('')
  }

  const getOrderType = (): 'pos_sale' | 'manual_sale' => (items.length > 0 && items.every((item) => item.source === 'manual') ? 'manual_sale' : 'pos_sale')

  const openDepositOrder = () => {
    if (!items.length) { setError('Add at least one product before creating a deposit order.'); return }
    if (!customer.name.trim()) { setError('Enter the customer name for the deposit order.'); return }
    if (!customer.phone.trim()) { setError('Enter the customer phone number for the deposit order.'); return }
    if (total <= 0) { setError('The order total must be greater than zero.'); return }
    const enteredAmount = Number(cashReceived) || 0
    const suggestedDeposit = enteredAmount > 0 && enteredAmount < total ? String(enteredAmount) : ''
    setDepositForm({ amount: suggestedDeposit, expectedDeliveryDate: '', paymentMethod: 'Cash', address: customer.address || '', remarks: '', referenceNumber: '' })
    setError('')
    setDepositOpen(true)
  }

  const saveDepositOrder = async (event: FormEvent) => {
    event.preventDefault()
    const depositAmount = Number(depositForm.amount)
    if (!Number.isFinite(depositAmount) || depositAmount <= 0 || depositAmount >= total) { setError(`Deposit must be greater than ${formatCurrency(0)} and less than ${formatCurrency(total)}.`); return }
    if (!depositForm.expectedDeliveryDate) { setError('Select the expected delivery date.'); return }
    setSaving(true); setError('')
    try {
      const allocationBase = items.reduce((sum, item) => sum + item.lineTotal, 0)
      let allocated = 0
      const productsSnapshot = items.map((item, index) => {
        const lineTotal = index === items.length - 1
          ? Math.max(0, Math.round((total - allocated) * 100) / 100)
          : Math.max(0, Math.round((allocationBase > 0 ? total * item.lineTotal / allocationBase : total / items.length) * 100) / 100)
        allocated += lineTotal
        return {
          product_id: item.parentProductId || toProductId(item.id), variant_id: item.variantId || null,
          variant_name: item.variantName || null, name: item.name, category: item.category,
          description: item.note || '', quantity: item.qty, unit: item.selectedUnit, unit_type: item.unitType,
          base_quantity: item.baseQuantity, base_price: Number(item.basePrice) || 0, line_total: lineTotal,
          source: 'advance_order', note: item.note || null,
        }
      })
      const created = await createAdvanceOrder({
        customerName: customer.name.trim(), phone: customer.phone.trim(), address: depositForm.address.trim(),
        productName: items.map(item => `${item.qty}× ${item.name}`).join(', '),
        category: Array.from(new Set(items.map(item => item.category).filter(Boolean))).join(', '),
        description: items.map(item => `${item.qty}× ${item.name}${item.note ? ` — ${item.note}` : ''}`).join('\n'),
        totalAmount: total, depositAmount, expectedDeliveryDate: depositForm.expectedDeliveryDate,
        remarks: depositForm.remarks, referenceNumber: depositForm.referenceNumber, paymentMethod: depositForm.paymentMethod, createdByName: role || 'Staff',
        products: productsSnapshot,
      })
      setDepositCreated(created)
      setDepositOpen(false)
      clearAll()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create deposit order')
    } finally {
      setSaving(false)
    }
  }

  // ── Generate bill ─────────────────────────────────────────────────────
  const generateBill = async () => {
    if (!items.length) { setError('Add at least one product.'); return }
    // Validate required phone
    const normalizedPhone = normalizePhone(customer.phone || '')
    if (!normalizedPhone) { setError('Please enter a valid Indian mobile number (e.g. 9876543210 or +91 98765 43210)'); return }
    // Validate payment amount (only required for cash)
    if (paymentType === 'Cash' && !cashReceived.trim()) { setError('Enter the amount received from customer'); return }
    if (paymentType === 'Cash' && cashReceivedNum < total) { setError(`Insufficient payment. Customer still owes ${formatCurrency(total - cashReceivedNum)}`); return }
    // Validate online mode availability
    if (ordermode === 'online' && !isSupabaseConfigured) { setError('Cannot place online orders while offline'); return }
    setSaving(true); setError('')
    try {
      const paymentMode = ordermode === 'online' ? 'online' : paymentType
      const created = await createOrderWithStock({
        customerName: customer.name.trim() || 'Walk-in Customer',
        phone: normalizedPhone,
        address: customer.address.trim() || 'POS Counter',
        items: items.map(item => buildStructuredOrderItem({
          productId:    item.parentProductId ? item.parentProductId : toProductId(item.id),
          variantId:    item.variantId   ?? null,
          variantName:  item.variantName ?? null,
          name: item.name,
          tamilName: item.tamilName || item.nameTa || null,
          quantity: item.qty,
          unit: item.selectedUnit,
          unitType: item.unitType,
          baseQuantity: item.baseQuantity,
          basePrice: Number(item.basePrice) || 0,
          imageUrl: item.imageUrl || item.image || null,
          source: item.source || 'catalogue',
          itemType: item.itemType || 'product',
          note: item.note || null,
        })),
        shipping: Number(shipping || 0),
        status: 'completed',
        orderMode: ordermode,
        orderType: getOrderType(),
        deliveryCharge: Number(shipping || 0),
        discountAmount: couponDiscount,
        manualDiscountAmount,
        manualDiscountType,
        manualDiscountValue: manualDiscountNumeric,
        couponCode: appliedCoupon?.code,
        couponPercentage: appliedCoupon?.percentage,
        totalGst,
        gstEnabled: billGstEnabled,
        paymentMethod: paymentMode
      })

      // ── CRITICAL: immediately fix totals in DB, independent of PDF upload ──
      // The RPC may store an incorrect total if items JSONB parsing differs.
      // This guarantees the correct client-computed values are always saved.
      // Determine the effective billing date/time
      const effectiveBillingDate = billingDate.trim()
        ? new Date(`${billingDate}T${billingTime.trim() || '00:00'}`).toISOString()
        : new Date().toISOString()
      await supabase.from('orders').update({
        subtotal,
        total,
        total_gst: totalGst,
        gst_amount: totalGst,
        payment_mode: paymentMode,
        payment_method: paymentMode,
        discount_amount: couponDiscount,
        manual_discount_amount: manualDiscountAmount,
        delivery_charge: Number(shipping || 0),
        remarks: remarks.trim(),
        reference_number: referenceNumber.trim(),
        billing_date: effectiveBillingDate,
      }).eq('id', created.orderId)
      const createdInvoice: InvoiceSnap = {
        id: created.orderId,
        invoiceNo: created.invoiceNo,
        orderType: getOrderType(),
        date: billingDate.trim() ? new Date(`${billingDate}T${billingTime.trim() || '00:00'}`).toISOString() : created.createdAt,
        items: [...items],
        subtotal,
        shipping: Number(shipping || 0),
        couponCode: appliedCoupon?.code,
        couponDiscount,
        manualDiscountAmount,
        manualDiscountType,
        manualDiscountValue: manualDiscountNumeric,
        gstAmount: totalGst,
        total,
        customerName: customer.name.trim() || 'Walk-in Customer',
        phone: normalizedPhone,
        address: customer.address.trim() || 'POS Counter',
        amountReceived: cashReceivedNum,
        balanceReturned: balanceToReturn,
        paymentMode: ordermode === 'online' ? 'Online' : paymentType,
        paymentMethod: paymentMode,
      }
      setInvoice(createdInvoice)
      toast.success('Bill generated successfully')

      void persistInvoicePdf(createdInvoice)
      setItems([])
      setCustomer({ name: '', phone: '', address: '' })
      void fetchProducts()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to generate bill')
    } finally {
      setSaving(false)
    }
  }

  const cashReceivedNum = Number(cashReceived) || 0
  const balanceToReturn = cashReceivedNum > 0 && cashReceivedNum >= total ? cashReceivedNum - total : 0
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const isInsufficientPayment = cashReceived !== '' && cashReceivedNum > 0 && cashReceivedNum < total
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const change = cashReceived && Number(cashReceived) >= total
    ? Number(cashReceived) - total : null

  const sendPosWhatsApp = (inv: InvoiceSnap) => {
    const invoiceUrl = `${window.location.origin}/invoice/${encodeURIComponent(inv.invoiceNo)}`
    const message = buildProfessionalWhatsAppMessage({
      customerName: inv.customerName,
      phone: inv.phone,
      invoiceNumber: inv.invoiceNo,
      invoiceUrl,
      paymentMode: inv.paymentMode || 'POS',
      items: inv.items.map((item) => ({
        name: item.name,
        qty: item.qty,
        unit: item.selectedUnit,
        unitType: item.unitType,
        rate: Number(item.basePrice) || 0,
        lineTotal: item.lineTotal,
      })),
      subtotal: inv.subtotal,
      couponDiscount: inv.couponDiscount,
      manualDiscountAmount: inv.manualDiscountAmount,
      shipping: inv.shipping,
      gstAmount: inv.gstAmount,
      total: inv.total,
    })
    window.open(toWhatsAppUrl(inv.phone || customer.phone || '', message), '_blank', 'noopener,noreferrer')
  }

  const persistInvoicePdf = async (inv: InvoiceSnap) => {
    try {
      const file = invoicePdfFile({
        invoiceNo: inv.invoiceNo,
        date: inv.date,
        customerName: inv.customerName,
        phone: inv.phone,
        address: inv.address,
        items: inv.items.map(item => ({ name: item.name, qty: item.qty, unit: item.selectedUnit, price: Number(item.basePrice) || 0, line_total: item.lineTotal })),
        subtotal: inv.subtotal,
        shipping: inv.shipping,
        discountAmount: inv.couponDiscount,
        manualDiscountAmount: inv.manualDiscountAmount,
        gstAmount: inv.gstAmount,
        couponCode: inv.couponCode,
        paymentMode: inv.paymentMode,
        total: inv.total,
      })
      // Upload PDF and save its URL — total fields already saved immediately after RPC
      const url = await uploadInvoicePdf(file, inv.invoiceNo)
      await supabase.from('orders').update({ invoice_pdf_url: url }).eq('id', inv.id)
      setInvoice(current => current?.id === inv.id ? { ...current, invoicePdfUrl: url } : current)
    } catch (err) {
      console.warn('Invoice PDF could not be stored:', err)
    }
  }

  const printReceipt = (inv: InvoiceSnap) => {
    // Print a Bluetooth/thermal receipt directly
    printThermalReceipt({
      invoiceNo: inv.invoiceNo,
      date: inv.date,
      customerName: inv.customerName,
      phone: inv.phone,
      items: inv.items.map(item => ({ name: item.name, qty: item.qty, unit: item.selectedUnit, price: Number(item.basePrice) || 0, line_total: item.lineTotal })),
      subtotal: inv.subtotal,
      shipping: inv.shipping,
      couponDiscount: inv.couponDiscount,
      manualDiscount: inv.manualDiscountAmount,
      totalGst: inv.gstAmount,
      total: inv.total,
    })
  }

  // ══ INVOICE SCREEN ════════════════════════════════════════════════════
  if (invoice) {
    const invoiceItems = invoice.items.map(item => ({
      id: item.id,
      name: item.name,
      nameTa: item.nameTa,
      qty: item.qty,
      quantity: item.qty,
      unit: item.selectedUnit,
      unit_type: item.unitType,
      base_quantity: item.baseQuantity,
      base_price: Number(item.basePrice) || 0,
      line_total: item.lineTotal,
      price: item.price,
      offerPrice: item.offerPrice,
    }))

    return (
      <div className="mobile-page-shell print:bg-white print:min-h-0">

        {/* Screen UI */}
        <div className="max-w-2xl mx-auto px-4 py-6 print:hidden space-y-4">
          {/* Header */}
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-green-50 text-green-600">
              <CheckCircle2 size={22} />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-[17px] font-black text-[#111111]">{l('Bill Generated', 'பில் உருவாக்கப்பட்டது')}</h1>
              <p className="text-[12px] font-bold text-[#6B7280]">#{formatInvoiceNo(invoice.invoiceNo)}</p>
            </div>
            <Button variant="secondary" size="sm" iconLeft={<Plus size={14} />} onClick={clearAll}>New Sale</Button>
          </div>

          {/* Payment receipt */}
          <Card padding="md">
            <p className="text-[10px] font-black uppercase tracking-widest text-[#6B7280] mb-3">{l('Payment Receipt', 'பண ரசீது')}</p>
            <div className="space-y-2.5">
              <div className="flex justify-between items-center pb-2.5 border-b border-[#FDDBB4]/40">
                <p className="text-[13px] font-bold text-[#6B7280]">{l('Grand Total', 'மொத்த தொகை')}</p>
                <p className="text-2xl font-black text-[#111111]">{formatCurrency(invoice.total)}</p>
              </div>
              <div className="flex justify-between items-center">
                <p className="text-[13px] font-bold text-[#6B7280]">{l('Amount Received', 'பெற்ற தொகை')}</p>
                <p className="text-xl font-black text-[#111111]">{formatCurrency(invoice.amountReceived)}</p>
              </div>
              {invoice.balanceReturned > 0 ? (
                <div className="flex justify-between items-center rounded-xl bg-blue-50 border border-blue-200 px-4 py-3">
                  <p className="text-[13px] font-black text-blue-700">{l('Balance Returned', 'திரும்பிய பணம்')}</p>
                  <p className="text-2xl font-black text-blue-700">{formatCurrency(invoice.balanceReturned)}</p>
                </div>
              ) : (
                <div className="flex items-center justify-center gap-1.5 rounded-xl bg-green-50 border border-green-200 px-4 py-3">
                  <CheckCircle2 size={15} className="text-green-600" />
                  <p className="text-[13px] font-black text-green-700">{l('Exact Amount Received', 'சரியான தொகை')}</p>
                </div>
              )}
            </div>
          </Card>

          {/* Actions */}
          <div className="grid grid-cols-3 gap-2.5">
            <button onClick={() => printReceipt(invoice)}
              className="flex flex-col items-center justify-center gap-1.5 rounded-xl border border-[#FDDBB4]/60 bg-white py-3 text-[#374151] hover:bg-[#F9FAFB] transition-colors">
              <Printer size={16} /> <span className="text-[11px] font-black">{l('Print', 'அச்சிடு')}</span>
            </button>
            <button onClick={() => sendPosWhatsApp(invoice)}
              className="flex flex-col items-center justify-center gap-1.5 rounded-xl border border-green-200 bg-green-50 py-3 text-green-700 hover:bg-green-100 transition-colors">
              <MessageCircle size={16} /> <span className="text-[11px] font-black">WhatsApp</span>
            </button>
            <button onClick={clearAll}
              className="flex flex-col items-center justify-center gap-1.5 rounded-xl border border-[#E2503B] bg-[#141414] py-3 text-[#E2503B] hover:bg-black transition-colors">
              <RefreshCw size={16} /> <span className="text-[11px] font-black">New Sale</span>
            </button>
          </div>

          {/* Items summary */}
          <Card padding="md">
            <p className="text-[10px] font-black uppercase tracking-wide text-[#6B7280] mb-3">{l('Items Sold', 'விற்ற பொருட்கள்')}</p>
            <div className="space-y-1.5">
              {invoice.items.map(item => (
                <div key={item.id} className="flex justify-between text-[13px]">
                  <span className="text-[#111111] font-medium">{item.name} × {formatQuantityDisplay(item.qty, item.selectedUnit, item.unitType)}</span>
                  <span className="font-bold text-[#111111]">{formatCurrency(item.lineTotal)}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Print view — full A4 invoice */}
        <div className="hidden print:block">
          <Invoice
            invoiceNo={invoice.invoiceNo}
            date={invoice.date}
            customerName={invoice.customerName}
            phone={invoice.phone}
            address={invoice.address}
            items={invoiceItems}
            subtotal={invoice.subtotal}
            shipping={invoice.shipping}
            total={invoice.total}
            status="Completed"
            discountAmount={invoice.couponDiscount || 0}
            manualDiscountAmount={invoice.manualDiscountAmount || 0}
            gstAmount={invoice.gstAmount || 0}
            couponCode={invoice.couponCode}
          />
        </div>
      </div>
    )
  }

  // ══ MAIN POS SCREEN ══════════════════════════════════════════════════
  return (
    <div data-embedded={embeddedMode} data-panel={mobilePanelView} className={`flex flex-col bg-[#FAFAFA] print:hidden ${embeddedMode ? '' : 'app-scroll-root h-full overflow-y-auto overflow-x-hidden hide-scrollbar'}`}>

      {/* Header */}
      <div className="px-4 pt-4 pb-3 md:px-6 md:pt-6 md:pb-4 shrink-0 flex flex-col gap-4 min-[480px]:flex-row min-[480px]:items-start min-[480px]:justify-between">
        <div className="min-w-0">
          <h2 className="text-[28px] md:text-[22px] font-black text-[#D6402E] flex items-start gap-2 leading-tight">
            <div className="w-1.5 h-6 bg-[#D6402E] rounded-full"></div>
            POS Billing Panel
          </h2>
          <p className="text-[13px] md:text-[12px] text-gray-500 font-medium ml-3.5 mt-1 pr-2">Quick Invoice generator & database synced checkout</p>
        </div>

        {/* Online/Offline Toggle & Logout */}
        <div className="flex gap-2 w-full min-[480px]:w-auto">
          <div className="grid grid-cols-2 bg-white rounded-xl border border-[#FDDBB4]/60 p-1 shadow-sm flex-1 min-[480px]:flex-none">
            <button
              onClick={() => setOrdermode('offline')}
              className={`h-9 px-4 rounded-lg text-[11px] font-black tracking-wider uppercase transition-colors ${ordermode === 'offline' ? 'bg-[#141414] text-[#E2503B]' : 'text-[#374151] hover:bg-[#F9FAFB]'}`}
            >
              Offline
            </button>
            <button
              onClick={() => setOrdermode('online')}
              className={`h-9 px-4 rounded-lg text-[11px] font-black tracking-wider uppercase transition-colors ${ordermode === 'online' ? 'bg-[#141414] text-[#E2503B]' : 'text-[#374151] hover:bg-[#F9FAFB]'}`}
            >
              Online
            </button>
          </div>
          {!embeddedMode && (
            <>
              <Button variant="secondary" size="md" onClick={() => navigate('/dashboard')}>Dashboard</Button>
              <IconButton
                variant="danger"
                size="lg"
                icon={<Power size={18} />}
                label="Logout"
                onClick={() => { logout(); navigate('/admin-login', { replace: true }) }}
              />
            </>
          )}
        </div>
      </div>

      {/* Main Content Split */}
      <div className="flex flex-col lg:flex-row gap-5 md:gap-6 px-4 md:px-6 pb-6 lg:h-[calc(100vh-120px)] lg:overflow-hidden">

        {/* LEFT COLUMN (approx 68%) */}
        <div className="flex-[2.1] flex flex-col gap-6 lg:overflow-y-auto lg:pb-4 hide-scrollbar">

          {/* Customer Details Card */}
          <Card padding="md">
            <h3 className="text-[14px] font-black text-[#111111] flex items-center gap-2 mb-4">
              <User size={16} className="text-[#D6402E]" />
              Customer Details
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-black text-[#374151] tracking-wider uppercase mb-1.5">Customer Name</label>
                <Input
                  type="text"
                  value={customer.name}
                  onChange={e => setCustomer({...customer, name: e.target.value})}
                  placeholder="Enter name"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-[#374151] tracking-wider uppercase mb-1.5">Mobile Number (WhatsApp)</label>
                <Input
                  type="text"
                  value={customer.phone}
                  onChange={e => setCustomer({...customer, phone: e.target.value})}
                  placeholder="Enter WhatsApp number"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-[#374151] tracking-wider uppercase mb-1.5">Remarks (Internal)</label>
                <Input
                  type="text"
                  value={remarks}
                  onChange={e => setRemarks(e.target.value)}
                  placeholder="Optional remarks"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-[#374151] tracking-wider uppercase mb-1.5">Reference Number</label>
                <Input
                  type="text"
                  value={referenceNumber}
                  onChange={e => setReferenceNumber(e.target.value)}
                  placeholder="Optional ref no."
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-[#374151] tracking-wider uppercase mb-1.5">Billing Date &amp; Time (Optional)</label>
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    id="pos-billing-date"
                    type="date"
                    className="text-left"
                    value={billingDate}
                    onChange={e => setBillingDate(e.target.value)}
                  />
                  <Input
                    id="pos-billing-time"
                    type="time"
                    className="text-left"
                    value={billingTime}
                    onChange={e => setBillingTime(e.target.value)}
                  />
                </div>
                <p className="mt-1 text-[10px] text-gray-400 font-medium">Leave blank to use today's date &amp; time</p>
              </div>
            </div>
          </Card>

          {/* Order Items Card */}
          <Card padding="none" className="flex-1 flex flex-col min-h-[400px]">
            {/* Card Header */}
            <div className="flex flex-col gap-4 p-4 md:p-5 border-b border-[#FDDBB4]/40">
              <h3 className="text-[14px] font-black text-[#111111] flex items-center gap-2">
                <Receipt size={16} className="text-[#D6402E]" />
                Order Items
              </h3>
              <div className="grid grid-cols-2 md:flex md:items-stretch gap-2">
                <Button variant="secondary" size="sm" iconLeft={<Trash2 size={13} />} onClick={clearAll} className="md:flex-1">Clear Order</Button>
                <Button variant="secondary" size="sm" iconLeft={<Search size={13} />} onClick={() => setCatalogOpen(true)} className="md:flex-1">Search Catalog</Button>
                <Button variant="primary" size="sm" iconLeft={<Plus size={13} />} onClick={() => setAddProductOpen(true)} className="md:flex-1">Add to Catalog</Button>
                <Button variant="secondary" size="sm" iconLeft={<Plus size={13} />} onClick={() => setCustomItemOpen(open => !open)} className="md:flex-1">Custom Item</Button>
              </div>
              {customItemOpen && (
                <form
                  onSubmit={e => { e.preventDefault(); addManualItem() }}
                  className="mt-3 grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_150px_auto] gap-2 rounded-xl border border-[#FDDBB4]/60 bg-[#FFFDFC] p-3"
                >
                  <Input
                    autoFocus
                    required
                    value={manualName}
                    onChange={e => setManualName(e.target.value)}
                    placeholder="Product name"
                  />
                  <Input
                    step="0.01"
                    type="number" onWheel={(e) => (e.target as HTMLInputElement).blur()}
                    value={manualPrice}
                    onChange={e => setManualPrice(e.target.value)}
                    placeholder="Price (₹, optional)"
                  />
                  <Button type="submit" variant="primary" size="sm">Add Item</Button>
                </form>
              )}
            </div>

            {/* Table Header */}
            <div className="hidden md:grid grid-cols-[1fr_100px_120px_40px] gap-3 px-5 py-3 border-b border-[#FDDBB4]/20 bg-[#FAFAFA]">
              <span className="text-[10px] font-black text-[#374151] tracking-wider uppercase">Item Name / Description</span>
              <span className="text-[10px] font-black text-[#374151] tracking-wider uppercase text-right">Price (₹)</span>
              <span className="text-[10px] font-black text-[#374151] tracking-wider uppercase text-center">Qty</span>
              <span></span>
            </div>

            {/* Table Body */}
            <div className="flex-1 overflow-y-auto hide-scrollbar p-3 space-y-3 md:space-y-2">
              {items.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-[#374151]/60">
                  <ShoppingBag size={40} className="mb-3 opacity-20" />
                  <p className="text-[13px] font-bold">No items added yet</p>
                </div>
              )}

              {items.map(item => (
                <div key={item.id}>
                  <div className="md:hidden border border-[#FDDBB4]/30 rounded-2xl p-4 bg-[#FFFDFC] space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-black uppercase tracking-wider text-[#374151] mb-1">Product Name</p>
                        {item.source === 'manual' ? (
                          <input
                            type="text"
                            value={item.name}
                            onChange={e => updateItem(item.id, 'name', e.target.value)}
                            placeholder="Item name"
                            className="w-full h-12 px-3 bg-[#FAFAFA] border border-[#FDDBB4]/40 rounded-xl text-[16px] font-bold text-[#111111] focus:outline-none focus:border-[#D6402E]"
                          />
                        ) : (
                          <div className="rounded-xl border border-[#FDDBB4]/30 bg-white px-3 py-3">
                            <p className="text-[16px] font-bold text-[#111111] break-words">{item.name} {item.variantName ? `- ${item.variantName}` : ''}</p>
                          </div>
                        )}
                      </div>
                      <IconButton
                        variant="secondary"
                        size="lg"
                        icon={<Trash2 size={16} />}
                        label={`Delete ${item.name}`}
                        onClick={() => removeItem(item.id)}
                        className="hover:!bg-red-50 hover:!text-red-500 hover:!border-red-200"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-[13px] font-black uppercase tracking-wider text-[#374151] mb-1">Price</p>
                        <input
                          type="number" onWheel={(e) => (e.target as HTMLInputElement).blur()}
                          value={item.basePrice === 0 ? '' : item.basePrice}
                          onChange={e => updateItem(item.id, 'basePrice', e.target.value)}
                          placeholder="0"
                          className={`w-full h-12 px-3 border rounded-xl text-[16px] font-black text-right focus:outline-none focus:border-[#D6402E] ${
                            item.source === 'manual'
                              ? 'bg-[#FAFAFA] border-[#FDDBB4]/40 text-[#111111]'
                              : 'bg-white border-[#D9E4D7] text-[#111111]'
                          }`}
                        />
                      </div>
                      <div>
                        <p className="text-[13px] font-black uppercase tracking-wider text-[#374151] mb-1">Total</p>
                        <div className="h-12 rounded-xl border border-[#FDDBB4]/30 bg-white px-3 flex items-center justify-end text-[16px] font-black text-[#D6402E]">
                          {formatCurrency(item.lineTotal)}
                        </div>
                      </div>
                    </div>

                    <div>
                      <p className="text-[13px] font-black uppercase tracking-wider text-[#374151] mb-1">Quantity</p>
                      <div className="flex items-center justify-between gap-2 border border-[#FDDBB4]/60 rounded-xl px-2 py-1.5 bg-white">
                        <IconButton variant="ghost" size="lg" icon={<Minus size={16} />} label="Decrease quantity" onClick={() => bumpQty(item.id, -1)} />
                        <span className="text-[16px] font-black text-[#111111] text-center">{item.qty}</span>
                        <IconButton variant="ghost" size="lg" icon={<Plus size={16} />} label="Increase quantity" onClick={() => bumpQty(item.id, 1)} />
                      </div>
                    </div>
                  </div>

                  <div className="hidden md:grid grid-cols-[1fr_100px_120px_40px] items-center gap-3 p-2 bg-white border border-[#FDDBB4]/30 rounded-xl hover:border-[#D6402E]/30 transition-colors">
                    {/* Item Name */}
                    <div className="min-w-0 flex items-center gap-2">
                      {item.source === 'manual' ? (
                        <input
                          type="text"
                          value={item.name}
                          onChange={e => updateItem(item.id, 'name', e.target.value)}
                          placeholder="Item name"
                          className="w-full px-3 py-2 bg-[#FAFAFA] border border-[#FDDBB4]/40 rounded-lg text-[13px] font-bold text-[#111111] focus:outline-none focus:border-[#D6402E]"
                        />
                      ) : (
                        <div className="px-3 py-2 w-full truncate border border-transparent flex items-center gap-2">
                          <span className="text-[13px] font-bold text-[#111111] truncate">{item.name} {item.variantName ? `- ${item.variantName}` : ''}</span>
                        </div>
                      )}
                      {item.source !== 'manual' && (
                        <span className="hidden sm:inline-flex px-2 py-0.5 rounded border border-[#D6402E]/20 text-[#D6402E] text-[9px] font-black tracking-wider uppercase shrink-0 bg-[#D6402E]/5">
                          CATALOG
                        </span>
                      )}
                    </div>

                    {/* Price */}
                    <div>
                      <input
                        type="number" onWheel={(e) => (e.target as HTMLInputElement).blur()}
                        value={item.basePrice === 0 ? '' : item.basePrice}
                        onChange={e => updateItem(item.id, 'basePrice', e.target.value)}
                        placeholder="0"
                        className={`w-full px-3 py-2 border rounded-lg text-[13px] font-black text-right focus:outline-none focus:border-[#D6402E] ${
                          item.source === 'manual'
                            ? 'bg-[#FAFAFA] border-[#FDDBB4]/40 text-[#111111]'
                            : 'bg-white border-[#D9E4D7] text-[#111111]'
                        }`}
                      />
                    </div>

                    {/* Quantity Controls */}
                    <div className="flex items-center justify-between border border-[#FDDBB4]/60 rounded-lg px-1 py-0.5 bg-white">
                      <IconButton variant="ghost" size="sm" className="h-6 w-6" icon={<Minus size={12} />} label="Decrease quantity" onClick={() => bumpQty(item.id, -1)} />
                      <span className="text-[13px] font-black text-[#111111] min-w-[20px] text-center">{item.qty}</span>
                      <IconButton variant="ghost" size="sm" className="h-6 w-6" icon={<Plus size={12} />} label="Increase quantity" onClick={() => bumpQty(item.id, 1)} />
                    </div>

                    {/* Delete */}
                    <IconButton
                      variant="secondary"
                      size="md"
                      icon={<Trash2 size={14} />}
                      label={`Delete ${item.name}`}
                      onClick={() => removeItem(item.id)}
                      className="hover:!bg-red-50 hover:!text-red-500 hover:!border-red-200"
                    />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* RIGHT COLUMN (approx 32%) */}
        <div className="flex-[1] flex min-h-0 flex-col gap-6 lg:sticky lg:top-4 lg:h-[calc(100vh-140px)] lg:max-h-[calc(100vh-140px)]">
          <div className="flex min-h-0 flex-col rounded-2xl border border-[#FDDBB4]/60 bg-[#FAF9F6] shadow-sm lg:h-full lg:max-h-full lg:overflow-hidden">

            {/* Header */}
            <div className="flex items-center justify-between p-3 border-b border-[#FDDBB4]/60 bg-white shrink-0">
              <h3 className="text-[18px] md:text-[14px] font-black text-[#111111] flex items-center gap-2">
                <Receipt size={16} className="text-[#D6402E]" />
                Current Order
              </h3>
              <span className={`px-2 py-1 rounded-full border text-[9px] font-black tracking-wider uppercase flex items-center gap-1.5 ${ordermode === 'offline' ? 'border-red-200 text-red-600 bg-red-50' : 'border-green-200 text-green-600 bg-green-50'}`}>
                <div className={`w-1.5 h-1.5 rounded-full ${ordermode === 'offline' ? 'bg-red-500' : 'bg-green-500'}`}></div>
                {ordermode} (POS)
              </span>
            </div>

            {/* Content body */}
            <div className="min-h-0 flex-1 lg:overflow-y-auto bg-white p-3 space-y-2 hide-scrollbar">

              {/* Info Table */}
              <div className="border border-[#FDDBB4]/40 rounded-xl overflow-hidden text-[11px] font-bold">
                <div className="flex justify-between px-3 py-2 border-b border-[#FDDBB4]/40 bg-[#FAFAFA]">
                  <span className="text-[#374151] uppercase">Source</span>
                  <span className="text-[#D6402E] border border-[#D6402E]/30 bg-[#D6402E]/5 px-1.5 rounded uppercase">{ordermode.toUpperCase()}</span>
                </div>
                <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-[#FDDBB4]/40">
                  <div className="min-w-0 flex items-center gap-1.5 text-[#111111]">
                    <User size={12} className="shrink-0 text-[#D6402E]" />
                    <span className="truncate">{customer.name || 'Walk-in Customer'}</span>
                  </div>
                  <span className={customer.phone && !normalizePhone(customer.phone) ? 'text-red-500' : 'text-[#6B7280]'}>
                    {customer.phone || 'No phone'}
                  </span>
                </div>
                {items.length > 0 && (
                  <div className="px-3 py-2 bg-[#FAFAFA] space-y-1 border-b border-[#FDDBB4]/40 max-h-[80px] overflow-y-auto hide-scrollbar">
                    {items.map(item => (
                <div key={item.id} className="flex justify-between gap-2 text-[#111111] text-[11px]">
                        <span className="break-words">{item.qty}x {item.name}</span>
                        <span className="shrink-0">{formatCurrency(item.lineTotal)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Coupon Code */}
              <div>
                <label className="block text-[10px] font-black text-[#374151] tracking-wider uppercase mb-1">Coupon Code</label>
                <div className="flex gap-2">
                  <Input
                    type="text"
                    size="sm"
                    value={couponInput}
                    onChange={e => {
                      const val = e.target.value.toUpperCase()
                      setCouponInput(val)
                      if (availableCoupons.some(c => c.code.toUpperCase() === val)) {
                        void applyCoupon(val)
                      }
                    }}
                    placeholder="Enter code"
                    disabled={appliedCoupon !== null}
                    list="pos-coupons"
                    className="uppercase"
                  />
                  <datalist id="pos-coupons">
                    {availableCoupons.map(c => (
                      <option key={c.code} value={c.code} />
                    ))}
                  </datalist>
                  {appliedCoupon ? (
                    <Button variant="danger" size="sm" onClick={removeCoupon}>Remove</Button>
                  ) : (
                    <Button variant="secondary" size="sm" onClick={() => void applyCoupon()} disabled={couponLoading || !couponInput.trim()}>Apply</Button>
                  )}
                </div>
                {couponError && <p className="text-[10px] font-bold text-red-500 mt-0.5">{couponError}</p>}
                {appliedCoupon && (
                  <p className="text-[10px] font-bold text-green-600 mt-0.5">Applied: -{formatCurrency(couponDiscount)}</p>
                )}
              </div>

              {/* Discount */}
              <div>
                <label className="block text-[10px] font-black text-[#374151] tracking-wider uppercase mb-1">Manual Discount</label>
                <div className="flex gap-2">
                  <div className="relative h-9 w-16 shrink-0">
                    <select
                      value={manualDiscountType}
                      onChange={e => setManualDiscountType(e.target.value as 'flat'|'percent')}
                      className="h-9 w-16 appearance-none rounded-xl border border-[#FDDBB4]/60 bg-white pl-3 pr-7 text-[12px] font-bold text-[#111111] outline-none transition-colors focus:border-[#D6402E]"
                    >
                      <option value="flat">₹</option>
                      <option value="percent">%</option>
                    </select>
                    <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[#374151]" />
                  </div>
                  <Input
                    type="number" onWheel={(e) => (e.target as HTMLInputElement).blur()}
                    size="sm"
                    value={manualDiscountValue}
                    onChange={e => setManualDiscountValue(e.target.value)}
                    placeholder="0"
                    className="text-right"
                  />
                </div>
              </div>

              {/* GST Toggle */}
              <div className="py-1 border-b border-[#FDDBB4]/40">
                <Toggle checked={billGstEnabled} onChange={setBillGstEnabled} label="Enable GST on Bill" />
              </div>

              {billGstEnabled && (
                <div className="flex gap-2">
                  <div className="relative h-9 w-16 shrink-0">
                    <select
                      value={gstType}
                      onChange={e => setGstType(e.target.value as 'flat'|'percent')}
                      className="h-9 w-16 appearance-none rounded-xl border border-[#FDDBB4]/60 bg-white pl-3 pr-7 text-[12px] font-bold text-[#111111] outline-none transition-colors focus:border-[#D6402E]"
                    >
                      <option value="percent">%</option>
                      <option value="flat">₹</option>
                    </select>
                    <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[#374151]" />
                  </div>
                  <Input
                    type="number" onWheel={(e) => (e.target as HTMLInputElement).blur()}
                    size="sm"
                    value={gstInput}
                    onChange={e => setGstInput(e.target.value)}
                    placeholder={gstType === 'percent' ? "e.g. 6" : "0"}
                    className="text-right"
                  />
                </div>
              )}

              {/* Summary calculations */}
              <div className="bg-[#FAFAF8] rounded-xl border border-[#FDDBB4]/40 p-2.5 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black text-[#374151]">Subtotal ({items.length} items)</span>
                  <span className="text-[12px] font-black text-[#111111]">{formatCurrency(subtotal)}</span>
                </div>

                {billGstEnabled && totalGst > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-black text-[#374151]">GST Amount</span>
                    <span className="text-[12px] font-black text-[#111111]">{formatCurrency(totalGst)}</span>
                  </div>
                )}

                <div className="flex items-center justify-between gap-2">
                  <span className="shrink-0 text-[11px] font-black text-[#374151]">Delivery</span>
                  <input
                    type="number" onWheel={(e) => (e.target as HTMLInputElement).blur()}
                    value={shipping}
                    onChange={e => setShipping(e.target.value)}
                    className="h-9 w-20 shrink-0 box-border rounded-xl border border-[#FDDBB4]/60 bg-white px-2 text-[12px] font-bold text-[#111111] text-right outline-none transition-colors focus:border-[#D6402E]"
                  />
                </div>

                <div className="h-px bg-[#FDDBB4]/60"></div>

                {/* Grand Total */}
                <div className="flex items-center justify-between pt-0.5">
                  <span className="text-[12px] font-black text-[#111111] uppercase tracking-wider">Grand Total</span>
                  <span className="text-2xl font-black text-[#D6402E] tracking-tight">{formatCurrency(total)}</span>
                </div>
              </div>

              {/* Payment Mode Selector */}
              <div>
                <label className="block text-[10px] font-black text-[#374151] tracking-wider uppercase mb-1">Payment Mode</label>
                <Select
                  value={paymentType}
                  onChange={e => setPaymentType(e.target.value)}
                  className="uppercase tracking-wide"
                >
                  {BILLING_PAYMENT_METHODS.map(mode => (
                    <option key={mode} value={mode}>{mode}</option>
                  ))}
                </Select>
              </div>

              {/* Amount Received (shown for all payment modes) */}
              {ordermode !== 'online' && (
              <div>
                <div className="border border-[#FDDBB4]/60 rounded-xl p-2.5 bg-white">
                  <label className="block text-[10px] font-black text-[#374151] tracking-wider uppercase mb-0.5">
                    {paymentType} — Amount Received (₹)
                  </label>
                  <Input
                    type="number" onWheel={(e) => (e.target as HTMLInputElement).blur()}
                    size="sm"
                    value={cashReceived}
                    onChange={e => setCashReceived(e.target.value)}
                    placeholder="0.00"
                    className="bg-[#FAFAFA]"
                  />
                  {cashReceivedNum > 0 && (
                    <div className="mt-2 flex justify-between items-center bg-[#F9FAFB] px-3 py-1.5 rounded-lg border border-[#FDDBB4]/40">
                      <span className="text-[10px] font-bold text-[#374151]">Return Balance:</span>
                      <span className="text-[12px] font-black text-[#111111]">{formatCurrency(balanceToReturn)}</span>
                    </div>
                  )}
                </div>
              </div>
              )}

              {error && (
                <div className="p-2.5 rounded-xl bg-red-50 border border-red-200 text-red-600 text-[11px] font-bold">
                  {error}
                </div>
              )}
            </div>

            {/* Action Buttons Fixed Footer */}
            <div className="shrink-0 border-t border-[#FDDBB4]/60 bg-white p-3 shadow-[0_-8px_20px_rgba(44,57,42,0.06)]">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={openDepositOrder}
                  disabled={saving || items.length === 0}
                  className="!border-gray-300 !bg-white !text-gray-500 hover:!bg-gray-50"
                >
                  Save as Deposit Order
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  onClick={generateBill}
                  loading={saving}
                  className="!border-emerald-600 !bg-emerald-600 !text-white hover:!bg-emerald-700"
                >
                  Complete Sale
                </Button>
              </div>
              <p className="mt-2 text-center text-[10px] font-bold text-[#6B7280]">Deposit orders do not count as revenue until the remaining payment is received.</p>
            </div>
          </div>
        </div>

      </div>

      {depositOpen && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/55 p-4">
          <form onSubmit={saveDepositOrder} className="max-h-[94vh] w-full max-w-lg overflow-y-auto hide-scrollbar rounded-3xl bg-white p-6 shadow-2xl">
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[.16em] text-violet-600">Advance payment only</p>
                <h3 className="text-xl font-black text-[#111111]">Save as Deposit Order</h3>
                <p className="mt-1 text-xs font-semibold text-amber-700">No sale or tax invoice will be created now.</p>
              </div>
              <button type="button" onClick={() => { setDepositOpen(false); setError('') }} className="rounded-lg p-1 text-gray-500 hover:bg-gray-100"><X size={20}/></button>
            </div>
            <div className="mb-4 rounded-2xl bg-violet-50 p-4">
              <div className="flex justify-between text-sm"><span className="font-bold text-violet-700">Order total</span><span className="font-black text-violet-900">{formatCurrency(total)}</span></div>
              <div className="mt-2 max-h-24 space-y-1 overflow-y-auto hide-scrollbar border-t border-violet-200 pt-2">{items.map(item => <div key={item.id} className="flex justify-between gap-3 text-xs"><span className="break-words">{item.qty}× {item.name}</span><span className="font-bold shrink-0">{formatCurrency(item.lineTotal)}</span></div>)}</div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block"><span className="mb-1 block text-[10px] font-black uppercase tracking-wide text-[#6B7280]">Deposit received *</span><input required autoFocus type="number" onWheel={(e) => (e.target as HTMLInputElement).blur()} min="0.01" max={Math.max(0, total - 0.01)} step="0.01" value={depositForm.amount} onChange={e => setDepositForm({...depositForm, amount:e.target.value})} className="w-full rounded-xl border px-3 py-2.5 text-sm font-bold outline-none focus:border-violet-600"/></label>
              <label className="block"><span className="mb-1 block text-[10px] font-black uppercase tracking-wide text-[#6B7280]">Remaining balance</span><div className="rounded-xl bg-red-50 px-3 py-2.5 text-sm font-black text-red-700">{formatCurrency(Math.max(0,total-Number(depositForm.amount||0)))}</div></label>
              <label className="block"><span className="mb-1 block text-[10px] font-black uppercase tracking-wide text-[#6B7280]">Expected delivery *</span><input required type="date" value={depositForm.expectedDeliveryDate} onChange={e => setDepositForm({...depositForm, expectedDeliveryDate:e.target.value})} className="w-full rounded-xl border px-3 py-2.5 text-sm font-bold outline-none focus:border-violet-600"/></label>
              <label className="block"><span className="mb-1 block text-[10px] font-black uppercase tracking-wide text-[#6B7280]">Payment method *</span><select value={depositForm.paymentMethod} onChange={e => setDepositForm({...depositForm,paymentMethod:e.target.value as AdvancePaymentMethod})} className="w-full rounded-xl border px-3 py-2.5 text-sm font-bold outline-none focus:border-violet-600"><option value="Cash">Cash</option><option value="Credit Card">Credit Card</option><option value="Debit Card">Debit Card</option><option value="Membership">Membership</option><option value="e-Wallet">e-Wallet</option><option value="QR Payment">QR Payment</option><option value="Ali Pay">Ali Pay</option><option value="WeChat Pay">WeChat Pay</option><option value="Shopee Pay">Shopee Pay</option><option value="Others">Others</option></select></label>
              <label className="block sm:col-span-2"><span className="mb-1 block text-[10px] font-black uppercase tracking-wide text-[#6B7280]">Delivery address</span><textarea value={depositForm.address} onChange={e => setDepositForm({...depositForm,address:e.target.value})} className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none focus:border-violet-600" rows={2}/></label>
              <label className="block sm:col-span-2"><span className="mb-1 block text-[10px] font-black uppercase tracking-wide text-[#6B7280]">Reference Number</span><input value={depositForm.referenceNumber} onChange={e => setDepositForm({...depositForm,referenceNumber:e.target.value})} className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none focus:border-violet-600" placeholder="e.g. PO-001, booking ref (optional)"/></label>
              <label className="block sm:col-span-2"><span className="mb-1 block text-[10px] font-black uppercase tracking-wide text-[#6B7280]">Remarks</span><textarea value={depositForm.remarks} onChange={e => setDepositForm({...depositForm,remarks:e.target.value})} className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none focus:border-violet-600" rows={2}/></label>
            </div>
            {error && <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-bold text-red-600">{error}</div>}
            <div className="mt-5 flex gap-3"><button type="button" onClick={() => { setDepositOpen(false); setError('') }} className="flex-1 rounded-xl border py-3 text-sm font-black">Cancel</button><button disabled={saving} className="flex-[1.5] rounded-xl bg-violet-700 py-3 text-sm font-black text-white disabled:opacity-50">{saving ? 'Saving…' : 'Confirm Deposit Order'}</button></div>
          </form>
        </div>
      )}

      {depositCreated && (
        <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/55 p-4">
          <div className="w-full max-w-md max-h-[90vh] overflow-y-auto hide-scrollbar rounded-3xl bg-white p-6 text-center shadow-2xl">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-2xl">✓</div>
            <p className="mt-4 text-[11px] font-black uppercase tracking-[.16em] text-violet-600">Deposit order saved</p>
            <h3 className="mt-1 text-2xl font-black text-[#111111]">{depositCreated.deposit_id}</h3>
            <p className="mt-2 text-sm text-[#6B7280]">Deposit {formatCurrency(depositCreated.deposit_amount)} · Balance {formatCurrency(depositCreated.remaining_balance)}</p>
            <div className="mt-5 grid grid-cols-2 gap-2"><button onClick={() => printAdvanceReceipt(depositCreated)} className="rounded-xl border border-violet-200 py-3 text-sm font-black text-violet-700"><Printer size={16} className="mr-1 inline"/>Print Receipt</button><button onClick={() => { const msg = buildAdvanceDepositWhatsAppMessage({ customerName: depositCreated.customer_name, depositId: depositCreated.deposit_id, productName: depositCreated.product_name, totalAmount: depositCreated.total_amount, depositAmount: depositCreated.deposit_amount, remainingBalance: depositCreated.remaining_balance, expectedDeliveryDate: depositCreated.expected_delivery_date }); window.open(toWhatsAppUrl(depositCreated.phone, msg), '_blank', 'noopener,noreferrer') }} className="rounded-xl bg-[#25D366] py-3 text-sm font-black text-white"><MessageCircle size={16} className="mr-1 inline -mt-0.5"/>WhatsApp</button></div>
            <button onClick={() => { setDepositCreated(null); searchRef.current?.focus() }} className="mt-3 w-full rounded-xl bg-[#111111] py-3 text-sm font-black text-white">Start New Order</button>
          </div>
        </div>
      )}

      {catalogOpen && (
        <CatalogModal
          isOpen={catalogOpen}
          onClose={() => setCatalogOpen(false)}
          onAdd={(p) => {
            addItem(p)
            setCatalogOpen(false)
          }}
        />
      )}

      {addProductOpen && (
        <AddProductModal
          isOpen={addProductOpen}
          onClose={() => setAddProductOpen(false)}
          onSuccess={() => {}}
        />
      )}
    </div>
  )
}
