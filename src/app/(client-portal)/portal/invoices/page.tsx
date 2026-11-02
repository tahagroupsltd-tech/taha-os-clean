'use client'
// src/app/(client-portal)/portal/invoices/page.tsx
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { formatDate, formatMoney } from '@/lib/utils'
import { Receipt, ExternalLink } from 'lucide-react'

type InvoiceStatus = 'DRAFT' | 'SENT' | 'PAID' | 'OVERDUE' | 'CANCELLED'

interface Invoice {
  id: string
  invoice_number: string
  type: string
  status: InvoiceStatus
  total: number
  due_date?: string | null
  created_at: string
  client?: { id: string; name: string } | null
  project?: { id: string; name: string } | null
}

const STATUS_COLOR: Record<InvoiceStatus, string> = {
  DRAFT: 'bg-stone-100 text-stone-500',
  SENT: 'bg-blue-50 text-blue-700',
  PAID: 'bg-green-50 text-green-700',
  OVERDUE: 'bg-red-50 text-red-700',
  CANCELLED: 'bg-stone-100 text-stone-400',
}

function InvoiceRow({ inv }: { inv: Invoice }) {
  return (
    <div className="flex items-center gap-4 px-5 py-3.5 border-b border-stone-50 last:border-0 hover:bg-stone-50 transition-colors">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-stone-900">{inv.invoice_number}</p>
        <p className="text-xs text-stone-400">
          {inv.type === 'QUOTATION' ? 'Quotation' : 'Invoice'} · {formatDate(inv.created_at)}
          {inv.due_date && ` · Due ${formatDate(inv.due_date)}`}
        </p>
      </div>
      <div className="text-right">
        <p className="text-sm font-bold text-stone-900">{formatMoney(inv.total)}</p>
      </div>
      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[inv.status]}`}>
        {inv.status}
      </span>
      <Link
        href={`/portal/invoices/${inv.id}`}
        className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium"
      >
        View <ExternalLink className="w-3 h-3" />
      </Link>
    </div>
  )
}

function SkeletonRow() {
  return (
    <div className="flex items-center gap-4 px-5 py-3.5 animate-pulse">
      <div className="flex-1 space-y-1">
        <div className="h-4 w-1/3 bg-stone-100 rounded" />
        <div className="h-3 w-1/2 bg-stone-100 rounded" />
      </div>
      <div className="h-4 w-16 bg-stone-100 rounded" />
      <div className="h-5 w-14 bg-stone-100 rounded-full" />
      <div className="h-4 w-10 bg-stone-100 rounded" />
    </div>
  )
}

export default function PortalInvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/invoices')
      .then((r) => r.json())
      .then((d) => setInvoices(d.data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const pending = invoices.filter((inv) => ['SENT', 'OVERDUE', 'DRAFT'].includes(inv.status))
  const paid = invoices.filter((inv) => inv.status === 'PAID' || inv.status === 'CANCELLED')

  const totalOutstanding = pending
    .filter((inv) => inv.status === 'SENT' || inv.status === 'OVERDUE')
    .reduce((sum, inv) => sum + Number(inv.total), 0)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-stone-900">Invoices</h1>
        <p className="text-sm text-stone-400 mt-0.5">Your billing history and pending payments</p>
      </div>

      {/* Outstanding total */}
      {!loading && totalOutstanding > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3">
          <Receipt className="w-5 h-5 text-amber-600 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-amber-900">Outstanding amount</p>
            <p className="text-xs text-amber-700">You have {formatMoney(totalOutstanding)} in unpaid invoices</p>
          </div>
          <p className="ml-auto text-xl font-bold text-amber-900">{formatMoney(totalOutstanding)}</p>
        </div>
      )}

      {/* Pending */}
      <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-stone-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-stone-900">Pending &amp; Sent</h2>
          {!loading && <span className="text-xs text-stone-400">{pending.length} invoice{pending.length !== 1 ? 's' : ''}</span>}
        </div>
        {loading ? (
          <div>{Array.from({ length: 3 }).map((_, i) => <SkeletonRow key={i} />)}</div>
        ) : pending.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-stone-400">No pending invoices</div>
        ) : (
          <div>{pending.map((inv) => <InvoiceRow key={inv.id} inv={inv} />)}</div>
        )}
      </div>

      {/* Paid */}
      {(loading || paid.length > 0) && (
        <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-stone-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-stone-900">Paid</h2>
            {!loading && <span className="text-xs text-stone-400">{paid.length} invoice{paid.length !== 1 ? 's' : ''}</span>}
          </div>
          {loading ? (
            <div>{Array.from({ length: 2 }).map((_, i) => <SkeletonRow key={i} />)}</div>
          ) : (
            <div>{paid.map((inv) => <InvoiceRow key={inv.id} inv={inv} />)}</div>
          )}
        </div>
      )}
    </div>
  )
}
