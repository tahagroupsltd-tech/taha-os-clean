'use client'
// src/app/(dashboard)/tasks/page.tsx
import { useState, useEffect, useCallback, useRef } from 'react'
import { TopBar } from '@/components/layout/TopBar'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { useAuthStore } from '@/store/auth.store'
import {
  taskStatusColor, taskPriorityColor, formatDate, isOverdue,
  TASK_STATUS_LABELS, TASK_PRIORITY_LABELS, cn,
  getTaskUrgencyColors
} from '@/lib/utils'
import type { Task, TaskStatus, TaskPriority } from '@/types'
import { Plus, Pencil, Trash2, AlertCircle, Play, Square, Clock, Trash } from 'lucide-react'
import toast from 'react-hot-toast'

// ── Time log helpers ──────────────────────────────────────
interface TimeLog { id: string; minutes: number; note: string | null; created_at: string; user: { id: string; name: string } }

function fmtMins(m: number) {
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60), rem = m % 60
  return rem > 0 ? `${h}h ${rem}m` : `${h}h`
}

const STATUS_COLS: TaskStatus[] = ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE']
const STATUS_OPTIONS = Object.entries(TASK_STATUS_LABELS).map(([v, l]) => ({ value: v, label: l }))
const PRIORITY_OPTIONS = Object.entries(TASK_PRIORITY_LABELS).map(([v, l]) => ({ value: v, label: l }))

interface TaskFormData {
  title: string
  description: string
  status: TaskStatus
  priority: TaskPriority
  deadline: string
  assignedToId: string
  projectId: string
}

const EMPTY_FORM: TaskFormData = {
  title: '',
  description: '',
  status: 'TODO',
  priority: 'MEDIUM',
  deadline: '',
  assignedToId: '',
  projectId: '',
}

