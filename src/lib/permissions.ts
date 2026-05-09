// src/lib/permissions.ts
// Centralised role-based capability checks. Use these everywhere instead of
// inline `user.role === 'ADMIN'` so the rules stay consistent.
//
// Role hierarchy:
//   ADMIN    – Founder. Full access including finance, password resets for any user,
//              promoting users to admin/manager.
//   MANAGER  – Team lead. Manages team, projects, tasks, content. Can add users
//              and reset their passwords. CANNOT see finance, edit admins, or
//              promote anyone to admin.
//   EMPLOYEE – Works on assigned tasks/content. Status updates only on assigned items.
//   CLIENT   – Sees only their own projects, content, and notifications.

import type { Role } from '@/types'

// ── Team management ─────────────────────────────────────────
/** Can list / view team members. */
export const canViewTeam = (r: Role) => r === 'ADMIN' || r === 'MANAGER'

/** Can create new users. Managers cannot create ADMINs. */
export const canCreateUsers = (r: Role) => r === 'ADMIN' || r === 'MANAGER'

/** Can edit a user's profile (name, username, phone, role, isActive). */
export const canEditUser = (actor: Role, target: Role): boolean => {
  if (actor === 'ADMIN') return true
  if (actor === 'MANAGER') return target !== 'ADMIN'
  return false
}

/** Can delete / deactivate a user. */
export const canDeleteUser = (actor: Role, target: Role): boolean => {
  if (actor === 'ADMIN') return true
  if (actor === 'MANAGER') return target !== 'ADMIN'
  return false
}

/** Can assign a particular role to someone. Only ADMIN can grant ADMIN. */
export const canAssignRole = (actor: Role, targetRole: Role): boolean => {
  if (actor === 'ADMIN') return true
  if (actor === 'MANAGER') return targetRole !== 'ADMIN'
  return false
}

/** Can reset a target user's password. Founder-only — managers can create users
 *  with an initial password but cannot reset passwords afterward. */
export const canResetPassword = (actor: Role, _target: Role): boolean => {
  return actor === 'ADMIN'
}

// ── Finance ─────────────────────────────────────────────────
/** Founder-only: see income/expense/transactions. */
export const canViewFinance = (r: Role) => r === 'ADMIN'
/** Founder-only: create/edit/delete transactions. */
export const canEditFinance = (r: Role) => r === 'ADMIN'

// ── Projects ────────────────────────────────────────────────
export const canManageProjects = (r: Role) => r === 'ADMIN' || r === 'MANAGER'

// ── Tasks ───────────────────────────────────────────────────
/** Can create new tasks (i.e. assign work). */
export const canCreateTasks = (r: Role) =>
  r === 'ADMIN' || r === 'MANAGER' || r === 'EMPLOYEE'
/** Can fully edit any task (title, description, assignee, etc.). */
export const canFullyEditTasks = (r: Role) => r === 'ADMIN' || r === 'MANAGER'
/** Can delete tasks. */
export const canDeleteTasks = (r: Role) => r === 'ADMIN' || r === 'MANAGER'

// ── Content ─────────────────────────────────────────────────
export const canCreateContent = (r: Role) =>
  r === 'ADMIN' || r === 'MANAGER' || r === 'EMPLOYEE'
export const canFullyEditContent = (r: Role) => r === 'ADMIN' || r === 'MANAGER'
export const canDeleteContent = (r: Role) => r === 'ADMIN' || r === 'MANAGER'

// ── Settings / system ───────────────────────────────────────
/** Can see system-wide statistics on the settings page. */
export const canViewSystemStats = (r: Role) => r === 'ADMIN' || r === 'MANAGER'

// ── Display helpers ─────────────────────────────────────────
export const ROLE_LABEL: Record<Role, string> = {
  ADMIN: 'Founder',
  MANAGER: 'Manager',
  EMPLOYEE: 'Employee',
  CLIENT: 'Client',
}
