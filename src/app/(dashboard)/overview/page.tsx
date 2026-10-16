// src/app/(dashboard)/overview/page.tsx
export const dynamic = 'force-dynamic'
export const revalidate = 0

import { getServerUser } from '@/lib/auth'
import { sbSelect, sbCount, TASK_SELECT, CONTENT_SELECT, EVENT_SELECT } from '@/lib/supa'
import { Badge } from '@/components/ui/Badge'
import {
  contentStatusColor, formatDate, formatTime, formatMoney,
  CONTENT_STATUS_LABELS, eventTypeColor, EVENT_TYPE_LABELS,
} from '@/lib/utils'
import type { ContentStatus, EventType } from '@/types'
import {
  CheckSquare, FileVideo, FolderKanban, Users, AlertCircle,
  Calendar as CalendarIcon, IndianRupee, TrendingUp, TrendingDown,
  BarChart2, Eye, Heart, MessageCircle,
  Film, CheckCircle2, ArrowUpRight,
} from 'lucide-react'
import Link from 'next/link'
import { ActiveTasksList } from './ActiveTasksList'
import { TopBar } from '@/components/layout/TopBar'

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

  // For CLIENT: get their project IDs first
  let clientProjectIds: string[] = []
  if (role === 'CLIENT') {
    try {
      const clientProjs = await sbSelect('projects', { select: 'id', filters: { clientId: `eq.${userId}` } })
      clientProjectIds = clientProjs.map((p: any) => p.id)
    } catch { /* ignore */ }
  }

  const taskFilters: Record<string, string> = {}
  if (isEmployee) taskFilters.assignedToId = `eq.${userId}`
  if (role === 'CLIENT') {
    taskFilters.projectId = clientProjectIds.length > 0 ? `in.(${clientProjectIds.join(',')})` : 'eq.none'
  }

  const contentFilters: Record<string, string> = {}
  if (isEmployee) contentFilters.assigneeId = `eq.${userId}`
  if (role === 'CLIENT') {
    contentFilters.projectId = clientProjectIds.length > 0 ? `in.(${clientProjectIds.join(',')})` : 'eq.none'
  }

  const projectFilters: Record<string, string> = {}
  if (role === 'CLIENT') projectFilters.clientId = `eq.${userId}`

  const [
    totalTasks, todoTasks, recentTasks, recentContent, upcomingEvents,
    totalContent, totalProjects, activeProjects,
    loans, repayments,
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
      ? safe(() => sbSelect('loans', { select: 'id,amount,status', filters: { status: 'eq.PENDING' } }), [] as any[])
      : Promise.resolve([] as any[]),
    canSeeFinance
      ? safe(() => sbSelect('transactions', { select: 'amount,loanId,type', filters: { loanId: 'not.is.null' } }), [] as any[])
      : Promise.resolve([] as any[]),
  ])

  const urgentTasks = (recentTasks as any[]).filter((t: any) => t.priority === 'URGENT' && t.status !== 'DONE').length
  const overdueTasks = (recentTasks as any[]).filter((t: any) => t.status !== 'DONE' && t.deadline && new Date(t.deadline) < now).length

  const filteredEvents = (upcomingEvents as any[]).filter((e: any) => {
    const st = new Date(e.startTime)
    return st >= startOfDay && st <= endOfWeek
  }).slice(0, 5)

  const filteredContent = recentContent as any[]

  // Client content timeline
  let clientMonthTimeline: {
    total: number; posted: number; firstPosted: any | null; lastPosted: any | null
    nextUpcoming: any | null; lastOfMonth: any | null; needsReview: number; items: any[]
  } | null = null

  if (role === 'CLIENT' && filteredContent.length > 0) {
    const tNow = new Date()
    const tY = tNow.getFullYear(), tM = tNow.getMonth()
    const isVid = (c: any) => !c.type || ['REEL','VIDEO','SHORT','YOUTUBE'].includes((c.type ?? '').toUpperCase())

    const monthAll = filteredContent.filter((c: any) => {
      if (!c.postDate) return false
      const d = new Date(c.postDate)
      return d.getFullYear() === tY && d.getMonth() === tM
    })
    const monthFiltered = monthAll.filter(isVid).length > 0 ? monthAll.filter(isVid) : monthAll
    const sortedMonth = [...monthFiltered].sort((a: any, b: any) => new Date(a.postDate).getTime() - new Date(b.postDate).getTime())
    const allPosted = [...filteredContent].filter((c: any) => c.status === 'POSTED').sort((a: any, b: any) => new Date(a.updatedAt ?? a.postDate).getTime() - new Date(b.updatedAt ?? b.postDate).getTime())
    const lastPostedOverall = allPosted[allPosted.length - 1] ?? null
    const postedMonth = sortedMonth.filter((c: any) => c.status === 'POSTED')
    const upcomingMonth = sortedMonth.filter((c: any) => c.status !== 'POSTED' && new Date(c.postDate) >= tNow)
    const needsReviewCount = filteredContent.filter((c: any) => ['REVIEW','PENDING_APPROVAL','AWAITING_APPROVAL'].includes((c.status ?? '').toUpperCase())).length

    if (sortedMonth.length > 0) {
      clientMonthTimeline = {
        total: sortedMonth.length,
        posted: postedMonth.length,
        firstPosted: postedMonth[0] ?? null,
        lastPosted: lastPostedOverall,
        nextUpcoming: upcomingMonth[0] ?? null,
        lastOfMonth: sortedMonth[sortedMonth.length - 1] ?? null,
        needsReview: needsReviewCount,
        items: sortedMonth,
      }
    }
  }

  const totalUsers = canSeeTeamCount ? await safe(() => sbCount('users', {}), 0) : null

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
    topClients = Array.from(incomeByProject.values()).sort((a, b) => b.amount - a.amount).slice(0, 5).filter(c => c.amount > 0)
  }

  // Top content metrics — deduped by content_id
  const rawMetrics = await safe(
    () => sbSelect('content_metrics', {
      select: '*,content:content!content_id(id,title,type,project:projects!projectId(id,name,clientId))',
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
  })
  const filteredMetrics = role === 'CLIENT'
    ? dedupedMetrics.filter((m: any) => m.content?.project && clientProjectIds.includes(m.content.projectId))
    : dedupedMetrics
  const topMetrics = filteredMetrics.slice(0, 5)

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
        filters: { type: 'eq.INCOME', projectId: `in.(${projectIds.join(',')})` }
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

  let pendingLoans = 0
  if (canSeeFinance) {
    const repaymentsMap: Record<string, number> = {}
    for (const r of repayments) {
      if (r.type === 'EXPENSE' && r.loanId) {
        repaymentsMap[r.loanId] = (repaymentsMap[r.loanId] || 0) + (parseFloat(r.amount) || 0)
      }
    }
    for (const l of loans) {
      const amt = parseFloat(l.amount) || 0
      const repaid = repaymentsMap[l.id] || 0
      pendingLoans += Math.max(0, amt - repaid)
    }
  }

  // SOP scripting follow-up alerts
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
          pendingScriptingAlerts.push({ id: p.id, name: p.name, posted: postedTracked, total: totalTracked, pct })
        }
      }
    }
  }

  return {
    totalTasks, todoTasks, urgentTasks, overdueTasks,
    totalContent, totalProjects, activeProjects,
    totalUsers,
    recentTasks: (recentTasks as any[]).slice(0, 6),
    recentContent: filteredContent.slice(0, 5),
    upcomingEvents: filteredEvents,
    monthlyIncome, monthlyExpense,
    topClients,
    topMetrics,
    clientOutstanding, clientPaid, clientTotalValue,
    pendingLoans,
    pendingScriptingAlerts,
    clientMonthTimeline,
  }
}

