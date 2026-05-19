// src/app/api/reports/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { sbSelect, sbFindOne, sbInsert, sbUpdate, nowTs } from '@/lib/supa'

export const dynamic = 'force-dynamic'

function dayOf(d: Date) {
  const out = new Date(d)
  out.setUTCHours(0, 0, 0, 0)
  return out
}

const REPORT_SELECT = '*,owner:users!ownerId(id,name,username,role)'

export async function GET(req: NextRequest) {
  const me = await getUserFromRequest(req)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const dateStr = searchParams.get('date')
  const userIdQ = searchParams.get('userId')
  const wantStatus = searchParams.get('status') === 'today'

  const canSeeAllReports = me.role === 'ADMIN' || me.role === 'MANAGER'

  // Special "today's submission status" view
  if (wantStatus && canSeeAllReports) {
    const today = dayOf(new Date()).toISOString()

    const [users, reportsToday] = await Promise.all([
      sbSelect('users', {
        select: 'id,name,username,role',
        filters: { isActive: 'eq.true' },
        order: 'name.asc',
      }),
      sbSelect('daily_reports', {
        select: 'ownerId,summary,hoursWorked,createdAt',
        filters: { date: `eq.${today}` },
      }),
    ])

    const staffUsers = users.filter((u: any) => ['ADMIN', 'MANAGER', 'EMPLOYEE'].includes(u.role))
    const submitted = new Map(reportsToday.map((r: any) => [r.ownerId, r]))

    return NextResponse.json({
      data: staffUsers.map((u: any) => ({
        ...u,
        submitted: submitted.has(u.id),
        report: submitted.get(u.id) ?? null,
      })),
    })
  }

  const filters: Record<string, string> = {}
  if (!canSeeAllReports) filters.ownerId = `eq.${me.id}`
  else if (userIdQ) filters.ownerId = `eq.${userIdQ}`
  if (dateStr) filters.date = `eq.${new Date(dateStr + 'T00:00:00Z').toISOString()}`

  const reports = await sbSelect('daily_reports', {
    select: REPORT_SELECT,
    filters,
    order: 'date.desc,createdAt.desc',
  })

  return NextResponse.json({ data: reports.slice(0, 100) })
}

export async function POST(req: NextRequest) {
  const me = await getUserFromRequest(req)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { summary, hoursWorked, blockers, date } = body

  if (!summary || typeof summary !== 'string' || !summary.trim()) {
    return NextResponse.json({ error: 'Summary is required' }, { status: 400 })
  }

  const target = dayOf(date ? new Date(date) : new Date()).toISOString()

  // Upsert: check if report exists for this user+date
  const existing = await sbFindOne('daily_reports', {
    filters: { ownerId: `eq.${me.id}`, date: `eq.${target}` },
  })

  const now = nowTs()
  const reportData = {
    summary: summary.trim(),
    hoursWorked: typeof hoursWorked === 'number' ? hoursWorked : null,
    blockers: blockers?.trim() || null,
    updatedAt: now,
  }

  let report: any
  if (existing) {
    await sbUpdate('daily_reports', { id: `eq.${existing.id}` }, reportData)
    report = await sbFindOne('daily_reports', { filters: { id: `eq.${existing.id}` } })
  } else {
    report = await sbInsert('daily_reports', {
      ownerId: me.id,
      date: target,
      ...reportData,
      createdAt: now,
    })
  }

  return NextResponse.json({ data: report })
}
