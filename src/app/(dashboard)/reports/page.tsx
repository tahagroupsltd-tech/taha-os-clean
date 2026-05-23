'use client'
// src/app/(dashboard)/reports/page.tsx
import { useEffect, useState } from 'react'
import { TopBar } from '@/components/layout/TopBar'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { useAuthStore } from '@/store/auth.store'
import { formatDate } from '@/lib/utils'
import { CheckCircle2, Clock, AlertCircle, Send, CalendarDays } from 'lucide-react'
import toast from 'react-hot-toast'

interface Report {
  id: string
  ownerId: string
  date: string
  summary: string
  hoursWorked: number | null
  blockers: string | null
  createdAt: string
  owner?: { id: string; name: string; username: string; role: string }
}

interface SubmissionStatus {
  id: string
  name: string
  username: string
  role: string
  submitted: boolean
  report: { summary: string; hoursWorked: number | null; createdAt: string } | null
}

export default function ReportsPage() {
  const user = useAuthStore((s) => s.user)
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'MANAGER'

  const [tab, setTab] = useState<'submit' | 'team'>('submit')
  const [todayReport, setTodayReport] = useState<Report | null>(null)
  const [history, setHistory] = useState<Report[]>([])
  const [teamStatus, setTeamStatus] = useState<SubmissionStatus[]>([])
  const [loading, setLoading] = useState(true)

  // Form state
  const [summary, setSummary] = useState('')
  const [hours, setHours] = useState('')
  const [blockers, setBlockers] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const today = new Date().toISOString().slice(0, 10)

  const refresh = async () => {
    setLoading(true)
    const [me, status] = await Promise.all([
      fetch(`/api/reports?date=${today}`).then((r) => r.json()),
      isAdmin ? fetch('/api/reports?status=today').then((r) => r.json()) : Promise.resolve({ data: [] }),
    ])
    const myToday = (me.data ?? []).find((r: Report) => r.ownerId === user?.id) ?? null
    setTodayReport(myToday)
    if (myToday) {
      setSummary(myToday.summary)
      setHours(myToday.hoursWorked?.toString() ?? '')
      setBlockers(myToday.blockers ?? '')
    }
    const all = await fetch('/api/reports').then((r) => r.json())
    setHistory(all.data ?? [])
    setTeamStatus(status.data ?? [])
    setLoading(false)
  }

  useEffect(() => {
    if (user) refresh()
  }, [user])

  const handleSubmit = async () => {
    if (!summary.trim()) return toast.error('Write a summary first')
    setSubmitting(true)
    try {
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          summary,
          hoursWorked: hours ? parseFloat(hours) : undefined,
          blockers: blockers || undefined,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      toast.success(todayReport ? 'Report updated' : 'Report submitted')
      await refresh()
    } catch (err: any) {
      toast.error(err.message ?? 'Failed')
    } finally {
      setSubmitting(false)
    }
  }

  const myHistory = history.filter((r) => r.ownerId === user?.id).slice(0, 7)

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <TopBar title="Daily Reports" />

      {/* Tab strip — only shown for admin (team status tab) */}
      {isAdmin && (
        <div className="flex gap-1 border-b border-stone-100 px-5 flex-shrink-0 bg-white">
          {[
            { id: 'submit' as const, label: "Today's Report" },
            { id: 'team' as const, label: 'Team Status' },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2.5 text-xs font-medium border-b-2 transition-colors ${
                tab === t.id
                  ? 'text-stone-900 border-stone-900'
                  : 'text-stone-400 border-transparent hover:text-stone-600'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      <div className="flex-1 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-xs text-stone-400">Loading...</p>
          </div>
        ) : (tab === 'submit' || !isAdmin) ? (
          /* ── Submit tab: two-column layout ── */
          <div className="flex h-full overflow-hidden">
            {/* Left — form */}
            <div className="flex-1 overflow-y-auto p-5">
              <div className="bg-white rounded-lg border border-stone-100 p-5 max-w-2xl">
                <div className="flex items-center gap-2 mb-4">
                  {todayReport ? (
                    <Badge className="bg-green-50 text-green-700">
                      <CheckCircle2 size={11} className="inline mr-1" />
                      Submitted at {new Date(todayReport.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                    </Badge>
                  ) : (
                    <Badge className="bg-amber-50 text-amber-700">
                      <Clock size={11} className="inline mr-1" />
                      Not submitted yet
                    </Badge>
                  )}
                  <span className="text-[11px] text-stone-400">{formatDate(today)}</span>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-stone-600 uppercase tracking-wide block mb-1.5">
                      What did you work on today?
                    </label>
                    <textarea
                      rows={6}
                      value={summary}
                      onChange={(e) => setSummary(e.target.value)}
                      placeholder="Edited Reel A, finished poster B, blocked on client feedback for project X..."
                      className="w-full rounded-md border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-400 resize-none"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      label="Hours worked (optional)"
                      type="number"
                      step="0.5"
                      value={hours}
                      onChange={(e) => setHours(e.target.value)}
                      placeholder="8"
                    />
                    <Input
                      label="Blockers (optional)"
                      value={blockers}
                      onChange={(e) => setBlockers(e.target.value)}
                      placeholder="Waiting on script approval"
                    />
                  </div>
                  <Button size="sm" loading={submitting} onClick={handleSubmit}>
                    <Send size={12} /> {todayReport ? 'Update report' : 'Submit report'}
                  </Button>
                </div>
              </div>
            </div>

            {/* Right — My History sidebar */}
            <div className="w-72 border-l border-stone-100 bg-stone-50/40 flex flex-col overflow-hidden">
              <div className="px-4 py-3 border-b border-stone-100 flex items-center gap-2">
                <CalendarDays size={13} className="text-stone-400" />
                <p className="text-xs font-semibold text-stone-700 uppercase tracking-wide">My History</p>
              </div>
              <div className="flex-1 overflow-y-auto divide-y divide-stone-100">
                {myHistory.length === 0 ? (
                  <div className="px-4 py-8 text-center">
                    <p className="text-xs text-stone-400">No past reports yet</p>
                  </div>
                ) : (
                  myHistory.map((r) => (
                    <div key={r.id} className="px-4 py-3">
                      <div className="flex items-center justify-between mb-1.5">
                        <p className="text-[11px] font-semibold text-stone-800">{formatDate(r.date)}</p>
                        {r.hoursWorked != null && (
                          <span className="text-[10px] text-stone-400 bg-stone-100 rounded px-1.5 py-0.5">{r.hoursWorked}h</span>
                        )}
                      </div>
                      <p className="text-[11px] text-stone-600 leading-relaxed line-clamp-3">
                        {r.summary}
                      </p>
                      {r.blockers && (
                        <div className="mt-1.5 flex items-start gap-1 text-[10px] text-amber-700 bg-amber-50 rounded px-1.5 py-1">
                          <AlertCircle size={10} className="mt-0.5 flex-shrink-0" />
                          <span className="line-clamp-2">{r.blockers}</span>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        ) : (
          /* ── Team Status tab (admin) ── */
          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            <div className="bg-white rounded-lg border border-stone-100">
              <div className="px-4 py-3 border-b border-stone-100">
                <p className="text-xs font-semibold text-stone-700 uppercase tracking-wide">
                  Today&apos;s Submissions ({teamStatus.filter((s) => s.submitted).length}/{teamStatus.length})
                </p>
              </div>
              <div className="divide-y divide-stone-50">
                {teamStatus.map((s) => (
                  <div key={s.id} className="px-4 py-3 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-stone-100 flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-bold text-stone-600">{s.name[0]?.toUpperCase()}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-stone-900">{s.name}</p>
                      <p className="text-[10px] text-stone-400">@{s.username} · {s.role}</p>
                    </div>
                    {s.submitted && s.report ? (
                      <div className="flex-1 min-w-0 text-right">
                        <p className="text-[11px] text-stone-700 truncate">{s.report.summary}</p>
                        <p className="text-[10px] text-stone-400">
                          {s.report.hoursWorked ? `${s.report.hoursWorked}h · ` : ''}
                          {new Date(s.report.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    ) : (
                      <Badge className="bg-amber-50 text-amber-700">
                        <Clock size={10} className="inline mr-1" /> Pending
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-lg border border-stone-100">
              <div className="px-4 py-3 border-b border-stone-100">
                <p className="text-xs font-semibold text-stone-700 uppercase tracking-wide">All Recent Reports</p>
              </div>
              <div className="divide-y divide-stone-50">
                {history.length === 0 && (
                  <p className="px-4 py-6 text-xs text-stone-400 text-center">No reports yet</p>
                )}
                {history.slice(0, 30).map((r) => (
                  <div key={r.id} className="px-4 py-3">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-xs font-semibold text-stone-900">{r.owner?.name}</p>
                      <span className="text-[10px] text-stone-400">·</span>
                      <p className="text-[10px] text-stone-400">{formatDate(r.date)}</p>
                      {r.hoursWorked != null && (
                        <>
                          <span className="text-[10px] text-stone-400">·</span>
                          <span className="text-[10px] text-stone-400">{r.hoursWorked}h</span>
                        </>
                      )}
                    </div>
                    <p className="text-xs text-stone-700 leading-relaxed whitespace-pre-wrap">{r.summary}</p>
                    {r.blockers && (
                      <div className="mt-2 flex items-start gap-1.5 text-[11px] text-amber-700 bg-amber-50 rounded px-2 py-1">
                        <AlertCircle size={11} className="mt-0.5 flex-shrink-0" />
                        <span>{r.blockers}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