export default function TasksPage() {
  const user = useAuthStore((s) => s.user)
  const [tasks, setTasks] = useState<Task[]>([])
  const [users, setUsers] = useState<{ id: string; name: string }[]>([])
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState<string>('')
  const [view, setView] = useState<'board' | 'list'>('board')
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 30000)
    return () => clearInterval(interval)
  }, [])

  const [modalOpen, setModalOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [form, setForm] = useState<TaskFormData>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  const fetchTasks = useCallback(async () => {
    if (!user) return
    setLoading(true)
    // Staff see only their own tasks; admin/manager see all
    const isStaff = user.role !== 'ADMIN' && user.role !== 'MANAGER'
    const params = new URLSearchParams()
    if (filterStatus) params.set('status', filterStatus)
    if (isStaff && user.id) params.set('assignedToId', user.id)
    const res = await fetch(`/api/tasks?${params}`)
    const json = await res.json()
    setTasks(json.data ?? [])
    setLoading(false)
  }, [filterStatus, user])

  useEffect(() => { if (user) fetchTasks() }, [fetchTasks, user])

  useEffect(() => {
    if (user?.role === 'ADMIN' || user?.role === 'MANAGER') {
      fetch('/api/users?excludeRole=CLIENT').then(r => r.json()).then(j => setUsers(j.data ?? []))
      fetch('/api/projects').then(r => r.json()).then(j => setProjects(j.data ?? []))
    }
  }, [user])

  const openCreate = () => { setEditingTask(null); setForm(EMPTY_FORM); setModalOpen(true) }
  const openEdit = (task: Task) => {
    setEditingTask(task)
    setForm({
      title: task.title,
      description: task.description ?? '',
      status: task.status,
      priority: task.priority,
      deadline: task.deadline ? task.deadline.split('T')[0] : '',
      assignedToId: task.assignedToId ?? '',
      projectId: task.projectId ?? '',
    })
    setModalOpen(true)
  }

  const handleSave = async () => {
    if (!form.title.trim()) return toast.error('Title is required')
    setSaving(true)
    try {
      const payload = { ...form, deadline: form.deadline || null, assignedToId: form.assignedToId || null, projectId: form.projectId || null }
      const res = editingTask
        ? await fetch(`/api/tasks/${editingTask.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
        : await fetch('/api/tasks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      toast.success(editingTask ? 'Task updated' : 'Task created')
      setModalOpen(false)
      fetchTasks()
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this task?')) return
    const res = await fetch(`/api/tasks/${id}`, { method: 'DELETE' })
    if (res.ok) { toast.success('Task deleted'); setTasks((prev) => prev.filter((t) => t.id !== id)) }
  }

  const handleStatusChange = async (taskId: string, newStatus: TaskStatus) => {
    const res = await fetch(`/api/tasks/${taskId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: newStatus }) })
    if (res.ok) setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, status: newStatus } : t))
  }

  const canEdit = user?.role !== 'CLIENT'
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'MANAGER'
  const isClient = user?.role === 'CLIENT'

  // Admin/Manager: hide DONE by default (filter dropdown handles it)
  // Client & staff: show all their tasks
  const displayedTasks = isAdmin
    ? (filterStatus ? tasks : tasks.filter(t => t.status !== 'DONE'))
    : tasks

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <TopBar
        title="Tasks"
        actions={
          <div className="flex items-center gap-2">
            <Select
              options={isAdmin
                ? [{ value: '', label: 'All pending' }, ...STATUS_OPTIONS.filter(o => o.value !== 'DONE')]
                : [{ value: '', label: 'All statuses' }, ...STATUS_OPTIONS]
              }
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="h-8 text-xs w-36"
            />
            <button
              onClick={() => setView(v => v === 'board' ? 'list' : 'board')}
              className="h-8 px-3 text-xs rounded-md bg-stone-100 text-stone-600 hover:bg-stone-200 transition-colors"
            >
              {view === 'board' ? 'List' : 'Board'}
            </button>
            {canEdit && (
              <Button size="sm" onClick={openCreate}>
                <Plus size={13} /> New task
              </Button>
            )}
          </div>
        }
      />

      <div className="flex-1 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-xs text-stone-400">Loading...</p>
          </div>
        ) : view === 'board' ? (
          <BoardView
            tasks={displayedTasks}
            canEdit={canEdit}
            onEdit={openEdit}
            onDelete={handleDelete}
            onStatusChange={handleStatusChange}
            isAdmin={isAdmin}
            isClient={isClient}
            userId={user?.id ?? ''}
            now={now}
          />
        ) : (
          <ListView
            tasks={displayedTasks}
            canEdit={canEdit}
            onEdit={openEdit}
            onDelete={handleDelete}
            isAdmin={isAdmin}
            isClient={isClient}
            userId={user?.id ?? ''}
            now={now}
          />
        )}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editingTask ? 'Edit Task' : 'New Task'}>
        <div className="space-y-3">
          <Input label="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Task title" />
          <div>
            <label className="text-xs font-medium text-stone-600 uppercase tracking-wide block mb-1.5">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Optional description"
              rows={2}
              className="w-full rounded-md border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-400 resize-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Select label="Status" options={STATUS_OPTIONS} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as TaskStatus })} />
            <Select label="Priority" options={PRIORITY_OPTIONS} value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value as TaskPriority })} />
          </div>
          <Input label="Deadline" type="date" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} />
          {users.length > 0 && (
            <Select label="Assignee" placeholder="Unassigned" options={users.map((u) => ({ value: u.id, label: u.name }))} value={form.assignedToId} onChange={(e) => setForm({ ...form, assignedToId: e.target.value })} />
          )}
          {projects.length > 0 && (
            <Select label="Project" placeholder="No project" options={projects.map((p) => ({ value: p.id, label: p.name }))} value={form.projectId} onChange={(e) => setForm({ ...form, projectId: e.target.value })} />
          )}
          <div className="flex gap-2 pt-1">
            <Button variant="secondary" size="sm" className="flex-1" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button size="sm" className="flex-1" loading={saving} onClick={handleSave}>{editingTask ? 'Save changes' : 'Create task'}</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

