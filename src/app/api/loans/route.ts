// src/app/api/loans/route.ts
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

  const items = await sbSelect('loans', {
    order: 'created_at.desc',
  })

  let pendingTotal = 0
  let paidTotal = 0
  for (const item of items) {
    const amt = parseFloat(item.amount) || 0
    if (item.status === 'PENDING') {
      pendingTotal += amt
    } else if (item.status === 'PAID') {
      paidTotal += amt
    }
  }

  return NextResponse.json({
    data: items,
    summary: { pendingTotal, paidTotal, total: pendingTotal + paidTotal },
  })
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canEditFinance(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { title, amount, status, due_date, notes } = body

  if (!title || amount === undefined) {
    return NextResponse.json({ error: 'Title and amount are required' }, { status: 400 })
  }

  const numericAmount = typeof amount === 'string' ? parseFloat(amount) : amount
  if (isNaN(numericAmount) || numericAmount <= 0) {
    return NextResponse.json({ error: 'Amount must be a positive number' }, { status: 400 })
  }

  const now = nowTs()
  const loan = await sbInsert('loans', {
    title: title.trim(),
    amount: numericAmount,
    status: status || 'PENDING',
    due_date: due_date ? new Date(due_date).toISOString() : null,
    notes: notes || null,
    created_at: now,
    updated_at: now,
  })

  revalidatePath('/finance')

  return NextResponse.json({ data: loan }, { status: 201 })
}
