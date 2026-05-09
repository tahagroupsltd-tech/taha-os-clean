// src/app/api/schedule/bulk/route.ts
// Bulk-creates content items for a given client project + editor.
// Manager pastes posting dates → system generates all items with status=EDITING.
import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { db } from '@/lib/db'
import { syncContentEvents } from '@/lib/gcal'

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
      postingDates, // array of ISO date strings e.g. ["2026-05-01", "2026-05-05"]
    } = body as {
      projectId: string
      assigneeId: string
      contentType: string
      bufferDays: number
      titlePrefix: string
      postingDates: string[]
    }

    // Validate
    if (!projectId || !assigneeId || !contentType) {
      return NextResponse.json({ error: 'projectId, assigneeId, and contentType are required' }, { status: 400 })
    }
    if (!Array.isArray(postingDates) || postingDates.length === 0) {
      return NextResponse.json({ error: 'postingDates must be a non-empty array' }, { status: 400 })
    }
    if (postingDates.length > 200) {
      return NextResponse.json({ error: 'Maximum 200 dates per batch' }, { status: 400 })
    }

    // Verify project + assignee exist
    const [project, assignee] = await Promise.all([
      db.project.findUnique({ where: { id: projectId }, select: { id: true, name: true } }),
      db.user.findUnique({ where: { id: assigneeId }, select: { id: true, name: true } }),
    ])
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    if (!assignee) return NextResponse.json({ error: 'Editor not found' }, { status: 404 })

    // Build items
    const prefix = titlePrefix.trim() || project.name
    const bufferMs = bufferDays * 24 * 60 * 60 * 1000

    const items = postingDates.map((dateStr, i) => {
      const postDate = new Date(dateStr)
      postDate.setHours(0, 0, 0, 0)
      const readyBy = new Date(postDate.getTime() - bufferMs)
      return {
        title: `${prefix} #${i + 1} — ${postDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`,
        type: contentType as any,
        status: 'EDITING' as any,
        postDate,
        assigneeId,
        createdById: user.id,
        projectId,
        description: `Ready by: ${readyBy.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} (${bufferDays}d before posting)`,
      }
    })

    // Bulk insert
    const created = await db.content.createManyAndReturn({ data: items })

    // Single notification to the editor summarising the batch
    const dateRange = (() => {
      const sorted = [...postingDates].sort()
      const fmt = (d: string) => new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
      return sorted.length === 1
        ? fmt(sorted[0])
        : `${fmt(sorted[0])} – ${fmt(sorted[sorted.length - 1])}`
    })()

    await db.notification.create({
      data: {
        userId: assigneeId,
        title: `${created.length} videos assigned — ${project.name}`,
        message: `${created.length} content items scheduled for editing (${dateRange}). Check your Content tracker.`,
        type: 'CONTENT_ASSIGNED',
        link: '/content',
      },
    })

    // ── Sync all bulk-created items to Google Calendar (fire-and-forget) ──
    Promise.allSettled(
      created.map((c) =>
        syncContentEvents(c.id, {
          title: c.title,
          postDate: c.postDate,
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
        items: created.map((c) => ({
          id: c.id,
          title: c.title,
          postDate: c.postDate,
        })),
      },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (err: any) {
    console.error('[schedule/bulk] error:', err?.stack ?? err)
    return NextResponse.json(
      { error: err?.message ?? 'Internal server error' },
      { status: 500 }
    )
  }
}
