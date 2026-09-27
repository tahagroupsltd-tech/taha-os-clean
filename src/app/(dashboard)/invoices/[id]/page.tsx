'use client'
// src/app/(dashboard)/invoices/[id]/page.tsx
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Printer, ArrowLeft, CheckCircle2, Send, Pencil, Trash2, Plus } from 'lucide-react'
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

const fmtDateShort = (d: string) => {
  try {
    const date = new Date(d)
    const day = String(date.getDate()).padStart(2, '0')
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const year = String(date.getFullYear()).slice(-2)
    return `${day}/${month}/${year}`
  } catch {
    return d
  }
}

const parseDescription = (desc: string) => {
  const match = desc.match(/^(.*?)\s*(\(.*?\))\s*$/)
  if (match) {
    return { title: match[1].trim(), sub: match[2].trim() }
  }
  return { title: desc, sub: '' }
}

// ── Quotation template (matches Taha Media brand format) ──────────────────────
function QuotationView({
  inv,
  isEditing,
  editData,
  updateField,
  handleAddLineItem,
  handleRemoveLineItem,
  handleLineItemChange,
}: {
  inv: Invoice
  isEditing: boolean
  editData: any
  updateField: (key: string, val: any) => void
  handleAddLineItem: () => void
  handleRemoveLineItem: (index: number) => void
  handleLineItemChange: (index: number, key: string, val: any) => void
}) {
  const currentInv = isEditing ? editData : inv
  const clientName = currentInv.client?.name ?? 'Client'
  const projectName = currentInv.project?.name ?? null

  const scopeLines: string[] = currentInv.scope_of_work
    ? currentInv.scope_of_work.split('\n').map((l: string) => l.trim()).filter(Boolean)
    : []

  const detailBullets: string[] = currentInv.important_details
    ? currentInv.important_details.split('\n').map((l: string) => l.trim()).filter(Boolean)
    : []

  return (
    <div className="w-full max-w-2xl bg-white rounded-xl border border-stone-100 shadow-sm print:shadow-none print:border-none print:rounded-none p-10 pb-28 print:p-8 print:pb-24 font-sans relative overflow-hidden min-h-[950px] flex flex-col justify-between">
      <div>
        {/* ── Big header ─────────────────────────────── */}
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-3xl font-black text-stone-900 leading-tight uppercase tracking-tight">
              {isEditing ? (
                <input
                  type="text"
                  value={currentInv.serviceProviderName ?? 'TAHA MEDIA'}
                  onChange={e => updateField('serviceProviderName', e.target.value)}
                  className="border-b border-stone-300 focus:outline-none focus:border-stone-950 bg-transparent py-0.5 font-black uppercase w-64"
                  placeholder="TAHA MEDIA"
                />
              ) : (
                currentInv.serviceProviderName ?? 'TAHA MEDIA'
              )}
            </h1>
            <h2 className="text-3xl font-black text-stone-900 leading-tight uppercase tracking-tight mt-1">
              {isEditing ? (
                <input
                  type="text"
                  value={currentInv.client?.name ?? ''}
                  onChange={e => updateField('client', { ...currentInv.client, name: e.target.value })}
                  className="border-b border-stone-300 focus:outline-none focus:border-stone-950 bg-transparent py-0.5 font-black uppercase w-64 text-stone-800"
                  placeholder="CLIENT NAME"
                />
              ) : (
                clientName.toUpperCase()
              )}
            </h2>
          </div>

          <div className="text-right text-[11px] text-stone-800 space-y-1 font-mono">
            <div>
              <span className="font-semibold text-stone-500">Date : </span>
              {isEditing ? (
                <input
                  type="date"
                  value={currentInv.created_at ? new Date(currentInv.created_at).toISOString().split('T')[0] : ''}
                  onChange={e => updateField('created_at', e.target.value ? new Date(e.target.value).toISOString() : null)}
                  className="border border-stone-200 rounded px-1.5 py-0.5 text-xs text-stone-800 bg-white ml-1 font-sans"
                />
              ) : (
                fmtDateShort(currentInv.created_at)
              )}
            </div>
            <div>
              <span className="font-semibold text-stone-500">Bill No : </span>
              {isEditing ? (
                <input
                  type="text"
                  value={currentInv.invoice_number ?? ''}
                  onChange={e => updateField('invoice_number', e.target.value)}
                  className="border border-stone-200 rounded px-1.5 py-0.5 text-xs text-stone-800 bg-white ml-1 w-36 font-sans"
                  placeholder="TAHA-202606-003"
                />
              ) : (
                currentInv.invoice_number
              )}
            </div>
          </div>
        </div>

        {/* ── Brownish/Amber Subheading ───────────────── */}
        <div className="mb-6">
          <p className="text-[13px] text-amber-700 font-semibold leading-relaxed">
            This Quotation is issued by Taha Media (&ldquo;Service Provider&rdquo;) to{' '}
            {isEditing ? (currentInv.client?.name ?? 'Client') : clientName} (&ldquo;Client&rdquo;)
          </p>
        </div>

        {/* ── Client + Provider columns ───────────────── */}
        <div className="grid grid-cols-2 gap-6 mb-6 text-xs border-t border-stone-100 pt-6">
          <div>
            <p className="font-bold text-stone-900 mb-1">Client :</p>
            <p className="text-stone-700 font-medium">
              {isEditing ? (
                <input
                  type="text"
                  value={currentInv.client?.name ?? ''}
                  onChange={e => updateField('client', { ...currentInv.client, name: e.target.value })}
                  className="border-b border-stone-200 focus:outline-none bg-transparent w-full font-medium"
                  placeholder="Client Name"
                />
              ) : (
                clientName
              )}
            </p>
            <p className="text-stone-600 mt-1">
              {isEditing ? (
                <input
                  type="text"
                  value={currentInv.client_location ?? ''}
                  onChange={e => updateField('client_location', e.target.value)}
                  className="border-b border-stone-200 focus:outline-none bg-transparent w-full"
                  placeholder="Client Location (e.g. Chennai, Tamil Nadu)"
                />
              ) : (
                currentInv.client_location
              )}
            </p>
            {projectName && !isEditing && <p className="text-stone-500 mt-1 italic">Project: {projectName}</p>}

            {/* Scope of work under client block */}
            <div className="mt-5">
              <p className="font-semibold text-stone-900 mb-1.5">Scope of Work:</p>
              {isEditing ? (
                <textarea
                  value={currentInv.scope_of_work ?? ''}
                  onChange={e => updateField('scope_of_work', e.target.value)}
                  className="w-full border border-stone-200 rounded p-2 text-xs text-stone-700 focus:outline-none bg-white font-sans"
                  rows={6}
                  placeholder="Add scope details (one per line). Format example:&#10;- Videos / Reels ( 10-12 ) - Details&#10;- Posters ( as needed ) - Details"
                />
              ) : (
                scopeLines.length > 0 ? (
                  <div className="space-y-1 pl-0.5">
                    {scopeLines.map((l, i) => (
                      <p key={i} className="text-stone-600 leading-relaxed">{l}</p>
                    ))}
                  </div>
                ) : (
                  <p className="text-stone-400 italic">No scope defined</p>
                )
              )}
            </div>
          </div>

          <div className="text-right">
            <p className="font-bold text-stone-900 mb-1">Service provider :</p>
            {isEditing ? (
              <div className="space-y-1 inline-block text-right">
                <input
                  type="text"
                  value={currentInv.serviceProviderName ?? 'Taha Media'}
                  onChange={e => updateField('serviceProviderName', e.target.value)}
                  className="border-b border-stone-200 focus:outline-none bg-transparent text-right w-48 block font-medium"
                  placeholder="Taha Media"
                />
                <input
                  type="text"
                  value={currentInv.serviceProviderAddress ?? 'Chennai, Tamil Nadu, India'}
                  onChange={e => updateField('serviceProviderAddress', e.target.value)}
                  className="border-b border-stone-200 focus:outline-none bg-transparent text-right w-48 block text-[11px]"
                  placeholder="Chennai, Tamil Nadu, India"
                />
                <input
                  type="text"
                  value={currentInv.serviceProviderEmail ?? 'tahagroupsltd@gmail.com'}
                  onChange={e => updateField('serviceProviderEmail', e.target.value)}
                  className="border-b border-stone-200 focus:outline-none bg-transparent text-right w-48 block text-[11px]"
                  placeholder="tahagroupsltd@gmail.com"
                />
                <input
                  type="text"
                  value={currentInv.serviceProviderPhone ?? '+91 9600816505'}
                  onChange={e => updateField('serviceProviderPhone', e.target.value)}
                  className="border-b border-stone-200 focus:outline-none bg-transparent text-right w-48 block text-[11px]"
                  placeholder="+91 9600816505"
                />
              </div>
            ) : (
              <>
                <p className="text-stone-700 font-semibold">{currentInv.serviceProviderName ?? 'Taha Media'}</p>
                <p className="text-stone-500">{currentInv.serviceProviderAddress ?? 'Chennai, Tamil Nadu, India'}</p>
                <p className="text-stone-500">{currentInv.serviceProviderEmail ?? 'tahagroupsltd@gmail.com'}</p>
                <p className="text-stone-500">{currentInv.serviceProviderPhone ?? '+91 9600816505'}</p>
              </>
            )}
          </div>
        </div>

        {/* ── Services table ──────────────────────────── */}
        <div className="mb-6 mt-6">
          {isEditing ? (
            <div className="space-y-4 border border-stone-200 rounded-lg p-4 bg-stone-50 print:hidden">
              <div className="text-xs font-semibold text-stone-600 uppercase tracking-wide flex justify-between items-center">
                <span>Services Table Editor</span>
                <button
                  onClick={handleAddLineItem}
                  className="text-xs text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1 bg-white border border-stone-200 rounded px-2 py-0.5 shadow-sm"
                >
                  <Plus size={11} /> Add Item
                </button>
              </div>
              <div className="space-y-3">
                {currentInv.line_items.map((item: any, idx: number) => (
                  <div key={idx} className="bg-white border border-stone-200 rounded-md p-3 space-y-2 relative shadow-sm">
                    <button
                      onClick={() => handleRemoveLineItem(idx)}
                      className="absolute top-2 right-2 text-stone-400 hover:text-red-500 p-1"
                      title="Delete item"
                    >
                      <Trash2 size={13} />
                    </button>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pr-6">
                      <div>
                        <label className="block text-[9px] font-bold text-stone-500 uppercase">Service Description</label>
                        <input
                          type="text"
                          value={item.description}
                          onChange={e => handleLineItemChange(idx, 'description', e.target.value)}
                          className="w-full border border-stone-200 rounded px-2 py-1 text-xs mt-0.5 focus:outline-none focus:ring-1 focus:ring-stone-400"
                          placeholder="e.g. Social Media Management ( MAY - JUNE )"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold text-stone-500 uppercase">Deliverables (Notes)</label>
                        <input
                          type="text"
                          value={item.note ?? ''}
                          onChange={e => handleLineItemChange(idx, 'note', e.target.value)}
                          className="w-full border border-stone-200 rounded px-2 py-1 text-xs mt-0.5 focus:outline-none focus:ring-1 focus:ring-stone-400"
                          placeholder="e.g. Videos + Posters + Stories + Page Management"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[9px] font-bold text-stone-500 uppercase">Qty</label>
                        <input
                          type="number"
                          value={item.qty}
                          onChange={e => handleLineItemChange(idx, 'qty', parseInt(e.target.value) || 0)}
                          className="w-full border border-stone-200 rounded px-2 py-1 text-xs mt-0.5 focus:outline-none focus:ring-1 focus:ring-stone-400"
                          min={1}
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold text-stone-500 uppercase">Rate (₹)</label>
                        <input
                          type="number"
                          value={item.rate}
                          onChange={e => handleLineItemChange(idx, 'rate', parseFloat(e.target.value) || 0)}
                          className="w-full border border-stone-200 rounded px-2 py-1 text-xs mt-0.5 focus:outline-none focus:ring-1 focus:ring-stone-400"
                          min={0}
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold text-stone-500 uppercase">Total</label>
                        <div className="text-xs font-bold py-1 mt-0.5 text-stone-800">
                          {fmtNum(item.qty * item.rate)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-stone-100">
                  <th className="text-left text-[11px] font-semibold text-stone-600 uppercase tracking-widest px-4 py-2 w-10/12">SERVICES</th>
                  <th className="text-right text-[11px] font-semibold text-stone-600 uppercase tracking-widest px-4 py-2 w-2/12">AMOUNT</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 border-b border-stone-100">
                {currentInv.line_items.map((item: any, i: number) => {
                  const { title, sub } = parseDescription(item.description)
                  return (
                    <tr key={i} className="hover:bg-stone-50/30 transition-colors">
                      <td className="px-4 py-3.5 align-middle">
                        <div className="flex justify-between items-start flex-wrap sm:flex-nowrap gap-2">
                          <div className="min-w-[150px]">
                            <div className="font-bold text-stone-900 text-[13px]">{title}</div>
                            {sub && <div className="text-[11px] text-stone-500 mt-0.5 font-medium">{sub}</div>}
                          </div>
                          {item.note && (
                            <div className="text-stone-600 text-xs flex items-center font-normal pr-4 flex-1 justify-start sm:justify-center text-left sm:text-center leading-relaxed">
                              {item.note}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 align-middle text-right font-bold text-stone-900 text-[13px]">
                        {fmtNum(item.qty * item.rate)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* ── Totals ───────────────────────────────────── */}
        <div>
          {isEditing && (
            <div className="flex justify-end gap-5 items-center mb-6 text-xs text-stone-600 bg-stone-50 border border-stone-200 rounded-md p-3 print:hidden">
              <div className="flex items-center gap-1.5">
                <span className="font-medium text-stone-700">GST Rate (%):</span>
                <input
                  type="number"
                  value={currentInv.tax_rate}
                  onChange={e => updateField('tax_rate', parseFloat(e.target.value) || 0)}
                  className="w-14 border border-stone-200 rounded px-1.5 py-0.5 text-xs text-center focus:outline-none focus:ring-1 focus:ring-stone-400 bg-white"
                  min={0}
                />
              </div>
              <div>Subtotal: <span className="font-semibold text-stone-800">{fmtNum(currentInv.subtotal)}</span></div>
              <div>GST: <span className="font-semibold text-stone-850">{fmtNum(currentInv.tax_amount)}</span></div>
              <div className="font-bold text-stone-900 border-l border-stone-300 pl-3">Total: {fmtNum(currentInv.total)}</div>
            </div>
          )}

          {currentInv.tax_rate > 0 && (
            <div className="flex justify-end mb-2 text-xs text-stone-500 space-y-1 flex-col items-end pr-4">
              <div>Subtotal: {fmtNum(currentInv.subtotal)}</div>
              <div>GST ({currentInv.tax_rate}%): {fmtNum(currentInv.tax_amount)}</div>
            </div>
          )}

          <div className="border-t border-b border-stone-300 py-2.5 mb-6 flex justify-between items-center text-sm font-bold text-stone-900">
            <span className="ml-auto pr-16 uppercase tracking-wider text-[11px] text-stone-600">Total</span>
            <span className="text-right">{fmtNum(currentInv.total)}</span>
          </div>
        </div>

        {/* ── Important details ───────────────────────── */}
        <div className="mb-6">
          {isEditing ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">Important Details</label>
                <textarea
                  value={currentInv.important_details ?? ''}
                  onChange={e => updateField('important_details', e.target.value)}
                  className="w-full border border-stone-200 rounded p-2 text-xs text-stone-700 focus:outline-none bg-white font-sans"
                  rows={4}
                  placeholder="e.g. Services include end-to-end content creation - scripting, shooting..."
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">Internal Notes / Payment Terms</label>
                <textarea
                  value={currentInv.notes ?? ''}
                  onChange={e => updateField('notes', e.target.value)}
                  className="w-full border border-stone-200 rounded p-2 text-xs text-stone-700 focus:outline-none bg-white font-sans"
                  rows={4}
                  placeholder="Optional terms or general notes"
                />
              </div>
            </div>
          ) : (
            <>
              {detailBullets.length > 0 && (
                <div className="mb-5 text-xs text-stone-800 font-medium">
                  <p className="font-bold text-stone-900 mb-1.5">• Important Details</p>
                  <ul className="space-y-1 pl-1">
                    {detailBullets.map((b, i) => (
                      <li key={i} className="flex items-start gap-1 leading-relaxed">
                        <span>•</span> <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {currentInv.notes && (
                <div className="text-[11px] text-stone-500 border-t border-stone-100 pt-4 leading-relaxed whitespace-pre-line">
                  {currentInv.notes}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Footer ──────────────────────────────────── */}
      <div>
        <div className="border-t border-stone-200 pt-4 text-xs text-stone-700 space-y-0.5">
          <p><span className="font-semibold">DATE :</span> {fmtDate(currentInv.created_at)}</p>
          <p className="font-bold tracking-wide">TAHA MEDIA</p>
        </div>

        {/* ── SVG Wavy Accent at the very bottom ───────── */}
        <div className="absolute bottom-0 left-0 right-0 w-full overflow-hidden pointer-events-none leading-[0] select-none print:block">
          <svg viewBox="0 0 1000 100" className="w-full h-16 sm:h-20" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M0,80 C150,100 350,55 500,75 C650,95 850,65 1000,80 L1000,100 L0,100 Z" fill="#d1d5db" opacity="0.6" />
            <path d="M0,90 C150,65 300,100 500,80 C700,60 850,90 1000,70 L1000,100 L0,100 Z" fill="#374151" />
          </svg>
        </div>
      </div>
    </div>
  )
}

// ── Standard invoice template ─────────────────────────────────────────────────
function InvoiceView({
  inv,
  isEditing,
  editData,
  updateField,
  handleAddLineItem,
  handleRemoveLineItem,
  handleLineItemChange,
}: {
  inv: Invoice
  isEditing: boolean
  editData: any
  updateField: (key: string, val: any) => void
  handleAddLineItem: () => void
  handleRemoveLineItem: (index: number) => void
  handleLineItemChange: (index: number, key: string, val: any) => void
}) {
  const currentInv = isEditing ? editData : inv
  return (
    <div className="w-full max-w-2xl bg-white rounded-xl border border-stone-100 shadow-sm print:shadow-none print:border-none print:rounded-none p-10 print:p-8 relative">

      {/* Header */}
      <div className="flex items-start justify-between mb-10">
        <div>
          <h1 className="text-2xl font-bold text-stone-900 tracking-tight">INVOICE</h1>
          <p className="text-sm text-stone-400 mt-0.5">
            {isEditing ? (
              <input
                type="text"
                value={currentInv.invoice_number}
                onChange={e => updateField('invoice_number', e.target.value)}
                className="border-b border-stone-200 focus:outline-none text-stone-800 font-mono text-sm py-0.5"
              />
            ) : (
              currentInv.invoice_number
            )}
          </p>
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
          {currentInv.client ? (
            <>
              <p className="text-sm font-semibold text-stone-900">
                {isEditing ? (
                  <input
                    type="text"
                    value={currentInv.client.name}
                    onChange={e => updateField('client', { ...currentInv.client, name: e.target.value })}
                    className="border-b border-stone-200 focus:outline-none text-stone-800 text-sm py-0.5"
                  />
                ) : (
                  currentInv.client.name
                )}
              </p>
              <p className="text-xs text-stone-500 mt-0.5">
                {isEditing ? (
                  <input
                    type="text"
                    value={currentInv.client_location ?? ''}
                    onChange={e => updateField('client_location', e.target.value)}
                    className="border-b border-stone-200 focus:outline-none text-stone-600 text-xs py-0.5 w-full"
                    placeholder="Client Location"
                  />
                ) : (
                  currentInv.client_location
                )}
              </p>
              {currentInv.client.email && <p className="text-xs text-stone-400 mt-0.5">{currentInv.client.email}</p>}
            </>
          ) : (
            <p className="text-sm text-stone-400">—</p>
          )}
        </div>
        <div className="text-right">
          <p className="text-[10px] font-semibold text-stone-400 uppercase tracking-widest mb-2">Details</p>
          <div className="space-y-1.5 font-mono text-xs">
            <div className="flex justify-between items-center text-stone-650 gap-2">
              <span className="text-stone-400 font-sans">Issued</span>
              <span>
                {isEditing ? (
                  <input
                    type="date"
                    value={currentInv.created_at ? new Date(currentInv.created_at).toISOString().split('T')[0] : ''}
                    onChange={e => updateField('created_at', e.target.value ? new Date(e.target.value).toISOString() : null)}
                    className="border border-stone-200 rounded px-1 text-[11px] font-sans"
                  />
                ) : (
                  fmtDate(currentInv.created_at)
                )}
              </span>
            </div>
            <div className="flex justify-between items-center text-stone-650 gap-2">
              <span className="text-stone-400 font-sans">Due</span>
              <span>
                {isEditing ? (
                  <input
                    type="date"
                    value={currentInv.due_date ? currentInv.due_date.split('T')[0] : ''}
                    onChange={e => updateField('due_date', e.target.value ? new Date(e.target.value).toISOString() : null)}
                    className="border border-stone-200 rounded px-1 text-[11px] font-sans"
                  />
                ) : (
                  currentInv.due_date ? fmtDate(currentInv.due_date) : '—'
                )}
              </span>
            </div>
            <div className="flex justify-between text-xs font-sans">
              <span className="text-stone-400">Status</span>
              <span className={`font-semibold ${currentInv.status === 'PAID' ? 'text-green-650' : currentInv.status === 'SENT' ? 'text-blue-650' : 'text-stone-500'}`}>
                {currentInv.status}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Line items */}
      <div className="mb-8">
        {isEditing ? (
          <div className="space-y-3 bg-stone-50 border border-stone-200 rounded-lg p-4 print:hidden">
            <div className="text-xs font-semibold text-stone-600 uppercase tracking-wide flex justify-between items-center">
              <span>Edit Invoice Line Items</span>
              <button
                onClick={handleAddLineItem}
                className="text-xs text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1 bg-white border border-stone-200 rounded px-2 py-0.5 shadow-sm"
              >
                <Plus size={11} /> Add Row
              </button>
            </div>
            <div className="space-y-2">
              {currentInv.line_items.map((item: any, idx: number) => (
                <div key={idx} className="bg-white border border-stone-200 rounded-md p-3 grid grid-cols-12 gap-2 relative">
                  <div className="col-span-6">
                    <label className="block text-[8px] font-bold text-stone-500 uppercase">Description</label>
                    <input
                      type="text"
                      value={item.description}
                      onChange={e => handleLineItemChange(idx, 'description', e.target.value)}
                      className="w-full border border-stone-200 rounded px-2 py-0.5 text-xs mt-0.5"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-[8px] font-bold text-stone-500 uppercase">Qty</label>
                    <input
                      type="number"
                      value={item.qty}
                      onChange={e => handleLineItemChange(idx, 'qty', parseInt(e.target.value) || 0)}
                      className="w-full border border-stone-200 rounded px-2 py-0.5 text-xs mt-0.5"
                      min={1}
                    />
                  </div>
                  <div className="col-span-3">
                    <label className="block text-[8px] font-bold text-stone-500 uppercase">Rate (₹)</label>
                    <input
                      type="number"
                      value={item.rate}
                      onChange={e => handleLineItemChange(idx, 'rate', parseFloat(e.target.value) || 0)}
                      className="w-full border border-stone-200 rounded px-2 py-0.5 text-xs mt-0.5"
                    />
                  </div>
                  <div className="col-span-1 flex items-end justify-center pb-1">
                    <button onClick={() => handleRemoveLineItem(idx)} className="text-stone-400 hover:text-red-500">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-stone-900">
                <th className="text-left text-xs font-semibold text-stone-500 uppercase tracking-widest pb-2 w-1/2">Description</th>
                <th className="text-right text-xs font-semibold text-stone-500 uppercase tracking-widest pb-2">Qty</th>
                <th className="text-right text-xs font-semibold text-stone-500 uppercase tracking-widest pb-2">Rate</th>
                <th className="text-right text-xs font-semibold text-stone-500 uppercase tracking-widest pb-2">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-50">
              {currentInv.line_items.map((item: any, i: number) => (
                <tr key={i}>
                  <td className="py-3 text-stone-850">{item.description}</td>
                  <td className="py-3 text-right text-stone-600 font-mono text-xs">{item.qty}</td>
                  <td className="py-3 text-right text-stone-600 font-mono text-xs">{fmtMoney(item.rate)}</td>
                  <td className="py-3 text-right font-medium text-stone-900 font-mono text-xs">{fmtMoney(item.qty * item.rate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Totals */}
      <div className="flex justify-end mb-8">
        <div className="w-56 space-y-1.5">
          {isEditing && (
            <div className="flex justify-between items-center text-xs text-stone-600 bg-stone-50 border border-stone-200 rounded p-2 mb-2">
              <span className="font-medium">GST (%):</span>
              <input
                type="number"
                value={currentInv.tax_rate}
                onChange={e => updateField('tax_rate', parseFloat(e.target.value) || 0)}
                className="w-12 border border-stone-200 rounded text-center text-xs py-0.5"
                min={0}
              />
            </div>
          )}
          <div className="flex justify-between text-xs text-stone-600 font-mono">
            <span>Subtotal</span><span>{fmtMoney(currentInv.subtotal)}</span>
          </div>
          {currentInv.tax_rate > 0 && (
            <div className="flex justify-between text-xs text-stone-600 font-mono">
              <span>GST ({currentInv.tax_rate}%)</span><span>{fmtMoney(currentInv.tax_amount)}</span>
            </div>
          )}
          <div className="flex justify-between text-sm font-bold text-stone-900 border-t border-stone-200 pt-2 mt-2 font-mono">
            <span>Total</span><span>{fmtMoney(currentInv.total)}</span>
          </div>
        </div>
      </div>

      {/* Notes */}
      <div className="border-t border-stone-100 pt-6">
        <p className="text-[10px] font-semibold text-stone-400 uppercase tracking-widest mb-2">Notes & Terms</p>
        {isEditing ? (
          <textarea
            value={currentInv.notes ?? ''}
            onChange={e => updateField('notes', e.target.value)}
            className="w-full border border-stone-200 rounded p-2 text-xs text-stone-700 focus:outline-none bg-white font-sans"
            rows={3}
            placeholder="Add general terms or notes"
          />
        ) : (
          currentInv.notes && <p className="text-xs text-stone-500 leading-relaxed whitespace-pre-line">{currentInv.notes}</p>
        )}
      </div>

      {/* PAID stamp */}
      {currentInv.status === 'PAID' && !isEditing && (
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

  // Edit states
  const [isEditing, setIsEditing] = useState(false)
  const [editData, setEditData] = useState<any>(null)
  const [saving, setSaving] = useState(false)

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

  // ── Edit Controls ───────────────────────────────────────────────────────────
  const startEditing = () => {
    setEditData(JSON.parse(JSON.stringify(invoice)))
    setIsEditing(true)
  }

  const cancelEditing = () => {
    setIsEditing(false)
    setEditData(null)
  }

  const updateField = (key: string, val: any) => {
    setEditData((prev: any) => {
      if (!prev) return prev
      const next = { ...prev, [key]: val }

      // If line_items or tax_rate is updated, recalculate subtotal, tax_amount, total
      if (key === 'line_items' || key === 'tax_rate') {
        const line_items = key === 'line_items' ? val : prev.line_items
        const tax_rate = Number(key === 'tax_rate' ? val : prev.tax_rate) || 0
        const subtotal = line_items.reduce((s: number, l: any) => s + (Number(l.qty) || 0) * (Number(l.rate) || 0), 0)
        const tax_amount = subtotal * (tax_rate / 100)
        const total = subtotal + tax_amount
        return { ...next, subtotal, tax_amount, total }
      }
      return next
    })
  }

  const handleAddLineItem = () => {
    if (!editData) return
    const line_items = [...(editData.line_items ?? []), { description: '', note: '', qty: 1, rate: 0 }]
    updateField('line_items', line_items)
  }

  const handleRemoveLineItem = (index: number) => {
    if (!editData) return
    const line_items = (editData.line_items ?? []).filter((_: any, idx: number) => idx !== index)
    updateField('line_items', line_items)
  }

  const handleLineItemChange = (index: number, key: string, val: any) => {
    if (!editData) return
    const line_items = (editData.line_items ?? []).map((item: any, idx: number) => {
      if (idx === index) {
        return { ...item, [key]: val }
      }
      return item
    })
    updateField('line_items', line_items)
  }

  const saveChanges = async () => {
    if (!editData || !invoice) return
    setSaving(true)
    try {
      const payload = {
        invoice_number: editData.invoice_number,
        created_at: editData.created_at,
        due_date: editData.due_date,
        client_location: editData.client_location,
        scope_of_work: editData.scope_of_work,
        important_details: editData.important_details,
        notes: editData.notes,
        lineItems: editData.line_items,
        taxRate: editData.tax_rate,
      }
      const res = await fetch(`/api/invoices/${invoice.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error)
      
      setInvoice(j.data)
      setIsEditing(false)
      setEditData(null)
      toast.success('Changes saved successfully')
    } catch (e: any) {
      toast.error(e.message || 'Failed to save changes')
    } finally {
      setSaving(false)
    }
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

          <div className="h-4 w-px bg-stone-200 mx-1" />

          {/* Edit Actions */}
          {isEditing ? (
            <>
              <button
                onClick={cancelEditing}
                className="inline-flex items-center gap-1 text-xs px-3 py-1.5 border border-stone-200 text-stone-600 rounded-md hover:bg-stone-50 transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                onClick={saveChanges}
                disabled={saving}
                className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 transition-colors font-medium shadow-sm"
              >
                <CheckCircle2 size={12} /> Save Changes
              </button>
            </>
          ) : (
            <>
              <button
                onClick={startEditing}
                className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 border border-stone-200 text-stone-600 rounded-md hover:bg-stone-50 transition-colors font-medium shadow-sm"
              >
                <Pencil size={12} /> Edit Document
              </button>

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
                className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 bg-stone-900 text-white rounded-md hover:bg-stone-700 transition-colors shadow-sm">
                <Printer size={12} /> Download PDF
              </button>
            </>
          )}
        </div>
      </div>

      {/* Document body */}
      <div className="flex justify-center py-8 px-4 bg-stone-50 min-h-screen print:bg-white print:p-0 print:py-0">
        {isQuotation ? (
          <QuotationView
            inv={invoice}
            isEditing={isEditing}
            editData={editData}
            updateField={updateField}
            handleAddLineItem={handleAddLineItem}
            handleRemoveLineItem={handleRemoveLineItem}
            handleLineItemChange={handleLineItemChange}
          />
        ) : (
          <InvoiceView
            inv={invoice}
            isEditing={isEditing}
            editData={editData}
            updateField={updateField}
            handleAddLineItem={handleAddLineItem}
            handleRemoveLineItem={handleRemoveLineItem}
            handleLineItemChange={handleLineItemChange}
          />
        )}
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
