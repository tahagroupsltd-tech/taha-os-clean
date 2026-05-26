'use client'
// src/components/client/ClientProjectDetail.tsx
import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft, FolderOpen, CheckCircle2, Clock, ExternalLink,
  MessageSquarePlus, Send, ChevronRight, IndianRupee,
  Star, Loader2, Film, Calendar, AlertCircle, TrendingUp,
} from 'lucide-react'
import { formatMoney, formatDate } from '@/lib/utils'
import toast from 'react-hot-toast'

interface DriveLink { id: string; label: string; url: string }

function parseDriveLinks(raw: string | null | undefined): DriveLink[] {
  if (!raw) return []
  const trimmed = raw.trim()
  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed)
      if (Array.isArray(parsed)) {
        return parsed
          .map((item: any, index: number) => ({
            id: item.id || `link-${index}`,
            label: item.label || 'Drive Folder',
            url: item.url || '',
          }))
          .filter((item) => item.url)
      }
    } catch (e) {
      // JSON parse failed — raw string fallback handles it below
      console.warn('[parseDriveLinks] invalid JSON:', e)
    }
  }
  if (trimmed) return [{ id: 'default', label: 'Main Drive Folder', url: trimmed }]
  return []
}

const SOP_STAGES = [
  { level: 1, label: 'Onboarding',        desc: 'Contracts & requirements signed' },
  { level: 2, label: 'Project Setup',     desc: 'Team assigned, timeline fixed' },
  { level: 3, label: 'Script Prep',       desc: 'Scriptwriting & research' },
  { level: 4, label: 'Script Approval',   desc: 'Your review & sign-off required' },
  { level: 5, label: 'Shoot Logistics',   desc: 'Location, talent, equipment' },
  { level: 6, label: 'Shoot Day',         desc: 'On-location filming' },
  { level: 7, label: 'Post-Production',   desc: 'Editing, colour, delivery' },
]

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Active', DELIVERED: 'Delivered', CLOSED: 'Closed',
  ON_HOLD: 'On Hold', CANCELLED: 'Cancelled', LEAD: 'New Lead',
}
const STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-700 border-green-200',
  DELIVERED: 'bg-blue-100 text-blue-700 border-blue-200',
  CLOSED: 'bg-stone-100 text-stone-600 border-stone-200',
  ON_HOLD: 'bg-amber-100 text-amber-700 border-amber-200',
  CANCELLED: 'bg-red-100 text-red-600 border-red-200',
  LEAD: 'bg-violet-100 text-violet-700 border-violet-200',
}

interface ContentItem {
  id: string
  title: string
  status: string
  type?: string | null
  postDate?: string | null
}

interface ClientProject {
  id: string
  name: string
  description?: string | null
  status: string
  sopLevel?: number | null
  startDate?: string | null
  dueDate?: string | null
  value?: number | null
  driveFolder?: string | null
  tasks?: { id: string; title: string; status: string }[]
  content?: ContentItem[]
}

