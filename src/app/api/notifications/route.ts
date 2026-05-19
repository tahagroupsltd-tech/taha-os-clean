// src/app/api/notifications/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { sbSelect, sbCount, sbDelete } from '@/lib/supa'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const unreadOnly = searchParams.get('unreadOnly') === 'true'
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '20', 10) || 20, 100)

  const filters: Record<string, string> = { userId: `eq.${user.id}` }
  if (unreadOnly) filters.read = 'eq.false'

  const [items, unreadCount] = await Promise.all([
    sbSelect('notifications', {
      filters,
      order: 'read.asc,createdAt.desc',
      limit,
    }),
    sbCount('notifications', { userId: `eq.${user.id}`, read: 'eq.false' }),
  ])

  return NextResponse.json({ data: items, unreadCount })
}

export async function DELETE(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await sbDelete('notifications', { userId: `eq.${user.id}`, read: 'eq.true' })
  return NextResponse.json({ ok: true })
}
