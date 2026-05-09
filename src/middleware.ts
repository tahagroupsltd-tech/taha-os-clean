// src/middleware.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'

// Routes that don't require auth
const PUBLIC_PATHS = ['/login', '/api/auth/login', '/api/webhook']

// Role-based page access (settings is open to all so anyone can change their own password)
const ROLE_ACCESS: Record<string, string[]> = {
  '/team': ['ADMIN', 'EMPLOYEE'],
  '/reports': ['ADMIN', 'EMPLOYEE'],
  '/billing': ['ADMIN'],
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Allow public paths and static assets
  if (
    PUBLIC_PATHS.some((p) => pathname.startsWith(p)) ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon')
  ) {
    return NextResponse.next()
  }

  // Verify session
  const user = await getUserFromRequest(request)

  if (!user) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('from', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Role-based access check
  for (const [path, roles] of Object.entries(ROLE_ACCESS)) {
    if (pathname.startsWith(path) && !roles.includes(user.role)) {
      return NextResponse.redirect(new URL('/overview', request.url))
    }
  }

  // Client role: restrict to /overview, /clients, /settings (for password change)
  if (user.role === 'CLIENT') {
    const allowedForClient = ['/overview', '/clients', '/settings']
    const isAllowed = allowedForClient.some((p) => pathname.startsWith(p))
    if (!isAllowed && !pathname.startsWith('/api')) {
      return NextResponse.redirect(new URL('/overview', request.url))
    }
  }

  // Inject user info into headers for server components
  const response = NextResponse.next()
  response.headers.set('x-user-id', user.id)
  response.headers.set('x-user-role', user.role)
  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
