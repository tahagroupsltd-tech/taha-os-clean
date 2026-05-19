// src/app/api/sop/progress/route.ts
// GET  /api/sop/progress?projectId=xxx  → returns all completed steps for a project
// POST /api/sop/progress                → { projectId, level, stepKey, completed: bool }
import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { sbSelect, sbInsert, sbDelete, sbUpdate, nowTs } from '@/lib/supa'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const projectId = searchParams.get('projectId')
  if (!projectId) return NextResponse.json({ error: 'projectId required' }, { status: 400 })

  const rows = await sbSelect('sop_progress', {
    filters: { projectId: `eq.${projectId}` },
  })

  return NextResponse.json({ data: rows })
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (user.role === 'CLIENT') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { projectId, level, stepKey, completed } = body

  if (!projectId || !level || !stepKey) {
    return NextResponse.json({ error: 'projectId, level, stepKey required' }, { status: 400 })
  }

  if (completed) {
    // Upsert — insert if not exists (unique constraint handles duplicates)
    try {
      await sbInsert('sop_progress', {
        projectId,
        level,
        stepKey,
        completedAt: nowTs(),
        completedById: user.id,
      })
    } catch {
      // Already exists — that's fine
    }
  } else {
    // Delete the row to mark as uncompleted
    const rows = await sbSelect('sop_progress', {
      filters: { projectId: `eq.${projectId}`, level: `eq.${level}`, stepKey: `eq.${stepKey}` },
    })
    if (rows[0]) {
      await sbDelete('sop_progress', { id: `eq.${rows[0].id}` })
    }
  }

  // After toggling, check if all steps in this level are now done → update project sopLevel
  const allStepsForLevel = STEP_KEYS[level as keyof typeof STEP_KEYS] ?? []
  const doneRows = await sbSelect('sop_progress', {
    filters: { projectId: `eq.${projectId}`, level: `eq.${level}` },
  })

  const doneKeys = new Set(doneRows.map((r: any) => r.stepKey))
  const levelComplete = allStepsForLevel.every((k: string) => doneKeys.has(k))

  if (levelComplete) {
    await sbUpdate('projects', { id: `eq.${projectId}` }, { sopLevel: level, updatedAt: nowTs() })
  }

  return NextResponse.json({ ok: true, levelComplete })
}

// Step keys for each level (used to determine level completion)
const STEP_KEYS = {
  1: ['quotation', 'mou', 'payment', 'requirement', 'onboarding', 'brand_details'],
  2: ['assign_team', 'welcome_client', 'brief_script_head'],
  3: ['alignment_call', 'scripts_complete'],
  4: ['schedule_approval_call', 'present_scripts', 'client_feedback', 'final_approval'],
  5: ['confirm_client', 'confirm_studio', 'confirm_team'],
  6: ['monitor_shoot', 'verify_clips', 'log_clips', 'handoff_data'],
  7: ['ingest', 'cloud_sync', 'assign_editing', 'monitor_editing', 'posting_schedule', 'performance_report'],
}
