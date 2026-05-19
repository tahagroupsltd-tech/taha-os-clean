// src/app/api/users/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { canViewTeam } from '@/lib/permissions'
import { sbSelect } from '@/lib/supa'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canViewTeam(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const role = searchParams.get('role')

  const filters: Record<string, string> = {}
  if (role) filters.role = `eq.${role}`

  const users = await sbSelect('users', {
    select: 'id,username,name,role,phone,isActive,createdAt',
    filters,
    order: 'createdAt.desc',
  })

  return NextResponse.json({ data: users })
}
