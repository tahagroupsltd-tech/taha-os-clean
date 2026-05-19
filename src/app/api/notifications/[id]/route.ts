// src/app/api/notifications/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { sbFindOne, sbUpdate, sbDelete } from '@/lib/supa'

export const dynamic = 'force-dynamic'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const read = body.read !== undefined ? Boolean(body.read) : true

  const target = await sbFindOne('notifications', { filters: { id: `eq.${params.id}` } })
  if (!target) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (target.userId !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const updated = await sbUpdate('notifications', { id: `eq.${params.id}` }, { read })
  return NextResponse.json({ data: updated })
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const target = await sbFindOne('notifications', { filters: { id: `eq.${params.id}` } })
  if (!target) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (target.userId !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  await sbDelete('notifications', { id: `eq.${params.id}` })
  return NextResponse.json({ ok: true })
}
