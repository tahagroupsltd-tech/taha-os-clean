// src/app/api/auth/me/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { sbFindOne, sbUpdate, nowTs } from '@/lib/supa'

// Returns the current authenticated user from the session cookie.
// Used by client components that need the logged-in user's id/role/name/availability
export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const row = await sbFindOne('users', {
    select: 'id,username,name,role,phone,email,availabilityStatus',
    filters: { id: `eq.${user.id}` },
  }).catch(() => null)

  return NextResponse.json({
    data: {
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
      phone: row?.phone ?? user.phone ?? null,
      email: row?.email ?? user.email ?? null,
      availabilityStatus: row?.availabilityStatus ?? 'AVAILABLE',
    },
  })
}

// Allows any team member or admin to quickly toggle their live availability status
export async function PATCH(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { availabilityStatus } = body

  const validStatuses = ['AVAILABLE', 'ON_SHOOT', 'ON_LEAVE']
  if (!validStatuses.includes(availabilityStatus)) {
    return NextResponse.json({ error: 'Invalid availability status' }, { status: 400 })
  }

  await sbUpdate('users', { id: `eq.${user.id}` }, {
    availabilityStatus,
    updatedAt: nowTs(),
  })

  return NextResponse.json({
    data: {
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
      availabilityStatus,
    },
  })
}