// ── Dashboard section wrapper ───────────────────────────────
function Section({ title, href, hrefLabel, children }: {
  title: string
  href?: string
  hrefLabel?: string
  children: React.ReactNode
}) {
  return (
    <div className="bg-white rounded-lg border border-stone-100 overflow-hidden">
      <div className="px-4 py-2.5 border-b border-stone-100 flex items-center justify-between">
        <p className="text-[11px] font-semibold text-stone-500 uppercase tracking-widest">{title}</p>
        {href && (
          <Link href={href} className="flex items-center gap-1 text-[10px] text-stone-400 hover:text-stone-700 transition-colors">
            {hrefLabel ?? 'View all'} <ArrowUpRight size={10} />
          </Link>
        )}
      </div>
      {children}
    </div>
  )
}

// ── KPI Card ────────────────────────────────────────────────
function KpiCard({ label, value, sub, alert, icon: Icon, iconColor }: {
  label: string; value: string | number; sub?: string
  alert?: string | null; icon: any; iconColor?: string
}) {
  return (
    <div className="bg-white rounded-lg border border-stone-100 p-4">
      <div className="flex items-start justify-between mb-3">
        <div className={`p-2 rounded-lg bg-stone-50 ${iconColor ?? 'text-stone-500'}`}>
          <Icon size={15} />
        </div>
        {alert && (
          <span className="flex items-center gap-1 text-[10px] font-semibold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
            <AlertCircle size={9} /> {alert}
          </span>
        )}
      </div>
      <p className="text-2xl font-bold text-stone-900 leading-none">{value}</p>
      <p className="text-[11px] font-medium text-stone-500 mt-1">{label}</p>
      {sub && <p className="text-[10px] text-stone-400 mt-0.5">{sub}</p>}
    </div>
  )
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
    }).then(r => r.slice(0, 4)).catch(() => [] as any[]),
  ])

  const isAdmin = user.role === 'ADMIN'
  const isClient = user.role === 'CLIENT'
  const monthlyNet = stats.monthlyIncome - stats.monthlyExpense
  const hasUnread = recentNotifications.some((n: any) => !n.read)

  // Determine which KPI cards to show
  const kpiCards = [
    {
      label: 'Active Projects',
      value: stats.activeProjects,
      sub: `${stats.totalProjects} total`,
      icon: FolderKanban,
      iconColor: 'text-indigo-500',
    },
    {
      label: 'Tasks',
      value: stats.totalTasks,
      sub: `${stats.todoTasks} to do`,
      icon: CheckSquare,
      iconColor: 'text-blue-500',
      alert: stats.overdueTasks > 0 ? `${stats.overdueTasks} overdue` : stats.urgentTasks > 0 ? `${stats.urgentTasks} urgent` : null,
    },
    {
      label: 'Content Items',
      value: stats.totalContent,
      sub: `across all projects`,
      icon: FileVideo,
      iconColor: 'text-pink-500',
    },
    ...(stats.totalUsers !== null ? [{
      label: 'Team Members',
      value: stats.totalUsers,
      sub: 'All users',
      icon: Users,
      iconColor: 'text-teal-500',
    }] : []),
    ...(isClient ? [{
      label: 'Outstanding Balance',
      value: formatMoney(stats.clientOutstanding),
      sub: stats.clientTotalValue > 0 ? `Paid ${formatMoney(stats.clientPaid)} of ${formatMoney(stats.clientTotalValue)}` : 'No contract value set',
      icon: IndianRupee,
      iconColor: stats.clientOutstanding > 0 ? 'text-amber-500' : 'text-green-500',
      alert: stats.clientOutstanding > 0 ? 'Balance due' : null,
    }] : []),
  ]

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <TopBar title="Overview" />

      <div className="flex-1 overflow-y-auto p-5 space-y-4">

        {/* ── SOP / Scripting alerts ──────────────────────── */}
        {(isAdmin || user.role === 'MANAGER') && stats.pendingScriptingAlerts.length > 0 && (
          <div className="space-y-2">
            {stats.pendingScriptingAlerts.map((alert: any) => (
              <div key={alert.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
                <div className="flex items-start gap-2.5 flex-1 min-w-0">
                  <AlertCircle className="text-amber-600 flex-shrink-0 mt-0.5" size={15} />
                  <div>
                    <p className="text-xs font-semibold text-stone-900">Start Scripting (L4) — {alert.name}</p>
                    <p className="text-[11px] text-stone-500 mt-0.5">
                      {alert.pct}% posted ({alert.posted}/{alert.total}). Time to begin next month&apos;s script approval.
                    </p>
                  </div>
                </div>
                <Link
                  href={`/sop?projectId=${alert.id}`}
                  className="text-[11px] font-semibold text-white bg-amber-600 hover:bg-amber-700 px-3 py-1.5 rounded transition-colors whitespace-nowrap self-start sm:self-auto"
                >
                  Open SOP →
                </Link>
              </div>
            ))}
          </div>
        )}

        {/* ── Unread notifications ────────────────────────── */}
        {recentNotifications.length > 0 && (
          <Section title={isClient ? 'Updates' : 'Notifications'}>
            <div className="divide-y divide-stone-50">
              {recentNotifications.map((n: any) => (
                <Link
                  key={n.id}
                  href={n.link ?? '#'}
                  className={`flex items-start gap-3 px-4 py-2.5 hover:bg-stone-50 transition-colors ${!n.read ? 'bg-blue-50/30' : ''}`}
                >
                  {!n.read && <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0" />}
                  <div className={`flex-1 min-w-0 ${n.read ? 'pl-4' : ''}`}>
                    <p className={`text-xs leading-snug truncate ${!n.read ? 'font-semibold text-stone-900' : 'text-stone-600'}`}>{n.title}</p>
                    <p className="text-[10px] text-stone-400 mt-0.5 truncate">{n.message}</p>
                  </div>
                  <p className="text-[10px] text-stone-400 flex-shrink-0">{formatDate(n.createdAt)}</p>
                </Link>
              ))}
            </div>
          </Section>
        )}

        {/* ── KPI cards ───────────────────────────────────── */}
        <div className={`grid gap-3 ${kpiCards.length <= 3 ? 'grid-cols-2 lg:grid-cols-3' : 'grid-cols-2 lg:grid-cols-4'}`}>
          {kpiCards.map((card) => (
            <KpiCard
              key={card.label}
              label={card.label}
              value={card.value}
              sub={card.sub}
              alert={(card as any).alert}
              icon={card.icon}
              iconColor={card.iconColor}
            />
          ))}
        </div>

        {/* ── Finance strip (admin only) ───────────────────── */}
        {isAdmin && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-white rounded-lg border border-stone-100 p-4">
              <div className="flex items-center gap-2 mb-1.5">
                <TrendingUp size={13} className="text-green-500" />
                <p className="text-[10px] uppercase tracking-widest text-stone-400 font-semibold">Income · This Month</p>
              </div>
              <p className="text-lg font-bold text-stone-900">{formatMoney(stats.monthlyIncome)}</p>
            </div>
            <div className="bg-white rounded-lg border border-stone-100 p-4">
              <div className="flex items-center gap-2 mb-1.5">
                <TrendingDown size={13} className="text-red-400" />
                <p className="text-[10px] uppercase tracking-widest text-stone-400 font-semibold">Expense · This Month</p>
              </div>
              <p className="text-lg font-bold text-stone-900">{formatMoney(stats.monthlyExpense)}</p>
            </div>
            <div className="bg-white rounded-lg border border-stone-100 p-4">
              <div className="flex items-center gap-2 mb-1.5">
                <IndianRupee size={13} className={monthlyNet >= 0 ? 'text-indigo-500' : 'text-red-400'} />
                <p className="text-[10px] uppercase tracking-widest text-stone-400 font-semibold">Net · This Month</p>
              </div>
              <p className={`text-lg font-bold ${monthlyNet >= 0 ? 'text-stone-900' : 'text-red-600'}`}>{formatMoney(monthlyNet)}</p>
            </div>
            <div className="bg-white rounded-lg border border-stone-100 p-4">
              <div className="flex items-center gap-2 mb-1.5">
                <TrendingDown size={13} className="text-amber-500" />
                <p className="text-[10px] uppercase tracking-widest text-stone-400 font-semibold">Loans Outstanding</p>
              </div>
              <p className="text-lg font-bold text-stone-900">{formatMoney(stats.pendingLoans)}</p>
            </div>
          </div>
        )}

        {/* ── Client: Content Timeline ─────────────────────── */}
        {isClient && stats.clientMonthTimeline && (
          <div className="bg-white rounded-lg border border-stone-100 overflow-hidden">
            <div className="px-4 py-2.5 border-b border-stone-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Film size={12} className="text-rose-400" />
                <p className="text-[11px] font-semibold text-stone-500 uppercase tracking-widest">
                  {new Date().toLocaleString('default', { month: 'long' })} Content
                </p>
              </div>
              <Link href="/content" className="flex items-center gap-1 text-[10px] text-stone-400 hover:text-stone-700 transition-colors">
                View all <ArrowUpRight size={10} />
              </Link>
            </div>
            <div className="p-4 space-y-4">
              {stats.clientMonthTimeline.needsReview > 0 && (
                <div className="flex items-center gap-2 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 text-[11px] font-medium text-amber-700">
                  <AlertCircle size={12} className="flex-shrink-0" />
                  {stats.clientMonthTimeline.needsReview} item{stats.clientMonthTimeline.needsReview > 1 ? 's' : ''} waiting for your review
                </div>
              )}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] font-medium text-stone-500">Posted this month</span>
                  <span className="text-[11px] font-bold text-stone-700">{stats.clientMonthTimeline.posted} / {stats.clientMonthTimeline.total}</span>
                </div>
                <div className="w-full bg-stone-100 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="h-full bg-rose-400 rounded-full transition-all duration-500"
                    style={{ width: `${stats.clientMonthTimeline.total > 0 ? Math.round((stats.clientMonthTimeline.posted / stats.clientMonthTimeline.total) * 100) : 0}%` }}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                {[
                  { label: 'First Posted', item: stats.clientMonthTimeline.firstPosted, color: 'text-emerald-600' },
                  { label: 'Latest Posted', item: stats.clientMonthTimeline.lastPosted, color: 'text-emerald-600' },
                  { label: 'Next Scheduled', item: stats.clientMonthTimeline.nextUpcoming, color: 'text-blue-600' },
                  { label: 'Last of Month', item: stats.clientMonthTimeline.lastOfMonth, color: 'text-violet-600' },
                ].map(({ label, item, color }) => (
                  <div key={label} className="bg-stone-50 rounded-lg p-2.5">
                    <p className="text-[9px] font-semibold text-stone-400 uppercase tracking-wide mb-1">{label}</p>
                    {item ? (
                      <>
                        <p className="text-xs font-semibold text-stone-800 truncate">{item.title}</p>
                        <p className={`text-[10px] font-medium mt-0.5 ${color}`}>{formatDate(item.postDate ?? item.updatedAt)}</p>
                      </>
                    ) : (
                      <p className="text-[10px] text-stone-400 italic">{label === 'Next Scheduled' ? 'All done!' : 'None yet'}</p>
                    )}
                  </div>
                ))}
              </div>
              {stats.clientMonthTimeline.items.length > 0 && (
                <div className="border border-stone-100 rounded-lg overflow-hidden">
                  <div className="px-3 py-2 bg-stone-50 border-b border-stone-100">
                    <p className="text-[9px] font-semibold text-stone-500 uppercase tracking-wide">Schedule</p>
                  </div>
                  <div className="divide-y divide-stone-50 max-h-56 overflow-y-auto">
                    {stats.clientMonthTimeline.items.map((item: any) => {
                      const isPosted = item.status === 'POSTED'
                      const isPast = !isPosted && item.postDate && new Date(item.postDate) < new Date()
                      return (
                        <div key={item.id} className="flex items-center gap-3 px-3 py-2">
                          <CheckCircle2 size={12} className={`flex-shrink-0 ${isPosted ? 'text-emerald-500' : 'text-stone-200'}`} />
                          <p className={`flex-1 text-xs truncate ${isPosted ? 'text-stone-400 line-through' : 'text-stone-800'}`}>{item.title}</p>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            {isPosted && <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700">Live</span>}
                            {isPast && <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-red-100 text-red-600">Late</span>}
                            {!isPosted && !isPast && <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-600">Sched.</span>}
                            <span className="text-[9px] text-stone-400">{formatDate(item.postDate)}</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Main 2-col: Tasks + Events ──────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Section title="Active Tasks" href="/tasks" hrefLabel="All tasks">
            <ActiveTasksList recentTasks={stats.recentTasks} isClient={isClient} />
          </Section>

          <Section title="This Week" href="/calendar" hrefLabel="Calendar">
            <div className="divide-y divide-stone-50">
              {stats.upcomingEvents.length === 0 && (
                <p className="px-4 py-6 text-xs text-stone-400 text-center">Nothing scheduled this week</p>
              )}
              {stats.upcomingEvents.map((event: any) => (
                <div key={event.id} className="px-4 py-2.5">
                  <div className="flex items-start justify-between gap-2 mb-0.5">
                    <p className="text-xs font-medium text-stone-900 truncate">{event.title}</p>
                    <Badge className={eventTypeColor(event.type as EventType)}>
                      {EVENT_TYPE_LABELS[event.type as EventType]}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] text-stone-400">
                    <CalendarIcon size={10} />
                    <span>{formatDate(event.startTime)}</span>
                    <span>·</span>
                    <span>{formatTime(event.startTime)}</span>
                    {event.project && <><span>·</span><span className="truncate">{event.project.name}</span></>}
                  </div>
                </div>
              ))}
            </div>
          </Section>
        </div>

        {/* ── Content tracker + Top projects (admin) ────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Section title="Content Tracker" href="/content" hrefLabel="All content">
            <div className="divide-y divide-stone-50">
              {stats.recentContent.length === 0 && (
                <p className="px-4 py-6 text-xs text-stone-400 text-center">No content items</p>
              )}
              {stats.recentContent.map((item: any) => (
                <div key={item.id} className="px-4 py-2.5 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-stone-900 truncate">{item.title}</p>
                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                      <Badge className={contentStatusColor(item.status as ContentStatus)}>
                        {CONTENT_STATUS_LABELS[item.status as ContentStatus]}
                      </Badge>
                      <span className="text-[10px] text-stone-400">{item.type}</span>
                      {item.project && <span className="text-[10px] text-stone-400 truncate">· {item.project.name}</span>}
                    </div>
                  </div>
                  {item.assignee && !isClient && (
                    <p className="text-[10px] text-stone-400 flex-shrink-0">{item.assignee.name}</p>
                  )}
                </div>
              ))}
            </div>
          </Section>

          {/* Top earning projects — admin only, otherwise empty state */}
          {isAdmin ? (
            <Section title="Top Earning Projects" href="/finance" hrefLabel="Finance">
              <div className="divide-y divide-stone-50">
                {stats.topClients.length === 0 && (
                  <p className="px-4 py-6 text-xs text-stone-400 text-center">No income recorded yet</p>
                )}
                {stats.topClients.map((c, i) => (
                  <div key={i} className="px-4 py-2.5 flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-stone-900 truncate">{c.project}</p>
                      {c.client && <p className="text-[10px] text-stone-400 mt-0.5">{c.client}</p>}
                    </div>
                    <p className="text-xs font-semibold text-stone-900 flex-shrink-0">{formatMoney(c.amount)}</p>
                  </div>
                ))}
              </div>
            </Section>
          ) : (
            // For non-admin: show upcoming notifications or empty to avoid a blank half-width column
            null
          )}
        </div>

        {/* ── Top Content Performance (when data exists) ───── */}
        {topMetrics.length > 0 && (
          <Section title="Top Content Performance" href="/content" hrefLabel="All content">
            <div className="divide-y divide-stone-50">
              {topMetrics.map((m: any) => (
                <div key={m.id} className="px-4 py-2.5 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-stone-100 text-stone-500 uppercase">{m.platform}</span>
                      <p className="text-xs font-medium text-stone-900 truncate">{m.content?.title ?? '—'}</p>
                    </div>
                    {m.content?.project && <p className="text-[10px] text-stone-400">{m.content.project.name}</p>}
                  </div>
                  <div className="flex items-center gap-3 text-[10px] text-stone-500 flex-shrink-0">
                    <span className="flex items-center gap-1"><Eye size={10} />{m.views.toLocaleString()}</span>
                    <span className="flex items-center gap-1"><Heart size={10} />{m.likes.toLocaleString()}</span>
                    <span className="flex items-center gap-1"><MessageCircle size={10} />{m.comments.toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </div>
          </Section>
        )}
      </div>
    </div>
  )
}
