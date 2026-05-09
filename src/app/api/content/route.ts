// src/app/api/content/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'
import { ContentType, ContentStatus } from '@prisma/client'
import { notify } from '@/lib/notify'
import { canCreateContent } from '@/lib/permissions'
import { syncContentEvents } from '@/lib/gcal'

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status') as ContentStatus | null
  const projectId = searchParams.get('projectId')

  const where: any = {}
  if (status) where.status = status
  if (projectId) where.projectId = projectId
  if (user.role === 'EMPLOYEE') where.assigneeId = user.id
  if (user.role === 'CLIENT') where.project = { clientId: user.id }

  const items = await db.content.findMany({
    where,
    include: {
      assignee: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true } },
      project: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({ data: items })
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canCreateContent(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { title, type, status, description, driveLink, caption, postDate, assigneeId, projectId } =
    body as {
      title: string
      type: ContentType
      status?: ContentStatus
      description?: string
      driveLink?: string
      caption?: string
      postDate?: string
      assigneeId?: string
      projectId?: string
    }

  if (!title || !type) {
    return NextResponse.json({ error: 'Title and type are required' }, { status: 400 })
  }

  const item = await db.content.create({
    data: {
      title,
      type,
      status: status ?? 'IDEA',
      description,
      driveLink,
      caption,
      postDate: postDate ? new Date(postDate) : null,
      assigneeId: assigneeId || null,
      createdById: user.id,
      projectId: projectId || null,
    },
    include: {
      assignee: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true } },
      project: { select: { id: true, name: true } },
    },
  })

  // ── Notify the assignee ──
  if (item.assigneeId && item.assigneeId !== user.id) {
    const projectLabel = item.project ? ` · ${item.project.name}` : ''
    await notify({
      userId: item.assigneeId,
      type: 'CONTENT_ASSIGNED',
      title: `New content assigned: ${item.title}`,
      message: `${user.name} assigned you a ${item.type.toLowerCase()}${projectLabel}.`,
      link: '/content',
    })
  }

  // ── Notify the project's client when content is scheduled ──
  if (item.postDate && item.projectId) {
    const project = await db.project.findUnique({
      where: { id: item.projectId },
      select: { clientId: true, name: true },
    })
    if (project?.clientId && project.clientId !== user.id) {
      const date = new Date(item.postDate).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
      await notify({
        userId: project.clientId,
        type: 'CONTENT_SCHEDULED',
        title: `New content scheduled: ${item.title}`,
        message: `Scheduled to post on ${date} for ${project.name}.`,
        link: '/content',
      })
    }
  }

  // ── Sync to Google Calendar (fire-and-forget) ──
  if (item.postDate) {
    syncContentEvents(item.id, {
      title: item.title,
      postDate: item.postDate,
      assigneeId: item.assigneeId,
      createdById: item.createdById,
      projectName: item.project?.name,
    }).catch(() => {})
  }

  return NextResponse.json({ data: item }, { status: 201 })
}
