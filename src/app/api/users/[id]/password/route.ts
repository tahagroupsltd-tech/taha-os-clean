// src/app/api/users/[id]/password/route.ts
import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'
import { canResetPassword } from '@/lib/permissions'
import { Role } from '@prisma/client'

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const me = await getUserFromRequest(req)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { currentPassword, newPassword } = await req.json().catch(() => ({}))

  if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 6) {
    return NextResponse.json(
      { error: 'New password must be at least 6 characters' },
      { status: 400 }
    )
  }

  const targetId = params.id
  const isSelf = targetId === me.id

  const target = await db.user.findUnique({
    where: { id: targetId },
    select: { id: true, password: true, username: true, name: true, role: true },
  })
  if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  // Permission check: self always allowed; otherwise canResetPassword
  if (!isSelf && !canResetPassword(me.role, target.role as Role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Self-change requires current password. Admin / manager reset does not.
  if (isSelf) {
    if (!currentPassword || typeof currentPassword !== 'string') {
      return NextResponse.json(
        { error: 'Current password is required' },
        { status: 400 }
      )
    }
    const ok = await bcrypt.compare(currentPassword, target.password)
    if (!ok) {
      return NextResponse.json(
        { error: 'Current password is incorrect' },
        { status: 400 }
      )
    }
  }

  const hash = await bcrypt.hash(newPassword, 10)
  await db.user.update({ where: { id: targetId }, data: { password: hash } })

  return NextResponse.json({
    ok: true,
    message: isSelf ? 'Password updated' : `Password reset for ${target.name}`,
  })
}
