// src/app/api/gcal/settings/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { sbUpdate } from '@/lib/supa'

export const dynamic = 'force-dynamic'

export async function PATCH(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const raw = body.reminderMins

  const reminderMins: number | null =
    raw === null || raw === undefined || raw === ''
      ? null
      : Math.max(0, Math.round(Number(raw))) || null

  await sbUpdate('users', { id: `eq.${user.id}` }, { calendarReminderMins: reminderMins })

  return NextResponse.json({ message: 'Reminder preference saved', calendarReminderMins: reminderMins })
}
