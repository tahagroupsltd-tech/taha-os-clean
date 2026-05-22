// src/app/api/invoices/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { sbFindOne, sbUpdate, sbDelete, nowTs } from '@/lib/supa'
import { notify } from '@/lib/notify'

export const dynamic = 'force-dynamic'

const INVOICE_SELECT =
  '*,client:users!client_id(id,name,email),project:projects!project_id(id,name),owner:users!owner_id(id,name)'

function calcTotals(lineItems: any[], taxRate: number) {
  const subtotal = lineItems.reduce((s, l) => s + (Number(l.qty) || 0) * (Number(l.rate) || 0), 0)
  const taxAmount = subtotal * (taxRate / 100)
  return { subtotal, taxAmount, total: subtotal + taxAmount }
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const row = await sbFindOne('invoices', { select: INVOICE_SELECT, filters: { id: `eq.${params.id}` } })
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (user.role !== 'ADMIN' && user.role !== 'MANAGER')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  return NextResponse.json({ data: row })
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (user.role !== 'ADMIN' && user.role !== 'MANAGER')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const existing = await sbFindOne('invoices', { filters: { id: `eq.${params.id}` } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()
  const patch: Record<string, any> = { updated_at: nowTs() }

  const allowed = ['status', 'due_date', 'notes', 'client_id', 'project_id', 'scope_of_work', 'client_location', 'important_details']
  for (const k of allowed) {
    if (body[k] !== undefined) patch[k] = body[k] ?? null
  }

  // If line items or tax updated, recalc totals
  if (body.lineItems !== undefined || body.taxRate !== undefined) {
    const lineItems = body.lineItems ?? existing.line_items
    const taxRate = body.taxRate ?? existing.tax_rate
    const { subtotal, taxAmount, total } = calcTotals(lineItems, Number(taxRate))
    patch.line_items = lineItems
    patch.tax_rate = Number(taxRate)
    patch.subtotal = subtotal
    patch.tax_amount = taxAmount
    patch.total = total
  }

  const updated = await sbUpdate('invoices', { id: `eq.${params.id}` }, patch)

  // Notify owner when invoice is marked PAID
  if (body.status === 'PAID' && existing.status !== 'PAID') {
    const invoiceRef = existing.invoice_number ? `#${existing.invoice_number}` : `(id: ${params.id.slice(0, 8)})`
    const totalLabel = existing.total ? ` — $${Number(existing.total).toLocaleString()}` : ''
    // Notify the invoice owner (ADMIN/MANAGER who created it)
    if (existing.owner_id && existing.owner_id !== user.id) {
      await notify({
        userId: existing.owner_id,
        type: 'INVOICE_PAID',
        title: `Invoice ${invoiceRef} marked paid`,
        message: `${user.name} marked invoice ${invoiceRef}${totalLabel} as paid.`,
        link: '/invoices',
        gcalEvent: {
          title: `💰 Invoice ${invoiceRef} paid${totalLabel}`,
          description: `Marked paid by ${user.name}.`,
          date: new Date(),
        },
      })
    }
    // Also push a GCal note for the acting user (self-reminder)
    await notify({
      userId: user.id,
      type: 'INVOICE_PAID',
      title: `Invoice ${invoiceRef} marked paid`,
      message: `Invoice ${invoiceRef}${totalLabel} has been marked as paid.`,
      link: '/invoices',
      gcalEvent: {
        title: `💰 Invoice ${invoiceRef} paid${totalLabel}`,
        description: `Marked paid.`,
        date: new Date(),
      },
    })
  }

  return NextResponse.json({ data: updated })
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  await sbDelete('invoices', { id: `eq.${params.id}` })
  return NextResponse.json({ message: 'Deleted' })
}
