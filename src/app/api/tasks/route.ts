// src/app/api/tasks/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { notify } from '@/lib/notify'
import { canCreateTasks } from '@/lib/permissions'
import { syncTaskEvent } from '@/lib/gcal'
import { sbSelect, sbInsert, sbFindOne, TASK_SELECT, nowTs } from '@/lib/supa'

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
  if (user.role === 'EMPLOYEE') filters.assignedToId = `eq.${user.id}`

  const tasks = await sbSelect('tasks', {
    select: TASK_SELECT,
    filters,
    order: 'priority.desc,deadline.asc,createdAt.desc',
  })

  // Client: filter by their projects client-side
  const data = user.role === 'CLIENT'
    ? tasks.filter((t: any) => t.project?.clientId === user.id)
    : tasks

  return NextResponse.json({ data })
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canCreateTasks(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { title, description, status, priority, deadline, assignedToId, projectId } = body

  if (!title) return NextResponse.json({ error: 'Title is required' }, { status: 400 })

  const now = nowTs()
  const task = await sbInsert('tasks', {
    title,
    description: description || null,
    status: status ?? 'TODO',
    priority: priority ?? 'MEDIUM',
    deadline: deadline ? new Date(deadline).toISOString() : null,
    assignedToId: assignedToId || null,
    createdById: user.id,
    projectId: projectId || null,
    createdAt: now,
    updatedAt: now,
  })

  // Fetch with relations
  const full = await sbFindOne('tasks', {
    select: TASK_SELECT,
    filters: { id: `eq.${task.id}` },
  }) ?? task

  if (full.assignedToId && full.assignedToId !== user.id) {
    const projectLabel = full.project ? ` · ${full.project.name}` : ''
    const dueLabel = full.deadline
      ? ` (due ${new Date(full.deadline).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })})`
      : ''
    await notify({
      userId: full.assignedToId,
      type: 'TASK_ASSIGNED',
      title: `New task: ${full.title}`,
      message: `${user.name} assigned you a ${full.priority.toLowerCase()} task${projectLabel}${dueLabel}.`,
      link: '/tasks',
      gcalEvent: {
        title: `📋 New task: ${full.title}`,
        description: `${user.name} assigned you this task${projectLabel}${dueLabel}.`,
        date: full.deadline ? new Date(full.deadline) : new Date(),
      },
    })
  }

  if (full.deadline && full.assignedToId) {
    await syncTaskEvent(full.id, {
      title: full.title,
      deadline: new Date(full.deadline),
      assigneeId: full.assignedToId,
      projectName: full.project?.name,
    }).catch(() => {})
  }

  return NextResponse.json({ data: full }, { status: 201 })
}
