// middleware.ts
// Next.js Edge Middleware — protects all dashboard routes at the network edge
// BEFORE any page or API handler runs. This is the first line of defence.
//
// Without this file, route protection only happened client-side (in the browser)
// which can be bypassed. This ensures unauthenticated users are redirected server-side.

import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'

const COOKIE_NAME = 'taha_session'

// Routes that don't require authentication
const PUBLIC_PATHS = [
  '/login',
  '/api/auth/login',
  '/api/auth/logout',
  '/api/auth/google-calendar/callback',
  '/api/webhook',   // uses its own Bearer token auth
  '/_next',
  '/favicon.ico',
]

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname.startsWith(p))
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Allow public paths through
  if (isPublic(pathname)) return NextResponse.next()

  // Check for session cookie
  const token = req.cookies.get(COOKIE_NAME)?.value

  if (!token) {
    // API routes: return 401 JSON
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    // Page routes: redirect to login
    const loginUrl = new URL('/login', req.url)
    loginUrl.searchParams.set('next', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Verify JWT is valid (not expired, not tampered)
  try {
    const secret = new TextEncoder().encode(
      process.env.JWT_SECRET ?? 'taha-media-dev-only-secret-change-in-production-min-32-chars'
    )
    await jwtVerify(token, secret)
    return NextResponse.next()
  } catch {
    // Invalid/expired token — clear it and redirect to login
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Session expired' }, { status: 401 })
    }
    const loginUrl = new URL('/login', req.url)
    const response = NextResponse.redirect(loginUrl)
    response.cookies.delete(COOKIE_NAME)
    return response
  }
}

export const config = {
  // Run on all routes except static assets
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
