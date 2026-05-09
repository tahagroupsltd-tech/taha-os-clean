// src/app/api/users/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'
import { Role } from '@prisma/client'
import {
  canEditUser,
  canDeleteUser,
  canAssignRole,
  canViewTeam,
} from '@/lib/permissions'

const ROLE_VALUES: Role[] = ['ADMIN', 'MANAGER', 'EMPLOYEE', 'CLIENT']

// ── GET single user (admin/manager or self) ─────────────────
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const me = await getUserFromRequest(req)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (me.id !== params.id && !canViewTeam(me.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const user = await db.user.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      username: true,
      name: true,
      phone: true,
      role: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    },
  })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })
  return NextResponse.json({ data: user })
}

// ── PATCH edit user (admin/manager subject to role rules) ───
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const me = await getUserFromRequest(req)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Look up the target so we know their current role for permission checks
  const target = await db.user.findUnique({
    where: { id: params.id },
    select: { id: true, role: true },
  })
  if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  // Self-edit is always allowed for the basic profile (handled below).
  // Otherwise, must satisfy canEditUser.
  const isSelf = params.id === me.id
  if (!isSelf && !canEditUser(me.role, target.role as Role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const { name, username, phone, role, isActive } = body as {
    name?: string
    username?: string
    phone?: string | null
    role?: Role
    isActive?: boolean
  }

  // Self-protection (lockout prevention)
  if (isSelf) {
    if (role && role !== me.role) {
      return NextResponse.json(
        { error: 'You cannot change your own role' },
        { status: 400 }
      )
    }
    if (isActive === false) {
      return NextResponse.json(
        { error: 'You cannot deactivate yourself' },
        { status: 400 }
      )
    }
  }

  if (role && !ROLE_VALUES.includes(role)) {
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
  }

  // Managers cannot promote anyone to ADMIN, and cannot demote ADMINs
  if (role && !canAssignRole(me.role, role)) {
    return NextResponse.json(
      { error: 'You are not allowed to assign that role' },
      { status: 403 }
    )
  }

  // Uniqueness check on username/phone change
  if (username || phone !== undefined) {
    const conflict = await db.user.findFirst({
      where: {
        AND: [
          { id: { not: params.id } },
          {
            OR: [
              ...(username ? [{ username: username.toLowerCase().trim() }] : []),
              ...(phone ? [{ phone: phone.trim() }] : []),
            ],
          },
        ],
      },
      select: { id: true },
    })
    if (conflict) {
      return NextResponse.json(
        { error: 'Username or phone already in use' },
        { status: 409 }
      )
    }
  }

  const data: Record<string, any> = {}
  if (name !== undefined) data.name = name.trim()
  if (username !== undefined) data.username = username.toLowerCase().trim()
  if (phone !== undefined)
    data.phone = phone === null || phone === '' ? null : phone.trim()
  if (role !== undefined) data.role = role
  if (isActive !== undefined) data.isActive = isActive

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  }

  try {
    const updated = await db.user.update({
      where: { id: params.id },
      data,
      select: {
        id: true,
        username: true,
        name: true,
        phone: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    })
    return NextResponse.json({ data: updated })
  } catch (err: any) {
    if (err.code === 'P2025') {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }
    console.error('[USER PATCH]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ── DELETE user ─────────────────────────────────────────────
// Default: soft delete (set isActive=false) — safe & reversible
// ?permanent=true: hard delete, but only if user has no related records
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const me = await getUserFromRequest(req)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (params.id === me.id) {
    return NextResponse.json(
      { error: 'You cannot delete your own account' },
      { status: 400 }
    )
  }

  const target = await db.user.findUnique({
    where: { id: params.id },
    select: { id: true, name: true, role: true },
  })
  if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  if (!canDeleteUser(me.role, target.role as Role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const permanent = searchParams.get('permanent') === 'true'

  // ── Soft delete: deactivate ───────────────────────
  if (!permanent) {
    await db.user.update({
      where: { id: params.id },
      data: { isActive: false },
    })
    return NextResponse.json({
      ok: true,
      mode: 'deactivated',
      message: `${target.name} has been deactivated and can no longer log in.`,
    })
  }

  // ── Hard delete: count relations first ────────────
  const [
    tasksAssigned,
    tasksCreated,
    projects,
    contentItems,
    contentCreated,
    events,
    notes,
    transactions,
    reports,
  ] = await Promise.all([
    db.task.count({ where: { assignedToId: params.id } }),
    db.task.count({ where: { createdById: params.id } }),
    db.project.count({ where: { clientId: params.id } }),
    db.content.count({ where: { assigneeId: params.id } }),
    db.content.count({ where: { createdById: params.id } }),
    db.event.count({ where: { ownerId: params.id } }),
    db.note.count({ where: { ownerId: params.id } }),
    db.transaction.count({ where: { ownerId: params.id } }),
    db.dailyReport.count({ where: { ownerId: params.id } }),
  ])

  const total =
    tasksAssigned +
    tasksCreated +
    projects +
    contentItems +
    contentCreated +
    events +
    notes +
    transactions +
    reports

  if (total > 0) {
    return NextResponse.json(
      {
        error:
          'Cannot permanently delete: user still has linked records. Reassign or remove them first, or use deactivate instead.',
        details: {
          tasksAssigned,
          tasksCreated,
          projects,
          contentItems,
          contentCreated,
          events,
          notes,
          transactions,
          reports,
        },
      },
      { status: 409 }
    )
  }

  await db.user.delete({ where: { id: params.id } })
  return NextResponse.json({
    ok: true,
    mode: 'deleted',
    message: `${target.name} has been permanently deleted.`,
  })
}
