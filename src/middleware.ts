// src/middleware.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'

// Routes that don't require auth
const PUBLIC_PATHS = ['/login', '/api/auth/login', '/api/webhook', '/api/debug']

// Role-based page access (settings is open to all so anyone can change their own password)
const ROLE_ACCESS: Record<string, string[]> = {
  '/team': ['ADMIN', 'MANAGER'],
  '/reports': ['ADMIN', 'MANAGER', 'EMPLOYEE'],
  '/billing': ['ADMIN'],
  '/crm': ['ADMIN', 'MANAGER'],
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
    if (pathname.startsWith(path)) {
      const effectiveRole = ['EDITOR', 'SCRIPTWRITER', 'GRAPHIC_DESIGNER', 'WEB_DESIGNER'].includes(user.role)
        ? 'EMPLOYEE'
        : user.role
      if (!roles.includes(effectiveRole)) {
        return NextResponse.redirect(new URL('/overview', request.url))
      }
    }
  }

  // Client role: restrict to /overview, /clients, /settings (for password change), /projects, /calendar
  if (user.role === 'CLIENT') {
    const allowedForClient = ['/overview', '/clients', '/settings', '/projects', '/calendar']
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
