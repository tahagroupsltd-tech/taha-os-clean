// src/app/api/gcal/settings/route.ts
// PATCH: update the calling user's calendarReminderMins preference.
// Body: { reminderMins: number | null }
//   null  → disable reminders
//   0     → disable reminders
//   > 0   → popup N minutes before the event
import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { db } from '@/lib/db'

export async function PATCH(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const raw = body.reminderMins

  // Accepts null (disable), or a positive integer
  const reminderMins: number | null =
    raw === null || raw === undefined || raw === ''
      ? null
      : Math.max(0, Math.round(Number(raw))) || null

  await db.user.update({
    where: { id: user.id },
    data: { calendarReminderMins: reminderMins },
  })

  return NextResponse.json({ message: 'Reminder preference saved', calendarReminderMins: reminderMins })
}
