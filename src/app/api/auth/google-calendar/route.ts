// src/app/api/auth/google-calendar/route.ts
// Redirects the authenticated user to Google's OAuth consent screen.
import { NextResponse } from 'next/server'
import { getServerUser } from '@/lib/auth'
import { getGoogleAuthUrl } from '@/lib/gcal'

export async function GET() {
  const user = await getServerUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = getGoogleAuthUrl()
  return NextResponse.redirect(url)
}
