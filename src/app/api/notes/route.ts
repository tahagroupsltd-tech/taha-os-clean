// src/app/api/notes/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { sbSelect, sbInsert, sbFindOne, NOTE_SELECT, nowTs } from '@/lib/supa'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const search = searchParams.get('q')?.trim()
  const tag = searchParams.get('tag')

  const filters: Record<string, string> = { ownerId: `eq.${user.id}` }

  const notes = await sbSelect('notes', {
    select: NOTE_SELECT,
    filters,
    order: 'pinned.desc,updatedAt.desc',
  })

  // In-memory search and tag filter
  let data = notes
  if (search) {
    const q = search.toLowerCase()
    data = data.filter((n: any) =>
      n.title?.toLowerCase().includes(q) || n.content?.toLowerCase().includes(q)
    )
  }
  if (tag) {
    data = data.filter((n: any) => Array.isArray(n.tags) && n.tags.includes(tag))
  }

  return NextResponse.json({ data })
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { title, content, icon, pinned, tags, projectId } = body

  if (!title?.trim()) {
    return NextResponse.json({ error: 'Title is required' }, { status: 400 })
  }

  const now = nowTs()
  const note = await sbInsert('notes', {
    title: title.trim(),
    content: content ?? '',
    icon: icon ?? '📝',
    pinned: pinned ?? false,
    tags: tags ?? [],
    ownerId: user.id,
    projectId: projectId || null,
    createdAt: now,
    updatedAt: now,
  })

  const full = await sbFindOne('notes', {
    select: NOTE_SELECT,
    filters: { id: `eq.${note.id}` },
  }) ?? note

  return NextResponse.json({ data: full }, { status: 201 })
}