// ── Board View ────────────────────────────────────────────
function BoardView({ tasks, canEdit, onEdit, onDelete, onStatusChange, isAdmin, isClient = false, userId, now }: {
  tasks: Task[]
  canEdit: boolean
  onEdit: (t: Task) => void
  onDelete: (id: string) => void
  onStatusChange: (id: string, s: TaskStatus) => void
  isAdmin: boolean
  isClient?: boolean
  userId: string
  now: Date
}) {
  // Admin/Manager: grouped by assignee
  if (isAdmin) {
    const byAssignee = new Map<string, { name: string; tasks: Task[] }>()
    const unassigned: Task[] = []
    for (const t of tasks) {
      if (!t.assignedTo) { unassigned.push(t); continue }
      const existing = byAssignee.get(t.assignedTo.id)
      if (existing) existing.tasks.push(t)
      else byAssignee.set(t.assignedTo.id, { name: t.assignedTo.name, tasks: [t] })
    }
    return (
      <div className="h-full overflow-y-auto p-5 space-y-6">
        {unassigned.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[10px] font-bold text-red-500 uppercase tracking-wider">⚠ Unassigned</span>
              <span className="text-[10px] bg-red-50 text-red-400 rounded-full px-2 py-0.5">{unassigned.length}</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
              {unassigned.map(task => (
                <TaskCard key={task.id} task={task} canEdit={canEdit} onEdit={onEdit} onDelete={onDelete}
                  onStatusChange={onStatusChange} isAdmin={isAdmin} isClient={isClient} userId={userId} showStatusSelect now={now} />
              ))}
            </div>
          </div>
        )}
        {[...byAssignee.entries()].map(([uid, group]) => {
          const pending = group.tasks.filter(t => t.status !== 'DONE')
          const done = group.tasks.filter(t => t.status === 'DONE')
          return (
            <div key={uid}>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center">
                  <span className="text-[10px] font-bold text-indigo-700">{group.name[0].toUpperCase()}</span>
                </div>
                <span className="text-xs font-semibold text-stone-700">{group.name}</span>
                <span className="text-[10px] bg-amber-50 text-amber-600 rounded-full px-2 py-0.5">{pending.length} pending</span>
                {done.length > 0 && <span className="text-[10px] bg-green-50 text-green-600 rounded-full px-2 py-0.5">{done.length} done</span>}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
                {group.tasks.map(task => (
                  <TaskCard key={task.id} task={task} canEdit={canEdit} onEdit={onEdit} onDelete={onDelete}
                    onStatusChange={onStatusChange} isAdmin={isAdmin} isClient={isClient} userId={userId} showStatusSelect now={now} />
                ))}
              </div>
            </div>
          )
        })}
        {tasks.length === 0 && (
          <div className="flex items-center justify-center h-40">
            <p className="text-xs text-stone-400">No tasks found</p>
          </div>
        )}
      </div>
    )
  }

  // Staff view: classic Kanban columns (only their tasks)
  return (
    <div className="h-full overflow-x-auto p-5">
      <div className="flex gap-3 h-full" style={{ minWidth: '860px' }}>
        {STATUS_COLS.map((status) => {
          const colTasks = tasks.filter((t) => t.status === status)
          return (
            <div key={status} className="flex-1 min-w-[200px] flex flex-col">
              <div className="flex items-center gap-2 mb-2.5">
                <span className="text-xs font-semibold text-stone-600 uppercase tracking-wide">{TASK_STATUS_LABELS[status]}</span>
                <span className="text-[11px] bg-stone-100 text-stone-400 rounded-full px-2 py-0.5 font-medium">{colTasks.length}</span>
              </div>
              <div className="flex-1 overflow-y-auto space-y-2">
                {colTasks.map((task) => (
                  <TaskCard key={task.id} task={task} canEdit={canEdit} onEdit={onEdit} onDelete={onDelete}
                    onStatusChange={onStatusChange} isAdmin={isAdmin} isClient={isClient} userId={userId} showStatusSelect now={now} />
                ))}
                {colTasks.length === 0 && (
                  <div className="rounded-md border border-dashed border-stone-200 p-4 text-center">
                    <p className="text-[11px] text-stone-300">Empty</p>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── List View ─────────────────────────────────────────────
function ListView({ tasks, canEdit, onEdit, onDelete, isAdmin, isClient = false, userId, now }: {
  tasks: Task[]
  canEdit: boolean
  onEdit: (t: Task) => void
  onDelete: (id: string) => void
  isAdmin: boolean
  isClient?: boolean
  userId: string
  now: Date
}) {
  return (
    <div className="h-full overflow-y-auto p-4 sm:p-5">
      <div className="bg-white rounded-lg border border-stone-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-stone-100 bg-stone-50">
                <th className="text-left px-4 py-2.5 font-medium text-stone-500 uppercase tracking-wide">Title</th>
                <th className="text-left px-4 py-2.5 font-medium text-stone-500 uppercase tracking-wide">Status</th>
                <th className="text-left px-4 py-2.5 font-medium text-stone-500 uppercase tracking-wide">Priority</th>
                <th className="text-left px-4 py-2.5 font-medium text-stone-500 uppercase tracking-wide">Assignee</th>
                <th className="text-left px-4 py-2.5 font-medium text-stone-500 uppercase tracking-wide">Deadline</th>
                <th className="text-left px-4 py-2.5 font-medium text-stone-500 uppercase tracking-wide">Time Logged</th>
                {canEdit && <th className="px-4 py-2.5" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-50">
              {tasks.length === 0 && (
                <tr><td colSpan={7} className="text-center py-8 text-stone-400">No tasks found</td></tr>
              )}
              {tasks.map((task) => (
                <tr key={task.id} className="table-row-hover">
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium text-stone-900">{task.title}</span>
                      {isOverdue(task.deadline) && task.status !== 'DONE' && <AlertCircle size={11} className="text-red-400" />}
                    </div>
                    {task.project && <p className="text-[10px] text-stone-400 mt-0.5">{task.project.name}</p>}
                    {isAdmin && isOverdue(task.deadline) && task.status !== 'DONE' && (
                      <p className="text-[10px] text-red-500 font-medium mt-0.5">Overdue — ask why it&apos;s not done</p>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <Badge className={taskStatusColor(task.status)}>{TASK_STATUS_LABELS[task.status]}</Badge>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <Badge className={taskPriorityColor(task.priority)}>{task.priority}</Badge>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {!isClient && task.assignedTo ? (
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                          <span className="text-[10px] font-bold text-indigo-700">{task.assignedTo.name[0].toUpperCase()}</span>
                        </div>
                        <span className="text-stone-700 font-medium">{task.assignedTo.name}</span>
                      </div>
                    ) : !isClient && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-red-500 bg-red-50 border border-red-100 px-2 py-0.5 rounded-full">
                        ⚠ Unassigned
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {task.deadline ? (() => {
                      const colors = getTaskUrgencyColors(task.deadline, task.status, now)
                      return (
                        <span className={cn('inline-block text-[10px] font-medium px-2 py-0.5 rounded-full border', colors.badgeClasses)}>
                          {formatDate(task.deadline)}{colors.timeLeftStr && ` (${colors.timeLeftStr})`}
                        </span>
                      )
                    })() : <span className="text-stone-400">—</span>}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <TimeTrackerInline taskId={task.id} />
                  </td>
                  {canEdit && (
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-1 justify-end">
                        <button onClick={() => onEdit(task)} className="p-1 rounded text-stone-400 hover:text-stone-700 hover:bg-stone-100"><Pencil size={13} /></button>
                        {isAdmin && <button onClick={() => onDelete(task.id)} className="p-1 rounded text-stone-400 hover:text-red-600 hover:bg-red-50"><Trash2 size={13} /></button>}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ── Task Card ─────────────────────────────────────────────
function TaskCard({ task, canEdit, onEdit, onDelete, onStatusChange, isAdmin, isClient = false, userId, showStatusSelect, now }: {
  task: Task
  canEdit: boolean
  onEdit: (t: Task) => void
  onDelete: (id: string) => void
  onStatusChange: (id: string, s: TaskStatus) => void
  isAdmin: boolean
  isClient?: boolean
  userId: string
  showStatusSelect?: boolean
  now: Date
}) {
  const colors = getTaskUrgencyColors(task.deadline, task.status, now)
  const isOverdueAndPending = isOverdue(task.deadline) && task.status !== 'DONE'

  return (
    <div className={cn('rounded-lg border p-3 shadow-card transition-all', colors.cardClasses)}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="text-xs font-semibold text-stone-900 leading-snug">{task.title}</p>
        {canEdit && (
          <div className="flex items-center gap-1 flex-shrink-0">
            <button onClick={() => onEdit(task)} className="p-1 rounded text-stone-300 hover:text-stone-600 hover:bg-stone-100"><Pencil size={11} /></button>
            {isAdmin && <button onClick={() => onDelete(task.id)} className="p-1 rounded text-stone-300 hover:text-red-500 hover:bg-red-50"><Trash2 size={11} /></button>}
          </div>
        )}
      </div>

      <div className="flex items-center gap-1.5 flex-wrap mb-2">
        <Badge className={taskPriorityColor(task.priority)}>{task.priority}</Badge>
        {task.project && <span className="text-[10px] text-stone-400 bg-stone-50/50 rounded px-1.5 py-0.5">{task.project.name}</span>}
      </div>

      {/* Admin: overdue indicator — shows WHY this task needs attention */}
      {isAdmin && isOverdueAndPending && (
        <div className="text-[10px] text-red-600 bg-red-50 border border-red-100 rounded px-2 py-1 mb-2 flex items-center gap-1">
          <AlertCircle size={9} />
          <span>Overdue — ask why it&apos;s not done</span>
        </div>
      )}

      {/* Deadline + Assignee row */}
      <div className="flex items-center justify-between mt-2">
        <div className="flex items-center gap-1">
          {task.deadline && colors.isOverdue && <AlertCircle size={11} className="text-red-400 animate-pulse" />}
          <span className={cn('text-[10px]', colors.textClasses)}>
            {task.deadline ? <>{formatDate(task.deadline)}{colors.timeLeftStr && ` · ${colors.timeLeftStr}`}</> : 'No deadline'}
          </span>
        </div>
        {!isClient && (task.assignedTo ? (
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-5 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
              <span className="text-[9px] font-bold text-indigo-700">{task.assignedTo.name[0].toUpperCase()}</span>
            </div>
            <span className="text-[10px] font-semibold text-stone-600 max-w-[90px] truncate">{task.assignedTo.name.split(' ')[0]}</span>
          </div>
        ) : (
          <span className="inline-flex items-center gap-1 text-[9px] font-bold text-red-500 bg-red-50 border border-red-100 px-1.5 py-0.5 rounded-full">
            ⚠ Unassigned
          </span>
        ))}
      </div>

      {showStatusSelect && canEdit && (
        <select
          value={task.status}
          onChange={(e) => onStatusChange(task.id, e.target.value as TaskStatus)}
          className="mt-2 w-full text-[10px] rounded border border-stone-100 bg-stone-50 px-2 py-1 text-stone-600 focus:outline-none"
        >
          {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      )}

      <TimeTracker taskId={task.id} isAdmin={isAdmin} userId={userId} assignedToId={task.assignedToId ?? null} />
    </div>
  )
}

// ── TimeTracker (card view) ───────────────────────────────
// Admin: read-only time display. Staff: interactive timer (own tasks only).
function TimeTracker({ taskId, isAdmin, userId, assignedToId }: {
  taskId: string
  isAdmin: boolean
  userId: string
  assignedToId: string | null
}) {
  const [logs, setLogs] = useState<TimeLog[]>([])
  const [running, setRunning] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [startedAt, setStartedAt] = useState<string | null>(null)
  const [showPanel, setShowPanel] = useState(false)
  const [manualMinutes, setManualMinutes] = useState('')
  const [manualNote, setManualNote] = useState('')
  const [saving, setSaving] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const totalLogged = logs.reduce((s, l) => s + l.minutes, 0)
  // Only the assigned staff member can use the timer
  const canUseTimer = !isAdmin && userId === assignedToId

  const fetchLogs = useCallback(async () => {
    const res = await fetch(`/api/time-logs?taskId=${taskId}`)
    const j = await res.json()
    setLogs(j.data ?? [])
  }, [taskId])

  useEffect(() => { fetchLogs() }, [fetchLogs])

  useEffect(() => {
    if (running) { intervalRef.current = setInterval(() => setElapsed(e => e + 1), 1000) }
    else { if (intervalRef.current) clearInterval(intervalRef.current) }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [running])

  const startTimer = () => { setStartedAt(new Date().toISOString()); setElapsed(0); setRunning(true); toast.success('Timer started') }

  const stopTimer = async () => {
    if (!startedAt) return
    setRunning(false)
    const endedAt = new Date().toISOString()
    const mins = Math.max(1, Math.round(elapsed / 60))
    setSaving(true)
    try {
      const res = await fetch('/api/time-logs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ taskId, minutes: mins, startedAt, endedAt }) })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error)
      toast.success(`Logged ${fmtMins(mins)}`)
      await fetchLogs()
    } catch (e: any) { toast.error(e.message) }
    finally { setSaving(false); setElapsed(0); setStartedAt(null) }
  }

  const logManual = async () => {
    const mins = parseInt(manualMinutes)
    if (!mins || mins <= 0) return toast.error('Enter valid minutes')
    setSaving(true)
    try {
      const res = await fetch('/api/time-logs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ taskId, minutes: mins, note: manualNote || null }) })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error)
      toast.success(`Logged ${fmtMins(mins)}`)
      setManualMinutes(''); setManualNote('')
      await fetchLogs()
    } catch (e: any) { toast.error(e.message) }
    finally { setSaving(false) }
  }

  const deleteLog = async (id: string) => {
    await fetch(`/api/time-logs/${id}`, { method: 'DELETE' })
    setLogs(prev => prev.filter(l => l.id !== id))
  }

  const fmtElapsed = () => {
    const h = Math.floor(elapsed / 3600), m = Math.floor((elapsed % 3600) / 60), s = elapsed % 60
    return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }

  return (
    <div className="mt-2 border-t border-stone-50 pt-2">
      <div className="flex items-center gap-1.5">
        {isAdmin ? (
          // Admin sees read-only time summary (no toggle panel, no actions)
          <span className="inline-flex items-center gap-1 text-[10px] text-stone-500">
            <Clock size={9} />
            {totalLogged > 0 ? `${fmtMins(totalLogged)} logged` : 'No time logged'}
          </span>
        ) : canUseTimer ? (
          // Staff on their own task: interactive timer
          <>
            {running ? (
              <button onClick={stopTimer} disabled={saving}
                className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-red-50 text-red-600 hover:bg-red-100 transition-colors font-medium">
                <Square size={9} fill="currentColor" /> Stop · {fmtElapsed()}
              </button>
            ) : (
              <button onClick={startTimer}
                className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-green-50 text-green-700 hover:bg-green-100 transition-colors font-medium">
                <Play size={9} fill="currentColor" /> Start timer
              </button>
            )}
            <button onClick={() => setShowPanel(p => !p)}
              className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-stone-50 text-stone-500 hover:bg-stone-100 transition-colors">
              <Clock size={9} /> {totalLogged > 0 ? fmtMins(totalLogged) : 'Log'}
            </button>
          </>
        ) : (
          // Staff viewing someone else's task: read-only
          <span className="inline-flex items-center gap-1 text-[10px] text-stone-400">
            <Clock size={9} /> {totalLogged > 0 ? `${fmtMins(totalLogged)} logged` : 'No time logged'}
          </span>
        )}
      </div>

      {!isAdmin && showPanel && (
        <div className="mt-2 space-y-2">
          {canUseTimer && (
            <div className="flex gap-1">
              <input type="number" min="1" placeholder="mins" value={manualMinutes} onChange={e => setManualMinutes(e.target.value)}
                className="w-14 text-[10px] border border-stone-200 rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-stone-300" />
              <input type="text" placeholder="note (optional)" value={manualNote} onChange={e => setManualNote(e.target.value)}
                className="flex-1 text-[10px] border border-stone-200 rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-stone-300" />
              <button onClick={logManual} disabled={saving}
                className="text-[10px] px-2 py-1 rounded bg-stone-800 text-white hover:bg-stone-700 disabled:opacity-50 transition-colors whitespace-nowrap">
                + Log
              </button>
            </div>
          )}
          {logs.length > 0 && (
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {logs.map(log => (
                <div key={log.id} className="flex items-center justify-between text-[10px] text-stone-500 bg-stone-50 rounded px-2 py-1">
                  <span className="font-medium text-stone-700">{fmtMins(log.minutes)}</span>
                  <span className="flex-1 mx-2 truncate">{log.user?.name ?? '—'}</span>
                  <span className="text-stone-400 mr-2 truncate max-w-[80px]">{log.note ?? ''}</span>
                  {!isAdmin && (
                    <button onClick={() => deleteLog(log.id)} className="text-stone-300 hover:text-red-500 transition-colors">
                      <Trash size={9} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
          {logs.length === 0 && <p className="text-[10px] text-stone-300 text-center py-1">No time logged yet</p>}
        </div>
      )}
    </div>
  )
}

// ── TimeTrackerInline (list view — always read-only) ──────
function TimeTrackerInline({ taskId }: { taskId: string }) {
  const [total, setTotal] = useState<number | null>(null)
  useEffect(() => {
    fetch(`/api/time-logs?taskId=${taskId}`)
      .then(r => r.json())
      .then(j => { const logs: TimeLog[] = j.data ?? []; setTotal(logs.reduce((s, l) => s + l.minutes, 0)) })
  }, [taskId])
  if (total === null) return <span className="text-stone-300 text-[10px]">—</span>
  if (total === 0) return <span className="text-stone-300 text-[10px]">None</span>
  return <span className="text-[10px] font-medium text-stone-600 flex items-center gap-1"><Clock size={9} />{fmtMins(total)}</span>
}
