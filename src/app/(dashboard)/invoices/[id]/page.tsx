'use client'
// src/app/(dashboard)/invoices/[id]/page.tsx
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Printer, ArrowLeft, CheckCircle2, Send } from 'lucide-react'
import toast from 'react-hot-toast'

interface LineItem { description: string; note?: string; qty: number; rate: number }

interface Invoice {
  id: string
  invoice_number: string
  type: 'INVOICE' | 'QUOTATION'
  status: 'DRAFT' | 'SENT' | 'PAID' | 'CANCELLED'
  client: { id: string; name: string; email?: string } | null
  project: { id: string; name: string } | null
  owner: { id: string; name: string }
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
  CANCELLED: 'bg-red-100 text-red-700',
}

const fmtNum = (n: number) =>
  new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(n)

const fmtMoney = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })

// ── Quotation template (matches Taha Media brand format) ──────────────────────
function QuotationView({ inv }: { inv: Invoice }) {
  const clientName  = inv.client?.name  ?? 'Client'
  const projectName = inv.project?.name ?? null

  const scopeLines: string[] = inv.scope_of_work
    ? inv.scope_of_work.split('\n').map(l => l.trim()).filter(Boolean)
    : []

  const detailBullets: string[] = inv.important_details
    ? inv.important_details.split('\n').map(l => l.trim()).filter(Boolean)
    : []

  return (
    <div className="w-full max-w-2xl bg-white rounded-xl border border-stone-100 shadow-sm print:shadow-none print:border-none print:rounded-none p-10 print:p-8 font-sans">

      {/* ── Big header ─────────────────────────────── */}
      <div className="mb-6">
        <h1 className="text-3xl font-black text-stone-900 leading-tight tracking-tight uppercase">
          TAHA MEDIA
        </h1>
        <h2 className="text-3xl font-black text-stone-900 leading-tight tracking-tight uppercase">
          {clientName.toUpperCase()}
        </h2>
        <p className="text-xs text-stone-500 mt-3 leading-relaxed">
          This Quotation is issued by Taha Media (&ldquo;Service Provider&rdquo;) to{' '}
          {clientName} (&ldquo;Client&rdquo;)
        </p>
      </div>

      {/* ── Client + Provider columns ───────────────── */}
      <div className="grid grid-cols-2 gap-6 mb-6 text-xs">
        <div>
          <p className="font-bold text-stone-900 mb-1">Client :</p>
          <p className="text-stone-700">{clientName}{inv.client_location ? `, ${inv.client_location}` : ''}</p>
          {projectName && <p className="text-stone-500 mt-0.5">Project: {projectName}</p>}

          {scopeLines.length > 0 && (
            <div className="mt-3">
              <p className="font-semibold text-stone-700">Scope of Work:</p>
              {scopeLines.map((l, i) => (
                <p key={i} className="text-stone-600 leading-relaxed">{l}</p>
              ))}
            </div>
          )}
        </div>

        <div className="text-right">
          <p className="font-bold text-stone-900 mb-1">Service provider :</p>
          <p className="text-stone-700 font-semibold">Taha Media</p>
          <p className="text-stone-500">Chennai, Tamil Nadu, India</p>
          <p className="text-stone-500">tahagroupsltd@gmail.com</p>
          <p className="text-stone-500">+91 9600816505</p>
        </div>
      </div>

      {/* ── Services table ──────────────────────────── */}
      <table className="w-full text-sm mb-6 border border-stone-200 rounded overflow-hidden">
        <thead>
          <tr className="bg-stone-100">
            <th className="text-left text-[11px] font-semibold text-stone-600 uppercase tracking-widest px-4 py-2.5 w-1/3">Services</th>
            <th className="text-left text-[11px] font-semibold text-stone-600 uppercase tracking-widest px-4 py-2.5"></th>
            <th className="text-right text-[11px] font-semibold text-stone-600 uppercase tracking-widest px-4 py-2.5">Amount</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-100">
          {inv.line_items.map((item, i) => (
            <tr key={i}>
              <td className="px-4 py-4 align-top font-medium text-stone-800">{item.description}</td>
              <td className="px-4 py-4 align-top text-stone-500 text-xs leading-relaxed">
                {item.note ?? (item.qty !== 1 ? `${item.qty} × ₹${fmtNum(item.rate)}` : '')}
              </td>
              <td className="px-4 py-4 align-top text-right font-semibold text-stone-900">
                {fmtNum(item.qty * item.rate)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* ── Total ───────────────────────────────────── */}
      <div className="flex justify-end mb-6">
        <div className="w-52 space-y-1">
          {inv.tax_rate > 0 && (
            <>
              <div className="flex justify-between text-xs text-stone-500">
                <span>Subtotal</span><span>{fmtNum(inv.subtotal)}</span>
              </div>
              <div className="flex justify-between text-xs text-stone-500">
                <span>GST ({inv.tax_rate}%)</span><span>{fmtNum(inv.tax_amount)}</span>
              </div>
            </>
          )}
          <div className="flex justify-between text-sm font-bold text-stone-900 border-t border-stone-300 pt-2 mt-1">
            <span>Total</span><span>{fmtNum(inv.total)}</span>
          </div>
        </div>
      </div>

      {/* ── Important details ───────────────────────── */}
      {detailBullets.length > 0 && (
        <div className="mb-6 text-xs">
          <p className="font-bold text-stone-900 mb-1">Important Details</p>
          <ul className="list-disc list-inside space-y-0.5">
            {detailBullets.map((b, i) => (
              <li key={i} className="text-stone-700">{b}</li>
            ))}
          </ul>
        </div>
      )}

      {/* ── Notes ───────────────────────────────────── */}
      {inv.notes && (
        <div className="mb-6 text-xs text-stone-500 border-t border-stone-100 pt-4 leading-relaxed whitespace-pre-line">
          {inv.notes}
        </div>
      )}

      {/* ── Footer ──────────────────────────────────── */}
      <div className="border-t border-stone-200 pt-4 text-xs text-stone-700 space-y-0.5">
        <p><span className="font-semibold">DATE :</span> {fmtDate(inv.created_at)}</p>
        <p className="font-bold tracking-wide">TAHA MEDIA</p>
      </div>
    </div>
  )
}

// ── Standard invoice template ─────────────────────────────────────────────────
function InvoiceView({ inv }: { inv: Invoice }) {
  return (
    <div className="w-full max-w-2xl bg-white rounded-xl border border-stone-100 shadow-sm print:shadow-none print:border-none print:rounded-none p-10 print:p-8">

      {/* Header */}
      <div className="flex items-start justify-between mb-10">
        <div>
          <h1 className="text-2xl font-bold text-stone-900 tracking-tight">INVOICE</h1>
          <p className="text-sm text-stone-400 mt-0.5">{inv.invoice_number}</p>
        </div>
        <div className="text-right">
          <p className="text-sm font-semibold text-stone-900">Taha Media</p>
          <p className="text-xs text-stone-400 mt-0.5">Chennai, Tamil Nadu, India</p>
          <p className="text-xs text-stone-400">tahagroupsltd@gmail.com</p>
          <p className="text-xs text-stone-400">+91 9600816505</p>
        </div>
      </div>

      {/* Bill to + dates */}
      <div className="grid grid-cols-2 gap-8 mb-10">
        <div>
          <p className="text-[10px] font-semibold text-stone-400 uppercase tracking-widest mb-2">Bill to</p>
          {inv.client ? (
            <>
              <p className="text-sm font-semibold text-stone-900">{inv.client.name}</p>
              {inv.client_location && <p className="text-xs text-stone-500 mt-0.5">{inv.client_location}</p>}
              {inv.client.email && <p className="text-xs text-stone-500 mt-0.5">{inv.client.email}</p>}
            </>
          ) : (
            <p className="text-sm text-stone-400">—</p>
          )}
          {inv.project && <p className="text-xs text-stone-400 mt-1">Project: {inv.project.name}</p>}
        </div>
        <div className="text-right">
          <p className="text-[10px] font-semibold text-stone-400 uppercase tracking-widest mb-2">Details</p>
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-stone-600">
              <span className="text-stone-400">Invoice</span><span>{inv.invoice_number}</span>
            </div>
            <div className="flex justify-between text-xs text-stone-600">
              <span className="text-stone-400">Issued</span><span>{fmtDate(inv.created_at)}</span>
            </div>
            {inv.due_date && (
              <div className="flex justify-between text-xs text-stone-600">
                <span className="text-stone-400">Due</span>
                <span className="font-medium">{fmtDate(inv.due_date)}</span>
              </div>
            )}
            <div className="flex justify-between text-xs">
              <span className="text-stone-400">Status</span>
              <span className={`font-semibold ${inv.status === 'PAID' ? 'text-green-600' : inv.status === 'SENT' ? 'text-blue-600' : 'text-stone-500'}`}>
                {inv.status}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Line items */}
      <table className="w-full text-sm mb-8">
        <thead>
          <tr className="border-b-2 border-stone-900">
            <th className="text-left text-xs font-semibold text-stone-500 uppercase tracking-widest pb-2 w-1/2">Description</th>
            <th className="text-right text-xs font-semibold text-stone-500 uppercase tracking-widest pb-2">Qty</th>
            <th className="text-right text-xs font-semibold text-stone-500 uppercase tracking-widest pb-2">Rate</th>
            <th className="text-right text-xs font-semibold text-stone-500 uppercase tracking-widest pb-2">Amount</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-50">
          {inv.line_items.map((item, i) => (
            <tr key={i}>
              <td className="py-3 text-stone-800">{item.description}</td>
              <td className="py-3 text-right text-stone-600">{item.qty}</td>
              <td className="py-3 text-right text-stone-600">{fmtMoney(item.rate)}</td>
              <td className="py-3 text-right font-medium text-stone-900">{fmtMoney(item.qty * item.rate)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Totals */}
      <div className="flex justify-end mb-8">
        <div className="w-56 space-y-1.5">
          <div className="flex justify-between text-sm text-stone-600">
            <span>Subtotal</span><span>{fmtMoney(inv.subtotal)}</span>
          </div>
          {inv.tax_rate > 0 && (
            <div className="flex justify-between text-sm text-stone-600">
              <span>GST ({inv.tax_rate}%)</span><span>{fmtMoney(inv.tax_amount)}</span>
            </div>
          )}
          <div className="flex justify-between text-base font-bold text-stone-900 border-t border-stone-200 pt-2 mt-2">
            <span>Total</span><span>{fmtMoney(inv.total)}</span>
          </div>
        </div>
      </div>

      {/* Notes */}
      {inv.notes && (
        <div className="border-t border-stone-100 pt-6">
          <p className="text-[10px] font-semibold text-stone-400 uppercase tracking-widest mb-2">Notes</p>
          <p className="text-xs text-stone-500 leading-relaxed whitespace-pre-line">{inv.notes}</p>
        </div>
      )}

      {/* PAID stamp */}
      {inv.status === 'PAID' && (
        <div className="absolute top-32 right-10 rotate-[-20deg] border-4 border-green-500 text-green-500 font-black text-4xl px-4 py-2 rounded-lg opacity-20 pointer-events-none print:opacity-30 select-none">
          PAID
        </div>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function InvoicePreviewPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const [invoice, setInvoice] = useState<Invoice | null>(null)
  const [loading, setLoading] = useState(true)
  const [marking, setMarking] = useState(false)

  useEffect(() => {
    fetch(`/api/invoices/${params.id}`)
      .then(r => r.json())
      .then(j => { if (j.data) setInvoice(j.data) })
      .finally(() => setLoading(false))
  }, [params.id])

  const markAs = async (status: 'SENT' | 'PAID') => {
    if (!invoice) return
    setMarking(true)
    try {
      const res = await fetch(`/api/invoices/${invoice.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error)
      setInvoice(prev => prev ? { ...prev, status } : prev)
      toast.success(`Marked as ${status.toLowerCase()}`)
    } catch (e: any) { toast.error(e.message) }
    finally { setMarking(false) }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-full text-sm text-stone-400">Loading…</div>
  )
  if (!invoice) return (
    <div className="flex items-center justify-center h-full text-sm text-stone-400">Not found</div>
  )

  const isQuotation = invoice.type === 'QUOTATION'
  const docLabel = isQuotation ? 'Quotation' : 'Invoice'

  return (
    <>
      {/* Toolbar */}
      <div className="print:hidden flex items-center justify-between px-6 py-3 border-b border-stone-100 bg-white sticky top-0 z-10">
        <button onClick={() => router.back()} className="inline-flex items-center gap-1.5 text-xs text-stone-500 hover:text-stone-900">
          <ArrowLeft size={13} /> Back
        </button>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold px-2 py-1 rounded bg-stone-100 text-stone-500 uppercase tracking-wide">
            {docLabel}
          </span>
          <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${STATUS_COLORS[invoice.status]}`}>
            {invoice.status}
          </span>
          {invoice.status === 'DRAFT' && (
            <button onClick={() => markAs('SENT')} disabled={marking}
              className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors">
              <Send size={12} /> Mark as sent
            </button>
          )}
          {invoice.status === 'SENT' && (
            <button onClick={() => markAs('PAID')} disabled={marking}
              className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 transition-colors">
              <CheckCircle2 size={12} /> Mark as paid
            </button>
          )}
          <button onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 bg-stone-900 text-white rounded-md hover:bg-stone-700 transition-colors">
            <Printer size={12} /> Download PDF
          </button>
        </div>
      </div>

      {/* Document body */}
      <div className="flex justify-center py-8 px-4 bg-stone-50 min-h-screen print:bg-white print:p-0 print:py-0">
        {isQuotation
          ? <QuotationView inv={invoice} />
          : <InvoiceView inv={invoice} />
        }
      </div>

      <style>{`
        @media print {
          @page { margin: 1cm; }
          .print\\:hidden { display: none !important; }
        }
      `}</style>
    </>
  )
}
