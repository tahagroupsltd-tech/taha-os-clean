// src/app/api/gcal/sync/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { sbSelect, sbRpc } from '@/lib/supa'
import { syncContentEvents, syncTaskEvent, syncOsEventToGcal, isGCalConnected } from '@/lib/gcal'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Verify the user has a connected calendar
  const hasToken = await isGCalConnected(user.id)
  if (!hasToken) {
    return NextResponse.json({ error: 'Google Calendar not connected' }, { status: 400 })
  }

  const now = new Date().toISOString()
  let synced = 0
  const errors: string[] = []

  // Tasks assigned to this user that are not done and have a future deadline
  const tasks = await sbSelect('tasks', {
    select: '*,project:projects!projectId(name)',
    filters: {
      assignedToId: `eq.${user.id}`,
      status: `neq.DONE`,
      deadline: `gte.${now}`,
    },
  })

  for (const t of tasks) {
    try {
      await syncTaskEvent(t.id, {
        title: t.title,
        deadline: new Date(t.deadline),
        assigneeId: t.assignedToId,
        projectName: t.project?.name,
      })
      synced++
    } catch (e: any) {
      errors.push(`Task "${t.title}": ${e?.message}`)
    }
  }

  // Content assigned to this user — upcoming post dates
  const assignedContent = await sbSelect('content', {
    select: '*,project:projects!projectId(name)',
    filters: {
      assigneeId: `eq.${user.id}`,
      status: `neq.POSTED`,
      postDate: `gte.${now}`,
    },
  })

  for (const c of assignedContent) {
    try {
      await syncContentEvents(c.id, {
        title: c.title,
        postDate: new Date(c.postDate),
        assigneeId: c.assigneeId,
        createdById: c.createdById,
        projectName: c.project?.name,
      })
      synced++
    } catch (e: any) {
      errors.push(`Content "${c.title}": ${e?.message}`)
    }
  }

  // Content created by this user (manager) — avoid double-counting
  const createdContent = await sbSelect('content', {
    select: '*,project:projects!projectId(name)',
    filters: {
      createdById: `eq.${user.id}`,
      status: `neq.POSTED`,
      postDate: `gte.${now}`,
      assigneeId: `neq.${user.id}`,
    },
  })

  for (const c of createdContent) {
    try {
      await syncContentEvents(c.id, {
        title: c.title,
        postDate: new Date(c.postDate),
        assigneeId: c.assigneeId,
        createdById: c.createdById,
        projectName: c.project?.name,
      })
      synced++
    } catch (e: any) {
      errors.push(`Content "${c.title}": ${e?.message}`)
    }
  }

  // OS Events owned by this user — upcoming events
  const osEvents = await sbSelect('events', {
    filters: {
      ownerId: `eq.${user.id}`,
      startTime: `gte.${now}`,
    },
  })

  for (const e of osEvents) {
    try {
      await syncOsEventToGcal(user.id, {
        osEventId: e.id,
        title: e.title,
        description: e.description ?? null,
        startTime: e.startTime,
        endTime: e.endTime,
      })
      synced++
    } catch (err: any) {
      errors.push(`Event "${e.title}": ${err?.message}`)
    }
  }

  return NextResponse.json(
    {
      message: `Synced ${synced} item${synced === 1 ? '' : 's'} to Google Calendar`,
      synced,
      ...(errors.length > 0 ? { warnings: errors } : {}),
    },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}
