'use client'
// src/app/(dashboard)/team/team-client.tsx
import { useState, useMemo, useEffect, useCallback } from 'react'
import { TopBar } from '@/components/layout/TopBar'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import type { User, Role } from '@/types'
import {
  canEditUser,
  canDeleteUser,
  canAssignRole,
  ROLE_LABEL,
} from '@/lib/permissions'
import { Plus, UserCheck, Pencil, Trash2, UserX, UserPlus, LayoutList, BarChart2, AlertTriangle, RefreshCw } from 'lucide-react'
import toast from 'react-hot-toast'

// ── Workload types ────────────────────────────────────────
interface MemberLoad {
  id: string
  name: string
  username: string
  role: string
  openCount: number
  dueSoon: number
  overdue: number
  inProgress: number
}

const ALL_ROLE_OPTIONS: { value: Role; label: string }[] = [
  { value: 'ADMIN',            label: ROLE_LABEL.ADMIN },
  { value: 'MANAGER',          label: ROLE_LABEL.MANAGER },
  { value: 'EMPLOYEE',         label: ROLE_LABEL.EMPLOYEE },
  { value: 'EDITOR',           label: ROLE_LABEL.EDITOR },
  { value: 'SCRIPTWRITER',     label: ROLE_LABEL.SCRIPTWRITER },
  { value: 'GRAPHIC_DESIGNER', label: ROLE_LABEL.GRAPHIC_DESIGNER },
  { value: 'WEB_DESIGNER',     label: ROLE_LABEL.WEB_DESIGNER },
  { value: 'CLIENT',           label: ROLE_LABEL.CLIENT },
]

const ROLE_BADGE: Record<Role, string> = {
  ADMIN:            'bg-stone-900 text-white',
  MANAGER:          'bg-purple-50 text-purple-700',
  EMPLOYEE:         'bg-blue-50 text-blue-700',
  EDITOR:           'bg-cyan-50 text-cyan-700',
  SCRIPTWRITER:     'bg-violet-50 text-violet-700',
  GRAPHIC_DESIGNER: 'bg-pink-50 text-pink-700',
  WEB_DESIGNER:     'bg-teal-50 text-teal-700',
  CLIENT:           'bg-amber-50 text-amber-700',
}

interface CreateForm {
  username: string
  name: string
  phone: string
  email: string
  password: string
  role: Role
}

const EMPTY: CreateForm = {
  username: '',
  name: '',
  phone: '',
  email: '',
  password: '',
  role: 'EMPLOYEE',
}

interface EditForm {
  id: string
  name: string
  username: string
  phone: string
  email: string
  role: Role
  isActive: boolean
}

interface DeleteState {
  user: User
  permanent: boolean
}

interface Props {
  initialUsers: User[]
  currentUserId: string
  currentUserRole: Role
}

