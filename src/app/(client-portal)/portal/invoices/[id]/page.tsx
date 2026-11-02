'use client'
// src/app/(client-portal)/portal/invoices/[id]/page.tsx
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { formatMoney, formatDate } from '@/lib/utils'
import { ArrowLeft, Printer } from 'lucide-react'

interface LineItem {
  description: string
  note?: string
  qty: number
  rate: number
}

interface Invoice {
  id: string
  invoice_number: string
  type: 'INVOICE' | 'QUOTATION'
  status: string
  client: { id: string; name: string; email?: string } | null
  project: { id: string; name: string } | null
  line_items: LineItem[]
  subtotal: number
  tax_rate: number
  tax_amount: number
  total: number
  due_date: string | null
  notes: string | null
  scope_of_work: string | null
  client_location: string | null
  important_details: string | null
  created_at: string
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-stone-100 text-stone-600',
  SENT: 'bg-blue-100 text-blue-700',
  PAID: 'bg-green-100 text-green-700',
  OVERDUE: 'bg-red-100 text-red-700',
  CANCELLED: 'bg-stone-100 text-stone-400',
}

const fmtMoney = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })

export default function ClientInvoiceDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [invoice, setInvoice] = useState<Invoice | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch(`/api/invoices/${id}`)
      .then((r) => r.json())
      .then((j) => {
        if (j.data) setInvoice(j.data)
        else setError(j.error ?? 'Could not load invoice')
      })
      .catch(() => setError('Failed to load invoice'))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (error || !invoice) {
    return (
      <div className="text-center py-24">
        <p className="text-stone-400 text-sm">{error || 'Invoice not found'}</p>
        <Link href="/portal/invoices" className="text-blue-600 text-sm hover:underline mt-2 block">
          ← Back to invoices
        </Link>
      </div>
    )
  }

  const scopeLines = invoice.scope_of_work
    ? invoice.scope_of_work.split('\n').map((l) => l.trim()).filter(Boolean)
    : []
  const detailBullets = invoice.important_details
    ? invoice.important_details.split('\n').map((l) => l.trim()).filter(Boolean)
    : []

  return (
    <div className="space-y-4">
      {/* Back + actions */}
      <div className="flex items-center justify-between print:hidden">
        <Link
          href="/portal/invoices"
          className="flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Invoices
        </Link>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-stone-200 text-xs font-medium text-stone-600 hover:bg-stone-50 transition-colors"
        >
          <Printer className="w-3.5 h-3.5" />
          Print
        </button>
      </div>

      {/* Invoice */}
      <div className="bg-white border border-stone-200 rounded-2xl p-8 max-w-2xl mx-auto shadow-sm print:shadow-none print:border-none print:rounded-none print:p-0 print:max-w-none">
        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-stone-900 uppercase tracking-tight">
              {invoice.type === 'QUOTATION' ? 'Quotation' : 'Invoice'}
            </h1>
            <p className="text-sm text-stone-400 mt-0.5 font-mono">{invoice.invoice_number}</p>
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold text-stone-900">Taha Media</p>
            <p className="text-xs text-stone-400 mt-0.5">Chennai, Tamil Nadu, India</p>
            <p className="text-xs text-stone-400">tahagroupsltd@gmail.com</p>
          </div>
        </div>

        {/* Meta */}
        <div className="grid grid-cols-2 gap-6 mb-8 pb-8 border-b border-stone-100">
          <div>
            <p className="text-[10px] font-semibold text-stone-400 uppercase tracking-widest mb-2">Bill To</p>
            {invoice.client ? (
              <>
                <p className="text-sm font-semibold text-stone-900">{invoice.client.name}</p>
                {invoice.client_location && <p className="text-xs text-stone-500 mt-0.5">{invoice.client_location}</p>}
                {invoice.client.email && <p className="text-xs text-stone-400">{invoice.client.email}</p>}
              </>
            ) : (
              <p className="text-sm text-stone-400">—</p>
            )}
            {invoice.project && (
              <p className="text-xs text-stone-400 mt-1">Project: {invoice.project.name}</p>
            )}
          </div>
          <div className="text-right">
            <p className="text-[10px] font-semibold text-stone-400 uppercase tracking-widest mb-2">Details</p>
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-end gap-4">
                <span className="text-stone-400">Issued</span>
                <span className="font-mono text-stone-700">{fmtDate(invoice.created_at)}</span>
              </div>
              {invoice.due_date && (
                <div className="flex justify-end gap-4">
                  <span className="text-stone-400">Due</span>
                  <span className="font-mono text-stone-700">{fmtDate(invoice.due_date)}</span>
                </div>
              )}
              <div className="flex justify-end gap-4 items-center">
                <span className="text-stone-400">Status</span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[invoice.status] ?? 'bg-stone-100 text-stone-500'}`}>
                  {invoice.status}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Scope of work */}
        {scopeLines.length > 0 && (
          <div className="mb-6">
            <p className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-2">Scope of Work</p>
            <div className="space-y-1">
              {scopeLines.map((line, i) => (
                <p key={i} className="text-sm text-stone-700 leading-relaxed">{line}</p>
              ))}
            </div>
          </div>
        )}

        {/* Line items */}
        <table className="w-full text-sm mb-6">
          <thead>
            <tr className="border-b-2 border-stone-900">
              <th className="text-left text-xs font-semibold text-stone-500 uppercase tracking-widest pb-2 w-1/2">Description</th>
              <th className="text-right text-xs font-semibold text-stone-500 uppercase tracking-widest pb-2">Qty</th>
              <th className="text-right text-xs font-semibold text-stone-500 uppercase tracking-widest pb-2">Rate</th>
              <th className="text-right text-xs font-semibold text-stone-500 uppercase tracking-widest pb-2">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-50">
            {invoice.line_items.map((item, i) => (
              <tr key={i}>
                <td className="py-3">
                  <p className="font-medium text-stone-900">{item.description}</p>
                  {item.note && <p className="text-xs text-stone-500 mt-0.5">{item.note}</p>}
                </td>
                <td className="py-3 text-right text-stone-600 font-mono text-xs">{item.qty}</td>
                <td className="py-3 text-right text-stone-600 font-mono text-xs">{fmtMoney(item.rate)}</td>
                <td className="py-3 text-right font-medium text-stone-900 font-mono text-xs">
                  {fmtMoney(item.qty * item.rate)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div className="flex justify-end mb-6">
          <div className="w-56 space-y-1.5">
            <div className="flex justify-between text-xs text-stone-600 font-mono">
              <span>Subtotal</span><span>{fmtMoney(invoice.subtotal)}</span>
            </div>
            {invoice.tax_rate > 0 && (
              <div className="flex justify-between text-xs text-stone-600 font-mono">
                <span>GST ({invoice.tax_rate}%)</span><span>{fmtMoney(invoice.tax_amount)}</span>
              </div>
            )}
            <div className="flex justify-between text-base font-bold text-stone-900 border-t border-stone-200 pt-2 mt-2 font-mono">
              <span>Total</span><span>{fmtMoney(invoice.total)}</span>
            </div>
          </div>
        </div>

        {/* Important details */}
        {detailBullets.length > 0 && (
          <div className="border-t border-stone-100 pt-5 mb-4">
            <p className="text-xs font-semibold text-stone-400 uppercase tracking-widest mb-2">Important Details</p>
            <ul className="space-y-1">
              {detailBullets.map((b, i) => (
                <li key={i} className="flex gap-1.5 text-xs text-stone-600 leading-relaxed">
                  <span>•</span><span>{b}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Notes */}
        {invoice.notes && (
          <div className="border-t border-stone-100 pt-4">
            <p className="text-[10px] font-semibold text-stone-400 uppercase tracking-widest mb-2">Notes &amp; Terms</p>
            <p className="text-xs text-stone-500 leading-relaxed whitespace-pre-line">{invoice.notes}</p>
          </div>
        )}

        {/* PAID stamp */}
        {invoice.status === 'PAID' && (
          <div className="mt-6 flex justify-end">
            <div className="border-4 border-green-500 text-green-500 font-black text-2xl px-4 py-1 rounded-lg rotate-[-8deg] opacity-30 select-none">
              PAID
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
