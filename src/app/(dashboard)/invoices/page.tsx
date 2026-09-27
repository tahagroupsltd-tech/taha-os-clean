'use client'
// src/app/(dashboard)/invoices/page.tsx
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { TopBar } from '@/components/layout/TopBar'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { useAuthStore } from '@/store/auth.store'
import { formatDate } from '@/lib/utils'
import {
  FileText, Plus, IndianRupee, Clock, CheckCircle2,
  Send, XCircle, RefreshCw, Search, Filter,
} from 'lucide-react'
import toast from 'react-hot-toast'
import Link from 'next/link'

interface Invoice {
  id: string
  invoice_number: string
  type: 'INVOICE' | 'QUOTATION'
  status: 'DRAFT' | 'SENT' | 'PAID' | 'CANCELLED'
  client: { id: string; name: string } | null
  project: { id: string; name: string } | null
  owner: { id: string; name: string }
  subtotal: number
  tax_rate: number
  tax_amount: number
  total: number
  due_date: string | null
  created_at: string
}

const STATUS_BADGE: Record<string, string> = {
  DRAFT:     'bg-stone-100 text-stone-600',
  SENT:      'bg-blue-100 text-blue-700',
  PAID:      'bg-green-100 text-green-700',
  CANCELLED: 'bg-red-100 text-red-600',
}

const STATUS_ICON: Record<string, React.ReactNode> = {
  DRAFT:     <Clock size={11} />,
  SENT:      <Send size={11} />,
  PAID:      <CheckCircle2 size={11} />,
  CANCELLED: <XCircle size={11} />,
}

const TYPE_BADGE: Record<string, string> = {
  INVOICE:   'bg-indigo-50 text-indigo-700',
  QUOTATION: 'bg-amber-50 text-amber-700',
}

const fmtMoney = (n: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency', currency: 'INR', maximumFractionDigits: 0,
  }).format(n)

const STATUS_FILTERS = ['ALL', 'DRAFT', 'SENT', 'PAID', 'CANCELLED'] as const

