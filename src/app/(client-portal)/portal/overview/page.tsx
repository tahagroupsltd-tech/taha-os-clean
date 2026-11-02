'use client'
// src/app/(client-portal)/portal/overview/page.tsx
import { useEffect, useState } from 'react'
import { useAuthStore } from '@/store/auth.store'
import { formatDate, formatMoney, contentStatusColor, CONTENT_STATUS_LABELS, eventTypeColor, EVENT_TYPE_LABELS } from '@/lib/utils'
import type { Project, Content, Event } from '@/types'
import { FolderOpen, Clock, CreditCard, CalendarCheck, Loader2 } from 'lucide-react'

function SkeletonCard() {
  return (
    <div className="bg-white border border-stone-200 rounded-xl p-5 animate-pulse">
      <div className="flex items-center justify-between mb-3">
        <div className="h-3 w-24 bg-stone-200 rounded" />
        <div className="h-6 w-6 bg-stone-200 rounded-lg" />
      </div>
      <div className="h-8 w-16 bg-stone-200 rounded mb-1" />
      <div className="h-2 w-20 bg-stone-100 rounded" />
    </div>
  )
}

function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 p-3 animate-pulse">
      <div className="h-4 flex-1 bg-stone-100 rounded" />
      <div className="h-5 w-16 bg-stone-100 rounded-full" />
    </div>
  )
}

export default function PortalOverviewPage() {
  const { user } = useAuthStore()
  const [projects, setProjects] = useState<Project[]>([])
  const [content, setContent] = useState<Content[]>([])
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchAll() {
      try {
        const [projRes, contentRes, eventsRes] = await Promise.all([
          fetch('/api/projects'),
          fetch('/api/content'),
          fetch('/api/events'),
        ])
        const [projData, contentData, eventsData] = await Promise.all([
          projRes.json(),
          contentRes.json(),
          eventsRes.json(),
        ])
        setProjects(projData.data ?? [])
        setContent(contentData.data ?? [])
        setEvents(eventsData.data ?? [])
      } catch {
        // silent
      } finally {
        setLoading(false)
      }
    }
    fetchAll()
  }, [])

  const today = new Date()
  const todayStr = today.toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })

  // Derived stats
  const activeProjects = projects.filter((p) => p.status === 'ACTIVE')

  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
  const contentThisMonth = content.filter((c) => new Date(c.createdAt) >= startOfMonth)

  const pendingContent = content.filter((c) => c.status !== 'POSTED')
  const nextDue = pendingContent
    .filter((c) => c.postDate)
    .sort((a, b) => new Date(a.postDate!).getTime() - new Date(b.postDate!).getTime())[0]

  const upcomingEvents = events
    .filter((e) => new Date(e.startTime) >= today)
    .slice(0, 3)

  const recentContent = [...content]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 5)

  const summaryCards = [
    {
      label: 'Active Projects',
      value: loading ? null : activeProjects.length,
      icon: FolderOpen,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
    },
    {
      label: 'Content This Month',
      value: loading ? null : contentThisMonth.length,
      icon: Clock,
      color: 'text-purple-600',
      bg: 'bg-purple-50',
    },
    {
      label: 'Total Content Items',
      value: loading ? null : content.length,
      icon: CreditCard,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
    },
    {
      label: 'Next Due',
      value: loading ? null : nextDue ? formatDate(nextDue.postDate) : '—',
      icon: CalendarCheck,
      color: 'text-green-600',
      bg: 'bg-green-50',
      isText: true,
    },
  ]

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-stone-900">
          Welcome back, {user?.name?.split(' ')[0]}! 👋
        </h1>
        <p className="text-sm text-stone-400 mt-1">{todayStr}</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
          : summaryCards.map((card) => {
              const Icon = card.icon
              return (
                <div key={card.label} className="bg-white border border-stone-200 rounded-xl p-5">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs text-stone-500 font-medium">{card.label}</p>
                    <div className={`w-7 h-7 rounded-lg ${card.bg} flex items-center justify-center`}>
                      <Icon className={`w-4 h-4 ${card.color}`} />
                    </div>
                  </div>
                  {card.isText ? (
                    <p className="text-base font-bold text-stone-900">{card.value}</p>
                  ) : (
                    <p className="text-3xl font-bold text-stone-900">{card.value}</p>
                  )}
                </div>
              )
            })}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Recent Content */}
        <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-stone-100">
            <h2 className="text-sm font-semibold text-stone-900">Recent Content</h2>
          </div>
          {loading ? (
            <div className="divide-y divide-stone-50">
              {Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} />)}
            </div>
          ) : recentContent.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <p className="text-sm text-stone-400">No content yet</p>
            </div>
          ) : (
            <div className="divide-y divide-stone-50">
              {recentContent.map((item) => (
                <div key={item.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-stone-900 truncate">{item.title}</p>
                    <p className="text-xs text-stone-400">{item.type} · {item.project?.name ?? '—'}</p>
                  </div>
                  <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${contentStatusColor(item.status)}`}>
                    {CONTENT_STATUS_LABELS[item.status]}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Upcoming Events */}
        <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-stone-100">
            <h2 className="text-sm font-semibold text-stone-900">Upcoming Events</h2>
          </div>
          {loading ? (
            <div className="divide-y divide-stone-50">
              {Array.from({ length: 3 }).map((_, i) => <SkeletonRow key={i} />)}
            </div>
          ) : upcomingEvents.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <p className="text-sm text-stone-400">No upcoming events</p>
            </div>
          ) : (
            <div className="divide-y divide-stone-50">
              {upcomingEvents.map((event) => (
                <div key={event.id} className="flex items-start gap-3 px-5 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-stone-900 truncate">{event.title}</p>
                    <p className="text-xs text-stone-400">
                      {formatDate(event.startTime)} · {new Date(event.startTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full border font-medium ${eventTypeColor(event.type)}`}>
                    {EVENT_TYPE_LABELS[event.type]}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
