'use client'
// src/app/(dashboard)/finance/page.tsx
import { useState, useEffect, useCallback } from 'react'
import { TopBar } from '@/components/layout/TopBar'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Modal } from '@/components/ui/Modal'
import { useAuthStore } from '@/store/auth.store'
import {
  TRANSACTION_CATEGORY_LABELS, TRANSACTION_TYPE_LABELS,
  formatMoney, formatDate, cn,
} from '@/lib/utils'
import type { Transaction, TransactionType, TransactionCategory } from '@/types'
import { Plus, Pencil, Trash2, TrendingUp, TrendingDown, Wallet, ArrowUpRight, ArrowDownRight } from 'lucide-react'
import toast from 'react-hot-toast'

const TYPE_OPTIONS = Object.entries(TRANSACTION_TYPE_LABELS).map(([v, l]) => ({ value: v, label: l }))
const CATEGORY_OPTIONS = Object.entries(TRANSACTION_CATEGORY_LABELS).map(([v, l]) => ({ value: v, label: l }))

interface TxForm {
  title: string
  amount: string
  type: TransactionType
  category: TransactionCategory
  notes: string
  date: string
  projectId: string
}

const todayISO = () => new Date().toISOString().split('T')[0]

const EMPTY: TxForm = {
  title: '',
  amount: '',
  type: 'EXPENSE',
  category: 'OTHER',
  notes: '',
  date: todayISO(),
  projectId: '',
}

