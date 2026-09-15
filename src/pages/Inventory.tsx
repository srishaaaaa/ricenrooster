import React, { useState, useEffect, useCallback } from 'react'
import { Package, Search, AlertTriangle, X, RefreshCw, Edit2, Plus, Minus, Trash2, Download, TrendingUp, PieChart, Boxes, Tag, BarChart3, Layers, IndianRupee, History, SlidersHorizontal, Target, Undo2, CheckCircle2, ArrowUpRight, ArrowDownRight, ShoppingCart, ChevronDown, PackagePlus } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { formatCurrency } from '../lib/retail'
import LowStockAlarmModal from '../components/LowStockAlarmModal'
import { BRAND_EN } from '../lib/brand'
import { useAdminAuthStore } from '../store/store'
import { useBodyScrollLock } from '../components/ui/useBodyScrollLock'

// inventory_logs has no column for "who made this adjustment" (admin/staff
// share one login each, not per-person accounts, so there's no real user
// identity to store). The role at the moment of adjustment is tagged onto
// the existing free-text reference_id/note field instead of leaving it
// untracked — parsed back out here for display.
const USER_TAG_RE = /^\[(Admin|Staff)\]\s?/
const tagNoteWithUser = (role: 'admin' | 'staff' | null, note: string) => `[${role === 'staff' ? 'Staff' : 'Admin'}] ${note}`.trim()
const parseLoggedNote = (referenceId: string | null | undefined): { user: string; note: string } => {
  const raw = referenceId || ''
  const match = raw.match(USER_TAG_RE)
  if (match) return { user: match[1], note: raw.slice(match[0].length).trim() }
  return { user: '—', note: raw }
}

interface InventoryProduct {
  id: string | number
  name: string
  category: string
  stock_quantity: number
  low_stock_alert: number
  price: number
  purchase_price?: number
  is_active: boolean
  updated_at: string
  image_url?: string
  item_type?: 'product' | 'service'
  description?: string | null
}

interface Category {
  id: string | number
  name_en: string
  name_ta?: string
  is_active: boolean
  sort_order?: number
}

interface AdjustModal {
  product: InventoryProduct
  qty: string
  adjustType: 'restock' | 'loss' | 'return' | 'reconciliation'
  note: string
}

interface ProductForm {
  name: string
  category: string
  price: string
  purchase_price: string
  stock_quantity: string
  low_stock_alert: string
  is_active: boolean
  item_type: 'product' | 'service'
  description: string
}

const EMPTY_FORM: ProductForm = {
  name: '',
  category: '',
  price: '',
  purchase_price: '',
  stock_quantity: '0',
  low_stock_alert: '5',
  is_active: true,
  item_type: 'product',
  description: '',
}

const getStatus = (p: InventoryProduct) => {
  if (p.stock_quantity <= 0) return 'out'
  if (p.stock_quantity <= (p.low_stock_alert || 5)) return 'low'
  return 'ok'
}

interface InventoryLog {
  id: string
  product_id: string | number
  old_quantity: number
  new_quantity: number
  adjustment: number
  reason: string
  reference_id?: string
  created_at: string
  products?: { name: string; category: string }
}

type DatePreset = 'all' | 'today' | 'week' | 'month' | 'custom'

const ADJUST_TYPE_META: Record<AdjustModal['adjustType'], {
  label: string
  sublabel: string
  Icon: typeof Plus
  isAddition: boolean
  border: string
  bg: string
  iconOn: string
  iconOff: string
  accentBg: string
  accentText: string
  panelBg: string
  panelBorder: string
}> = {
  restock: {
    label: 'Restock', sublabel: '+ Add Units', Icon: Plus, isAddition: true,
    border: 'border-emerald-500', bg: 'bg-emerald-50', iconOn: 'bg-emerald-500 text-white', iconOff: 'bg-gray-100 text-gray-400',
    accentBg: 'bg-emerald-600', accentText: 'text-emerald-600', panelBg: 'bg-emerald-50/60', panelBorder: 'border-emerald-200',
  },
  return: {
    label: 'Customer Return', sublabel: '+ Add Units', Icon: Undo2, isAddition: true,
    border: 'border-violet-500', bg: 'bg-violet-50', iconOn: 'bg-violet-500 text-white', iconOff: 'bg-gray-100 text-gray-400',
    accentBg: 'bg-violet-600', accentText: 'text-violet-600', panelBg: 'bg-violet-50/60', panelBorder: 'border-violet-200',
  },
  loss: {
    label: 'Loss / Damaged', sublabel: '− Deduct Units', Icon: Minus, isAddition: false,
    border: 'border-red-400', bg: 'bg-red-50', iconOn: 'bg-red-500 text-white', iconOff: 'bg-gray-100 text-gray-400',
    accentBg: 'bg-red-600', accentText: 'text-red-600', panelBg: 'bg-red-50/60', panelBorder: 'border-red-200',
  },
  reconciliation: {
    label: 'Reconciliation', sublabel: 'Set Exact Count', Icon: Target, isAddition: true,
    border: 'border-blue-400', bg: 'bg-blue-50', iconOn: 'bg-blue-500 text-white', iconOff: 'bg-gray-100 text-gray-400',
    accentBg: 'bg-blue-600', accentText: 'text-blue-600', panelBg: 'bg-blue-50/60', panelBorder: 'border-blue-200',
  },
}

const REASON_COLORS: Record<string, string> = {
  restock: 'bg-emerald-100 text-emerald-700',
  sale: 'bg-blue-100 text-blue-700',
  return: 'bg-purple-100 text-purple-700',
  loss: 'bg-red-100 text-red-700',
  manual_adjustment: 'bg-orange-100 text-orange-700',
}

