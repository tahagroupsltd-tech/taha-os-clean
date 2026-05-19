// src/app/api/users/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import {
  canEditUser, canDeleteUser, canAssignRole, canViewTeam,
} from '@/lib/permissions'
import { sbFindOne, sbSelect, sbUpdate, sbDelete, sbCount } from '@/lib/supa'

export const dynamic = 'force-dynamic'

const ROLE_VALUES = ['ADMIN', 'MANAGER', 'EMPLOYEE', 'CLIENT']

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const me = await getUserFromRequest(req)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (me.id !== params.id && !canViewTeam(me.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const user = await sbFindOne('users', {
    select: 'id,username,name,phone,role,isActive,createdAt,updatedAt',
    filters: { id: `eq.${params.id}` },
  })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })
  return NextResponse.json({ data: user })
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const me = await getUserFromRequest(req)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const target = await sbFindOne('users', {
    select: 'id,role',
    filters: { id: `eq.${params.id}` },
  })
  if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const isSelf = params.id === me.id
  if (!isSelf && !canEditUser(me.role, target.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const { name, username, phone, role, isActive } = body

  if (isSelf) {
    if (role && role !== me.role) {
      return NextResponse.json({ error: 'You cannot change your own role' }, { status: 400 })
    }
    if (isActive === false) {
      return NextResponse.json({ error: 'You cannot deactivate yourself' }, { status: 400 })
    }
  }

  if (role && !ROLE_VALUES.includes(role)) {
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
  }

  if (role && !canAssignRole(me.role, role)) {
    return NextResponse.json({ error: 'You are not allowed to assign that role' }, { status: 403 })
  }

  // Uniqueness check on username/phone
  if (username || phone !== undefined) {
    const all = await sbSelect('users', {
      select: 'id,username,phone',
      filters: {},
    })
    const conflict = all.find((u: any) =>
      u.id !== params.id && (
        (username && u.username === username.toLowerCase().trim()) ||
        (phone && u.phone === phone.trim())
      )
    )
    if (conflict) {
      return NextResponse.json({ error: 'Username or phone already in use' }, { status: 409 })
    }
  }

  const patch: Record<string, any> = {}
  if (name !== undefined) patch.name = name.trim()
  if (username !== undefined) patch.username = username.toLowerCase().trim()
  if (phone !== undefined) patch.phone = phone === null || phone === '' ? null : phone.trim()
  if (role !== undefined) patch.role = role
  if (isActive !== undefined) patch.isActive = isActive

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  }

  await sbUpdate('users', { id: `eq.${params.id}` }, patch)

  const updated = await sbFindOne('users', {
    select: 'id,username,name,phone,role,isActive,createdAt',
    filters: { id: `eq.${params.id}` },
  })

  return NextResponse.json({ data: updated })
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const me = await getUserFromRequest(req)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (params.id === me.id) {
    return NextResponse.json({ error: 'You cannot delete your own account' }, { status: 400 })
  }

  const target = await sbFindOne('users', {
    select: 'id,name,role',
    filters: { id: `eq.${params.id}` },
  })
  if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  if (!canDeleteUser(me.role, target.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const permanent = searchParams.get('permanent') === 'true'

  // Soft delete: deactivate
  if (!permanent) {
    await sbUpdate('users', { id: `eq.${params.id}` }, { isActive: false })
    return NextResponse.json({
      ok: true,
      mode: 'deactivated',
      message: `${target.name} has been deactivated and can no longer log in.`,
    })
  }

  // Hard delete: count relations first
  const [
    tasksAssigned, tasksCreated, projects,
    contentItems, contentCreated, events,
    notes, transactions,
  ] = await Promise.all([
    sbCount('tasks', { assignedToId: `eq.${params.id}` }),
    sbCount('tasks', { createdById: `eq.${params.id}` }),
    sbCount('projects', { clientId: `eq.${params.id}` }),
    sbCount('content', { assigneeId: `eq.${params.id}` }),
    sbCount('content', { createdById: `eq.${params.id}` }),
    sbCount('events', { ownerId: `eq.${params.id}` }),
    sbCount('notes', { ownerId: `eq.${params.id}` }),
    sbCount('transactions', { ownerId: `eq.${params.id}` }),
  ])

  const total = tasksAssigned + tasksCreated + projects + contentItems + contentCreated + events + notes + transactions

  if (total > 0) {
    return NextResponse.json(
      {
        error: 'Cannot permanently delete: user still has linked records. Reassign or remove them first, or deactivate instead.',
        details: { tasksAssigned, tasksCreated, projects, contentItems, contentCreated, events, notes, transactions },
      },
      { status: 409 }
    )
  }

  await sbDelete('users', { id: `eq.${params.id}` })
  return NextResponse.json({
    ok: true,
    mode: 'deleted',
    message: `${target.name} has been permanently deleted.`,
  })
}
