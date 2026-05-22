'use client'
// src/app/(dashboard)/crm/pipeline/page.tsx
import { useEffect, useState } from 'react'
import { TopBar } from '@/components/layout/TopBar'
import { Plus, IndianRupee, User, Building2, Calendar, X, Loader2 } from 'lucide-react'
import { formatMoney } from '@/lib/utils'

const STAGES = [
  { id: 'NEW', label: 'New Lead', color: 'bg-slate-100 text-slate-700' },
  { id: 'CONTACTED', label: 'Contacted', color: 'bg-blue-100 text-blue-700' },
  { id: 'QUALIFIED', label: 'Qualified', color: 'bg-purple-100 text-purple-700' },
  { id: 'PROPOSAL', label: 'Proposal', color: 'bg-amber-100 text-amber-700' },
  { id: 'NEGOTIATION', label: 'Negotiation', color: 'bg-orange-100 text-orange-700' },
  { id: 'WON', label: 'Won', color: 'bg-green-100 text-green-700' },
  { id: 'LOST', label: 'Lost', color: 'bg-red-100 text-red-700' },
]

const SOURCE_LABELS: Record<string, string> = {
  REFERRAL: 'Referral', WEBSITE: 'Website', SOCIAL: 'Social Media',
  COLD_OUTREACH: 'Cold Outreach', OTHER: 'Other',
}

interface Lead {
  id: string
  title: string
  stage: string
  source: string
  value: number | null
  notes: string | null
  expectedCloseDate: string | null
  contact: { id: string; name: string; email: string | null; phone: string | null } | null
  company: { id: string; name: string } | null
  assignedTo: { id: string; name: string } | null
  createdAt: string
}

interface NewLeadForm {
  title: string
  stage: string
  source: string
  value: string
  notes: string
  expectedCloseDate: string
}

