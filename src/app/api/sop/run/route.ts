// src/app/api/sop/run/route.ts
// "Run SOP Level" — creates tasks, events, and content updates for a given SOP level on a project.
import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { sbInsert, sbUpdate, sbFindOne, PROJECT_SELECT, normalizeProject, nowTs } from '@/lib/supa'

export const dynamic = 'force-dynamic'

// ─── SOP task/event blueprints per level ──────────────────────────────────────

export function getBlueprint(level: number, projectId: string, userId: string, now: string) {
  const base = { createdById: userId, projectId, status: 'TODO', createdAt: now, updatedAt: now }

  // Shoot schedule: 2 days from now
  const inTwoDays = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000)
  const inTwoDaysISO = inTwoDays.toISOString()

  const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  const nextWeekISO = nextWeek.toISOString()

  const inFiveDays = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000)

  const blueprints: Record<number, { tasks: any[]; events: any[]; contentStatus?: string }> = {
    1: {
      tasks: [
        { ...base, title: 'Share quotation with client', priority: 'HIGH', deadline: inTwoDaysISO },
        { ...base, title: 'Confirm MOU / agreement', priority: 'HIGH', deadline: inTwoDaysISO },
        { ...base, title: 'Collect advance / full payment', priority: 'URGENT', deadline: inTwoDaysISO },
        { ...base, title: 'Conduct requirement discussion', priority: 'MEDIUM', deadline: inTwoDaysISO },
        { ...base, title: 'Complete client onboarding', priority: 'MEDIUM', deadline: inTwoDaysISO },
        { ...base, title: 'Collect client brand details & references', priority: 'MEDIUM', deadline: inTwoDaysISO },
      ],
      events: [],
    },
    2: {
      tasks: [
        { ...base, title: 'Assign core team members to project', priority: 'HIGH', deadline: inTwoDaysISO },
        { ...base, title: 'Welcome client onboard — share workflow & timelines', priority: 'HIGH', deadline: inTwoDaysISO },
        { ...base, title: 'Brief Script Head & align on project goals', priority: 'HIGH', deadline: inTwoDaysISO },
      ],
      events: [
        {
          title: 'Team kickoff — project briefing',
          type: 'MEETING',
          startTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          endTime: new Date(Date.now() + 24 * 60 * 60 * 1000 + 60 * 60 * 1000).toISOString(),
          ownerId: userId,
          projectId,
          createdAt: now,
          updatedAt: now,
        },
      ],
    },
    3: {
      tasks: [
        { ...base, title: 'Schedule alignment call (Client + PM + Script Team)', priority: 'HIGH', deadline: inTwoDaysISO },
        { ...base, title: 'Calibrate: brand identity, target audience, content goals, tone', priority: 'HIGH', deadline: inTwoDaysISO },
        { ...base, title: 'Complete script writing within agreed timeline', priority: 'URGENT', deadline: nextWeekISO },
      ],
      events: [
        {
          title: 'Client alignment call — script briefing',
          type: 'CALL',
          startTime: inTwoDays.toISOString(),
          endTime: new Date(inTwoDays.getTime() + 60 * 60 * 1000).toISOString(),
          ownerId: userId,
          projectId,
          createdAt: now,
          updatedAt: now,
        },
      ],
      contentStatus: 'SCRIPTING',
    },
    4: {
      tasks: [
        { ...base, title: 'Schedule script approval call with client', priority: 'HIGH', deadline: inTwoDaysISO },
        { ...base, title: 'Script team presents scripts to client', priority: 'HIGH', deadline: inTwoDaysISO },
        { ...base, title: 'Collect client feedback & apply revisions if needed', priority: 'HIGH', deadline: nextWeekISO },
        { ...base, title: '🔒 Obtain final client script approval (HARD GATE)', priority: 'URGENT', deadline: nextWeekISO },
      ],
      events: [
        {
          title: 'Script approval call — client review',
          type: 'REVIEW',
          startTime: inTwoDays.toISOString(),
          endTime: new Date(inTwoDays.getTime() + 90 * 60 * 1000).toISOString(),
          ownerId: userId,
          projectId,
          createdAt: now,
          updatedAt: now,
        },
      ],
      contentStatus: 'REVIEW',
    },
    5: {
      tasks: [
        { ...base, title: 'Confirm CLIENT availability for shoot', priority: 'URGENT', deadline: inTwoDaysISO },
        { ...base, title: 'Confirm STUDIO availability for shoot', priority: 'URGENT', deadline: inTwoDaysISO },
        { ...base, title: 'Confirm TEAM availability for shoot', priority: 'URGENT', deadline: inTwoDaysISO },
      ],
      events: [
        {
          title: 'Shoot day',
          type: 'SHOOT',
          startTime: inFiveDays.toISOString(),
          endTime: new Date(inFiveDays.getTime() + 4 * 60 * 60 * 1000).toISOString(),
          ownerId: userId,
          projectId,
          createdAt: now,
          updatedAt: now,
        },
      ],
    },
    6: {
      tasks: [
        { ...base, title: 'Execute & monitor shoot', priority: 'URGENT', deadline: inTwoDaysISO },
        { ...base, title: 'Verify approved clips & specific shots on-set', priority: 'HIGH', deadline: inTwoDaysISO },
        { ...base, title: 'Log final selected clip numbers', priority: 'HIGH', deadline: inTwoDaysISO },
        { ...base, title: 'Share clip handling + contact details with Cameraman', priority: 'HIGH', deadline: inTwoDaysISO },
        { ...base, title: 'Hand off footage to Data Handler', priority: 'HIGH', deadline: inTwoDaysISO },
      ],
      events: [],
      contentStatus: 'SHOOTING',
    },
    7: {
      tasks: [
        { ...base, title: 'Ingest: collect raw clips from cameraman', priority: 'HIGH', deadline: inTwoDaysISO },
        { ...base, title: 'Cloud sync: upload to Google Drive & share access', priority: 'HIGH', deadline: inTwoDaysISO },
        { ...base, title: 'Resource: assign editing schedule', priority: 'MEDIUM', deadline: inTwoDaysISO },
        { ...base, title: 'Monitor: track editing progress', priority: 'MEDIUM', deadline: nextWeekISO },
        { ...base, title: 'Deploy: finalise posting schedule', priority: 'MEDIUM', deadline: nextWeekISO },
        { ...base, title: 'Analyse: prepare performance report for client', priority: 'MEDIUM', deadline: nextWeekISO },
      ],
      events: [],
      contentStatus: 'EDITING',
    },
  }

  return blueprints[level] ?? null
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['ADMIN', 'MANAGER'].includes(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json().catch(() => null)
  const { level, projectId, assignedToId } = body ?? {}

  if (!level || !projectId) {
    return NextResponse.json({ error: 'level and projectId are required' }, { status: 400 })
  }

  const lvl = parseInt(level, 10)
  if (lvl < 1 || lvl > 7) {
    return NextResponse.json({ error: 'level must be 1–7' }, { status: 400 })
  }

  // Verify project exists
  const rawProject = await sbFindOne('projects', { select: PROJECT_SELECT, filters: { id: `eq.${projectId}` } })
  if (!rawProject) return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  const project = normalizeProject(rawProject)

  const now = nowTs()
  const blueprint = getBlueprint(lvl, projectId, user.id, now)
  if (!blueprint) return NextResponse.json({ error: 'Invalid level' }, { status: 400 })

  // Create tasks
  const createdTasks: any[] = []
  for (const task of blueprint.tasks) {
    try {
      const created = await sbInsert('tasks', {
        ...task,
        assignedToId: assignedToId || null,
      })
      createdTasks.push(created)
    } catch (e) {
      console.error('Failed to create SOP task:', e)
    }
  }

  // Create events
  const createdEvents: any[] = []
  for (const event of blueprint.events) {
    try {
      const created = await sbInsert('events', event)
      createdEvents.push(created)
    } catch (e) {
      console.error('Failed to create SOP event:', e)
    }
  }

  // Update project's sopLevel
  await sbUpdate('projects', { id: `eq.${projectId}` }, {
    sopLevel: lvl,
    updatedAt: now,
  })

  // Update content status if applicable
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
    level: lvl,
    project: project.name,
    created: {
      tasks: createdTasks.length,
      events: createdEvents.length,
    },
    summary: `L${lvl} SOP activated for "${project.name}" — ${createdTasks.length} tasks + ${createdEvents.length} event(s) created.`,
  })
}
