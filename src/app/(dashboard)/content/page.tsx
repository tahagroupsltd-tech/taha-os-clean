'use client'
// src/app/(dashboard)/content/page.tsx
import { useState, useEffect, useCallback } from 'react'
import { TopBar } from '@/components/layout/TopBar'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { useAuthStore } from '@/store/auth.store'
import { contentStatusColor, formatDate, CONTENT_STATUS_LABELS } from '@/lib/utils'
import type { Content, ContentType, ContentStatus } from '@/types'
import { Plus, Pencil, Trash2, ExternalLink } from 'lucide-react'
import toast from 'react-hot-toast'

const STATUS_PIPELINE: ContentStatus[] = [
  'IDEA', 'SCRIPTING', 'SHOOTING', 'EDITING', 'REVIEW', 'POSTED'
]

const TYPE_OPTIONS: { value: ContentType; label: string }[] = [
  { value: 'REEL', label: 'Reel' },
  { value: 'POSTER', label: 'Poster' },
  { value: 'STORY', label: 'Story' },
  { value: 'VIDEO', label: 'Video' },
  { value: 'GRAPHIC', label: 'Graphic' },
]

const STATUS_OPTIONS = STATUS_PIPELINE.map((s) => ({
  value: s,
  label: CONTENT_STATUS_LABELS[s],
}))

interface ContentForm {
  title: string
  type: ContentType
  status: ContentStatus
  description: string
  driveLink: string
  caption: string
  postDate: string
  assigneeId: string
  projectId: string
}

const EMPTY: ContentForm = {
  title: '',
  type: 'REEL',
  status: 'IDEA',
  description: '',
  driveLink: '',
  caption: '',
  postDate: '',
  assigneeId: '',
  projectId: '',
}

