// src/app/api/content/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { notify, notifyMany } from '@/lib/notify'
import { canDeleteContent } from '@/lib/permissions'
import { syncContentEvents, deleteEntityCalendarEvents } from '@/lib/gcal'
import { sbFindOne, sbSelect, sbUpdate, sbDelete, CONTENT_SELECT } from '@/lib/supa'

export const dynamic = 'force-dynamic'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (user.role === 'CLIENT') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const before = await sbFindOne('content', {
    select: '*,project:projects!projectId(id,name,clientId)',
    filters: { id: `eq.${params.id}` },
  })
  if (!before) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  let body = await req.json()

  const isEmployee = user.role === 'EMPLOYEE' || ['EDITOR', 'SCRIPTWRITER', 'GRAPHIC_DESIGNER', 'WEB_DESIGNER'].includes(user.role)
  if (isEmployee) {
    if (before.assigneeId !== user.id && before.createdById !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    const patchable: Record<string, any> = {}
    let hasField = false
    if (body.status !== undefined) {
      patchable.status = body.status
      hasField = true
    }
    if (body.driveLink !== undefined) {
      patchable.driveLink = body.driveLink
      hasField = true
    }
    if (body.scriptLink !== undefined) {
      patchable.scriptLink = body.scriptLink
      hasField = true
    }
    if (!hasField) {
      return NextResponse.json({ error: 'Employees can only update status, driveLink, or scriptLink' }, { status: 403 })
    }
    body = patchable
  }

  const patch: Record<string, any> = {}
  const allowed = ['title', 'type', 'status', 'description', 'driveLink', 'scriptLink', 'scriptApproved', 'caption', 'postDate', 'assigneeId', 'projectId']
  for (const k of allowed) {
    if (body[k] !== undefined) {
      patch[k] = k === 'postDate' && body[k] ? new Date(body[k]).toISOString() : (body[k] ?? null)
    }
  }

  // If scriptApproved is newly set to true, set approved by name
  if (body.scriptApproved === true && !before.scriptApproved) {
    patch.scriptApprovedBy = user.name
  } else if (body.scriptApproved === false && before.scriptApproved) {
    patch.scriptApprovedBy = null
  }

  // Auto-calculate/update the editor deadline in description if postDate or description changes
  if (body.postDate !== undefined || body.description !== undefined) {
    const postVal = body.postDate !== undefined ? body.postDate : before.postDate
    if (postVal) {
      const post = new Date(postVal)
      const deadline = new Date(post.getTime() - 2 * 24 * 60 * 60 * 1000)
      const deadlineStr = `Deadline: ${deadline.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} (2d before posting)`
      const inputDesc = body.description !== undefined ? body.description : before.description
      const cleanedDesc = inputDesc ? inputDesc.replace(/^Deadline: \d{2} \w{3} \(\d+d before posting\)\n?/, '').trim() : ''
      patch.description = cleanedDesc ? `${deadlineStr}\n${cleanedDesc}` : deadlineStr
    } else {
      // If postDate is cleared, strip deadline prefix if present
      const inputDesc = body.description !== undefined ? body.description : before.description
      patch.description = inputDesc ? inputDesc.replace(/^Deadline: \d{2} \w{3} \(\d+d before posting\)\n?/, '').trim() : null
    }
  }

  await sbUpdate('content', { id: `eq.${params.id}` }, patch)

  const updated = await sbFindOne('content', {
    select: CONTENT_SELECT,
    filters: { id: `eq.${params.id}` },
  })

  // Reassigned
  if (body.assigneeId !== undefined && body.assigneeId !== before.assigneeId && body.assigneeId && body.assigneeId !== user.id) {
    const projectLabel = updated?.project ? ` · ${updated.project.name}` : ''
    await notify({
      userId: body.assigneeId,
      type: 'CONTENT_ASSIGNED',
      title: `Content reassigned to you: ${updated.title}`,
      message: `${user.name} reassigned this ${updated.type.toLowerCase()} to you${projectLabel}.`,
      link: '/content',
      gcalEvent: updated?.postDate ? {
        title: `✂️ Content due: ${updated.title}`,
        description: `${user.name} assigned you this content${projectLabel}.`,
        date: new Date(updated.postDate),
      } : null,
    })
  }

  // Script link updated → notify admin/managers (Script Heads)
  if (body.scriptLink !== undefined && body.scriptLink !== before.scriptLink && body.scriptLink) {
    try {
      const admins = await sbSelect('users', {
        select: 'id',
        filters: { role: 'in.(ADMIN,MANAGER)' }
      })
      const adminIds = admins.map((a: any) => a.id)
      if (adminIds.length > 0) {
        await notifyMany(adminIds, {
          type: 'SCRIPT_SUBMITTED',
          title: `📝 Script submitted: ${updated?.title || before.title}`,
          message: `${user.name} submitted a script doc for "${updated?.title || before.title}". Click to review and approve.`,
          link: '/content',
        })
      }
    } catch (e) {}
  }

  // Script approved → notify assignee/creator
  if (body.scriptApproved === true && !before.scriptApproved) {
    const recipientId = updated?.assigneeId || updated?.createdById
    if (recipientId && recipientId !== user.id) {
      await notify({
        userId: recipientId,
        type: 'SCRIPT_APPROVED',
        title: `✅ Script Approved: ${updated?.title || before.title}`,
        message: `Your script for "${updated?.title || before.title}" has been approved by ${user.name}.`,
        link: '/content',
      })
    }
  }

  // Status changed → notify client
  if (body.status !== undefined && body.status !== before.status) {
    const clientId = updated?.project?.clientId
    if (clientId && clientId !== user.id) {
      if (body.status === 'POSTED') {
        await notify({
          userId: clientId,
          type: 'CONTENT_POSTED',
          title: `Posted: ${updated.title}`,
          message: `Your ${updated.type.toLowerCase()} for ${updated.project?.name} is now live.`,
          link: '/content',
        })

        // --- 60% completion check for SOP Level 4 trigger ---
        if (updated.projectId) {
          try {
            const contentItems = await sbSelect('content', {
              select: 'id,status,type',
              filters: { projectId: `eq.${updated.projectId}` },
            })
            const videos = contentItems.filter((c: any) => c.type === 'REEL' || c.type === 'VIDEO')
            const targetList = videos.length > 0 ? videos : contentItems

            const posted = targetList.filter((c: any) => c.status === 'POSTED').length
            const total = targetList.length

            if (total > 0 && (posted / total) >= 0.60) {
              const proj = await sbFindOne('projects', {
                select: 'id,name,sopLevel',
                filters: { id: `eq.${updated.projectId}` }
              })

              if (proj && (!proj.sopLevel || proj.sopLevel < 4)) {
                const admins = await sbSelect('users', {
                  select: 'id',
                  filters: { role: 'in.(ADMIN,MANAGER)' }
                })
                const adminIds = admins.map((a: any) => a.id)

                if (adminIds.length > 0) {
                  await notifyMany(adminIds, {
                    type: 'SOP_ALERT',
                    title: `💡 60% Videos Posted: ${proj.name}`,
                    message: `${posted} of ${total} videos are posted (${Math.round((posted/total)*100)}%). Scripting team should start SOP Level 4 for the next cycle.`,
                    link: `/sop?projectId=${updated.projectId}`,
                  })
                }
              }
            }
          } catch (err) {
            console.error('[content posted trigger] failed:', err)
          }
        }
      } else if (body.status === 'REVIEW') {
        await notify({
          userId: clientId,
          type: 'CONTENT_SCHEDULED',
          title: `Ready for review: ${updated.title}`,
          message: `New ${updated.type.toLowerCase()} ready for your review on ${updated.project?.name}.`,
          link: '/content',
        })
      }
    }
  }

  // postDate newly set → notify client
  if (body.postDate !== undefined && body.postDate && !before.postDate) {
    const clientId = updated?.project?.clientId
    if (clientId && clientId !== user.id) {
      const date = new Date(body.postDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
      await notify({
        userId: clientId,
        type: 'CONTENT_SCHEDULED',
        title: `Content scheduled: ${updated.title}`,
        message: `Scheduled to post on ${date} for ${updated.project?.name}.`,
        link: '/content',
      })
    }
  }

  // Sync to Google Calendar
  const postDateChanged = body.postDate !== undefined
  const assigneeChanged = body.assigneeId !== undefined && body.assigneeId !== before.assigneeId
  if (updated?.postDate && (postDateChanged || assigneeChanged)) {
    await syncContentEvents(updated.id, {
      title: updated.title,
      postDate: new Date(updated.postDate),
      assigneeId: updated.assigneeId,
      createdById: updated.createdById,
      projectName: updated.project?.name,
    }).catch(() => {})
  }

  return NextResponse.json({ data: updated })
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canDeleteContent(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  await deleteEntityCalendarEvents('content', params.id).catch(() => {})
  await sbDelete('content', { id: `eq.${params.id}` })
  return NextResponse.json({ message: 'Deleted' })
}
