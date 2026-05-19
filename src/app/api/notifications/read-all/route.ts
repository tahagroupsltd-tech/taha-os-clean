// src/app/api/notifications/read-all/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { sbUpdate } from '@/lib/supa'

export const dynamic = 'force-dynamic'

export async function PATCH(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await sbUpdate('notifications', { userId: `eq.${user.id}`, read: 'eq.false' }, { read: true })
  return NextResponse.json({ ok: true })
}
