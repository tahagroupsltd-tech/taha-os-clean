// src/app/api/notes/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { sbFindOne, sbUpdate, sbDelete, NOTE_SELECT } from '@/lib/supa'

export const dynamic = 'force-dynamic'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const existing = await sbFindOne('notes', { filters: { id: `eq.${params.id}` } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (existing.ownerId !== user.id && user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const patch: Record<string, any> = {}
  const allowed = ['title', 'content', 'icon', 'pinned', 'tags', 'projectId']
  for (const k of allowed) {
    if (body[k] !== undefined) patch[k] = body[k]
  }

  await sbUpdate('notes', { id: `eq.${params.id}` }, patch)

  const updated = await sbFindOne('notes', {
    select: NOTE_SELECT,
    filters: { id: `eq.${params.id}` },
  })

  return NextResponse.json({ data: updated })
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const existing = await sbFindOne('notes', { filters: { id: `eq.${params.id}` } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (existing.ownerId !== user.id && user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  await sbDelete('notes', { id: `eq.${params.id}` })
  return NextResponse.json({ message: 'Deleted' })
}
