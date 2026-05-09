// src/app/api/reports/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'

// Truncate to start-of-day in UTC
function dayOf(d: Date) {
  const out = new Date(d)
  out.setUTCHours(0, 0, 0, 0)
  return out
}

// GET /api/reports?date=YYYY-MM-DD&userId=...
//  - Admin: can see all reports, optionally filter by userId or date
//  - Employee/Client: only their own reports
export async function GET(req: NextRequest) {
  const me = await getUserFromRequest(req)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const dateStr = searchParams.get('date')
  const userIdQ = searchParams.get('userId')
  const wantStatus = searchParams.get('status') === 'today'

  const isAdmin = me.role === 'ADMIN'
  const canSeeAllReports = isAdmin || me.role === 'MANAGER'

  // Special "today's submission status" view (admin + manager)
  if (wantStatus && canSeeAllReports) {
    const today = dayOf(new Date())
    // sequential to avoid Supabase pooler prepared-statement collisions
    const users = await db.user.findMany({
      where: { isActive: true, role: { in: ['ADMIN', 'MANAGER', 'EMPLOYEE'] } },
      select: { id: true, name: true, username: true, role: true },
      orderBy: { name: 'asc' },
    })
    const reportsToday = await db.dailyReport.findMany({
      where: { date: today },
      select: { ownerId: true, summary: true, hoursWorked: true, createdAt: true },
    })
    const submitted = new Map(reportsToday.map((r) => [r.ownerId, r]))
    return NextResponse.json({
      data: users.map((u) => ({
        ...u,
        submitted: submitted.has(u.id),
        report: submitted.get(u.id) ?? null,
      })),
    })
  }

  const where: any = {}
  if (!canSeeAllReports) where.ownerId = me.id
  else if (userIdQ) where.ownerId = userIdQ
  if (dateStr) where.date = new Date(dateStr + 'T00:00:00Z')

  const reports = await db.dailyReport.findMany({
    where,
    include: {
      owner: { select: { id: true, name: true, username: true, role: true } },
    },
    orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    take: 100,
  })

  return NextResponse.json({ data: reports })
}

// POST /api/reports
//  Submit today's report for the logged-in user. If a report for today
//  exists, update it (upsert).
export async function POST(req: NextRequest) {
  const me = await getUserFromRequest(req)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { summary, hoursWorked, blockers, date } = body

  if (!summary || typeof summary !== 'string' || !summary.trim()) {
    return NextResponse.json({ error: 'Summary is required' }, { status: 400 })
  }

  const target = date ? dayOf(new Date(date)) : dayOf(new Date())

  const report = await db.dailyReport.upsert({
    where: { ownerId_date: { ownerId: me.id, date: target } },
    update: {
      summary: summary.trim(),
      hoursWorked: typeof hoursWorked === 'number' ? hoursWorked : null,
      blockers: blockers?.trim() || null,
    },
    create: {
      ownerId: me.id,
      date: target,
      summary: summary.trim(),
      hoursWorked: typeof hoursWorked === 'number' ? hoursWorked : null,
      blockers: blockers?.trim() || null,
    },
  })

  return NextResponse.json({ data: report })
}
