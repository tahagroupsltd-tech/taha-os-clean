// src/app/api/tasks/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'
import { TaskStatus, TaskPriority } from '@prisma/client'
import { notify } from '@/lib/notify'
import { canCreateTasks } from '@/lib/permissions'
import { syncTaskEvent } from '@/lib/gcal'

// GET /api/tasks
export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status') as TaskStatus | null
  const projectId = searchParams.get('projectId')

  const where: any = {}
  if (status) where.status = status
  if (projectId) where.projectId = projectId

  // Employees see only their own tasks
  if (user.role === 'EMPLOYEE') {
    where.assignedToId = user.id
  }
  // Clients see tasks on their projects only
  if (user.role === 'CLIENT') {
    where.project = { clientId: user.id }
  }

  const tasks = await db.task.findMany({
    where,
    include: {
      assignedTo: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true } },
      project: { select: { id: true, name: true } },
    },
    orderBy: [{ priority: 'desc' }, { deadline: 'asc' }, { createdAt: 'desc' }],
  })

  return NextResponse.json({ data: tasks })
}

// POST /api/tasks
export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canCreateTasks(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const { title, description, status, priority, deadline, assignedToId, projectId } =
    body as {
      title: string
      description?: string
      status?: TaskStatus
      priority?: TaskPriority
      deadline?: string
      assignedToId?: string
      projectId?: string
    }

  if (!title) {
    return NextResponse.json({ error: 'Title is required' }, { status: 400 })
  }

  const task = await db.task.create({
    data: {
      title,
      description,
      status: status ?? 'TODO',
      priority: priority ?? 'MEDIUM',
      deadline: deadline ? new Date(deadline) : null,
      assignedToId: assignedToId || null,
      createdById: user.id,
      projectId: projectId || null,
    },
    include: {
      assignedTo: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true } },
      project: { select: { id: true, name: true } },
    },
  })

  // ── Notify the assignee (don't notify the person who created the task themselves) ──
  if (task.assignedToId && task.assignedToId !== user.id) {
    const projectLabel = task.project ? ` · ${task.project.name}` : ''
    const dueLabel = task.deadline
      ? ` (due ${new Date(task.deadline).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })})`
      : ''
    await notify({
      userId: task.assignedToId,
      type: 'TASK_ASSIGNED',
      title: `New task: ${task.title}`,
      message: `${user.name} assigned you a ${task.priority.toLowerCase()} task${projectLabel}${dueLabel}.`,
      link: '/tasks',
    })
  }

  // ── Sync to assignee's Google Calendar (fire-and-forget) ──
  if (task.deadline && task.assignedToId) {
    syncTaskEvent(task.id, {
      title: task.title,
      deadline: task.deadline,
      assigneeId: task.assignedToId,
      projectName: task.project?.name,
    }).catch(() => {})
  }

  return NextResponse.json({ data: task }, { status: 201 })
}
