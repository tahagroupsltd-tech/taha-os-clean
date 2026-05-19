'use client'
// src/app/(dashboard)/team/team-client.tsx
import { useState, useMemo } from 'react'
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
import { Plus, UserCheck, Pencil, Trash2, UserX, UserPlus } from 'lucide-react'
import toast from 'react-hot-toast'

const ALL_ROLE_OPTIONS: { value: Role; label: string }[] = [
  { value: 'ADMIN', label: ROLE_LABEL.ADMIN },
  { value: 'MANAGER', label: ROLE_LABEL.MANAGER },
  { value: 'EMPLOYEE', label: ROLE_LABEL.EMPLOYEE },
  { value: 'CLIENT', label: ROLE_LABEL.CLIENT },
]

const ROLE_BADGE: Record<Role, string> = {
  ADMIN: 'bg-stone-900 text-white',
  MANAGER: 'bg-purple-50 text-purple-700',
  EMPLOYEE: 'bg-blue-50 text-blue-700',
  CLIENT: 'bg-amber-50 text-amber-700',
}

interface CreateForm {
  username: string
  name: string
  phone: string
  password: string
  role: Role
}

const EMPTY: CreateForm = {
  username: '',
  name: '',
  phone: '',
  password: '',
  role: 'EMPLOYEE',
}

interface EditForm {
  id: string
  name: string
  username: string
  phone: string
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
  // Role options shown in dropdowns are filtered to what the current user
  // is allowed to assign (managers can't grant ADMIN).
  const assignableRoles = useMemo(
    () => ALL_ROLE_OPTIONS.filter((o) => canAssignRole(currentUserRole, o.value)),
    [currentUserRole]
  )
  const [users, setUsers] = useState<User[]>(initialUsers)
  const [refreshing, setRefreshing] = useState(false)

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
          <Button size="sm" onClick={() => setModalOpen(true)}>
            <Plus size={13} /> Add user
          </Button>
        }
      />

      <div className="flex-1 overflow-y-auto p-5">
        <div className="bg-white rounded-lg border border-stone-100 overflow-hidden">
          <div className="px-4 py-3 border-b border-stone-100 bg-stone-50 flex items-center justify-between">
            <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide">
              {users.length} users
            </p>
            {refreshing && <p className="text-[10px] text-stone-400">refreshing…</p>}
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-stone-50">
                <th className="text-left px-4 py-2.5 font-medium text-stone-400 uppercase tracking-wide">Name</th>
                <th className="text-left px-4 py-2.5 font-medium text-stone-400 uppercase tracking-wide">Username</th>
                <th className="text-left px-4 py-2.5 font-medium text-stone-400 uppercase tracking-wide">Role</th>
                <th className="text-left px-4 py-2.5 font-medium text-stone-400 uppercase tracking-wide">Status</th>
                <th className="text-left px-4 py-2.5 font-medium text-stone-400 uppercase tracking-wide">Joined</th>
                <th className="text-right px-4 py-2.5 font-medium text-stone-400 uppercase tracking-wide">Actions</th>
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
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-stone-100 flex items-center justify-center flex-shrink-0">
                          <span className="text-[11px] font-bold text-stone-600">
                            {user.name[0].toUpperCase()}
                          </span>
                        </div>
                        <span className="font-medium text-stone-900">
                          {user.name}
                          {isMe && <span className="ml-2 text-[10px] text-stone-400">(you)</span>}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-stone-500 font-mono">{user.username}</td>
                    <td className="px-4 py-3">
                      <Badge className={ROLE_BADGE[user.role as Role]}>
                        {ROLE_LABEL[user.role as Role]}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <div className={`w-1.5 h-1.5 rounded-full ${user.isActive ? 'bg-green-500' : 'bg-stone-300'}`} />
                        <span className="text-stone-500">{user.isActive ? 'Active' : 'Inactive'}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-stone-400">
                      {new Date(user.createdAt).toLocaleDateString('en-IN', {
                        day: '2-digit', month: 'short', year: 'numeric',
                      })}
                    </td>
                    <td className="px-4 py-3">
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
            <Select
              label="Role"
              options={assignableRoles}
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value as Role })}
            />
          </div>
          <Input
            label="Password"
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            placeholder="Set a password for this user"
          />
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
