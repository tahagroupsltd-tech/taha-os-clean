// src/app/api/content/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { notify } from '@/lib/notify'
import { canDeleteContent } from '@/lib/permissions'
import { syncContentEvents, deleteEntityCalendarEvents } from '@/lib/gcal'
import { sbFindOne, sbUpdate, sbDelete, CONTENT_SELECT } from '@/lib/supa'

export const dynamic = 'force-dynamic'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (user.role === 'CLIENT') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const before = await sbFindOne('content', {
    select: '*,project:projects!projectId(id,name,clientId)',
    filters: { id: `eq.${params.id}` },
  })
  if (!before) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  let body = await req.json()

  if (user.role === 'EMPLOYEE') {
    if (before.assigneeId !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    if (body.status === undefined) return NextResponse.json({ error: 'Employees can only update content status' }, { status: 403 })
    body = {
      status: body.status,
      ...(body.driveLink !== undefined ? { driveLink: body.driveLink } : {}),
    }
  }

  const patch: Record<string, any> = {}
  const allowed = ['title', 'type', 'status', 'description', 'driveLink', 'caption', 'postDate', 'assigneeId', 'projectId']
  for (const k of allowed) {
    if (body[k] !== undefined) {
      patch[k] = k === 'postDate' && body[k] ? new Date(body[k]).toISOString() : (body[k] ?? null)
    }
  }

  await sbUpdate('content', { id: `eq.${params.id}` }, patch)

  const updated = await sbFindOne('content', {
    select: CONTENT_SELECT,
    filters: { id: `eq.${params.id}` },
  })

  // Reassigned
  if (body.assigneeId !== undefined && body.assigneeId !== before.assigneeId && body.assigneeId && body.assigneeId !== user.id) {
    const projectLabel = updated?.project ? ` · ${updated.project.name}` : ''
    await notify({
      userId: body.assigneeId,
      type: 'CONTENT_ASSIGNED',
      title: `Content reassigned to you: ${updated.title}`,
      message: `${user.name} reassigned this ${updated.type.toLowerCase()} to you${projectLabel}.`,
      link: '/content',
    })
  }

  // Status changed → notify client
  if (body.status !== undefined && body.status !== before.status) {
    const clientId = updated?.project?.clientId
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

  // postDate newly set → notify client
  if (body.postDate !== undefined && body.postDate && !before.postDate) {
    const clientId = updated?.project?.clientId
    if (clientId && clientId !== user.id) {
      const date = new Date(body.postDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
      await notify({
        userId: clientId,
        type: 'CONTENT_SCHEDULED',
        title: `Content scheduled: ${updated.title}`,
        message: `Scheduled to post on ${date} for ${updated.project?.name}.`,
        link: '/content',
      })
    }
  }

  // Sync to Google Calendar
  const postDateChanged = body.postDate !== undefined
  const assigneeChanged = body.assigneeId !== undefined && body.assigneeId !== before.assigneeId
  if (updated?.postDate && (postDateChanged || assigneeChanged)) {
    syncContentEvents(updated.id, {
      title: updated.title,
      postDate: new Date(updated.postDate),
      assigneeId: updated.assigneeId,
      createdById: updated.createdById,
      projectName: updated.project?.name,
    }).catch(() => {})
  }

  return NextResponse.json({ data: updated })
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canDeleteContent(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  deleteEntityCalendarEvents('content', params.id).catch(() => {})
  await sbDelete('content', { id: `eq.${params.id}` })
  return NextResponse.json({ message: 'Deleted' })
}
