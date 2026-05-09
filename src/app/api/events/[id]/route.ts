// src/app/api/events/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const existing = await db.event.findUnique({ where: { id: params.id } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (user.role !== 'ADMIN' && user.role !== 'MANAGER' && existing.ownerId !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const data: any = { ...body }
  if (body.startTime) data.startTime = new Date(body.startTime)
  if (body.endTime) data.endTime = new Date(body.endTime)

  const updated = await db.event.update({
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

  const existing = await db.event.findUnique({ where: { id: params.id } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (user.role !== 'ADMIN' && user.role !== 'MANAGER' && existing.ownerId !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  await db.event.delete({ where: { id: params.id } })
  return NextResponse.json({ message: 'Deleted' })
}
