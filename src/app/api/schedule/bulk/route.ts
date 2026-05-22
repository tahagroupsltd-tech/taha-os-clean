// src/app/api/schedule/bulk/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { sbFindOne, sbSelect, sbInsertMany, nowTs } from '@/lib/supa'
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
      assigneeId,       // single editor mode
      assigneeIds,      // balance mode — takes precedence if present
      contentType,
      bufferDays = 2,
      titlePrefix = '',
      postingDates,
    } = body

    if (!projectId || !contentType) {
      return NextResponse.json({ error: 'projectId and contentType are required' }, { status: 400 })
    }
    if (!Array.isArray(postingDates) || postingDates.length === 0) {
      return NextResponse.json({ error: 'postingDates must be a non-empty array' }, { status: 400 })
    }
    if (postingDates.length > 200) {
      return NextResponse.json({ error: 'Maximum 200 dates per batch' }, { status: 400 })
    }

    // Resolve editor ID list (balance mode = multiple, single mode = one)
    const editorIdList: string[] = Array.isArray(assigneeIds) && assigneeIds.length > 0
      ? assigneeIds
      : (assigneeId ? [assigneeId] : [])

    if (editorIdList.length === 0) {
      return NextResponse.json({ error: 'At least one editor must be assigned' }, { status: 400 })
    }

    // Enforce minimum 1-day buffer — deadline must always be before posting date
    const safeBuffer = Math.max(1, bufferDays as number)

    const [project, editorRows] = await Promise.all([
      sbFindOne('projects', { select: 'id,name', filters: { id: `eq.${projectId}` } }),
      sbSelect('users', {
        select: 'id,name',
        filters: { id: `in.(${editorIdList.join(',')})` },
      }),
    ])
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

    const editorMap = new Map<string, string>(
      (editorRows as any[]).map((e: any) => [e.id, e.name])
    )

    // Check all editors exist
    for (const id of editorIdList) {
      if (!editorMap.has(id)) {
        return NextResponse.json({ error: `Editor not found: ${id}` }, { status: 404 })
      }
    }

    const prefix = (titlePrefix as string).trim() || project.name
    const bufferMs = safeBuffer * 24 * 60 * 60 * 1000

    const now = nowTs()
    const items = (postingDates as string[]).map((dateStr, i) => {
      const postDate = new Date(dateStr)
      postDate.setHours(0, 0, 0, 0)
      const readyBy = new Date(postDate.getTime() - bufferMs)

      // Round-robin editor assignment
      const editorId = editorIdList[i % editorIdList.length]

      return {
        title: `${prefix} #${i + 1} — ${postDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`,
        type: contentType,
        status: 'EDITING',
        postDate: postDate.toISOString(),
        assigneeId: editorId,
        createdById: user.id,
        projectId,
        description: `Deadline: ${readyBy.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} (${safeBuffer}d before posting)`,
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

    // Group created items by editor for per-editor notifications
    const itemsByEditor = new Map<string, typeof created>()
    for (const item of created as any[]) {
      const existing = itemsByEditor.get(item.assigneeId) ?? []
      existing.push(item)
      itemsByEditor.set(item.assigneeId, existing)
    }

    // Send notification to each editor with their portion
    await Promise.allSettled(
      Array.from(itemsByEditor.entries()).map(([editorId, editorItems]) => {
        const editorName = editorMap.get(editorId) ?? 'Editor'
        const count = editorItems.length
        const isBalanced = editorIdList.length > 1
        return notify({
          userId: editorId,
          title: `${count} video${count !== 1 ? 's' : ''} assigned — ${project.name}`,
          message: isBalanced
            ? `You've been assigned ${count} of ${created.length} content items for ${project.name} (${dateRange}). Check your Content tracker.`
            : `${count} content items scheduled for editing (${dateRange}). Check your Content tracker.`,
          type: 'CONTENT_ASSIGNED',
          link: '/content',
        })
      })
    )

    // Sync to Google Calendar (fire-and-forget)
    Promise.allSettled(
      (created as any[]).map((c: any) =>
        syncContentEvents(c.id, {
          title: c.title,
          postDate: new Date(c.postDate),
          assigneeId: c.assigneeId,
          createdById: c.createdById,
          projectName: project.name,
        })
      )
    ).catch(() => {})

    // Summary editor name for response
    const editorNameSummary = editorIdList.length === 1
      ? (editorMap.get(editorIdList[0]) ?? 'Editor')
      : editorIdList.map((id) => editorMap.get(id) ?? '?').join(', ')

    return NextResponse.json(
      {
        created: created.length,
        projectName: project.name,
        editorName: editorNameSummary,
        items: (created as any[]).map((c: any) => ({
          id: c.id,
          title: c.title,
          postDate: c.postDate,
          editorName: editorMap.get(c.assigneeId) ?? null,
        })),
      },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (err: any) {
    console.error('[schedule/bulk] error:', err?.stack ?? err)
    return NextResponse.json({ error: err?.message ?? 'Internal server error' }, { status: 500 })
  }
}
