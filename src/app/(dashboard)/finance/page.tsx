'use client'
// src/app/(dashboard)/finance/page.tsx
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
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
import { Plus, Pencil, Trash2, TrendingUp, TrendingDown, Wallet, ArrowUpRight, ArrowDownRight, RefreshCw, FileText, ExternalLink, CheckCircle2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { AnalyticsTab } from '@/components/finance/AnalyticsTab'

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

interface FinanceSummary {
  income: number; expense: number; net: number
}
const ZERO: FinanceSummary = { income: 0, expense: 0, net: 0 }

export default function FinancePage() {
  const router = useRouter()
  const user = useAuthStore((s) => s.user)
  const isFounder = user?.role === 'ADMIN'
  const [items, setItems] = useState<Transaction[]>([])
  const [summary, setSummary] = useState({ income: 0, expense: 0, net: 0 })
  const [liveSummary, setLiveSummary] = useState<{
    allTime: FinanceSummary; thisMonth: FinanceSummary; thisYear: FinanceSummary; txCount: number
  } | null>(null)
  const [lastSynced, setLastSynced] = useState<Date | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [activeTab, setActiveTab] = useState<'transactions' | 'invoices' | 'loans' | 'receivables' | 'analytics'>('transactions')
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [filterType, setFilterType] = useState<string>('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Transaction | null>(null)
  const [form, setForm] = useState<TxForm>(EMPTY)
  const [saving, setSaving] = useState(false)

  const [loanModalOpen, setLoanModalOpen] = useState(false)
  const [editingLoan, setEditingLoan] = useState<LoanRow | null>(null)
  const [pendingLoans, setPendingLoans] = useState(0)
  const [receivableModalOpen, setReceivableModalOpen] = useState(false)
  const [editingReceivable, setEditingReceivable] = useState<ReceivableRow | null>(null)



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

  const fetchLiveSummary = useCallback(async () => {
    setSyncing(true)
    try {
      const res = await fetch('/api/transactions/summary')
      const json = await res.json()
      if (res.ok) {
        setLiveSummary(json)
        setLastSynced(new Date())
      }
    } finally {
      setSyncing(false)
    }
  }, [])

  const fetchPendingLoans = useCallback(async () => {
    try {
      const res = await fetch('/api/loans')
      const json = await res.json()
      if (res.ok && json.summary) {
        setPendingLoans(json.summary.pendingTotal || 0)
      }
    } catch (err) {
      console.error('Error fetching pending loans:', err)
    }
  }, [])

  useEffect(() => { fetchTransactions() }, [fetchTransactions])
  useEffect(() => { if (isFounder) fetchLiveSummary() }, [isFounder, fetchLiveSummary])
  useEffect(() => { if (isFounder) fetchPendingLoans() }, [isFounder, fetchPendingLoans])

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
      fetchLiveSummary()
      router.refresh()
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
      fetchLiveSummary()
      router.refresh()
    } else {
      toast.error('Only admins can delete transactions')
    }
  }

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

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <TopBar
        title="Finance"
        actions={
          <div className="flex items-center gap-2">
            {activeTab === 'transactions' && (
              <>
                <Select
                  options={[{ value: '', label: 'All' }, ...TYPE_OPTIONS]}
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="h-8 text-xs w-24"
                />
                <Button size="sm" onClick={openCreate}>
                  <Plus size={13} /> New
                </Button>
              </>
            )}
            {activeTab === 'invoices' && (
              <Button size="sm" onClick={() => router.push('/invoices/new')}>
                <Plus size={13} /> New invoice
              </Button>
            )}
            {activeTab === 'loans' && (
              <Button size="sm" onClick={() => {
                setEditingLoan(null)
                setLoanModalOpen(true)
              }}>
                <Plus size={13} /> New loan
              </Button>
            )}
          </div>
        }
      />

      {/* Tab bar */}
      <div className="flex border-b border-stone-100 bg-white px-5 gap-4 flex-shrink-0">
        {(['transactions', 'invoices', 'loans', 'receivables', 'analytics'] as const).map(t => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            className={`py-2.5 text-xs font-semibold capitalize border-b-2 transition-colors ${
              activeTab === t
                ? 'border-stone-900 text-stone-900'
                : 'border-transparent text-stone-400 hover:text-stone-700'
            }`}
          >
            {t === 'analytics' ? '📊 Analytics' : t === 'receivables' ? '💰 To Get' : t}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {activeTab === 'transactions' && (<>
        {/* Live sync strip */}
        {liveSummary && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="rounded-xl border border-green-200 bg-gradient-to-br from-green-50 to-emerald-50 p-4 shadow-sm">
              <p className="text-[10px] font-semibold text-green-700 uppercase tracking-wider mb-1">This month — Income</p>
              <p className="text-xl font-bold text-green-800">{formatMoney(liveSummary.thisMonth.income)}</p>
            </div>
            <div className="rounded-xl border border-red-200 bg-gradient-to-br from-red-50 to-rose-50 p-4 shadow-sm">
              <p className="text-[10px] font-semibold text-red-700 uppercase tracking-wider mb-1">This month — Expense</p>
              <p className="text-xl font-bold text-red-700">{formatMoney(liveSummary.thisMonth.expense)}</p>
            </div>
            <div className={`rounded-xl border p-4 shadow-sm bg-gradient-to-br ${
              liveSummary.thisMonth.net >= 0 ? 'from-violet-50 to-indigo-50 border-violet-200' : 'from-red-50 to-rose-50 border-red-200'
            }`}>
              <p className={`text-[10px] font-semibold uppercase tracking-wider mb-1 ${
                liveSummary.thisMonth.net >= 0 ? 'text-violet-700' : 'text-red-700'
              }`}>This month — Net</p>
              <p className={`text-xl font-bold ${
                liveSummary.thisMonth.net >= 0 ? 'text-violet-800' : 'text-red-700'
              }`}>{formatMoney(liveSummary.thisMonth.net)}</p>
            </div>
            <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
              <p className="text-[10px] font-semibold text-stone-500 uppercase tracking-wider mb-1">All time — Net</p>
              <p className="text-xl font-bold text-stone-900">{formatMoney(liveSummary.allTime.net)}</p>
              <div className="flex items-center justify-between mt-2">
                <p className="text-[10px] text-stone-400">{liveSummary.txCount} transactions</p>
                <button
                  onClick={fetchLiveSummary}
                  disabled={syncing}
                  className="flex items-center gap-1 text-[10px] text-stone-400 hover:text-stone-700 transition-colors"
                >
                  <RefreshCw size={10} className={syncing ? 'animate-spin' : ''} />
                  {lastSynced ? `${lastSynced.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}` : 'Sync'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Summary cards (filter-aware) */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
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
          <SummaryCard
            label="Pending Loans (Owed)"
            value={pendingLoans}
            icon={<TrendingDown size={16} />}
            tone="amber"
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
                label={form.type === 'INCOME' ? '🔗 Link to Project (shows in Client Billing)' : 'Project (optional)'}
                placeholder="No project"
                options={projects.map((p) => ({ value: p.id, label: p.name }))}
                value={form.projectId}
                onChange={(e) => setForm({ ...form, projectId: e.target.value })}
              />
              {form.type === 'INCOME' && !form.projectId && (
                <p className="text-[11px] text-amber-600 mt-1">
                  ⚠️ Without a project, this income won&apos;t appear in Client Billing
                </p>
              )}
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
        </>)}
        {activeTab === 'invoices' && (
          <InvoicesTab />
        )}
        {activeTab === 'loans' && (
          <LoansTab
            modalOpen={loanModalOpen}
            setModalOpen={setLoanModalOpen}
            editing={editingLoan}
            setEditing={setEditingLoan}
            onRefresh={fetchPendingLoans}
          />
        )}
        {activeTab === 'receivables' && (
          <ReceivablesTab
            modalOpen={receivableModalOpen}
            setModalOpen={setReceivableModalOpen}
            editing={editingReceivable}
            setEditing={setEditingReceivable}
          />
        )}
        {activeTab === 'analytics' && (
          <AnalyticsTab />
        )}
    </div>
  </div>
  )
}

function SummaryCard({
  label, value, icon, tone,
}: {
  label: string
  value: number
  icon: React.ReactNode
  tone: 'green' | 'red' | 'blue' | 'amber'
}) {
  const toneClasses = {
    green: 'bg-green-50 text-green-700 border-green-100',
    red: 'bg-red-50 text-red-700 border-red-100',
    blue: 'bg-blue-50 text-blue-700 border-blue-100',
    amber: 'bg-amber-50 text-amber-700 border-amber-100',
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

// ─── Invoices Tab ─────────────────────────────────────────────────────────────
const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-stone-100 text-stone-600',
  SENT: 'bg-blue-100 text-blue-700',
  PAID: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-red-100 text-red-700',
}

interface InvoiceRow {
  id: string
  invoice_number: string
  status: string
  total: number
  due_date: string | null
  created_at: string
  client: { name: string } | null
  project: { name: string } | null
}

interface NewInvoiceForm {
  clientId: string
  projectId: string
  taxRate: string
  dueDate: string
  notes: string
  lineItems: { description: string; qty: string; rate: string }[]
}

interface NewQuotForm {
  clientId: string
  projectId: string
  clientLocation: string
  scopeOfWork: string
  importantDetails: string
  notes: string
  taxRate: string
  services: { name: string; detail: string; amount: string }[]
}

const EMPTY_QUOT: NewQuotForm = {
  clientId: '', projectId: '', clientLocation: '', scopeOfWork: '',
  importantDetails: 'Services include end-to-end content creation – scripting, shooting, editing & posting.',
  notes: '', taxRate: '0',
  services: [{ name: '', detail: '', amount: '' }],
}

function InvoicesTab() {
  const router = useRouter()
  const [invoices, setInvoices] = useState<InvoiceRow[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [showQuotModal, setShowQuotModal] = useState(false)
  const [clients, setClients] = useState<{ id: string; name: string }[]>([])
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([])
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<NewInvoiceForm>({
    clientId: '', projectId: '', taxRate: '18', dueDate: '', notes: '',
    lineItems: [{ description: '', qty: '1', rate: '' }],
  })
  const [quotForm, setQuotForm] = useState<NewQuotForm>(EMPTY_QUOT)

  const load = useCallback(async () => {
    setLoading(true)
    const r = await fetch('/api/invoices').then(r => r.json())
    setInvoices(r.data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
    Promise.all([
      fetch('/api/users?role=CLIENT').then(r => r.json()),
      fetch('/api/projects').then(r => r.json()),
    ]).then(([u, p]) => {
      setClients(u.data ?? [])
      setProjects(p.data ?? [])
    })
  }, [load])

  const addLine = () => setForm(f => ({ ...f, lineItems: [...f.lineItems, { description: '', qty: '1', rate: '' }] }))
  const removeLine = (i: number) => setForm(f => ({ ...f, lineItems: f.lineItems.filter((_, j) => j !== i) }))
  const setLine = (i: number, k: string, v: string) =>
    setForm(f => ({ ...f, lineItems: f.lineItems.map((l, j) => j === i ? { ...l, [k]: v } : l) }))

  const addService = () => setQuotForm(f => ({ ...f, services: [...f.services, { name: '', detail: '', amount: '' }] }))
  const removeService = (i: number) => setQuotForm(f => ({ ...f, services: f.services.filter((_, j) => j !== i) }))
  const setService = (i: number, k: string, v: string) =>
    setQuotForm(f => ({ ...f, services: f.services.map((s, j) => j === i ? { ...s, [k]: v } : s) }))

  const subtotal = form.lineItems.reduce((s, l) => s + (parseFloat(l.qty) || 0) * (parseFloat(l.rate) || 0), 0)
  const tax = subtotal * ((parseFloat(form.taxRate) || 0) / 100)

  const quotSubtotal = quotForm.services.reduce((s, sv) => s + (parseFloat(sv.amount) || 0), 0)
  const quotTax = quotSubtotal * ((parseFloat(quotForm.taxRate) || 0) / 100)

  const create = async () => {
    if (!form.lineItems.some(l => l.description.trim() && parseFloat(l.rate) > 0)) {
      toast.error('Add at least one line item with a description and rate'); return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'INVOICE',
          clientId: form.clientId || null,
          projectId: form.projectId || null,
          taxRate: parseFloat(form.taxRate) || 0,
          dueDate: form.dueDate || null,
          notes: form.notes || null,
          lineItems: form.lineItems
            .filter(l => l.description.trim() && parseFloat(l.rate) > 0)
            .map(l => ({ description: l.description.trim(), qty: parseFloat(l.qty) || 1, rate: parseFloat(l.rate) || 0 })),
        }),
      })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error)
      toast.success(`Invoice ${j.data.invoice_number} created`)
      setShowModal(false)
      load()
      router.push(`/invoices/${j.data.id}`)
    } catch (e: any) { toast.error(e.message) }
    finally { setSaving(false) }
  }

  const createQuotation = async () => {
    if (!quotForm.services.some(s => s.name.trim() && parseFloat(s.amount) > 0)) {
      toast.error('Add at least one service with a name and amount'); return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'QUOTATION',
          clientId: quotForm.clientId || null,
          projectId: quotForm.projectId || null,
          taxRate: parseFloat(quotForm.taxRate) || 0,
          notes: quotForm.notes || null,
          scopeOfWork: quotForm.scopeOfWork || null,
          clientLocation: quotForm.clientLocation || null,
          importantDetails: quotForm.importantDetails || null,
          lineItems: quotForm.services
            .filter(s => s.name.trim() && parseFloat(s.amount) > 0)
            .map(s => ({
              description: s.name.trim(),
              note: s.detail.trim() || undefined,
              qty: 1,
              rate: parseFloat(s.amount) || 0,
            })),
        }),
      })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error)
      toast.success(`Quotation ${j.data.invoice_number} created`)
      setShowQuotModal(false)
      setQuotForm(EMPTY_QUOT)
      load()
      router.push(`/invoices/${j.data.id}`)
    } catch (e: any) { toast.error(e.message) }
    finally { setSaving(false) }
  }

  const fmt = (n: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)

  return (
    <>
      <div className="bg-white rounded-lg border border-stone-100 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-stone-100 flex items-center justify-between">
          <p className="text-xs font-semibold text-stone-700 uppercase tracking-wider flex items-center gap-1.5">
            <FileText size={13} /> Invoices &amp; Quotations
          </p>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowQuotModal(true)}
              className="inline-flex items-center gap-1 text-xs font-medium border border-stone-300 text-stone-700 px-2.5 py-1.5 rounded-md hover:bg-stone-50 transition-colors">
              <Plus size={12} /> New quotation
            </button>
            <button onClick={() => setShowModal(true)}
              className="inline-flex items-center gap-1 text-xs font-medium bg-stone-900 text-white px-2.5 py-1.5 rounded-md hover:bg-stone-700 transition-colors">
              <Plus size={12} /> New invoice
            </button>
          </div>
        </div>
        {loading ? (
          <div className="text-center py-10 text-xs text-stone-400">Loading…</div>
        ) : invoices.length === 0 ? (
          <div className="text-center py-12 text-xs text-stone-400">No documents yet — create a quotation or invoice</div>
        ) : (
          <div className="divide-y divide-stone-50">
            {invoices.map((inv: any) => (
              <div key={inv.id} className="flex items-center gap-3 px-4 py-3 hover:bg-stone-50/50 group">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-semibold text-stone-900">{inv.invoice_number}</p>
                    {inv.type === 'QUOTATION' && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-purple-50 text-purple-600 uppercase tracking-wide">
                        Quote
                      </span>
                    )}
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${STATUS_COLORS[inv.status] ?? 'bg-stone-100 text-stone-500'}`}>
                      {inv.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-stone-400 mt-0.5">
                    {inv.client && <span>{inv.client.name}</span>}
                    {inv.project && (<><span>·</span><span>{inv.project.name}</span></>)}
                    {inv.due_date && (<><span>·</span><span>Due {formatDate(inv.due_date)}</span></>)}
                  </div>
                </div>
                <p className="text-xs font-bold text-stone-900">{fmt(inv.total)}</p>
                <button onClick={() => router.push(`/invoices/${inv.id}`)}
                  className="opacity-0 group-hover:opacity-100 text-stone-400 hover:text-stone-700 transition-all" title="View">
                  <ExternalLink size={13} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── New Invoice modal ──────────────────────────────── */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title="New Invoice">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-stone-600 mb-1 block">Client</label>
              <Select options={[{ value: '', label: 'Select client…' }, ...clients.map(c => ({ value: c.id, label: c.name }))]}
                value={form.clientId} onChange={e => setForm(f => ({ ...f, clientId: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-medium text-stone-600 mb-1 block">Project</label>
              <Select options={[{ value: '', label: 'Select project…' }, ...projects.map(p => ({ value: p.id, label: p.name }))]}
                value={form.projectId} onChange={e => setForm(f => ({ ...f, projectId: e.target.value }))} />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-stone-600">Line items</label>
              <button onClick={addLine} className="text-[11px] text-stone-500 hover:text-stone-900">+ Add row</button>
            </div>
            <div className="space-y-2">
              {form.lineItems.map((l, i) => (
                <div key={i} className="grid grid-cols-12 gap-1.5 items-center">
                  <div className="col-span-6">
                    <Input placeholder="Description" value={l.description}
                      onChange={e => setLine(i, 'description', e.target.value)} />
                  </div>
                  <div className="col-span-2">
                    <Input type="number" placeholder="Qty" value={l.qty}
                      onChange={e => setLine(i, 'qty', e.target.value)} />
                  </div>
                  <div className="col-span-3">
                    <Input type="number" placeholder="Rate (₹)" value={l.rate}
                      onChange={e => setLine(i, 'rate', e.target.value)} />
                  </div>
                  <div className="col-span-1 flex justify-center">
                    {form.lineItems.length > 1 && (
                      <button onClick={() => removeLine(i)} className="text-stone-300 hover:text-red-400 text-lg leading-none">×</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-stone-600 mb-1 block">GST (%)</label>
              <Input type="number" value={form.taxRate} onChange={e => setForm(f => ({ ...f, taxRate: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-medium text-stone-600 mb-1 block">Due date</label>
              <Input type="date" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-stone-600 mb-1 block">Notes</label>
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              rows={2} placeholder="Payment terms, bank details, etc."
              className="w-full text-xs border border-stone-200 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-stone-400 resize-none" />
          </div>

          <div className="bg-stone-50 rounded-md p-3 text-xs space-y-1">
            <div className="flex justify-between text-stone-500"><span>Subtotal</span><span>{fmt(subtotal)}</span></div>
            {parseFloat(form.taxRate) > 0 && (
              <div className="flex justify-between text-stone-500"><span>GST ({form.taxRate}%)</span><span>{fmt(tax)}</span></div>
            )}
            <div className="flex justify-between font-bold text-stone-900 pt-1 border-t border-stone-200">
              <span>Total</span><span>{fmt(subtotal + tax)}</span>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button onClick={create} disabled={saving}>{saving ? 'Creating…' : 'Create invoice'}</Button>
          </div>
        </div>
      </Modal>

      {/* ── New Quotation modal ────────────────────────────── */}
      <Modal open={showQuotModal} onClose={() => setShowQuotModal(false)} title="New Quotation">
        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-stone-600 mb-1 block">Client</label>
              <Select options={[{ value: '', label: 'Select client…' }, ...clients.map(c => ({ value: c.id, label: c.name }))]}
                value={quotForm.clientId} onChange={e => setQuotForm(f => ({ ...f, clientId: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-medium text-stone-600 mb-1 block">Client location</label>
              <Input placeholder="e.g. Tirunelveli" value={quotForm.clientLocation}
                onChange={e => setQuotForm(f => ({ ...f, clientLocation: e.target.value }))} />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-stone-600 mb-1 block">Project (optional)</label>
            <Select options={[{ value: '', label: 'None' }, ...projects.map(p => ({ value: p.id, label: p.name }))]}
              value={quotForm.projectId} onChange={e => setQuotForm(f => ({ ...f, projectId: e.target.value }))} />
          </div>

          <div>
            <label className="text-xs font-medium text-stone-600 mb-1 block">Scope of Work</label>
            <textarea value={quotForm.scopeOfWork} onChange={e => setQuotForm(f => ({ ...f, scopeOfWork: e.target.value }))}
              rows={4}
              placeholder={`SMM :\n12 Videos per month (scripted, captioned, with transitions, overlays, and music sync)\nPosters per month (creative design & promotional content)\nRegular Stories (brand awareness & engagement)\nMonthly Creative Strategy & Marketing Consultation`}
              className="w-full text-xs border border-stone-200 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-stone-400 resize-none" />
          </div>

          {/* Services */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-stone-600">Services</label>
              <button onClick={addService} className="text-[11px] text-stone-500 hover:text-stone-900">+ Add service</button>
            </div>
            <div className="space-y-2">
              {quotForm.services.map((s, i) => (
                <div key={i} className="grid grid-cols-12 gap-1.5 items-center">
                  <div className="col-span-4">
                    <Input placeholder="Service name" value={s.name}
                      onChange={e => setService(i, 'name', e.target.value)} />
                  </div>
                  <div className="col-span-5">
                    <Input placeholder="Description (optional)" value={s.detail}
                      onChange={e => setService(i, 'detail', e.target.value)} />
                  </div>
                  <div className="col-span-2">
                    <Input type="number" placeholder="₹" value={s.amount}
                      onChange={e => setService(i, 'amount', e.target.value)} />
                  </div>
                  <div className="col-span-1 flex justify-center">
                    {quotForm.services.length > 1 && (
                      <button onClick={() => removeService(i)} className="text-stone-300 hover:text-red-400 text-lg leading-none">×</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-stone-600 mb-1 block">Important Details <span className="text-stone-400 font-normal">(one per line → bullet points)</span></label>
            <textarea value={quotForm.importantDetails} onChange={e => setQuotForm(f => ({ ...f, importantDetails: e.target.value }))}
              rows={3} placeholder="Services include end-to-end content creation – scripting, shooting, editing & posting."
              className="w-full text-xs border border-stone-200 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-stone-400 resize-none" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-stone-600 mb-1 block">GST (%)</label>
              <Input type="number" value={quotForm.taxRate} onChange={e => setQuotForm(f => ({ ...f, taxRate: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-medium text-stone-600 mb-1 block">Notes (optional)</label>
              <Input placeholder="Any additional notes" value={quotForm.notes}
                onChange={e => setQuotForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>

          <div className="bg-stone-50 rounded-md p-3 text-xs space-y-1">
            <div className="flex justify-between font-bold text-stone-900">
              <span>Total</span><span>{fmt(quotSubtotal + quotTax)}</span>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" onClick={() => setShowQuotModal(false)}>Cancel</Button>
            <Button onClick={createQuotation} disabled={saving}>{saving ? 'Creating…' : 'Create quotation'}</Button>
          </div>
        </div>
      </Modal>
    </>
  )
}

// ─── Loans Tab ───────────────────────────────────────────────────────────────

interface LoanRow {
  id: string
  title: string
  amount: number
  status: 'PENDING' | 'PAID'
  due_date: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

interface LoanForm {
  title: string
  amount: string
  status: 'PENDING' | 'PAID'
  dueDate: string
  notes: string
}

const EMPTY_LOAN: LoanForm = {
  title: '',
  amount: '',
  status: 'PENDING',
  dueDate: '',
  notes: '',
}

function LoansTab({
  modalOpen,
  setModalOpen,
  editing,
  setEditing,
  onRefresh,
}: {
  modalOpen: boolean
  setModalOpen: (open: boolean) => void
  editing: LoanRow | null
  setEditing: (loan: LoanRow | null) => void
  onRefresh?: () => void
}) {
  const [loans, setLoans] = useState<LoanRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [summary, setSummary] = useState({ pendingTotal: 0, paidTotal: 0, total: 0 })
  const [form, setForm] = useState<LoanForm>(EMPTY_LOAN)

  const fetchLoans = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/loans')
      const json = await res.json()
      if (res.ok) {
        setLoans(json.data ?? [])
        if (json.summary) setSummary(json.summary)
        if (onRefresh) onRefresh()
      }
    } catch (err) {
      console.error('Error fetching loans:', err)
    } finally {
      setLoading(false)
    }
  }, [onRefresh])

  useEffect(() => {
    fetchLoans()
  }, [fetchLoans])

  useEffect(() => {
    if (editing) {
      setForm({
        title: editing.title,
        amount: String(editing.amount),
        status: editing.status,
        dueDate: editing.due_date ? editing.due_date.split('T')[0] : '',
        notes: editing.notes ?? '',
      })
    } else {
      setForm(EMPTY_LOAN)
    }
  }, [editing])

  const handleSave = async () => {
    if (!form.title.trim()) return toast.error('Title is required')
    const amount = parseFloat(form.amount)
    if (isNaN(amount) || amount <= 0) return toast.error('Amount must be > 0')

    setSaving(true)
    try {
      const payload = {
        title: form.title.trim(),
        amount,
        status: form.status,
        due_date: form.dueDate || null,
        notes: form.notes || null,
      }
      const res = editing
        ? await fetch(`/api/loans/${editing.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
        : await fetch('/api/loans', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
      if (!res.ok) throw new Error((await res.json()).error || 'Save failed')
      toast.success(editing ? 'Loan updated' : 'Loan created')
      setModalOpen(false)
      setEditing(null)
      fetchLoans()
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this loan entry?')) return
    try {
      const res = await fetch(`/api/loans/${id}`, { method: 'DELETE' })
      if (res.ok) {
        toast.success('Deleted')
        fetchLoans()
      } else {
        toast.error('Failed to delete loan')
      }
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  const toggleStatus = async (loan: LoanRow) => {
    const nextStatus = loan.status === 'PENDING' ? 'PAID' : 'PENDING'
    try {
      const res = await fetch(`/api/loans/${loan.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      })
      if (res.ok) {
        toast.success(`Loan marked as ${nextStatus}`)
        fetchLoans()
      } else {
        toast.error('Failed to update status')
      }
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  return (
    <div className="space-y-5">
      {/* Outstanding Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <SummaryCard
          label="Total Amount Owed (Pending)"
          value={summary.pendingTotal}
          icon={<TrendingDown size={16} />}
          tone="red"
        />
        <SummaryCard
          label="Amount Paid"
          value={summary.paidTotal}
          icon={<CheckCircle2 size={16} />}
          tone="green"
        />
        <SummaryCard
          label="Total Loan Value"
          value={summary.total}
          icon={<Wallet size={16} />}
          tone="blue"
        />
      </div>

      {/* Loans table */}
      <div className="bg-white rounded-lg border border-stone-100 shadow-card overflow-hidden">
        <div className="px-4 py-3 border-b border-stone-100 flex items-center justify-between">
          <p className="text-xs font-semibold text-stone-700 uppercase tracking-wider flex items-center gap-1.5">
            <TrendingDown size={13} className="text-red-500" /> Loans Borrowed (Amount Owed to Others)
          </p>
          <button
            onClick={() => {
              setEditing(null)
              setModalOpen(true)
            }}
            className="inline-flex items-center gap-1 text-xs font-medium bg-stone-900 text-white px-2.5 py-1.5 rounded-md hover:bg-stone-700 transition-colors"
          >
            <Plus size={12} /> New loan
          </button>
        </div>

        {loading ? (
          <p className="text-xs text-stone-400 text-center py-8">Loading...</p>
        ) : loans.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-sm font-medium text-stone-500 mb-1">No loans log yet</p>
            <p className="text-xs text-stone-400">Click New Loan to log what you borrowed from others</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-stone-50/75 border-b border-stone-100 text-stone-500 font-semibold">
                  <th className="p-3">Title</th>
                  <th className="p-3">Amount</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Due Date</th>
                  <th className="p-3">Notes</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {loans.map((loan) => (
                  <tr key={loan.id} className="hover:bg-stone-50/50">
                    <td className="p-3 font-semibold text-stone-900">{loan.title}</td>
                    <td className="p-3 font-bold text-stone-900">{formatMoney(loan.amount)}</td>
                    <td className="p-3">
                      <button
                        onClick={() => toggleStatus(loan)}
                        className={cn(
                          'px-2 py-0.5 rounded font-semibold text-[10px] uppercase tracking-wide transition-colors',
                          loan.status === 'PAID'
                            ? 'bg-green-50 text-green-700 border border-green-200'
                            : 'bg-red-50 text-red-700 border border-red-200'
                        )}
                        title="Click to toggle status"
                      >
                        {loan.status}
                      </button>
                    </td>
                    <td className="p-3 text-stone-500">{formatDate(loan.due_date)}</td>
                    <td className="p-3 text-stone-500 max-w-[200px] truncate" title={loan.notes ?? ''}>
                      {loan.notes ?? '—'}
                    </td>
                    <td className="p-3 text-right space-x-1">
                      <button
                        onClick={() => setEditing(loan)}
                        className="p-1 text-stone-300 hover:text-stone-700 inline-flex items-center"
                      >
                        <Pencil size={11} />
                      </button>
                      <button
                        onClick={() => handleDelete(loan.id)}
                        className="p-1 text-stone-300 hover:text-red-500 inline-flex items-center"
                      >
                        <Trash2 size={11} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Loan Form Modal */}
      <Modal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false)
          setEditing(null)
        }}
        title={editing ? 'Edit Loan Entry' : 'New Loan Entry'}
        size="md"
      >
        <div className="space-y-4">
          <Input
            label="Title / To Whom"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="e.g. Loan from Taha"
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Amount (₹)"
              type="number"
              min="0"
              step="0.01"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              placeholder="0.00"
            />
            <Select
              label="Status"
              options={[
                { value: 'PENDING', label: 'Pending (Owed)' },
                { value: 'PAID', label: 'Paid' },
              ]}
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value as 'PENDING' | 'PAID' })}
            />
          </div>
          <Input
            label="Due Date"
            type="date"
            value={form.dueDate}
            onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
          />
          <div>
            <label className="text-xs font-medium text-stone-600 uppercase tracking-wide block mb-1.5">
              Notes
            </label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Repayment terms, reference details, etc."
              rows={3}
              className="w-full rounded-md border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-400 resize-none"
            />
          </div>
          <div className="flex gap-2 pt-1">
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => {
                setModalOpen(false)
                setEditing(null)
              }}
            >
              Cancel
            </Button>
            <Button className="flex-1" loading={saving} onClick={handleSave}>
              {editing ? 'Save changes' : 'Create'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

// ─── Receivables ("To Get") Tab ───────────────────────────────────────────────

interface ReceivableRow {
  id: string
  client_name: string
  description: string
  amount: number
  status: 'PENDING' | 'RECEIVED'
  due_date: string | null
  notes: string | null
  client_id: string | null
  project_id: string | null
  created_at: string
  updated_at: string
}

interface ReceivableForm {
  client_name: string
  client_id: string
  project_id: string
  description: string
  amount: string
  status: 'PENDING' | 'RECEIVED'
  dueDate: string
  notes: string
}

const EMPTY_RECEIVABLE: ReceivableForm = {
  client_name: '',
  client_id: '',
  project_id: '',
  description: '',
  amount: '',
  status: 'PENDING',
  dueDate: '',
  notes: '',
}

interface ClientOption {
  clientId: string
  clientName: string
  projects: { id: string; name: string }[]
}

function ReceivablesTab({
  modalOpen,
  setModalOpen,
  editing,
  setEditing,
}: {
  modalOpen: boolean
  setModalOpen: (open: boolean) => void
  editing: ReceivableRow | null
  setEditing: (r: ReceivableRow | null) => void
}) {
  const [items, setItems] = useState<ReceivableRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [summary, setSummary] = useState({ pendingTotal: 0, receivedTotal: 0, total: 0 })
  const [form, setForm] = useState<ReceivableForm>(EMPTY_RECEIVABLE)
  const [clientOptions, setClientOptions] = useState<ClientOption[]>([])

  // Build a flat list of projects for the currently selected client
  const selectedClientProjects = clientOptions.find(c => c.clientId === form.client_id)?.projects ?? []

  const fetchItems = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/receivables')
      const json = await res.json()
      if (res.ok) {
        setItems(json.data ?? [])
        if (json.summary) setSummary(json.summary)
      }
    } catch (err) {
      console.error('Error fetching receivables:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  // Fetch active clients + their projects once
  const fetchClients = useCallback(async () => {
    try {
      const res = await fetch('/api/clients/active')
      const json = await res.json()
      if (res.ok && json.data) {
        // Group projects by client
        const map = new Map<string, ClientOption>()
        for (const row of json.data as any[]) {
          if (!map.has(row.clientId)) {
            map.set(row.clientId, { clientId: row.clientId, clientName: row.clientName, projects: [] })
          }
          map.get(row.clientId)!.projects.push({ id: row.projectId, name: row.projectName })
        }
        setClientOptions(Array.from(map.values()))
      }
    } catch (err) {
      console.error('Error fetching clients:', err)
    }
  }, [])

  useEffect(() => { fetchItems(); fetchClients() }, [fetchItems, fetchClients])

  useEffect(() => {
    if (editing) {
      setForm({
        client_name: editing.client_name,
        client_id: editing.client_id ?? '',
        project_id: editing.project_id ?? '',
        description: editing.description,
        amount: String(editing.amount),
        status: editing.status,
        dueDate: editing.due_date ? editing.due_date.split('T')[0] : '',
        notes: editing.notes ?? '',
      })
    } else {
      setForm(EMPTY_RECEIVABLE)
    }
  }, [editing])

  const handleClientChange = (clientId: string) => {
    const found = clientOptions.find(c => c.clientId === clientId)
    setForm(f => ({
      ...f,
      client_id: clientId,
      client_name: found?.clientName ?? '',
      project_id: '', // reset project when client changes
    }))
  }

  const handleSave = async () => {
    const nameToUse = form.client_name.trim()
    if (!nameToUse || !form.description.trim() || !form.amount) {
      toast.error('Client, description and amount are required')
      return
    }
    setSaving(true)
    try {
      const payload = {
        client_name: nameToUse,
        client_id: form.client_id || null,
        project_id: form.project_id || null,
        description: form.description.trim(),
        amount: parseFloat(form.amount),
        status: form.status,
        due_date: form.dueDate || null,
        notes: form.notes.trim() || null,
      }
      const url = editing ? `/api/receivables/${editing.id}` : '/api/receivables'
      const method = editing ? 'PATCH' : 'POST'
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      if (!res.ok) { const j = await res.json(); throw new Error(j.error) }
      toast.success(editing ? 'Updated' : 'Added to receivables')
      setModalOpen(false)
      setEditing(null)
      fetchItems()
    } catch (err: any) {
      toast.error(err.message || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this receivable?')) return
    try {
      const res = await fetch(`/api/receivables/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed')
      toast.success('Deleted')
      fetchItems()
    } catch {
      toast.error('Failed to delete')
    }
  }

  const handleMarkReceived = async (item: ReceivableRow) => {
    try {
      const res = await fetch(`/api/receivables/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'RECEIVED' }),
      })
      if (!res.ok) throw new Error('Failed')
      toast.success(`Marked as received — ${formatMoney(item.amount)}`)
      fetchItems()
    } catch {
      toast.error('Failed to update')
    }
  }

  const pending = items.filter(i => i.status === 'PENDING')
  const received = items.filter(i => i.status === 'RECEIVED')

  return (
    <div className="space-y-5">
      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-xl border border-amber-200 bg-gradient-to-br from-amber-50 to-yellow-50 p-4 shadow-sm">
          <p className="text-[10px] font-semibold text-amber-700 uppercase tracking-wider mb-1">Pending — To Collect</p>
          <p className="text-2xl font-bold text-amber-800">{formatMoney(summary.pendingTotal)}</p>
          <p className="text-[10px] text-amber-600 mt-1">{pending.length} outstanding</p>
        </div>
        <div className="rounded-xl border border-green-200 bg-gradient-to-br from-green-50 to-emerald-50 p-4 shadow-sm">
          <p className="text-[10px] font-semibold text-green-700 uppercase tracking-wider mb-1">Received</p>
          <p className="text-2xl font-bold text-green-800">{formatMoney(summary.receivedTotal)}</p>
          <p className="text-[10px] text-green-600 mt-1">{received.length} collected</p>
        </div>
        <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[10px] font-semibold text-stone-500 uppercase tracking-wider mb-1">Total Tracked</p>
            <p className="text-2xl font-bold text-stone-900">{formatMoney(summary.total)}</p>
          </div>
          <button
            onClick={() => { setEditing(null); setModalOpen(true) }}
            className="flex items-center gap-1.5 rounded-lg bg-stone-900 px-3 py-2 text-xs font-semibold text-white hover:bg-stone-700 transition-colors"
          >
            <Plus size={13} /> Add
          </button>
        </div>
      </div>

      {/* Pending list */}
      {loading ? (
        <div className="text-center py-10 text-stone-400 text-sm">Loading…</div>
      ) : pending.length === 0 && received.length === 0 ? (
        <div className="text-center py-16 text-stone-400">
          <p className="text-4xl mb-3">💰</p>
          <p className="font-semibold text-stone-600">No receivables yet</p>
          <p className="text-sm mt-1">Track money clients owe you</p>
          <button
            onClick={() => { setEditing(null); setModalOpen(true) }}
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-stone-900 px-4 py-2 text-xs font-semibold text-white hover:bg-stone-700"
          >
            <Plus size={13} /> Add first entry
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {pending.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-2">Outstanding</h3>
              <div className="space-y-2">
                {pending.map(item => (
                  <div key={item.id} className="flex items-center justify-between rounded-xl border border-amber-100 bg-white p-3.5 shadow-sm gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-stone-900 truncate">{item.client_name}</span>
                        <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-medium">Pending</span>
                      </div>
                      <p className="text-xs text-stone-500 truncate mt-0.5">{item.description}</p>
                      {item.due_date && (
                        <p className="text-[10px] text-stone-400 mt-0.5">Due {formatDate(item.due_date)}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-base font-bold text-amber-700">{formatMoney(item.amount)}</span>
                      <button
                        onClick={() => handleMarkReceived(item)}
                        title="Mark as received"
                        className="p-1.5 rounded-lg bg-green-50 text-green-600 hover:bg-green-100 transition-colors"
                      >
                        <CheckCircle2 size={15} />
                      </button>
                      <button onClick={() => { setEditing(item); setModalOpen(true) }} className="p-1.5 rounded-lg hover:bg-stone-100 text-stone-400">
                        <Pencil size={13} />
                      </button>
                      <button onClick={() => handleDelete(item.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-stone-400 hover:text-red-500">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {received.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-2">Received</h3>
              <div className="space-y-2">
                {received.map(item => (
                  <div key={item.id} className="flex items-center justify-between rounded-xl border border-stone-100 bg-stone-50 p-3.5 gap-3 opacity-70">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-stone-700 truncate">{item.client_name}</span>
                        <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-medium">Received</span>
                      </div>
                      <p className="text-xs text-stone-400 truncate mt-0.5">{item.description}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-base font-bold text-green-700">{formatMoney(item.amount)}</span>
                      <button onClick={() => handleDelete(item.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-stone-300 hover:text-red-400">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal */}
      <Modal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditing(null) }}
        title={editing ? 'Edit receivable' : 'Add — To Get'}
      >
        <div className="space-y-3 p-1">
          {/* Client selector */}
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">Client *</label>
            {clientOptions.length > 0 ? (
              <select
                value={form.client_id}
                onChange={e => handleClientChange(e.target.value)}
                className="w-full rounded-md border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-400"
              >
                <option value="">— Select client —</option>
                {clientOptions.map(c => (
                  <option key={c.clientId} value={c.clientId}>{c.clientName}</option>
                ))}
                <option value="__manual__">Other (type manually)</option>
              </select>
            ) : (
              <Input
                placeholder="e.g. Aruvi Bakery"
                value={form.client_name}
                onChange={e => setForm(f => ({ ...f, client_name: e.target.value }))}
              />
            )}
            {/* Manual name input if "Other" selected or no clients loaded */}
            {form.client_id === '__manual__' && (
              <Input
                className="mt-2"
                placeholder="Enter client name"
                value={form.client_name}
                onChange={e => setForm(f => ({ ...f, client_name: e.target.value }))}
              />
            )}
          </div>

          {/* Project selector — only shown when a real client is selected */}
          {form.client_id && form.client_id !== '__manual__' && selectedClientProjects.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1">Project</label>
              <select
                value={form.project_id}
                onChange={e => setForm(f => ({ ...f, project_id: e.target.value }))}
                className="w-full rounded-md border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-400"
              >
                <option value="">— No specific project —</option>
                {selectedClientProjects.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">What is it for? *</label>
            <Input
              placeholder="e.g. March social media package"
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1">Amount *</label>
              <Input
                type="number"
                placeholder="0"
                value={form.amount}
                onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1">Status</label>
              <Select
                value={form.status}
                onChange={e => setForm(f => ({ ...f, status: e.target.value as 'PENDING' | 'RECEIVED' }))}
                options={[{ value: 'PENDING', label: 'Pending' }, { value: 'RECEIVED', label: 'Received' }]}
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">Due date</label>
            <Input
              type="date"
              value={form.dueDate}
              onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">Notes</label>
            <Input
              placeholder="Optional notes"
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            />
          </div>
          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => { setModalOpen(false); setEditing(null) }}>
              Cancel
            </Button>
            <Button className="flex-1" loading={saving} onClick={handleSave}>
              {editing ? 'Save changes' : 'Add'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
