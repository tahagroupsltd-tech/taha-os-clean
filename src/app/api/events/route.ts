// src/app/api/events/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { sbSelect, sbInsert, sbFindOne, EVENT_SELECT, nowTs } from '@/lib/supa'
import { syncOsEventToGcal } from '@/lib/gcal'
import { notify } from '@/lib/notify'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  const filters: Record<string, string> = {}
  const isEmployee = user.role === 'EMPLOYEE' || ['EDITOR', 'SCRIPTWRITER', 'GRAPHIC_DESIGNER', 'WEB_DESIGNER'].includes(user.role)
  if (isEmployee) filters.ownerId = `eq.${user.id}`
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


  // Sync to Google Calendar if the user has connected it
  await syncOsEventToGcal(user.id, {
    osEventId: event.id,
    title: event.title,
    description: event.description ?? null,
    startTime: event.startTime,
    endTime: event.endTime,
  }).catch(() => {})

  // Notify the client if the event is a meeting/call and is linked to a project
  if (projectId && (event.type === 'MEETING' || event.type === 'CALL')) {
    try {
      const proj = await sbFindOne('projects', {
        select: 'id,name,clientId',
        filters: { id: `eq.${projectId}` },
      })
      if (proj && proj.clientId && proj.clientId !== user.id) {
        const dateStr = new Date(event.startTime).toLocaleDateString('en-IN', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        })
        const timeStr = new Date(event.startTime).toLocaleTimeString('en-IN', {
          hour: '2-digit',
          minute: '2-digit',
        })
        await notify({
          userId: proj.clientId,
          type: 'GENERAL',
          title: `📅 New Meeting Scheduled: ${event.title}`,
          message: `A meeting has been scheduled for project "${proj.name}" on ${dateStr} at ${timeStr}.`,
          link: '/calendar',
        })
      }
    } catch (err) {
      console.error('[event notify client] failed:', err)
    }
  }

  return NextResponse.json({ data: full }, { status: 201 })
}
