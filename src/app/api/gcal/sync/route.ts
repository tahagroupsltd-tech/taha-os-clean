// src/app/api/gcal/sync/route.ts
// POST: Sync all pending tasks and content to the current user's Google Calendar.
// Safe to call multiple times — uses upsert so existing events are updated, not duplicated.
import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { db } from '@/lib/db'
import { syncContentEvents, syncTaskEvent } from '@/lib/gcal'

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Verify the user has a connected calendar
  const token = await db.googleCalendarToken.findUnique({ where: { userId: user.id } })
  if (!token) {
    return NextResponse.json({ error: 'Google Calendar not connected' }, { status: 400 })
  }

  const now = new Date()
  let synced = 0

  // ── Tasks assigned to this user that are not done and have a future deadline ──
  const tasks = await db.task.findMany({
    where: {
      assignedToId: user.id,
      status: { not: 'DONE' },
      deadline: { gte: now },
    },
    include: { project: { select: { name: true } } },
  })

  await Promise.allSettled(
    tasks.map(async (t) => {
      await syncTaskEvent(t.id, {
        title: t.title,
        deadline: t.deadline,
        assigneeId: t.assignedToId,
        projectName: t.project?.name,
      })
      synced++
    })
  )

  // ── Content assigned to this user (editor) — upcoming post dates ──
  const assignedContent = await db.content.findMany({
    where: {
      assigneeId: user.id,
      status: { not: 'POSTED' },
      postDate: { gte: now },
    },
    include: { project: { select: { name: true } } },
  })

  await Promise.allSettled(
    assignedContent.map(async (c) => {
      await syncContentEvents(c.id, {
        title: c.title,
        postDate: c.postDate,
        assigneeId: c.assigneeId,
        createdById: c.createdById,
        projectName: c.project?.name,
      })
      synced++
    })
  )

  // ── Content created by this user (manager) — upcoming post dates ──
  const createdContent = await db.content.findMany({
    where: {
      createdById: user.id,
      status: { not: 'POSTED' },
      postDate: { gte: now },
      // Avoid double-counting items already handled above
      assigneeId: { not: user.id },
    },
    include: { project: { select: { name: true } } },
  })

  await Promise.allSettled(
    createdContent.map(async (c) => {
      await syncContentEvents(c.id, {
        title: c.title,
        postDate: c.postDate,
        assigneeId: c.assigneeId,
        createdById: c.createdById,
        projectName: c.project?.name,
      })
      synced++
    })
  )

  return NextResponse.json({
    message: `Synced ${synced} item${synced === 1 ? '' : 's'} to Google Calendar`,
    synced,
  })
}
