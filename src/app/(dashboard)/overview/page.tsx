// src/app/(dashboard)/overview/page.tsx
export const dynamic = 'force-dynamic'
export const revalidate = 0

import { getServerUser } from '@/lib/auth'
import { sbSelect, sbCount, TASK_SELECT, CONTENT_SELECT, EVENT_SELECT } from '@/lib/supa'
import { TopBar } from '@/components/layout/TopBar'
import { Badge } from '@/components/ui/Badge'
import {
  taskStatusColor, taskPriorityColor,
  contentStatusColor, formatDate, formatTime, formatMoney, isOverdue,
  TASK_STATUS_LABELS, CONTENT_STATUS_LABELS, eventTypeColor, EVENT_TYPE_LABELS,
} from '@/lib/utils'
import type { TaskStatus, ContentStatus, EventType } from '@/types'
import {
  CheckSquare, FileVideo, FolderKanban, Users, AlertCircle,
  Calendar as CalendarIcon, IndianRupee, TrendingUp, TrendingDown,
} from 'lucide-react'
import Link from 'next/link'

function greet(name: string) {
  const h = new Date().getHours()
  const part = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
  return `${part}, ${name.split(' ')[0]}`
}

async function getStats(userId: string, role: string) {
  const isAdmin = role === 'ADMIN'
  const isManager = role === 'MANAGER'
  const isEmployee = role === 'EMPLOYEE'
  const canSeeFinance = isAdmin
  const canSeeTeamCount = isAdmin || isManager

  const startOfDay = new Date()
  startOfDay.setHours(0, 0, 0, 0)

  const endOfWeek = new Date()
  endOfWeek.setDate(endOfWeek.getDate() + 7)

  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  const endOfMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0, 23, 59, 59)
  const now = new Date()

  const safe = async <T,>(fn: () => Promise<T>, fallback: T): Promise<T> => {
    try { return await fn() } catch (e) { console.error('[overview] query failed:', e); return fallback }
  }

  const taskFilters: Record<string, string> = {}
  if (isEmployee) taskFilters.assignedToId = `eq.${userId}`

  const contentFilters: Record<string, string> = {}
  if (isEmployee) contentFilters.assigneeId = `eq.${userId}`

  const [
    totalTasks, todoTasks, recentTasks, recentContent, upcomingEvents,
    totalContent, totalProjects, activeProjects,
  ] = await Promise.all([
    safe(() => sbCount('tasks', taskFilters), 0),
    safe(() => sbCount('tasks', { ...taskFilters, status: 'eq.TODO' }), 0),
    safe(() => sbSelect('tasks', {
      select: TASK_SELECT,
      filters: { ...taskFilters, status: 'neq.DONE' },
      order: 'priority.desc,deadline.asc',
    }), [] as any[]),
    safe(() => sbSelect('content', {
      select: CONTENT_SELECT,
      filters: contentFilters,
      order: 'updatedAt.desc',
    }), [] as any[]),
    safe(() => sbSelect('events', {
      select: EVENT_SELECT,
      filters: isEmployee ? { ownerId: `eq.${userId}` } : {},
      order: 'startTime.asc',
    }), [] as any[]),
    safe(() => sbCount('content', contentFilters), 0),
    safe(() => sbCount('projects', {}), 0),
    safe(() => sbCount('projects', { status: 'eq.ACTIVE' }), 0),
  ])

  // Filter urgent/overdue in-memory
  const urgentTasks = (recentTasks as any[]).filter(
    (t: any) => t.priority === 'URGENT' && t.status !== 'DONE'
  ).length
  const overdueTasks = (recentTasks as any[]).filter(
    (t: any) => t.status !== 'DONE' && t.deadline && new Date(t.deadline) < now
  ).length

  const editingContent = (recentContent as any[]).filter((c: any) => c.status === 'EDITING').length

  // Filter upcoming events for this week
  const filteredEvents = (upcomingEvents as any[]).filter((e: any) => {
    const st = new Date(e.startTime)
    return st >= startOfDay && st <= endOfWeek
  }).slice(0, 5)

  // Client filter for content
  const filteredContent = role === 'CLIENT'
    ? (recentContent as any[]).filter((c: any) => c.project?.clientId === userId)
    : (recentContent as any[])

  const totalUsers = canSeeTeamCount
    ? await safe(() => sbCount('users', {}), 0)
    : null

  let monthlyIncome = 0
  let monthlyExpense = 0
  let topClients: { project: string; client: string | null; amount: number }[] = []

  if (canSeeFinance) {
    const transactions = await safe(() => sbSelect('transactions', {
      select: '*,project:projects!projectId(id,name,client:users!clientId(name))',
      filters: {},
      order: 'date.desc',
    }), [] as any[])

    for (const t of transactions) {
      const tDate = new Date(t.date)
      if (tDate >= startOfMonth && tDate <= endOfMonth) {
        if (t.type === 'INCOME') monthlyIncome += parseFloat(t.amount)
        if (t.type === 'EXPENSE') monthlyExpense += parseFloat(t.amount)
      }
    }

    // Top projects by income
    const incomeByProject = new Map<string, { project: string; client: string | null; amount: number }>()
    for (const t of transactions) {
      if (t.type === 'INCOME' && t.projectId) {
        const existing = incomeByProject.get(t.projectId)
        if (existing) {
          existing.amount += parseFloat(t.amount)
        } else {
          incomeByProject.set(t.projectId, {
            project: t.project?.name ?? 'Unknown',
            client: t.project?.client?.name ?? null,
            amount: parseFloat(t.amount),
          })
        }
      }
    }
    topClients = Array.from(incomeByProject.values())
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5)
      .filter(c => c.amount > 0)
  }

  return {
    totalTasks, todoTasks, urgentTasks, overdueTasks,
    totalContent, editingContent,
    totalProjects, activeProjects,
    totalUsers,
    recentTasks: (recentTasks as any[]).slice(0, 6),
    recentContent: filteredContent.slice(0, 5),
    upcomingEvents: filteredEvents,
    monthlyIncome,
    monthlyExpense,
    topClients,
  }
}

