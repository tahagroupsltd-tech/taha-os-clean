// src/app/api/auth/register/route.ts
import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { getUserFromRequest } from '@/lib/auth'
import { canCreateUsers, canAssignRole } from '@/lib/permissions'
import { sbSelect, sbInsert, nowTs } from '@/lib/supa'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const requestingUser = await getUserFromRequest(req)
    if (!requestingUser || !canCreateUsers(requestingUser.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const { username, name, phone, password, role } = body

    if (!username || !name || !password || !role) {
      return NextResponse.json(
        { error: 'username, name, password, and role are required' },
        { status: 400 }
      )
    }

    if (!canAssignRole(requestingUser.role, role)) {
      return NextResponse.json({ error: 'You are not allowed to assign that role' }, { status: 403 })
    }

    // Check uniqueness
    const existing = await sbSelect('users', {
      select: 'id,username,phone',
      filters: {},
    })
    const cleanUsername = username.toLowerCase().trim()
    const cleanPhone = phone?.trim() || null

    const conflict = existing.find((u: any) =>
      u.username === cleanUsername || (cleanPhone && u.phone === cleanPhone)
    )
    if (conflict) {
      return NextResponse.json({ error: 'Username or phone already in use' }, { status: 409 })
    }

    const hashed = await bcrypt.hash(password, 10)
    const now = nowTs()

    const user = await sbInsert('users', {
      username: cleanUsername,
      name: name.trim(),
      phone: cleanPhone,
      password: hashed,
      role,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    })

    return NextResponse.json({
      data: {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
        phone: user.phone,
        isActive: user.isActive,
        createdAt: user.createdAt,
      },
    }, { status: 201 })
  } catch (err) {
    console.error('[REGISTER]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
