// src/app/api/projects/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'
import { ProjectStatus } from '@prisma/client'
import { notify } from '@/lib/notify'
import { canManageProjects } from '@/lib/permissions'

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const where: any = {}
  if (user.role === 'CLIENT') where.clientId = user.id

  const projects = await db.project.findMany({
    where,
    include: {
      client: { select: { id: true, name: true } },
      _count: { select: { tasks: true, content: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({ data: projects })
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canManageProjects(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { name, description, status, clientId, startDate, dueDate, driveFolder } = body

  if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 })

  const project = await db.project.create({
    data: {
      name,
      description,
      status: (status as ProjectStatus) ?? 'ACTIVE',
      clientId: clientId || null,
      startDate: startDate ? new Date(startDate) : null,
      dueDate: dueDate ? new Date(dueDate) : null,
      driveFolder: driveFolder || null,
    },
    include: {
      client: { select: { id: true, name: true } },
      _count: { select: { tasks: true, content: true } },
    },
  })

  // ── Notify the client when a project is created for them ──
  if (project.clientId && project.clientId !== user.id) {
    await notify({
      userId: project.clientId,
      type: 'PROJECT_ASSIGNED',
      title: `New project: ${project.name}`,
      message: `${user.name} created a new project for you${project.dueDate ? ` (due ${new Date(project.dueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })})` : ''}.`,
      link: '/clients',
    })
  }

  return NextResponse.json({ data: project }, { status: 201 })
}
