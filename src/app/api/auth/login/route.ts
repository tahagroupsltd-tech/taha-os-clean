// src/app/api/auth/login/route.ts
import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'
import { signToken, getSessionCookieOptions } from '@/lib/auth'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { identifier, password } = body as {
      identifier: string
      password: string
    }

    if (!identifier || !password) {
      return NextResponse.json(
        { error: 'Username/phone and password are required' },
        { status: 400 }
      )
    }

    // Find user by username OR phone
    const user = await db.user.findFirst({
      where: {
        OR: [
          { username: identifier.toLowerCase().trim() },
          { phone: identifier.trim() },
        ],
        isActive: true,
      },
    })

    if (!user) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      )
    }

    // Verify password
    const valid = await bcrypt.compare(password, user.password)
    if (!valid) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      )
    }

    // Sign JWT
    const token = await signToken({
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role as any,
      phone: user.phone,
    })

    // Set cookie
    const cookieOpts = getSessionCookieOptions()
    const response = NextResponse.json({
      data: {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
        phone: user.phone,
      },
      message: 'Login successful',
    })

    response.cookies.set(cookieOpts.name, token, cookieOpts)
    return response
  } catch (err) {
    console.error('[LOGIN]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
