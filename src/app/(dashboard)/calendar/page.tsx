'use client'
// src/app/(dashboard)/calendar/page.tsx
import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { TopBar } from '@/components/layout/TopBar'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Modal } from '@/components/ui/Modal'
import { useAuthStore } from '@/store/auth.store'
import {
  EVENT_TYPE_LABELS,
  eventTypeColor,
  formatTime,
  cn,
  taskStatusColor,
  taskPriorityColor,
  contentStatusColor,
  TASK_STATUS_LABELS,
  TASK_PRIORITY_LABELS,
  CONTENT_STATUS_LABELS,
} from '@/lib/utils'
import type { Event, EventType, Task, Content, TaskStatus, TaskPriority, ContentStatus } from '@/types'
import {
  Plus,
  Pencil,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Video,
  MapPin,
  Clock,
  ListTodo,
  ExternalLink,
  Scissors,
  FileText,
} from 'lucide-react'
import toast from 'react-hot-toast'

const TYPE_OPTIONS = Object.entries(EVENT_TYPE_LABELS).map(([v, l]) => ({ value: v, label: l }))

interface EventForm {
  title: string
  description: string
  type: EventType
  startDate: string
  startTime: string
  endTime: string
  location: string
  meetingLink: string
  projectId: string
}

interface CalendarItem {
  id: string // composite, e.g. `event-${e.id}`, `task-${t.id}`, `post-${c.id}`, `edit-${c.id}`
  title: string
  rawTitle: string
  description: string | null
  startTime: string
  endTime: string
  calendarType: 'event' | 'task' | 'content_post' | 'content_edit'
  eventType?: EventType
  assigneeName?: string | null
  projectName?: string | null
  projectId?: string | null
  status?: string | null
  priority?: string | null
  driveLink?: string | null
  scriptLink?: string | null
  scriptApproved?: boolean
  originalItem: any
}