export function ClientProjectDetail({ project }: { project: ClientProject }) {
  const router = useRouter()
  const currentLevel = project.sopLevel ?? 0
  const driveLinks = parseDriveLinks(project.driveFolder)

  const [requestText, setRequestText] = useState('')
  const [sending, setSending] = useState(false)

  const completedTasks = project.tasks?.filter((t) => t.status === 'DONE').length ?? 0
  const totalTasks = project.tasks?.length ?? 0
  const progressPct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0

  // ─── Content analysis for "This Month's Content" section ───────────────────
  const contentStats = useMemo(() => {
    const allContent = project.content ?? []
    const now = new Date()
    const year = now.getFullYear()
    const month = now.getMonth()

    const isVideo = (c: ContentItem) =>
      !c.type || ['REEL', 'VIDEO', 'SHORT', 'YOUTUBE'].includes(c.type.toUpperCase())

    const thisMonthAll = allContent.filter((c) => {
      if (!c.postDate) return false
      const d = new Date(c.postDate)
      return d.getFullYear() === year && d.getMonth() === month
    })

    // Prefer video types; fall back to all content if no videos
    const thisMonth = thisMonthAll.filter(isVideo).length > 0
      ? thisMonthAll.filter(isVideo)
      : thisMonthAll

    // Sort by postDate ascending
    const sorted = [...thisMonth].sort(
      (a, b) => new Date(a.postDate!).getTime() - new Date(b.postDate!).getTime()
    )

    const posted = sorted.filter((c) => c.status === 'POSTED')
    const upcoming = sorted.filter(
      (c) => c.status !== 'POSTED' && new Date(c.postDate!) >= now
    )

    // Items needing client attention
    const needsReview = allContent.filter((c) =>
      ['REVIEW', 'PENDING_APPROVAL', 'AWAITING_APPROVAL'].includes(c.status?.toUpperCase?.() ?? '')
    )

    return {
      thisMonth: sorted,
      posted,
      upcoming,
      needsReview,
      firstPosted: posted[0] ?? null,
      lastPosted: posted[posted.length - 1] ?? null,
      nextUpcoming: upcoming[0] ?? null,
      lastOfMonth: upcoming[upcoming.length - 1] ?? null,
      totalAllTime: allContent.filter(isVideo).length,
    }
  }, [project.content])

  const MONTH_NAME = new Date().toLocaleString('default', { month: 'long' })
  // ────────────────────────────────────────────────────────────────────────────

  const sendRequest = async () => {
    if (!requestText.trim()) return
    setSending(true)
    try {
      const res = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: `[CLIENT REQUEST] ${requestText.trim()}`,
          projectId: project.id,
        }),
      })
      if (!res.ok) throw new Error()
      toast.success('Request sent to your project manager!')
      setRequestText('')
    } catch {
      toast.error('Could not send request. Please try again.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="flex flex-col h-full overflow-hidden bg-stone-50">
      {/* Header */}
      <div className="bg-white border-b border-stone-100 px-5 py-4 flex-shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/projects')}
            className="flex items-center gap-1 text-xs text-stone-400 hover:text-stone-700 transition-colors"
          >
            <ArrowLeft size={13} />
            All Projects
          </button>
          <ChevronRight size={12} className="text-stone-300" />
          <span className="text-xs text-stone-600 font-medium truncate">{project.name}</span>
          <span className={`ml-auto text-[10px] font-semibold px-2.5 py-0.5 rounded-full border ${STATUS_COLORS[project.status] ?? 'bg-stone-100 text-stone-600 border-stone-200'}`}>
            {STATUS_LABELS[project.status] ?? project.status}
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto p-5 space-y-5">
          {/* Hero card */}
          <div className="bg-white rounded-2xl border border-stone-100 shadow-sm p-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-100 to-violet-100 flex items-center justify-center flex-shrink-0">
                <Star size={20} className="text-indigo-600" />
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="text-lg font-bold text-stone-900 mb-1">{project.name}</h1>
                {project.description && (
                  <p className="text-sm text-stone-500 leading-relaxed">{project.description}</p>
                )}
                <div className="flex flex-wrap items-center gap-4 mt-3 text-[11px] text-stone-400">
                  {project.startDate && (
                    <span>Started {formatDate(project.startDate)}</span>
                  )}
                  {project.dueDate && (
                    <span>Due {formatDate(project.dueDate)}</span>
                  )}
                  {project.value && (
                    <span className="flex items-center gap-0.5 font-semibold text-stone-600">
                      <IndianRupee size={10} />
                      {formatMoney(project.value)} contract
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Task progress bar */}
            {totalTasks > 0 && (
              <div className="mt-5 pt-5 border-t border-stone-50">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-semibold text-stone-500 uppercase tracking-wide">Overall Progress</span>
                  <span className="text-[11px] font-bold text-stone-700">{progressPct}%</span>
                </div>
                <div className="w-full bg-stone-100 rounded-full h-2 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full transition-all duration-700"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
                <p className="text-[10px] text-stone-400 mt-1">{completedTasks} of {totalTasks} tasks completed</p>
              </div>
            )}
          </div>

          {/* Campaign Timeline */}
          <div className="bg-white rounded-2xl border border-stone-100 shadow-sm p-6">
            <div className="flex items-center gap-2 mb-5">
              <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center">
                <Clock size={14} className="text-indigo-600" />
              </div>
              <div>
                <p className="text-sm font-bold text-stone-900">Campaign Timeline</p>
                <p className="text-[10px] text-stone-400">Where your project is right now</p>
              </div>
            </div>

            <div className="relative">
              {/* Vertical connector line */}
              <div className="absolute left-[18px] top-6 bottom-6 w-0.5 bg-stone-100" />

              <div className="space-y-4">
                {SOP_STAGES.map((stage) => {
                  const isDone = stage.level < currentLevel
                  const isCurrent = stage.level === currentLevel
                  const isUpcoming = stage.level > currentLevel
                  return (
                    <div key={stage.level} className={`flex items-start gap-4 relative ${isUpcoming ? 'opacity-40' : ''}`}>
                      {/* Node */}
                      <div className={`relative z-10 w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
                        isDone
                          ? 'bg-emerald-500 shadow-sm'
                          : isCurrent
                          ? 'bg-indigo-600 shadow-md ring-4 ring-indigo-100'
                          : 'bg-stone-200'
                      }`}>
                        {isDone ? (
                          <CheckCircle2 size={16} className="text-white" />
                        ) : isCurrent ? (
                          <div className="w-2.5 h-2.5 rounded-full bg-white animate-pulse" />
                        ) : (
                          <span className="text-[10px] font-bold text-stone-500">{stage.level}</span>
                        )}
                      </div>

                      {/* Content */}
                      <div className={`flex-1 pb-1 ${isCurrent ? 'bg-indigo-50 border border-indigo-100 rounded-xl p-3 -ml-1' : ''}`}>
                        <div className="flex items-center gap-2">
                          <p className={`text-sm font-semibold ${
                            isDone ? 'text-emerald-700' : isCurrent ? 'text-indigo-800' : 'text-stone-500'
                          }`}>
                            {stage.label}
                          </p>
                          {isCurrent && (
                            <span className="text-[9px] font-bold bg-indigo-600 text-white px-2 py-0.5 rounded-full uppercase tracking-wide">
                              Current Stage
                            </span>
                          )}
                          {isDone && (
                            <span className="text-[9px] font-bold text-emerald-600 uppercase tracking-wide">✓ Done</span>
                          )}
                        </div>
                        <p className={`text-[11px] mt-0.5 ${isCurrent ? 'text-indigo-600' : 'text-stone-400'}`}>
                          {stage.desc}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* ── This Month's Content ─────────────────────────────────────────── */}
          {contentStats.thisMonth.length > 0 || contentStats.needsReview.length > 0 ? (
            <div className="bg-white rounded-2xl border border-stone-100 shadow-sm p-6 space-y-5">
              {/* Header */}
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-rose-50 flex items-center justify-center">
                  <Film size={14} className="text-rose-500" />
                </div>
                <div>
                  <p className="text-sm font-bold text-stone-900">{MONTH_NAME}'s Content</p>
                  <p className="text-[10px] text-stone-400">Your video schedule for this month</p>
                </div>
                {contentStats.totalAllTime > 0 && (
                  <span className="ml-auto text-[10px] text-stone-400 font-medium">
                    {contentStats.totalAllTime} videos all time
                  </span>
                )}
              </div>

              {/* Needs-review alert */}
              {contentStats.needsReview.length > 0 && (
                <div className="flex items-start gap-2.5 rounded-xl bg-amber-50 border border-amber-200 px-3.5 py-3">
                  <AlertCircle size={14} className="text-amber-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-amber-800">
                      {contentStats.needsReview.length} item{contentStats.needsReview.length > 1 ? 's' : ''} waiting for your review
                    </p>
                    <p className="text-[10px] text-amber-600 mt-0.5">
                      {contentStats.needsReview.map(c => c.title).join(', ')}
                    </p>
                  </div>
                </div>
              )}

              {contentStats.thisMonth.length > 0 && (
                <>
                  {/* Progress bar */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-semibold text-stone-500 uppercase tracking-wide">Posted this month</span>
                      <span className="text-[11px] font-bold text-stone-700">
                        {contentStats.posted.length} / {contentStats.thisMonth.length}
                      </span>
                    </div>
                    <div className="w-full bg-stone-100 rounded-full h-2 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-rose-400 to-pink-500 rounded-full transition-all duration-700"
                        style={{
                          width: contentStats.thisMonth.length > 0
                            ? `${Math.round((contentStats.posted.length / contentStats.thisMonth.length) * 100)}%`
                            : '0%'
                        }}
                      />
                    </div>
                    <p className="text-[10px] text-stone-400 mt-1">
                      {contentStats.upcoming.length > 0
                        ? `${contentStats.upcoming.length} more scheduled`
                        : contentStats.posted.length === contentStats.thisMonth.length
                        ? '🎉 All videos posted!'
                        : 'Dates pending'}
                    </p>
                  </div>

                  {/* Key milestone cards */}
                  <div className="grid grid-cols-2 gap-2.5">
                    {/* First video */}
                    <div className={`rounded-xl border p-3 ${contentStats.firstPosted ? 'border-green-100 bg-green-50/60' : 'border-stone-100 bg-stone-50 opacity-50'}`}>
                      <p className="text-[9px] font-bold uppercase tracking-wider text-green-600 mb-1 flex items-center gap-1">
                        <CheckCircle2 size={9} /> First video posted
                      </p>
                      {contentStats.firstPosted ? (
                        <>
                          <p className="text-xs font-semibold text-stone-800 leading-snug truncate">{contentStats.firstPosted.title}</p>
                          <p className="text-[10px] text-stone-500 mt-0.5">{formatDate(contentStats.firstPosted.postDate!)}</p>
                        </>
                      ) : (
                        <p className="text-xs text-stone-400">None yet</p>
                      )}
                    </div>

                    {/* Latest posted */}
                    <div className={`rounded-xl border p-3 ${contentStats.lastPosted ? 'border-emerald-100 bg-emerald-50/60' : 'border-stone-100 bg-stone-50 opacity-50'}`}>
                      <p className="text-[9px] font-bold uppercase tracking-wider text-emerald-600 mb-1 flex items-center gap-1">
                        <TrendingUp size={9} /> Latest posted
                      </p>
                      {contentStats.lastPosted && contentStats.lastPosted.id !== contentStats.firstPosted?.id ? (
                        <>
                          <p className="text-xs font-semibold text-stone-800 leading-snug truncate">{contentStats.lastPosted.title}</p>
                          <p className="text-[10px] text-stone-500 mt-0.5">{formatDate(contentStats.lastPosted.postDate!)}</p>
                        </>
                      ) : contentStats.lastPosted ? (
                        <>
                          <p className="text-xs font-semibold text-stone-800 leading-snug truncate">{contentStats.lastPosted.title}</p>
                          <p className="text-[10px] text-stone-500 mt-0.5">{formatDate(contentStats.lastPosted.postDate!)}</p>
                        </>
                      ) : (
                        <p className="text-xs text-stone-400">None yet</p>
                      )}
                    </div>

                    {/* Next to go live */}
                    <div className={`rounded-xl border p-3 ${contentStats.nextUpcoming ? 'border-blue-100 bg-blue-50/60' : 'border-stone-100 bg-stone-50 opacity-50'}`}>
                      <p className="text-[9px] font-bold uppercase tracking-wider text-blue-500 mb-1 flex items-center gap-1">
                        <Calendar size={9} /> Next to go live
                      </p>
                      {contentStats.nextUpcoming ? (
                        <>
                          <p className="text-xs font-semibold text-stone-800 leading-snug truncate">{contentStats.nextUpcoming.title}</p>
                          <p className="text-[10px] text-stone-500 mt-0.5">{formatDate(contentStats.nextUpcoming.postDate!)}</p>
                        </>
                      ) : (
                        <p className="text-xs text-stone-400">All done!</p>
                      )}
                    </div>

                    {/* Last video of month */}
                    <div className={`rounded-xl border p-3 ${contentStats.lastOfMonth ? 'border-violet-100 bg-violet-50/60' : 'border-stone-100 bg-stone-50 opacity-50'}`}>
                      <p className="text-[9px] font-bold uppercase tracking-wider text-violet-500 mb-1 flex items-center gap-1">
                        <Film size={9} /> Last of {MONTH_NAME}
                      </p>
                      {contentStats.lastOfMonth ? (
                        <>
                          <p className="text-xs font-semibold text-stone-800 leading-snug truncate">{contentStats.lastOfMonth.title}</p>
                          <p className="text-[10px] text-stone-500 mt-0.5">{formatDate(contentStats.lastOfMonth.postDate!)}</p>
                        </>
                      ) : contentStats.lastPosted ? (
                        <>
                          <p className="text-xs font-semibold text-stone-800 leading-snug truncate">{contentStats.lastPosted.title}</p>
                          <p className="text-[10px] text-stone-500 mt-0.5">{formatDate(contentStats.lastPosted.postDate!)}</p>
                        </>
                      ) : (
                        <p className="text-xs text-stone-400">TBD</p>
                      )}
                    </div>
                  </div>

                  {/* Full month timeline list */}
                  <div>
                    <p className="text-[10px] font-semibold text-stone-400 uppercase tracking-wider mb-2">All {MONTH_NAME} content</p>
                    <div className="space-y-1.5">
                      {contentStats.thisMonth.map((item) => {
                        const isPosted = item.status === 'POSTED'
                        const isPast = item.postDate ? new Date(item.postDate) < new Date() : false
                        return (
                          <div key={item.id} className={`flex items-center gap-2.5 rounded-lg px-3 py-2 ${
                            isPosted ? 'bg-green-50 border border-green-100' : 'bg-stone-50 border border-stone-100'
                          }`}>
                            <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
                              isPosted ? 'bg-green-500' : isPast ? 'bg-amber-400' : 'bg-stone-200'
                            }`}>
                              {isPosted ? (
                                <CheckCircle2 size={11} className="text-white" />
                              ) : (
                                <div className="w-1.5 h-1.5 rounded-full bg-white" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={`text-xs font-medium truncate ${isPosted ? 'text-stone-700' : 'text-stone-600'}`}>
                                {item.title}
                              </p>
                            </div>
                            <span className="text-[10px] text-stone-400 flex-shrink-0">
                              {item.postDate ? formatDate(item.postDate) : '—'}
                            </span>
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 ${
                              isPosted
                                ? 'bg-green-100 text-green-700'
                                : isPast
                                ? 'bg-amber-100 text-amber-700'
                                : 'bg-blue-50 text-blue-500'
                            }`}>
                              {isPosted ? 'Live' : isPast ? 'Late' : 'Sched.'}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>
          ) : null}

          {/* Drive Links */}
          {driveLinks.length > 0 && (
            <div className="bg-white rounded-2xl border border-stone-100 shadow-sm p-6">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center">
                  <FolderOpen size={14} className="text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-bold text-stone-900">Your Asset Folders</p>
                  <p className="text-[10px] text-stone-400">Scripts, footage, final deliverables</p>
                </div>
              </div>
              <div className="space-y-2">
                {driveLinks.map((link) => (
                  <a
                    key={link.id}
                    href={link.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-3 p-3 rounded-xl border border-stone-100 hover:border-blue-200 hover:bg-blue-50/50 transition-all group"
                  >
                    <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                      <FolderOpen size={14} className="text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-stone-800 group-hover:text-blue-700">{link.label}</p>
                      <p className="text-[10px] text-stone-400 truncate">{link.url}</p>
                    </div>
                    <ExternalLink size={13} className="text-stone-300 group-hover:text-blue-500 flex-shrink-0" />
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Request / Feedback Panel */}
          <div className="bg-white rounded-2xl border border-stone-100 shadow-sm p-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-7 h-7 rounded-lg bg-violet-50 flex items-center justify-center">
                <MessageSquarePlus size={14} className="text-violet-600" />
              </div>
              <div>
                <p className="text-sm font-bold text-stone-900">Request / Feedback</p>
                <p className="text-[10px] text-stone-400">Send a message directly to your project manager</p>
              </div>
            </div>
            <textarea
              value={requestText}
              onChange={(e) => setRequestText(e.target.value)}
              placeholder="e.g. Please revise the script intro, or I'd like to schedule a review call..."
              rows={3}
              className="w-full text-sm border border-stone-200 rounded-xl px-4 py-3 text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none bg-stone-50/50"
            />
            <div className="flex items-center justify-between mt-3">
              <p className="text-[10px] text-stone-400">Your manager will be notified immediately.</p>
              <button
                onClick={sendRequest}
                disabled={sending || !requestText.trim()}
                className="flex items-center gap-2 bg-indigo-600 text-white text-xs font-semibold px-4 py-2 rounded-xl hover:bg-indigo-700 disabled:opacity-40 transition-colors"
              >
                {sending ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                {sending ? 'Sending…' : 'Send Request'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
