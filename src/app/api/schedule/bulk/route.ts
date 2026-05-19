// src/app/api/schedule/bulk/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { sbFindOne, sbInsertMany, nowTs } from '@/lib/supa'
import { notify } from '@/lib/notify'
import { syncContentEvents } from '@/lib/gcal'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!['ADMIN', 'MANAGER'].includes(user.role)) {
      return NextResponse.json({ error: 'Only admins and managers can bulk-schedule.' }, { status: 403 })
    }

    const body = await req.json().catch(() => null)
    if (!body) return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })

    const {
      projectId,
      assigneeId,
      contentType,
      bufferDays = 2,
      titlePrefix = '',
      postingDates,
    } = body

    if (!projectId || !assigneeId || !contentType) {
      return NextResponse.json({ error: 'projectId, assigneeId, and contentType are required' }, { status: 400 })
    }
    if (!Array.isArray(postingDates) || postingDates.length === 0) {
      return NextResponse.json({ error: 'postingDates must be a non-empty array' }, { status: 400 })
    }
    if (postingDates.length > 200) {
      return NextResponse.json({ error: 'Maximum 200 dates per batch' }, { status: 400 })
    }

    const [project, assignee] = await Promise.all([
      sbFindOne('projects', { select: 'id,name', filters: { id: `eq.${projectId}` } }),
      sbFindOne('users', { select: 'id,name', filters: { id: `eq.${assigneeId}` } }),
    ])
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    if (!assignee) return NextResponse.json({ error: 'Editor not found' }, { status: 404 })

    const prefix = (titlePrefix as string).trim() || project.name
    const bufferMs = (bufferDays as number) * 24 * 60 * 60 * 1000

    const now = nowTs()
    const items = (postingDates as string[]).map((dateStr, i) => {
      const postDate = new Date(dateStr)
      postDate.setHours(0, 0, 0, 0)
      const readyBy = new Date(postDate.getTime() - bufferMs)
      return {
        title: `${prefix} #${i + 1} — ${postDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`,
        type: contentType,
        status: 'EDITING',
        postDate: postDate.toISOString(),
        assigneeId,
        createdById: user.id,
        projectId,
        description: `Ready by: ${readyBy.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} (${bufferDays}d before posting)`,
        createdAt: now,
        updatedAt: now,
      }
    })

    const created = await sbInsertMany('content', items)

    const dateRange = (() => {
      const sorted = [...(postingDates as string[])].sort()
      const fmt = (d: string) => new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
      return sorted.length === 1
        ? fmt(sorted[0])
        : `${fmt(sorted[0])} – ${fmt(sorted[sorted.length - 1])}`
    })()

    await notify({
      userId: assigneeId,
      title: `${created.length} videos assigned — ${project.name}`,
      message: `${created.length} content items scheduled for editing (${dateRange}). Check your Content tracker.`,
      type: 'CONTENT_ASSIGNED',
      link: '/content',
    })

    // Sync to Google Calendar (fire-and-forget)
    Promise.allSettled(
      created.map((c: any) =>
        syncContentEvents(c.id, {
          title: c.title,
          postDate: new Date(c.postDate),
          assigneeId: c.assigneeId,
          createdById: c.createdById,
          projectName: project.name,
        })
      )
    ).catch(() => {})

    return NextResponse.json(
      {
        created: created.length,
        projectName: project.name,
        editorName: assignee.name,
        items: created.map((c: any) => ({
          id: c.id,
          title: c.title,
          postDate: c.postDate,
        })),
      },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (err: any) {
    console.error('[schedule/bulk] error:', err?.stack ?? err)
    return NextResponse.json({ error: err?.message ?? 'Internal server error' }, { status: 500 })
  }
}
