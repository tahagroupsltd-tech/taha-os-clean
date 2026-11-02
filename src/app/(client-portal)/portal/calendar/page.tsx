'use client'
// src/app/(client-portal)/portal/calendar/page.tsx
import { useEffect, useState } from 'react'
import { formatDate, eventTypeColor, EVENT_TYPE_LABELS } from '@/lib/utils'
import type { Event } from '@/types'
import { CalendarDays } from 'lucide-react'

function groupEvents(events: Event[]): Record<string, Event[]> {
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const endOfToday = new Date(startOfToday.getTime() + 86400000)
  const endOfThisWeek = new Date(startOfToday.getTime() + 7 * 86400000)
  const endOfNextWeek = new Date(startOfToday.getTime() + 14 * 86400000)

  const groups: Record<string, Event[]> = {
    Today: [],
    'This Week': [],
    'Next Week': [],
    Later: [],
  }

  for (const event of events) {
    const d = new Date(event.startTime)
    if (d >= startOfToday && d < endOfToday) {
      groups['Today'].push(event)
    } else if (d >= endOfToday && d < endOfThisWeek) {
      groups['This Week'].push(event)
    } else if (d >= endOfThisWeek && d < endOfNextWeek) {
      groups['Next Week'].push(event)
    } else if (d >= endOfNextWeek) {
      groups['Later'].push(event)
    }
  }

  return groups
}

function SkeletonCard() {
  return (
    <div className="bg-white border border-stone-200 rounded-xl p-4 animate-pulse space-y-2">
      <div className="h-4 w-1/2 bg-stone-100 rounded" />
      <div className="h-3 w-1/3 bg-stone-100 rounded" />
    </div>
  )
}

export default function PortalCalendarPage() {
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/events')
      .then((r) => r.json())
      .then((d) => {
        const now = new Date()
        const upcoming = (d.data ?? []).filter((e: Event) => new Date(e.startTime) >= now)
        setEvents(upcoming)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const groups = groupEvents(events)
  const hasAny = Object.values(groups).some((g) => g.length > 0)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-stone-900">Calendar</h1>
        <p className="text-sm text-stone-400 mt-0.5">Upcoming meetings, shoots, and deadlines</p>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : !hasAny ? (
        <div className="text-center py-20">
          <CalendarDays className="w-10 h-10 text-stone-300 mx-auto mb-3" />
          <p className="text-sm text-stone-400">No upcoming events</p>
        </div>
      ) : (
        <div className="space-y-8">
          {(['Today', 'This Week', 'Next Week', 'Later'] as const).map((group) => {
            const items = groups[group]
            if (!items || items.length === 0) return null
            return (
              <div key={group}>
                <h2 className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-3">{group}</h2>
                <div className="space-y-3">
                  {items.map((event) => (
                    <div key={event.id} className="bg-white border border-stone-200 rounded-xl p-4 flex items-start gap-4">
                      {/* Date pill */}
                      <div className="shrink-0 w-12 h-12 rounded-xl bg-stone-50 border border-stone-200 flex flex-col items-center justify-center">
                        <span className="text-xs font-bold text-stone-900 leading-none">
                          {new Date(event.startTime).toLocaleDateString('en-IN', { day: '2-digit' })}
                        </span>
                        <span className="text-[10px] text-stone-400 uppercase leading-none mt-0.5">
                          {new Date(event.startTime).toLocaleDateString('en-IN', { month: 'short' })}
                        </span>
                      </div>
                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-stone-900">{event.title}</p>
                        <p className="text-xs text-stone-400 mt-0.5">
                          {new Date(event.startTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                          {' — '}
                          {new Date(event.endTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                          {event.location && ` · ${event.location}`}
                        </p>
                        {event.description && (
                          <p className="text-xs text-stone-500 mt-1 line-clamp-2">{event.description}</p>
                        )}
                      </div>
                      {/* Type badge */}
                      <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full border font-medium ${eventTypeColor(event.type)}`}>
                        {EVENT_TYPE_LABELS[event.type]}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
