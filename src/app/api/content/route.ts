// src/app/api/content/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { notify } from '@/lib/notify'
import { canCreateContent } from '@/lib/permissions'
import { syncContentEvents } from '@/lib/gcal'
import { sbSelect, sbInsert, sbFindOne, CONTENT_SELECT, nowTs } from '@/lib/supa'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')
  const projectId = searchParams.get('projectId')

  const filters: Record<string, string> = {}
  if (status) filters.status = `eq.${status}`
  if (projectId) filters.projectId = `eq.${projectId}`
  const isEmployee = user.role === 'EMPLOYEE' || ['EDITOR', 'SCRIPTWRITER', 'GRAPHIC_DESIGNER', 'WEB_DESIGNER'].includes(user.role)
  if (isEmployee) filters.assigneeId = `eq.${user.id}`

  const items = await sbSelect('content', {
    select: CONTENT_SELECT,
    filters,
    order: 'createdAt.desc',
  })

  // Client: filter by their projects
  const data = user.role === 'CLIENT'
    ? items.filter((c: any) => c.project?.clientId === user.id)
    : items

  return NextResponse.json({ data })
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canCreateContent(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { title, type, status, description, driveLink, scriptLink, caption, postDate, assigneeId, projectId } = body

  if (!title || !type) {
    return NextResponse.json({ error: 'Title and type are required' }, { status: 400 })
  }

  let finalDescription = description || null
  if (postDate) {
    const post = new Date(postDate)
    const deadline = new Date(post.getTime() - 2 * 24 * 60 * 60 * 1000)
    const deadlineStr = `Deadline: ${deadline.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} (2d before posting)`
    finalDescription = description
      ? `${deadlineStr}\n${description.replace(/^Deadline: \d{2} \w{3} \(\d+d before posting\)\n?/, '').trim()}`
      : deadlineStr
  }

  const now = nowTs()
  const item = await sbInsert('content', {
    title,
    type,
    status: status ?? 'IDEA',
    description: finalDescription,
    driveLink: driveLink || null,
    scriptLink: scriptLink || null,
    scriptApproved: false,
    scriptApprovedBy: null,
    caption: caption || null,
    postDate: postDate ? new Date(postDate).toISOString() : null,
    assigneeId: assigneeId || null,
    createdById: user.id,
    projectId: projectId || null,
    createdAt: now,
    updatedAt: now,
  })

  const full = await sbFindOne('content', {
    select: CONTENT_SELECT,
    filters: { id: `eq.${item.id}` },
  }) ?? item

  // Notify the assignee
  if (full.assigneeId && full.assigneeId !== user.id) {
    const projectLabel = full.project ? ` · ${full.project.name}` : ''
    await notify({
      userId: full.assigneeId,
      type: 'CONTENT_ASSIGNED',
      title: `New content assigned: ${full.title}`,
      message: `${user.name} assigned you a ${full.type.toLowerCase()}${projectLabel}.`,
      link: '/content',
    })
  }

  // Notify the project's client when content is scheduled
  if (full.postDate && full.projectId && full.project?.clientId && full.project.clientId !== user.id) {
    const date = new Date(full.postDate).toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
    })
    await notify({
      userId: full.project.clientId,
      type: 'CONTENT_SCHEDULED',
      title: `New content scheduled: ${full.title}`,
      message: `Scheduled to post on ${date} for ${full.project.name}.`,
      link: '/content',
    })
  }

  // Sync to Google Calendar
  if (full.postDate) {
    await syncContentEvents(full.id, {
      title: full.title,
      postDate: new Date(full.postDate),
      assigneeId: full.assigneeId,
      createdById: full.createdById,
      projectName: full.project?.name,
    }).catch(() => {})
  }

  return NextResponse.json({ data: full }, { status: 201 })
}
