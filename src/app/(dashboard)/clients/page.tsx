'use client'
// src/app/(dashboard)/clients/page.tsx
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { TopBar } from '@/components/layout/TopBar'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { useAuthStore } from '@/store/auth.store'
import { projectStatusColor, formatDate, PROJECT_STATUS_LABELS } from '@/lib/utils'
import type { Project, ProjectStatus } from '@/types'
import { Plus, CheckSquare, FileVideo, Pencil, Trash2, ArrowRight } from 'lucide-react'
import toast from 'react-hot-toast'

const STATUS_OPTIONS = Object.entries(PROJECT_STATUS_LABELS).map(([v, l]) => ({
  value: v,
  label: l,
}))

interface ProjectForm {
  name: string
  description: string
  status: ProjectStatus
  clientId: string
  startDate: string
  dueDate: string
  driveFolder: string
}

const EMPTY: ProjectForm = {
  name: '',
  description: '',
  status: 'ACTIVE',
  clientId: '',
  startDate: '',
  dueDate: '',
  driveFolder: '',
}

export default function ClientsPage() {
  const user = useAuthStore((s) => s.user)
  const [projects, setProjects] = useState<Project[]>([])
  const [clients, setClients] = useState<{ id: string; name: string }[]>([])
  const [loading, setLoading] = useState(true)

  // Create / edit
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<ProjectForm>(EMPTY)
  const [saving, setSaving] = useState(false)

  // Delete
  const [delTarget, setDelTarget] = useState<Project | null>(null)
  const [delForce, setDelForce] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const fetchProjects = async () => {
    setLoading(true)
    const res = await fetch('/api/projects')
    const json = await res.json()
    setProjects(json.data ?? [])
    setLoading(false)
  }

  useEffect(() => {
    fetchProjects()
  }, [])

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
        clientId: form.clientId || null,
        startDate: form.startDate || null,
        dueDate: form.dueDate || null,
        driveFolder: form.driveFolder.trim() || null,
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
      fetchProjects()
    } catch (err: any) {
      toast.error(err.message, { duration: 6000 })
    } finally {
      setDeleting(false)
    }
  }

  const canManage = user?.role === 'ADMIN' || user?.role === 'MANAGER'
  // kept for prop name compatibility below
  const isAdmin = canManage

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <TopBar
        title="Projects"
        actions={
          isAdmin ? (
            <Button size="sm" onClick={openCreate}>
              <Plus size={13} /> New project
            </Button>
          ) : null
        }
      />

      <div className="flex-1 overflow-y-auto p-5">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <p className="text-xs text-stone-400">Loading...</p>
          </div>
        ) : projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-sm font-medium text-stone-600 mb-1">No projects yet</p>
            {isAdmin && (
              <p className="text-xs text-stone-400">Create a project to get started</p>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {projects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                isAdmin={isAdmin}
                onEdit={() => openEdit(project)}
                onDelete={() => {
                  setDelTarget(project)
                  setDelForce(false)
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Create / Edit Modal ─────────────────────── */}
      <Modal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false)
          setEditingId(null)
        }}
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
          <Select
            label="Status"
            options={STATUS_OPTIONS}
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value as ProjectStatus })}
          />
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
            <Button
              variant="secondary"
              size="sm"
              className="flex-1"
              onClick={() => {
                setModalOpen(false)
                setEditingId(null)
              }}
            >
              Cancel
            </Button>
            <Button size="sm" className="flex-1" loading={saving} onClick={handleSave}>
              {editingId ? 'Save changes' : 'Create project'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Delete confirm ─────────────────────────── */}
      <Modal
        open={!!delTarget}
        onClose={() => {
          setDelTarget(null)
          setDelForce(false)
        }}
        title="Delete project"
      >
        {delTarget && (
          <div className="space-y-3">
            <p className="text-sm text-stone-700">
              Delete <span className="font-semibold">{delTarget.name}</span>?
            </p>
            {delTarget._count && (delTarget._count.tasks > 0 || delTarget._count.content > 0) && (
              <div className="rounded-md bg-amber-50 border border-amber-100 px-3 py-2.5">
                <p className="text-[11px] text-amber-700 leading-relaxed">
                  This project has linked records: {delTarget._count.tasks} task(s) and{' '}
                  {delTarget._count.content} content item(s). Check the box below to detach
                  them and delete the project anyway. The tasks and content will remain (with no
                  project).
                </p>
                <label className="flex items-center gap-2 mt-2 text-xs text-amber-900">
                  <input
                    type="checkbox"
                    checked={delForce}
                    onChange={(e) => setDelForce(e.target.checked)}
                  />
                  Detach linked records and delete anyway
                </label>
              </div>
            )}
            <div className="flex gap-2 pt-1">
              <Button
                variant="secondary"
                size="sm"
                className="flex-1"
                onClick={() => {
                  setDelTarget(null)
                  setDelForce(false)
                }}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                loading={deleting}
                onClick={handleDelete}
              >
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
    <div className="bg-white rounded-lg border border-stone-100 p-4 shadow-card flex flex-col">
      <div className="flex items-start justify-between gap-2 mb-2">
        <Link
          href={`/clients/${project.id}`}
          className="text-sm font-semibold text-stone-900 leading-snug hover:text-stone-700 hover:underline"
        >
          {project.name}
        </Link>
        <Badge className={projectStatusColor(project.status)}>
          {PROJECT_STATUS_LABELS[project.status]}
        </Badge>
      </div>

      {project.client && (
        <p className="text-xs text-stone-500 mb-2">Client: {project.client.name}</p>
      )}

      {project.description && (
        <p className="text-xs text-stone-400 mb-3 leading-relaxed line-clamp-2">
          {project.description}
        </p>
      )}

      <div className="flex items-center gap-3 pt-2 border-t border-stone-50">
        {project._count && (
          <>
            <div className="flex items-center gap-1.5 text-[11px] text-stone-400">
              <CheckSquare size={12} />
              <span>{project._count.tasks} tasks</span>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-stone-400">
              <FileVideo size={12} />
              <span>{project._count.content} content</span>
            </div>
          </>
        )}
        {project.dueDate && (
          <span className="ml-auto text-[11px] text-stone-400">
            Due {formatDate(project.dueDate)}
          </span>
        )}
      </div>

      <div className="flex items-center gap-1 mt-3 pt-2 border-t border-stone-50">
        <Link
          href={`/clients/${project.id}`}
          className="flex-1 flex items-center justify-center gap-1 text-[11px] font-medium text-stone-600 hover:text-stone-900 py-1.5 rounded hover:bg-stone-50"
        >
          Open <ArrowRight size={11} />
        </Link>
        {isAdmin && (
          <>
            <button
              onClick={onEdit}
              className="p-1.5 rounded hover:bg-stone-100 text-stone-500 hover:text-stone-900"
              title="Edit"
            >
              <Pencil size={12} />
            </button>
            <button
              onClick={onDelete}
              className="p-1.5 rounded hover:bg-red-50 text-stone-500 hover:text-red-600"
              title="Delete"
            >
              <Trash2 size={12} />
            </button>
          </>
        )}
      </div>
    </div>
  )
}
