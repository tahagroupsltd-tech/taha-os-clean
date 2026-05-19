// src/app/api/events/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { sbSelect, sbInsert, sbFindOne, EVENT_SELECT, nowTs } from '@/lib/supa'
import { syncOsEventToGcal } from '@/lib/gcal'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  const filters: Record<string, string> = {}
  if (user.role === 'EMPLOYEE') filters.ownerId = `eq.${user.id}`
  if (from) filters['startTime'] = `gte.${new Date(from).toISOString()}`
  // PostgREST only supports one filter per key, handle 'to' separately via select params if needed
  // For simplicity, we pass both and let the client filter — or use lte filter
  // We'll store both filters and PostgREST handles them as AND conditions with same key as separate params
  // Actually PostgREST supports multiple filters for same column via query string repetition
  // supa.ts builds filters as &key=value so we handle from/to with separate keys
  // Use a workaround: fetch and filter in-memory for date range

  const events = await sbSelect('events', {
    select: EVENT_SELECT,
    filters,
    order: 'startTime.asc',
  })

  let data = events

  if (user.role === 'CLIENT') {
    data = data.filter((e: any) => e.project?.clientId === user.id)
  }

  if (from) {
    const fromDate = new Date(from)
    data = data.filter((e: any) => new Date(e.startTime) >= fromDate)
  }
  if (to) {
    const toDate = new Date(to)
    data = data.filter((e: any) => new Date(e.startTime) <= toDate)
  }

  return NextResponse.json({ data })
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (user.role === 'CLIENT') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { title, description, type, startTime, endTime, location, meetingLink, projectId } = body

  if (!title || !startTime || !endTime) {
    return NextResponse.json({ error: 'Title, startTime, and endTime are required' }, { status: 400 })
  }

  const now = nowTs()
  const event = await sbInsert('events', {
    title,
    description: description || null,
    type: type ?? 'MEETING',
    startTime: new Date(startTime).toISOString(),
    endTime: new Date(endTime).toISOString(),
    location: location || null,
    meetingLink: meetingLink || null,
    ownerId: user.id,
    projectId: projectId || null,
    createdAt: now,
    updatedAt: now,
  })

  const full = await sbFindOne('events', {
    select: EVENT_SELECT,
    filters: { id: `eq.${event.id}` },
  }) ?? event

  // Fire-and-forget — sync to Google Calendar if the user has connected it
  syncOsEventToGcal(user.id, {
    osEventId: event.id,
    title: event.title,
    description: event.description ?? null,
    startTime: event.startTime,
    endTime: event.endTime,
  }).catch(() => {})

  return NextResponse.json({ data: full }, { status: 201 })
}
