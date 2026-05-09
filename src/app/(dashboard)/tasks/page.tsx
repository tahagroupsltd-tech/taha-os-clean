'use client'
// src/app/(dashboard)/tasks/page.tsx
import { useState, useEffect, useCallback } from 'react'
import { TopBar } from '@/components/layout/TopBar'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { useAuthStore } from '@/store/auth.store'
import {
  taskStatusColor, taskPriorityColor, formatDate, isOverdue,
  TASK_STATUS_LABELS, TASK_PRIORITY_LABELS
} from '@/lib/utils'
import type { Task, TaskStatus, TaskPriority } from '@/types'
import { Plus, Pencil, Trash2, AlertCircle, ChevronDown } from 'lucide-react'
import toast from 'react-hot-toast'

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

  // Modal state
  const [modalOpen, setModalOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [form, setForm] = useState<TaskFormData>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  const fetchTasks = useCallback(async () => {
    setLoading(true)
    const params = filterStatus ? `?status=${filterStatus}` : ''
    const res = await fetch(`/api/tasks${params}`)
    const json = await res.json()
    setTasks(json.data ?? [])
    setLoading(false)
  }, [filterStatus])

  useEffect(() => { fetchTasks() }, [fetchTasks])

  useEffect(() => {
    if (user?.role === 'ADMIN' || user?.role === 'MANAGER') {
      fetch('/api/users').then(r => r.json()).then(j => setUsers(j.data ?? []))
      fetch('/api/projects').then(r => r.json()).then(j => setProjects(j.data ?? []))
    }
  }, [user])

  const openCreate = () => {
    setEditingTask(null)
    setForm(EMPTY_FORM)
    setModalOpen(true)
  }

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
      const payload = {
        ...form,
        deadline: form.deadline || null,
        assignedToId: form.assignedToId || null,
        projectId: form.projectId || null,
      }
      const res = editingTask
        ? await fetch(`/api/tasks/${editingTask.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
        : await fetch('/api/tasks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
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
    if (res.ok) {
      toast.success('Task deleted')
      setTasks((prev) => prev.filter((t) => t.id !== id))
    }
  }

  const handleStatusChange = async (taskId: string, newStatus: TaskStatus) => {
    const res = await fetch(`/api/tasks/${taskId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
    if (res.ok) {
      setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, status: newStatus } : t))
    }
  }

  const canEdit = user?.role !== 'CLIENT'

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <TopBar
        title="Tasks"
        actions={
          <div className="flex items-center gap-2">
            <Select
              options={[{ value: '', label: 'All statuses' }, ...STATUS_OPTIONS]}
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
            tasks={tasks}
            canEdit={canEdit}
            onEdit={openEdit}
            onDelete={handleDelete}
            onStatusChange={handleStatusChange}
            isAdmin={user?.role === 'ADMIN' || user?.role === 'MANAGER'}
          />
        ) : (
          <ListView
            tasks={tasks}
            canEdit={canEdit}
            onEdit={openEdit}
            onDelete={handleDelete}
            isAdmin={user?.role === 'ADMIN' || user?.role === 'MANAGER'}
          />
        )}
      </div>

      {/* Create/Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingTask ? 'Edit Task' : 'New Task'}
      >
        <div className="space-y-3">
          <Input
            label="Title"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="Task title"
          />
          <div>
            <label className="text-xs font-medium text-stone-600 uppercase tracking-wide block mb-1.5">
              Description
            </label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Optional description"
              rows={2}
              className="w-full rounded-md border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-400 resize-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Status"
              options={STATUS_OPTIONS}
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value as TaskStatus })}
            />
            <Select
              label="Priority"
              options={PRIORITY_OPTIONS}
              value={form.priority}
              onChange={(e) => setForm({ ...form, priority: e.target.value as TaskPriority })}
            />
          </div>
          <Input
            label="Deadline"
            type="date"
            value={form.deadline}
            onChange={(e) => setForm({ ...form, deadline: e.target.value })}
          />
          {users.length > 0 && (
            <Select
              label="Assignee"
              placeholder="Unassigned"
              options={users.map((u) => ({ value: u.id, label: u.name }))}
              value={form.assignedToId}
              onChange={(e) => setForm({ ...form, assignedToId: e.target.value })}
            />
          )}
          {projects.length > 0 && (
            <Select
              label="Project"
              placeholder="No project"
              options={projects.map((p) => ({ value: p.id, label: p.name }))}
              value={form.projectId}
              onChange={(e) => setForm({ ...form, projectId: e.target.value })}
            />
          )}
          <div className="flex gap-2 pt-1">
            <Button variant="secondary" size="sm" className="flex-1" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" className="flex-1" loading={saving} onClick={handleSave}>
              {editingTask ? 'Save changes' : 'Create task'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

// ── Board View ────────────────────────────────────────────
function BoardView({ tasks, canEdit, onEdit, onDelete, onStatusChange, isAdmin }: {
  tasks: Task[]
  canEdit: boolean
  onEdit: (t: Task) => void
  onDelete: (id: string) => void
  onStatusChange: (id: string, s: TaskStatus) => void
  isAdmin: boolean
}) {
  return (
    <div className="h-full overflow-x-auto p-5">
      <div className="flex gap-3 h-full" style={{ minWidth: '860px' }}>
        {STATUS_COLS.map((status) => {
          const colTasks = tasks.filter((t) => t.status === status)
          return (
            <div key={status} className="flex-1 min-w-[200px] flex flex-col">
              <div className="flex items-center gap-2 mb-2.5">
                <span className="text-xs font-semibold text-stone-600 uppercase tracking-wide">
                  {TASK_STATUS_LABELS[status]}
                </span>
                <span className="text-[11px] bg-stone-100 text-stone-400 rounded-full px-2 py-0.5 font-medium">
                  {colTasks.length}
                </span>
              </div>
              <div className="flex-1 overflow-y-auto space-y-2">
                {colTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    canEdit={canEdit}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    onStatusChange={onStatusChange}
                    isAdmin={isAdmin}
                    showStatusSelect
                  />
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
function ListView({ tasks, canEdit, onEdit, onDelete, isAdmin }: {
  tasks: Task[]
  canEdit: boolean
  onEdit: (t: Task) => void
  onDelete: (id: string) => void
  isAdmin: boolean
}) {
  return (
    <div className="h-full overflow-y-auto p-5">
      <div className="bg-white rounded-lg border border-stone-100 overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-stone-100 bg-stone-50">
              <th className="text-left px-4 py-2.5 font-medium text-stone-500 uppercase tracking-wide">Title</th>
              <th className="text-left px-4 py-2.5 font-medium text-stone-500 uppercase tracking-wide">Status</th>
              <th className="text-left px-4 py-2.5 font-medium text-stone-500 uppercase tracking-wide">Priority</th>
              <th className="text-left px-4 py-2.5 font-medium text-stone-500 uppercase tracking-wide">Assignee</th>
              <th className="text-left px-4 py-2.5 font-medium text-stone-500 uppercase tracking-wide">Deadline</th>
              {canEdit && <th className="px-4 py-2.5" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-50">
            {tasks.length === 0 && (
              <tr><td colSpan={6} className="text-center py-8 text-stone-400">No tasks found</td></tr>
            )}
            {tasks.map((task) => (
              <tr key={task.id} className="table-row-hover">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium text-stone-900">{task.title}</span>
                    {isOverdue(task.deadline) && task.status !== 'DONE' && (
                      <AlertCircle size={11} className="text-red-400" />
                    )}
                  </div>
                  {task.project && (
                    <p className="text-[10px] text-stone-400 mt-0.5">{task.project.name}</p>
                  )}
                </td>
                <td className="px-4 py-3">
                  <Badge className={taskStatusColor(task.status)}>
                    {TASK_STATUS_LABELS[task.status]}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  <Badge className={taskPriorityColor(task.priority)}>
                    {task.priority}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-stone-500">{task.assignedTo?.name ?? '—'}</td>
                <td className={`px-4 py-3 ${isOverdue(task.deadline) && task.status !== 'DONE' ? 'text-red-500' : 'text-stone-500'}`}>
                  {formatDate(task.deadline)}
                </td>
                {canEdit && (
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      <button onClick={() => onEdit(task)} className="p-1 rounded text-stone-400 hover:text-stone-700 hover:bg-stone-100">
                        <Pencil size={13} />
                      </button>
                      {isAdmin && (
                        <button onClick={() => onDelete(task.id)} className="p-1 rounded text-stone-400 hover:text-red-600 hover:bg-red-50">
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Task Card ─────────────────────────────────────────────
function TaskCard({ task, canEdit, onEdit, onDelete, onStatusChange, isAdmin, showStatusSelect }: {
  task: Task
  canEdit: boolean
  onEdit: (t: Task) => void
  onDelete: (id: string) => void
  onStatusChange: (id: string, s: TaskStatus) => void
  isAdmin: boolean
  showStatusSelect?: boolean
}) {
  const overdue = isOverdue(task.deadline) && task.status !== 'DONE'

  return (
    <div className="bg-white rounded-lg border border-stone-100 p-3 shadow-card">
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="text-xs font-medium text-stone-900 leading-snug">{task.title}</p>
        {canEdit && (
          <div className="flex items-center gap-1 flex-shrink-0">
            <button onClick={() => onEdit(task)} className="p-1 rounded text-stone-300 hover:text-stone-600 hover:bg-stone-100">
              <Pencil size={11} />
            </button>
            {isAdmin && (
              <button onClick={() => onDelete(task.id)} className="p-1 rounded text-stone-300 hover:text-red-500 hover:bg-red-50">
                <Trash2 size={11} />
              </button>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-1.5 flex-wrap mb-2">
        <Badge className={taskPriorityColor(task.priority)}>{task.priority}</Badge>
        {task.project && (
          <span className="text-[10px] text-stone-400 bg-stone-50 rounded px-1.5 py-0.5">
            {task.project.name}
          </span>
        )}
      </div>

      <div className="flex items-center justify-between mt-1">
        <div className="flex items-center gap-1">
          {overdue && <AlertCircle size={11} className="text-red-400" />}
          <span className={`text-[10px] ${overdue ? 'text-red-500' : 'text-stone-400'}`}>
            {formatDate(task.deadline)}
          </span>
        </div>
        {task.assignedTo && (
          <div className="w-5 h-5 rounded-full bg-stone-200 flex items-center justify-center">
            <span className="text-[9px] font-bold text-stone-600">
              {task.assignedTo.name[0].toUpperCase()}
            </span>
          </div>
        )}
      </div>

      {showStatusSelect && canEdit && (
        <select
          value={task.status}
          onChange={(e) => onStatusChange(task.id, e.target.value as TaskStatus)}
          className="mt-2 w-full text-[10px] rounded border border-stone-100 bg-stone-50 px-2 py-1 text-stone-600 focus:outline-none"
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      )}
    </div>
  )
}
