// src/app/api/events/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'
import { EventType } from '@prisma/client'

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  const where: any = {}
  // Clients only see events on their own projects
  if (user.role === 'CLIENT') where.project = { clientId: user.id }
  // Employees see their own events + events they own
  if (user.role === 'EMPLOYEE') where.ownerId = user.id

  if (from || to) {
    where.startTime = {}
    if (from) where.startTime.gte = new Date(from)
    if (to) where.startTime.lte = new Date(to)
  }

  const events = await db.event.findMany({
    where,
    include: {
      owner: { select: { id: true, name: true } },
      project: { select: { id: true, name: true } },
    },
    orderBy: { startTime: 'asc' },
  })

  return NextResponse.json({ data: events })
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (user.role === 'CLIENT') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { title, description, type, startTime, endTime, location, meetingLink, projectId } = body as {
    title: string
    description?: string
    type?: EventType
    startTime: string
    endTime: string
    location?: string
    meetingLink?: string
    projectId?: string
  }

  if (!title || !startTime || !endTime) {
    return NextResponse.json(
      { error: 'Title, startTime, and endTime are required' },
      { status: 400 }
    )
  }

  const event = await db.event.create({
    data: {
      title,
      description,
      type: type ?? 'MEETING',
      startTime: new Date(startTime),
      endTime: new Date(endTime),
      location,
      meetingLink,
      ownerId: user.id,
      projectId: projectId || null,
    },
    include: {
      owner: { select: { id: true, name: true } },
      project: { select: { id: true, name: true } },
    },
  })

  return NextResponse.json({ data: event }, { status: 201 })
}
