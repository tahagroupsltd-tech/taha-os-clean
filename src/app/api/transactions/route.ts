// src/app/api/transactions/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'
import { TransactionType, TransactionCategory } from '@prisma/client'
import { canViewFinance, canEditFinance } from '@/lib/permissions'

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  // Founder-only — managers, employees, and clients are blocked
  if (!canViewFinance(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type') as TransactionType | null
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  const where: any = {}
  if (type) where.type = type
  if (from || to) {
    where.date = {}
    if (from) where.date.gte = new Date(from)
    if (to) where.date.lte = new Date(to)
  }

  // sequential to avoid Supabase pooler prepared-statement collisions
  const items = await db.transaction.findMany({
    where,
    include: {
      owner: { select: { id: true, name: true } },
      project: { select: { id: true, name: true } },
    },
    orderBy: { date: 'desc' },
  })
  const totals = await db.transaction.groupBy({
    by: ['type'],
    where,
    _sum: { amount: true },
  })

  const income = totals.find((t) => t.type === 'INCOME')?._sum.amount?.toString() ?? '0'
  const expense = totals.find((t) => t.type === 'EXPENSE')?._sum.amount?.toString() ?? '0'

  return NextResponse.json({
    data: items,
    summary: {
      income: parseFloat(income),
      expense: parseFloat(expense),
      net: parseFloat(income) - parseFloat(expense),
    },
  })
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canEditFinance(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { title, amount, type, category, notes, date, projectId } = body as {
    title: string
    amount: number | string
    type: TransactionType
    category?: TransactionCategory
    notes?: string
    date?: string
    projectId?: string
  }

  if (!title || !amount || !type) {
    return NextResponse.json(
      { error: 'Title, amount, and type are required' },
      { status: 400 }
    )
  }

  const numericAmount = typeof amount === 'string' ? parseFloat(amount) : amount
  if (isNaN(numericAmount) || numericAmount <= 0) {
    return NextResponse.json({ error: 'Amount must be a positive number' }, { status: 400 })
  }

  const t = await db.transaction.create({
    data: {
      title,
      amount: numericAmount,
      type,
      category: category ?? 'OTHER',
      notes,
      date: date ? new Date(date) : new Date(),
      ownerId: user.id,
      projectId: projectId || null,
    },
    include: {
      owner: { select: { id: true, name: true } },
      project: { select: { id: true, name: true } },
    },
  })
  return NextResponse.json({ data: t }, { status: 201 })
}
