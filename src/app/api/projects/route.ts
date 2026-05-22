// src/app/api/projects/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { notify } from '@/lib/notify'
import { canManageProjects } from '@/lib/permissions'
import { sbSelect, sbInsert, sbFindOne, sbCount, PROJECT_SELECT, normalizeProject, nowTs } from '@/lib/supa'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const filters: Record<string, string> = {}
  if (user.role === 'CLIENT') filters.clientId = `eq.${user.id}`

  const projects = await sbSelect('projects', {
    select: PROJECT_SELECT,
    filters,
    order: 'createdAt.desc',
  })

  // Attach task/content/transaction/event/note counts in parallel
  const withCounts = await Promise.all(
    projects.map(async (p: any) => {
      const [taskCount, contentCount, transactionCount, eventCount, noteCount] = await Promise.all([
        sbCount('tasks', { projectId: `eq.${p.id}` }),
        sbCount('content', { projectId: `eq.${p.id}` }),
        sbCount('transactions', { projectId: `eq.${p.id}` }),
        sbCount('events', { projectId: `eq.${p.id}` }),
        sbCount('notes', { projectId: `eq.${p.id}` }),
      ])
      return {
        ...normalizeProject(p),
        _count: {
          tasks: taskCount,
          content: contentCount,
          transactions: transactionCount,
          events: eventCount,
          notes: noteCount,
        },
      }
    })
  )

  return NextResponse.json({ data: withCounts })
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canManageProjects(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { name, description, status, clientId, startDate, dueDate, driveFolder } = body

  if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 })

  const { boardColumn } = body
  const now = nowTs()
  const project = await sbInsert('projects', {
    name,
    description: description || null,
    status: status ?? 'ACTIVE',
    board_column: boardColumn ?? 'ACTIVE',
    sopLevel: body.sopLevel ?? null,
    value: body.value ?? null,
    clientId: clientId || null,
    startDate: startDate ? new Date(startDate).toISOString() : null,
    dueDate: dueDate ? new Date(dueDate).toISOString() : null,
    driveFolder: driveFolder || null,
    createdAt: now,
    updatedAt: now,
  })

  const full = await sbFindOne('projects', {
    select: PROJECT_SELECT,
    filters: { id: `eq.${project.id}` },
  }) ?? { ...project, client: null }

  const normalized = normalizeProject(full)

  if (normalized.clientId && normalized.clientId !== user.id) {
    await notify({
      userId: normalized.clientId,
      type: 'PROJECT_ASSIGNED',
      title: `New project: ${normalized.name}`,
      message: `${user.name} created a new project for you${normalized.dueDate ? ` (due ${new Date(normalized.dueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })})` : ''}.`,
      link: '/projects',
    })
  }

  return NextResponse.json({ data: { ...normalized, _count: { tasks: 0, content: 0 } } }, { status: 201 })
}
