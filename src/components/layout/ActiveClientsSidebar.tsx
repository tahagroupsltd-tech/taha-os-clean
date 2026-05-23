// src/components/layout/ActiveClientsSidebar.tsx
'use client'
import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useUIStore } from '@/store/ui.store'
import { useAuthStore } from '@/store/auth.store'
import {
  Users, X, Search, Calendar, Video, IndianRupee,
  FolderKanban, FileVideo, CheckSquare, Loader2, Pencil, FileText
} from 'lucide-react'
import { cn, formatMoney } from '@/lib/utils'
import toast from 'react-hot-toast'

interface ActiveClientData {
  projectId: string
  projectName: string
  projectStatus: string
  clientId: string
  clientName: string
  clientUsername: string
  sopLevel: number
  projectValue: number
  outstandingBalance: number
  nextShoot: { title: string; startTime: string; location: string | null } | null
  nextPost: { title: string; postDate: string; status: string; type: string } | null
  lastPost: { title: string; postDate: string; status: string; type: string } | null
  lastVideoCurrentMonth: { title: string; postDate: string; status: string; type: string } | null
  currentMonthProgress: number
  currentMonthPosted: number
  currentMonthTotal: number
  nextMonthScriptsNeeded: boolean
  scriptStatusLabel: string
}

const SOP_LEVEL_LABELS: Record<number, string> = {
  1: 'L1 — Onboarding',
  2: 'L2 — PM Setup',
  3: 'L3 — Script Prep',
  4: 'L4 — Script Approval',
  5: 'L5 — Shoot Logistics',
  6: 'L6 — Shoot Day',
  7: 'L7 — Post-Prod',
}

const SOP_LEVEL_COLORS: Record<number, string> = {
  1: 'bg-blue-500',
  2: 'bg-indigo-500',
  3: 'bg-violet-500',
  4: 'bg-red-500 animate-pulse', // L4 is a hard gate
  5: 'bg-amber-500',
  6: 'bg-orange-500',
  7: 'bg-emerald-500',
}

function safeFormatDate(dateStr: string | null | undefined, fallback = 'None scheduled'): string {
  if (!dateStr) return fallback
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return fallback
    return d.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
    })
  } catch {
    return fallback
  }
}

