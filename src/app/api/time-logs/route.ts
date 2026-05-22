// src/app/api/time-logs/route.ts
// GET  /api/time-logs?taskId=  — list logs for a task (with user name)
// POST /api/time-logs          — create a manual log entry
import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { sbSelect, sbInsert, nowTs } from '@/lib/supa'

export const dynamic = 'force-dynamic'

const LOG_SELECT = '*,user:users!user_id(id,name)'

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const taskId = searchParams.get('taskId')
  const projectId = searchParams.get('projectId')

  if (!taskId && !projectId)
    return NextResponse.json({ error: 'taskId or projectId required' }, { status: 400 })

  const filters: Record<string, string> = {}
  if (taskId) filters.task_id = `eq.${taskId}`

  let rows = await sbSelect('time_logs', {
    select: LOG_SELECT,
    filters,
    order: 'created_at.desc',
  })

  // If projectId, fetch all task ids for that project first then filter
  if (projectId && !taskId) {
    const tasks = await sbSelect('tasks', {
      select: 'id',
      filters: { projectId: `eq.${projectId}` },
    })
    const taskIds = new Set(tasks.map((t: any) => t.id))
    rows = await sbSelect('time_logs', {
      select: LOG_SELECT,
      order: 'created_at.desc',
    })
    rows = rows.filter((r: any) => taskIds.has(r.task_id))
  }

  const totalMinutes = rows.reduce((s: number, r: any) => s + (r.minutes ?? 0), 0)
  return NextResponse.json({ data: rows, totalMinutes })
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { taskId, minutes, note, startedAt, endedAt } = body

  if (!taskId) return NextResponse.json({ error: 'taskId required' }, { status: 400 })
  if (!minutes || minutes <= 0)
    return NextResponse.json({ error: 'minutes must be > 0' }, { status: 400 })

  const now = nowTs()
  const row = await sbInsert('time_logs', {
    task_id: taskId,
    user_id: user.id,
    started_at: startedAt ?? now,
    ended_at: endedAt ?? null,
    minutes: Math.round(minutes),
    note: note || null,
    created_at: now,
  })

  return NextResponse.json({ data: row }, { status: 201 })
}
