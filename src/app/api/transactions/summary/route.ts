// src/app/api/transactions/summary/route.ts
// Lightweight endpoint: returns income, expense, net for current month + all-time
import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { canViewFinance } from '@/lib/permissions'
import { sbSelect } from '@/lib/supa'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canViewFinance(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const items = await sbSelect('transactions', {
    select: 'id,amount,type,date',
    filters: {},
    order: 'date.desc',
  })

  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  const startOfYear = new Date(new Date().getFullYear(), 0, 1)

  let allIncome = 0, allExpense = 0
  let monthIncome = 0, monthExpense = 0
  let yearIncome = 0, yearExpense = 0

  for (const t of items) {
    const amt = parseFloat(t.amount)
    const date = new Date(t.date)
    const isIncome = t.type === 'INCOME'

    if (isIncome) { allIncome += amt } else { allExpense += amt }
    if (date >= startOfMonth) { isIncome ? (monthIncome += amt) : (monthExpense += amt) }
    if (date >= startOfYear)  { isIncome ? (yearIncome  += amt) : (yearExpense  += amt) }
  }

  return NextResponse.json({
    allTime:    { income: allIncome,   expense: allExpense,   net: allIncome - allExpense },
    thisMonth:  { income: monthIncome, expense: monthExpense, net: monthIncome - monthExpense },
    thisYear:   { income: yearIncome,  expense: yearExpense,  net: yearIncome  - yearExpense  },
    txCount: items.length,
  })
}
