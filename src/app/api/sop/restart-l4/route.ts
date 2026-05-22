import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { sbInsert, sbDelete, sbUpdate, sbFindOne, PROJECT_SELECT, normalizeProject, nowTs } from '@/lib/supa'
import { getBlueprint } from '../run/route'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['ADMIN', 'MANAGER'].includes(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json().catch(() => null)
  const { projectId } = body ?? {}
  if (!projectId) {
    return NextResponse.json({ error: 'projectId is required' }, { status: 400 })
  }

  // Verify project exists
  const rawProject = await sbFindOne('projects', { select: PROJECT_SELECT, filters: { id: `eq.${projectId}` } })
  if (!rawProject) return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  const project = normalizeProject(rawProject)

  const now = nowTs()

  // 1. Clear progress rows for levels 4, 5, 6, and 7
  await sbDelete('sop_progress', {
    projectId: `eq.${projectId}`,
    level: 'gte.4',
  })

  // 2. Initialize Level 4 SOP (create L4 tasks/events, update project's level to 4)
  const blueprint = getBlueprint(4, projectId, user.id, now)
  if (!blueprint) return NextResponse.json({ error: 'Invalid level blueprint' }, { status: 500 })

  // Create tasks
  const createdTasks: any[] = []
  for (const task of blueprint.tasks) {
    try {
      const created = await sbInsert('tasks', task)
      createdTasks.push(created)
    } catch (e) {
      console.error('Failed to create L4 SOP task during restart:', e)
    }
  }

  // Create events
  const createdEvents: any[] = []
  for (const event of blueprint.events) {
    try {
      const created = await sbInsert('events', event)
      createdEvents.push(created)
    } catch (e) {
      console.error('Failed to create L4 SOP event during restart:', e)
    }
  }

  // Update project's level to 4
  await sbUpdate('projects', { id: `eq.${projectId}` }, {
    sopLevel: 4,
    updatedAt: now,
  })

  // Update content status to L4 contentStatus (REVIEW)
  if (blueprint.contentStatus) {
    try {
      await sbUpdate(
        'content',
        { projectId: `eq.${projectId}` },
        { status: blueprint.contentStatus, updatedAt: now }
      )
    } catch (e) {
      // non-critical
    }
  }

  return NextResponse.json({
    ok: true,
    project: project.name,
    summary: `Restarted from L4 for "${project.name}" (Next Batch). Levels 4–7 progress cleared. L4 SOP activated with ${createdTasks.length} tasks and ${createdEvents.length} event(s).`,
  })
}
