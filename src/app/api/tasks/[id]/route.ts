// src/app/api/tasks/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { notify } from '@/lib/notify'
import { canDeleteTasks } from '@/lib/permissions'
import { syncTaskEvent, deleteEntityCalendarEvents } from '@/lib/gcal'
import { sbFindOne, sbUpdate, sbDelete, TASK_SELECT } from '@/lib/supa'

export const dynamic = 'force-dynamic'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (user.role === 'CLIENT') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const before = await sbFindOne('tasks', {
    select: '*,project:projects!projectId(id,name)',
    filters: { id: `eq.${params.id}` },
  })
  if (!before) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  let body = await req.json()

  if (user.role === 'EMPLOYEE') {
    if (before.assignedToId !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    if (body.status === undefined) return NextResponse.json({ error: 'Employees can only update task status' }, { status: 403 })
    body = { status: body.status }
  }

  const patch: Record<string, any> = {}
  const allowed = ['title', 'description', 'status', 'priority', 'deadline', 'assignedToId', 'projectId']
  for (const k of allowed) {
    if (body[k] !== undefined) {
      patch[k] = k === 'deadline' && body[k] ? new Date(body[k]).toISOString() : (body[k] ?? null)
    }
  }

  await sbUpdate('tasks', { id: `eq.${params.id}` }, patch)

  const updated = await sbFindOne('tasks', {
    select: TASK_SELECT,
    filters: { id: `eq.${params.id}` },
  })

  const projectLabel = updated?.project ? ` · ${updated.project.name}` : ''

  if (body.assignedToId !== undefined && body.assignedToId !== before.assignedToId && body.assignedToId && body.assignedToId !== user.id) {
    await notify({
      userId: body.assignedToId,
      type: 'TASK_ASSIGNED',
      title: `Task reassigned to you: ${updated.title}`,
      message: `${user.name} reassigned this ${updated.priority.toLowerCase()} task to you${projectLabel}.`,
      link: '/tasks',
    })
  }

  if (body.status !== undefined && body.status !== before.status && before.createdById && before.createdById !== user.id) {
    const isDone = body.status === 'DONE'
    await notify({
      userId: before.createdById,
      type: isDone ? 'TASK_COMPLETED' : 'TASK_UPDATED',
      title: isDone ? `Task completed: ${updated.title}` : `Task updated: ${updated.title}`,
      message: `${user.name} moved this task to ${body.status.replace('_', ' ').toLowerCase()}${projectLabel}.`,
      link: '/tasks',
    })
  }

  if (updated?.deadline && updated?.assignedToId) {
    syncTaskEvent(updated.id, {
      title: updated.title,
      deadline: new Date(updated.deadline),
      assigneeId: updated.assignedToId,
      projectName: updated.project?.name,
    }).catch(() => {})
  }

  return NextResponse.json({ data: updated })
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canDeleteTasks(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  deleteEntityCalendarEvents('task', params.id).catch(() => {})
  await sbDelete('tasks', { id: `eq.${params.id}` })
  return NextResponse.json({ message: 'Deleted' })
}
