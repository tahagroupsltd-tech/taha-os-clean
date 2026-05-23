// src/lib/utils.ts
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type {
  TaskStatus, TaskPriority, ContentStatus, ProjectStatus,
  EventType, TransactionType, TransactionCategory, KanbanStage,
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

export const KANBAN_STAGE_LABELS: Record<KanbanStage, string> = {
  LEAD: 'Lead',
  PROPOSAL_SENT: 'Proposal Sent',
  ONBOARDING: 'Onboarding',
  ACTIVE: 'Active',
  DELIVERED: 'Delivered',
  CLOSED: 'Closed',
}

export function kanbanStageColor(stage: KanbanStage): string {
  const map: Record<KanbanStage, string> = {
    LEAD: 'bg-slate-100 text-slate-700 border-slate-200',
    PROPOSAL_SENT: 'bg-blue-50 text-blue-700 border-blue-200',
    ONBOARDING: 'bg-purple-50 text-purple-700 border-purple-200',
    ACTIVE: 'bg-green-50 text-green-700 border-green-200',
    DELIVERED: 'bg-amber-50 text-amber-700 border-amber-200',
    CLOSED: 'bg-stone-100 text-stone-500 border-stone-200',
  }
  return map[stage] ?? 'bg-stone-100 text-stone-500 border-stone-200'
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
  SHOOT_COST: 'Shoot Cost',
  FREELANCER: 'Freelancer',
  ADS: 'Ads / Paid Media',
  EQUIPMENT: 'Equipment',
  SOFTWARE: 'Software',
  MARKETING: 'Marketing',
  TRAVEL: 'Travel',
  RENT: 'Rent',
  UTILITIES: 'Utilities',
  OTHER: 'Other',
}

// ── Currency (INR) ────────────────────────────────────────
// NOTE: We use manual formatting instead of Intl.NumberFormat('en-IN') to
// avoid server/client hydration mismatches — Node.js on Vercel uses a
// stripped-down ICU dataset and formats numbers differently from Chrome.
export function formatMoney(amount: string | number): string {
  const n = typeof amount === 'string' ? parseFloat(amount) : amount
  if (isNaN(n)) return '₹0'
  const abs = Math.round(Math.abs(n))
  const s = abs.toString()
  // Indian grouping: last 3 digits, then groups of 2
  let formatted = ''
  if (s.length <= 3) {
    formatted = s
  } else {
    formatted = s.slice(-3)
    let rest = s.slice(0, -3)
    while (rest.length > 2) {
      formatted = rest.slice(-2) + ',' + formatted
      rest = rest.slice(0, -2)
    }
    formatted = rest + ',' + formatted
  }
  return (n < 0 ? '-₹' : '₹') + formatted
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

export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (days > 0) {
    const hr = hours % 24
    return hr > 0 ? `${days}d ${hr}h` : `${days}d`
  }
  if (hours > 0) {
    const min = minutes % 60
    return min > 0 ? `${hours}h ${min}m` : `${hours}h`
  }
  if (minutes > 0) {
    return `${minutes}m`
  }
  return '1m'
}

export function getTaskUrgencyColors(deadline: string | null | undefined, status: TaskStatus, now: Date) {
  if (status === 'DONE') {
    return {
      cardClasses: 'bg-green-50/25 border-green-200/80 text-stone-900',
      badgeClasses: 'bg-green-50 text-green-700 border-green-200',
      textClasses: 'text-green-600 font-medium',
      timeLeftStr: 'Done',
      isOverdue: false,
    }
  }

  if (!deadline) {
    return {
      cardClasses: 'bg-white border-stone-100 text-stone-900',
      badgeClasses: 'bg-stone-50 text-stone-600 border-stone-100',
      textClasses: 'text-stone-400',
      timeLeftStr: '',
      isOverdue: false,
    }
  }

  const target = new Date(deadline)
  const diff = target.getTime() - now.getTime()

  if (diff < 0) {
    return {
      cardClasses: 'bg-red-50/20 border-red-200/80 text-stone-900',
      badgeClasses: 'bg-red-50 text-red-700 border-red-200',
      textClasses: 'text-red-500 font-bold',
      timeLeftStr: `Overdue`,
      isOverdue: true,
    }
  }

  // < 12h
  if (diff < 12 * 60 * 60 * 1000) {
    return {
      cardClasses: 'bg-red-50/20 border-red-200/80 text-stone-900',
      badgeClasses: 'bg-red-50 text-red-700 border-red-200',
      textClasses: 'text-red-500 font-semibold',
      timeLeftStr: `${formatDuration(diff)} left`,
      isOverdue: false,
    }
  }

  // < 24h
  if (diff < 24 * 60 * 60 * 1000) {
    return {
      cardClasses: 'bg-pink-50/20 border-pink-200/80 text-stone-900',
      badgeClasses: 'bg-pink-50 text-pink-700 border-pink-200',
      textClasses: 'text-pink-600 font-semibold',
      timeLeftStr: `${formatDuration(diff)} left`,
      isOverdue: false,
    }
  }

  // < 3 days
  if (diff < 3 * 24 * 60 * 60 * 1000) {
    return {
      ca