export default function ContentPage() {
  const user = useAuthStore((s) => s.user)
  const [items, setItems] = useState<Content[]>([])
  const [users, setUsers] = useState<{ id: string; name: string }[]>([])
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState<string>('')
  const [filterType, setFilterType] = useState<string>('')
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
    setItems(data)
    setLoading(false)
  }, [filterStatus, filterType])

  useEffect(() => { fetchContent() }, [fetchContent])

  useEffect(() => {
    if (user?.role === 'ADMIN' || user?.role === 'MANAGER') {
      fetch('/api/users').then(r => r.json()).then(j => setUsers(j.data ?? []))
      fetch('/api/projects').then(r => r.json()).then(j => setProjects(j.data ?? []))
    }
  }, [user])

  const openCreate = () => {
    setEditing(null)
    setForm(EMPTY)
    setModalOpen(true)
  }

  const openEdit = (item: Content) => {
    setEditing(item)
    setForm({
      title: item.title,
      type: item.type,
      status: item.status,
      description: item.description ?? '',
      driveLink: item.driveLink ?? '',
      caption: item.caption ?? '',
      postDate: item.postDate ? item.postDate.split('T')[0] : '',
      assigneeId: item.assigneeId ?? '',
      projectId: item.projectId ?? '',
    })
    setModalOpen(true)
  }

  const handleSave = async () => {
    if (!form.title.trim()) return toast.error('Title is required')
    setSaving(true)
    try {
      const payload = {
        ...form,
        postDate: form.postDate || null,
        assigneeId: form.assigneeId || null,
        projectId: form.projectId || null,
        driveLink: form.driveLink || null,
        caption: form.caption || null,
        description: form.description || null,
      }
      const res = editing
        ? await fetch(`/api/content/${editing.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
        : await fetch('/api/content', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
      if (!res.ok) throw new Error((await res.json()).error)
      toast.success(editing ? 'Updated' : 'Created')
      setModalOpen(false)
      fetchContent()
    } catch (err: any) {
      toast.error(err.message ?? 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this content item?')) return
    const res = await fetch(`/api/content/${id}`, { method: 'DELETE' })
    if (res.ok) {
      toast.success('Deleted')
      setItems((p) => p.filter((i) => i.id !== id))
    }
  }

  const handleStatusChange = async (id: string, status: ContentStatus) => {
    const res = await fetch(`/api/content/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    if (res.ok) {
      setItems((p) => p.map((i) => i.id === id ? { ...i, status } : i))
    }
  }

  const canEdit = user?.role !== 'CLIENT'
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'MANAGER'

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <TopBar
        title="Content"
        actions={
          <div className="flex items-center gap-2">
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
            {canEdit && (
              <Button size="sm" onClick={openCreate}>
                <Plus size={13} /> New
              </Button>
            )}
          </div>
        }
      />

      {/* Pipeline header */}
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

      {/* Content list */}
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

      {/* Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Content' : 'New Content'}
        size="lg"
      >
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <Input
              label="Title"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Content title"
            />
          </div>
          <Select
            label="Type"
            options={TYPE_OPTIONS}
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value as ContentType })}
          />
          <Select
            label="Status"
            options={STATUS_OPTIONS}
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value as ContentStatus })}
          />
          <div className="col-span-2">
            <label className="text-xs font-medium text-stone-600 uppercase tracking-wide block mb-1.5">
              Description
            </label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Brief, shoot notes, references..."
              rows={2}
              className="w-full rounded-md border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-400 resize-none"
            />
          </div>
          <Input
            label="Post Date"
            type="date"
            value={form.postDate}
            onChange={(e) => setForm({ ...form, postDate: e.target.value })}
          />
          <Input
            label="Drive Link"
            type="url"
            value={form.driveLink}
            onChange={(e) => setForm({ ...form, driveLink: e.target.value })}
            placeholder="https://drive.google.com/..."
          />
          <div className="col-span-2">
            <label className="text-xs font-medium text-stone-600 uppercase tracking-wide block mb-1.5">
              Caption
            </label>
            <textarea
              value={form.caption}
              onChange={(e) => setForm({ ...form, caption: e.target.value })}
              placeholder="Post caption with hashtags..."
              rows={2}
              className="w-full rounded-md border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-400 resize-none"
            />
          </div>
          {users.length > 0 && (
            <Select
              label="Assignee"
              placeholder="Unassigned"
              options={users.map((u) => ({ value: u.id, label: u.name }))}
              value={form.assigneeId}
              onChange={(e) => setForm({ ...form, assigneeId: e.target.value })}
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
          <div className="col-span-2 flex gap-2 pt-1">
            <Button variant="secondary" size="sm" className="flex-1" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" className="flex-1" loading={saving} onClick={handleSave}>
              {editing ? 'Save changes' : 'Create'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

function ContentCard({ item, canEdit, isAdmin, onEdit, onDelete, onStatusChange }: {
  item: Content
  canEdit: boolean
  isAdmin: boolean
  onEdit: (i: Content) => void
  onDelete: (id: string) => void
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
        <Badge className={contentStatusColor(item.status)}>
          {CONTENT_STATUS_LABELS[item.status]}
        </Badge>
        <span className="text-[10px] text-stone-400 bg-stone-50 rounded px-1.5 py-0.5 font-medium">
          {item.type}
        </span>
      </div>

      {item.description && (
        <p className="text-[11px] text-stone-500 mb-3 leading-relaxed line-clamp-2">
          {item.description}
        </p>
      )}

      <div className="flex items-center justify-between text-[10px] text-stone-400 mb-3">
        <span>{item.assignee?.name ?? 'Unassigned'}</span>
        {item.postDate && <span>Post: {formatDate(item.postDate)}</span>}
      </div>

      <div className="flex items-center gap-2">
        {canEdit && (
          <select
            value={item.status}
            onChange={(e) => onStatusChange(item.id, e.target.value as ContentStatus)}
            className="flex-1 text-[10px] rounded border border-stone-100 bg-stone-50 px-2 py-1 text-stone-600 focus:outline-none"
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        )}
        {item.driveLink && (
          <a
            href={item.driveLink}
            target="_blank"
            rel="noreferrer"
            className="p-1.5 rounded text-stone-400 hover:text-stone-700 hover:bg-stone-100"
            title="Open Drive"
          >
            <ExternalLink size={12} />
          </a>
        )}
      </div>
    </div>
  )
}
