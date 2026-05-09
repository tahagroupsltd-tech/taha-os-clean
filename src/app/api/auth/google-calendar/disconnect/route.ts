// src/app/api/auth/google-calendar/disconnect/route.ts
// Revokes OAuth tokens and removes them from the DB for the current user.
import { NextResponse } from 'next/server'
import { getServerUser } from '@/lib/auth'
import { revokeGoogleAccess } from '@/lib/gcal'

export async function DELETE() {
  const user = await getServerUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await revokeGoogleAccess(user.id)
  return NextResponse.json({ message: 'Google Calendar disconnected' })
}