// Timezone safe local YYYY-MM-DD formatter
const toLocalYYYYMMDD = (dateOrStr: Date | string) => {
  const d = new Date(dateOrStr)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const r = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${r}`
}

const todayISO = () => toLocalYYYYMMDD(new Date())

const nowHHMM = () => {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

const plusHourHHMM = () => {
  const d = new Date()
  d.setHours(d.getHours() + 1)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

const EMPTY = (): EventForm => ({
  title: '',
  description: '',
  type: 'MEETING',
  startDate: todayISO(),
  startTime: nowHHMM(),
  endTime: plusHourHHMM(),
  location: '',
  meetingLink: '',
  projectId: '',
})

function formatDuration(ms: number) {
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

function getTimerMiniLabel(item: CalendarItem, now: Date) {
  const target = new Date(item.startTime)
  const diff = target.getTime() - now.getTime()
  if (diff < 0) return '!'
  const hours = Math.floor(diff / (1000 * 60 * 60))
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  return `${days}d`
}

function getTimerInfo(item: CalendarItem, now: Date) {
  if (item.calendarType === 'task' && item.status === 'DONE') {
    return {
      timeLeftStr: 'Completed',
      colorClasses: 'bg-green-50 text-green-700 border-green-200',
      timerColor: 'green',
      isOverdue: false,
      isComplete: true,
    }
  }

  if (
    (item.calendarType === 'content_post' || item.calendarType === 'content_edit') &&
    item.status === 'POSTED'
  ) {
    return {
      timeLeftStr: 'Published',
      colorClasses: 'bg-green-50 text-green-700 border-green-200',
      timerColor: 'green',
      isOverdue: false,
      isComplete: true,
    }
  }

  const target = new Date(item.startTime)
  const diff = target.getTime() - now.getTime()

  if (diff < 0) {
    return {
      timeLeftStr: `Overdue by ${formatDuration(Math.abs(diff))}`,
      colorClasses: 'bg-red-50 text-red-700 border-red-200',
      timerColor: 'red',
      isOverdue: true,
      isComplete: false,
    }
  }

  // < 12h
  if (diff < 12 * 60 * 60 * 1000) {
    return {
      timeLeftStr: `${formatDuration(diff)} remaining`,
      colorClasses: 'bg-red-50 text-red-700 border-red-200',
      timerColor: 'red',
      isOverdue: false,
      isComplete: false,
    }
  }

  // < 24h
  if (diff < 24 * 60 * 60 * 1000) {
    return {
      timeLeftStr: `${formatDuration(diff)} remaining`,
      colorClasses: 'bg-rose-50 text-rose-700 border-rose-200',
      timerColor: 'pink',
      isOverdue: false,
      isComplete: false,
    }
  }

  // < 3 days
  if (diff < 3 * 24 * 60 * 60 * 1000) {
    return {
      timeLeftStr: `${formatDuration(diff)} remaining`,
      colorClasses: 'bg-amber-50 text-amber-700 border-amber-200',
      timerColor: 'amber',
      isOverdue: false,
      isComplete: false,
    }
  }

  // Safe (> 3 days)
  return {
    timeLeftStr: `${formatDuration(diff)} remaining`,
    colorClasses: 'bg-green-50 text-green-700 border-green-200',
    timerColor: 'green',
    isOverdue: false,
    isComplete: false,
  }
}

export default function CalendarPage() {
  const user = useAuthStore((s) => s.user)
  const router = useRouter()
  const [events, setEvents] = useState<Event[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [contents, setContents] = useState<Content[]>([])
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [cursor, setCursor] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<string>(todayISO())
  const [selectedItem, setSelectedItem] = useState<CalendarItem | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Event | null>(null)
  const [form, setForm] = useState<EventForm>(EMPTY())
  const [saving, setSaving] = useState(false)

  const [now, setNow] = useState(new Date())
  const [typeFilter, setTypeFilter] = useState('ALL')
  const [projectFilter, setProjectFilter] = useState('ALL')

  const isMountedRef = useRef(false)
  const [mounted, setMounted] = useState(false)

  // ── ALL hooks must be declared before any early returns (Rules of Hooks) ──

  const monthStart = useMemo(() => {
    const d = new Date(cursor)
    d.setDate(1)
    d.setHours(0, 0, 0, 0)
    return d
  }, [cursor])

  const monthEnd = useMemo(() => {
    const d = new Date(monthStart)
    d.setMonth(d.getMonth() + 1)
    return d
  }, [monthStart])

  const fetchEvents = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        from: monthStart.toISOString(),
        to: monthEnd.toISOString(),
      })
      const [eventsRes, tasksRes, contentRes] = await Promise.all([
        fetch(`/api/events?${params}`),
        fetch(`/api/tasks`),
        fetch(`/api/content`),
      ])
      const [eventsJson, tasksJson, contentJson] = await Promise.all([
        eventsRes.json(),
        tasksRes.json(),
        contentRes.json(),
      ])
      setEvents(eventsJson.data ?? [])
      setTasks(tasksJson.data ?? [])
      setContents(contentJson.data ?? [])
    } catch (err) {
      console.error('[calendar] error fetching calendar data:', err)
      toast.error('Failed to load calendar events')
    } finally {
      setLoading(false)
    }
  }, [monthStart, monthEnd])

  // Build the calendar grid (6 rows x 7 cols)
  const days = useMemo(() => {
    const startDay = new Date(monthStart)
    startDay.setDate(startDay.getDate() - startDay.getDay()) // back to Sunday
    return Array.from({ length: 42 }).map((_, i) => {
      const d = new Date(startDay)
      d.setDate(d.getDate() + i)
      return d
    })
  }, [monthStart])

  // Map and filter all items into a unified calendar items structure

  const calendarItems = useMemo(() => {
    const items: CalendarItem[] = []

    // 1. Add normal events
    for (const e of events) {
      items.push({
        id: `event-${e.id}`,
        title: e.title,
        rawTitle: e.title,
        description: e.description ?? null,
        startTime: e.startTime,
        endTime: e.endTime,
        calendarType: 'event',
        eventType: e.type,
        assigneeName: e.owner?.name ?? null,
        projectName: e.project?.name ?? null,
        projectId: e.projectId ?? null,
        originalItem: e,
      })
    }

    // Determine limits for tasks & content (e.g. within 2 months of current month view)
    const minTime = monthStart.getTime() - 15 * 24 * 60 * 60 * 1000
    const maxTime = monthEnd.getTime() + 15 * 24 * 60 * 60 * 1000

    // 2. Add tasks
    for (const t of tasks) {
      if (!t.deadline) continue
      const dTime = new Date(t.deadline).getTime()
      if (dTime < minTime || dTime > maxTime) continue

      const assigneeName = t.assignedTo?.name
      const showAssignee = user?.role !== 'CLIENT' && assigneeName
      items.push({
        id: `task-${t.id}`,
        title: `📋 Task: ${t.title}${showAssignee ? ` (${assigneeName})` : ''}`,
        rawTitle: t.title,
        description: t.description ?? null,
        startTime: t.deadline,
        endTime: t.deadline,
        calendarType: 'task',
        assigneeName: assigneeName ?? null,
        projectName: t.project?.name ?? null,
        projectId: t.projectId ?? null,
        status: t.status,
        priority: t.priority,
        originalItem: t,
      })
    }

    // 3. Add content posts and editor deadlines
    for (const c of contents) {
      if (!c.postDate) continue
      const postTime = new Date(c.postDate).getTime()
      const editTime = postTime - 2 * 24 * 60 * 60 * 1000
      const assigneeName = c.assignee?.name
      const showAssignee = user?.role !== 'CLIENT' && assigneeName

      // The content post itself
      if (postTime >= minTime && postTime <= maxTime) {
        items.push({
          id: `post-${c.id}`,
          title: `🚀 Post: ${c.title}${showAssignee ? ` (${assigneeName})` : ''}`,
          rawTitle: c.title,
          description: c.description ?? null,
          startTime: c.postDate,
          endTime: c.postDate,
          calendarType: 'content_post',
          assigneeName: assigneeName ?? null,
          projectName: c.project?.name ?? null,
          projectId: c.projectId ?? null,
          status: c.status,
          driveLink: c.driveLink ?? null,
          scriptLink: c.scriptLink ?? null,
          scriptApproved: c.scriptApproved ?? false,
          originalItem: c,
        })
      }

      // The editor deadline (exactly 2 days before)
      if (editTime >= minTime && editTime <= maxTime) {
        items.push({
          id: `edit-${c.id}`,
          title: `✂️ Edit: ${c.title}${showAssignee ? ` (${assigneeName})` : ''}`,
          rawTitle: c.title,
          description: c.description ?? null,
          startTime: new Date(editTime).toISOString(),
          endTime: new Date(editTime).toISOString(),
          calendarType: 'content_edit',
          assigneeName: assigneeName ?? null,
          projectName: c.project?.name ?? null,
          projectId: c.projectId ?? null,
          status: c.status,
          driveLink: c.driveLink ?? null,
          scriptLink: c.scriptLink ?? null,
          scriptApproved: c.scriptApproved ?? false,
          originalItem: c,
        })
      }
    }

    // Apply filtering
    return items.filter((item) => {
      // Project filter
      if (projectFilter !== 'ALL' && item.projectId !== projectFilter) {
        return false
      }

      // Type filter
      if (typeFilter !== 'ALL') {
        if (typeFilter === 'TASK' && item.calendarType !== 'task') return false
        if (typeFilter === 'CONTENT_POST' && item.calendarType !== 'content_post') return false
        if (typeFilter === 'CONTENT_EDIT' && item.calendarType !== 'content_edit') return false
        if (item.calendarType === 'event' && item.eventType !== typeFilter) return false
      }

      return true
    })
  }, [events, tasks, contents, monthStart, monthEnd, typeFilter, projectFilter])

  // Group items by local YYYY-MM-DD key
  const itemsByDay = useMemo(() => {
    const map = new Map<string, CalendarItem[]>()
    for (const item of calendarItems) {
      const key = toLocalYYYYMMDD(item.startTime)
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(item)
    }
    return map
  }, [calendarItems])

  // Track mounted with both a ref (sync, no re-render cost) and state (triggers re-render)
  // Using ref prevents the bundler from dead-code-eliminating hooks before the guard
  useEffect(() => {
    isMountedRef.current = true
    setMounted(true)
  }, [])

  // Live countdown ticker updating every 30s
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 30000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => { fetchEvents() }, [fetchEvents])

  useEffect(() => {
    if (user?.role !== 'CLIENT') {
      fetch('/api/projects')
        .then((r) => r.json())
        .then((j) => setProjects(j.data ?? []))
    }
  }, [user])

  // ── No early returns — all hooks always run. Skeleton shown via JSX conditional ──

  const openCreate = (forDate?: string) => {
    setEditing(null)
    setForm({ ...EMPTY(), startDate: forDate ?? todayISO() })
    setModalOpen(true)
  }

  const openEdit = (item: CalendarItem) => {
    const e = item.originalItem
    const start = new Date(e.startTime)
    const end = new Date(e.endTime)
    setEditing(e)
    setForm({
      title: e.title,
      description: e.description ?? '',
      type: e.type,
      startDate: start.toISOString().split('T')[0],
      startTime: `${String(start.getHours()).padStart(2, '0')}:${String(start.getMinutes()).padStart(2, '0')}`,
      endTime: `${String(end.getHours()).padStart(2, '0')}:${String(end.getMinutes()).padStart(2, '0')}`,
      location: e.location ?? '',
      meetingLink: e.meetingLink ?? '',
      projectId: e.projectId ?? '',
    })
    setModalOpen(true)
  }

  const handleSave = async () => {
    if (!form.title.trim()) return toast.error('Title is required')
    if (!form.startDate || !form.startTime || !form.endTime) {
      return toast.error('Date/time required')
    }
    const startISO = new Date(`${form.startDate}T${form.startTime}`).toISOString()
    const endISO = new Date(`${form.startDate}T${form.endTime}`).toISOString()
    if (new Date(endISO) <= new Date(startISO)) {
      return toast.error('End time must be after start time')
    }

    setSaving(true)
    try {
      const payload = {
        title: form.title.trim(),
        description: form.description || null,
        type: form.type,
        startTime: startISO,
        endTime: endISO,
        location: form.location || null,
        meetingLink: form.meetingLink || null,
        projectId: form.projectId || null,
      }
      const res = editing
        ? await fetch(`/api/events/${editing.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
        : await fetch('/api/events', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
      if (!res.ok) throw new Error((await res.json()).error || 'Save failed')
      toast.success(editing ? 'Updated' : 'Event created')
      setModalOpen(false)
      fetchEvents()
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this event?')) return
    const res = await fetch(`/api/events/${id}`, { method: 'DELETE' })
    if (res.ok) {
      toast.success('Deleted')
      setEvents((p) => p.filter((e) => e.id !== id))
      setSelectedItem(null)
    }
  }

  const monthLabel = cursor.toLocaleString('en-IN', { month: 'long', year: 'numeric' })
  const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const isCurrentMonth = (d: Date) => d.getMonth() === cursor.getMonth()
  const isToday = (d: Date) => toLocalYYYYMMDD(d) === todayISO()
  const isSelected = (d: Date) => toLocalYYYYMMDD(d) === selectedDate

  // Skeleton shown via JSX conditional — never via early return (prevents hook reorder bug)
  if (!mounted) {
    return (
      <div className="flex flex-col h-full overflow-hidden bg-stone-50">
        <TopBar title="Calendar" />
        <div className="flex-1 p-5">
          <div className="animate-pulse space-y-4">
            <div className="h-10 bg-stone-200 rounded w-1/4" />
            <div className="h-40 bg-stone-200 rounded" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <TopBar
        title="Calendar"
        actions={
          <div className="flex items-center gap-2">
            <Select
              options={[
                { value: 'ALL', label: 'All Types' },
                { value: 'MEETING', label: 'Meetings' },
                { value: 'SHOOT', label: 'Shoots' },
                { value: 'DEADLINE', label: 'Deadlines' },
                { value: 'REVIEW', label: 'Reviews' },
                { value: 'CALL', label: 'Calls' },
                { value: 'TASK', label: 'Tasks' },
                { value: 'CONTENT_POST', label: 'Content Posts' },
                { value: 'CONTENT_EDIT', label: 'Content Edits' },
                { value: 'OTHER', label: 'Other' },
              ]}
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-32 text-xs py-1 h-8"
            />
            {projects.length > 0 && (
              <Select
                options={[
                  { value: 'ALL', label: 'All Projects' },
                  ...projects.map((p) => ({ value: p.id, label: p.name })),
                ]}
                value={projectFilter}
                onChange={(e) => setProjectFilter(e.target.value)}
                className="w-36 text-xs py-1 h-8"
              />
            )}
            {user?.role !== 'CLIENT' && (
              <Button size="sm" className="h-8 px-2 text-xs" onClick={() => openCreate()}>
                <Plus size={12} className="mr-0.5" /> New event
              </Button>
            )}
          </div>
        }
      />

      <div className="flex flex-1 overflow-hidden">
        {/* Calendar grid */}
        <div className="flex flex-col p-5 overflow-hidden flex-1">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-stone-900">{monthLabel}</h2>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCursor(new Date())}
                className="text-xs px-3 py-1.5 rounded-md border border-stone-200 text-stone-600 hover:bg-stone-50"
              >
                Today
              </button>
              <button
                onClick={() => {
                  const d = new Date(cursor)
                  d.setMonth(d.getMonth() - 1)
                  setCursor(d)
                }}
                className="p-1.5 rounded-md hover:bg-stone-100 text-stone-500"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={() => {
                  const d = new Date(cursor)
                  d.setMonth(d.getMonth() + 1)
                  setCursor(d)
                }}
                className="p-1.5 rounded-md hover:bg-stone-100 text-stone-500"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-px bg-stone-200 border border-stone-200 rounded-lg overflow-hidden flex-1">
            {dayLabels.map((d) => (
              <div
                key={d}
                className="bg-stone-50 text-[10px] font-semibold text-stone-500 uppercase tracking-wider px-2 py-1.5 text-center"
              >
                {d}
              </div>
            ))}
            {days.map((d) => {
              const key = toLocalYYYYMMDD(d)
              const dayItems = itemsByDay.get(key) ?? []
              return (
                <button
                  key={key}
                  onClick={() => setSelectedDate(key)}
                  className={cn(
                    'bg-white p-1.5 text-left flex flex-col gap-1 min-h-[70px] hover:bg-stone-50 transition-colors relative',
                    !isCurrentMonth(d) && 'bg-stone-50/50 text-stone-300',
                    isSelected(d) && 'ring-2 ring-stone-900 ring-inset'
                  )}
                >
                  <div
                    className={cn(
                      'text-[11px] font-medium w-5 h-5 rounded-full flex items-center justify-center',
                      isToday(d) ? 'bg-stone-900 text-white' : 'text-stone-700',
                      !isCurrentMonth(d) && !isToday(d) && 'text-stone-300'
                    )}
                  >
                    {d.getDate()}
                  </div>
                  <div className="flex flex-col gap-0.5 w-full">
                    {dayItems.slice(0, 2).map((item) => {
                      const timer = item.calendarType !== 'event' ? getTimerInfo(item, now) : null
                      return (
                        <div
                          key={item.id}
                          onClick={(ev) => {
                            ev.stopPropagation()
                            setSelectedItem(item)
                          }}
                          className={cn(
                            'text-[9px] truncate px-1 py-0.5 rounded border cursor-pointer hover:opacity-80 flex items-center justify-between gap-1 w-full font-medium',
                            item.calendarType === 'event' ? eventTypeColor(item.eventType!) : timer?.colorClasses,
                            selectedItem?.id === item.id && 'ring-1 ring-stone-900'
                          )}
                        >
                          <span className="truncate flex-1">{item.title}</span>
                          {item.calendarType !== 'event' && timer && !timer.isComplete && (
                            <span className="text-[8px] opacity-75 font-semibold shrink-0">
                              {getTimerMiniLabel(item, now)}
                            </span>
                          )}
                        </div>
                      )
                    })}
                    {dayItems.length > 2 && (
                      <div className="text-[9px] text-stone-400">+{dayItems.length - 2} more</div>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Right panel: shown only when a calendar item is clicked */}
        {selectedItem && (
          <div className="w-80 border-l border-stone-100 bg-white flex flex-col shadow-sm">
            <div className="p-4 border-b border-stone-100 flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-stone-900 leading-snug mb-1">{selectedItem.rawTitle}</p>
                <span
                  className={cn(
                    'inline-block text-[9px] px-1.5 py-0.5 rounded border font-medium',
                    selectedItem.calendarType === 'event'
                      ? eventTypeColor(selectedItem.eventType!)
                      : selectedItem.calendarType === 'task'
                      ? 'bg-blue-50 text-blue-700 border-blue-200'
                      : selectedItem.calendarType === 'content_post'
                      ? 'bg-purple-50 text-purple-700 border-purple-200'
                      : 'bg-rose-50 text-rose-700 border-rose-200'
                  )}
                >
                  {selectedItem.calendarType === 'event'
                    ? EVENT_TYPE_LABELS[selectedItem.eventType!]
                    : selectedItem.calendarType === 'task'
                    ? 'Task'
                    : selectedItem.calendarType === 'content_post'
                    ? 'Content Post'
                    : 'Editor Deadline'}
                </span>
              </div>
              <button
                onClick={() => setSelectedItem(null)}
                className="p-1 text-stone-300 hover:text-stone-700 flex-shrink-0"
              >
                ✕
              </button>
            </div>

            {/* Prominent urgency / countdown banner */}
            {selectedItem.calendarType !== 'event' && (() => {
              const timer = getTimerInfo(selectedItem, now)
              return (
                <div
                  className={cn(
                    'mx-4 mt-3 p-2.5 rounded-md border text-center font-semibold text-xs flex items-center justify-center gap-1.5',
                    timer.colorClasses
                  )}
                >
                  {!timer.isComplete && (
                    <Clock
                      size={13}
                      className={cn(timer.timerColor === 'red' && 'animate-pulse')}
                    />
                  )}
                  <span>{timer.timeLeftStr}</span>
                </div>
              )
            })()}

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              <div className="text-xs text-stone-600 space-y-2">
                {/* Time or Due Date */}
                <div className="flex items-center gap-2">
                  <Clock size={12} className="text-stone-400" />
                  <span>
                    {selectedItem.calendarType === 'event' ? (
                      <>
                        {new Date(selectedItem.startTime).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                        {' · '}
                        {formatTime(selectedItem.startTime)}–{formatTime(selectedItem.endTime)}
                      </>
                    ) : (
                      <>
                        Due:{' '}
                        {new Date(selectedItem.startTime).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </>
                    )}
                  </span>
                </div>

                {/* Location (Standard event only) */}
                {selectedItem.calendarType === 'event' && selectedItem.originalItem.location && (
                  <div className="flex items-center gap-2">
                    <MapPin size={12} className="text-stone-400" />
                    <span className="truncate">{selectedItem.originalItem.location}</span>
                  </div>
                )}

                {/* Meeting Link (Standard event only) */}
                {selectedItem.calendarType === 'event' && selectedItem.originalItem.meetingLink && (
                  <a
                    href={selectedItem.originalItem.meetingLink}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2 text-blue-600 hover:underline"
                  >
                    <Video size={12} />
                    <span className="truncate">Join meeting</span>
                  </a>
                )}

                {/* Assignee (Tasks & Content) — hide for CLIENT */}
                {selectedItem.assigneeName && user?.role !== 'CLIENT' && (
                  <div className="flex items-center gap-2">
                    <span className="text-stone-400 text-[11px]">Assignee:</span>
                    <span className="text-stone-700 font-semibold text-[11px]">{selectedItem.assigneeName}</span>
                  </div>
                )}

                {/* Project */}
                {selectedItem.projectName && (
                  <div className="flex items-center gap-2">
                    <span className="text-stone-400 text-[11px]">Project:</span>
                    <span className="text-stone-600 text-[11px]">{selectedItem.projectName}</span>
                  </div>
                )}

                {/* Task Status & Priority */}
                {selectedItem.calendarType === 'task' && (
                  <div className="flex flex-wrap items-center gap-1.5 mt-1">
                    <span
                      className={cn(
                        'text-[10px] px-1.5 py-0.5 rounded border font-medium',
                        taskStatusColor(selectedItem.status as TaskStatus)
                      )}
                    >
                      {TASK_STATUS_LABELS[selectedItem.status as TaskStatus]}
                    </span>
                    <span
                      className={cn(
                        'text-[10px] px-1.5 py-0.5 rounded border font-medium',
                        taskPriorityColor(selectedItem.priority as TaskPriority)
                      )}
                    >
                      {TASK_PRIORITY_LABELS[selectedItem.priority as TaskPriority]}
                    </span>
                  </div>
                )}

                {/* Content Status & Type */}
                {(selectedItem.calendarType === 'content_post' || selectedItem.calendarType === 'content_edit') && (
                  <div className="flex flex-wrap items-center gap-1.5 mt-1">
                    <span
                      className={cn(
                        'text-[10px] px-1.5 py-0.5 rounded border font-medium',
                        contentStatusColor(selectedItem.status as ContentStatus)
                      )}
                    >
                      {CONTENT_STATUS_LABELS[selectedItem.status as ContentStatus]}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded border border-stone-200 bg-stone-50 text-stone-600 font-medium">
                      {selectedItem.originalItem.type}
                    </span>
                  </div>
                )}

                {/* Drive Link (Content only) */}
                {(selectedItem.calendarType === 'content_post' || selectedItem.calendarType === 'content_edit') &&
                  selectedItem.driveLink && (
                    <div className="pt-1">
                      <a
                        href={selectedItem.driveLink}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center justify-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 bg-blue-50/50 hover:bg-blue-50 border border-blue-100 rounded-md py-1.5 px-3 transition-colors w-full"
                      >
                        <ExternalLink size={12} />
                        <span className="truncate">Open Assets (Drive)</span>
                      </a>
                    </div>
                  )}

                {/* Script Link (Content only) */}
                {(selectedItem.calendarType === 'content_post' || selectedItem.calendarType === 'content_edit') &&
                  selectedItem.scriptLink && (
                    <div className="pt-1 flex flex-col gap-1">
                      <a
                        href={selectedItem.scriptLink}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center justify-center gap-1.5 text-xs text-emerald-600 hover:text-emerald-700 bg-emerald-50/50 hover:bg-emerald-50 border border-emerald-100 rounded-md py-1.5 px-3 transition-colors w-full"
                      >
                        <FileText size={12} />
                        <span className="truncate">Open Script Document</span>
                      </a>
                      <div className="text-[10px] text-center text-stone-500">
                        Status:{' '}
                        <span className={selectedItem.scriptApproved ? 'text-green-600 font-semibold' : 'text-amber-600 font-semibold'}>
                          {selectedItem.scriptApproved ? 'Approved' : 'Pending Approval'}
                        </span>
                      </div>
                    </div>
                  )}
              </div>

              {/* Description/Notes */}
              {selectedItem.description && (
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-stone-400 font-medium mb-1">Notes</p>
                  <p className="text-xs text-stone-600 leading-relaxed bg-stone-50 rounded-md p-3 whitespace-pre-wrap">
                    {selectedItem.description}
                  </p>
                </div>
              )}

              {/* Quick Navigation — hide Go to Tasks for CLIENT */}
              {selectedItem.calendarType === 'task' && user?.role !== 'CLIENT' && (
                <div className="pt-2">
                  <Button
                    size="sm"
                    className="w-full flex items-center justify-center gap-1.5 text-xs h-9"
                    onClick={() => router.push('/tasks')}
                  >
                    <ListTodo size={12} /> Go to Tasks
                  </Button>
                </div>
              )}

              {(selectedItem.calendarType === 'content_post' || selectedItem.calendarType === 'content_edit') && (
                <div className="pt-2">
                  <Button
                    size="sm"
                    className="w-full flex items-center justify-center gap-1.5 text-xs h-9"
                    onClick={() => router.push('/content')}
                  >
                    <Video size={12} /> Go to Content Planner
                  </Button>
                </div>
              )}
            </div>

            {/* Standard Event editing/deleting */}
            {selectedItem.calendarType === 'event' &&
              (user?.role === 'ADMIN' ||
                user?.role === 'MANAGER' ||
                selectedItem.originalItem.ownerId === user?.id) && (
                <div className="p-4 border-t border-stone-100 flex items-center gap-2">
                  <button
                    onClick={() => {
                      openEdit(selectedItem)
                      setSelectedItem(null)
                    }}
                    className="flex-1 flex items-center justify-center gap-1.5 text-xs font-medium text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-md py-2 transition-colors"
                  >
                    <Pencil size={11} /> Edit
                  </button>
                  <button
                    onClick={() => handleDelete(selectedItem.originalItem.id)}
                    className="flex-1 flex items-center justify-center gap-1.5 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-md py-2 transition-colors"
                  >
                    <Trash2 size={11} /> Delete
                  </button>
                </div>
              )}
          </div>
        )}
      </div>

      {/* Event modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Event' : 'New Event'}
        size="md"
      >
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <Input
              label="Title"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="e.g. Client kickoff call"
            />
          </div>
          <Select
            label="Type"
            options={TYPE_OPTIONS}
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value as EventType })}
          />
          <Input
            label="Date"
            type="date"
            value={form.startDate}
            onChange={(e) => setForm({ ...form, startDate: e.target.value })}
          />
          <Input
            label="Start time"
            type="time"
            value={form.startTime}
            onChange={(e) => setForm({ ...form, startTime: e.target.value })}
          />
          <Input
            label="End time"
            type="time"
            value={form.endTime}
            onChange={(e) => setForm({ ...form, endTime: e.target.value })}
          />
          <div className="col-span-2">
            <Input
              label="Location"
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
              placeholder="Office, client site, etc."
            />
          </div>
          <div className="col-span-2">
            <Input
              label="Meeting link"
              value={form.meetingLink}
              onChange={(e) => setForm({ ...form, meetingLink: e.target.value })}
              placeholder="https://meet.google.com/..."
            />
          </div>
          <div className="col-span-2">
            <label className="text-xs font-medium text-stone-600 uppercase tracking-wide block mb-1.5">
              Description
            </label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Agenda, notes..."
              rows={2}
              className="w-full rounded-md border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-400 resize-none"
            />
          </div>
          {projects.length > 0 && (
            <div className="col-span-2">
              <Select
                label="Project (optional)"
                placeholder="No project"
                options={projects.map((p) => ({ value: p.id, label: p.name }))}
                value={form.projectId}
                onChange={(e) => setForm({ ...form, projectId: e.target.value })}
              />
            </div>
          )}
          <div className="col-span-2 flex gap-2 pt-1">
            <Button
              variant="secondary"
              size="sm"
              className="flex-1"
              onClick={() => setModalOpen(false)}
            >
              Cancel
            </Button>
            <Button size="sm" className="flex-1" loading={saving} onClick={handleSave}>
              {editing ? 'Save changes' : 'Create event'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
