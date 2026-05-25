// src/app/api/receivables/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { getUserFromRequest } from '@/lib/auth'
import { canViewFinance, canEditFinance } from '@/lib/permissions'
import { sbSelect, sbInsert, nowTs } from '@/lib/supa'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canViewFinance(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    const items = await sbSelect('receivables', { order: 'created_at.desc' })

    let pendingTotal = 0
    let receivedTotal = 0
    for (const item of items) {
      const amt = parseFloat(item.amount) || 0
      if (item.status === 'PENDING') pendingTotal += amt
      else if (item.status === 'RECEIVED') receivedTotal += amt
    }

    return NextResponse.json({
      data: items,
      summary: { pendingTotal, receivedTotal, total: pendingTotal + receivedTotal },
    })
  } catch (err: any) {
    console.error('[receivables GET]', err)
    return NextResponse.json({ error: 'Failed to load receivables' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canEditFinance(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    const body = await req.json()
    const { client_name, description, amount, status, due_date, notes, client_id, project_id } = body

    if (!client_name?.trim() || !description?.trim() || amount === undefined) {
      return NextResponse.json({ error: 'Client name, description and amount are required' }, { status: 400 })
    }

    const numericAmount = typeof amount === 'string' ? parseFloat(amount) : amount
    if (isNaN(numericAmount) || numericAmount <= 0) {
      return NextResponse.json({ error: 'Amount must be a positive number' }, { status: 400 })
    }

    const now = nowTs()
    const record = await sbInsert('receivables', {
      client_name: client_name.trim(),
      description: description.trim(),
      amount: numericAmount,
      status: status || 'PENDING',
      due_date: due_date ? new Date(due_date).toISOString() : null,
      notes: notes || null,
      client_id: client_id || null,
      project_id: project_id || null,
      created_at: now,
      updated_at: now,
    })

    revalidatePath('/finance')
    return NextResponse.json({ data: record }, { status: 201 })
  } catch (err: any) {
    console.error('[receivables POST]', err)
    return NextResponse.json({ error: 'Failed to create receivable' }, { status: 500 })
  }
}