export function ActiveClientsSidebar() {
  const router = useRouter()
  const user = useAuthStore((s) => s.user)
  const { activeClientsOpen, setActiveClientsOpen, toggleActiveClients } = useUIStore()

  const [data, setData] = useState<ActiveClientData[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')

  const [editingValueId, setEditingValueId] = useState<string | null>(null)
  const [tempValue, setTempValue] = useState('')
  const [mounted, setMounted] = useState(false)

  const isAdmin = user?.role === 'ADMIN' || user?.role === 'MANAGER'
  const isFounder = user?.role === 'ADMIN'
  // compute visibility once so hooks below can reference it safely
  const canShow = mounted && !!user && user.role !== 'CLIENT'

  // ── ALL hooks must be declared before any early returns ──────────────────
  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    // Only fetch when the drawer is opened and the user is allowed to see it
    if (!canShow || !activeClientsOpen) return
    let cancelled = false
    setLoading(true)
    fetch('/api/clients/active')
      .then((r) => r.json())
      .then((json) => { if (!cancelled) setData(json.data ?? []) })
      .catch((err) => console.error('[active-clients-sidebar] failed to fetch:', err))
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [activeClientsOpen, canShow])

  const filteredData = useMemo(() => {
    if (!search.trim()) return data
    const query = search.toLowerCase()
    return data.filter(
      (item) =>
        item.clientName.toLowerCase().includes(query) ||
        item.projectName.toLowerCase().includes(query)
    )
  }, [data, search])
  // ── End hooks section ────────────────────────────────────────────────────

  // Early returns AFTER all hooks
  if (!canShow) return null

  const fetchActiveClients = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/clients/active')
      const json = await res.json()
      setData(json.data ?? [])
    } catch (err) {
      console.error('[active-clients-sidebar] failed to fetch:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleNavigate = (path: string) => {
    router.push(path)
    setActiveClientsOpen(false)
  }

  const handleUpdateSopLevel = async (projectId: string, sopLevel: number) => {
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sopLevel }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      
      toast.success('SOP Level updated')
      setData((prev) =>
        prev.map((item) => (item.projectId === projectId ? { ...item, sopLevel } : item))
      )
    } catch (err: any) {
      toast.error(err.message || 'Failed to update SOP Level')
    }
  }

  const handleUpdateValue = async (projectId: string) => {
    const val = parseFloat(tempValue)
    if (isNaN(val) || val < 0) return toast.error('Invalid value')
    
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: val }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      
      toast.success('Project value updated')
      setEditingValueId(null)
      fetchActiveClients()
    } catch (err: any) {
      toast.error(err.message || 'Failed to update value')
    }
  }

  return (
    <>
      {/* Floating vertical strip toggle button on the right edge */}
      {!activeClientsOpen && (
        <button
          onClick={toggleActiveClients}
          className="fixed right-0 top-1/2 -translate-y-1/2 z-40 bg-[#0F0F14] border border-white/10 border-r-0 text-white px-2 py-4 rounded-l-lg shadow-xl flex flex-col items-center gap-2 cursor-pointer hover:bg-stone-900 transition-colors select-none group"
        >
          <Users size={14} className="text-violet-400 group-hover:scale-110 transition-transform" />
          <span className="text-[9px] font-bold uppercase tracking-widest [writing-mode:vertical-lr] rotate-180 mt-1">
            Active Clients
          </span>
        </button>
      )}

      {/* Backdrop */}
      {activeClientsOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 backdrop-blur-[2px] transition-opacity duration-300"
          onClick={() => setActiveClientsOpen(false)}
        />
      )}

      {/* Slide-out Sidebar Drawer */}
      <aside
        className={cn(
          'fixed right-0 top-0 h-full w-[380px] bg-white border-l border-stone-200 shadow-2xl z-50',
          'flex flex-col transition-transform duration-300 ease-in-out',
          activeClientsOpen ? 'translate-x-0' : 'translate-x-full'
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-stone-100 bg-stone-50/50">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
            <h3 className="text-sm font-bold text-stone-900">Active Client Campaigns</h3>
            <span className="text-[10px] font-bold bg-stone-200/80 text-stone-600 rounded-full px-2 py-0.5 ml-1">
              {data.length}
            </span>
          </div>
          <button
            onClick={() => setActiveClientsOpen(false)}
            className="p-1 rounded-md text-stone-400 hover:text-stone-700 hover:bg-stone-200/50 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Search */}
        <div className="p-3 border-b border-stone-100 bg-white">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400" size={13} />
            <input
              type="text"
              placeholder="Search clients or projects..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-stone-50 border border-stone-200 rounded-md focus:outline-none focus:ring-1 focus:ring-stone-400 focus:bg-white placeholder:text-stone-400"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700"
              >
                <X size={12} />
              </button>
            )}
          </div>
        </div>

        {/* List Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-stone-50/40">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-2">
              <Loader2 size={24} className="text-stone-400 animate-spin" />
              <p className="text-[11px] text-stone-400">Fetching client progress...</p>
            </div>
          ) : filteredData.length === 0 ? (
            <div className="text-center py-16">
              <Users size={32} className="text-stone-300 mx-auto mb-2" />
              <p className="text-xs font-semibold text-stone-700">No active clients found</p>
              <p className="text-[10px] text-stone-400 mt-1">Make sure you have projects marked as ACTIVE or PAUSED with a client assigned.</p>
            </div>
          ) : (
            filteredData.map((item) => {
              const pct = Math.round((item.sopLevel / 7) * 100)
              const initials = item.clientName ? item.clientName.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() : '??'

              return (
                <div
                  key={item.projectId}
                  className="bg-white border border-stone-200 rounded-xl p-3.5 shadow-sm hover:shadow-md hover:border-stone-300 transition-all space-y-3.5"
                >
                  {/* Card Header */}
                  <div className="flex items-start gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
                      {initials}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="text-xs font-bold text-stone-900 truncate leading-tight">
                        {item.clientName}
                      </h4>
                      <p className="text-[10px] text-stone-500 truncate mt-0.5">
                        {item.projectName}
                      </p>
                    </div>
                  </div>

                  {/* SOP Progress Bar */}
                  <div className="space-y-1">
                    <div className="flex justify-between items-center text-[10px]">
                      {isAdmin ? (
                        <select
                          value={item.sopLevel}
                          onChange={(e) => handleUpdateSopLevel(item.projectId, parseInt(e.target.value))}
                          className="text-[10px] font-semibold text-stone-600 bg-stone-50 border border-stone-200 rounded px-1.5 py-0.5 focus:outline-none cursor-pointer hover:bg-stone-100 transition-colors"
                        >
                          {Object.entries(SOP_LEVEL_LABELS).map(([lvl, label]) => (
                            <option key={lvl} value={lvl}>{label}</option>
                          ))}
                        </select>
                      ) : (
                        <span className="font-semibold text-stone-600">
                          {SOP_LEVEL_LABELS[item.sopLevel] || `Level ${item.sopLevel}`}
                        </span>
                      )}
                      <span className="font-bold text-stone-500">{pct}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-stone-100 rounded-full overflow-hidden">
                      <div
                        className={cn('h-full rounded-full transition-all duration-500', SOP_LEVEL_COLORS[item.sopLevel] || 'bg-stone-400')}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>

                  {/* Details Grid */}
                  <div className="grid grid-cols-1 gap-2 text-[10px] bg-stone-50/50 rounded-lg p-2.5 border border-stone-100">
                    {/* Shoot Status */}
                    <div className="flex items-center justify-between">
                      <span className="text-stone-400 flex items-center gap-1.5">
                        <Calendar size={11} className="text-stone-400 shrink-0" />
                        Shoot Logistics:
                      </span>
                      <span className="text-stone-700 font-medium">
                        {safeFormatDate(item.nextShoot?.startTime)}
                      </span>
                    </div>

                    {/* Next Post */}
                    <div className="flex items-center justify-between">
                      <span className="text-stone-400 flex items-center gap-1.5">
                        <Video size={11} className="text-stone-400 shrink-0" />
                        Next Video Post:
                      </span>
                      <span className="text-stone-700 font-medium truncate max-w-[150px]">
                        {item.nextPost 
                          ? `${safeFormatDate(item.nextPost.postDate)} (${item.nextPost.title})` 
                          : 'None scheduled'
                        }
                      </span>
                    </div>

                    {/* Last Posted Video */}
                    <div className="flex items-center justify-between">
                      <span className="text-stone-400 flex items-center gap-1.5">
                        <FileVideo size={11} className="text-stone-400 shrink-0" />
                        Last Posted Video:
                      </span>
                      <span className="text-stone-700 font-medium truncate max-w-[150px]">
                        {item.lastPost 
                          ? `${safeFormatDate(item.lastPost.postDate, 'None posted')} (${item.lastPost.title})` 
                          : 'None posted'
                        }
                      </span>
                    </div>

                    {/* Month's Last Video Post */}
                    <div className="flex items-center justify-between">
                      <span className="text-stone-400 flex items-center gap-1.5">
                        <Video size={11} className="text-stone-400 shrink-0 animate-pulse" />
                        Month's Last Video:
                      </span>
                      <span className="text-stone-700 font-medium truncate max-w-[150px]">
                        {item.lastVideoCurrentMonth 
                          ? `${safeFormatDate(item.lastVideoCurrentMonth.postDate)} (${item.lastVideoCurrentMonth.title})` 
                          : 'None scheduled'
                        }
                      </span>
                    </div>

                    {/* Next Month Scripts Reminder */}
                    <div className="flex items-center justify-between">
                      <span className="text-stone-400 flex items-center gap-1.5">
                        <FileText size={11} className="text-stone-400 shrink-0" />
                        Scripts Status:
                      </span>
                      <span className={cn(
                        'font-bold px-1.5 py-0.5 rounded-[4px] text-[9px] border',
                        item.nextMonthScriptsNeeded
                          ? item.scriptStatusLabel?.includes('Next Month')
                            ? 'bg-red-50 text-red-700 border-red-200 animate-pulse'
                            : 'bg-amber-50 text-amber-700 border-amber-200 animate-pulse'
                          : 'bg-stone-50 text-stone-600 border-stone-200'
                      )}>
                        {item.scriptStatusLabel || 'Not needed yet (0%)'}
                      </span>
                    </div>
                    {isFounder && (
                      <div className="flex items-center justify-between pt-1 border-t border-stone-100">
                        <span className="text-stone-400 flex items-center gap-1.5">
                          <IndianRupee size={11} className="text-stone-400 shrink-0" />
                          Pending Dues:
                        </span>
                        <div className="flex items-center gap-1">
                          {editingValueId === item.projectId ? (
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                value={tempValue}
                                onChange={(e) => setTempValue(e.target.value)}
                                className="w-16 px-1 py-0.5 border border-stone-300 rounded text-[10px] text-stone-900 focus:outline-none"
                                placeholder="Value"
                                autoFocus
                              />
                              <button
                                onClick={() => handleUpdateValue(item.projectId)}
                                className="text-[9px] font-bold text-green-600 hover:text-green-800"
                              >
                                Save
                              </button>
                              <button
                                onClick={() => setEditingValueId(null)}
                                className="text-[9px] font-bold text-stone-400 hover:text-stone-600"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <>
                              <span className={cn('font-bold', item.outstandingBalance > 0 ? 'text-amber-600' : 'text-emerald-600')}>
                                {item.outstandingBalance > 0 ? (
                                  formatMoney(item.outstandingBalance)
                                ) : (
                                  'Fully Paid'
                                )}
                              </span>
                              <button
                                onClick={() => {
                                  setEditingValueId(item.projectId)
                                  setTempValue(String(item.projectValue))
                                }}
                                className="p-0.5 text-stone-300 hover:text-stone-600 transition-colors"
                                title="Edit Project Value"
                              >
                                <Pencil size={9} />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Actions / Navigation Shortcuts */}
                  <div className="flex items-center gap-1.5 pt-1">
                    <button
                      onClick={() => handleNavigate(`/projects/${item.projectId}`)}
                      className="flex-1 flex items-center justify-center gap-1 py-1.5 border border-stone-200 hover:border-stone-300 hover:bg-stone-50 rounded-lg text-[9px] font-semibold text-stone-600 transition-colors"
                      title="Open Project detail page"
                    >
                      <FolderKanban size={11} />
                      Project Detail
                    </button>
                    <button
                      onClick={() => handleNavigate(`/content?projectId=${item.projectId}`)}
                      className="p-1.5 border border-stone-200 hover:border-stone-300 hover