'use client'
// src/app/(dashboard)/crm/page.tsx
import { useEffect, useState } from 'react'
import { TopBar } from '@/components/layout/TopBar'
import Link from 'next/link'
import {
  TrendingUp, Users, Building2, IndianRupee, Target,
  ArrowRight, Loader2, LayoutList
} from 'lucide-react'
import { formatMoney } from '@/lib/utils'

const STAGE_COLORS: Record<string, string> = {
  NEW: 'bg-slate-100 text-slate-700',
  CONTACTED: 'bg-blue-100 text-blue-700',
  QUALIFIED: 'bg-purple-100 text-purple-700',
  PROPOSAL: 'bg-amber-100 text-amber-700',
  NEGOTIATION: 'bg-orange-100 text-orange-700',
  WON: 'bg-green-100 text-green-700',
  LOST: 'bg-red-100 text-red-700',
}

const STAGE_LABELS: Record<string, string> = {
  NEW: 'New', CONTACTED: 'Contacted', QUALIFIED: 'Qualified',
  PROPOSAL: 'Proposal', NEGOTIATION: 'Negotiation', WON: 'Won', LOST: 'Lost',
}

export default function CrmPage() {
  const [data, setData] = useState<{
    leads: any[]; contacts: any[]; companies: any[]; deals: any[]
  }>({ leads: [], contacts: [], companies: [], deals: [] })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch('/api/crm/leads').then(r => r.json()).catch(() => ({ data: [] })),
      fetch('/api/crm/contacts').then(r => r.json()).catch(() => ({ data: [] })),
      fetch('/api/crm/companies').then(r => r.json()).catch(() => ({ data: [] })),
      fetch('/api/crm/deals').then(r => r.json()).catch(() => ({ data: [] })),
    ]).then(([leads, contacts, companies, deals]) => {
      setData({
        leads: leads.data ?? [],
        contacts: contacts.data ?? [],
        companies: companies.data ?? [],
        deals: deals.data ?? [],
      })
      setLoading(false)
    })
  }, [])

  const wonValue = data.deals.filter(d => d.stage === 'WON').reduce((s: number, d: any) => s + Number(d.value ?? 0), 0)
  const pipelineValue = data.leads.filter(l => !['WON', 'LOST'].includes(l.stage))
    .reduce((s: number, l: any) => s + Number(l.value ?? 0), 0)
  const activeLeads = data.leads.filter(l => !['WON', 'LOST'].includes(l.stage)).length

  // Stage breakdown
  const stageMap: Record<string, number> = {}
  data.leads.forEach(l => { stageMap[l.stage] = (stageMap[l.stage] ?? 0) + 1 })

  const cards = [
    { href: '/crm/pipeline', label: 'Pipeline', icon: LayoutList, value: activeLeads, sub: `${data.leads.length} total leads`, color: 'text-blue-600 bg-blue-50' },
    { href: '/crm/contacts', label: 'Contacts', icon: Users, value: data.contacts.length, sub: `${data.companies.length} companies`, color: 'text-purple-600 bg-purple-50' },
    { href: '/crm/deals', label: 'Deals', icon: Target, value: data.deals.length, sub: 'Track revenue', color: 'text-amber-600 bg-amber-50' },
  ]

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <TopBar title="CRM" />
      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={24} className="animate-spin text-stone-400" />
          </div>
        ) : (
          <>
            {/* Top stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="stat-card">
                <div className="flex items-center gap-2 mb-3">
                  <div className="p-2 rounded-md bg-green-50">
                    <TrendingUp size={14} className="text-green-600" />
                  </div>
                </div>
                <p className="text-2xl font-bold text-stone-900">{formatMoney(wonValue)}</p>
                <p className="text-xs text-stone-400 mt-0.5">Won Revenue</p>
              </div>
              <div className="stat-card">
                <div className="flex items-center gap-2 mb-3">
                  <div className="p-2 rounded-md bg-blue-50">
                    <IndianRupee size={14} className="text-blue-600" />
                  </div>
                </div>
                <p className="text-2xl font-bold text-stone-900">{formatMoney(pipelineValue)}</p>
                <p className="text-xs text-stone-400 mt-0.5">Pipeline Value</p>
              </div>
              <div className="stat-card">
                <div className="flex items-center gap-2 mb-3">
                  <div className="p-2 rounded-md bg-amber-50">
                    <Target size={14} className="text-amber-600" />
                  </div>
                </div>
                <p className="text-2xl font-bold text-stone-900">{activeLeads}</p>
                <p className="text-xs text-stone-400 mt-0.5">Active Leads</p>
              </div>
              <div className="stat-card">
                <div className="flex items-center gap-2 mb-3">
                  <div className="p-2 rounded-md bg-purple-50">
                    <Users size={14} className="text-purple-600" />
                  </div>
                </div>
                <p className="text-2xl font-bold text-stone-900">{data.contacts.length}</p>
                <p className="text-xs text-stone-400 mt-0.5">Contacts</p>
              </div>
            </div>

            {/* Quick nav cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {cards.map(card => {
                const Icon = card.icon
                return (
                  <Link key={card.href} href={card.href} className="bg-white rounded-xl border border-stone-100 p-5 hover:border-stone-300 hover:shadow-sm transition-all flex items-center justify-between group">
                    <div className="flex items-center gap-3">
                      <div className={`p-2.5 rounded-xl ${card.color}`}>
                        <Icon size={16} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-stone-900">{card.label}</p>
                        <p className="text-xs text-stone-400">{card.sub}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xl font-bold text-stone-900">{card.value}</span>
                      <ArrowRight size={14} className="text-stone-300 group-hover:text-stone-600 transition-colors" />
                    </div>
                  </Link>
                )
              })}
            </div>

            {/* Stage breakdown + recent leads */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Stage breakdown */}
              <div className="bg-white rounded-xl border border-stone-100">
                <div className="px-4 py-3 border-b border-stone-100 flex items-center justify-between">
                  <p className="text-xs font-semibold text-stone-700 uppercase tracking-wide">Pipeline Breakdown</p>
                  <Link href="/crm/pipeline" className="text-[10px] text-stone-400 hover:text-stone-700 uppercase tracking-wide">View board →</Link>
                </div>
                <div className="p-4 space-y-2">
                  {Object.entries(stageMap).length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-6 text-center gap-2">
                      <p className="text-xs font-medium text-stone-600">Pipeline is empty</p>
                      <p className="text-[11px] text-stone-400">Add leads to see them broken down by stage.</p>
                      <Link
                        href="/crm/pipeline"
                        className="text-xs text-stone-900 underline hover:no-underline mt-1"
                      >
                        Open pipeline →
                      </Link>
                    </div>
                  ) : (
                    Object.entries(stageMap).map(([stage, count]) => (
                      <div key={stage} className="flex items-center justify-between">
                        <span className={`text-[11px] font-medium px-2.5 py-1 rounded-full ${STAGE_COLORS[stage] ?? 'bg-stone-100 text-stone-600'}`}>
                          {STAGE_LABELS[stage] ?? stage}
                        </span>
                        <div className="flex items-center gap-3 flex-1 mx-3">
                          <div className="flex-1 bg-stone-100 rounded-full h-1.5 overflow-hidden">
                            <div
                              className="h-full bg-stone-500 rounded-full"
                              style={{ width: `${(count / data.leads.length) * 100}%` }}
                            />
                          </div>
                          <span className="text-xs text-stone-500 w-4 text-right">{count}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Recent leads */}
              <div className="bg-white rounded-xl border border-stone-100">
                <div className="px-4 py-3 border-b border-stone-100 flex items-center justify-between">
                  <p className="text-xs font-semibold text-stone-700 uppercase tracking-wide">Recent Leads</p>
                  <Link href="/crm/pipeline" className="text-[10px] text-stone-400 hover:text-stone-700 uppercase tracking-wide">See all →</Link>
                </div>
                <div className="divide-y divide-stone-50">
                  {data.leads.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 text-center gap-3">
                      <p className="text-xs font-medium text-stone-600">No leads yet</p>
                      <p className="text-[11px] text-stone-400 max-w-[180px]">Start tracking potential clients by adding your first lead.</p>
                      <Link
                        href="/crm/pipeline"
                        className="inline-flex items-center gap-1.5 text-xs font-medium bg-stone-900 text-white rounded-md px-3 py-1.5 hover:bg-stone-700 transition-colors"
                      >
                        Add first lead
                      </Link>
                    </div>
                  ) : (
                    data.leads.slice(0, 5).map((lead: any) => (
                      <div key={lead.id} className="px-4 py-3 flex items-center justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-stone-900 truncate">{lead.title}</p>
                          {lead.company && <p className="text-[11px] text-stone-400 mt-0.5">{lead.company.name}</p>}
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {lead.value && (
                            <span className="text-xs font-semibold text-stone-700">{formatMoney(Number(lead.value))}</span>
                          )}
                          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${STAGE_COLORS[lead.stage] ?? 'bg-stone-100 text-stone-600'}`}>
                            {STAGE_LABELS[lead.stage] ?? lead.stage}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
