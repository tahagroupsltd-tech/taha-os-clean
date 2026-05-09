// src/app/api/notifications/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'

// PATCH /api/notifications/:id  body: { read: true|false }
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const read = body.read !== undefined ? Boolean(body.read) : true

  const target = await db.notification.findUnique({ where: { id: params.id } })
  if (!target) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (target.userId !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const updated = await db.notification.update({
    where: { id: params.id },
    data: { read },
  })
  return NextResponse.json({ data: updated })
}

// DELETE /api/notifications/:id
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const target = await db.notification.findUnique({ where: { id: params.id } })
  if (!target) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (target.userId !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  await db.notification.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}
