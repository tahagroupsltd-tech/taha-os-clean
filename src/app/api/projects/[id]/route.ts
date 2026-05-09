// src/app/api/projects/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'
import { ProjectStatus } from '@prisma/client'
import { notify } from '@/lib/notify'
import { canManageProjects } from '@/lib/permissions'

// GET /api/projects/:id  → project detail with tasks + content
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const project = await db.project.findUnique({
    where: { id: params.id },
    include: {
      client: { select: { id: true, name: true, username: true } },
      tasks: {
        include: {
          assignedTo: { select: { id: true, name: true } },
        },
        orderBy: [{ priority: 'desc' }, { deadline: 'asc' }, { createdAt: 'desc' }],
      },
      content: {
        include: {
          assignee: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
      },
      _count: { select: { tasks: true, content: true } },
    },
  })
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Clients can only view their own projects
  if (user.role === 'CLIENT' && project.clientId !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  return NextResponse.json({ data: project })
}

// PATCH /api/projects/:id  (admin only)
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canManageProjects(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const before = await db.project.findUnique({ where: { id: params.id } })
  if (!before) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()
  const data: Record<string, any> = {}
  if (body.name !== undefined) data.name = body.name
  if (body.description !== undefined) data.description = body.description || null
  if (body.status !== undefined) data.status = body.status as ProjectStatus
  if (body.clientId !== undefined) data.clientId = body.clientId || null
  if (body.startDate !== undefined)
    data.startDate = body.startDate ? new Date(body.startDate) : null
  if (body.dueDate !== undefined)
    data.dueDate = body.dueDate ? new Date(body.dueDate) : null
  if (body.driveFolder !== undefined)
    data.driveFolder = body.driveFolder || null

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  }

  const updated = await db.project.update({
    where: { id: params.id },
    data,
    include: {
      client: { select: { id: true, name: true } },
      _count: { select: { tasks: true, content: true } },
    },
  })

  // Notify newly-assigned client
  if (
    body.clientId !== undefined &&
    body.clientId !== before.clientId &&
    body.clientId &&
    body.clientId !== user.id
  ) {
    await notify({
      userId: body.clientId,
      type: 'PROJECT_ASSIGNED',
      title: `New project: ${updated.name}`,
      message: `${user.name} assigned this project to you.`,
      link: '/clients',
    })
  }

  // Notify existing client about meaningful updates
  if (updated.clientId && updated.clientId !== user.id && updated.clientId === before.clientId) {
    if (body.status !== undefined && body.status !== before.status) {
      await notify({
        userId: updated.clientId,
        type: 'PROJECT_UPDATED',
        title: `Project updated: ${updated.name}`,
        message: `Status changed to ${body.status.toLowerCase()}.`,
        link: '/clients',
      })
    }
  }

  return NextResponse.json({ data: updated })
}

// DELETE /api/projects/:id  (admin only)
// ?force=true to delete even with linked records (cascade);
// otherwise refuses if the project has tasks or content.
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canManageProjects(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const target = await db.project.findUnique({
    where: { id: params.id },
    include: { _count: { select: { tasks: true, content: true, transactions: true } } },
  })
  if (!target) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { searchParams } = new URL(req.url)
  const force = searchParams.get('force') === 'true'

  const linked =
    target._count.tasks + target._count.content + target._count.transactions

  if (linked > 0 && !force) {
    return NextResponse.json(
      {
        error:
          'Project has linked records. Use force=true to detach and delete, or remove the records first.',
        details: target._count,
      },
      { status: 409 }
    )
  }

  // Detach links so we can delete (the schema does not cascade)
  if (force && linked > 0) {
    await db.$transaction([
      db.task.updateMany({ where: { projectId: params.id }, data: { projectId: null } }),
      db.content.updateMany({ where: { projectId: params.id }, data: { projectId: null } }),
      db.transaction.updateMany({ where: { projectId: params.id }, data: { projectId: null } }),
      db.event.updateMany({ where: { projectId: params.id }, data: { projectId: null } }),
      db.note.updateMany({ where: { projectId: params.id }, data: { projectId: null } }),
    ])
  }

  await db.project.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true, message: `Deleted "${target.name}"` })
}
