// src/app/api/receivables/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { getUserFromRequest } from '@/lib/auth'
import { canEditFinance } from '@/lib/permissions'
import { sbFindOne, sbUpdate, sbDelete, nowTs } from '@/lib/supa'

export const dynamic = 'force-dynamic'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canEditFinance(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    const existing = await sbFindOne('receivables', { filters: { id: `eq.${params.id}` } })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const body = await req.json()
    const patch: Record<string, any> = { updated_at: nowTs() }

    const allowed = ['client_name', 'description', 'status', 'due_date', 'notes', 'client_id', 'project_id']
    for (const k of allowed) {
      if (body[k] !== undefined) {
        patch[k] = k === 'due_date' && body[k] ? new Date(body[k]).toISOString() : (body[k] ?? null)
      }
    }

    if (body.amount !== undefined) {
      const n = typeof body.amount === 'string' ? parseFloat(body.amount) : body.amount
      if (isNaN(n) || n <= 0) return NextResponse.json({ error: 'Amount must be positive' }, { status: 400 })
      patch.amount = n
    }

    const updated = await sbUpdate('receivables', { id: `eq.${params.id}` }, patch)
    revalidatePath('/finance')
    return NextResponse.json({ data: updated })
  } catch (err: any) {
    console.error('[receivables PATCH]', err)
    return NextResponse.json({ error: 'Failed to update receivable' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canEditFinance(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    const existing = await sbFindOne('receivables', { filters: { id: `eq.${params.id}` } })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    await sbDelete('receivables', { id: `eq.${params.id}` })
    revalidatePath('/finance')
    return NextResponse.json({ message: 'Deleted' })
  } catch (err: any) {
    console.error('[receivables DELETE]', err)
    return NextResponse.json({ error: 'Failed to delete receivable' }, { status: 500 })
  }
}