export default function PipelinePage() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [dragging, setDragging] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [form, setForm] = useState<NewLeadForm>({
    title: '', stage: 'NEW', source: 'OTHER', value: '', notes: '', expectedCloseDate: '',
  })

  useEffect(() => {
    fetchLeads()
  }, [])

  async function fetchLeads() {
    setLoading(true)
    try {
      const res = await fetch('/api/crm/leads')
      const data = await res.json()
      setLeads(data.data ?? [])
    } catch { /* silent */ }
    finally { setLoading(false) }
  }

  async function moveLead(leadId: string, newStage: string) {
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, stage: newStage } : l))
    await fetch(`/api/crm/leads/${leadId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage: newStage }),
    })
  }

  async function createLead() {
    if (!form.title.trim()) return
    setSaving(true)
    try {
      const res = await fetch('/api/crm/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title,
          stage: form.stage,
          source: form.source,
          value: form.value ? Number(form.value) : null,
          notes: form.notes || null,
          expectedCloseDate: form.expectedCloseDate || null,
        }),
      })
      const data = await res.json()
      if (data.data) {
        setLeads(prev => [data.data, ...prev])
        setShowForm(false)
        setForm({ title: '', stage: 'NEW', source: 'OTHER', value: '', notes: '', expectedCloseDate: '' })
      }
    } finally { setSaving(false) }
  }

  async function deleteLead(id: string) {
    if (!confirm('Delete this lead?')) return
    await fetch(`/api/crm/leads/${id}`, { method: 'DELETE' })
    setLeads(prev => prev.filter(l => l.id !== id))
    setSelectedLead(null)
  }

  const byStage = (stage: string) => leads.filter(l => l.stage === stage)
  const totalValue = leads.filter(l => l.stage === 'WON').reduce((sum, l) => sum + (l.value ?? 0), 0)
  const pipelineValue = leads.filter(l => !['WON', 'LOST'].includes(l.stage)).reduce((sum, l) => sum + (l.value ?? 0), 0)

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <TopBar title="CRM Pipeline" />

      {/* Header strip */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 border-b border-stone-100 bg-white flex-shrink-0 w-full">
        <div className="flex items-center gap-4 sm:gap-6 flex-wrap">
          <div>
            <p className="text-[10px] uppercase tracking-wide text-stone-400 font-medium">Won Revenue</p>
            <p className="text-sm sm:text-base font-bold text-green-700">{formatMoney(totalValue)}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wide text-stone-400 font-medium">Pipeline Value</p>
            <p className="text-sm sm:text-base font-bold text-stone-900">{formatMoney(pipelineValue)}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wide text-stone-400 font-medium">Total Leads</p>
            <p className="text-sm sm:text-base font-bold text-stone-900">{leads.length}</p>
          </div>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-3 py-1.5 bg-stone-900 text-white text-xs font-medium rounded-md hover:bg-stone-700 transition-colors whitespace-nowrap"
        >
          <Plus size={13} />
          Add Lead
        </button>
      </div>

      {/* Kanban board */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 size={24} className="animate-spin text-stone-400" />
          </div>
        ) : (
          <div className="flex gap-3 p-4 h-full min-w-max">
            {STAGES.map(stage => (
              <div
                key={stage.id}
                className={`flex flex-col w-64 rounded-xl border-2 transition-colors ${
                  dragOver === stage.id ? 'border-stone-400 bg-stone-50' : 'border-transparent bg-stone-50'
                }`}
                onDragOver={e => { e.preventDefault(); setDragOver(stage.id) }}
                onDragLeave={() => setDragOver(null)}
                onDrop={e => {
                  e.preventDefault()
                  if (dragging && dragging !== stage.id) {
                    moveLead(dragging, stage.id)
                  }
                  setDragging(null)
                  setDragOver(null)
                }}
              >
                {/* Column header */}
                <div className="flex items-center justify-between px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${stage.color}`}>
                      {stage.label}
                    </span>
                    <span className="text-[11px] text-stone-400 font-medium">
                      {byStage(stage.id).length}
                    </span>
                  </div>
                </div>

                {/* Cards */}
                <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-2">
                  {byStage(stage.id).length === 0 && (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                      <p className="text-[11px] text-stone-400">No leads here</p>
                      <p className="text-[10px] text-stone-300 mt-0.5">Drag a card here to move it</p>
                    </div>
                  )}
                  {byStage(stage.id).map(lead => (
                    <div
                      key={lead.id}
                      draggable
                      onDragStart={() => setDragging(lead.id)}
                      onDragEnd={() => setDragging(null)}
                      onClick={() => setSelectedLead(lead)}
                      className={`bg-white rounded-lg border border-stone-100 p-3 cursor-grab active:cursor-grabbing hover:border-stone-300 hover:shadow-sm transition-all ${
                        dragging === lead.id ? 'opacity-40' : ''
                      }`}
                    >
                      <p className="text-xs font-semibold text-stone-900 mb-2 leading-snug">{lead.title}</p>

                      {lead.value && (
                        <div className="flex items-center gap-1 mb-1.5">
                          <IndianRupee size={10} className="text-stone-400" />
                          <span className="text-[11px] font-medium text-stone-700">{formatMoney(Number(lead.value))}</span>
                        </div>
                      )}
                      {lead.contact && (
                        <div className="flex items-center gap-1 mb-1">
                          <User size={10} className="text-stone-400" />
                          <span className="text-[11px] text-stone-500 truncate">{lead.contact.name}</span>
                        </div>
                      )}
                      {lead.company && (
                        <div className="flex items-center gap-1 mb-1">
                          <Building2 size={10} className="text-stone-400" />
                          <span className="text-[11px] text-stone-500 truncate">{lead.company.name}</span>
                        </div>
                      )}
                      {lead.expectedCloseDate && (
                        <div className="flex items-center gap-1 mt-1.5">
                          <Calendar size={10} className="text-stone-400" />
                          <span className="text-[10px] text-stone-400">
                            {new Date(lead.expectedCloseDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                          </span>
                        </div>
                      )}
                      {lead.source !== 'OTHER' && (
                        <p className="text-[10px] text-stone-400 mt-1.5 bg-stone-50 rounded px-1.5 py-0.5 inline-block">
                          {SOURCE_LABELS[lead.source]}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Lead modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-5 py-4 border-b border-stone-100">
              <h3 className="text-sm font-semibold text-stone-900">Add New Lead</h3>
              <button onClick={() => setShowForm(false)} className="text-stone-400 hover:text-stone-700">
                <X size={16} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1">Title *</label>
                <input
                  autoFocus
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="e.g. Social media package for XYZ"
                  className="w-full px-3 py-2 text-sm border border-stone-200 rounded-md focus:outline-none focus:ring-2 focus:ring-stone-300"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1">Stage</label>
                  <select
                    value={form.stage}
                    onChange={e => setForm(f => ({ ...f, stage: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-stone-200 rounded-md focus:outline-none focus:ring-2 focus:ring-stone-300"
                  >
                    {STAGES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1">Source</label>
                  <select
                    value={form.source}
                    onChange={e => setForm(f => ({ ...f, source: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-stone-200 rounded-md focus:outline-none focus:ring-2 focus:ring-stone-300"
                  >
                    {Object.entries(SOURCE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1">Value (₹)</label>
                  <input
                    type="number"
                    value={form.value}
                    onChange={e => setForm(f => ({ ...f, value: e.target.value }))}
                    placeholder="0"
                    className="w-full px-3 py-2 text-sm border border-stone-200 rounded-md focus:outline-none focus:ring-2 focus:ring-stone-300"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1">Expected Close</label>
                  <input
                    type="date"
                    value={form.expectedCloseDate}
                    onChange={e => setForm(f => ({ ...f, expectedCloseDate: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-stone-200 rounded-md focus:outline-none focus:ring-2 focus:ring-stone-300"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1">Notes</label>
                <textarea
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  rows={3}
                  placeholder="Add any notes..."
                  className="w-full px-3 py-2 text-sm border border-stone-200 rounded-md focus:outline-none focus:ring-2 focus:ring-stone-300 resize-none"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 px-5 py-4 border-t border-stone-100">
              <button
                onClick={() => setShowForm(false)}
                className="px-4 py-2 text-xs font-medium text-stone-600 border border-stone-200 rounded-md hover:bg-stone-50"
              >
                Cancel
              </button>
              <button
                onClick={createLead}
                disabled={saving || !form.title.trim()}
                className="px-4 py-2 text-xs font-medium bg-stone-900 text-white rounded-md hover:bg-stone-700 disabled:opacity-50 flex items-center gap-1.5"
              >
                {saving && <Loader2 size={12} className="animate-spin" />}
                Create Lead
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lead detail drawer */}
      {selectedLead && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-xl shadow-xl w-full sm:max-w-lg max-h-[85vh] overflow-y-auto">
            <div className="sticky top-0 bg-white flex items-center justify-between px-5 py-4 border-b border-stone-100">
              <div>
                <h3 className="text-sm font-semibold text-stone-900">{selectedLead.title}</h3>
                <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full mt-1 inline-block ${
                  STAGES.find(s => s.id === selectedLead.stage)?.color ?? 'bg-stone-100 text-stone-600'
                }`}>
                  {STAGES.find(s => s.id === selectedLead.stage)?.label}
                </span>
              </div>
              <button onClick={() => setSelectedLead(null)} className="text-stone-400 hover:text-stone-700">
                <X size={18} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              {selectedLead.value && (
                <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg">
                  <IndianRupee size={14} className="text-green-700" />
                  <span className="text-sm font-bold text-green-800">{formatMoney(Number(selectedLead.value))}</span>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4 text-xs">
                {selectedLead.contact && (
                  <div>
                    <p className="text-stone-400 mb-0.5">Contact</p>
                    <p className="font-medium text-stone-800">{selectedLead.contact.name}</p>
                    {selectedLead.contact.phone && <p className="text-stone-500">{selectedLead.contact.phone}</p>}
                  </div>
                )}
                {selectedLead.company && (
                  <div>
                    <p className="text-stone-400 mb-0.5">Company</p>
                    <p className="font-medium text-stone-800">{selectedLead.company.name}</p>
                  </div>
                )}
                {selectedLead.assignedTo && (
                  <div>
                    <p className="text-stone-400 mb-0.5">Assigned To</p>
                    <p className="font-medium text-stone-800">{selectedLead.assignedTo.name}</p>
                  </div>
                )}
                {selectedLead.source && (
                  <div>
                    <p className="text-stone-400 mb-0.5">Source</p>
                    <p className="font-medium text-stone-800">{SOURCE_LABELS[selectedLead.source] ?? selectedLead.source}</p>
                  </div>
                )}
                {selectedLead.expectedCloseDate && (
                  <div>
                    <p className="text-stone-400 mb-0.5">Expected Close</p>
                    <p className="font-medium text-stone-800">
                      {new Date(selectedLead.expectedCloseDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                )}
              </div>
              {selectedLead.notes && (
                <div>
                  <p className="text-xs text-stone-400 mb-1">Notes</p>
                  <p className="text-sm text-stone-700 bg-stone-50 rounded-lg p-3">{selectedLead.notes}</p>
                </div>
              )}

              {/* Stage mover */}
              <div>
                <p className="text-xs text-stone-400 mb-2">Move to stage</p>
                <div className="flex flex-wrap gap-1.5">
                  {STAGES.filter(s => s.id !== selectedLead.stage).map(s => (
                    <button
                      key={s.id}
                      onClick={async () => {
                        await moveLead(selectedLead.id, s.id)
                        setSelectedLead(prev => prev ? { ...prev, stage: s.id } : null)
                      }}
                      className={`text-[11px] font-medium px-2.5 py-1 rounded-full transition-opacity hover:opacity-80 ${s.color}`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="px-5 py-4 border-t border-stone-100 flex justify-end">
              <button
                onClick={() => deleteLead(selectedLead.id)}
                className="px-3 py-1.5 text-xs text-red-600 border border-red-200 rounded-md hover:bg-red-50"
              >
                Delete Lead
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
