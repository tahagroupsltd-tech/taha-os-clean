// src/lib/auth.ts
import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'
import { NextRequest } from 'next/server'
import type { AuthUser } from '@/types'

const jwtSecret = process.env.JWT_SECRET
// Note: warn in logs if missing but don't throw at module level (would crash middleware/Edge)
if (!jwtSecret && process.env.NODE_ENV === 'production') {
  console.error('[AUTH] WARNING: JWT_SECRET is not set in production!')
}
const SECRET = new TextEncoder().encode(
  jwtSecret ?? 'taha-media-dev-only-secret-change-in-production-min-32-chars'
)

const COOKIE_NAME = 'taha_session'
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7 // 7 days

// ── Sign a JWT ────────────────────────────────────────────
export async function signToken(payload: AuthUser): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(SECRET)
}

// ── Verify a JWT ──────────────────────────────────────────
export async function verifyToken(token: string): Promise<AuthUser | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET)
    return payload as unknown as AuthUser
  } catch (err) {
    console.error('[JWT VERIFICATION ERROR]', err)
    return null
  }
}

// ── Get current user from server-side cookies ─────────────
export async function getServerUser(): Promise<AuthUser | null> {
  const cookieStore = cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value
  if (!token) return null
  return verifyToken(token)
}

// ── Get current user from a Request object ────────────────
export async function getUserFromRequest(
  req: NextRequest
): Promise<AuthUser | null> {
  const token = req.cookies.get(COOKIE_NAME)?.value
  if (!token) return null
  return verifyToken(token)
}

// ── Cookie options ────────────────────────────────────────
export function getSessionCookieOptions() {
  return {
    name: COOKIE_NAME,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge: COOKIE_MAX_AGE,
    path: '/',
  }
}

export { COOKIE_NAME }
