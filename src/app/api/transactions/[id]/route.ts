// src/app/api/transactions/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'
import { canEditFinance } from '@/lib/permissions'

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  // Founder-only — finance is restricted
  if (!canEditFinance(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const existing = await db.transaction.findUnique({ where: { id: params.id } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()
  const data: any = { ...body }
  if (body.date) data.date = new Date(body.date)
  if (body.amount !== undefined) {
    const n = typeof body.amount === 'string' ? parseFloat(body.amount) : body.amount
    if (isNaN(n) || n <= 0) {
      return NextResponse.json({ error: 'Amount must be positive' }, { status: 400 })
    }
    data.amount = n
  }

  const updated = await db.transaction.update({
    where: { id: params.id },
    data,
    include: {
      owner: { select: { id: true, name: true } },
      project: { select: { id: true, name: true } },
    },
  })
  return NextResponse.json({ data: updated })
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canEditFinance(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  await db.transaction.delete({ where: { id: params.id } })
  return NextResponse.json({ message: 'Deleted' })
}
