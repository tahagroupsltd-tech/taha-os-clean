'use client'
// src/app/(dashboard)/content/page.tsx
import { useState, useEffect, useCallback, useMemo } from 'react'
import { TopBar } from '@/components/layout/TopBar'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { useAuthStore } from '@/store/auth.store'
import { contentStatusColor, formatDate, CONTENT_STATUS_LABELS } from '@/lib/utils'
import type { Content, ContentType, ContentStatus } from '@/types'
import {
  Plus, Pencil, Trash2, ExternalLink,
  LayoutGrid, CalendarDays, ChevronLeft, ChevronRight, X,
} from 'lucide-react'
import toast from 'react-hot-toast'

// ─── Constants ────────────────────────────────────────────────────────────────
const STATUS_PIPELINE: ContentStatus[] = ['IDEA','SCRIPTING','SHOOTING','EDITING','REVIEW','POSTED']

const TYPE_OPTIONS: { value: ContentType; label: string }[] = [
  { value: 'REEL',    label: 'Reel'    },
  { value: 'POSTER',  label: 'Poster'  },
  { value: 'STORY',   label: 'Story'   },
  { value: 'VIDEO',   label: 'Video'   },
  { value: 'GRAPHIC', label: 'Graphic' },
]

const STATUS_OPTIONS = STATUS_PIPELINE.map((s) => ({ value: s, label: CONTENT_STATUS_LABELS[s] }))

// type → pill colour (calendar)
const TYPE_COLORS: Record<ContentType, string> = {
  REEL:    'bg-blue-100 text-blue-800 border-blue-200',
  POSTER:  'bg-green-100 text-green-800 border-green-200',
  STORY:   'bg-amber-100 text-amber-800 border-amber-200',
  VIDEO:   'bg-violet-100 text-violet-800 border-violet-200',
  GRAPHIC: 'bg-pink-100 text-pink-800 border-pink-200',
}

const TYPE_DOT: Record<ContentType, string> = {
  REEL:    'bg-blue-500',
  POSTER:  'bg-green-500',
  STORY:   'bg-amber-500',
  VIDEO:   'bg-violet-500',
  GRAPHIC: 'bg-pink-500',
}

const MONTH_NAMES = ['January','February','March','April','May','June',
  'July','August','September','October','November','December']
const DAY_NAMES = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

// ─── Form ─────────────────────────────────────────────────────────────────────
interface ContentForm {
  title: string; type: ContentType; status: ContentStatus
  description: string; driveLink: string; caption: string
  postDate: string; assigneeId: string; projectId: string
}
const EMPTY: ContentForm = {
  title: '', type: 'REEL', status: 'IDEA',
  description: '', driveLink: '', caption: '',
  postDate: '', assigneeId: '', projectId: '',
}

// ─── Calendar grid builder ────────────────────────────────────────────────────
function buildCalendarGrid(year: number, month: number): (Date | null)[][] {
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells: (Date | null)[] = Array(firstDay).fill(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d))
  while (cells.length % 7 !== 0) cells.push(null)
  const rows: (Date | null)[][] = []
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7))
  return rows
}

function isoDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

