// src/lib/utils.ts
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type {
  TaskStatus, TaskPriority, ContentStatus, ProjectStatus,
  EventType, TransactionType, TransactionCategory,
} from '@/types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// ── Status label maps ─────────────────────────────────────
export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  TODO: 'To Do',
  IN_PROGRESS: 'In Progress',
  IN_REVIEW: 'In Review',
  DONE: 'Done',
}

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
  URGENT: 'Urgent',
}

export const CONTENT_STATUS_LABELS: Record<ContentStatus, string> = {
  IDEA: 'Idea',
  SCRIPTING: 'Scripting',
  SHOOTING: 'Shooting',
  EDITING: 'Editing',
  REVIEW: 'Review',
  POSTED: 'Posted',
}

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  ACTIVE: 'Active',
  PAUSED: 'Paused',
  COMPLETED: 'Completed',
  ARCHIVED: 'Archived',
}

// ── Color helpers ─────────────────────────────────────────
export function taskStatusColor(status: TaskStatus): string {
  const map: Record<TaskStatus, string> = {
    TODO: 'bg-stone-100 text-stone-600',
    IN_PROGRESS: 'bg-amber-50 text-amber-700',
    IN_REVIEW: 'bg-blue-50 text-blue-700',
    DONE: 'bg-green-50 text-green-700',
  }
  return map[status]
}

export function taskPriorityColor(priority: TaskPriority): string {
  const map: Record<TaskPriority, string> = {
    LOW: 'bg-stone-100 text-stone-500',
    MEDIUM: 'bg-blue-50 text-blue-600',
    HIGH: 'bg-orange-50 text-orange-600',
    URGENT: 'bg-red-50 text-red-600',
  }
  return map[priority]
}

export function contentStatusColor(status: ContentStatus): string {
  const map: Record<ContentStatus, string> = {
    IDEA: 'bg-stone-100 text-stone-500',
    SCRIPTING: 'bg-purple-50 text-purple-600',
    SHOOTING: 'bg-amber-50 text-amber-700',
    EDITING: 'bg-blue-50 text-blue-700',
    REVIEW: 'bg-orange-50 text-orange-600',
    POSTED: 'bg-green-50 text-green-700',
  }
  return map[status]
}

export function projectStatusColor(status: ProjectStatus): string {
  const map: Record<ProjectStatus, string> = {
    ACTIVE: 'bg-green-50 text-green-700',
    PAUSED: 'bg-amber-50 text-amber-700',
    COMPLETED: 'bg-blue-50 text-blue-700',
    ARCHIVED: 'bg-stone-100 text-stone-500',
  }
  return map[status]
}

// ── Date helpers ──────────────────────────────────────────
export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return '—'
  return new Date(date).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export function isOverdue(deadline: string | null | undefined): boolean {
  if (!deadline) return false
  return new Date(deadline) < new Date()
}

// ── Events ────────────────────────────────────────────────
export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  MEETING: 'Meeting',
  SHOOT: 'Shoot',
  DEADLINE: 'Deadline',
  REVIEW: 'Review',
  CALL: 'Call',
  OTHER: 'Other',
}

export function eventTypeColor(type: EventType): string {
  const map: Record<EventType, string> = {
    MEETING: 'bg-blue-50 text-blue-700 border-blue-200',
    SHOOT: 'bg-amber-50 text-amber-700 border-amber-200',
    DEADLINE: 'bg-red-50 text-red-700 border-red-200',
    REVIEW: 'bg-purple-50 text-purple-700 border-purple-200',
    CALL: 'bg-green-50 text-green-700 border-green-200',
    OTHER: 'bg-stone-100 text-stone-600 border-stone-200',
  }
  return map[type]
}

// ── Transactions (Finance) ────────────────────────────────
export const TRANSACTION_TYPE_LABELS: Record<TransactionType, string> = {
  INCOME: 'Income',
  EXPENSE: 'Expense',
}

export const TRANSACTION_CATEGORY_LABELS: Record<TransactionCategory, string> = {
  CLIENT_PAYMENT: 'Client Payment',
  SALARY: 'Salary',
  EQUIPMENT: 'Equipment',
  SOFTWARE: 'Software',
  MARKETING: 'Marketing',
  TRAVEL: 'Travel',
  RENT: 'Rent',
  UTILITIES: 'Utilities',
  OTHER: 'Other',
}

// ── Currency (INR) ────────────────────────────────────────
export function formatMoney(amount: string | number): string {
  const n = typeof amount === 'string' ? parseFloat(amount) : amount
  if (isNaN(n)) return '₹0'
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n)
}

export function formatDateTime(date: string | Date | null | undefined): string {
  if (!date) return '—'
  return new Date(date).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatTime(date: string | Date | null | undefined): string {
  if (!date) return '—'
  return new Date(date).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
  })
}
