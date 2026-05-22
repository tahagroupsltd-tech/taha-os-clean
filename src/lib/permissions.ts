// src/lib/permissions.ts
// Centralised role-based capability checks. Use these everywhere instead of
// inline `user.role === 'ADMIN'` so the rules stay consistent.
//
// Role hierarchy:
//   ADMIN            – Founder. Full access including finance, password resets.
//   MANAGER          – Team lead. Manages team, projects, tasks, content.
//   EMPLOYEE         – General staff. Works on assigned tasks/content.
//   EDITOR           – Video/content editor. Same access as EMPLOYEE.
//   SCRIPTWRITER     – Script writer. Same access as EMPLOYEE.
//   GRAPHIC_DESIGNER – Graphic designer. Same access as EMPLOYEE.
//   WEB_DESIGNER     – Web designer. Same access as EMPLOYEE.
//   CLIENT           – Sees only their own projects, content, and notifications.

import type { Role } from '@/types'

// Helper: roles that get EMPLOYEE-level access
const EMPLOYEE_ROLES: Role[] = ['EMPLOYEE', 'EDITOR', 'SCRIPTWRITER', 'GRAPHIC_DESIGNER', 'WEB_DESIGNER']
const isEmployee = (r: Role) => EMPLOYEE_ROLES.includes(r)

// ── Team management ─────────────────────────────────────────
export const canViewTeam = (r: Role) => r === 'ADMIN' || r === 'MANAGER'
export const canCreateUsers = (r: Role) => r === 'ADMIN' || r === 'MANAGER'

export const canEditUser = (actor: Role, target: Role): boolean => {
  if (actor === 'ADMIN') return true
  if (actor === 'MANAGER') return target !== 'ADMIN'
  return false
}

export const canDeleteUser = (actor: Role, target: Role): boolean => {
  if (actor === 'ADMIN') return true
  if (actor === 'MANAGER') return target !== 'ADMIN'
  return false
}

export const canAssignRole = (actor: Role, targetRole: Role): boolean => {
  if (actor === 'ADMIN') return true
  if (actor === 'MANAGER') return targetRole !== 'ADMIN'
  return false
}

export const canResetPassword = (actor: Role, _target: Role): boolean => actor === 'ADMIN'

// ── Finance ─────────────────────────────────────────────────
export const canViewFinance = (r: Role) => r === 'ADMIN'
export const canEditFinance = (r: Role) => r === 'ADMIN'

// ── Projects ────────────────────────────────────────────────
export const canManageProjects = (r: Role) => r === 'ADMIN' || r === 'MANAGER'

// ── Tasks ───────────────────────────────────────────────────
export const canCreateTasks = (r: Role) => r === 'ADMIN' || r === 'MANAGER' || isEmployee(r)
export const canFullyEditTasks = (r: Role) => r === 'ADMIN' || r === 'MANAGER'
export const canDeleteTasks = (r: Role) => r === 'ADMIN' || r === 'MANAGER'

// ── Content ─────────────────────────────────────────────────
export const canCreateContent = (r: Role) => r === 'ADMIN' || r === 'MANAGER' || isEmployee(r)
export const canFullyEditContent = (r: Role) => r === 'ADMIN' || r === 'MANAGER'
export const canDeleteContent = (r: Role) => r === 'ADMIN' || r === 'MANAGER'

// ── Settings / system ───────────────────────────────────────
export const canViewSystemStats = (r: Role) => r === 'ADMIN' || r === 'MANAGER'

// ── Display helpers ─────────────────────────────────────────
export const ROLE_LABEL: Record<Role, string> = {
  ADMIN:            'Founder',
  MANAGER:          'Manager',
  EMPLOYEE:         'Employee',
  EDITOR:           'Editor',
  SCRIPTWRITER:     'Scriptwriter',
  GRAPHIC_DESIGNER: 'Graphic Designer',
  WEB_DESIGNER:     'Web Designer',
  CLIENT:           'Client',
}
