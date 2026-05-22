// src/app/api/drive/files/route.ts
// GET /api/drive/files?folderId=xxx  — list files in a Drive folder
import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { listDriveFiles } from '@/lib/gdrive'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const folderId = new URL(req.url).searchParams.get('folderId')
  if (!folderId) return NextResponse.json({ error: 'folderId required' }, { status: 400 })

  try {
    const files = await listDriveFiles(user.id, folderId)
    return NextResponse.json({ data: files })
  } catch (err: any) {
    const msg: string = err?.message ?? ''
    if (msg === 'NO_TOKEN') {
      return NextResponse.json({ error: 'NO_TOKEN' }, { status: 403 })
    }
    // Drive scope not granted yet (403 from Google)
    if (msg.includes('insufficientPermissions') || msg.includes('Access Not Configured')) {
      return NextResponse.json({ error: 'NO_DRIVE_SCOPE' }, { status: 403 })
    }
    console.error('[drive/files]', err)
    return NextResponse.json({ error: err.message ?? 'Failed to list files' }, { status: 500 })
  }
}
