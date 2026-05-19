// src/app/api/transactions/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { getUserFromRequest } from '@/lib/auth'
import { canViewFinance, canEditFinance } from '@/lib/permissions'
import { sbSelect, sbInsert, sbFindOne, TRANSACTION_SELECT, nowTs } from '@/lib/supa'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canViewFinance(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type')
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  const filters: Record<string, string> = {}
  if (type) filters.type = `eq.${type}`

  const items = await sbSelect('transactions', {
    select: TRANSACTION_SELECT,
    filters,
    order: 'date.desc',
  })

  // Date filtering in-memory
  let data = items
  if (from) {
    const fromDate = new Date(from)
    data = data.filter((t: any) => new Date(t.date) >= fromDate)
  }
  if (to) {
    const toDate = new Date(to)
    data = data.filter((t: any) => new Date(t.date) <= toDate)
  }

  let income = 0
  let expense = 0
  for (const t of data) {
    if (t.type === 'INCOME') income += parseFloat(t.amount)
    else if (t.type === 'EXPENSE') expense += parseFloat(t.amount)
  }

  return NextResponse.json({
    data,
    summary: { income, expense, net: income - expense },
  })
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canEditFinance(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { title, amount, type, category, notes, date, projectId } = body

  if (!title || !amount || !type) {
    return NextResponse.json({ error: 'Title, amount, and type are required' }, { status: 400 })
  }

  const numericAmount = typeof amount === 'string' ? parseFloat(amount) : amount
  if (isNaN(numericAmount) || numericAmount <= 0) {
    return NextResponse.json({ error: 'Amount must be a positive number' }, { status: 400 })
  }

  const now = nowTs()
  const t = await sbInsert('transactions', {
    title,
    amount: numericAmount,
    type,
    category: category ?? 'OTHER',
    notes: notes || null,
    date: date ? new Date(date).toISOString() : now,
    ownerId: user.id,
    projectId: projectId || null,
    createdAt: now,
    updatedAt: now,
  })

  const full = await sbFindOne('transactions', {
    select: TRANSACTION_SELECT,
    filters: { id: `eq.${t.id}` },
  }) ?? t

  // Bust server-component caches so Overview + Billing update on next load
  revalidatePath('/overview')
  revalidatePath('/billing')

  return NextResponse.json({ data: full }, { status: 201 })
}
