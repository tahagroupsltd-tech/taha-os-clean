'use client'
// src/app/(dashboard)/crm/deals/page.tsx
import { useEffect, useState } from 'react'
import { TopBar } from '@/components/layout/TopBar'
import { Plus, IndianRupee, TrendingUp, Target, X, Loader2 } from 'lucide-react'
import { formatMoney } from '@/lib/utils'

const DEAL_STAGES = [
  { id: 'PROPOSAL', label: 'Proposal', color: 'bg-amber-100 text-amber-700' },
  { id: 'NEGOTIATION', label: 'Negotiation', color: 'bg-orange-100 text-orange-700' },
  { id: 'CONTRACT', label: 'Contract', color: 'bg-purple-100 text-purple-700' },
  { id: 'WON', label: 'Won', color: 'bg-green-100 text-green-700' },
  { id: 'LOST', label: 'Lost', color: 'bg-red-100 text-red-700' },
]

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

export default function DealsPage() {
  const [deals, setDeals] = useState<Deal[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
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
        setDeals(prev => [data.data, ...prev])
        setShowForm(false)
        setForm({ title: '', value: '', stage: 'PROPOSAL', probability: '50', closeDate: '', notes: '' })
      }
    } finally { setSaving(false) }
  }

  async function updateStage(id: string, stage: string) {
    setDeals(prev => prev.map(d => d.id === id ? { ...d, stage } : d))
    await fetch(`/api/crm/deals/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage }),
    })
  }

  async function deleteDeal(id: string) {
    if (!confirm('Delete this deal?')) return
    await fetch(`/api/crm/deals/${id}`, { method: 'DELETE' })
    setDeals(prev => prev.filter(d => d.id !== id))
  }

  const wonValue = deals.filter(d => d.stage === 'WON').reduce((s, d) => s + (d.value ?? 0), 0)
  const pipelineValue = deals.filter(d => !['WON', 'LOST'].includes(d.stage))
    .reduce((s, d) => s + ((d.value ?? 0) * (d.probability / 100)), 0)
  const activeDeals = deals.filter(d => !['WON', 'LOST'].includes(d.stage)).length

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <TopBar title="CRM — Deals" />

      {/* Stats */}
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
            <Plus size={13} />
            Add Deal
          </button>
        </div>
      </div>

      {/* Deals table */}
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
          <div className="bg-white rounded-xl border border-stone-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-stone-100 bg-stone-50/40">
                    <th className="text-left px-4 py-3 text-[10px] uppercase tracking-wide text-stone-400 font-medium whitespace-nowrap">Deal</th>
                    <th className="text-left px-4 py-3 text-[10px] uppercase tracking-wide text-stone-400 font-medium whitespace-nowrap">Value</th>
                    <th className="text-left px-4 py-3 text-[10px] uppercase tracking-wide text-stone-400 font-medium whitespace-nowrap">Stage</th>
                    <th className="text-left px-4 py-3 text-[10px] uppercase tracking-wide text-stone-400 font-medium whitespace-nowrap">Prob.</th>
                    <th className="text-left px-4 py-3 text-[10px] uppercase tracking-wide text-stone-400 font-medium whitespace-nowrap">Close Date</th>
                    <th className="text-left px-4 py-3 text-[10px] uppercase tracking-wide text-stone-400 font-medium whitespace-nowrap">Contact</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-50">
                {deals.map(deal => (
                  <tr key={deal.id} className="hover:bg-stone-50 group transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <p className="text-xs font-medium text-stone-900">{deal.title}</p>
                      {deal.company && <p className="text-[11px] text-stone-400 mt-0.5">{deal.company.name}</p>}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {deal.value ? (
                        <span className="text-xs font-semibold text-stone-900">{formatMoney(Number(deal.value))}</span>
                      ) : (
                        <span className="text-xs text-stone-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <select
                        value={deal.stage}
                        onChange={e => updateStage(deal.id, e.target.value)}
                        className={`text-[11px] font-medium px-2 py-1 rounded-full border-0 focus:ring-1 focus:ring-stone-300 cursor-pointer ${
                          DEAL_STAGES.find(s => s.id === deal.stage)?.color ?? 'bg-stone-100 text-stone-600'
                        }`}
                      >
                        {DEAL_STAGES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <div className="w-12 bg-stone-100 rounded-full h-1.5 overflow-hidden">
                          <div
                            className="h-full bg-stone-700 rounded-full transition-all"
                            style={{ width: `${deal.probability}%` }}
                          />
                        </div>
                        <span className="text-[11px] text-stone-500">{deal.probability}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-xs text-stone-500">
                        {deal.closeDate
                          ? new Date(deal.closeDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                          : '—'
                        }
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-xs text-stone-500">{deal.contact?.name ?? '—'}</span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <button
                        onClick={() => deleteDeal(deal.id)}
                        className="opacity-0 group-hover:opacity-100 text-stone-300 hover:text-red-500 transition-all"
                      >
                        <X size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
                <input autoFocus value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="e.g. Annual social media package" className="w-full px-3 py-2 text-sm border border-stone-200 rounded-md focus:outline-none focus:ring-2 focus:ring-stone-300" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1">Value (₹)</label>
                  <input type="number" value={form.value} onChange={e => setForm(f => ({ ...f, value: e.target.value }))}
                    placeholder="0" className="w-full px-3 py-2 text-sm border border-stone-200 rounded-md focus:outline-none focus:ring-2 focus:ring-stone-300" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1">Stage</label>
                  <select value={form.stage} onChange={e => setForm(f => ({ ...f, stage: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-stone-200 rounded-md focus:outline-none focus:ring-2 focus:ring-stone-300">
                    {DEAL_STAGES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1">Probability (%)</label>
                  <input type="number" min="0" max="100" value={form.probability} onChange={e => setForm(f => ({ ...f, probability: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-stone-200 rounded-md focus:outline-none focus:ring-2 focus:ring-stone-300" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1">Close Date</label>
                  <input type="date" value={form.closeDate} onChange={e => setForm(f => ({ ...f, closeDate: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-stone-200 rounded-md focus:outline-none focus:ring-2 focus:ring-stone-300" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1">Notes</label>
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2}
                  className="w-full px-3 py-2 text-sm border border-stone-200 rounded-md focus:outline-none focus:ring-2 focus:ring-stone-300 resize-none" />
              </div>
            </div>
            <div className="flex justify-end gap-2 px-5 py-4 border-t border-stone-100">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 text-xs border border-stone-200 rounded-md text-stone-600 hover:bg-stone-50">Cancel</button>
              <button onClick={createDeal} disabled={saving || !form.title.trim()}
                className="px-4 py-2 text-xs bg-stone-900 text-white rounded-md hover:bg-stone-700 disabled:opacity-50 flex items-center gap-1.5">
                {saving && <Loader2 size={12} className="animate-spin" />}
                Add Deal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
