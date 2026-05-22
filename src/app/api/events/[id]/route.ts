// src/app/api/events/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { sbFindOne, sbUpdate, sbDelete, EVENT_SELECT } from '@/lib/supa'
import { syncOsEventToGcal, deleteEntityCalendarEvents } from '@/lib/gcal'

export const dynamic = 'force-dynamic'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const existing = await sbFindOne('events', { filters: { id: `eq.${params.id}` } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (user.role !== 'ADMIN' && user.role !== 'MANAGER' && existing.ownerId !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const patch: Record<string, any> = {}
  const allowed = ['title', 'description', 'type', 'startTime', 'endTime', 'location', 'meetingLink', 'projectId']
  for (const k of allowed) {
    if (body[k] !== undefined) {
      patch[k] = (k === 'startTime' || k === 'endTime') && body[k]
        ? new Date(body[k]).toISOString()
        : (body[k] ?? null)
    }
  }

  await sbUpdate('events', { id: `eq.${params.id}` }, patch)

  const updated = await sbFindOne('events', {
    select: EVENT_SELECT,
    filters: { id: `eq.${params.id}` },
  })

  if (updated) {
    await syncOsEventToGcal(updated.ownerId, {
      osEventId: updated.id,
      title: updated.title,
      description: updated.description ?? null,
      startTime: updated.startTime,
      endTime: updated.endTime,
    }).catch(() => {})
  }

  return NextResponse.json({ data: updated })
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const existing = await sbFindOne('events', { filters: { id: `eq.${params.id}` } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (user.role !== 'ADMIN' && user.role !== 'MANAGER' && existing.ownerId !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  await deleteEntityCalendarEvents('os_event', params.id).catch(() => {})
  await sbDelete('events', { id: `eq.${params.id}` })
  return NextResponse.json({ message: 'Deleted' })
}
