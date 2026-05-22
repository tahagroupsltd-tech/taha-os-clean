'use client'
// src/app/(dashboard)/crm/deals/page.tsx
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { TopBar } from '@/components/layout/TopBar'
import {
  Plus, IndianRupee, TrendingUp, Target, X, Loader2,
  FileText, ChevronDown, ChevronUp, Phone, Mail, Users,
  MessageSquare, CalendarCheck, Clock, CheckCircle2, Zap,
} from 'lucide-react'
import { formatMoney } from '@/lib/utils'
import toast from 'react-hot-toast'

// ─── Constants ────────────────────────────────────────────────────────────────

const DEAL_STAGES = [
  { id: 'PROPOSAL',    label: 'Proposal',    color: 'bg-amber-100 text-amber-700' },
  { id: 'NEGOTIATION', label: 'Negotiation', color: 'bg-orange-100 text-orange-700' },
  { id: 'CONTRACT',    label: 'Contract',    color: 'bg-purple-100 text-purple-700' },
  { id: 'WON',         label: 'Won',         color: 'bg-green-100 text-green-700' },
  { id: 'LOST',        label: 'Lost',        color: 'bg-red-100 text-red-700' },
]

const ACTIVITY_TYPES = [
  { id: 'CALL',    label: 'Call',    icon: Phone },
  { id: 'EMAIL',   label: 'Email',   icon: Mail },
  { id: 'MEETING', label: 'Meeting', icon: Users },
  { id: 'NOTE',    label: 'Note',    icon: MessageSquare },
  { id: 'TASK',    label: 'Task',    icon: CalendarCheck },
]

const ACTIVITY_COLORS: Record<string, string> = {
  CALL:    'bg-blue-50 text-blue-600 border-blue-100',
  EMAIL:   'bg-violet-50 text-violet-600 border-violet-100',
  MEETING: 'bg-amber-50 text-amber-600 border-amber-100',
  NOTE:    'bg-stone-50 text-stone-600 border-stone-100',
  TASK:    'bg-green-50 text-green-600 border-green-100',
}

// ─── Interfaces ───────────────────────────────────────────────────────────────

interface Deal {
  id: string
  title: string
  value: number | null
  stage: string
  probability: number
  closeDate: string | null
  notes: string | null
  contact: { id: string; name: string } | null
  company: { id: string; name: string } | null
  assignedTo: { id: string; name: string } | null
  project: { id: string; name: string } | null
}

interface Activity {
  id: string
  type: string
  subject: string
  description: string | null
  completed: boolean
  created_at: string
  createdBy: { id: string; name: string } | null
}

// ─── Activity Timeline ────────────────────────────────────────────────────────