export function TeamClient({ initialUsers, currentUserId, currentUserRole }: Props) {
  const assignableRoles = useMemo(
    () => ALL_ROLE_OPTIONS.filter((o) => canAssignRole(currentUserRole, o.value)),
    [currentUserRole]
  )
  const [users, setUsers] = useState<User[]>(initialUsers)
  const [refreshing, setRefreshing] = useState(false)
  const [view, setView] = useState<'members' | 'workload'>('members')
  const [workload, setWorkload] = useState<MemberLoad[]>([])
  const [loadingWorkload, setLoadingWorkload] = useState(false)

  const fetchWorkload = useCallback(async () => {
    setLoadingWorkload(true)
    try {
      const res = await fetch('/api/team/workload')
      const j = await res.json()
      setWorkload(j.data ?? [])
    } finally {
      setLoadingWorkload(false)
    }
  }, [])

  useEffect(() => {
    if (view === 'workload') fetchWorkload()
  }, [view, fetchWorkload])

  // Create modal
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState<CreateForm>(EMPTY)
  const [saving, setSaving] = useState(false)

  // Edit modal
  const [editForm, setEditForm] = useState<EditForm | null>(null)
  const [savingEdit, setSavingEdit] = useState(false)

  // Delete confirm modal
  const [delState, setDelState] = useState<DeleteState | null>(null)
  const [deleting, setDeleting] = useState(false)

  const refreshUsers = async () => {
    setRefreshing(true)
    try {
      const res = await fetch('/api/users', { cache: 'no-store' })
      const json = await res.json()
      setUsers(json.data ?? [])
    } finally {
      setRefreshing(false)
    }
  }

  // ── Create ───────────────────────────────────────
  const handleCreate = async () => {
    if (!form.username || !form.name || !form.password) {
      return toast.error('Username, name, and password are required')
    }
    setSaving(true)
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          phone: form.phone || undefined,
          email: form.email || undefined,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      toast.success(`Account created for ${form.name}`)
      setModalOpen(false)
      setForm(EMPTY)
      refreshUsers()
    } catch (err: any) {
      toast.error(err.message ?? 'Failed')
    } finally {
      setSaving(false)
    }
  }

  // ── Edit ─────────────────────────────────────────
  const openEdit = (u: User) => {
    setEditForm({
      id: u.id,
      name: u.name,
      username: u.username,
      phone: u.phone ?? '',
      email: u.email ?? '',
      role: u.role as Role,
      isActive: u.isActive,
    })
  }

  const handleEdit = async () => {
    if (!editForm) return
    if (!editForm.name || !editForm.username) {
      return toast.error('Name and username are required')
    }
    setSavingEdit(true)
    try {
      const res = await fetch(`/api/users/${editForm.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editForm.name,
          username: editForm.username,
          phone: editForm.phone || null,
          email: editForm.email || null,
          role: editForm.role,
          isActive: editForm.isActive,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      toast.success(`${editForm.name} updated`)
      setEditForm(null)
      refreshUsers()
    } catch (err: any) {
      toast.error(err.message ?? 'Failed')
    } finally {
      setSavingEdit(false)
    }
  }

  // ── Toggle active inline ─────────────────────────
  const toggleActive = async (u: User) => {
    try {
      const res = await fetch(`/api/users/${u.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !u.isActive }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      toast.success(
        u.isActive ? `${u.name} deactivated` : `${u.name} reactivated`
      )
      refreshUsers()
    } catch (err: any) {
      toast.error(err.message ?? 'Failed')
    }
  }

  // ── Delete ───────────────────────────────────────
  const handleDelete = async () => {
    if (!delState) return
    setDeleting(true)
    try {
      const url = delState.permanent
        ? `/api/users/${delState.user.id}?permanent=true`
        : `/api/users/${delState.user.id}`
      const res = await fetch(url, { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok) {
        const detail = json.details
          ? ` (linked records: ${Object.entries(json.details)
              .filter(([_, v]) => Number(v) > 0)
              .map(([k, v]) => `${k}=${v}`)
              .join(', ')})`
          : ''
        throw new Error((json.error ?? 'Failed') + detail)
      }
      toast.success(json.message ?? 'Done')
      setDelState(null)
      refreshUsers()
    } catch (err: any) {
      toast.error(err.message ?? 'Failed', { duration: 6000 })
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <TopBar
        title="Team"
        actions={
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-stone-100 rounded-md p-0.5 gap-0.5">
              <button
                onClick={() => setView('members')}
                className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded transition-colors ${view === 'members' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}
              >
                <LayoutList size={12} /> Members
              </button>
              <button
                onClick={() => setView('workload')}
                className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded transition-colors ${view === 'workload' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}
              >
                <BarChart2 size={12} /> Workload
              </button>
            </div>
            {view === 'workload' && (
              <button onClick={fetchWorkload} disabled={loadingWorkload}
                className="p-1.5 rounded hover:bg-stone-100 text-stone-400 hover:text-stone-700 transition-colors">
                <RefreshCw size={13} className={loadingWorkload ? 'animate-spin' : ''} />
              </button>
            )}
            {view === 'members' && (
              <Button size="sm" onClick={() => setModalOpen(true)}>
                <Plus size={13} /> Add user
              </Button>
            )}
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto p-5">
        {view === 'workload' ? (
          <WorkloadView data={workload} loading={loadingWorkload} roleLabel={ROLE_LABEL} />
        ) : (
        <div className="bg-white rounded-lg border border-stone-100 overflow-hidden">
          <div className="px-4 py-3 border-b border-stone-100 bg-stone-50 flex items-center justify-between">
            <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide">
              {users.length} users
            </p>
            {refreshing && <p className="text-[10px] text-stone-400">refreshing…</p>}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-stone-50 bg-stone-50/40">
                  <th className="text-left px-4 py-2.5 font-medium text-stone-400 uppercase tracking-wide whitespace-nowrap">Name</th>
                  <th className="text-left px-4 py-2.5 font-medium text-stone-400 uppercase tracking-wide whitespace-nowrap">Username</th>
                  <th className="text-left px-4 py-2.5 font-medium text-stone-400 uppercase tracking-wide whitespace-nowrap">Role</th>
                  <th className="text-left px-4 py-2.5 font-medium text-stone-400 uppercase tracking-wide whitespace-nowrap">Status</th>
                  <th className="text-left px-4 py-2.5 font-medium text-stone-400 uppercase tracking-wide whitespace-nowrap">Joined</th>
                  <th className="text-right px-4 py-2.5 font-medium text-stone-400 uppercase tracking-wide whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-50">
                {users.map((user) => {
                  const isMe = user.id === currentUserId
                  const userRole = user.role as Role
                  const mayEdit = isMe || canEditUser(currentUserRole, userRole)
                  const mayToggle = !isMe && canEditUser(currentUserRole, userRole)
                  const mayDelete = !isMe && canDeleteUser(currentUserRole, userRole)
                  return (
                    <tr key={user.id} className="table-row-hover">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-stone-100 flex items-center justify-center flex-shrink-0">
                            <span className="text-[11px] font-bold text-stone-600">
                              {user.name[0].toUpperCase()}
                            </span>
                          </div>
                          <div className="flex flex-col">
                            <span className="font-medium text-stone-900">
                              {user.name}
                              {isMe && <span className="ml-2 text-[10px] text-stone-400">(you)</span>}
                            </span>
                            {(user.email || user.phone) && (
                              <span className="text-[10px] text-stone-400 select-all">
                                {user.email} {user.email && user.phone && '•'} {user.phone}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-stone-500 font-mono whitespace-nowrap">{user.username}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <Badge className={ROLE_BADGE[user.role as Role]}>
                          {ROLE_LABEL[user.role as Role]}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <div className={`w-1.5 h-1.5 rounded-full ${user.isActive ? 'bg-green-500' : 'bg-stone-300'}`} />
                          <span className="text-stone-500">{user.isActive ? 'Active' : 'Inactive'}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-stone-400 whitespace-nowrap">
                        {new Date(user.createdAt).toLocaleDateString('en-IN', {
                          day: '2-digit', month: 'short', year: 'numeric',
                        })}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1">
                        {mayEdit && (
                          <button
                            onClick={() => openEdit(user)}
                            className="p-1.5 rounded hover:bg-stone-100 text-stone-500 hover:text-stone-900 transition-colors"
                            title="Edit"
                          >
                            <Pencil size={13} />
                          </button>
                        )}
                        {mayToggle && (
                          <button
                            onClick={() => toggleActive(user)}
                            className="p-1.5 rounded hover:bg-stone-100 text-stone-500 hover:text-stone-900 transition-colors"
                            title={user.isActive ? 'Deactivate' : 'Reactivate'}
                          >
                            {user.isActive ? <UserX size={13} /> : <UserPlus size={13} />}
                          </button>
                        )}
                        {mayDelete && (
                          <button
                            onClick={() => setDelState({ user, permanent: false })}
                            className="p-1.5 rounded hover:bg-red-50 text-stone-500 hover:text-red-600 transition-colors"
                            title="Delete"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        </div>
        )}
      </div>

      {/* ── Create modal ─────────────────────────── */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Add User">
        <div className="space-y-3">
          <div className="rounded-md bg-blue-50 border border-blue-100 px-3 py-2.5">
            <div className="flex items-start gap-2">
              <UserCheck size={13} className="text-blue-500 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-blue-700">
                The user will log in using their username or phone number with the password you set here.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Full name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Priya Nair"
            />
            <Input
              label="Username"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value.toLowerCase() })}
              placeholder="priya"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Phone (optional)"
              type="tel"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="9840000007"
            />
            <Input
              label="Email (optional)"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="priya@example.com"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Role"
              options={assignableRoles}
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value as Role })}
            />
            <Input
              label="Password"
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="Set a password for this user"
            />
          </div>
          <div className="flex gap-2 pt-1">
            <Button variant="secondary" size="sm" className="flex-1" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" className="flex-1" loading={saving} onClick={handleCreate}>
              Create account
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Edit modal ───────────────────────────── */}
      <Modal open={!!editForm} onClose={() => setEditForm(null)} title="Edit User">
        {editForm && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Full name"
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              />
              <Input
                label="Username"
                value={editForm.username}
                onChange={(e) =>
                  setEditForm({ ...editForm, username: e.target.value.toLowerCase() })
                }
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Phone"
                type="tel"
                value={editForm.phone}
                onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                placeholder="—"
              />
              <Input
                label="Email (optional)"
                type="email"
                value={editForm.email}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                placeholder="—"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Select
                label="Role"
                options={assignableRoles}
                value={editForm.role}
                onChange={(e) => setEditForm({ ...editForm, role: e.target.value as Role })}
                disabled={editForm.id === currentUserId}
              />
            </div>
            <label className="flex items-center gap-2 text-xs text-stone-700 mt-1">
              <input
                type="checkbox"
                checked={editForm.isActive}
                onChange={(e) => setEditForm({ ...editForm, isActive: e.target.checked })}
                disabled={editForm.id === currentUserId}
                className="rounded border-stone-300"
              />
              Account is active (uncheck to block login)
            </label>
            {editForm.id === currentUserId && (
              <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-100 rounded-md px-2.5 py-1.5">
                You can rename yourself, but cannot change your own role or deactivate yourself.
              </p>
            )}
            <div className="flex gap-2 pt-1">
              <Button variant="secondary" size="sm" className="flex-1" onClick={() => setEditForm(null)}>
                Cancel
              </Button>
              <Button size="sm" className="flex-1" loading={savingEdit} onClick={handleEdit}>
                Save changes
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Delete confirm modal ─────────────────── */}
      <Modal open={!!delState} onClose={() => setDelState(null)} title="Delete user">
        {delState && (
          <div className="space-y-3">
            <p className="text-sm text-stone-700">
              How do you want to remove <span className="font-semibold">{delState.user.name}</span>?
            </p>
            <div className="space-y-2">
              <label className="flex items-start gap-2 rounded-md border border-stone-200 p-3 cursor-pointer hover:border-stone-300">
                <input
                  type="radio"
                  name="del-mode"
                  checked={!delState.permanent}
                  onChange={() => setDelState({ ...delState, permanent: false })}
                  className="mt-0.5"
                />
                <div className="flex-1">
                  <p className="text-xs font-semibold text-stone-900">Deactivate (recommended)</p>
                  <p className="text-[11px] text-stone-500 mt-0.5">
                    Blocks login but keeps their tasks, notes, transactions, and history intact.
                    Reversible from the team page.
                  </p>
                </div>
              </label>
              <label className="flex items-start gap-2 rounded-md border border-stone-200 p-3 cursor-pointer hover:border-red-300">
                <input
                  type="radio"
                  name="del-mode"
                  checked={delState.permanent}
                  onChange={() => setDelState({ ...delState, permanent: true })}
                  className="mt-0.5"
                />
                <div className="flex-1">
                  <p className="text-xs font-semibold text-red-700">Delete permanently</p>
                  <p className="text-[11px] text-stone-500 mt-0.5">
                    Removes the account from the database. Only allowed if the user has no
                    linked tasks, notes, projects, or transactions. Cannot be undone.
                  </p>
                </div>
              </label>
            </div>
            <div className="flex gap-2 pt-1">
              <Button variant="secondary" size="sm" className="flex-1" onClick={() => setDelState(null)}>
                Cancel
              </Button>
              <Button
                size="sm"
                className={`flex-1 ${delState.permanent ? 'bg-red-600 hover:bg-red-700 text-white' : ''}`}
                loading={deleting}
                onClick={handleDelete}
              >
                {delState.permanent ? 'Delete permanently' : 'Deactivate'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

// ── WorkloadView ──────────────────────────────────────────
function WorkloadView({ data, loading, roleLabel }: {
  data: MemberLoad[]
  loading: boolean
  roleLabel: Record<string, string>
}) {
  const maxOpen = Math.max(...data.map(d => d.openCount), 1)

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <p className="text-xs text-stone-400">Loading workload…</p>
    </div>
  )

  if (data.length === 0) return (
    <div className="flex items-center justify-center py-20">
      <p className="text-xs text-stone-400">No team members found</p>
    </div>
  )

  const overloaded = data.filter(d => d.openCount >= 5).length

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-lg border border-stone-100 px-4 py-3">
          <p className="text-[10px] font-semibold text-stone-400 uppercase tracking-wide mb-1">Total open tasks</p>
          <p className="text-xl font-semibold text-stone-900">{data.reduce((s, d) => s + d.openCount, 0)}</p>
        </div>
        <div className="bg-white rounded-lg border border-stone-100 px-4 py-3">
          <p className="text-[10px] font-semibold text-stone-400 uppercase tracking-wide mb-1">Due this week</p>
          <p className="text-xl font-semibold text-stone-900">{data.reduce((s, d) => s + d.dueSoon, 0)}</p>
        </div>
        <div className={`rounded-lg border px-4 py-3 ${overloaded > 0 ? 'bg-red-50 border-red-100' : 'bg-white border-stone-100'}`}>
          <p className={`text-[10px] font-semibold uppercase tracking-wide mb-1 ${overloaded > 0 ? 'text-red-400' : 'text-stone-400'}`}>Overloaded (5+)</p>
          <p className={`text-xl font-semibold ${overloaded > 0 ? 'text-red-600' : 'text-stone-400'}`}>{overloaded}</p>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-stone-100 overflow-hidden">
        <div className="px-4 py-2.5 border-b border-stone-50 bg-stone-50/60 grid grid-cols-[1fr_80px_80px_80px_200px] gap-3 items-center">
          <p className="text-[10px] font-semibold text-stone-400 uppercase tracking-wide">Member</p>
          <p className="text-[10px] font-semibold text-stone-400 uppercase tracking-wide text-right">Open</p>
          <p className="text-[10px] font-semibold text-stone-400 uppercase tracking-wide text-right">This week</p>
          <p className="text-[10px] font-semibold text-stone-400 uppercase tracking-wide text-right">Overdue</p>
          <p className="text-[10px] font-semibold text-stone-400 uppercase tracking-wide">Load</p>
        </div>

        <div className="divide-y divide-stone-50">
          {data.map(member => {
            const isOverloaded = member.openCount >= 5
            const barPct = maxOpen > 0 ? Math.round((member.openCount / maxOpen) * 100) : 0
            const barColor = isOverloaded
              ? 'bg-red-400'
              : barPct > 60
              ? 'bg-amber-400'
              : 'bg-blue-400'

            return (
              <div
                key={member.id}
                className={`px-4 py-3 grid grid-cols-[1fr_80px_80px_80px_200px] gap-3 items-center ${isOverloaded ? 'bg-red-50/40' : ''}`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-[11px] font-bold ${isOverloaded ? 'bg-red-100 text-red-700' : 'bg-stone-100 text-stone-600'}`}>
                    {member.name[0].toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-medium text-stone-900 truncate">{member.name}</span>
                      {isOverloaded && <AlertTriangle size={11} className="text-red-500 flex-shrink-0" />}
                    </div>
                    <Badge className={`text-[9px] mt-0.5 ${ROLE_BADGE[member.role as Role] ?? 'bg-stone-100 text-stone-600'}`}>
                      {roleLabel[member.role] ?? member.role}
                    </Badge>
                  </div>
                </div>

                <p className={`text-xs font-semibold text-right ${isOverloaded ? 'text-red-600' : 'text-stone-900'}`}>
                  {member.openCount}
                </p>

                <p className={`text-xs font-semibold text-right ${member.dueSoon > 0 ? 'text-amber-600' : 'text-stone-400'}`}>
                  {member.dueSoon > 0 ? member.dueSoon : '—'}
                </p>

                <p className={`text-xs font-semibold text-right ${member.overdue > 0 ? 'text-red-500' : 'text-stone-400'}`}>
                  {member.overdue > 0 ? member.overdue : '—'}
                </p>

                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2 bg-stone-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                      style={{ width: `${barPct}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-stone-400 w-7 text-right flex-shrink-0">{barPct}%</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {overloaded > 0 && (
        <p className="text-[11px] text-red-500 flex items-center gap-1.5 px-1">
          <AlertTriangle size={11} />
          {overloaded} member{overloaded > 1 ? 's are' : ' is'} carrying 5+ open tasks — consider redistributing work.
        </p>
      )}
    </div>
  )
}
