'use client'
// src/app/(dashboard)/projects/page.tsx
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { TopBar } from '@/components/layout/TopBar'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { SkeletonCard } from '@/components/ui/Skeleton'
import { useAuthStore } from '@/store/auth.store'
import {
  projectStatusColor, formatDate, PROJECT_STATUS_LABELS,
  KANBAN_STAGE_LABELS, kanbanStageColor, formatMoney, cn,
} from '@/lib/utils'
import type { Project, ProjectStatus, KanbanStage } from '@/types'
import {
  Plus, CheckSquare, FileVideo, Pencil, Trash2, ArrowRight,
  LayoutGrid, Kanban, IndianRupee, User, Calendar, GripVertical, X,
  ChevronRight,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { ClientProjectsView } from '@/components/client/ClientProjectsView'

const STATUS_OPTIONS = Object.entries(PROJECT_STATUS_LABELS).map(([v, l]) => ({ value: v, label: l }))

const KANBAN_STAGES: KanbanStage[] = [
  'LEAD', 'PROPOSAL_SENT', 'ONBOARDING', 'ACTIVE', 'DELIVERED', 'CLOSED',
]

const SOP_LEVELS = [
  { value: '', label: 'No stage' },
  { value: '1', label: 'L1 · Sales & Onboarding' },
  { value: '2', label: 'L2 · PM Setup' },
  { value: '3', label: 'L3 · Script Prep' },
  { value: '4', label: 'L4 · Script Approval 🔒' },
  { value: '5', label: 'L5 · Shoot Logistics' },
  { value: '6', label: 'L6 · Shoot Day' },
  { value: '7', label: 'L7 · Post-Production' },
]

const SOP_COLORS: Record<number, string> = {
  1: 'bg-blue-100 text-blue-800',
  2: 'bg-violet-100 text-violet-800',
  3: 'bg-amber-100 text-amber-800',
  4: 'bg-red-100 text-red-800',
  5: 'bg-stone-100 text-stone-700',
  6: 'bg-orange-100 text-orange-800',
  7: 'bg-green-100 text-green-800',
}

interface ProjectForm {
  name: string
  description: string
  status: ProjectStatus
  clientId: string
  startDate: string
  dueDate: string
  driveFolder: string
  boardColumn: KanbanStage
  sopLevel: string
  value: string
}

const EMPTY: ProjectForm = {
  name: '',
  description: '',
  status: 'ACTIVE',
  clientId: '',
  startDate: '',
  dueDate: '',
  driveFolder: '',
  boardColumn: 'LEAD',
  sopLevel: '',
  value: '',
}

type ViewMode = 'grid' | 'board'

function getStoredView(): ViewMode {
  if (typeof window === 'undefined') return 'grid'
  return (localStorage.getItem('projects_view') as ViewMode) ?? 'grid'
}

export default function ProjectsPage() {
  const user = useAuthStore((s) => s.user)

  // ── Client portal: render a completely separate, brand-tailored view ─────────
  if (user?.role === 'CLIENT') {
    return (
      <div className="flex flex-col h-full overflow-hidden">
        <TopBar title="My Projects" />
        <div className="flex-1 overflow-y-auto p-5">
          <ClientProjectsView />
        </div>
      </div>
    )
  }
  // ────────────────────────────────────────────────────────────────────────────

  const [projects, setProjects] = useState<Project[]>([])
  const [clients, setClients] = useState<{ id: string; name: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<ViewMode>('grid')

  // Kanban filter
  const [clientFilter, setClientFilter] = useState('')

  // Create / edit modal
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<ProjectForm>(EMPTY)
  const [saving, setSaving] = useState(false)

  // Delete
  const [delTarget, setDelTarget] = useState<Project | null>(null)
  const [delForce, setDelForce] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Drawer
  const [drawerProject, setDrawerProject] = useState<Project | null>(null)

  // Drag & drop
  const draggingId = useRef<string | null>(null)
  const [dragOverCol, setDragOverCol] = useState<KanbanStage | null>(null)

  // Load view preference
  useEffect(() => { setView(getStoredView()) }, [])

  const switchView = (v: ViewMode) => {
    setView(v)
    localStorage.setItem('projects_view', v)
  }

  const fetchProjects = async () => {
    setLoading(true)
    const res = await fetch('/api/projects')
    const json = await res.json()
    setProjects(json.data ?? [])
    setLoading(false)
  }

  useEffect(() => { fetchProjects() }, [])

  useEffect(() => {
    if (user?.role === 'ADMIN' || user?.role === 'MANAGER') {
      fetch('/api/users?role=CLIENT')
        .then((r) => r.json())
        .then((j) => setClients(j.data ?? []))
    }
  }, [user])

  const openCreate = () => {
    setEditingId(null)
    setForm(EMPTY)
    setModalOpen(true)
  }

  const openEdit = (p: Project) => {
    setEditingId(p.id)
    setForm({
      name: p.name,
      description: p.description ?? '',
      status: p.status,
      clientId: p.client?.id ?? '',
      startDate: p.startDate ? p.startDate.split('T')[0] : '',
      dueDate: p.dueDate ? p.dueDate.split('T')[0] : '',
      driveFolder: p.driveFolder ?? '',
      boardColumn: p.boardColumn ?? 'ACTIVE',
      sopLevel: p.sopLevel != null ? String(p.sopLevel) : '',
      value: p.value != null ? String(p.value) : '',
    })
    setModalOpen(true)
  }

  const handleSave = async () => {
    if (!form.name.trim()) return toast.error('Project name is required')
    setSaving(true)
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description || null,
        status: form.status,
        boardColumn: form.boardColumn,
        clientId: form.clientId || null,
        startDate: form.startDate || null,
        dueDate: form.dueDate || null,
        driveFolder: form.driveFolder.trim() || null,
        sopLevel: form.sopLevel ? parseInt(form.sopLevel) : null,
        value: form.value ? parseFloat(form.value) : null,
      }
      const res = editingId
        ? await fetch(`/api/projects/${editingId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
        : await fetch('/api/projects', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      toast.success(editingId ? 'Project updated' : 'Project created')
      setModalOpen(false)
      setForm(EMPTY)
      setEditingId(null)
      fetchProjects()
    } catch (err: any) {
      toast.error(err.message ?? 'Failed')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!delTarget) return
    setDeleting(true)
    try {
      const url = delForce
        ? `/api/projects/${delTarget.id}?force=true`
        : `/api/projects/${delTarget.id}`
      const res = await fetch(url, { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok) {
        const linkedNote = json.details
          ? ` (${Object.entries(json.details)
              .filter(([_, v]) => Number(v) > 0)
              .map(([k, v]) => `${k}: ${v}`)
              .join(', ')})`
          : ''
        throw new Error((json.error ?? 'Failed') + linkedNote)
      }
      toast.success(json.message ?? 'Deleted')
      setDelTarget(null)
      setDelForce(false)
      setDrawerProject(null)
      fetchProjects()
    } catch (err: any) {
      toast.error(err.message, { duration: 6000 })
    } finally {
      setDeleting(false)
    }
  }

  const moveBoardColumn = async (projectId: string, newCol: KanbanStage) => {
    // Optimistic update
    setProjects(prev =>
      prev.map(p => p.id === projectId ? { ...p, boardColumn: newCol } : p)
    )
    if (drawerProject?.id === projectId) {
      setDrawerProject(prev => prev ? { ...prev, boardColumn: newCol } : null)
    }
    try {
      await fetch(`/api/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ boardColumn: newCol }),
      })
    } catch {
      toast.error('Failed to save position')
      fetchProjects()
    }
  }

  const canManage = user?.role === 'ADMIN' || user?.role === 'MANAGER'

  // Filtered projects for board view
  const boardProjects = clientFilter
    ? projects.filter(p => p.client?.id === clientFilter)
    : projects

  const byColumn = (col: KanbanStage) =>
    boardProjects.filter(p => (p.boardColumn ?? 'ACTIVE') === col)

  const colTotal = (col: KanbanStage) =>
    byColumn(col).reduce((s, p) => s + (p.value ?? 0), 0)

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <TopBar
        title="Projects"
        actions={
          <div className="flex items-center gap-2">
            {/* View toggle */}
            <div className="flex items-center bg-stone-100 rounded-md p-0.5">
              <button
                onClick={() => switchView('grid')}
                className={cn(
                  'flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-colors',
                  view === 'grid'
                    ? 'bg-white shadow-sm text-stone-900'
                    : 'text-stone-500 hover:text-stone-700'
                )}
              >
                <LayoutGrid size={12} /> Grid
              </button>
              <button
                onClick={() => switchView('board')}
                className={cn(
                  'flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-colors',
                  view === 'board'
                    ? 'bg-white shadow-sm text-stone-900'
                    : 'text-stone-500 hover:text-stone-700'
                )}
              >
                <Kanban size={12} /> Board
              </button>
            </div>
            {canManage && (
              <Button size="sm" onClick={openCreate}>
                <Plus size={13} /> New project
              </Button>
            )}
          </div>
        }
      />

      {/* ── GRID VIEW ── */}
      {view === 'grid' && (
        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
            </div>
          ) : projects.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-stone-100 flex items-center justify-center">
                <CheckSquare size={20} className="text-stone-400" />
              </div>
              <p className="text-sm font-semibold text-stone-700">No projects yet</p>
              <p className="text-xs text-stone-400 max-w-xs">Create your first project to start tracking tasks, content, and timelines for your clients.</p>
              {canManage && (
                <Button size="sm" onClick={openCreate}>
                  <Plus size={13} /> Create first project
                </Button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {projects.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  isAdmin={canManage}
                  onEdit={() => openEdit(project)}
                  onDelete={() => { setDelTarget(project); setDelForce(false) }}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── BOARD VIEW ── */}
      {view === 'board' && (
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Board toolbar */}
          <div className="flex items-center gap-3 px-5 py-2.5 border-b border-stone-100 bg-white flex-shrink-0">
            <p className="text-[11px] text-stone-500 font-medium">
              {boardProjects.length} project{boardProjects.length !== 1 ? 's' : ''}
            </p>
            {clients.length > 0 && (
              <select
                value={clientFilter}
                onChange={e => setClientFilter(e.target.value)}
                className="ml-auto text-xs border border-stone-200 rounded-md px-2.5 py-1.5 text-stone-700 bg-white focus:outline-none focus:ring-1 focus:ring-stone-400"
              >
                <option value="">All clients</option>
                {clients.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            )}
          </div>

          {/* Kanban columns */}
          <div className="flex-1 overflow-x-auto overflow-y-hidden">
            {loading ? (
              <div className="flex gap-3 p-4 h-full">
                {KANBAN_STAGES.map(s => (
                  <div key={s} className="w-64 flex-shrink-0 bg-stone-50 rounded-xl border-2 border-transparent">
                    <div className="px-3 py-2.5">
                      <div className="h-4 bg-stone-200 rounded animate-pulse w-24" />
                    </div>
                    <div className="px-2 space-y-2">
                      {Array.from({ length: 2 }).map((_, i) => (
                        <div key={i} className="bg-white rounded-lg border border-stone-100 p-3 space-y-2">
                          <div className="h-3 bg-stone-100 rounded animate-pulse" />
                          <div className="h-3 bg-stone-100 rounded animate-pulse w-3/4" />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex gap-3 p-4 h-full min-w-max">
                {KANBAN_STAGES.map(col => {
                  const cards = byColumn(col)
                  const total = colTotal(col)
                  return (
                    <div
                      key={col}
                      className={cn(
                        'flex flex-col w-64 rounded-xl border-2 transition-colors flex-shrink-0',
                        dragOverCol === col
                          ? 'border-stone-400 bg-stone-50'
                          : 'border-transparent bg-stone-50'
                      )}
                      onDragOver={e => { e.preventDefault(); setDragOverCol(col) }}
                      onDragLeave={e => {
                        if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverCol(null)
                      }}
                      onDrop={e => {
                        e.preventDefault()
                        if (draggingId.current) moveBoardColumn(draggingId.current, col)
                        draggingId.current = null
                        setDragOverCol(null)
                      }}
                    >
                      {/* Column header */}
                      <div className="px-3 py-2.5 flex-shrink-0">
                        <div className="flex items-center justify-between mb-0.5">
                          <span className={cn(
                            'text-[11px] font-semibold px-2 py-0.5 rounded-full border',
                            kanbanStageColor(col)
                          )}>
                            {KANBAN_STAGE_LABELS[col]}
                          </span>
                          <span className="text-[11px] text-stone-400 font-medium">{cards.length}</span>
                        </div>
                        {total > 0 && (
                          <p className="text-[10px] text-stone-400 mt-0.5 pl-0.5">
                            {formatMoney(total)}
                          </p>
                        )}
                      </div>

                      {/* Cards */}
                      <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-2">
                        {cards.length === 0 && (
                          <div className="flex flex-col items-center justify-center py-8 text-center">
                            <p className="text-[11px] text-stone-400">No projects</p>
                            <p className="text-[10px] text-stone-300 mt-0.5">Drag here to move</p>
                          </div>
                        )}
                        {cards.map(project => (
                          <div
                            key={project.id}
                            draggable={canManage}
                            onDragStart={() => { draggingId.current = project.id }}
                            onDragEnd={() => { draggingId.current = null; setDragOverCol(null) }}
                            onClick={() => setDrawerProject(project)}
                            className={cn(
                              'bg-white rounded-lg border border-stone-100 p-3 transition-all',
                              canManage ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer',
                              'hover:border-stone-300 hover:shadow-sm'
                            )}
                          >
                            <div className="flex items-start gap-1 mb-1.5">
                              {canManage && <GripVertical size={10} className="text-stone-300 mt-0.5 flex-shrink-0" />}
                              <p className="text-[11px] font-semibold text-stone-900 leading-snug flex-1">{project.name}</p>
                            </div>
                            {project.client && (
                              <div className="flex items-center gap-1 mb-1">
                                <User size={9} className="text-stone-400" />
                                <span className="text-[10px] text-stone-500 truncate">{project.client.name}</span>
                              </div>
                            )}
                            {project.value != null && project.value > 0 && (
                              <div className="flex items-center gap-1 mb-1">
                                <IndianRupee size={9} className="text-stone-400" />
                                <span className="text-[10px] font-medium text-stone-700">{formatMoney(project.value)}</span>
                              </div>
                            )}
                            {project.dueDate && (
                              <div className="flex items-center gap-1 mt-1.5">
                                <Calendar size={9} className="text-stone-400" />
                                <span className="text-[10px] text-stone-400">Due {formatDate(project.dueDate)}</span>
                              </div>
                            )}
                            <div className="mt-1.5 flex items-center gap-1 flex-wrap">
                              <Badge className={cn('text-[9px] py-0', projectStatusColor(project.status))}>
                                {PROJECT_STATUS_LABELS[project.status]}
                              </Badge>
                              {project.sopLevel != null && (
                                <span className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded', SOP_COLORS[project.sopLevel])}>
                                  L{project.sopLevel}
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Detail drawer (board view) ── */}
      {drawerProject && (
        <div className="fixed inset-0 bg-black/30 z-40 flex justify-end" onClick={() => setDrawerProject(null)}>
          <div
            className="w-96 bg-white h-full shadow-2xl flex flex-col overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start justify-between p-5 border-b border-stone-100">
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-stone-900 mb-1">{drawerProject.name}</h3>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <Badge className={cn(projectStatusColor(drawerProject.status), 'text-[10px]')}>
                    {PROJECT_STATUS_LABELS[drawerProject.status]}
                  </Badge>
                  <Badge className={cn(kanbanStageColor(drawerProject.boardColumn ?? 'ACTIVE'), 'text-[10px]')}>
                    {KANBAN_STAGE_LABELS[drawerProject.boardColumn ?? 'ACTIVE']}
                  </Badge>
                </div>
              </div>
              <button onClick={() => setDrawerProject(null)} className="text-stone-400 hover:text-stone-700 p-1 ml-2">
                <X size={16} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {/* Meta */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                {drawerProject.client && (
                  <div>
                    <p className="text-stone-400 mb-0.5 text-[10px] uppercase tracking-wide">Client</p>
                    <p className="font-medium text-stone-800">{drawerProject.client.name}</p>
                  </div>
                )}
                {drawerProject.dueDate && (
                  <div>
                    <p className="text-stone-400 mb-0.5 text-[10px] uppercase tracking-wide">Due Date</p>
                    <p className="font-medium text-stone-800">{formatDate(drawerProject.dueDate)}</p>
                  </div>
                )}
                {drawerProject.startDate && (
                  <div>
                    <p className="text-stone-400 mb-0.5 text-[10px] uppercase tracking-wide">Start Date</p>
                    <p className="font-medium text-stone-800">{formatDate(drawerProject.startDate)}</p>
                  </div>
                )}
                {drawerProject.sopLevel != null && (
                  <div>
                    <p className="text-stone-400 mb-0.5 text-[10px] uppercase tracking-wide">SOP Level</p>
                    <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded inline-block', SOP_COLORS[drawerProject.sopLevel])}>
                      {SOP_LEVELS.find(s => s.value === String(drawerProject.sopLevel))?.label ?? `L${drawerProject.sopLevel}`}
                    </span>
                  </div>
                )}
                {drawerProject._count && (
                  <div>
                    <p className="text-stone-400 mb-0.5 text-[10px] uppercase tracking-wide">Activity</p>
                    <p className="font-medium text-stone-800">
                      {drawerProject._count.tasks} tasks · {drawerProject._count.content} content
                    </p>
                  </div>
                )}
              </div>

              {drawerProject.description && (
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-stone-400 font-medium mb-1.5">Description</p>
                  <p className="text-xs text-stone-700 bg-stone-50 rounded-md p-3 leading-relaxed">
                    {drawerProject.description}
                  </p>
                </div>
              )}

              {/* Move to stage */}
              {canManage && (
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-stone-400 font-medium mb-2">Move to stage</p>
                  <div className="flex flex-wrap gap-1.5">
                    {KANBAN_STAGES.filter(s => s !== drawerProject.boardColumn).map(s => (
                      <button
                        key={s}
                        onClick={() => moveBoardColumn(drawerProject.id, s)}
                        className={cn(
                          'text-[10px] font-medium px-2 py-1 rounded-full border transition-opacity hover:opacity-80',
                          kanbanStageColor(s)
                        )}
                      >
                        {KANBAN_STAGE_LABELS[s]}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <Link
                href={`/projects/${drawerProject.id}`}
                className="flex items-center justify-between text-xs font-medium text-stone-700 bg-stone-50 hover:bg-stone-100 rounded-md px-3 py-2.5 transition-colors"
              >
                Open full project <ChevronRight size={13} />
              </Link>
            </div>

            {canManage && (
              <div className="p-4 border-t border-stone-100 flex gap-2">
                <button
                  onClick={() => { openEdit(drawerProject); setDrawerProject(null) }}
                  className="flex-1 flex items-center justify-center gap-1.5 text-xs font-medium text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-md py-2"
                >
                  <Pencil size={11} /> Edit
                </button>
                <button
                  onClick={() => { setDelTarget(drawerProject); setDelForce(false); setDrawerProject(null) }}
                  className="flex-1 flex items-center justify-center gap-1.5 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-md py-2"
                >
                  <Trash2 size={11} /> Delete
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Create / Edit Modal ── */}
      <Modal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditingId(null) }}
        title={editingId ? 'Edit Project' : 'New Project'}
      >
        <div className="space-y-3">
          <Input
            label="Project name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="e.g. AXS April Campaign"
          />
          <div>
            <label className="text-xs font-medium text-stone-600 uppercase tracking-wide block mb-1.5">
              Description
            </label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={2}
              placeholder="Optional project description"
              className="w-full rounded-md border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-400 resize-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Status"
              options={STATUS_OPTIONS}
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value as ProjectStatus })}
            />
            <Select
              label="Pipeline stage"
              options={Object.entries(KANBAN_STAGE_LABELS).map(([v, l]) => ({ value: v, label: l }))}
              value={form.boardColumn}
              onChange={(e) => setForm({ ...form, boardColumn: e.target.value as KanbanStage })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Select
              label="SOP Level"
              options={SOP_LEVELS}
              value={form.sopLevel}
              onChange={(e) => setForm({ ...form, sopLevel: e.target.value })}
            />
            <Input
              label="Project Value (₹)"
              type="number"
              min="0"
              step="0.01"
              value={form.value}
              onChange={(e) => setForm({ ...form, value: e.target.value })}
              placeholder="0.00"
            />
          </div>
          {clients.length > 0 && (
            <Select
              label="Client"
              placeholder="No client"
              options={[
                { value: '', label: 'No client' },
                ...clients.map((c) => ({ value: c.id, label: c.name })),
              ]}
              value={form.clientId}
              onChange={(e) => setForm({ ...form, clientId: e.target.value })}
            />
          )}
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Start date"
              type="date"
              value={form.startDate}
              onChange={(e) => setForm({ ...form, startDate: e.target.value })}
            />
            <Input
              label="Due date"
              type="date"
              value={form.dueDate}
              onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
            />
          </div>
          <Input
            label="Google Drive folder"
            type="url"
            value={form.driveFolder}
            onChange={(e) => setForm({ ...form, driveFolder: e.target.value })}
            placeholder="https://drive.google.com/drive/folders/..."
          />
          <div className="flex gap-2 pt-1">
            <Button variant="secondary" size="sm" className="flex-1" onClick={() => { setModalOpen(false); setEditingId(null) }}>
              Cancel
            </Button>
            <Button size="sm" className="flex-1" loading={saving} onClick={handleSave}>
              {editingId ? 'Save changes' : 'Create project'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Delete confirm ── */}
      <Modal
        open={!!delTarget}
        onClose={() => { setDelTarget(null); setDelForce(false) }}
        title="Delete project"
      >
        {delTarget && (
          <div className="space-y-3">
            <p className="text-sm text-stone-700">
              Delete <span className="font-semibold">{delTarget.name}</span>?
            </p>
            {delTarget._count && (
              (delTarget._count.tasks ?? 0) > 0 ||
              (delTarget._count.content ?? 0) > 0 ||
              (delTarget._count.transactions ?? 0) > 0 ||
              (delTarget._count.events ?? 0) > 0 ||
              (delTarget._count.notes ?? 0) > 0
            ) && (
              <div className="rounded-md bg-amber-50 border border-amber-100 px-3 py-2.5">
                <p className="text-[11px] text-amber-700 leading-relaxed font-semibold">
                  This project has linked records:
                </p>
                <ul className="list-disc list-inside text-[11px] text-amber-700 mt-1 space-y-0.5 ml-1">
                  {(delTarget._count.tasks ?? 0) > 0 && <li>{delTarget._count.tasks} task(s)</li>}
                  {(delTarget._count.content ?? 0) > 0 && <li>{delTarget._count.content} content item(s)</li>}
                  {(delTarget._count.transactions ?? 0) > 0 && <li>{delTarget._count.transactions} transaction(s)</li>}
                  {(delTarget._count.events ?? 0) > 0 && <li>{delTarget._count.events} calendar event(s)</li>}
                  {(delTarget._count.notes ?? 0) > 0 && <li>{delTarget._count.notes} note(s)</li>}
                </ul>
                <p className="text-[11px] text-amber-700 leading-relaxed mt-2">
                  Check below to detach them and delete the project anyway.
                </p>
                <label className="flex items-center gap-2 mt-2 text-xs text-amber-900 font-medium cursor-pointer">
                  <input
                    type="checkbox"
                    checked={delForce}
                    onChange={(e) => setDelForce(e.target.checked)}
                    className="rounded border-amber-300 text-amber-600 focus:ring-amber-500"
                  />
                  Detach linked records and delete anyway
                </label>
              </div>
            )}
            <div className="flex gap-2 pt-1">
              <Button variant="secondary" size="sm" className="flex-1" onClick={() => { setDelTarget(null); setDelForce(false) }}>
                Cancel
              </Button>
              <Button size="sm" className="flex-1 bg-red-600 hover:bg-red-700 text-white" loading={deleting} onClick={handleDelete}>
                Delete
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

function ProjectCard({
  project,
  isAdmin,
  onEdit,
  onDelete,
}: {
  project: Project
  isAdmin: boolean
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <div className="bg-white rounded-lg border border-stone-100 p-4 shadow-sm flex flex-col hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-2 mb-2">
        <Link
          href={`/projects/${project.id}`}
          className="text-sm font-semibold text-stone-900 leading-snug hover:text-stone-700 hover:underline"
        >
          {project.name}
        </Link>
        {isAdmin && (
          <>
            <button onClick={onEdit} className="p-1.5 rounded hover:bg-stone-100 text-stone-500 hover:text-stone-900" title="Edit">
              <Pencil size={12} />
            </button>
            <button onClick={onDelete} className="p-1.5 rounded hover:bg-red-50 text-stone-500 hover:text-red-600" title="Delete">
              <Trash2 size={12} />
            </button>
          </>
        )}
      </div>
    </div>
  )
}
