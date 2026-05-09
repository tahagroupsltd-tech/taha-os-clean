// src/app/api/auth/me/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'

// Returns the current authenticated user from the session cookie.
// Used by client components that need the logged-in user's id/role/name
// without having to round-trip through a server component prop.
export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return NextResponse.json({
    data: {
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
    },
  })
}
