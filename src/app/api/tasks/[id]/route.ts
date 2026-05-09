// src/app/api/tasks/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'
import { notify } from '@/lib/notify'
import { canDeleteTasks } from '@/lib/permissions'
import { syncTaskEvent, deleteEntityCalendarEvents } from '@/lib/gcal'

// PATCH /api/tasks/:id
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (user.role === 'CLIENT') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const before = await db.task.findUnique({
    where: { id: params.id },
    include: { project: { select: { id: true, name: true } } },
  })
  if (!before) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  let body = await req.json()

  // Employees can only update tasks assigned to them, and only the status field
  if (user.role === 'EMPLOYEE') {
    if (before.assignedToId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    // Strip everything except status
    if (body.status === undefined) {
      return NextResponse.json(
        { error: 'Employees can only update task status' },
        { status: 403 }
      )
    }
    body = { status: body.status }
  }

  const updated = await db.task.update({
    where: { id: params.id },
    data: {
      ...body,
      deadline: body.deadline ? new Date(body.deadline) : undefined,
    },
    include: {
      assignedTo: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true } },
      project: { select: { id: true, name: true } },
    },
  })

  // ── Notifications ─────────────────────────────────
  const projectLabel = updated.project ? ` · ${updated.project.name}` : ''

  // 1. Reassigned to a new user
  if (
    body.assignedToId !== undefined &&
    body.assignedToId !== before.assignedToId &&
    body.assignedToId &&
    body.assignedToId !== user.id
  ) {
    await notify({
      userId: body.assignedToId,
      type: 'TASK_ASSIGNED',
      title: `Task reassigned to you: ${updated.title}`,
      message: `${user.name} reassigned this ${updated.priority.toLowerCase()} task to you${projectLabel}.`,
      link: '/tasks',
    })
  }

  // 2. Status changed → ping the creator (unless they're the one updating)
  if (
    body.status !== undefined &&
    body.status !== before.status &&
    before.createdById &&
    before.createdById !== user.id
  ) {
    const isDone = body.status === 'DONE'
    await notify({
      userId: before.createdById,
      type: isDone ? 'TASK_COMPLETED' : 'TASK_UPDATED',
      title: isDone
        ? `Task completed: ${updated.title}`
        : `Task updated: ${updated.title}`,
      message: `${user.name} moved this task to ${body.status.replace('_', ' ').toLowerCase()}${projectLabel}.`,
      link: '/tasks',
    })
  }

  // ── Sync updated task to Google Calendar (fire-and-forget) ──
  const newAssignee = updated.assignedToId
  const newDeadline = updated.deadline
  if (newDeadline && newAssignee) {
    syncTaskEvent(updated.id, {
      title: updated.title,
      deadline: newDeadline,
      assigneeId: newAssignee,
      projectName: updated.project?.name,
    }).catch(() => {})
  }

  return NextResponse.json({ data: updated })
}

// DELETE /api/tasks/:id
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canDeleteTasks(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Remove calendar events before deleting the task (fire-and-forget)
  deleteEntityCalendarEvents('task', params.id).catch(() => {})

  await db.task.delete({ where: { id: params.id } })
  return NextResponse.json({ message: 'Deleted' })
}