function ActivityTimeline({ dealId }: { dealId: string }) {
  const [activities, setActivities] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ type: 'NOTE', subject: '', description: '' })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/crm/activities?dealId=${dealId}`)
      const json = await res.json()
      setActivities(json.data ?? [])
    } catch (e) {
      console.error('[ActivityTimeline] fetch error:', e)
    } finally {
      setLoading(false)
    }
  }, [dealId])

  useEffect(() => { load() }, [load])

  const submit = async () => {
    if (!form.subject.trim()) return toast.error('Subject is required')
    setSaving(true)
    try {
      const res = await fetch('/api/crm/activities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, dealId }),
      })
      if (!res.ok) throw new Error((await res.json()).error || 'Failed')
      toast.success('Activity logged')
      setForm({ type: 'NOTE', subject: '', description: '' })
      setShowForm(false)
      load()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  const ActiveIcon = ACTIVITY_TYPES.find((t) => t.id === form.type)?.icon ?? MessageSquare

  return (
    <div className="border-t border-stone-50 mt-1 pt-4 px-4 pb-4 bg-stone-50/40">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <p className="text-[10px] font-semibold text-stone-500 uppercase tracking-wider flex items-center gap-1.5">
          <Clock size={10} /> Activity Timeline
        </p>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-1 text-[10px] font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"
        >
          <Plus size={10} /> Log activity
        </button>
      </div>

      {/* Log form */}
      {showForm && (
        <div className="bg-white rounded-xl border border-stone-100 p-3 mb-3 shadow-sm space-y-2">
          {/* Type pills */}
          <div className="flex gap-1.5 flex-wrap">
            {ACTIVITY_TYPES.map((t) => {
              const Icon = t.icon
              return (
                <button
                  key={t.id}
                  onClick={() => setForm((f) => ({ ...f, type: t.id }))}
                  className={`flex items-center gap-1 text-[10px] font-semibold px-2.5 py-1 rounded-full border transition-all ${
                    form.type === t.id
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white text-stone-500 border-stone-200 hover:border-stone-400'
                  }`}
                >
                  <Icon size={9} /> {t.label}
                </button>
              )
            })}
          </div>
          <input
            autoFocus
            value={form.subject}
            onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
            placeholder="Subject / summary…"
            className="w-full text-xs border border-stone-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />
          <textarea
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            placeholder="Details (optional)"
            rows={2}
            className="w-full text-xs border border-stone-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
          />
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowForm(false)} className="text-[11px] px-3 py-1.5 text-stone-500 hover:text-stone-700 font-medium">
              Cancel
            </button>
            <button
              onClick={submit}
              disabled={saving || !form.subject.trim()}
              className="flex items-center gap-1.5 text-[11px] font-semibold px-3.5 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-40 transition-colors"
            >
              {saving ? <Loader2 size={10} className="animate-spin" /> : <CheckCircle2 size={10} />}
              Log
            </button>
          </div>
        </div>
      )}

      {/* Timeline */}
      {loading ? (
        <div className="flex items-center gap-2 py-3 text-stone-400">
          <Loader2 size={12} className="animate-spin" /> <span className="text-[10px]">Loading activities…</span>
        </div>
      ) : activities.length === 0 ? (
        <p className="text-[11px] text-stone-400 py-2 text-center">No activities yet — log a call, email, or note above.</p>
      ) : (
        <div className="relative pl-4">
          {/* vertical line */}
          <div className="absolute left-1.5 top-2 bottom-2 w-px bg-stone-200" />
          <div className="space-y-3">
            {activities.map((a) => {
              const typeInfo = ACTIVITY_TYPES.find((t) => t.id === a.type)
              const Icon = typeInfo?.icon ?? MessageSquare
              const colorCls = ACTIVITY_COLORS[a.type] ?? 'bg-stone-50 text-stone-500 border-stone-100'
              return (
                <div key={a.id} className="relative flex gap-2.5 items-start">
                  {/* dot */}
                  <div className={`absolute -left-[13px] w-5 h-5 rounded-full border flex items-center justify-center flex-shrink-0 ${colorCls}`}>
                    <Icon size={9} />
                  </div>
                  <div className="flex-1 min-w-0 pl-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-[11px] font-semibold text-stone-800">{a.subject}</p>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${colorCls}`}>
                        {typeInfo?.label ?? a.type}
                      </span>
                    </div>
                    {a.description && <p className="text-[10px] text-stone-500 mt-0.5 leading-relaxed">{a.description}</p>}
                    <p className="text-[9px] text-stone-400 mt-0.5">
                      {a.createdBy?.name ?? 'System'} · {new Date(a.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Convert to Quotation Modal ───────────────────────────────────────────────

function ConvertToQuotModal({
  deal,
  onClose,
}: {
  deal: Deal
  onClose: () => void
}) {
  const router = useRouter()
  const [clients, setClients] = useState<{ id: string; name: string }[]>([])
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([])
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    clientId: deal.contact?.id ?? '',
    projectId: deal.project?.id ?? '',
    scopeOfWork: deal.notes ?? '',
    clientLocation: deal.company?.name ?? '',
    importantDetails: 'Services include end-to-end content creation – scripting, shooting, editing & posting.',
    notes: '',
    taxRate: '0',
    services: [{ name: deal.title, detail: '', amount: String(deal.value ?? '') }],
  })

  useEffect(() => {
    Promise.all([
      fetch('/api/users').then((r) => r.json()),
      fetch('/api/projects').then((r) => r.json()),
    ]).then(([u, p]) => {
      setClients((u.data ?? []).filter((x: any) => x.role === 'CLIENT'))
      setProjects(p.data ?? [])
    }).catch((e) => console.error('[ConvertModal] fetch error:', e))
  }, [])

  const subtotal = form.services.reduce((s, sv) => s + (parseFloat(sv.amount) || 0), 0)
  const tax = subtotal * ((parseFloat(form.taxRate) || 0) / 100)

  const create = async () => {
    if (!form.services.some((s) => s.name.trim() && parseFloat(s.amount) > 0)) {
      toast.error('Add at least one service with a name and amount')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'QUOTATION',
          clientId: form.clientId || null,
          projectId: form.projectId || null,
          taxRate: parseFloat(form.taxRate) || 0,
          notes: form.notes || null,
          scopeOfWork: form.scopeOfWork || null,
          clientLocation: form.clientLocation || null,
          importantDetails: form.importantDetails || null,
          lineItems: form.services
            .filter((s) => s.name.trim() && parseFloat(s.amount) > 0)
            .map((s) => ({
              description: s.name.trim(),
              note: s.detail.trim() || undefined,
              qty: 1,
              rate: parseFloat(s.amount) || 0,
            })),
        }),
      })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error)
      toast.success(`Quotation ${j.data.invoice_number} created!`)
      onClose()
      router.push(`/invoices/${j.data.id}`)
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  const fmt = (n: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center">
              <Zap size={15} className="text-indigo-600" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-stone-900">Convert to Quotation</h3>
              <p className="text-[10px] text-stone-400">Pre-filled from deal: {deal.title}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-700">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Client & Project */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-semibold text-stone-600 uppercase tracking-wide mb-1 block">Client</label>
              <select
                value={form.clientId}
                onChange={(e) => setForm((f) => ({ ...f, clientId: e.target.value }))}
                className="w-full text-xs border border-stone-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300"
              >
                <option value="">Select client…</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-semibold text-stone-600 uppercase tracking-wide mb-1 block">Project</label>
              <select
                value={form.projectId}
                onChange={(e) => setForm((f) => ({ ...f, projectId: e.target.value }))}
                className="w-full text-xs border border-stone-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300"
              >
                <option value="">Select project…</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          </div>

          {/* Location & Scope */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-semibold text-stone-600 uppercase tracking-wide mb-1 block">Client Location</label>
              <input
                value={form.clientLocation}
                onChange={(e) => setForm((f) => ({ ...f, clientLocation: e.target.value }))}
                placeholder="City / Company"
                className="w-full text-xs border border-stone-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-stone-600 uppercase tracking-wide mb-1 block">GST (%)</label>
              <input
                type="number"
                value={form.taxRate}
                onChange={(e) => setForm((f) => ({ ...f, taxRate: e.target.value }))}
                className="w-full text-xs border border-stone-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] font-semibold text-stone-600 uppercase tracking-wide mb-1 block">Scope of Work</label>
            <textarea
              value={form.scopeOfWork}
              onChange={(e) => setForm((f) => ({ ...f, scopeOfWork: e.target.value }))}
              rows={2}
              placeholder="Describe the scope…"
              className="w-full text-xs border border-stone-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
            />
          </div>

          {/* Services */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[10px] font-semibold text-stone-600 uppercase tracking-wide">Services</label>
              <button
                onClick={() => setForm((f) => ({ ...f, services: [...f.services, { name: '', detail: '', amount: '' }] }))}
                className="text-[10px] text-indigo-600 hover:text-indigo-800 font-semibold"
              >
                + Add row
              </button>
            </div>
            <div className="space-y-2">
              {form.services.map((s, i) => (
                <div key={i} className="grid grid-cols-12 gap-1.5 items-center">
                  <div className="col-span-5">
                    <input
                      value={s.name}
                      onChange={(e) => setForm((f) => ({ ...f, services: f.services.map((sv, j) => j === i ? { ...sv, name: e.target.value } : sv) }))}
                      placeholder="Service name"
                      className="w-full text-xs border border-stone-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                    />
                  </div>
                  <div className="col-span-4">
                    <input
                      value={s.detail}
                      onChange={(e) => setForm((f) => ({ ...f, services: f.services.map((sv, j) => j === i ? { ...sv, detail: e.target.value } : sv) }))}
                      placeholder="Detail"
                      className="w-full text-xs border border-stone-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                    />
                  </div>
                  <div className="col-span-2">
                    <input
                      type="number"
                      value={s.amount}
                      onChange={(e) => setForm((f) => ({ ...f, services: f.services.map((sv, j) => j === i ? { ...sv, amount: e.target.value } : sv) }))}
                      placeholder="₹"
                      className="w-full text-xs border border-stone-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                    />
                  </div>
                  <div className="col-span-1 flex justify-center">
                    {form.services.length > 1 && (
                      <button
                        onClick={() => setForm((f) => ({ ...f, services: f.services.filter((_, j) => j !== i) }))}
                        className="text-stone-300 hover:text-red-400 text-lg leading-none"
                      >×</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Totals */}
          <div className="bg-stone-50 rounded-xl p-3 text-xs space-y-1 border border-stone-100">
            <div className="flex justify-between text-stone-600">
              <span>Subtotal</span><span className="font-semibold">{fmt(subtotal)}</span>
            </div>
            {tax > 0 && (
              <div className="flex justify-between text-stone-500">
                <span>GST ({form.taxRate}%)</span><span>{fmt(tax)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-stone-900 pt-1 border-t border-stone-200">
              <span>Total</span><span>{fmt(subtotal + tax)}</span>
            </div>
          </div>

          <div>
            <label className="text-[10px] font-semibold text-stone-600 uppercase tracking-wide mb-1 block">Notes</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              rows={2}
              placeholder="Payment terms, validity, etc."
              className="w-full text-xs border border-stone-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-stone-100">
          <button onClick={onClose} className="px-4 py-2 text-xs border border-stone-200 rounded-xl text-stone-600 hover:bg-stone-50">
            Cancel
          </button>
          <button
            onClick={create}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 text-xs bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 font-semibold transition-colors"
          >
            {saving ? <Loader2 size={12} className="animate-spin" /> : <FileText size={12} />}
            Create Quotation
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main DealsPage ───────────────────────────────────────────────────────────

export default function DealsPage() {
  const [deals, setDeals] = useState<Deal[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [expandedDeal, setExpandedDeal] = useState<string | null>(null)
  const [convertDeal, setConvertDeal] = useState<Deal | null>(null)
  const [form, setForm] = useState({
    title: '', value: '', stage: 'PROPOSAL', probability: '50', closeDate: '', notes: '',
  })

  useEffect(() => { fetchDeals() }, [])

  async function fetchDeals() {
    setLoading(true)
    try {
      const res = await fetch('/api/crm/deals')
      const data = await res.json()
      setDeals(data.data ?? [])
    } catch (e) {
      console.error('[DealsPage] fetch error:', e)
    } finally { setLoading(false) }
  }

  async function createDeal() {
    if (!form.title.trim()) return
    setSaving(true)
    try {
      const res = await fetch('/api/crm/deals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title,
          value: form.value ? Number(form.value) : null,
          stage: form.stage,
          probability: Number(form.probability),
          closeDate: form.closeDate || null,
          notes: form.notes || null,
        }),
      })
      const data = await res.json()
      if (data.data) {
        setDeals((prev) => [data.data, ...prev])
        setShowForm(false)
        setForm({ title: '', value: '', stage: 'PROPOSAL', probability: '50', closeDate: '', notes: '' })
        toast.success('Deal added')
      }
    } catch (e) {
      console.error('[DealsPage] createDeal error:', e)
      toast.error('Could not create deal')
    } finally { setSaving(false) }
  }

  async function updateStage(id: string, stage: string) {
    setDeals((prev) => prev.map((d) => d.id === id ? { ...d, stage } : d))
    try {
      await fetch(`/api/crm/deals/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage }),
      })
    } catch (e) {
      console.error('[DealsPage] updateStage error:', e)
    }
  }

  async function deleteDeal(id: string) {
    if (!confirm('Delete this deal?')) return
    try {
      await fetch(`/api/crm/deals/${id}`, { method: 'DELETE' })
      setDeals((prev) => prev.filter((d) => d.id !== id))
      toast.success('Deal deleted')
    } catch (e) {
      console.error('[DealsPage] deleteDeal error:', e)
      toast.error('Could not delete deal')
    }
  }

  const wonValue = deals.filter((d) => d.stage === 'WON').reduce((s, d) => s + (Number(d.value) ?? 0), 0)
  const pipelineValue = deals
    .filter((d) => !['WON', 'LOST'].includes(d.stage))
    .reduce((s, d) => s + ((Number(d.value) ?? 0) * (d.probability / 100)), 0)
  const activeDeals = deals.filter((d) => !['WON', 'LOST'].includes(d.stage)).length

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <TopBar title="CRM — Deals" />

      {/* Stats bar */}
      <div className="flex flex-wrap items-center gap-4 md:gap-6 px-5 py-3 border-b border-stone-100 bg-white flex-shrink-0">
        <div className="flex items-center gap-2">
          <TrendingUp size={14} className="text-green-600" />
          <div>
            <p className="text-[10px] uppercase tracking-wide text-stone-400 font-medium">Won</p>
            <p className="text-base font-bold text-green-700">{formatMoney(wonValue)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Target size={14} className="text-blue-600" />
          <div>
            <p className="text-[10px] uppercase tracking-wide text-stone-400 font-medium">Weighted Pipeline</p>
            <p className="text-base font-bold text-stone-900">{formatMoney(pipelineValue)}</p>
          </div>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-stone-400 font-medium">Active Deals</p>
          <p className="text-base font-bold text-stone-900">{activeDeals}</p>
        </div>
        <div className="ml-auto">
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-stone-900 text-white text-xs font-medium rounded-md hover:bg-stone-700"
          >
            <Plus size={13} /> Add Deal
          </button>
        </div>
      </div>

      {/* Deals list */}
      <div className="flex-1 overflow-y-auto p-5">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={24} className="animate-spin text-stone-400" />
          </div>
        ) : deals.length === 0 ? (
          <div className="text-center py-20 text-stone-400">
            <IndianRupee size={32} className="mx-auto mb-3 opacity-40" />
            <p className="text-sm">No deals yet. Add your first deal.</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-stone-100 overflow-hidden divide-y divide-stone-50">
            {deals.map((deal) => {
              const isExpanded = expandedDeal === deal.id
              const stageStyle = DEAL_STAGES.find((s) => s.id === deal.stage)?.color ?? 'bg-stone-100 text-stone-600'
              const isWon = deal.stage === 'WON'
              return (
                <div key={deal.id}>
                  {/* Deal row */}
                  <div className="flex items-center gap-3 px-4 py-3 hover:bg-stone-50/60 group transition-colors">
                    {/* Title */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-xs font-semibold text-stone-900 truncate">{deal.title}</p>
                        {isWon && (
                          <span className="text-[9px] font-bold bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">🏆 WON</span>
                        )}
                      </div>
                      {deal.company && <p className="text-[10px] text-stone-400 mt-0.5">{deal.company.name}</p>}
                    </div>

                    {/* Value */}
                    <div className="w-24 text-right flex-shrink-0">
                      {deal.value ? (
                        <span className="text-xs font-bold text-stone-900">{formatMoney(Number(deal.value))}</span>
                      ) : (
                        <span className="text-xs text-stone-300">—</span>
                      )}
                    </div>

                    {/* Stage */}
                    <div className="flex-shrink-0">
                      <select
                        value={deal.stage}
                        onChange={(e) => updateStage(deal.id, e.target.value)}
                        className={`text-[11px] font-medium px-2 py-1 rounded-full border-0 focus:ring-1 focus:ring-stone-300 cursor-pointer ${stageStyle}`}
                      >
                        {DEAL_STAGES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                      </select>
                    </div>

                    {/* Probability */}
                    <div className="flex items-center gap-2 w-20 flex-shrink-0">
                      <div className="flex-1 bg-stone-100 rounded-full h-1.5 overflow-hidden">
                        <div className="h-full bg-stone-700 rounded-full" style={{ width: `${deal.probability}%` }} />
                      </div>
                      <span className="text-[10px] text-stone-500 w-7 text-right">{deal.probability}%</span>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {/* Convert to Quote button — only for WON deals */}
                      {isWon && (
                        <button
                          onClick={() => setConvertDeal(deal)}
                          title="Convert to Quotation"
                          className="flex items-center gap-1 text-[10px] font-semibold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-2 py-1 rounded-md transition-colors"
                        >
                          <Zap size={10} /> Quote
                        </button>
                      )}

                      {/* Expand timeline */}
                      <button
                        onClick={() => setExpandedDeal(isExpanded ? null : deal.id)}
                        className="p-1 text-stone-400 hover:text-stone-700 transition-colors"
                        title="Activity timeline"
                      >
                        {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                      </button>

                      {/* Delete */}
                      <button
                        onClick={() => deleteDeal(deal.id)}
                        className="opacity-0 group-hover:opacity-100 p-1 text-stone-300 hover:text-red-500 transition-all"
                      >
                        <X size={13} />
                      </button>
                    </div>
                  </div>

                  {/* Activity Timeline (expandable) */}
                  {isExpanded && <ActivityTimeline dealId={deal.id} />}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Add Deal modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-5 py-4 border-b border-stone-100">
              <h3 className="text-sm font-semibold text-stone-900">Add Deal</h3>
              <button onClick={() => setShowForm(false)}><X size={16} className="text-stone-400" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1">Deal Title *</label>
                <input
                  autoFocus
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="e.g. Annual social media package"
                  className="w-full px-3 py-2 text-sm border border-stone-200 rounded-md focus:outline-none focus:ring-2 focus:ring-stone-300"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1">Value (₹)</label>
                  <input
                    type="number"
                    value={form.value}
                    onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))}
                    placeholder="0"
                    className="w-full px-3 py-2 text-sm border border-stone-200 rounded-md focus:outline-none focus:ring-2 focus:ring-stone-300"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1">Stage</label>
                  <select
                    value={form.stage}
                    onChange={(e) => setForm((f) => ({ ...f, stage: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-stone-200 rounded-md focus:outline-none focus:ring-2 focus:ring-stone-300"
                  >
                    {DEAL_STAGES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1">Probability (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={form.probability}
                    onChange={(e) => setForm((f) => ({ ...f, probability: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-stone-200 rounded-md focus:outline-none focus:ring-2 focus:ring-stone-300"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1">Close Date</label>
                  <input
                    type="date"
                    value={form.closeDate}
                    onChange={(e) => setForm((f) => ({ ...f, closeDate: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-stone-200 rounded-md focus:outline-none focus:ring-2 focus:ring-stone-300"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1">Notes</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  rows={2}
                  className="w-full px-3 py-2 text-sm border border-stone-200 rounded-md focus:outline-none focus:ring-2 focus:ring-stone-300 resize-none"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 px-5 py-4 border-t border-stone-100">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 text-xs border border-stone-200 rounded-md text-stone-600 hover:bg-stone-50">
                Cancel
              </button>
              <button
                onClick={createDeal}
                disabled={saving || !form.title.trim()}
                className="flex items-center gap-1.5 px-4 py-2 text-xs bg-stone-900 text-white rounded-md hover:bg-stone-700 disabled:opacity-50"
              >
                {saving && <Loader2 size={12} className="animate-spin" />}
                Add Deal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Convert to Quotation modal */}
      {convertDeal && (
        <ConvertToQuotModal deal={convertDeal} onClose={() => setConvertDeal(null)} />
      )}
    </div>
  )
}
