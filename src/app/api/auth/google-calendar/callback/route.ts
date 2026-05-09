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
    console.error('[gcal callback]', err)
    return NextResponse.redirect(`${appUrl}/settings?gcal_error=token_exchange_failed`)
  }
}
