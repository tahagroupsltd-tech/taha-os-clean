// src/app/(dashboard)/overview/page.tsx
export const dynamic = 'force-dynamic'
export const revalidate = 0

import { getServerUser } from '@/lib/auth'
import { sbSelect, sbCount, TASK_SELECT, CONTENT_SELECT, EVENT_SELECT } from '@/lib/supa'
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
  BarChart2, Eye, Heart, MessageCircle, Share2,
} from 'lucide-react'
import Link from 'next/link'
import { ActiveTasksList } from './ActiveTasksList'
import { OverviewTopBar } from './OverviewTopBar'

async function getStats(userId: string, role: string) {
  const isAdmin = role === 'ADMIN'
  const isManager = role === 'MANAGER'
  const isEmployee = role === 'EMPLOYEE' || ['EDITOR', 'SCRIPTWRITER', 'GRAPHIC_DESIGNER', 'WEB_DESIGNER'].includes(role)
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

  // For CLIENT: get their project IDs first so we can filter tasks properly
  let clientProjectIds: string[] = []
  if (role === 'CLIENT') {
    try {
      const clientProjs = await sbSelect('projects', { select: 'id', filters: { clientId: `eq.${userId}` } })
      clientProjectIds = clientProjs.map((p: any) => p.id)
    } catch { /* ignore */ }
  }

  // Build task filter: clients see tasks on THEIR projects only; employees see only their own tasks
  const taskFilters: Record<string, string> = {}
  if (isEmployee) taskFilters.assignedToId = `eq.${userId}`
  if (role === 'CLIENT') {
    if (clientProjectIds.length > 0) {
      taskFilters.projectId = `in.(${clientProjectIds.join(',')})`
    } else {
      // No projects → return no tasks
      taskFilters.projectId = 'eq.none'
    }
  }

  const contentFilters: Record<string, string> = {}
  if (isEmployee) contentFilters.assigneeId = `eq.${userId}`
  if (role === 'CLIENT' && clientProjectIds.length > 0) {
    contentFilters.projectId = `in.(${clientProjectIds.join(',')})`
  }

  const projectFilters: Record<string, string> = {}
  if (role === 'CLIENT') projectFilters.clientId = `eq.${userId}`

  const [
    totalTasks, todoTasks, recentTasks, recentContent, upcomingEvents,
    totalContent, totalProjects, activeProjects,
    loans,
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
    safe(() => sbCount('projects', projectFilters), 0),
    safe(() => sbCount('projects', { ...projectFilters, status: 'eq.ACTIVE' }), 0),
    canSeeFinance
      ? safe(() => sbSelect('loans', { select: 'amount,status', filters: { status: 'eq.PENDING' } }), [] as any[])
      : Promise.resolve([] as any[]),
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

  // Engagement metrics — top content by views
  const rawMetrics = await safe(
    () => sbSelect('content_metrics', {
      select: '*,content:content!content_id(id,title,type,project:projects!projectId(id,name))',
      filters: {},
      order: 'views.desc,recorded_at.desc',
      limit: 20,
    }),
    [] as any[]
  )
  const seenMetrics = new Set<string>()
  const dedupedMetrics = rawMetrics.filter((m: any) => {
    if (seenMetrics.has(m.content_id)) return false
    seenMetrics.add(m.content_id); return true
  }).slice(0, 5)

  let clientOutstanding = 0
  let clientPaid = 0
  let clientTotalValue = 0

  if (role === 'CLIENT') {
    const clientProjects = await safe(() => sbSelect('projects', {
      select: 'id,value,status',
      filters: { clientId: `eq.${userId}` }
    }), [] as any[])

    const projectIds = clientProjects.map((p: any) => p.id)
    let clientTransactions = [] as any[]
    if (projectIds.length > 0) {
      clientTransactions = await safe(() => sbSelect('transactions', {
        select: 'id,amount,projectId,type',
        filters: {
          type: 'eq.INCOME',
          projectId: `in.(${projectIds.join(',')})`
        }
      }), [] as any[])
    }

    const txByProj = new Map<string, number>()
    for (const t of clientTransactions) {
      if (!t.projectId) continue
      txByProj.set(t.projectId, (txByProj.get(t.projectId) ?? 0) + Number(t.amount))
    }

    for (const p of clientProjects) {
      const pVal = p.value ? Number(p.value) : 0
      const pPaid = txByProj.get(p.id) ?? 0
      clientTotalValue += pVal
      clientPaid += pPaid
      if (p.status === 'ACTIVE' || p.status === 'PAUSED') {
        clientOutstanding += Math.max(0, pVal - pPaid)
      }
    }
  }

  const pendingLoans = loans.reduce((acc: number, item: any) => acc + (parseFloat(item.amount) || 0), 0)

  // --- 60% completion check for SOP Level 4 scripting follow-up ---
  const pendingScriptingAlerts: { id: string; name: string; posted: number; total: number; pct: number }[] = []
  if (isAdmin || isManager) {
    const activeProjectsList = await safe(() => sbSelect('projects', {
      select: 'id,name,sopLevel',
      filters: { status: 'eq.ACTIVE' }
    }), [] as any[])

    const activeProjectIds = activeProjectsList.map((p: any) => p.id)
    if (activeProjectIds.length > 0) {
      const activeProjectContent = await safe(() => sbSelect('content', {
        select: 'id,projectId,status,type',
        filters: { projectId: `in.(${activeProjectIds.join(',')})` }
      }), [] as any[])

      const contentByProject = new Map<string, any[]>()
      for (const c of activeProjectContent) {
        if (!c.projectId) continue
        const arr = contentByProject.get(c.projectId) ?? []
        arr.push(c)
        contentByProject.set(c.projectId, arr)
      }

      for (const p of activeProjectsList) {
        const items = contentByProject.get(p.id) ?? []
        const videos = items.filter((c: any) => c.type === 'REEL' || c.type === 'VIDEO')
        const trackedItems = videos.length > 0 ? videos : items
        const totalTracked = trackedItems.length
        const postedTracked = trackedItems.filter((c: any) => c.status === 'POSTED').length
        const pct = totalTracked > 0 ? Math.round((postedTracked / totalTracked) * 100) : 0
        
        if (totalTracked > 0 && pct >= 60 && (!p.sopLevel || p.sopLevel < 4)) {
          pendingScriptingAlerts.push({
            id: p.id,
            name: p.name,
            posted: postedTracked,
            total: totalTracked,
            pct,
          })
        }
      }
    }
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
    topMetrics: dedupedMetrics,
    clientOutstanding,
    clientPaid,
    clientTotalValue,
    pendingLoans,
    pendingScriptingAlerts,
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
    ...(isClient
      ? [
          {
            label: 'Outstanding Balance',
            value: formatMoney(stats.clientOutstanding),
            sub: stats.clientTotalValue > 0
              ? `Paid ${formatMoney(stats.clientPaid)} of ${formatMoney(stats.clientTotalValue)}`
              : 'No contract value set',
            icon: IndianRupee,
            iconBg: stats.clientOutstanding > 0 ? 'bg-amber-100 text-amber-600 font-medium' : 'bg-green-100 text-green-600 font-medium',
            alert: stats.clientOutstanding > 0 ? 'Payment Left' : null,
          },
        ]
      : []),
  ]

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <OverviewTopBar name={user.name} />

      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {/* Scripting follow-up alerts (60% threshold reached) */}
        {(isAdmin || user.role === 'MANAGER') && stats.pendingScriptingAlerts && stats.pendingScriptingAlerts.length > 0 && (
          <div className="space-y-2">
            {stats.pendingScriptingAlerts.map((alert: any) => (
              <div key={alert.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-amber-50 border border-amber-250 rounded-lg px-4 py-3 shadow-sm">
                <div className="flex items-start gap-2.5 flex-1 min-w-0">
                  <AlertCircle className="text-amber-600 flex-shrink-0 mt-0.5" size={16} />
                  <div>
                    <p className="text-xs font-bold text-stone-900">
                      💡 Start Scripting (L4 SOP) for {alert.name}
                    </p>
                    <p className="text-[11px] text-stone-600 mt-0.5">
                      Campaign is at <strong>{alert.pct}%</strong> completion ({alert.posted}/{alert.total} videos posted). Scripting team should start SOP Level 4 script approval for the next month&apos;s batch.
                    </p>
                  </div>
                </div>
                <Link
                  href={`/sop?projectId=${alert.id}`}
                  className="text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 px-3.5 py-1.5 rounded transition-colors text-center whitespace-nowrap self-start sm:self-auto"
                >
                  Configure & Start L4
                </Link>
              </div>
            ))}
          </div>
        )}

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
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
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
            <div className="rounded-xl border border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-1.5 rounded-lg bg-amber-100">
                  <TrendingDown size={13} className="text-amber-600" />
                </div>
                <p className="text-[11px] uppercase tracking-wide text-amber-700 font-semibold">Pending Loans Owed</p>
              </div>
              <p className="text-xl font-bold text-amber-800">{formatMoney(stats.pendingLoans)}</p>
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
            <ActiveTasksList recentTasks={stats.recentTasks} isClient={isClient} />
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
                  {item.assignee && !isClient && (
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

        {/* Engagement Metrics */}
        {stats.topMetrics.length > 0 && (
          <div className="bg-white rounded-lg border border-stone-100">
            <div className="px-4 py-3 border-b border-stone-100 flex items-center justify-between">
              <p className="text-xs font-semibold text-stone-700 uppercase tracking-wide flex items-center gap-1.5">
                <BarChart2 size={13} /> Top Content Performance
              </p>
              <Link href="/content" className="text-[10px] text-stone-400 hover:text-stone-700 uppercase tracking-wide">
                All content →
              </Link>
            </div>
            <div className="divide-y divide-stone-50">
              {stats.topMetrics.map((m: any) => (
                <div key={m.id} className="px-4 py-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-stone-100 text-stone-600 uppercase">{m.platform}</span>
                      <p className="text-xs font-medium text-stone-900 truncate">{m.content?.title ?? '—'}</p>
                    </div>
                    {m.content?.project && (
                      <p className="text-[10px] text-stone-400">{m.content.project.name}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-[10px] text-stone-500 flex-shrink-0">
                    <span className="flex items-center gap-1"><Eye size={10} />{m.views.toLocaleString()}</span>
                    <span className="flex items-center gap-1"><Heart size={10} />{m.likes.toLocaleString()}</span>
                    <span className="flex items-center gap-1"><MessageCircle size={10} />{m.comments.toLocaleString()}</span>
                    {m.shares > 0 && <span className="flex items-center gap-1"><Share2 size={10} />{m.shares.toLocaleString()}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