// ─── Calendar View ────────────────────────────────────────────────────────────
function CalendarView({
  items, projects, filterType, filterProject,
  onFilterType, onFilterProject, onEdit, canEdit,
}: {
  items: Content[]
  projects: { id: string; name: string }[]
  filterType: string
  filterProject: string
  onFilterType: (v: string) => void
  onFilterProject: (v: string) => void
  onEdit: (c: Content) => void
  canEdit: boolean
}) {
  const today = new Date()
  const [curYear, setCurYear] = useState(today.getFullYear())
  const [curMonth, setCurMonth] = useState(today.getMonth())
  const [selectedDay, setSelectedDay] = useState<string | null>(null)

  const grid = useMemo(() => buildCalendarGrid(curYear, curMonth), [curYear, curMonth])

  // Build a map: isoDate → Content[]
  const byDate = useMemo(() => {
    const map = new Map<string, Content[]>()
    for (const item of items) {
      if (!item.postDate) continue
      const key = item.postDate.split('T')[0]
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(item)
    }
    return map
  }, [items])

  const prevMonth = () => {
    if (curMonth === 0) { setCurYear(y => y - 1); setCurMonth(11) }
    else setCurMonth(m => m - 1)
    setSelectedDay(null)
  }
  const nextMonth = () => {
    if (curMonth === 11) { setCurYear(y => y + 1); setCurMonth(0) }
    else setCurMonth(m => m + 1)
    setSelectedDay(null)
  }

  const todayStr = isoDate(today)
  const selectedItems = selectedDay ? (byDate.get(selectedDay) ?? []) : []

  return (
    <div className="flex-1 overflow-y-auto p-5 pt-3 flex flex-col gap-4">
      {/* Calendar filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <Select
          options={[{ value: '', label: 'All types' }, ...TYPE_OPTIONS]}
          value={filterType}
          onChange={(e) => onFilterType(e.target.value)}
          className="h-8 text-xs w-28"
        />
        <Select
          options={[{ value: '', label: 'All projects' }, ...projects.map(p => ({ value: p.id, label: p.name }))]}
          value={filterProject}
          onChange={(e) => onFilterProject(e.target.value)}
          className="h-8 text-xs w-36"
        />
        {/* Type legend */}
        <div className="flex items-center gap-2 ml-auto flex-wrap">
          {TYPE_OPTIONS.map(t => (
            <span key={t.value} className="flex items-center gap-1 text-[10px] text-stone-500">
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${TYPE_DOT[t.value]}`} />
              {t.label}
            </span>
          ))}
        </div>
      </div>

      {/* Month nav */}
      <div className="bg-white rounded-lg border border-stone-100 shadow-sm overflow-hidden flex-1 flex flex-col min-h-0">
        <div className="flex items-center justify-between px-4 py-3 border-b border-stone-100">
          <button onClick={prevMonth} className="p-1.5 rounded hover:bg-stone-100 text-stone-500 transition-colors">
            <ChevronLeft size={16} />
          </button>
          <p className="text-sm font-semibold text-stone-900">
            {MONTH_NAMES[curMonth]} {curYear}
          </p>
          <button onClick={nextMonth} className="p-1.5 rounded hover:bg-stone-100 text-stone-500 transition-colors">
            <ChevronRight size={16} />
          </button>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 border-b border-stone-50">
          {DAY_NAMES.map(d => (
            <div key={d} className="py-2 text-center text-[10px] font-semibold text-stone-400 uppercase tracking-wider">
              {d}
            </div>
          ))}
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-auto">
          {grid.map((week, wi) => (
            <div key={wi} className="grid grid-cols-7 border-b border-stone-50 last:border-0" style={{ minHeight: '90px' }}>
              {week.map((day, di) => {
                if (!day) return <div key={di} className="bg-stone-50/40 border-r border-stone-50 last:border-0" />
                const key = isoDate(day)
                const dayItems = byDate.get(key) ?? []
                const isToday = key === todayStr
                const isSelected = key === selectedDay
                const isPast = day < today && key !== todayStr

                return (
                  <div
                    key={di}
                    onClick={() => setSelectedDay(isSelected ? null : key)}
                    className={`border-r border-stone-50 last:border-0 p-1.5 cursor-pointer transition-colors min-h-[90px] flex flex-col ${
                      isSelected
                        ? 'bg-stone-900/5 ring-1 ring-inset ring-stone-900/20'
                        : 'hover:bg-stone-50'
                    } ${isPast ? 'opacity-60' : ''}`}
                  >
                    {/* Date number */}
                    <span className={`text-[11px] font-semibold w-5 h-5 flex items-center justify-center rounded-full flex-shrink-0 mb-1 ${
                      isToday
                        ? 'bg-stone-900 text-white'
                        : 'text-stone-500'
                    }`}>
                      {day.getDate()}
                    </span>

                    {/* Content pills — show up to 3, then +N */}
                    <div className="flex flex-col gap-0.5 flex-1">
                      {dayItems.slice(0, 3).map(item => (
                        <div
                          key={item.id}
                          className={`text-[9px] font-medium px-1.5 py-0.5 rounded border truncate leading-tight ${TYPE_COLORS[item.type]}`}
                          title={item.title}
                        >
                          {item.title}
                        </div>
                      ))}
                      {dayItems.length > 3 && (
                        <span className="text-[9px] text-stone-400 font-medium px-1">
                          +{dayItems.length - 3} more
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Day detail panel */}
      {selectedDay && (
        <div className="bg-white rounded-lg border border-stone-100 shadow-sm">
          <div className="px-4 py-3 border-b border-stone-100 flex items-center justify-between">
            <p className="text-xs font-semibold text-stone-700">
              {new Date(selectedDay + 'T12:00:00').toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              <span className="text-stone-400 font-normal ml-2">· {selectedItems.length} item{selectedItems.length !== 1 ? 's' : ''}</span>
            </p>
            <button onClick={() => setSelectedDay(null)} className="text-stone-400 hover:text-stone-700">
              <X size={14} />
            </button>
          </div>
          {selectedItems.length === 0 ? (
            <p className="text-xs text-stone-400 text-center py-6">No content scheduled for this day</p>
          ) : (
            <div className="divide-y divide-stone-50">
              {selectedItems.map(item => (
                <div key={item.id} className="flex items-center gap-3 px-4 py-3 hover:bg-stone-50/50">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${TYPE_DOT[item.type]}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-stone-900 truncate">{item.title}</p>
                    <div className="flex items-center gap-2 text-[10px] text-stone-400 mt-0.5">
                      <span>{item.type}</span>
                      {item.project && <><span>·</span><span>{item.project.name}</span></>}
                      {item.assignee && <><span>·</span><span>{item.assignee.name}</span></>}
                    </div>
                  </div>
                  <Badge className={contentStatusColor(item.status)}>
                    {CONTENT_STATUS_LABELS[item.status]}
                  </Badge>
                  {canEdit && (
                    <button onClick={() => onEdit(item)} className="p-1 rounded text-stone-300 hover:text-stone-600 hover:bg-stone-100">
                      <Pencil size={11} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* No scheduled items notice */}
      {items.filter(i => i.postDate).length === 0 && (
        <div className="text-center py-8 text-xs text-stone-400">
          No content has a post date set. Edit items and add a post date to see them in the calendar.
        </div>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function ContentPage() {
  const user = useAuthStore((s) => s.user)
  const [items, setItems] = useState<Content[]>([])
  const [users, setUsers] = useState<{ id: string; name: string }[]>([])
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState<string>('')
  const [filterType, setFilterType] = useState<string>('')
  const [filterProject, setFilterProject] = useState<string>('')
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Content | null>(null)
  const [form, setForm] = useState<ContentForm>(EMPTY)
  const [saving, setSaving] = useState(false)

  const fetchContent = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (filterStatus) params.set('status', filterStatus)
    const res = await fetch(`/api/content?${params}`)
    const json = await res.json()
    let data: Content[] = json.data ?? []
    if (filterType) data = data.filter((i) => i.type === filterType)
    if (filterProject) data = data.filter((i) => i.projectId === filterProject)
    setItems(data)
    setLoading(false)
  }, [filterStatus, filterType, filterProject])

  useEffect(() => { fetchContent() }, [fetchContent])

  useEffect(() => {
    if (user?.role === 'ADMIN' || user?.role === 'MANAGER') {
      fetch('/api/users').then(r => r.json()).then(j => setUsers(j.data ?? []))
      fetch('/api/projects').then(r => r.json()).then(j => setProjects(j.data ?? []))
    }
  }, [user])

  const openCreate = () => { setEditing(null); setForm(EMPTY); setModalOpen(true) }

  const openEdit = (item: Content) => {
    setEditing(item)
    setForm({
      title: item.title, type: item.type, status: item.status,
      description: item.description ?? '', driveLink: item.driveLink ?? '',
      caption: item.caption ?? '',
      postDate: item.postDate ? item.postDate.split('T')[0] : '',
      assigneeId: item.assigneeId ?? '', projectId: item.projectId ?? '',
    })
    setModalOpen(true)
  }

  const handleSave = async () => {
    if (!form.title.trim()) return toast.error('Title is required')
    setSaving(true)
    try {
      const payload = {
        ...form,
        postDate: form.postDate || null, assigneeId: form.assigneeId || null,
        projectId: form.projectId || null, driveLink: form.driveLink || null,
        caption: form.caption || null, description: form.description || null,
      }
      const res = editing
        ? await fetch(`/api/content/${editing.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
        : await fetch('/api/content', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      if (!res.ok) throw new Error((await res.json()).error)
      toast.success(editing ? 'Updated' : 'Created')
      setModalOpen(false)
      fetchContent()
    } catch (err: any) { toast.error(err.message ?? 'Save failed') }
    finally { setSaving(false) }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this content item?')) return
    const res = await fetch(`/api/content/${id}`, { method: 'DELETE' })
    if (res.ok) { toast.success('Deleted'); setItems((p) => p.filter((i) => i.id !== id)) }
  }

  const handleStatusChange = async (id: string, status: ContentStatus) => {
    const res = await fetch(`/api/content/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }),
    })
    if (res.ok) setItems((p) => p.map((i) => i.id === id ? { ...i, status } : i))
  }

  const canEdit = user?.role !== 'CLIENT'
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'MANAGER'

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <TopBar
        title="Content"
        actions={
          <div className="flex items-center gap-2">
            {viewMode === 'list' && (
              <>
                <Select
                  options={[{ value: '', label: 'All types' }, ...TYPE_OPTIONS]}
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="h-8 text-xs w-28"
                />
                <Select
                  options={[{ value: '', label: 'All stages' }, ...STATUS_OPTIONS]}
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="h-8 text-xs w-32"
                />
              </>
            )}
            {/* View toggle */}
            <div className="flex items-center border border-stone-200 rounded-md overflow-hidden h-8">
              <button
                onClick={() => setViewMode('list')}
                className={`px-2.5 h-full flex items-center transition-colors ${
                  viewMode === 'list' ? 'bg-stone-900 text-white' : 'text-stone-400 hover:bg-stone-50'
                }`}
                title="List view"
              >
                <LayoutGrid size={13} />
              </button>
              <button
                onClick={() => setViewMode('calendar')}
                className={`px-2.5 h-full flex items-center transition-colors border-l border-stone-200 ${
                  viewMode === 'calendar' ? 'bg-stone-900 text-white' : 'text-stone-400 hover:bg-stone-50'
                }`}
                title="Calendar view"
              >
                <CalendarDays size={13} />
              </button>
            </div>
            {canEdit && (
              <Button size="sm" onClick={openCreate}>
                <Plus size={13} /> New
              </Button>
            )}
          </div>
        }
      />

      {/* Pipeline header — list view only */}
      {viewMode === 'list' && (
        <div className="px-5 pt-4 pb-0">
          <div className="flex gap-1 overflow-x-auto pb-1">
            {STATUS_PIPELINE.map((s) => {
              const count = items.filter((i) => i.status === s).length
              const active = filterStatus === s
              return (
                <button
                  key={s}
                  onClick={() => setFilterStatus(active ? '' : s)}
                  className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${
                    active
                      ? 'bg-stone-900 text-white border-stone-900'
                      : 'border-stone-200 text-stone-500 hover:bg-stone-50'
                  }`}
                >
                  {CONTENT_STATUS_LABELS[s]}
                  <span className={`text-[10px] font-bold ${active ? 'text-stone-300' : 'text-stone-400'}`}>
                    {count}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Calendar view */}
      {viewMode === 'calendar' && (
        <CalendarView
          items={items}
          projects={projects}
          filterType={filterType}
          filterProject={filterProject}
          onFilterType={setFilterType}
          onFilterProject={setFilterProject}
          onEdit={openEdit}
          canEdit={canEdit}
        />
      )}

      {/* List view */}
      {viewMode === 'list' && (
        <div className="flex-1 overflow-y-auto p-5 pt-3">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <p className="text-xs text-stone-400">Loading...</p>
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <p className="text-sm font-medium text-stone-600 mb-1">No content items</p>
              <p className="text-xs text-stone-400">
                {canEdit ? 'Create your first content item to get started' : 'No content assigned to you yet'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {items.map((item) => (
                <ContentCard
                  key={item.id}
                  item={item}
                  canEdit={canEdit}
                  isAdmin={isAdmin}
                  onEdit={openEdit}
                  onDelete={handleDelete}
                  onStatusChange={handleStatusChange}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Content' : 'New Content'}
        size="lg"
      >
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <Input label="Title" value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Content title" />
          </div>
          <Select label="Type" options={TYPE_OPTIONS} value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value as ContentType })} />
          <Select label="Status" options={STATUS_OPTIONS} value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value as ContentStatus })} />
          <div className="col-span-2">
            <label className="text-xs font-medium text-stone-600 uppercase tracking-wide block mb-1.5">Description</label>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Brief, shoot notes, references..." rows={2}
              className="w-full rounded-md border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-400 resize-none" />
          </div>
          <Input label="Post Date" type="date" value={form.postDate}
            onChange={(e) => setForm({ ...form, postDate: e.target.value })} />
          <Input label="Drive Link" type="url" value={form.driveLink}
            onChange={(e) => setForm({ ...form, driveLink: e.target.value })}
            placeholder="https://drive.google.com/..." />
          <div className="col-span-2">
            <label className="text-xs font-medium text-stone-600 uppercase tracking-wide block mb-1.5">Caption</label>
            <textarea value={form.caption} onChange={(e) => setForm({ ...form, caption: e.target.value })}
              placeholder="Post caption with hashtags..." rows={2}
              className="w-full rounded-md border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-400 resize-none" />
          </div>
          {users.length > 0 && (
            <Select label="Assignee" placeholder="Unassigned"
              options={users.map((u) => ({ value: u.id, label: u.name }))}
              value={form.assigneeId} onChange={(e) => setForm({ ...form, assigneeId: e.target.value })} />
          )}
          {projects.length > 0 && (
            <Select label="Project" placeholder="No project"
              options={projects.map((p) => ({ value: p.id, label: p.name }))}
              value={form.projectId} onChange={(e) => setForm({ ...form, projectId: e.target.value })} />
          )}
          <div className="col-span-2 flex gap-2 pt-1">
            <Button variant="secondary" size="sm" className="flex-1" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button size="sm" className="flex-1" loading={saving} onClick={handleSave}>
              {editing ? 'Save changes' : 'Create'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

// ─── Content card (list view) ─────────────────────────────────────────────────
function ContentCard({ item, canEdit, isAdmin, onEdit, onDelete, onStatusChange }: {
  item: Content; canEdit: boolean; isAdmin: boolean
  onEdit: (i: Content) => void; onDelete: (id: string) => void
  onStatusChange: (id: string, s: ContentStatus) => void
}) {
  return (
    <div className="bg-white rounded-lg border border-stone-100 p-4 shadow-card">
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="text-xs font-semibold text-stone-900 leading-snug">{item.title}</p>
        {canEdit && (
          <div className="flex gap-1 flex-shrink-0">
            <button onClick={() => onEdit(item)} className="p-1 rounded text-stone-300 hover:text-stone-600 hover:bg-stone-100">
              <Pencil size={11} />
            </button>
            {isAdmin && (
              <button onClick={() => onDelete(item.id)} className="p-1 rounded text-stone-300 hover:text-red-500 hover:bg-red-50">
                <Trash2 size={11} />
              </button>
            )}
          </div>
        )}
      </div>
      <div className="flex items-center gap-1.5 mb-3">
        <Badge className={contentStatusColor(item.status)}>{CONTENT_STATUS_LABELS[item.status]}</Badge>
        <span className="text-[10px] text-stone-400 bg-stone-50 rounded px-1.5 py-0.5 font-medium">{item.type}</span>
      </div>
      {item.description && (
        <p className="text-[11px] text-stone-500 mb-3 leading-relaxed line-clamp-2">{item.description}</p>
      )}
      <div className="flex items-center justify-between text-[10px] text-stone-400 mb-3">
        <span>{item.assignee?.name ?? 'Unassigned'}</span>
        {item.postDate && <span>Post: {formatDate(item.postDate)}</span>}
      </div>
      <div className="flex items-center gap-2">
        {canEdit && (
          <select value={item.status} onChange={(e) => onStatusChange(item.id, e.target.value as ContentStatus)}
            className="flex-1 text-[10px] rounded border border-stone-100 bg-stone-50 px-2 py-1 text-stone-600 focus:outline-none">
            {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        )}
        {item.driveLink && (
          <a href={item.driveLink} target="_blank" rel="noreferrer"
            className="p-1.5 rounded text-stone-400 hover:text-stone-700 hover:bg-stone-100" title="Open Drive">
            <ExternalLink size={12} />
          </a>
        )}
      </div>
    </div>
  )
}
