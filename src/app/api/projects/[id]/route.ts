// src/app/api/projects/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { notify } from '@/lib/notify'
import { canManageProjects } from '@/lib/permissions'
import {
  sbFindOne, sbSelect, sbUpdate, sbDelete, sbCount,
  TASK_SELECT, CONTENT_SELECT, PROJECT_SELECT, normalizeProject, nowTs,
} from '@/lib/supa'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const raw = await sbFindOne('projects', {
    select: PROJECT_SELECT,
    filters: { id: `eq.${params.id}` },
  })
  if (!raw) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const project = normalizeProject(raw)

  if (user.role === 'CLIENT' && project.clientId !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const [tasks, content, taskCount, contentCount] = await Promise.all([
    sbSelect('tasks', {
      select: TASK_SELECT,
      filters: { projectId: `eq.${params.id}` },
      order: 'priority.desc,deadline.asc,createdAt.desc',
    }),
    sbSelect('content', {
      select: CONTENT_SELECT,
      filters: { projectId: `eq.${params.id}` },
      order: 'createdAt.desc',
    }),
    sbCount('tasks', { projectId: `eq.${params.id}` }),
    sbCount('content', { projectId: `eq.${params.id}` }),
  ])

  return NextResponse.json({
    data: {
      ...project,
      tasks,
      content,
      _count: { tasks: taskCount, content: contentCount },
    },
  })
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canManageProjects(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const before = await sbFindOne('projects', { filters: { id: `eq.${params.id}` } })
  if (!before) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()
  const patch: Record<string, any> = {}
  if (body.name !== undefined) patch.name = body.name
  if (body.description !== undefined) patch.description = body.description || null
  if (body.status !== undefined) patch.status = body.status
  if (body.boardColumn !== undefined) patch.board_column = body.boardColumn
  if (body.sopLevel !== undefined) patch.sopLevel = body.sopLevel
  if (body.value !== undefined) patch.value = body.value ?? null
  if (body.clientId !== undefined) patch.clientId = body.clientId || null
  if (body.startDate !== undefined) patch.startDate = body.startDate ? new Date(body.startDate).toISOString() : null
  if (body.dueDate !== undefined) patch.dueDate = body.dueDate ? new Date(body.dueDate).toISOString() : null
  if (body.driveFolder !== undefined) patch.driveFolder = body.driveFolder || null

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  }

  await sbUpdate('projects', { id: `eq.${params.id}` }, patch)

  const [rawUpdated, taskCount, contentCount] = await Promise.all([
    sbFindOne('projects', { select: PROJECT_SELECT, filters: { id: `eq.${params.id}` } }),
    sbCount('tasks', { projectId: `eq.${params.id}` }),
    sbCount('content', { projectId: `eq.${params.id}` }),
  ])

  const updated = normalizeProject(rawUpdated)

  // Notify newly-assigned client
  if (body.clientId !== undefined && body.clientId !== before.clientId && body.clientId && body.clientId !== user.id) {
    await notify({
      userId: body.clientId,
      type: 'PROJECT_ASSIGNED',
      title: `New project: ${updated.name}`,
      message: `${user.name} assigned this project to you.`,
      link: '/projects',
    })
  }

  // Notify existing client about status change
  if (updated.clientId && updated.clientId !== user.id && updated.clientId === before.clientId) {
    if (body.status !== undefined && body.status !== before.status) {
      await notify({
        userId: updated.clientId,
        type: 'PROJECT_UPDATED',
        title: `Project updated: ${updated.name}`,
        message: `Status changed to ${body.status.toLowerCase()}.`,
        link: '/projects',
      })
    }
  }

  return NextResponse.json({ data: { ...updated, _count: { tasks: taskCount, content: contentCount } } })
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canManageProjects(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const target = await sbFindOne('projects', { filters: { id: `eq.${params.id}` } })
  if (!target) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { searchParams } = new URL(req.url)
  const force = searchParams.get('force') === 'true'

  const [taskCount, contentCount, transactionCount] = await Promise.all([
    sbCount('tasks', { projectId: `eq.${params.id}` }),
    sbCount('content', { projectId: `eq.${params.id}` }),
    sbCount('transactions', { projectId: `eq.${params.id}` }),
  ])

  const linked = taskCount + contentCount + transactionCount

  if (linked > 0 && !force) {
    return NextResponse.json(
      {
        error: 'Project has linked records. Use force=true to detach and delete, or remove the records first.',
        details: { tasks: taskCount, content: contentCount, transactions: transactionCount },
      },
      { status: 409 }
    )
  }

  if (force && linked > 0) {
    await Promise.all([
      sbUpdate('tasks', { projectId: `eq.${params.id}` }, { projectId: null }),
      sbUpdate('content', { projectId: `eq.${params.id}` }, { projectId: null }),
      sbUpdate('transactions', { projectId: `eq.${params.id}` }, { projectId: null }),
      sbUpdate('events', { projectId: `eq.${params.id}` }, { projectId: null }),
      sbUpdate('notes', { projectId: `eq.${params.id}` }, { projectId: null }),
    ])
  }

  await sbDelete('projects', { id: `eq.${params.id}` })
  return NextResponse.json({ ok: true, message: `Deleted "${target.name}"` })
}
