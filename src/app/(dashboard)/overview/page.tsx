// src/app/(dashboard)/overview/page.tsx
import { getServerUser } from '@/lib/auth'
import { db } from '@/lib/db'
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

// NOTE: queries are sequential on purpose — Supabase's transaction pooler
// kills prepared statements between concurrent Prisma calls. Slower than
// Promise.all but reliable on serverless without the pgbouncer URL flag.
async function getStats(userId: string, role: string) {
  const isAdmin = role === 'ADMIN'
  const isManager = role === 'MANAGER'
  const isEmployee = role === 'EMPLOYEE'
  const canSeeFinance = isAdmin // founder-only; manager is blocked from finance
  const canSeeTeamCount = isAdmin || isManager

  const taskWhere = isEmployee ? { assignedToId: userId } : {}
  const contentWhere = isEmployee ? { assigneeId: userId } : {}

  const startOfDay = new Date()
  startOfDay.setHours(0, 0, 0, 0)

  const endOfWeek = new Date()
  endOfWeek.setDate(endOfWeek.getDate() + 7)

  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  const endOfMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0, 23, 59, 59)

  const safe = async <T,>(fn: () => Promise<T>, fallback: T): Promise<T> => {
    try { return await fn() } catch (e) { console.error('[overview] query failed:', e); return fallback }
  }

  const totalTasks = await safe(() => db.task.count({ where: taskWhere }), 0)
  const todoTasks = await safe(() => db.task.count({ where: { ...taskWhere, status: 'TODO' } }), 0)
  const urgentTasks = await safe(() => db.task.count({ where: { ...taskWhere, priority: 'URGENT', status: { not: 'DONE' } } }), 0)
  const overdueTasks = await safe(
    () => db.task.count({ where: { ...taskWhere, status: { not: 'DONE' }, deadline: { lt: new Date() } } }),
    0
  )
  const totalContent = await safe(() => db.content.count({ where: contentWhere }), 0)
  const editingContent = await safe(() => db.content.count({ where: { ...contentWhere, status: 'EDITING' } }), 0)
  const totalProjects = await safe(() => db.project.count(), 0)
  const activeProjects = await safe(() => db.project.count({ where: { status: 'ACTIVE' } }), 0)
  const totalUsers = canSeeTeamCount ? await safe(() => db.user.count(), 0) : null

  const recentTasks = await safe(
    () => db.task.findMany({
      where: { ...taskWhere, status: { not: 'DONE' } },
      include: {
        assignedTo: { select: { name: true } },
        project: { select: { name: true } },
      },
      orderBy: [{ priority: 'desc' }, { deadline: 'asc' }],
      take: 6,
    }),
    [] as any[]
  )

  const recentContent = await safe(
    () => db.content.findMany({
      where: contentWhere,
      include: {
        assignee: { select: { name: true } },
        project: { select: { name: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: 5,
    }),
    [] as any[]
  )

  const upcomingEvents = await safe(
    () => db.event.findMany({
      where: {
        startTime: { gte: startOfDay, lte: endOfWeek },
        ...(isEmployee ? { ownerId: userId } : {}),
      },
      include: {
        owner: { select: { name: true } },
        project: { select: { name: true } },
      },
      orderBy: { startTime: 'asc' },
      take: 5,
    }),
    [] as any[]
  )

  let monthlyIncome = 0
  let monthlyExpense = 0
  let topClients: { project: string; client: string | null; amount: number }[] = []

  if (canSeeFinance) {
    const inc = await safe(
      () => db.transaction.aggregate({
        where: { type: 'INCOME', date: { gte: startOfMonth, lte: endOfMonth } },
        _sum: { amount: true },
      }),
      null as any
    )
    monthlyIncome = Number(inc?._sum?.amount ?? 0)

    const exp = await safe(
      () => db.transaction.aggregate({
        where: { type: 'EXPENSE', date: { gte: startOfMonth, lte: endOfMonth } },
        _sum: { amount: true },
      }),
      null as any
    )
    monthlyExpense = Number(exp?._sum?.amount ?? 0)

    const grouped = await safe(
      () => db.transaction.groupBy({
        by: ['projectId'],
        where: { type: 'INCOME', projectId: { not: null } },
        _sum: { amount: true },
        orderBy: { _sum: { amount: 'desc' } },
        take: 5,
      }),
      [] as any[]
    )

    if (grouped.length > 0) {
      const projectIds = grouped.map((t: any) => t.projectId).filter(Boolean) as string[]
      const projects = await safe(
        () => db.project.findMany({
          where: { id: { in: projectIds } },
          include: { client: { select: { name: true } } },
        }),
        [] as any[]
      )
      const map = new Map(projects.map((p: any) => [p.id, p]))
      topClients = grouped
        .map((t: any) => {
          const p: any = map.get(t.projectId)
          return {
            project: p?.name ?? 'Unknown',
            client: p?.client?.name ?? null,
            amount: Number(t._sum?.amount ?? 0),
          }
        })
        .filter((c: any) => c.amount > 0)
    }
  }

  return {
    totalTasks, todoTasks, urgentTasks, overdueTasks,
    totalContent, editingContent,
    totalProjects, activeProjects,
    totalUsers,
    recentTasks, recentContent,
    upcomingEvents,
    monthlyIncome,
    monthlyExpense,
    topClients,
  }
}

export default async function OverviewPage() {
  const user = await getServerUser()
  if (!user) return null

  const stats = await getStats(user.id, user.role)
  const isAdmin = user.role === 'ADMIN'
  const isClient = user.role === 'CLIENT'
  const monthlyNet = stats.monthlyIncome - stats.monthlyExpense

  // Recent notifications for the inline strip
  const recentNotifications = await db.notification
    .findMany({
      where: { userId: user.id },
      orderBy: [{ read: 'asc' }, { createdAt: 'desc' }],
      take: isClient ? 5 : 3,
    })
    .catch(() => [] as any[])
  const hasUnreadNotifications = recentNotifications.some((n: any) => !n.read)

  const statCards = [
    {
      label: 'Total Tasks',
      value: stats.totalTasks,
      sub: `${stats.todoTasks} to do`,
      icon: CheckSquare,
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
    },
    {
      label: 'Projects',
      value: stats.totalProjects,
      sub: `${stats.activeProjects} active`,
      icon: FolderKanban,
    },
    ...(stats.totalUsers !== null
      ? [{ label: 'Team Members', value: stats.totalUsers, sub: 'All users', icon: Users }]
      : []),
  ]

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <TopBar title={greet(user.name)} />

      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {/* Recent notifications — prominent for clients, compact for others */}
        {recentNotifications.length > 0 && (
          <div
            className={`bg-white rounded-lg border ${
              hasUnreadNotifications ? 'border-blue-200' : 'border-stone-100'
            }`}
          >
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
                  className={`block px-4 py-3 hover:bg-stone-50 ${
                    !n.read ? 'bg-blue-50/30' : ''
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {!n.read && (
                      <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p
                        className={`text-xs leading-snug ${
                          n.read ? 'text-stone-700' : 'font-semibold text-stone-900'
                        }`}
                      >
                        {n.title}
                      </p>
                      <p className="text-[11px] text-stone-500 mt-0.5 leading-snug">
                        {n.message}
                      </p>
                      <p className="text-[10px] text-stone-400 mt-1">
                        {formatDate(n.createdAt.toISOString())}
                      </p>
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
                  <div className="p-2 rounded-md bg-stone-50">
                    <Icon size={15} className="text-stone-600" />
                  </div>
                  {card.alert && (
                    <div className="flex items-center gap-1 text-red-500">
                      <AlertCircle size={12} />
                      <span className="text-[10px] font-medium">{card.alert}</span>
                    </div>
                  )}
                </div>
                <p className="text-2xl font-bold text-stone-900 tracking-tight">
                  {card.value}
                </p>
                <p className="text-xs text-stone-400 mt-0.5">{card.label}</p>
                <p className="text-[11px] text-stone-500 mt-1">{card.sub}</p>
              </div>
            )
          })}
        </div>

        {/* Monthly money strip — admin only */}
        {isAdmin && (
          <div className="grid grid-cols-3 gap-3">
            <div className="stat-card">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp size={14} className="text-green-600" />
                <p className="text-[11px] uppercase tracking-wide text-stone-500 font-medium">
                  Income this month
                </p>
              </div>
              <p className="text-xl font-bold text-stone-900">{formatMoney(stats.monthlyIncome)}</p>
            </div>
            <div className="stat-card">
              <div className="flex items-center gap-2 mb-2">
                <TrendingDown size={14} className="text-red-500" />
                <p className="text-[11px] uppercase tracking-wide text-stone-500 font-medium">
                  Expense this month
                </p>
              </div>
              <p className="text-xl font-bold text-stone-900">{formatMoney(stats.monthlyExpense)}</p>
            </div>
            <div className="stat-card">
              <div className="flex items-center gap-2 mb-2">
                <IndianRupee size={14} className={monthlyNet >= 0 ? 'text-green-600' : 'text-red-500'} />
                <p className="text-[11px] uppercase tracking-wide text-stone-500 font-medium">
                  Net this month
                </p>
              </div>
              <p className={`text-xl font-bold ${monthlyNet >= 0 ? 'text-stone-900' : 'text-red-600'}`}>
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
              <p className="text-xs font-semibold text-stone-700 uppercase tracking-wide">
                Active Tasks
              </p>
              <Link href="/tasks" className="text-[10px] text-stone-400 hover:text-stone-700 uppercase tracking-wide">
                View all →
              </Link>
            </div>
            <div className="divide-y divide-stone-50">
              {stats.recentTasks.length === 0 && (
                <p className="px-4 py-6 text-xs text-stone-400 text-center">No active tasks</p>
              )}
              {stats.recentTasks.map((task) => (
                <div key={task.id} className="px-4 py-3 flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-1">
                      <p className="text-xs font-medium text-stone-900 truncate">{task.title}</p>
                      {isOverdue(task.deadline?.toISOString()) && (
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
                      <p className={`text-[10px] mt-0.5 ${isOverdue(task.deadline.toISOString()) ? 'text-red-500' : 'text-stone-400'}`}>
                        {formatDate(task.deadline.toISOString())}
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
                <p className="text-xs font-semibold text-stone-700 uppercase tracking-wide">
                  This Week
                </p>
              </div>
              <Link href="/calendar" className="text-[10px] text-stone-400 hover:text-stone-700 uppercase tracking-wide">
                Open calendar →
              </Link>
            </div>
            <div className="divide-y divide-stone-50">
              {stats.upcomingEvents.length === 0 && (
                <p className="px-4 py-6 text-xs text-stone-400 text-center">
                  Nothing scheduled this week
                </p>
              )}
              {stats.upcomingEvents.map((event) => (
                <div key={event.id} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <p className="text-xs font-medium text-stone-900 truncate">{event.title}</p>
                    <Badge className={eventTypeColor(event.type as EventType)}>
                      {EVENT_TYPE_LABELS[event.type as EventType]}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-stone-400">
                    <span>{formatDate(event.startTime.toISOString())}</span>
                    <span>•</span>
                    <span>{formatTime(event.startTime.toISOString())}</span>
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
              <p className="text-xs font-semibold text-stone-700 uppercase tracking-wide">
                Content Tracker
              </p>
              <Link href="/content" className="text-[10px] text-stone-400 hover:text-stone-700 uppercase tracking-wide">
                View all →
              </Link>
            </div>
            <div className="divide-y divide-stone-50">
              {stats.recentContent.length === 0 && (
                <p className="px-4 py-6 text-xs text-stone-400 text-center">No content items</p>
              )}
              {stats.recentContent.map((item) => (
                <div key={item.id} className="px-4 py-3 flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-stone-900 truncate mb-1">
                      {item.title}
                    </p>
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
                <p className="text-xs font-semibold text-stone-700 uppercase tracking-wide">
                  Top Earning Projects
                </p>
                <Link href="/finance" className="text-[10px] text-stone-400 hover:text-stone-700 uppercase tracking-wide">
                  Open finance →
                </Link>
              </div>
              <div className="divide-y divide-stone-50">
                {stats.topClients.length === 0 && (
                  <p className="px-4 py-6 text-xs text-stone-400 text-center">
                    No income recorded yet
                  </p>
                )}
                {stats.topClients.map((c, i) => (
                  <div key={i} className="px-4 py-3 flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-stone-900 truncate">{c.project}</p>
                      {c.client && (
                        <p className="text-[10px] text-stone-400 mt-0.5">{c.client}</p>
                      )}
                    </div>
                    <p className="text-xs font-semibold text-stone-900 flex-shrink-0">
                      {formatMoney(c.amount)}
                    </p>
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
