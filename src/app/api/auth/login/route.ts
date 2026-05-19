// src/app/api/auth/login/route.ts
import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { signToken, getSessionCookieOptions } from '@/lib/auth'

// Supabase project — public anon key, safe to embed in server code
const SUPABASE_URL = 'https://zmhmxfndzrrdmvvqblkx.supabase.co'
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InptaG14Zm5kenJyZG12dnFibGt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcxMDMzMzksImV4cCI6MjA5MjY3OTMzOX0.1i4olAULwrRO7wAP1Hpwur9Jl0SxieAn7dP5BaeyY9E'

interface AuthUserRow {
  id: string
  username: string
  phone: string | null
  password: string
  role: string
  name: string
  avatar: string | null
  is_active: boolean
}

/**
 * Calls the SECURITY DEFINER RPC `get_user_for_auth` via Supabase REST (HTTPS).
 * Bypasses TCP/pooler entirely — works from Vercel IPv4 serverless with zero issues.
 */
async function findUserForAuth(identifier: string): Promise<AuthUserRow | null> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_user_for_auth`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({ p_identifier: identifier.trim() }),
  })

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`Supabase RPC error ${res.status}: ${errText}`)
  }

  const rows: AuthUserRow[] = await res.json()
  return rows.length > 0 ? rows[0] : null
}

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

    // Find user via Supabase REST API (HTTPS — no IPv4/pooler issues)
    const user = await findUserForAuth(identifier)

    if (!user) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      )
    }

    // Verify password (bcrypt comparison in Node.js)
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
