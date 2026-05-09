// src/app/api/content/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'
import { notify } from '@/lib/notify'
import { canDeleteContent } from '@/lib/permissions'
import { syncContentEvents, deleteEntityCalendarEvents } from '@/lib/gcal'

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (user.role === 'CLIENT') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const before = await db.content.findUnique({
    where: { id: params.id },
    include: { project: { select: { id: true, name: true, clientId: true } } },
  })
  if (!before) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  let body = await req.json()

  if (user.role === 'EMPLOYEE') {
    if (before.assigneeId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (body.status === undefined) {
      return NextResponse.json(
        { error: 'Employees can only update content status' },
        { status: 403 }
      )
    }
    // Allow status + driveLink (so editors can attach the final cut)
    body = {
      status: body.status,
      ...(body.driveLink !== undefined ? { driveLink: body.driveLink } : {}),
    }
  }

  const updated = await db.content.update({
    where: { id: params.id },
    data: {
      ...body,
      postDate: body.postDate ? new Date(body.postDate) : undefined,
    },
    include: {
      assignee: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true } },
      project: { select: { id: true, name: true, clientId: true } },
    },
  })

  // ── Reassigned ──
  if (
    body.assigneeId !== undefined &&
    body.assigneeId !== before.assigneeId &&
    body.assigneeId &&
    body.assigneeId !== user.id
  ) {
    const projectLabel = updated.project ? ` · ${updated.project.name}` : ''
    await notify({
      userId: body.assigneeId,
      type: 'CONTENT_ASSIGNED',
      title: `Content reassigned to you: ${updated.title}`,
      message: `${user.name} reassigned this ${updated.type.toLowerCase()} to you${projectLabel}.`,
      link: '/content',
    })
  }

  // ── Status changed → notify the client (if any) for noteworthy stages ──
  if (body.status !== undefined && body.status !== before.status) {
    const clientId = updated.project?.clientId
    if (clientId && clientId !== user.id) {
      if (body.status === 'POSTED') {
        await notify({
          userId: clientId,
          type: 'CONTENT_POSTED',
          title: `Posted: ${updated.title}`,
          message: `Your ${updated.type.toLowerCase()} for ${updated.project?.name} is now live.`,
          link: '/content',
        })
      } else if (body.status === 'REVIEW') {
        await notify({
          userId: clientId,
          type: 'CONTENT_SCHEDULED',
          title: `Ready for review: ${updated.title}`,
          message: `New ${updated.type.toLowerCase()} ready for your review on ${updated.project?.name}.`,
          link: '/content',
        })
      }
    }
  }

  // ── postDate changed (newly scheduled) → notify client ──
  if (body.postDate !== undefined && body.postDate && !before.postDate) {
    const clientId = updated.project?.clientId
    if (clientId && clientId !== user.id) {
      const date = new Date(body.postDate).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
      await notify({
        userId: clientId,
        type: 'CONTENT_SCHEDULED',
        title: `Content scheduled: ${updated.title}`,
        message: `Scheduled to post on ${date} for ${updated.project?.name}.`,
        link: '/content',
      })
    }
  }

  // ── Sync to Google Calendar if postDate or assignee changed (fire-and-forget) ──
  const hasPostDate = updated.postDate
  const postDateChanged = body.postDate !== undefined
  const assigneeChanged = body.assigneeId !== undefined && body.assigneeId !== before.assigneeId
  if (hasPostDate && (postDateChanged || assigneeChanged)) {
    syncContentEvents(updated.id, {
      title: updated.title,
      postDate: updated.postDate,
      assigneeId: updated.assigneeId,
      createdById: updated.createdById,
      projectName: updated.project?.name,
    }).catch(() => {})
  }

  return NextResponse.json({ data: updated })
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canDeleteContent(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Clean up calendar events (fire-and-forget)
  deleteEntityCalendarEvents('content', params.id).catch(() => {})

  await db.content.delete({ where: { id: params.id } })
  return NextResponse.json({ message: 'Deleted' })
}
