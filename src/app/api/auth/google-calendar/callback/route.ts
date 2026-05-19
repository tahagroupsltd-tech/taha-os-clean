// src/app/api/auth/google-calendar/callback/route.ts
// Google redirects here after the user grants Calendar access.
// Exchanges the auth code for tokens and stores them, then redirects to Settings.
import { NextRequest, NextResponse } from 'next/server'
import { getServerUser } from '@/lib/auth'
import { exchangeCodeAndStore } from '@/lib/gcal'

export async function GET(req: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  const user = await getServerUser()
  if (!user) {
    return NextResponse.redirect(`${appUrl}/login`)
  }

  const { searchParams } = new URL(req.url)
  const code  = searchParams.get('code')
  const error = searchParams.get('error')

  if (error || !code) {
    const reason = error ?? 'no_code'
    return NextResponse.redirect(`${appUrl}/settings?gcal_error=${reason}`)
  }

  try {
    await exchangeCodeAndStore(code, user.id)
    return NextResponse.redirect(`${appUrl}/settings?gcal=connected`)
  } catch (err: any) {
    const msg = err?.message ?? 'unknown_error'
    console.error('[gcal callback] exchange failed:', msg)
    const isRevoke = msg.startsWith('NEEDS_REVOKE')
    let reason: string
    if (isRevoke) {
      reason = 'needs_revoke'
    } else {
      // Pass the raw error detail (first 80 chars) so the UI shows exactly what failed
      reason = msg.replace(/\s+/g, '_').slice(0, 80)
    }
    return NextResponse.redirect(`${appUrl}/settings?gcal_error=${encodeURIComponent(reason)}`)
  }
}
