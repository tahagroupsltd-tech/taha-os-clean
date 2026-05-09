// src/app/api/auth/register/route.ts
import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'
import { Role } from '@prisma/client'
import { canCreateUsers, canAssignRole } from '@/lib/permissions'

export async function POST(req: NextRequest) {
  try {
    const requestingUser = await getUserFromRequest(req)
    if (!requestingUser || !canCreateUsers(requestingUser.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const { username, name, phone, password, role } = body as {
      username: string
      name: string
      phone?: string
      password: string
      role: Role
    }

    if (!username || !name || !password || !role) {
      return NextResponse.json(
        { error: 'username, name, password, and role are required' },
        { status: 400 }
      )
    }

    // Managers cannot create ADMIN accounts
    if (!canAssignRole(requestingUser.role, role)) {
      return NextResponse.json(
        { error: 'You are not allowed to assign that role' },
        { status: 403 }
      )
    }

    const existing = await db.user.findFirst({
      where: {
        OR: [
          { username: username.toLowerCase().trim() },
          ...(phone ? [{ phone: phone.trim() }] : []),
        ],
      },
    })

    if (existing) {
      return NextResponse.json(
        { error: 'Username or phone already in use' },
        { status: 409 }
      )
    }

    const hashed = await bcrypt.hash(password, 10)

    const user = await db.user.create({
      data: {
        username: username.toLowerCase().trim(),
        name: name.trim(),
        phone: phone?.trim() || null,
        password: hashed,
        role,
      },
      select: {
        id: true,
        username: true,
        name: true,
        role: true,
        phone: true,
        isActive: true,
        createdAt: true,
      },
    })

    return NextResponse.json({ data: user }, { status: 201 })
  } catch (err) {
    console.error('[REGISTER]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
