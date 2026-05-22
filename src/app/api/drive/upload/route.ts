// src/app/api/drive/upload/route.ts
// POST /api/drive/upload  — upload a file to a Drive folder
// Body: multipart/form-data with fields: folderId, file (binary)
import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { uploadToDrive } from '@/lib/gdrive'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const formData = await req.formData()
    const folderId = formData.get('folderId') as string | null
    const file = formData.get('file') as File | null

    if (!folderId) return NextResponse.json({ error: 'folderId required' }, { status: 400 })
    if (!file) return NextResponse.json({ error: 'file required' }, { status: 400 })

    // 50 MB limit
    if (file.size > 50 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large (max 50 MB)' }, { status: 413 })
    }

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const mimeType = file.type || 'application/octet-stream'

    const uploaded = await uploadToDrive(user.id, folderId, file.name, buffer, mimeType)
    return NextResponse.json({ data: uploaded })
  } catch (err: any) {
    const msg: string = err?.message ?? ''
    if (msg === 'NO_TOKEN') {
      return NextResponse.json({ error: 'NO_TOKEN' }, { status: 403 })
    }
    if (msg.includes('insufficientPermissions')) {
      return NextResponse.json({ error: 'NO_DRIVE_SCOPE' }, { status: 403 })
    }
    console.error('[drive/upload]', err)
    return NextResponse.json({ error: err.message ?? 'Upload failed' }, { status: 500 })
  }
}
