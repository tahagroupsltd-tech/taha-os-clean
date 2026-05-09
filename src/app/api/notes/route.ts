// src/app/api/notes/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const search = searchParams.get('q')?.trim()
  const tag = searchParams.get('tag')

  const where: any = { ownerId: user.id }
  if (search) {
    where.OR = [
      { title: { contains: search, mode: 'insensitive' } },
      { content: { contains: search, mode: 'insensitive' } },
    ]
  }
  if (tag) where.tags = { has: tag }

  const notes = await db.note.findMany({
    where,
    include: { project: { select: { id: true, name: true } } },
    orderBy: [{ pinned: 'desc' }, { updatedAt: 'desc' }],
  })

  return NextResponse.json({ data: notes })
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { title, content, icon, pinned, tags, projectId } = body as {
    title: string
    content?: string
    icon?: string
    pinned?: boolean
    tags?: string[]
    projectId?: string
  }

  if (!title?.trim()) {
    return NextResponse.json({ error: 'Title is required' }, { status: 400 })
  }

  const note = await db.note.create({
    data: {
      title: title.trim(),
      content: content ?? '',
      icon: icon ?? '📝',
      pinned: pinned ?? false,
      tags: tags ?? [],
      ownerId: user.id,
      projectId: projectId || null,
    },
    include: { project: { select: { id: true, name: true } } },
  })
  return NextResponse.json({ data: note }, { status: 201 })
}
