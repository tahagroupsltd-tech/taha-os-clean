// src/app/api/tasks/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { notify, triggerWhatsAppNotification } from '@/lib/notify'
import { canDeleteTasks } from '@/lib/permissions'
import { syncTaskEvent, deleteEntityCalendarEvents } from '@/lib/gcal'
import { sbFindOne, sbUpdate, sbDelete, TASK_SELECT } from '@/lib/supa'

export const dynamic = 'force-dynamic'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (user.role === 'CLIENT') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const before = await sbFindOne('tasks', {
    select: TASK_SELECT,
    filters: { id: `eq.${params.id}` },
  })
  if (!before) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  let body = await req.json()

  const isEmployee = user.role === 'EMPLOYEE' || ['EDITOR', 'SCRIPTWRITER', 'GRAPHIC_DESIGNER', 'WEB_DESIGNER'].includes(user.role)
  if (isEmployee) {
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

  // Bug 4 fix: compare raw assignedToId field (not nested join object) to
  // avoid false-positive reassignment notifications when assignee didn't change.
  const prevAssigneeId = before.assignedToId ?? null
  const newAssigneeId = body.assignedToId ?? null
  if (newAssigneeId !== undefined && newAssigneeId !== prevAssigneeId && newAssigneeId && newAssigneeId !== user.id) {
    const dueLabelReassign = updated?.deadline
      ? ` (due ${new Date(updated.deadline).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })})`
      : ''
    await notify({
      userId: body.assignedToId,
      type: 'TASK_ASSIGNED',
      title: `Task reassigned to you: ${updated.title}`,
      message: `${user.name} reassigned this ${updated.priority.toLowerCase()} task to you${projectLabel}.`,
      link: '/tasks',
      gcalEvent: {
        title: `📋 Task: ${updated.title}`,
        description: `${user.name} reassigned this task to you${projectLabel}${dueLabelReassign}.`,
        date: updated?.deadline ? new Date(updated.deadline) : new Date(),
      },
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
    await syncTaskEvent(updated.id, {
      title: updated.title,
      deadline: new Date(updated.deadline),
      assigneeId: updated.assignedToId,
      projectName: updated.project?.name,
    }).catch(() => {})
  }

  // Trigger WhatsApp notification on task update/completion
  const changes: Record<string, { before: any; after: any }> = {}
  let hasChanges = false
  for (const k of allowed) {
    if (body[k] !== undefined && body[k] !== before[k]) {
      changes[k] = { before: before[k] ?? null, after: body[k] ?? null }
      hasChanges = true
    }
  }

  if (hasChanges && updated) {
    const isDone = body.status === 'DONE'
    const eventType = isDone ? 'task.done' : 'task.updated'
    await triggerWhatsAppNotification({
      event: eventType,
      task: updated,
      updatedBy: { id: user.id, name: user.name, role: user.role },
      changes,
    }).catch((err) => console.error('[whatsapp-notification] error:', err))
  }

  return NextResponse.json({ data: updated })
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canDeleteTasks(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  await deleteEntityCalendarEvents('task', params.id).catch(() => {})
  await sbDelete('tasks', { id: `eq.${params.id}` })
  return NextResponse.json({ message: 'Deleted' })
}
