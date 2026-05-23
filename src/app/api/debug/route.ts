// Debug route — confirms Supabase REST API connectivity
// SECURITY: Restricted to ADMIN role only. Was previously unauthenticated.
import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { sbCount } from '@/lib/supa'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  // Auth guard — only the founder/admin should see server internals
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const info: Record<string, any> = {
    timestamp: new Date().toISOString(),
    JWT_SECRET_SET: !!process.env.JWT_SECRET,
    SUPABASE_ANON_KEY_FROM_ENV: !!process.env.SUPABASE_ANON_KEY,
    OPENAI_KEY_SET: !!process.env.OPENAI_API_KEY,
    WEBHOOK_SECRET_SET: !!process.env.WEBHOOK_SECRET,
    NODE_ENV: process.env.NODE_ENV,
    db_type: 'Supabase REST API (PostgREST)',
  }

  try {
    const count = await sbCount('users', {})
    info.db_connected = true
    info.user_count = count
  } catch (e: any) {
    info.db_connected = false
    info.db_error = e?.message?.slice(0, 200)
  }

  return NextResponse.json(info)
}
