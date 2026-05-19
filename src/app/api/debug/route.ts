// Debug route — confirms Supabase REST API connectivity
import { NextResponse } from 'next/server'
import { sbCount } from '@/lib/supa'

export const dynamic = 'force-dynamic'

export async function GET() {
  const info: Record<string, any> = {
    timestamp: new Date().toISOString(),
    JWT_SECRET_SET: !!process.env.JWT_SECRET,
    NODE_ENV: process.env.NODE_ENV,
    db_type: 'Supabase REST API (PostgREST)',
  }

  try {
    const count = await sbCount('users', {})
    info.db_connected = true
    info.user_count = count
  } catch (e: any) {
    info.db_connected = false
    info.db_error = e?.message?.slice(0, 500)
  }

  return NextResponse.json(info)
}