function InventoryAnalytics({ products, downloadCSV }: { products: InventoryProduct[]; downloadCSV: () => void }) {
  const [datePreset, setDatePreset] = useState<DatePreset>('week')
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 7); return d.toISOString().split('T')[0]
  })
  const [toDate, setToDate] = useState(() => new Date().toISOString().split('T')[0])
  const [logs, setLogs] = useState<InventoryLog[]>([])
  const [loadingLogs, setLoadingLogs] = useState(false)
  const [ledgerSearch, setLedgerSearch] = useState('')
  const [ledgerTypeFilter, setLedgerTypeFilter] = useState<'all' | InventoryLog['reason']>('all')

  const applyPreset = (preset: DatePreset) => {
    setDatePreset(preset)
    const now = new Date()
    const today = now.toISOString().split('T')[0]
    if (preset === 'all') { setFromDate('2000-01-01'); setToDate(today) }
    else if (preset === 'today') { setFromDate(today); setToDate(today) }
    else if (preset === 'week') { const d = new Date(); d.setDate(d.getDate() - 7); setFromDate(d.toISOString().split('T')[0]); setToDate(today) }
    else if (preset === 'month') { const d = new Date(); d.setDate(1); setFromDate(d.toISOString().split('T')[0]); setToDate(today) }
  }

  const [refreshTick, setRefreshTick] = useState(0)

  useEffect(() => {
    const fetchLogs = async () => {
      setLoadingLogs(true)
      const from = new Date(fromDate + 'T00:00:00').toISOString()
      const to = new Date(toDate + 'T23:59:59').toISOString()
      const { data } = await supabase
        .from('inventory_logs')
        .select('*, products(name, category)')
        .gte('created_at', from)
        .lte('created_at', to)
        .order('created_at', { ascending: false })
      setLogs((data as InventoryLog[]) || [])
      setLoadingLogs(false)
    }
    void fetchLogs()
  }, [fromDate, toDate, refreshTick])

  const totalIncoming = logs.filter(l => l.adjustment > 0).reduce((s, l) => s + l.adjustment, 0)
  const totalLost = logs.filter(l => l.reason === 'loss').reduce((s, l) => s + Math.abs(l.adjustment), 0)
  const totalSold = logs.filter(l => l.reason === 'sale').reduce((s, l) => s + Math.abs(l.adjustment), 0)
  const netDelta = logs.reduce((s, l) => s + l.adjustment, 0)

  const filteredLogs = logs.filter(l => {
    if (ledgerTypeFilter !== 'all' && l.reason !== ledgerTypeFilter) return false
    if (!ledgerSearch.trim()) return true
    const q = ledgerSearch.trim().toLowerCase()
    const { user, note } = parseLoggedNote(l.reference_id)
    return (l.products?.name || '').toLowerCase().includes(q)
      || (l.products?.category || '').toLowerCase().includes(q)
      || note.toLowerCase().includes(q)
      || user.toLowerCase().includes(q)
  })

  const downloadMovementsCSV = () => {
    const headers = ['Date', 'Time', 'Type', 'Product', 'Category', 'Qty Delta', 'Before', 'After', 'User', 'Notes']
    const rows = filteredLogs.map(l => {
      const d = new Date(l.created_at)
      const { user, note } = parseLoggedNote(l.reference_id)
      return [
        d.toLocaleDateString('en-IN'), d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
        l.reason.replace('_', ' '), l.products?.name || '—', l.products?.category || '—',
        l.adjustment, l.old_quantity, l.new_quantity, user, note,
      ]
    })
    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n')
    const blob = new Blob(['﻿' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.setAttribute('download', `stock_movements_${new Date().toISOString().split('T')[0]}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="space-y-5">
      {/* Filter + Export bar */}
      <div className="flex flex-wrap items-center gap-2 bg-white p-3 rounded-2xl shadow-sm border border-[#FDDBB4]/60">
        {(['all', 'today', 'week', 'month', 'custom'] as DatePreset[]).map(p => (
          <button key={p} onClick={() => applyPreset(p)}
            className={`px-3.5 py-2 rounded-xl text-[11px] font-black uppercase tracking-wider transition-colors ${datePreset === p ? 'bg-[#141414] text-white' : 'bg-white border border-[#FDDBB4]/60 text-[#374151] hover:bg-[#FAFAFA]'}`}>
            {p === 'all' ? 'All Time' : p === 'today' ? 'Today' : p === 'week' ? 'This Week' : p === 'month' ? 'This Month' : 'Custom'}
          </button>
        ))}
        <button onClick={() => setRefreshTick(t => t + 1)} title="Refresh"
          className="shrink-0 flex h-10 w-10 items-center justify-center rounded-xl border border-[#FDDBB4]/60 text-[#374151] hover:bg-[#FAFAFA]">
          <RefreshCw size={15} />
        </button>
        <button onClick={downloadCSV} className="sm:ml-auto flex items-center gap-2 border border-emerald-300 text-emerald-700 bg-emerald-50 px-4 py-2 rounded-xl text-[12px] font-black hover:bg-emerald-100 transition-colors">
          <Download size={14} /> Export Snapshot CSV
        </button>
        <button onClick={downloadMovementsCSV} className="flex items-center gap-2 bg-[#141414] border border-[#E2503B] text-[#E2503B] px-4 py-2 rounded-xl text-[12px] font-black hover:bg-black transition-colors">
          <Download size={14} /> Export Movements CSV
        </button>
        {datePreset === 'custom' && (
          <div className="w-full flex flex-wrap gap-3 items-center pt-1">
            <div className="flex items-center gap-2">
              <label className="text-[10px] font-black uppercase text-[#6B7280]">From</label>
              <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
                className="border border-[#FDDBB4]/60 rounded-lg px-3 py-1.5 text-sm font-bold outline-none focus:border-[#D6402E]" />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-[10px] font-black uppercase text-[#6B7280]">To</label>
              <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
                className="border border-[#FDDBB4]/60 rounded-lg px-3 py-1.5 text-sm font-bold outline-none focus:border-[#D6402E]" />
            </div>
          </div>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Incoming Stock', value: `+${totalIncoming} Units`, Icon: PackagePlus, iconBg: 'bg-emerald-50', iconColor: 'text-emerald-600' },
          { label: 'Units Sold (POS)', value: `${totalSold} Units`, Icon: ShoppingCart, iconBg: 'bg-purple-50', iconColor: 'text-purple-600' },
          { label: 'Lost / Damaged', value: `${totalLost} Units`, Icon: AlertTriangle, iconBg: 'bg-red-50', iconColor: 'text-red-600' },
          { label: 'Net Stock Delta', value: `${netDelta >= 0 ? '+' : ''}${netDelta} Units`, Icon: TrendingUp, iconBg: 'bg-[#141414]', iconColor: 'text-[#E2503B]' },
        ].map(c => (
          <div key={c.label} className="flex items-center gap-2 sm:gap-3 bg-white rounded-2xl border border-[#FDDBB4]/60 p-3 sm:p-4 shadow-sm overflow-hidden">
            <span className={`shrink-0 flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-xl ${c.iconBg} ${c.iconColor}`}>
              <c.Icon size={16} className="sm:size-[18px]" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-[#9CA3AF] mb-0.5 truncate">{c.label}</p>
              <p className="text-[12px] sm:text-lg font-black text-[#111111] leading-tight break-words">{c.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Movement Audit Ledger */}
      <div className="bg-white rounded-2xl shadow-sm border border-[#FDDBB4]/60 overflow-hidden">
        <div className="px-5 py-4 border-b border-[#FDDBB4]/60 flex flex-wrap items-center justify-between gap-3">
          <h4 className="font-black text-sm uppercase tracking-wider text-[#374151]">Movement Audit Ledger ({filteredLogs.length})</h4>
          <div className="flex flex-wrap gap-2">
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
              <input type="text" value={ledgerSearch} onChange={e => setLedgerSearch(e.target.value)} placeholder="Search ledger..."
                className="pl-8 pr-3 py-2 bg-[#FAFAFA] border border-[#E5E7EB] rounded-xl text-[12px] font-bold outline-none focus:border-[#D6402E] w-[180px]" />
            </div>
            <div className="relative">
              <select value={ledgerTypeFilter} onChange={e => setLedgerTypeFilter(e.target.value as typeof ledgerTypeFilter)}
                className="appearance-none pl-3 pr-8 py-2 bg-[#FAFAFA] border border-[#E5E7EB] rounded-xl text-[12px] font-bold outline-none focus:border-[#D6402E]">
                <option value="all">All Types</option>
                <option value="restock">Restock</option>
                <option value="return">Return</option>
                <option value="loss">Loss</option>
                <option value="manual_adjustment">Manual Adjustment</option>
                <option value="sale">Sale</option>
              </select>
              <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#9CA3AF] pointer-events-none" />
            </div>
          </div>
        </div>
        {loadingLogs ? (
          <p className="text-center py-10 text-sm font-bold text-[#6B7280]">Loading...</p>
        ) : filteredLogs.length === 0 ? (
          <p className="text-center py-10 text-sm font-bold text-[#9CA3AF]">No stock movements match this filter.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[820px] w-full text-sm">
              <thead className="bg-[#F8F7F4] text-[10px] font-black uppercase tracking-wider text-[#737B72]">
                <tr>{['Date & Time', 'Type', 'Product', 'Category', 'Qty Delta', 'Before → After', 'User', 'Notes'].map(h => <th key={h} className="px-4 py-3 text-left whitespace-nowrap">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-[#F0EEE9]">
                {filteredLogs.map(log => {
                  const { user, note } = parseLoggedNote(log.reference_id)
                  return (
                    <tr key={log.id} className="hover:bg-orange-50/30">
                      <td className="px-4 py-3 text-[11px] text-[#6B7280] whitespace-nowrap">{new Date(log.created_at).toLocaleDateString('en-MY')} <span className="opacity-70">{new Date(log.created_at).toLocaleTimeString('en-MY',{hour:'2-digit',minute:'2-digit'})}</span></td>
                      <td className="px-4 py-3 whitespace-nowrap"><span className={`px-2 py-0.5 rounded-lg text-[10px] font-black uppercase ${REASON_COLORS[log.reason] || 'bg-gray-100 text-gray-600'}`}>{log.reason.replace('_',' ')}</span></td>
                      <td className="px-4 py-3 font-bold text-[#111111] whitespace-nowrap max-w-[200px] truncate">{log.products?.name || '—'}</td>
                      <td className="px-4 py-3 text-[#6B7280] text-xs whitespace-nowrap">{log.products?.category || '—'}</td>
                      <td className={`px-4 py-3 font-black whitespace-nowrap ${log.adjustment > 0 ? 'text-emerald-600' : 'text-red-600'}`}>{log.adjustment > 0 ? '+' : ''}{log.adjustment}</td>
                      <td className="px-4 py-3 font-bold text-[#374151] whitespace-nowrap">{log.old_quantity} → <span className="text-[#111111]">{log.new_quantity}</span></td>
                      <td className="px-4 py-3 text-xs font-bold text-[#374151] whitespace-nowrap">{user}</td>
                      <td className="px-4 py-3 text-xs text-[#9CA3AF] whitespace-nowrap max-w-[160px] truncate">{note || '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Static Analytics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-[#FDDBB4]/60 min-w-0">
          <h4 className="font-black text-sm uppercase tracking-wider text-[#374151] mb-4 flex items-center gap-2">
            <TrendingUp size={16} className="text-emerald-500" /> Highest Stock Value (Current)
          </h4>
          <div className="space-y-3">
            {products.filter(p => p.stock_quantity > 0)
              .sort((a, b) => (b.stock_quantity * b.price) - (a.stock_quantity * a.price))
              .slice(0, 5).map((p, i) => (
                <div key={p.id} className="flex justify-between items-start gap-2 p-3 rounded-xl bg-slate-50 border border-slate-100 min-w-0">
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <span className="shrink-0 w-6 h-6 flex items-center justify-center rounded-full bg-white font-black text-xs text-slate-400 shadow-sm">{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-sm text-slate-800 break-words">{p.name}</p>
                      <p className="text-[10px] text-slate-500 truncate">{p.stock_quantity} units • {formatCurrency(p.price)}/unit</p>
                    </div>
                  </div>
                  <p className="font-black text-emerald-600 shrink-0 ml-2 whitespace-nowrap">{formatCurrency(p.stock_quantity * p.price)}</p>
                </div>
            ))}
            {products.filter(p => p.stock_quantity > 0).length === 0 && <p className="text-sm text-slate-400 text-center py-4">No data.</p>}
          </div>
        </div>
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-[#FDDBB4]/60">
          <h4 className="font-black text-sm uppercase tracking-wider text-[#374151] mb-4 flex items-center gap-2">
            <PieChart size={16} className="text-purple-500" /> Stock by Category (Current)
          </h4>
          <div className="space-y-3">
            {Object.entries(products.reduce((acc, p) => {
              const cat = p.category || 'Uncategorised'
              acc[cat] = (acc[cat] || 0) + p.stock_quantity
              return acc
            }, {} as Record<string, number>)).sort((a, b) => b[1] - a[1]).map(([cat, qty], i) => (
              <div key={cat} className="flex justify-between items-center p-3 rounded-xl bg-slate-50 border border-slate-100">
                <div className="flex items-center gap-3">
                  <div className={`shrink-0 w-3 h-3 rounded-full ${['bg-orange-500','bg-emerald-500','bg-blue-500','bg-purple-500','bg-pink-500'][i%5]}`} />
                  <p className="font-bold text-sm text-slate-800">{cat}</p>
                </div>
                <p className="font-black text-slate-600 shrink-0"><span className="text-purple-600">{qty}</span> items</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Inventory() {
  const role = useAdminAuthStore(state => state.role)
  const [activeTab, setActiveTab] = useState<'stock' | 'products' | 'categories' | 'analytics'>('stock')

  // Stock state
  const [products, setProducts] = useState<InventoryProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'ok' | 'low' | 'out'>('all')
  const [adjustModal, setAdjustModal] = useState<AdjustModal | null>(null)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState('')
  const [ackedLowStockIds, setAckedLowStockIds] = useState<Set<string | number>>(new Set())
  const [historyModal, setHistoryModal] = useState<InventoryProduct | null>(null)
  const [historyLogs, setHistoryLogs] = useState<InventoryLog[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  useBodyScrollLock(!!adjustModal || !!historyModal)

  // Product form state
  const [productForm, setProductForm] = useState<ProductForm>(EMPTY_FORM)
  const [editingProduct, setEditingProduct] = useState<InventoryProduct | null>(null)
  const [savingProduct, setSavingProduct] = useState(false)
  const [productNotice, setProductNotice] = useState('')

  // Category state
  const [categories, setCategories] = useState<Category[]>([])
  const [newCatName, setNewCatName] = useState('')
  const [editingCat, setEditingCat] = useState<Category | null>(null)
  const [editingCatName, setEditingCatName] = useState('')
  const [savingCat, setSavingCat] = useState(false)
  const [catNotice, setCatNotice] = useState('')

  const downloadCSV = () => {
    const headers = ['ID', 'Product Name', 'Category', 'Stock Quantity', 'Low Stock Alert', 'Price (Rs.)', 'Purchase Price (Rs.)', 'Status', 'Last Updated Date', 'Last Updated Time']
    const rows = activeProducts.map(p => {
      const status = p.stock_quantity <= 0 ? 'Out of Stock' : p.stock_quantity <= p.low_stock_alert ? 'Low Stock' : 'In Stock'
      const updated = new Date(p.updated_at)
      const updatedDate = updated.toLocaleDateString('en-IN')
      const updatedTime = updated.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
      return [
        p.id,
        p.name,
        p.category || '',
        p.stock_quantity,
        p.low_stock_alert,
        p.price,
        p.purchase_price || 0,
        status,
        updatedDate,
        updatedTime,
      ]
    })

    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n')
    const blob = new Blob(['﻿' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.setAttribute('download', `inventory_report_${new Date().toISOString().split('T')[0]}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const fetchProducts = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('products')
      .select('id, name, category, stock_quantity, low_stock_alert, price, purchase_price, is_active, updated_at, image_url, item_type, description')
      .order('name')
    if (!error && data) setProducts(data as InventoryProduct[])
    setLoading(false)
  }, [])

  const fetchCategories = useCallback(async () => {
    const { data } = await supabase.from('categories').select('*').order('sort_order').order('name_en')
    if (data) setCategories(data as Category[])
  }, [])

  useEffect(() => {
    void fetchProducts()
    void fetchCategories()
  }, [fetchProducts, fetchCategories])

  // Low-stock alarm items — snapshotted once when this tab first finishes
  // loading (the component fully unmounts when switching away, so re-opening
  // the tab re-snapshots). Deliberately does NOT recompute from later
  // fetchProducts() refreshes (after an adjustment, manual refresh, etc.) so
  // the alarm only sounds on tab-entry, never mid-visit from routine actions.
  const [alarmSnapshot, setAlarmSnapshot] = useState<InventoryProduct[] | null>(null)
  useEffect(() => {
    if (!loading && alarmSnapshot === null) setAlarmSnapshot(products)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading])

  const lowStockAlarmItems = (alarmSnapshot ?? [])
    .filter(p => p.is_active !== false && getStatus(p) !== 'ok')
    .map(p => ({ id: p.id, name: p.name, category: p.category, stock: p.stock_quantity, alertLimit: p.low_stock_alert || 5 }))
  const unackedLowStockItems = lowStockAlarmItems.filter(i => !ackedLowStockIds.has(i.id))

  const acknowledgeLowStockAlarm = () => {
    setAckedLowStockIds(prev => new Set([...prev, ...lowStockAlarmItems.map(i => i.id)]))
  }

  // ── Stock Management ──────────────────────────────────────────────
  // Retired/hidden products (is_active = false) stay manageable from the
  // Add/Edit Products tab (which already shows a "Hidden" badge for them),
  // but they don't belong in the live stock view — otherwise every retired
  // duplicate shows up here looking identical to a real, sellable product.
  const activeProducts = products.filter(p => p.is_active !== false)

  const filtered = activeProducts.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase())
    const status = getStatus(p)
    if (filter === 'ok') return matchSearch && status === 'ok'
    if (filter === 'low') return matchSearch && status === 'low'
    if (filter === 'out') return matchSearch && status === 'out'
    return matchSearch
  })

  const lowCount = activeProducts.filter(p => getStatus(p) === 'low').length
  const outCount = activeProducts.filter(p => getStatus(p) === 'out').length
  const inStockCount = activeProducts.length - lowCount - outCount
  const stockValue = activeProducts.reduce((s, p) => s + (p.stock_quantity * p.price), 0)

  const openAdjust = (product: InventoryProduct) => {
    setAdjustModal({ product, qty: '1', adjustType: 'restock', note: '' })
  }

  const bumpAdjustQty = (delta: number) => {
    setAdjustModal(m => {
      if (!m) return m
      const current = parseFloat(m.qty) || 0
      return { ...m, qty: String(Math.max(0, current + delta)) }
    })
  }

  const openHistory = async (product: InventoryProduct) => {
    setHistoryModal(product)
    setHistoryLoading(true)
    const { data } = await supabase
      .from('inventory_logs')
      .select('*, products(name, category)')
      .eq('product_id', product.id)
      .order('created_at', { ascending: false })
      .limit(50)
    setHistoryLogs((data as InventoryLog[]) || [])
    setHistoryLoading(false)
  }

  const saveAdjust = async () => {
    if (!adjustModal) return
    const { product, qty, adjustType, note } = adjustModal
    const enteredQty = parseFloat(qty)
    if (isNaN(enteredQty) || enteredQty < 0) { setNotice('Please enter a valid quantity.'); return }
    let newQtyNum: number
    let adjustment: number
    if (adjustType === 'reconciliation') {
      newQtyNum = enteredQty
      adjustment = newQtyNum - product.stock_quantity
      if (adjustment === 0) { setNotice('New count matches the current stock — nothing to reconcile.'); return }
    } else {
      if (enteredQty <= 0) { setNotice('Please enter a valid quantity.'); return }
      const isAddition = adjustType === 'restock' || adjustType === 'return'
      adjustment = isAddition ? enteredQty : -enteredQty
      newQtyNum = product.stock_quantity + adjustment
      if (newQtyNum < 0) { setNotice('Cannot remove more than the current stock.'); return }
    }
    setSaving(true)
    try {
      const { error: updateErr } = await supabase
        .from('products')
        .update({ stock_quantity: newQtyNum, updated_at: new Date().toISOString() })
        .eq('id', product.id)
      if (updateErr) throw updateErr

      // 'reconciliation' isn't a DB-recognized reason yet (inventory_logs
      // check constraint only allows sale/restock/return/manual_adjustment/loss),
      // so it's logged as a manual adjustment until that constraint is widened.
      await supabase.from('inventory_logs').insert({
        product_id: product.id,
        old_quantity: product.stock_quantity,
        new_quantity: newQtyNum,
        adjustment,
        reason: adjustType === 'reconciliation' ? 'manual_adjustment' : adjustType,
        reference_id: tagNoteWithUser(role, note),
      }).then(() => {})

      setAdjustModal(null)
      void fetchProducts()
    } catch (err: unknown) {
      setNotice(err instanceof Error ? err.message : 'Failed to update stock')
    } finally {
      setSaving(false)
    }
  }

  // ── Product Management ──────────────────────────────────────────────
  const startEditProduct = (p: InventoryProduct) => {
    setEditingProduct(p)
    setProductForm({
      name: p.name,
      category: p.category || '',
      price: String(p.price),
      purchase_price: String(p.purchase_price || ''),
      stock_quantity: String(p.stock_quantity),
      low_stock_alert: String(p.low_stock_alert || 5),
      is_active: p.is_active,
      item_type: p.item_type === 'service' ? 'service' : 'product',
      description: p.description || '',
    })
    setProductNotice('')
    setActiveTab('products')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const resetProductForm = () => {
    setEditingProduct(null)
    setProductForm(EMPTY_FORM)
    setProductNotice('')
  }

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!productForm.name.trim() || !productForm.price) {
      setProductNotice('Product name and price are required.')
      return
    }
    setSavingProduct(true)
    setProductNotice('')
    try {
      const selectedCategory = categories.find(c => c.name_en.trim().toLowerCase() === productForm.category.trim().toLowerCase())
      const payload = {
        name: productForm.name.trim(),
        category: productForm.category.trim() || null,
        category_id: selectedCategory ? selectedCategory.id : null,
        price: parseFloat(productForm.price) || 0,
        purchase_price: productForm.purchase_price ? parseFloat(productForm.purchase_price) : 0,
        stock_quantity: parseFloat(productForm.stock_quantity) || 0,
        low_stock_alert: parseInt(productForm.low_stock_alert) || 5,
        is_active: productForm.is_active,
        item_type: productForm.item_type,
        description: productForm.description.trim(),
        updated_at: new Date().toISOString(),
      }
      if (editingProduct) {
        const { error } = await supabase.from('products').update(payload).eq('id', editingProduct.id)
        if (error) throw error
        setProductNotice('Product updated successfully!')
      } else {
        const { error } = await supabase.from('products').insert(payload)
        if (error) throw error
        setProductNotice('Product added successfully!')
        setProductForm(EMPTY_FORM)
      }
      void fetchProducts()
    } catch (err) {
      console.error('Save product error:', err)
      const message = err instanceof Error ? err.message : JSON.stringify(err)
      const code = (err && typeof err === 'object' && 'code' in err) ? (err as { code?: string }).code : undefined
      const isDuplicate = code === '23505' || message.includes('products_category_name_unique')
      setProductNotice(
        isDuplicate
          ? `A product named "${productForm.name.trim()}" already exists in the "${productForm.category || 'selected'}" category. Use a different name, or edit that existing product instead.`
          : `Failed to save: ${message}`
      )
    } finally {
      setSavingProduct(false)
    }
  }

  const handleDeleteProduct = async (p: InventoryProduct) => {
    if (!confirm(`Delete "${p.name}"? This cannot be undone.`)) return
    await supabase.from('products').delete().eq('id', p.id)
    void fetchProducts()
    if (editingProduct?.id === p.id) resetProductForm()
  }

  // ── Category Management ──────────────────────────────────────────────
  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newCatName.trim()) return
    setSavingCat(true)
    try {
      const maxOrder = categories.reduce((m, c) => Math.max(m, c.sort_order || 0), 0)
      await supabase.from('categories').insert({ name_en: newCatName.trim(), name_ta: '', is_active: true, sort_order: maxOrder + 1 })
      setNewCatName('')
      setCatNotice('Category added!')
      void fetchCategories()
    } catch (err: unknown) {
      setCatNotice(err instanceof Error ? err.message : 'Failed to add category')
    } finally {
      setSavingCat(false)
      setTimeout(() => setCatNotice(''), 3000)
    }
  }

  const handleSaveEditCat = async (cat: Category) => {
    if (!editingCatName.trim()) return
    await supabase.from('categories').update({ name_en: editingCatName.trim() }).eq('id', cat.id)
    setEditingCat(null)
    void fetchCategories()
  }

  const handleDeleteCat = async (cat: Category) => {
    if (!confirm(`Delete category "${cat.name_en}"?`)) return
    await supabase.from('categories').delete().eq('id', cat.id)
    void fetchCategories()
  }

  const handleToggleCat = async (cat: Category) => {
    await supabase.from('categories').update({ is_active: !cat.is_active }).eq('id', cat.id)
    void fetchCategories()
  }

  return (
    <div className="p-3 sm:p-6 space-y-3 sm:space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-base sm:text-xl md:text-2xl font-black text-[#111111] flex items-center gap-1.5">
          <Package size={16} className="sm:size-6 shrink-0 text-[#D6402E]" /> Inventory & Products
        </h1>
        <button onClick={() => { void fetchProducts(); void fetchCategories() }} className="flex items-center gap-1.5 bg-white border border-[#FDDBB4]/60 px-3 h-8 rounded-lg text-[12px] sm:text-sm font-bold text-[#374151] hover:bg-orange-50">
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      {unackedLowStockItems.length > 0 && (
        <LowStockAlarmModal items={unackedLowStockItems} onAcknowledge={acknowledgeLowStockAlarm} />
      )}

      {/* Tabs */}
      <div className="flex items-center gap-1.5 sm:gap-2 bg-white rounded-2xl border border-[#FDDBB4]/60 shadow-sm p-1.5 sm:p-2 overflow-x-auto hide-scrollbar">
        {([
          ['stock', 'Stock Management', Package],
          ['products', 'Add / Edit Products', Boxes],
          ['categories', 'Categories', Tag],
          ['analytics', 'Analytics & Reports', BarChart3],
        ] as const).map(([key, label, Icon]) => (
          <button key={key} onClick={() => setActiveTab(key)}
            className={`shrink-0 flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 h-10 rounded-xl font-bold text-[13px] sm:text-sm transition-colors whitespace-nowrap ${activeTab === key ? 'bg-[#141414] text-[#E2503B]' : 'text-[#374151] hover:bg-[#FAFAFA]'}`}>
            <Icon size={15} className="shrink-0" /> {label}
          </button>
        ))}
      </div>

      {/* ── STOCK MANAGEMENT TAB ── */}
      {activeTab === 'stock' && (
        <div className="space-y-5">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: 'Total SKUs', value: activeProducts.length, iconBg: 'bg-[#141414]', iconColor: 'text-[#E2503B]', Icon: Layers },
              { label: 'Total Stock', value: `${activeProducts.reduce((s, p) => s + p.stock_quantity, 0)} Units`, iconBg: 'bg-emerald-50', iconColor: 'text-emerald-600', Icon: Package },
              { label: 'Low Stock Items', value: lowCount + outCount, iconBg: 'bg-amber-50', iconColor: 'text-amber-600', Icon: AlertTriangle },
              { label: 'Stock Valuation', value: formatCurrency(stockValue), iconBg: 'bg-[#FFF8F2]', iconColor: 'text-[#D6402E]', Icon: IndianRupee },
            ].map((card, i) => (
              <div key={i} className="flex items-center gap-2 sm:gap-3 rounded-2xl border border-[#FDDBB4]/60 bg-white p-3 sm:p-4 shadow-sm overflow-hidden">
                <span className={`shrink-0 flex h-9 w-9 sm:h-11 sm:w-11 items-center justify-center rounded-xl ${card.iconBg} ${card.iconColor}`}>
                  <card.Icon size={16} className="sm:size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] sm:text-[11px] font-bold text-[#6B7280] mb-0.5 truncate">{card.label}</p>
                  <p className="text-[13px] sm:text-xl font-black text-[#111111] leading-tight break-words">{card.value}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Filters */}
          <div className="space-y-3 bg-white rounded-2xl border border-[#FDDBB4]/60 shadow-sm p-3">
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
              <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search SKU name, category..."
                className="w-full pl-9 pr-4 py-2.5 bg-[#FAFAFA] border border-[#FDDBB4]/40 rounded-xl text-sm font-bold outline-none focus:border-[#D6402E]" />
            </div>
            <div className="flex flex-nowrap items-stretch gap-1.5 sm:gap-2.5">
              {([
                ['all', `All (${activeProducts.length})`],
                ['ok', `In Stock (${inStockCount})`],
                ['low', `Low Stock (${lowCount})`],
                ['out', `Out of Stock (${outCount})`],
              ] as const).map(([f, label]) => (
                <button key={f} onClick={() => setFilter(f)}
                  className={`flex-1 min-w-0 sm:flex-none sm:min-w-[120px] px-1.5 py-1.5 sm:px-5 sm:py-3 rounded-xl border text-[10.5px] sm:text-[13px] leading-tight font-black text-center transition-colors ${
                    filter === f
                      ? f === 'out' ? 'bg-red-600 border-red-600 text-white' : f === 'low' ? 'bg-amber-500 border-amber-500 text-white' : f === 'ok' ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-[#141414] border-[#141414] text-white'
                      : f === 'out' ? 'bg-red-50 border-red-200 text-red-600 hover:bg-red-100' : f === 'low' ? 'bg-amber-50 border-amber-300 text-amber-700 hover:bg-amber-100' : f === 'ok' ? 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100' : 'bg-white border-[#FDDBB4]/60 text-[#374151] hover:bg-[#FAFAFA]'
                  }`}>
                  {label}
                </button>
              ))}
              <button onClick={() => { void fetchProducts(); void fetchCategories() }}
                title="Refresh"
                className="shrink-0 flex h-auto w-9 sm:w-12 items-center justify-center rounded-xl border border-[#FDDBB4]/60 text-[#374151] hover:bg-[#FAFAFA]">
                <RefreshCw size={15} className="sm:size-[18px]" />
              </button>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-[#FDDBB4]/60 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-[720px] w-full text-left">
                <thead className="bg-[#FAFAFA] border-b border-[#FDDBB4]/60">
                  <tr>
                    {['Product', 'Category', 'Stock Level', 'Alert At', 'Selling Price', 'Actions'].map(h => (
                      <th key={h} className="px-4 py-3 text-[11px] font-black uppercase tracking-wider text-[#374151] whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={6} className="text-center py-12 text-[#6B7280] font-bold">Loading inventory...</td></tr>
                  ) : filtered.length === 0 ? (
                    <tr><td colSpan={6} className="text-center py-12 text-[#6B7280] font-bold">No products found.</td></tr>
                  ) : filtered.map(p => {
                    const status = getStatus(p)
                    const pillClass = status === 'out' ? 'bg-red-50 text-red-700 border-red-200' : status === 'low' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    return (
                      <tr key={String(p.id)} className="border-b border-[#FDDBB4]/20 hover:bg-[#FAFAFA]">
                        <td className="px-4 py-3 font-bold text-[#111111] text-sm whitespace-nowrap max-w-[220px] truncate">{p.name}</td>
                        <td className="px-4 py-3 text-sm text-[#374151] whitespace-nowrap">{p.category || '—'}</td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1 whitespace-nowrap px-2.5 py-1 rounded-full text-[11px] font-black border ${pillClass}`}>
                            {status === 'low' && <AlertTriangle size={10} />}
                            {p.stock_quantity} Units
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-[#374151] font-semibold whitespace-nowrap">{p.low_stock_alert || 5}</td>
                        <td className="px-4 py-3 text-sm font-black text-[#111111] whitespace-nowrap">
                          <span className="inline-flex items-center gap-1.5">
                            {formatCurrency(p.price)}
                            <button onClick={() => startEditProduct(p)} title="Edit product" className="text-[#9CA3AF] hover:text-[#D6402E]">
                              <Edit2 size={12} />
                            </button>
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <button onClick={() => openAdjust(p)}
                              className="flex items-center gap-1.5 bg-white text-[#374151] border border-gray-200 px-2.5 py-1.5 rounded-lg text-[11px] font-black hover:bg-gray-50">
                              <SlidersHorizontal size={12} /> Adjust
                            </button>
                            <button onClick={() => void openHistory(p)} title="Stock history"
                              className="p-1.5 bg-white text-gray-500 hover:text-[#D6402E] rounded-full border border-gray-200 hover:border-[#FDDBB4]">
                              <History size={13} />
                            </button>
                            <button onClick={() => void handleDeleteProduct(p)} title="Delete product"
                              className="p-1.5 bg-white text-red-400 hover:text-red-600 rounded-full border border-gray-200 hover:border-red-200">
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── ADD / EDIT PRODUCTS TAB ── */}
      {activeTab === 'products' && (
        <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
          {/* Form */}
          <div className="xl:col-span-2">
            <form onSubmit={handleSaveProduct} className="bg-white rounded-2xl border border-[#FDDBB4]/60 shadow-sm p-6 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <span className="shrink-0 flex h-9 w-9 items-center justify-center rounded-xl bg-[#FFF8F2] text-[#D6402E]">
                    <Boxes size={17} />
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-base font-black text-[#111111]">{editingProduct ? 'Edit Product' : 'Add New Product to Catalog'}</h3>
                    <p className="text-[11px] text-[#9CA3AF] font-semibold">Set pricing, stock and category for this item.</p>
                  </div>
                </div>
                {editingProduct && (
                  <button type="button" onClick={resetProductForm} className="shrink-0 text-[11px] text-[#6B7280] hover:text-[#111111] font-bold whitespace-nowrap">
                    + New Product
                  </button>
                )}
              </div>

              {productNotice && (
                <div className={`p-3 rounded-xl text-sm font-bold text-center ${productNotice.includes('success') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                  {productNotice}
                </div>
              )}

              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-[#374151] mb-1.5">Product Name *</label>
                <input type="text" required value={productForm.name} onChange={e => setProductForm(f => ({...f, name: e.target.value}))}
                  className="w-full border border-[#FDDBB4]/60 p-2.5 rounded-xl text-sm font-bold outline-none focus:border-[#D6402E]"
                  placeholder="e.g. Chicken 65 with Ghee Rice" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-[#374151] mb-1.5">Category</label>
                  <select value={productForm.category} onChange={e => setProductForm(f => ({...f, category: e.target.value}))}
                    className="w-full border border-[#FDDBB4]/60 p-2.5 rounded-xl text-[12px] sm:text-sm font-bold outline-none focus:border-[#D6402E] bg-white">
                    <option value="">Select Category</option>
                    {categories.filter(c => c.is_active).map(c => (
                      <option key={String(c.id)} value={c.name_en}>{c.name_en}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-[#374151] mb-1.5">Low Stock Alert</label>
                  <input type="number" min="0" value={productForm.low_stock_alert} onChange={e => setProductForm(f => ({...f, low_stock_alert: e.target.value}))}
                    className="w-full border border-[#FDDBB4]/60 p-2.5 rounded-xl text-sm font-bold outline-none focus:border-[#D6402E]" />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-[#374151] mb-1.5">Selling Price (₹) *</label>
                  <input type="number" required step="0.01" min="0" value={productForm.price} onChange={e => setProductForm(f => ({...f, price: e.target.value}))}
                    className="w-full border border-[#FDDBB4]/60 p-2.5 rounded-xl text-sm font-bold outline-none focus:border-[#D6402E]"
                    placeholder="0.00" />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-[#374151] mb-1.5">Cost Price (₹)</label>
                  <input type="number" step="0.01" min="0" value={productForm.purchase_price} onChange={e => setProductForm(f => ({...f, purchase_price: e.target.value}))}
                    className="w-full border border-[#FDDBB4]/60 p-2.5 rounded-xl text-sm font-bold outline-none focus:border-[#D6402E]"
                    placeholder="0.00" />
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <label className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-emerald-700 mb-1.5">
                    <PackagePlus size={11} /> Current Stock
                  </label>
                  <input type="number" min="0" value={productForm.stock_quantity} onChange={e => setProductForm(f => ({...f, stock_quantity: e.target.value}))}
                    className="w-full border border-emerald-300 bg-emerald-50/50 p-2.5 rounded-xl text-sm font-bold outline-none focus:border-emerald-500" />
                </div>
              </div>
              <p className="text-[10px] text-[#9CA3AF] -mt-2">Cost price is for your records only — not used in billing.</p>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-[#374151] mb-1.5">Description / Notes (Optional)</label>
                <textarea value={productForm.description} onChange={e => setProductForm(f => ({...f, description: e.target.value}))}
                  rows={2}
                  className="w-full border border-[#FDDBB4]/60 p-2.5 rounded-xl text-sm font-bold outline-none focus:border-[#D6402E] resize-none"
                  placeholder="Product material, care instructions, or rack location notes..." />
              </div>

              {/* Item Type Toggle */}
              <div className="space-y-2">
                <label className="text-[11px] font-black uppercase tracking-wider text-[#6B7280]">Type</label>
                <div className="flex gap-2">
                  <button type="button"
                    onClick={() => setProductForm(f => ({ ...f, item_type: 'product' }))}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-bold border transition-all ${productForm.item_type === 'product' ? 'bg-blue-500 text-white border-blue-500' : 'bg-white text-[#374151] border-[#FDDBB4]/60 hover:border-blue-300'}`}>
                    📦 Product
                  </button>
                  <button type="button"
                    onClick={() => setProductForm(f => ({ ...f, item_type: 'service' }))}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-bold border transition-all ${productForm.item_type === 'service' ? 'bg-purple-500 text-white border-purple-500' : 'bg-white text-[#374151] border-[#FDDBB4]/60 hover:border-purple-300'}`}>
                    ✂️ Service
                  </button>
                </div>
                <p className="text-[10px] text-[#9CA3AF]">Products = physical items sold. Services = delivery, packing, add-ons.</p>
              </div>

              <div className="flex items-center gap-3 p-3 bg-[#FAFAFA] rounded-xl border border-[#FDDBB4]/60">
                <label className="flex items-center gap-2 cursor-pointer select-none text-sm font-bold text-[#374151]">
                  <input type="checkbox" checked={productForm.is_active} onChange={e => setProductForm(f => ({...f, is_active: e.target.checked}))}
                    className="w-4 h-4 accent-[#D6402E]" />
                  Active (visible in Billing Panel)
                </label>
              </div>

              <div className="flex gap-3">
                <button type="submit" disabled={savingProduct}
                  className="flex-1 flex items-center justify-center gap-2 bg-[#141414] border border-[#E2503B] text-[#E2503B] p-3 rounded-xl font-bold text-sm hover:bg-black disabled:opacity-50">
                  <CheckCircle2 size={15} />
                  {savingProduct ? 'Saving...' : editingProduct ? 'Save Changes' : 'Save & Add Product'}
                </button>
                {editingProduct && (
                  <button type="button" onClick={() => void handleDeleteProduct(editingProduct)}
                    className="px-4 py-3 bg-red-50 text-red-600 border border-red-200 rounded-xl font-bold text-sm hover:bg-red-100">
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            </form>
          </div>

          {/* Product List (right side) */}
          <div className="xl:col-span-3">
            <div className="bg-white rounded-2xl border border-[#FDDBB4]/60 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-[#FDDBB4]/60 bg-[#FAFAFA] flex items-center justify-between gap-3">
                <p className="text-[11px] font-black uppercase tracking-wider text-[#374151] whitespace-nowrap">Product Catalog ({products.length})</p>
                <div className="relative flex-1 max-w-[240px]">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
                  <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search products..."
                    className="w-full pl-8 pr-4 py-2 bg-white border border-[#FDDBB4]/60 rounded-xl text-sm font-bold outline-none focus:border-[#D6402E]" />
                </div>
              </div>
              <div className="overflow-y-auto hide-scrollbar max-h-[600px] divide-y divide-[#FDDBB4]/30">
                {products.filter(p => p.name.toLowerCase().includes(search.toLowerCase())).map(p => (
                  <div key={String(p.id)} className={`flex items-center justify-between gap-2 px-4 py-3 hover:bg-[#FAFAFA] ${editingProduct?.id === p.id ? 'bg-orange-50 border-l-4 border-[#D6402E]' : ''}`}>
                    <div className="min-w-0">
                      <p className="font-bold text-sm text-[#111111] break-words">{p.name}</p>
                      <p className="text-[11px] text-[#6B7280]">{p.category || 'No category'}</p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0 ml-2">
                      <div className="text-right">
                        <p className="font-black text-sm text-[#111111]">{formatCurrency(p.price)}</p>
                        <p className={`text-[11px] font-bold ${getStatus(p) === 'out' ? 'text-red-600' : getStatus(p) === 'low' ? 'text-orange-600' : 'text-green-600'}`}>Stock: {p.stock_quantity}</p>
                      </div>
                      {!p.is_active && <span className="text-[10px] font-black uppercase text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">Hidden</span>}
                      <button onClick={() => startEditProduct(p)} className="p-1.5 text-[#374151] hover:text-[#D6402E] hover:bg-[#FFF8F2] rounded-lg border border-transparent hover:border-[#FDDBB4]">
                        <Edit2 size={14} />
                      </button>
                      <button onClick={() => void handleDeleteProduct(p)} className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── CATEGORIES TAB ── */}
      {activeTab === 'categories' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Add Category */}
          <div className="bg-white rounded-2xl shadow-sm border border-[#FDDBB4]/60 p-5">
            <h3 className="text-base font-black text-[#111111] mb-4 flex items-center gap-2"><Plus size={16} className="text-[#D6402E]" /> Add Category</h3>
            <form onSubmit={handleAddCategory} className="flex gap-2">
              <input type="text" value={newCatName} onChange={e => setNewCatName(e.target.value)} placeholder="e.g. Fried Rice, Combos"
                className="flex-1 border border-[#FDDBB4]/60 p-2.5 rounded-xl text-sm font-bold outline-none focus:border-[#D6402E]" required />
              <button type="submit" disabled={savingCat}
                className="bg-[#D6402E] text-white px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-[#141414] disabled:opacity-50">
                Add
              </button>
            </form>
            {catNotice && <p className="mt-2 text-sm font-bold text-green-600">{catNotice}</p>}
          </div>

          {/* Category List */}
          <div className="bg-white rounded-2xl shadow-sm border border-[#FDDBB4]/60 overflow-hidden">
            <div className="px-4 py-3 bg-[#FAFAFA] border-b border-[#FDDBB4]/60">
              <h3 className="text-[11px] font-black uppercase tracking-wider text-[#374151]">All Categories ({categories.length})</h3>
            </div>
            {categories.length === 0 ? (
              <p className="text-center p-6 text-[#6B7280] text-sm font-bold">No categories yet.</p>
            ) : (
              <div className="divide-y divide-[#FDDBB4]/30">
                {categories.map(cat => (
                  <div key={String(cat.id)} className="flex items-center justify-between px-4 py-3">
                    {editingCat?.id === cat.id ? (
                      <div className="flex items-center gap-2 flex-1 mr-2">
                        <input value={editingCatName} onChange={e => setEditingCatName(e.target.value)} autoFocus
                          className="min-w-0 flex-1 border border-[#FDDBB4]/60 p-1.5 rounded-lg text-sm font-bold outline-none focus:border-[#D6402E]" />
                        <button onClick={() => void handleSaveEditCat(cat)} className="shrink-0 text-[11px] font-black text-white bg-[#D6402E] px-2.5 py-1.5 rounded-lg">Save</button>
                        <button onClick={() => setEditingCat(null)} className="text-[11px] font-black text-[#6B7280] px-2 py-1.5 rounded-lg hover:bg-gray-100">✕</button>
                      </div>
                    ) : (
                      <div>
                        <p className="font-bold text-sm text-[#111111]">{cat.name_en}</p>
                        <span className={`text-[10px] font-black uppercase tracking-wider ${cat.is_active ? 'text-green-600' : 'text-gray-400'}`}>
                          {cat.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    )}
                    {editingCat?.id !== cat.id && (
                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={() => { setEditingCat(cat); setEditingCatName(cat.name_en) }} className="p-1.5 text-[#374151] hover:text-[#D6402E] hover:bg-[#FFF8F2] rounded-lg">
                          <Edit2 size={13} />
                        </button>
                        <button onClick={() => void handleToggleCat(cat)} className={`px-2.5 py-1 text-[10px] font-black uppercase tracking-wider rounded-lg border ${cat.is_active ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-50 text-gray-500 border-gray-200'}`}>
                          {cat.is_active ? 'Active' : 'Inactive'}
                        </button>
                        <button onClick={() => void handleDeleteCat(cat)} className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 📊 ANALYTICS & REPORTS TAB 📊 */}
      {activeTab === 'analytics' && <InventoryAnalytics products={activeProducts} downloadCSV={downloadCSV} />}

      {/* ── Adjust Stock Modal ── */}
      {adjustModal && (() => {
        const meta = ADJUST_TYPE_META[adjustModal.adjustType]
        const entered = parseFloat(adjustModal.qty)
        const hasEntry = adjustModal.qty !== '' && !isNaN(entered)
        const newTotal = hasEntry
          ? (adjustModal.adjustType === 'reconciliation' ? entered : adjustModal.product.stock_quantity + (meta.isAddition ? entered : -entered))
          : adjustModal.product.stock_quantity
        const change = newTotal - adjustModal.product.stock_quantity
        const exceedsStock = hasEntry && newTotal < 0
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
            <div className="bg-white rounded-2xl w-full max-w-lg max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
              {/* Header */}
              <div className="flex shrink-0 items-center justify-between gap-2.5 bg-[#141414] px-4 py-3.5">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="shrink-0 flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-[#E2503B]">
                    <SlidersHorizontal size={16} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-white font-black text-[12.5px] sm:text-[14px] leading-tight">Adjust Inventory Stock ({BRAND_EN})</p>
                    <p className="text-[#E2503B] text-[10.5px] sm:text-[11px] font-semibold leading-tight mt-0.5">Restock, remove stock, or reconcile physical count</p>
                  </div>
                </div>
                <button onClick={() => setAdjustModal(null)} className="shrink-0 flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20">
                  <X size={15} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto hide-scrollbar p-3 space-y-2.5">
                {/* Product box */}
                <div className="rounded-xl border border-[#FDDBB4] bg-[#FFF8F2] p-2.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="flex items-center gap-1.5 text-[9.5px] font-black uppercase tracking-wider text-[#D6402E]">
                        <Package size={11} /> Product
                      </p>
                      <p className="mt-0.5 font-black text-[13px] sm:text-[14px] text-[#111111] break-words">{adjustModal.product.name}</p>
                      <span className="mt-1 inline-block px-2 py-0.5 rounded-md bg-[#FDDBB4]/50 text-[#7A5F17] text-[10.5px] font-bold">
                        {adjustModal.product.category || 'Uncategorised'}
                      </span>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-[9.5px] font-black uppercase tracking-wider text-[#9CA3AF]">Current Stock</p>
                      <p className={`text-lg sm:text-2xl font-black leading-tight ${getStatus(adjustModal.product) === 'out' ? 'text-red-600' : getStatus(adjustModal.product) === 'low' ? 'text-orange-600' : 'text-[#111111]'}`}>
                        {adjustModal.product.stock_quantity} <span className="text-[11px] font-bold text-[#9CA3AF]">units</span>
                      </p>
                    </div>
                  </div>
                </div>

                {/* Adjustment type selector */}
                <div>
                  <label className="block text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-[#374151] mb-1.5">Select Adjustment Type *</label>
                  <div className="grid grid-cols-4 gap-1.5">
                    {(Object.keys(ADJUST_TYPE_META) as AdjustModal['adjustType'][]).map(type => {
                      const m = ADJUST_TYPE_META[type]
                      const selected = adjustModal.adjustType === type
                      return (
                        <button key={type} type="button"
                          onClick={() => setAdjustModal(prev => prev ? { ...prev, adjustType: type, qty: '1' } : prev)}
                          className={`flex flex-col items-center gap-0.5 rounded-lg border-2 px-1 py-1.5 text-center transition-colors ${selected ? `${m.border} ${m.bg}` : 'border-[#E5E7EB] bg-white hover:border-[#D1D5DB]'}`}>
                          <span className={`flex h-6 w-6 items-center justify-center rounded-full ${selected ? m.iconOn : m.iconOff}`}>
                            <m.Icon size={11} />
                          </span>
                          <span className="text-[9.5px] font-black text-[#111111] leading-tight">{m.label}</span>
                          <span className="text-[8.5px] font-bold text-[#9CA3AF] leading-tight">{m.sublabel}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Quantity input */}
                <div className={`rounded-xl border ${meta.panelBorder} ${meta.panelBg} p-2.5`}>
                  <label className="block text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-[#374151] mb-1.5">
                    {adjustModal.adjustType === 'reconciliation' ? 'New Exact Stock Count *' : `Quantity to ${meta.isAddition ? 'Add' : 'Deduct'} (${meta.label}) *`}
                  </label>
                  {adjustModal.adjustType === 'reconciliation' ? (
                    <input type="number" min="0" autoFocus value={adjustModal.qty} onChange={e => setAdjustModal(m => m ? { ...m, qty: e.target.value } : m)}
                      placeholder={`Current: ${adjustModal.product.stock_quantity}`}
                      className="w-full h-10 px-4 bg-white border border-[#FDDBB4]/60 rounded-xl text-center text-lg font-black text-[#111111] outline-none focus:border-[#D6402E]" />
                  ) : (
                    <>
                      <div className="flex items-center gap-2">
                        <button type="button" onClick={() => bumpAdjustQty(-1)}
                          className="shrink-0 flex h-10 w-10 items-center justify-center rounded-xl border border-[#E5E7EB] bg-white text-[#374151] hover:bg-[#F9FAFB]">
                          <Minus size={15} />
                        </button>
                        <input type="number" min="0" value={adjustModal.qty} onChange={e => setAdjustModal(m => m ? { ...m, qty: e.target.value } : m)}
                          className={`min-w-0 flex-1 h-10 px-4 bg-white border-2 ${meta.border} rounded-xl text-center text-lg font-black text-[#111111] outline-none`} />
                        <button type="button" onClick={() => bumpAdjustQty(1)}
                          className="shrink-0 flex h-10 w-10 items-center justify-center rounded-xl border border-[#E5E7EB] bg-white text-[#374151] hover:bg-[#F9FAFB]">
                          <Plus size={15} />
                        </button>
                      </div>
                      <div className="mt-2 flex items-center gap-1 flex-nowrap overflow-x-auto">
                        <span className="shrink-0 text-[9.5px] font-black uppercase text-[#9CA3AF] mr-0.5">Quick:</span>
                        {[1, 5, 10, 25, 50, 100].map(preset => (
                          <button key={preset} type="button" onClick={() => setAdjustModal(m => m ? { ...m, qty: String(preset) } : m)}
                            className={`shrink-0 px-2 py-1 rounded-full border text-[10px] font-black transition-colors ${Number(adjustModal.qty) === preset ? `${meta.accentBg} border-transparent text-white` : 'bg-white border-[#E5E7EB] text-[#374151] hover:bg-[#F9FAFB]'}`}>
                            +{preset}
                          </button>
                        ))}
                      </div>
                    </>
                  )}

                  {hasEntry && exceedsStock && (
                    <div className="mt-2 flex items-center gap-2 rounded-lg border border-red-300 bg-red-50 px-3 py-2">
                      <AlertTriangle size={13} className="shrink-0 text-red-600" />
                      <p className="text-[11px] text-red-700 font-bold">
                        Only {adjustModal.product.stock_quantity} unit{adjustModal.product.stock_quantity === 1 ? '' : 's'} available — cannot deduct {entered}.
                      </p>
                    </div>
                  )}
                  {hasEntry && !exceedsStock && (
                    <div className="mt-2 flex items-center justify-between gap-2 rounded-lg border border-[#FDDBB4] bg-white px-3 py-2">
                      <p className="text-[11px] text-[#6B7280] font-semibold">
                        Current: <span className="font-black text-[#111111]">{adjustModal.product.stock_quantity}</span>
                        {' → '}New Stock: <span className={`font-black ${meta.accentText}`}>{newTotal} units</span>
                      </p>
                      <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10.5px] font-black ${change >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                        {change >= 0 ? '+' : ''}{change}
                      </span>
                    </div>
                  )}
                </div>

                {/* Note */}
                <div>
                  <label className="block text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-[#374151] mb-1">Adjustment Note / Reason Description (Optional)</label>
                  <input type="text" value={adjustModal.note} onChange={e => setAdjustModal(m => m ? { ...m, note: e.target.value } : m)}
                    className="w-full border border-[#E5E7EB] p-2 rounded-xl text-[13px] font-bold outline-none focus:border-[#D6402E]"
                    placeholder="e.g. Received new stock shipment / batch delivery" />
                </div>

                {notice && <p className="text-[13px] text-red-600 font-bold bg-red-50 p-2.5 rounded-xl">{notice}</p>}
              </div>

              {/* Footer */}
              <div className="shrink-0 border-t border-[#E5E7EB] p-3 flex gap-2.5">
                <button type="button" onClick={() => { setAdjustModal(null); setNotice('') }} className="flex-1 bg-gray-100 p-2.5 rounded-xl font-bold text-sm hover:bg-gray-200">Cancel</button>
                <button onClick={() => void saveAdjust()} disabled={saving || !hasEntry || exceedsStock}
                  className="flex-[1.5] flex items-center justify-center gap-2 bg-[#141414] border border-[#E2503B] text-white p-2.5 rounded-xl font-bold text-sm hover:bg-black disabled:opacity-50">
                  <CheckCircle2 size={16} />
                  {saving ? 'Saving...' : adjustModal.adjustType === 'reconciliation'
                    ? `Confirm Reconciliation (${hasEntry ? newTotal : '—'} Units)`
                    : `Confirm ${meta.label} (${meta.isAddition ? '+' : '-'}${hasEntry ? entered : 0} Units)`}
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* ── Stock Audit Ledger (History) — slide-in panel ── */}
      {historyModal && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/50" onMouseDown={(e) => { if (e.target === e.currentTarget) setHistoryModal(null) }}>
          <div className="bg-[#FAF9F6] w-full sm:max-w-md h-full flex flex-col shadow-2xl overflow-hidden">
            <div className="flex shrink-0 items-center justify-between gap-3 bg-[#141414] px-5 py-4">
              <div className="flex items-center gap-3 min-w-0">
                <span className="shrink-0 flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-[#E2503B]">
                  <History size={18} />
                </span>
                <div className="min-w-0">
                  <p className="text-white font-black text-[14px] leading-tight">Stock Audit Ledger</p>
                  <p className="text-[#E2503B] text-[11px] font-semibold leading-tight mt-0.5">{BRAND_EN} Immutable History</p>
                </div>
              </div>
              <button onClick={() => setHistoryModal(null)} className="shrink-0 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20">
                <X size={16} />
              </button>
            </div>

            <div className="px-5 py-3.5 border-b border-[#FDDBB4]/60 bg-white">
              <p className="text-[10px] font-black uppercase tracking-wider text-[#D6402E]">Target Product</p>
              <p className="mt-0.5 font-black text-[#111111] break-words">{historyModal.name}</p>
              <span className="mt-1.5 inline-block px-2 py-0.5 rounded-md bg-[#FDDBB4]/50 text-[#7A5F17] text-[11px] font-bold">
                {historyModal.category || 'Uncategorised'}
              </span>
              <div className="mt-2 flex items-center justify-between">
                <p className="text-[12px] font-semibold text-[#6B7280]">Live Stock: <span className="font-black text-[#111111]">{historyModal.stock_quantity} Units</span></p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto hide-scrollbar p-4 space-y-2.5">
              {historyLoading ? (
                <p className="text-center py-10 text-sm font-bold text-[#6B7280]">Loading...</p>
              ) : historyLogs.length === 0 ? (
                <p className="text-center py-10 text-sm font-bold text-[#9CA3AF]">No stock movements recorded for this product yet.</p>
              ) : historyLogs.map(log => {
                const isPositive = log.adjustment >= 0
                const { user, note } = parseLoggedNote(log.reference_id)
                return (
                  <div key={log.id} className="rounded-2xl border border-[#E5E7EB] bg-white p-3.5">
                    <div className="flex items-center justify-between gap-3">
                      <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black uppercase ${REASON_COLORS[log.reason] || 'bg-gray-100 text-gray-600'}`}>{log.reason.replace('_', ' ')}</span>
                      <span className="text-[11px] text-[#9CA3AF] font-semibold whitespace-nowrap">{new Date(log.created_at).toLocaleDateString('en-IN')} at {new Date(log.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <div className="mt-2.5 flex items-center justify-between">
                      <span className={`flex items-center gap-1.5 font-black ${isPositive ? 'text-emerald-600' : 'text-red-600'}`}>
                        <span className={`flex h-6 w-6 items-center justify-center rounded-full ${isPositive ? 'bg-emerald-100' : 'bg-red-100'}`}>
                          {isPositive ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
                        </span>
                        {isPositive ? '+' : ''}{log.adjustment}
                      </span>
                      <span className="text-sm font-bold text-[#374151]">{log.old_quantity} → <span className="text-[#111111]">{log.new_quantity}</span></span>
                    </div>
                    <div className="mt-2 rounded-lg border border-[#E5E7EB] bg-white px-3 py-1.5 text-[11px] text-[#9CA3AF]">
                      {note || 'No note added'}
                    </div>
                    <p className="mt-1.5 text-[10px] font-bold text-[#9CA3AF]">By: {user}</p>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
