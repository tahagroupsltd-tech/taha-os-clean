// src/app/api/users/[id]/password/route.ts
import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { getUserFromRequest } from '@/lib/auth'
import { canResetPassword } from '@/lib/permissions'
import { sbFindOne, sbUpdate } from '@/lib/supa'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const me = await getUserFromRequest(req)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { currentPassword, newPassword } = await req.json().catch(() => ({}))

  if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 6) {
    return NextResponse.json({ error: 'New password must be at least 6 characters' }, { status: 400 })
  }

  const targetId = params.id
  const isSelf = targetId === me.id

  const target = await sbFindOne('users', {
    select: 'id,password,username,name,role',
    filters: { id: `eq.${targetId}` },
  })
  if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  if (!isSelf && !canResetPassword(me.role, target.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (isSelf) {
    if (!currentPassword || typeof currentPassword !== 'string') {
      return NextResponse.json({ error: 'Current password is required' }, { status: 400 })
    }
    const ok = await bcrypt.compare(currentPassword, target.password)
    if (!ok) {
      return NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 })
    }
  }

  const hash = await bcrypt.hash(newPassword, 10)
  await sbUpdate('users', { id: `eq.${targetId}` }, { password: hash })

  return NextResponse.json({
    ok: true,
    message: isSelf ? 'Password updated' : `Password reset for ${target.name}`,
  })
}