export default function FinancePage() {
  const user = useAuthStore((s) => s.user)
  const isFounder = user?.role === 'ADMIN'
  const [items, setItems] = useState<Transaction[]>([])
  const [summary, setSummary] = useState({ income: 0, expense: 0, net: 0 })
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [filterType, setFilterType] = useState<string>('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Transaction | null>(null)
  const [form, setForm] = useState<TxForm>(EMPTY)
  const [saving, setSaving] = useState(false)

  // Block non-founder access at the page level too (not just at the API)
  if (user && !isFounder) {
    return (
      <div className="flex flex-col h-full overflow-hidden">
        <TopBar title="Finance" />
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
          <Wallet size={32} className="text-stone-300 mb-3" />
          <p className="text-sm font-semibold text-stone-700 mb-1">Restricted</p>
          <p className="text-xs text-stone-500 max-w-sm">
            Finance is visible only to the founder. Reach out to admin for revenue, expense,
            or invoicing data.
          </p>
        </div>
      </div>
    )
  }

  const fetchTransactions = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (filterType) params.set('type', filterType)
    const res = await fetch(`/api/transactions?${params}`)
    const json = await res.json()
    setItems(json.data ?? [])
    if (json.summary) setSummary(json.summary)
    setLoading(false)
  }, [filterType])

  useEffect(() => { fetchTransactions() }, [fetchTransactions])

  useEffect(() => {
    if (user?.role !== 'CLIENT') {
      fetch('/api/projects').then(r => r.json()).then(j => setProjects(j.data ?? []))
    }
  }, [user])

  const openCreate = () => {
    setEditing(null)
    setForm(EMPTY)
    setModalOpen(true)
  }

  const openEdit = (t: Transaction) => {
    setEditing(t)
    setForm({
      title: t.title,
      amount: String(t.amount),
      type: t.type,
      category: t.category,
      notes: t.notes ?? '',
      date: t.date.split('T')[0],
      projectId: t.projectId ?? '',
    })
    setModalOpen(true)
  }

  const handleSave = async () => {
    if (!form.title.trim()) return toast.error('Title is required')
    const amount = parseFloat(form.amount)
    if (isNaN(amount) || amount <= 0) return toast.error('Amount must be > 0')

    setSaving(true)
    try {
      const payload = {
        title: form.title.trim(),
        amount,
        type: form.type,
        category: form.category,
        notes: form.notes || null,
        date: form.date,
        projectId: form.projectId || null,
      }
      const res = editing
        ? await fetch(`/api/transactions/${editing.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
        : await fetch('/api/transactions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
      if (!res.ok) throw new Error((await res.json()).error || 'Save failed')
      toast.success(editing ? 'Updated' : 'Saved')
      setModalOpen(false)
      fetchTransactions()
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this transaction?')) return
    const res = await fetch(`/api/transactions/${id}`, { method: 'DELETE' })
    if (res.ok) {
      toast.success('Deleted')
      fetchTransactions()
    } else {
      toast.error('Only admins can delete transactions')
    }
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <TopBar
        title="Finance"
        actions={
          <div className="flex items-center gap-2">
            <Select
              options={[{ value: '', label: 'All' }, ...TYPE_OPTIONS]}
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="h-8 text-xs w-24"
            />
            <Button size="sm" onClick={openCreate}>
              <Plus size={13} /> New
            </Button>
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {/* Summary cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <SummaryCard
            label="Total Income"
            value={summary.income}
            icon={<TrendingUp size={16} />}
            tone="green"
          />
          <SummaryCard
            label="Total Expense"
            value={summary.expense}
            icon={<TrendingDown size={16} />}
            tone="red"
          />
          <SummaryCard
            label="Net Balance"
            value={summary.net}
            icon={<Wallet size={16} />}
            tone={summary.net >= 0 ? 'blue' : 'red'}
          />
        </div>

        {/* Transactions list */}
        <div className="bg-white rounded-lg border border-stone-100 shadow-card overflow-hidden">
          <div className="px-4 py-3 border-b border-stone-100 flex items-center justify-between">
            <p className="text-xs font-semibold text-stone-700 uppercase tracking-wider">Recent Transactions</p>
            <p className="text-[10px] text-stone-400">{items.length} {items.length === 1 ? 'entry' : 'entries'}</p>
          </div>
          {loading ? (
            <p className="text-xs text-stone-400 text-center py-8">Loading...</p>
          ) : items.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-sm font-medium text-stone-500 mb-1">No transactions yet</p>
              <p className="text-xs text-stone-400">Click New to log your first income or expense</p>
            </div>
          ) : (
            <div className="divide-y divide-stone-100">
              {items.map((t) => (
                <div key={t.id} className="flex items-center gap-3 px-4 py-3 hover:bg-stone-50/50">
                  <div className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0',
                    t.type === 'INCOME' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'
                  )}>
                    {t.type === 'INCOME' ? <ArrowDownRight size={14} /> : <ArrowUpRight size={14} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-stone-900 truncate">{t.title}</p>
                    <div className="flex items-center gap-2 text-[10px] text-stone-400 mt-0.5">
                      <span>{TRANSACTION_CATEGORY_LABELS[t.category]}</span>
                      <span>•</span>
                      <span>{formatDate(t.date)}</span>
                      {t.project && (
                        <>
                          <span>•</span>
                          <span className="truncate">{t.project.name}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <p className={cn(
                    'text-sm font-bold flex-shrink-0',
                    t.type === 'INCOME' ? 'text-green-600' : 'text-stone-900'
                  )}>
                    {t.type === 'INCOME' ? '+' : '−'} {formatMoney(t.amount)}
                  </p>
                  <div className="flex gap-0.5 flex-shrink-0">
                    <button onClick={() => openEdit(t)} className="p-1 text-stone-300 hover:text-stone-700">
                      <Pencil size={11} />
                    </button>
                    {user?.role === 'ADMIN' && (
                      <button onClick={() => handleDelete(t.id)} className="p-1 text-stone-300 hover:text-red-500">
                        <Trash2 size={11} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Transaction' : 'New Transaction'}
        size="md"
      >
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <Input
              label="Title"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="e.g. AXS — April invoice"
            />
          </div>
          <Select
            label="Type"
            options={TYPE_OPTIONS}
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value as TransactionType })}
          />
          <Select
            label="Category"
            options={CATEGORY_OPTIONS}
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value as TransactionCategory })}
          />
          <Input
            label="Amount (₹)"
            type="number"
            min="0"
            step="0.01"
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
            placeholder="0.00"
          />
          <Input
            label="Date"
            type="date"
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
          />
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
          <div className="col-span-2">
            <label className="text-xs font-medium text-stone-600 uppercase tracking-wide block mb-1.5">
              Notes
            </label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Reference, invoice number, etc."
              rows={2}
              className="w-full rounded-md border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-400 resize-none"
            />
          </div>
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

function SummaryCard({
  label, value, icon, tone,
}: {
  label: string
  value: number
  icon: React.ReactNode
  tone: 'green' | 'red' | 'blue'
}) {
  const toneClasses = {
    green: 'bg-green-50 text-green-700 border-green-100',
    red: 'bg-red-50 text-red-700 border-red-100',
    blue: 'bg-blue-50 text-blue-700 border-blue-100',
  }
  return (
    <div className="bg-white rounded-lg border border-stone-100 p-4 shadow-card">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] font-semibold text-stone-500 uppercase tracking-wider">{label}</p>
        <div className={cn('w-7 h-7 rounded-md border flex items-center justify-center', toneClasses[tone])}>
          {icon}
        </div>
      </div>
      <p className="text-xl font-bold text-stone-900">{formatMoney(value)}</p>
    </div>
  )
}
