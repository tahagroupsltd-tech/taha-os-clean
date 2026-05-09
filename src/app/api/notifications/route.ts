// src/app/api/notifications/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'

// GET /api/notifications  → returns recent notifications for the logged-in user.
// Query: ?unreadOnly=true | ?limit=N
export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const unreadOnly = searchParams.get('unreadOnly') === 'true'
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '20', 10) || 20, 100)

  const where: any = { userId: user.id }
  if (unreadOnly) where.read = false

  const [items, unreadCount] = await Promise.all([
    db.notification.findMany({
      where,
      orderBy: [{ read: 'asc' }, { createdAt: 'desc' }],
      take: limit,
    }),
    db.notification.count({ where: { userId: user.id, read: false } }),
  ])

  return NextResponse.json({ data: items, unreadCount })
}

// DELETE /api/notifications  → clear all read notifications for the user
export async function DELETE(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const result = await db.notification.deleteMany({
    where: { userId: user.id, read: true },
  })

  return NextResponse.json({ ok: true, deleted: result.count })
}
