// src/app/api/transactions/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { getUserFromRequest } from '@/lib/auth'
import { canEditFinance } from '@/lib/permissions'
import { sbFindOne, sbUpdate, sbDelete, TRANSACTION_SELECT } from '@/lib/supa'

export const dynamic = 'force-dynamic'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canEditFinance(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const existing = await sbFindOne('transactions', { filters: { id: `eq.${params.id}` } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()
  const patch: Record<string, any> = {}

  const allowed = ['title', 'type', 'category', 'notes', 'date', 'projectId']
  for (const k of allowed) {
    if (body[k] !== undefined) {
      patch[k] = k === 'date' && body[k] ? new Date(body[k]).toISOString() : (body[k] ?? null)
    }
  }

  if (body.amount !== undefined) {
    const n = typeof body.amount === 'string' ? parseFloat(body.amount) : body.amount
    if (isNaN(n) || n <= 0) {
      return NextResponse.json({ error: 'Amount must be positive' }, { status: 400 })
    }
    patch.amount = n
  }

  await sbUpdate('transactions', { id: `eq.${params.id}` }, patch)

  const updated = await sbFindOne('transactions', {
    select: TRANSACTION_SELECT,
    filters: { id: `eq.${params.id}` },
  })

  revalidatePath('/overview')
  revalidatePath('/billing')

  return NextResponse.json({ data: updated })
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canEditFinance(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  await sbDelete('transactions', { id: `eq.${params.id}` })
  revalidatePath('/overview')
  revalidatePath('/billing')
  return NextResponse.json({ message: 'Deleted' })
}