export default async function OverviewPage() {
  const user = await getServerUser()
  if (!user) return null

  const [stats, recentNotifications] = await Promise.all([
    getStats(user.id, user.role),
    sbSelect('notifications', {
      select: '*',
      filters: { userId: `eq.${user.id}` },
      order: 'read.asc,createdAt.desc',
    }).then(r => r.slice(0, 5)).catch(() => [] as any[]),
  ])

  const isAdmin = user.role === 'ADMIN'
  const isClient = user.role === 'CLIENT'
  const monthlyNet = stats.monthlyIncome - stats.monthlyExpense
  const hasUnreadNotifications = recentNotifications.some((n: any) => !n.read)

  const statCards = [
    {
      label: 'Total Tasks',
      value: stats.totalTasks,
      sub: `${stats.todoTasks} to do`,
      icon: CheckSquare,
      iconBg: 'bg-blue-100 text-blue-600',
      alert: stats.urgentTasks > 0
        ? `${stats.urgentTasks} urgent`
        : stats.overdueTasks > 0
          ? `${stats.overdueTasks} overdue`
          : null,
    },
    {
      label: 'Content Items',
      value: stats.totalContent,
      sub: `${stats.editingContent} in editing`,
      icon: FileVideo,
      iconBg: 'bg-pink-100 text-pink-600',
    },
    {
      label: 'Projects',
      value: stats.totalProjects,
      sub: `${stats.activeProjects} active`,
      icon: FolderKanban,
      iconBg: 'bg-violet-100 text-violet-600',
    },
    ...(stats.totalUsers !== null
      ? [{ label: 'Team Members', value: stats.totalUsers, sub: 'All users', icon: Users, iconBg: 'bg-teal-100 text-teal-600' }]
      : []),
  ]

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <TopBar title={greet(user.name)} />

      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {/* Recent notifications */}
        {recentNotifications.length > 0 && (
          <div className={`bg-white rounded-lg border ${hasUnreadNotifications ? 'border-blue-200' : 'border-stone-100'}`}>
            <div className="px-4 py-3 border-b border-stone-100 flex items-center justify-between">
              <p className="text-xs font-semibold text-stone-700 uppercase tracking-wide">
                {isClient ? 'Updates for you' : 'Recent activity'}
              </p>
              {hasUnreadNotifications && (
                <span className="text-[10px] font-medium text-blue-600 bg-blue-50 rounded px-2 py-0.5">
                  {recentNotifications.filter((n: any) => !n.read).length} new
                </span>
              )}
            </div>
            <div className="divide-y divide-stone-50">
              {recentNotifications.map((n: any) => (
                <Link
                  key={n.id}
                  href={n.link ?? '#'}
                  className={`block px-4 py-3 hover:bg-stone-50 ${!n.read ? 'bg-blue-50/30' : ''}`}
                >
                  <div className="flex items-start gap-2">
                    {!n.read && <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs leading-snug ${n.read ? 'text-stone-700' : 'font-semibold text-stone-900'}`}>
                        {n.title}
                      </p>
                      <p className="text-[11px] text-stone-500 mt-0.5 leading-snug">{n.message}</p>
                      <p className="text-[10px] text-stone-400 mt-1">{formatDate(n.createdAt)}</p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Stat cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {statCards.map((card) => {
            const Icon = card.icon
            return (
              <div key={card.label} className="stat-card">
                <div className="flex items-start justify-between mb-3">
                  <div className={`p-2.5 rounded-xl ${ (card as any).iconBg ?? 'bg-stone-100 text-stone-600'}`}>
                    <Icon size={16} />
                  </div>
                  {(card as any).alert && (
                    <div className="flex items-center gap-1 text-red-500 bg-red-50 px-2 py-0.5 rounded-full">
                      <AlertCircle size={11} />
                      <span className="text-[10px] font-semibold">{(card as any).alert}</span>
                    </div>
                  )}
                </div>
                <p className="text-2xl font-bold text-stone-900 tracking-tight">{card.value}</p>
                <p className="text-xs text-stone-500 mt-0.5 font-medium">{card.label}</p>
                <p className="text-[11px] text-stone-400 mt-1">{card.sub}</p>
              </div>
            )
          })}
        </div>

        {/* Monthly money strip — admin only */}
        {isAdmin && (
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl border border-green-200 bg-gradient-to-br from-green-50 to-emerald-50 p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-1.5 rounded-lg bg-green-100">
                  <TrendingUp size={13} className="text-green-600" />
                </div>
                <p className="text-[11px] uppercase tracking-wide text-green-700 font-semibold">Income this month</p>
              </div>
              <p className="text-xl font-bold text-green-800">{formatMoney(stats.monthlyIncome)}</p>
            </div>
            <div className="rounded-xl border border-red-200 bg-gradient-to-br from-red-50 to-rose-50 p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-1.5 rounded-lg bg-red-100">
                  <TrendingDown size={13} className="text-red-600" />
                </div>
                <p className="text-[11px] uppercase tracking-wide text-red-700 font-semibold">Expense this month</p>
              </div>
              <p className="text-xl font-bold text-red-700">{formatMoney(stats.monthlyExpense)}</p>
            </div>
            <div className={`rounded-xl border p-4 shadow-sm bg-gradient-to-br ${monthlyNet >= 0 ? 'from-violet-50 to-indigo-50 border-violet-200' : 'from-red-50 to-rose-50 border-red-200'}`}>
              <div className="flex items-center gap-2 mb-2">
                <div className={`p-1.5 rounded-lg ${monthlyNet >= 0 ? 'bg-violet-100' : 'bg-red-100'}`}>
                  <IndianRupee size={13} className={monthlyNet >= 0 ? 'text-violet-600' : 'text-red-500'} />
                </div>
                <p className={`text-[11px] uppercase tracking-wide font-semibold ${monthlyNet >= 0 ? 'text-violet-700' : 'text-red-700'}`}>Net this month</p>
              </div>
              <p className={`text-xl font-bold ${monthlyNet >= 0 ? 'text-violet-800' : 'text-red-700'}`}>
                {formatMoney(monthlyNet)}
              </p>
            </div>
          </div>
        )}

        {/* Two-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Active Tasks */}
          <div className="bg-white rounded-lg border border-stone-100">
            <div className="px-4 py-3 border-b border-stone-100 flex items-center justify-between">
              <p className="text-xs font-semibold text-stone-700 uppercase tracking-wide">Active Tasks</p>
              <Link href="/tasks" className="text-[10px] text-stone-400 hover:text-stone-700 uppercase tracking-wide">
                View all →
              </Link>
            </div>
            <div className="divide-y divide-stone-50">
              {stats.recentTasks.length === 0 && (
                <p className="px-4 py-6 text-xs text-stone-400 text-center">No active tasks</p>
              )}
              {stats.recentTasks.map((task: any) => (
                <div key={task.id} className="px-4 py-3 flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-1">
                      <p className="text-xs font-medium text-stone-900 truncate">{task.title}</p>
                      {isOverdue(task.deadline) && (
                        <AlertCircle size={11} className="text-red-400 flex-shrink-0" />
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Badge className={taskStatusColor(task.status as TaskStatus)}>
                        {TASK_STATUS_LABELS[task.status as TaskStatus]}
                      </Badge>
                      <Badge className={taskPriorityColor(task.priority)}>{task.priority}</Badge>
                      {task.project && (
                        <span className="text-[10px] text-stone-400">{task.project.name}</span>
                      )}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    {task.assignedTo && (
                      <p className="text-[10px] text-stone-400">{task.assignedTo.name}</p>
                    )}
                    {task.deadline && (
                      <p className={`text-[10px] mt-0.5 ${isOverdue(task.deadline) ? 'text-red-500' : 'text-stone-400'}`}>
                        {formatDate(task.deadline)}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Upcoming Events */}
          <div className="bg-white rounded-lg border border-stone-100">
            <div className="px-4 py-3 border-b border-stone-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CalendarIcon size={13} className="text-stone-500" />
                <p className="text-xs font-semibold text-stone-700 uppercase tracking-wide">This Week</p>
              </div>
              <Link href="/calendar" className="text-[10px] text-stone-400 hover:text-stone-700 uppercase tracking-wide">
                Open calendar →
              </Link>
            </div>
            <div className="divide-y divide-stone-50">
              {stats.upcomingEvents.length === 0 && (
                <p className="px-4 py-6 text-xs text-stone-400 text-center">Nothing scheduled this week</p>
              )}
              {stats.upcomingEvents.map((event: any) => (
                <div key={event.id} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <p className="text-xs font-medium text-stone-900 truncate">{event.title}</p>
                    <Badge className={eventTypeColor(event.type as EventType)}>
                      {EVENT_TYPE_LABELS[event.type as EventType]}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-stone-400">
                    <span>{formatDate(event.startTime)}</span>
                    <span>•</span>
                    <span>{formatTime(event.startTime)}</span>
                    {event.project && (
                      <>
                        <span>•</span>
                        <span>{event.project.name}</span>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom row: Content tracker + Top clients (admin) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Content Tracker */}
          <div className="bg-white rounded-lg border border-stone-100">
            <div className="px-4 py-3 border-b border-stone-100 flex items-center justify-between">
              <p className="text-xs font-semibold text-stone-700 uppercase tracking-wide">Content Tracker</p>
              <Link href="/content" className="text-[10px] text-stone-400 hover:text-stone-700 uppercase tracking-wide">
                View all →
              </Link>
            </div>
            <div className="divide-y divide-stone-50">
              {stats.recentContent.length === 0 && (
                <p className="px-4 py-6 text-xs text-stone-400 text-center">No content items</p>
              )}
              {stats.recentContent.map((item: any) => (
                <div key={item.id} className="px-4 py-3 flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-stone-900 truncate mb-1">{item.title}</p>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Badge className={contentStatusColor(item.status as ContentStatus)}>
                        {CONTENT_STATUS_LABELS[item.status as ContentStatus]}
                      </Badge>
                      <span className="text-[10px] text-stone-400 bg-stone-50 rounded px-1.5 py-0.5">
                        {item.type}
                      </span>
                      {item.project && (
                        <span className="text-[10px] text-stone-400">{item.project.name}</span>
                      )}
                    </div>
                  </div>
                  {item.assignee && (
                    <p className="text-[10px] text-stone-400 flex-shrink-0">{item.assignee.name}</p>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Top earning projects — admin only */}
          {isAdmin && (
            <div className="bg-white rounded-lg border border-stone-100">
              <div className="px-4 py-3 border-b border-stone-100 flex items-center justify-between">
                <p className="text-xs font-semibold text-stone-700 uppercase tracking-wide">Top Earning Projects</p>
                <Link href="/finance" className="text-[10px] text-stone-400 hover:text-stone-700 uppercase tracking-wide">
                  Open finance →
                </Link>
              </div>
              <div className="divide-y divide-stone-50">
                {stats.topClients.length === 0 && (
                  <p className="px-4 py-6 text-xs text-stone-400 text-center">No income recorded yet</p>
                )}
                {stats.topClients.map((c, i) => (
                  <div key={i} className="px-4 py-3 flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-stone-900 truncate">{c.project}</p>
                      {c.client && <p className="text-[10px] text-stone-400 mt-0.5">{c.client}</p>}
                    </div>
                    <p className="text-xs font-semibold text-stone-900 flex-shrink-0">{formatMoney(c.amount)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
