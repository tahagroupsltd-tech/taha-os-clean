'use client'
// src/app/(dashboard)/calendar/page.tsx
import { useState, useEffect, useCallback, useMemo } from 'react'
import { TopBar } from '@/components/layout/TopBar'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Modal } from '@/components/ui/Modal'
import { useAuthStore } from '@/store/auth.store'
import { EVENT_TYPE_LABELS, eventTypeColor, formatTime, cn } from '@/lib/utils'
import type { Event, EventType } from '@/types'
import { Plus, Pencil, Trash2, ChevronLeft, ChevronRight, Video, MapPin, Clock } from 'lucide-react'
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

const todayISO = () => new Date().toISOString().split('T')[0]
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

export default function CalendarPage() {
  const user = useAuthStore((s) => s.user)
  const [events, setEvents] = useState<Event[]>([])
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [cursor, setCursor] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<string>(todayISO())
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Event | null>(null)
  const [form, setForm] = useState<EventForm>(EMPTY())
  const [saving, setSaving] = useState(false)

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
    const params = new URLSearchParams({
      from: monthStart.toISOString(),
      to: monthEnd.toISOString(),
    })
    const res = await fetch(`/api/events?${params}`)
    const json = await res.json()
    setEvents(json.data ?? [])
    setLoading(false)
  }, [monthStart, monthEnd])

  useEffect(() => { fetchEvents() }, [fetchEvents])

  useEffect(() => {
    if (user?.role !== 'CLIENT') {
      fetch('/api/projects').then(r => r.json()).then(j => setProjects(j.data ?? []))
    }
  }, [user])

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

  const eventsByDay = useMemo(() => {
    const map = new Map<string, Event[]>()
    for (const e of events) {
      const key = new Date(e.startTime).toISOString().split('T')[0]
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(e)
    }
    return map
  }, [events])

  const selectedDayEvents = useMemo(() => {
    return (eventsByDay.get(selectedDate) ?? []).sort((a, b) =>
      new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
    )
  }, [eventsByDay, selectedDate])

  const openCreate = (forDate?: string) => {
    setEditing(null)
    setForm({ ...EMPTY(), startDate: forDate ?? todayISO() })
    setModalOpen(true)
  }

  const openEdit = (e: Event) => {
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
      setSelectedEvent(null)
    }
  }

  const monthLabel = cursor.toLocaleString('en-IN', { month: 'long', year: 'numeric' })
  const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const isCurrentMonth = (d: Date) => d.getMonth() === cursor.getMonth()
  const isToday = (d: Date) => d.toISOString().split('T')[0] === todayISO()
  const isSelected = (d: Date) => d.toISOString().split('T')[0] === selectedDate

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <TopBar
        title="Calendar"
        actions={
          user?.role !== 'CLIENT' && (
            <Button size="sm" onClick={() => openCreate()}>
              <Plus size={13} /> New event
            </Button>
          )
        }
      />

      <div className="flex flex-1 overflow-hidden">
        {/* Calendar grid */}
        <div className={cn('flex flex-col p-5 overflow-hidden transition-all', selectedEvent ? 'flex-1' : 'flex-1')}>
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
                  const d = new Date(cursor); d.setMonth(d.getMonth() - 1); setCursor(d)
                }}
                className="p-1.5 rounded-md hover:bg-stone-100 text-stone-500"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={() => {
                  const d = new Date(cursor); d.setMonth(d.getMonth() + 1); setCursor(d)
                }}
                className="p-1.5 rounded-md hover:bg-stone-100 text-stone-500"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-px bg-stone-200 border border-stone-200 rounded-lg overflow-hidden flex-1">
            {dayLabels.map((d) => (
              <div key={d} className="bg-stone-50 text-[10px] font-semibold text-stone-500 uppercase tracking-wider px-2 py-1.5 text-center">
                {d}
              </div>
            ))}
            {days.map((d) => {
              const key = d.toISOString().split('T')[0]
              const dayEvents = eventsByDay.get(key) ?? []
              return (
                <button
                  key={key}
                  onClick={() => setSelectedDate(key)}
                  className={cn(
                    'bg-white p-1.5 text-left flex flex-col gap-1 min-h-[70px] hover:bg-stone-50 transition-colors',
                    !isCurrentMonth(d) && 'bg-stone-50/50 text-stone-300',
                    isSelected(d) && 'ring-2 ring-stone-900 ring-inset',
                  )}
                >
                  <div className={cn(
                    'text-[11px] font-medium w-5 h-5 rounded-full flex items-center justify-center',
                    isToday(d) ? 'bg-stone-900 text-white' : 'text-stone-700',
                    !isCurrentMonth(d) && !isToday(d) && 'text-stone-300',
                  )}>
                    {d.getDate()}
                  </div>
                  <div className="flex flex-col gap-0.5">
                    {dayEvents.slice(0, 2).map((e) => (
                      <div
                        key={e.id}
                        onClick={(ev) => { ev.stopPropagation(); setSelectedEvent(e) }}
                        className={cn(
                          'text-[9px] truncate px-1 py-0.5 rounded border cursor-pointer hover:opacity-80',
                          eventTypeColor(e.type),
                          selectedEvent?.id === e.id && 'ring-1 ring-stone-900'
                        )}
                      >
                        {e.title}
                      </div>
                    ))}
                    {dayEvents.length > 2 && (
                      <div className="text-[9px] text-stone-400">+{dayEvents.length - 2} more</div>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Right panel: shown only when an event is clicked */}
        {selectedEvent && (
          <div className="w-80 border-l border-stone-100 bg-white flex flex-col shadow-sm">
            <div className="p-4 border-b border-stone-100 flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-stone-900 leading-snug mb-1">{selectedEvent.title}</p>
                <span className={cn(
                  'inline-block text-[9px] px-1.5 py-0.5 rounded border font-medium',
                  eventTypeColor(selectedEvent.type)
                )}>
                  {EVENT_TYPE_LABELS[selectedEvent.type]}
                </span>
              </div>
              <button
                onClick={() => setSelectedEvent(null)}
                className="p-1 text-stone-300 hover:text-stone-700 flex-shrink-0"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              <div className="text-xs text-stone-600 space-y-2">
                <div className="flex items-center gap-2">
                  <Clock size={12} className="text-stone-400" />
                  <span>
                    {new Date(selectedEvent.startTime).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    {' · '}
                    {formatTime(selectedEvent.startTime)}–{formatTime(selectedEvent.endTime)}
                  </span>
                </div>
                {selectedEvent.location && (
                  <div className="flex items-center gap-2">
                    <MapPin size={12} className="text-stone-400" />
                    <span className="truncate">{selectedEvent.location}</span>
                  </div>
                )}
                {selectedEvent.meetingLink && (
                  <a
                    href={selectedEvent.meetingLink}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2 text-blue-600 hover:underline"
                  >
                    <Video size={12} />
                    <span className="truncate">Join meeting</span>
                  </a>
                )}
                {selectedEvent.project && (
                  <div className="flex items-center gap-2">
                    <span className="text-stone-400 text-[11px]">Project:</span>
                    <span className="text-stone-600 text-[11px]">{selectedEvent.project.name}</span>
                  </div>
                )}
              </div>
              {selectedEvent.description && (
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-stone-400 font-medium mb-1">Notes</p>
                  <p className="text-xs text-stone-600 leading-relaxed bg-stone-50 rounded-md p-3">
                    {selectedEvent.description}
                  </p>
                </div>
              )}
            </div>
            {(user?.role === 'ADMIN' || user?.role === 'MANAGER' || selectedEvent.ownerId === user?.id) && (
              <div className="p-4 border-t border-stone-100 flex items-center gap-2">
                <button
                  onClick={() => { openEdit(selectedEvent); setSelectedEvent(null) }}
                  className="flex-1 flex items-center justify-center gap-1.5 text-xs font-medium text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-md py-2 transition-colors"
                >
                  <Pencil size={11} /> Edit
                </button>
                <button
                  onClick={() => handleDelete(selectedEvent.id)}
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
            <Button variant="secondary" size="sm" className="flex-1" onClick={() => setModalOpen(false)}>
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
