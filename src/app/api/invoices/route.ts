// src/app/api/invoices/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { sbSelect, sbInsert, nowTs } from '@/lib/supa'

export const dynamic = 'force-dynamic'

const INVOICE_SELECT =
  '*,client:users!client_id(id,name,email),project:projects!project_id(id,name),owner:users!owner_id(id,name)'

function calcTotals(lineItems: any[], taxRate: number) {
  const subtotal = lineItems.reduce((s, l) => s + (Number(l.qty) || 0) * (Number(l.rate) || 0), 0)
  const taxAmount = subtotal * (taxRate / 100)
  return { subtotal, taxAmount, total: subtotal + taxAmount }
}

function nextInvoiceNumber(existing: any[]): string {
  const nums = existing
    .map((i: any) => parseInt((i.invoice_number ?? '').replace(/\D/g, '') || '0'))
    .filter(Boolean)
  const next = nums.length ? Math.max(...nums) + 1 : 1
  return `INV-${String(next).padStart(4, '0')}`
}

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (user.role !== 'ADMIN' && user.role !== 'MANAGER')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')
  const filters: Record<string, string> = {}
  if (status) filters.status = `eq.${status}`

  const rows = await sbSelect('invoices', {
    select: INVOICE_SELECT,
    filters,
    order: 'created_at.desc',
  })
  return NextResponse.json({ data: rows })
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (user.role !== 'ADMIN' && user.role !== 'MANAGER')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const {
    clientId, projectId, lineItems = [], taxRate = 0, dueDate, notes,
    type = 'INVOICE', scopeOfWork, clientLocation, importantDetails,
  } = body

  if (!lineItems.length) return NextResponse.json({ error: 'At least one line item required' }, { status: 400 })

  const existing = await sbSelect('invoices', { select: 'invoice_number', filters: {}, order: 'created_at.desc' })
  const prefix = type === 'QUOTATION' ? 'QUO' : 'INV'
  const nums = existing
    .map((i: any) => parseInt((i.invoice_number ?? '').replace(/\D/g, '') || '0'))
    .filter(Boolean)
  const next = nums.length ? Math.max(...nums) + 1 : 1
  const invoiceNumber = `${prefix}-${String(next).padStart(4, '0')}`

  const { subtotal, taxAmount, total } = calcTotals(lineItems, Number(taxRate))
  const now = nowTs()

  const row = await sbInsert('invoices', {
    invoice_number: invoiceNumber,
    client_id: clientId || null,
    project_id: projectId || null,
    owner_id: user.id,
    line_items: lineItems,
    subtotal,
    tax_rate: Number(taxRate),
    tax_amount: taxAmount,
    total,
    status: 'DRAFT',
    due_date: dueDate || null,
    notes: notes || null,
    type,
    scope_of_work: scopeOfWork || null,
    client_location: clientLocation || null,
    important_details: importantDetails || null,
    created_at: now,
    updated_at: now,
  })

  return NextResponse.json({ data: row }, { status: 201 })
}
