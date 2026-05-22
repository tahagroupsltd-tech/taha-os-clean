// src/app/api/team/workload/route.ts
// GET /api/team/workload — per-member task load summary
import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { sbSelect } from '@/lib/supa'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (user.role !== 'ADMIN' && user.role !== 'MANAGER')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // All non-done tasks with assignee + deadline
  const tasks = await sbSelect('tasks', {
    select: 'id,status,priority,deadline,assignedToId',
    filters: { status: 'neq.DONE' },
  })

  // All active non-client users
  const users = await sbSelect('users', {
    select: 'id,name,username,role,isActive',
    filters: { isActive: 'eq.true' },
    order: 'createdAt.asc',
  })

  const now = new Date()
  const weekEnd = new Date(now)
  weekEnd.setDate(weekEnd.getDate() + 7)

  // Build per-user stats
  const workload = users
    .filter((u: any) => u.role !== 'CLIENT')
    .map((u: any) => {
      const mine = tasks.filter((t: any) => t.assignedToId === u.id)
      const openCount = mine.length
      const dueSoon = mine.filter((t: any) => {
        if (!t.deadline) return false
        const d = new Date(t.deadline)
        return d >= now && d <= weekEnd
      }).length
      const overdue = mine.filter((t: any) => {
        if (!t.deadline) return false
        return new Date(t.deadline) < now
      }).length
      const inProgress = mine.filter((t: any) => t.status === 'IN_PROGRESS').length

      return {
        id: u.id,
        name: u.name,
        username: u.username,
        role: u.role,
        openCount,
        dueSoon,
        overdue,
        inProgress,
      }
    })
    .sort((a: any, b: any) => b.openCount - a.openCount)

  return NextResponse.json({ data: workload })
}
