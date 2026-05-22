// src/app/api/time-logs/[id]/route.ts
// DELETE /api/time-logs/[id] — remove a log entry (owner or admin only)
import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { sbFindOne, sbDelete } from '@/lib/supa'

export const dynamic = 'force-dynamic'

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const log = await sbFindOne('time_logs', { filters: { id: `eq.${params.id}` } })
  if (!log) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Only the log owner or admin/manager can delete
  if (log.user_id !== user.id && user.role !== 'ADMIN' && user.role !== 'MANAGER')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  await sbDelete('time_logs', { id: `eq.${params.id}` })
  return NextResponse.json({ message: 'Deleted' })
}