export default function InvoicesPage() {
  const user = useAuthStore(s => s.user)
  const router = useRouter()
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const [search, setSearch] = useState('')
  const [creating, setCreating] = useState(false)

  const fetchInvoices = useCallback(async () => {
    setLoading(true)
    try {
      const url = statusFilter !== 'ALL'
        ? `/api/invoices?status=${statusFilter}`
        : '/api/invoices'
      const res = await fetch(url)
      const json = await res.json()
      setInvoices(json.data ?? [])
    } catch {
      toast.error('Failed to load invoices')
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  useEffect(() => { fetchInvoices() }, [fetchInvoices])

  const filtered = invoices.filter(inv => {
    const q = search.toLowerCase()
    return (
      !q ||
      inv.invoice_number.toLowerCase().includes(q) ||
      inv.client?.name.toLowerCase().includes(q) ||
      inv.project?.name.toLowerCase().includes(q)
    )
  })

  // Summary stats
  const totalInvoiced = invoices.filter(i => i.status !== 'CANCELLED').reduce((s, i) => s + Number(i.total), 0)
  const totalPaid     = invoices.filter(i => i.status === 'PAID').reduce((s, i) => s + Number(i.total), 0)
  const totalPending  = invoices.filter(i => i.status === 'SENT').reduce((s, i) => s + Number(i.total), 0)
  const draftCount    = invoices.filter(i => i.status === 'DRAFT').length

  const handleNewInvoice = async () => {
    setCreating(true)
    try {
      const res = await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lineItems: [{ description: 'Service', qty: 1, rate: 0 }],
          taxRate: 0,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      router.push(`/invoices/${json.data.id}`)
    } catch (e: any) {
      toast.error(e.message ?? 'Failed to create invoice')
      setCreating(false)
    }
  }

  if (user && user.role !== 'ADMIN' && user.role !== 'MANAGER') {
    return (
      <div className="flex flex-col h-full">
        <TopBar title="Invoices" />
        <div className="flex-1 flex items-center justify-center">
          <p className="text-stone-400 text-sm">You don&apos;t have access to invoices.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <TopBar title="Invoices" />

      <div className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-5">

        {/* Summary cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: 'Total Invoiced', value: fmtMoney(totalInvoiced), icon: <FileText size={15} />, color: 'text-indigo-500', bg: 'bg-indigo-50' },
            { label: 'Paid',           value: fmtMoney(totalPaid),     icon: <CheckCircle2 size={15} />, color: 'text-green-500', bg: 'bg-green-50' },
            { label: 'Pending',        value: fmtMoney(totalPending),  icon: <Send size={15} />,    color: 'text-blue-500',  bg: 'bg-blue-50'  },
            { label: 'Drafts',         value: String(draftCount),      icon: <Clock size={15} />,   color: 'text-stone-500', bg: 'bg-stone-50' },
          ].map(card => (
            <div key={card.label} className="bg-white border border-stone-100 rounded-xl p-4 shadow-sm">
              <div className={`w-8 h-8 rounded-lg ${card.bg} flex items-center justify-center ${card.color} mb-3`}>
                {card.icon}
              </div>
              <p className="text-lg font-bold text-stone-900">{card.value}</p>
              <p className="text-xs text-stone-400 mt-0.5">{card.label}</p>
            </div>
          ))}
        </div>

        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by number, client, project…"
              className="w-full pl-9 pr-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-300 bg-stone-50 focus:bg-white"
            />
          </div>

          {/* Status filter */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <Filter size={13} className="text-stone-400 flex-shrink-0" />
            {STATUS_FILTERS.map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                  statusFilter === s
                    ? 'bg-stone-900 text-white'
                    : 'bg-stone-100 text-stone-500 hover:bg-stone-200'
                }`}
              >
                {s === 'ALL' ? 'All' : s.charAt(0) + s.slice(1).toLowerCase()}
              </button>
            ))}
          </div>

          {/* New invoice */}
          <Button
            onClick={handleNewInvoice}
            disabled={creating}
            className="flex-shrink-0 flex items-center gap-1.5 text-sm"
          >
            {creating
              ? <RefreshCw size={13} className="animate-spin" />
              : <Plus size={13} />
            }
            New Invoice
          </Button>
        </div>

        {/* Table */}
        <div className="bg-white border border-stone-100 rounded-xl shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-stone-400">
              <RefreshCw size={16} className="animate-spin mr-2" />
              <span className="text-sm">Loading invoices…</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-stone-400 gap-3">
              <FileText size={32} className="opacity-30" />
              <p className="text-sm font-medium">
                {search ? 'No invoices match your search' : 'No invoices yet'}
              </p>
              {!search && (
                <Button onClick={handleNewInvoice} disabled={creating} className="text-xs flex items-center gap-1.5">
                  <Plus size={12} />
                  Create your first invoice
                </Button>
              )}
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-stone-100 bg-stone-50/50">
                      <th className="text-left text-[10px] font-semibold text-stone-400 uppercase tracking-wider px-4 py-3">Invoice #</th>
                      <th className="text-left text-[10px] font-semibold text-stone-400 uppercase tracking-wider px-4 py-3">Type</th>
                      <th className="text-left text-[10px] font-semibold text-stone-400 uppercase tracking-wider px-4 py-3">Client</th>
                      <th className="text-left text-[10px] font-semibold text-stone-400 uppercase tracking-wider px-4 py-3">Project</th>
                      <th className="text-left text-[10px] font-semibold text-stone-400 uppercase tracking-wider px-4 py-3">Status</th>
                      <th className="text-right text-[10px] font-semibold text-stone-400 uppercase tracking-wider px-4 py-3">Total</th>
                      <th className="text-left text-[10px] font-semibold text-stone-400 uppercase tracking-wider px-4 py-3">Due</th>
                      <th className="text-left text-[10px] font-semibold text-stone-400 uppercase tracking-wider px-4 py-3">Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((inv, i) => (
                      <tr
                        key={inv.id}
                        onClick={() => router.push(`/invoices/${inv.id}`)}
                        className={`border-b border-stone-50 hover:bg-stone-50 cursor-pointer transition-colors ${
                          i === filtered.length - 1 ? 'border-b-0' : ''
                        }`}
                      >
                        <td className="px-4 py-3">
                          <span className="font-mono font-semibold text-stone-800 text-xs">
                            {inv.invoice_number}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold ${TYPE_BADGE[inv.type]}`}>
                            {inv.type === 'QUOTATION' ? 'Quote' : 'Invoice'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-stone-600">
                          {inv.client?.name ?? <span className="text-stone-300">—</span>}
                        </td>
                        <td className="px-4 py-3 text-stone-500 text-xs">
                          {inv.project?.name ?? <span className="text-stone-300">—</span>}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${STATUS_BADGE[inv.status]}`}>
                            {STATUS_ICON[inv.status]}
                            {inv.status.charAt(0) + inv.status.slice(1).toLowerCase()}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="font-semibold text-stone-800 flex items-center justify-end gap-0.5">
                            <IndianRupee size={11} className="text-stone-400" />
                            {new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(Number(inv.total))}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-stone-400 text-xs">
                          {inv.due_date ? formatDate(inv.due_date) : '—'}
                        </td>
                        <td className="px-4 py-3 text-stone-400 text-xs">
                          {formatDate(inv.created_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="md:hidden divide-y divide-stone-50">
                {filtered.map(inv => (
                  <Link
                    key={inv.id}
                    href={`/invoices/${inv.id}`}
                    className="flex items-center justify-between p-4 hover:bg-stone-50 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono font-bold text-xs text-stone-800">{inv.invoice_number}</span>
                        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-semibold ${STATUS_BADGE[inv.status]}`}>
                          {STATUS_ICON[inv.status]}
                          {inv.status.charAt(0) + inv.status.slice(1).toLowerCase()}
                        </span>
                      </div>
                      <p className="text-xs text-stone-500 truncate">
                        {inv.client?.name ?? 'No client'} {inv.project ? `· ${inv.project.name}` : ''}
                      </p>
                      <p className="text-[10px] text-stone-400 mt-0.5">{formatDate(inv.created_at)}</p>
                    </div>
                    <div className="text-right ml-3 flex-shrink-0">
                      <p className="font-bold text-sm text-stone-800">
                        ₹{new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(Number(inv.total))}
                      </p>
                      <p className="text-[10px] text-stone-400 mt-0.5">
                        {inv.due_date ? `Due ${formatDate(inv.due_date)}` : 'No due date'}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Footer count */}
        {!loading && filtered.length > 0 && (
          <p className="text-xs text-stone-400 text-center">
            Showing {filtered.length} of {invoices.length} invoice{invoices.length !== 1 ? 's' : ''}
          </p>
        )}
      </div>
    </div>
  )
}
