import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { sbSelect, sbInsert, sbUpdate, sbFindOne, PROJECT_SELECT, normalizeProject, nowTs } from '@/lib/supa'
import { getBlueprint } from '../run/route'

export const dynamic = 'force-dynamic'

const L1_TO_L2_STEPS = [
  // L1
  { level: 1, key: 'quotation' },
  { level: 1, key: 'mou' },
  { level: 1, key: 'payment' },
  { level: 1, key: 'requirement' },
  { level: 1, key: 'onboarding' },
  { level: 1, key: 'brand_details' },
  // L2
  { level: 2, key: 'assign_team' },
  { level: 2, key: 'welcome_client' },
  { level: 2, key: 'brief_script_head' },
]

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

  // 1. Get existing progress entries to avoid duplicate insertions
  const existingProgress = await sbSelect('sop_progress', {
    filters: { projectId: `eq.${projectId}` },
  })
  const existingKeys = new Set(existingProgress.map((p: any) => `${p.level}_${p.stepKey}`))

  // 2. Insert missing progress entries for L1-L2
  const insertedProgress: any[] = []
  for (const step of L1_TO_L2_STEPS) {
    const key = `${step.level}_${step.key}`
    if (!existingKeys.has(key)) {
      try {
        const res = await sbInsert('sop_progress', {
          projectId,
          level: step.level,
          stepKey: step.key,
          completedAt: now,
          completedById: user.id,
        })
        insertedProgress.push(res)
      } catch (e) {
        console.error(`Failed to insert progress for ${key}:`, e)
      }
    }
  }

  // 3. Initialize Level 3 SOP (create tasks/events, update project's level to 3)
  const blueprint = getBlueprint(3, projectId, user.id, now)
  if (!blueprint) return NextResponse.json({ error: 'Invalid level blueprint' }, { status: 500 })

  // Create tasks
  const createdTasks: any[] = []
  for (const task of blueprint.tasks) {
    try {
      const created = await sbInsert('tasks', task)
      createdTasks.push(created)
    } catch (e) {
      console.error('Failed to create L3 SOP task:', e)
    }
  }

  // Create events
  const createdEvents: any[] = []
  for (const event of blueprint.events) {
    try {
      const created = await sbInsert('events', event)
      createdEvents.push(created)
    } catch (e) {
      console.error('Failed to create L3 SOP event:', e)
    }
  }

  // Update project
  await sbUpdate('projects', { id: `eq.${projectId}` }, {
    sopLevel: 3,
    updatedAt: now,
  })

  // Update content status to L3 contentStatus (SCRIPTING)
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
    insertedProgressCount: insertedProgress.length,
    created: {
      tasks: createdTasks.length,
      events: createdEvents.length,
    },
    summary: `Skipped to L3 SOP for "${project.name}" (Existing Client). L1-L2 marked complete. L3 SOP activated with ${createdTasks.length} tasks and ${createdEvents.length} event(s).`,
  })
}
