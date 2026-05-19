// src/app/api/crm/activities/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { sbUpdate, sbDelete, sbFindOne } from '@/lib/supa'

export const dynamic = 'force-dynamic'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getUserFromRequest(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const patch: Record<string, any> = {}

    if (body.type !== undefined) patch.type = body.type
    if (body.subject !== undefined) patch.subject = body.subject
    if (body.description !== undefined) patch.description = body.description || null
    if (body.dueDate !== undefined) patch.due_date = body.dueDate ? new Date(body.dueDate).toISOString() : null
    if (body.completed !== undefined) patch.completed = body.completed

    await sbUpdate('crm_activities', { id: `eq.${params.id}` }, patch)

    const activity = await sbFindOne('crm_activities', { filters: { id: `eq.${params.id}` } })

    return NextResponse.json({ data: activity })
  } catch (err) {
    console.error('[CRM activities PATCH]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getUserFromRequest(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    await sbDelete('crm_activities', { id: `eq.${params.id}` })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[CRM activities DELETE]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
