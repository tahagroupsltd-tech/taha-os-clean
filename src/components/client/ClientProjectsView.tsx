'use client'
// src/components/client/ClientProjectsView.tsx
import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import {
  Folder, ArrowRight, Clock, CheckCircle2, AlertCircle, Loader2,
  IndianRupee, Calendar, Star, Film, TrendingUp,
} from 'lucide-react'
import { formatMoney, formatDate, projectStatusColor } from '@/lib/utils'

const SOP_STAGE_LABELS: Record<number, string> = {
  1: 'Onboarding',
  2: 'Project Setup',
  3: 'Script Prep',
  4: 'Script Approval',
  5: 'Shoot Logistics',
  6: 'Shoot Day',
  7: 'Post-Production',
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
  taskCount?: number
  contentCount?: number
  tasks?: { status: string }[]
  content?: ContentItem[]
}

// Compute this-month content stats for a single project
function useContentStats(content: ContentItem[] | undefined) {
  return useMemo(() => {
    if (!content?.length) return null
    const now = new Date()
    const y = now.getFullYear(), m = now.getMonth()

    const isVideo = (c: ContentItem) =>
      !c.type || ['REEL','VIDEO','SHORT','YOUTUBE'].includes(c.type.toUpperCase())

    const monthAll = content.filter(c => {
      if (!c.postDate) return false
      const d = new Date(c.postDate)
      return d.getFullYear() === y && d.getMonth() === m
    })
    const month = monthAll.filter(isVideo).length > 0 ? monthAll.filter(isVideo) : monthAll
    const sorted = [...month].sort((a,b) => new Date(a.postDate!).getTime() - new Date(b.postDate!).getTime())
    const posted = sorted.filter(c => c.status === 'POSTED')
    const upcoming = sorted.filter(c => c.status !== 'POSTED' && new Date(c.postDate!) >= now)
    const needsReview = content.filter(c =>
      ['REVIEW','PENDING_APPROVAL','AWAITING_APPROVAL'].includes(c.status?.toUpperCase?.() ?? '')
    )
    return {
      total: sorted.length,
      posted: posted.length,
      nextUpcoming: upcoming[0] ?? null,
      lastPosted: posted[posted.length - 1] ?? null,
      needsReview: needsReview.length,
    }
  }, [content])
}

function CampaignProgressBar({ sopLevel }: { sopLevel: number | null | undefined }) {
  const level = sopLevel ?? 0
  const steps = [1, 2, 3, 4, 5, 6, 7]
  return (
    <div className="mt-3">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10px] text-stone-400 font-medium uppercase tracking-wide">Campaign Progress</span>
        <span className="text-[10px] font-semibold text-stone-600">
          {level > 0 ? `Stage ${level} — ${SOP_STAGE_LABELS[level] ?? ''}` : 'Not started'}
        </span>
      </div>
      <div className="flex gap-1">
        {steps.map((step) => (
          <div
            key={step}
            className={`flex-1 h-1.5 rounded-full transition-all duration-500 ${
              step < level
                ? 'bg-emerald-400'
                : step === level
                ? 'bg-indigo-500'
                : 'bg-stone-200'
            }`}
          />
        ))}
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const colorMap: Record<string, string> = {
    ACTIVE: 'bg-green-100 text-green-700',
    DELIVERED: 'bg-blue-100 text-blue-700',
    CLOSED: 'bg-stone-100 text-stone-600',
    ON_HOLD: 'bg-amber-100 text-amber-700',
    CANCELLED: 'bg-red-100 text-red-600',
    LEAD: 'bg-purple-100 text-purple-700',
  }
  const label: Record<string, string> = {
    ACTIVE: 'Active',
    DELIVERED: 'Delivered',
    CLOSED: 'Closed',
    ON_HOLD: 'On Hold',
    CANCELLED: 'Cancelled',
    LEAD: 'New',
  }
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${colorMap[status] ?? 'bg-stone-100 text-stone-600'}`}>
      {label[status] ?? status}
    </span>
  )
}

const MONTH_NAME = new Date().toLocaleString('default', { month: 'long' })

function ProjectCard({ project }: { project: ClientProject }) {
  const stats = useContentStats(project.content)
  const completedTasks = project.tasks?.filter(t => t.status === 'DONE').length ?? 0
  const totalTasks = project.tasks?.length ?? 0

  return (
    <Link
      href={`/projects/${project.id}`}
      className="bg-white border border-stone-100 rounded-2xl p-5 hover:border-indigo-200 hover:shadow-md transition-all duration-200 group block"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-100 to-violet-100 flex items-center justify-center flex-shrink-0">
            <Star size={16} className="text-indigo-600" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-stone-900 truncate group-hover:text-indigo-700 transition-colors">
              {project.name}
            </p>
            {project.description && (
              <p className="text-[11px] text-stone-400 truncate mt-0.5">{project.description}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 ml-2">
          <StatusBadge status={project.status} />
          <ArrowRight size={14} className="text-stone-300 group-hover:text-indigo-500 group-hover:translate-x-0.5 transition-all" />
        </div>
      </div>

      {/* Campaign progress */}
      <CampaignProgressBar sopLevel={project.sopLevel} />

      {/* ── This Month's Content mini-widget ── */}
      {stats && stats.total > 0 && (
        <div className="mt-3 pt-3 border-t border-stone-50 space-y-2">
          {/* Review alert */}
          {stats.needsReview > 0 && (
            <div className="flex items-center gap-1.5 text-[10px] font-semibold text-amber-600 bg-amber-50 border border-amber-100 rounded-lg px-2.5 py-1.5">
              <AlertCircle size={10} className="flex-shrink-0" />
              {stats.needsReview} item{stats.needsReview > 1 ? 's' : ''} waiting for your review
            </div>
          )}

          {/* Progress row */}
          <div className="flex items-center gap-2">
            <Film size={10} className="text-rose-400 flex-shrink-0" />
            <span className="text-[10px] font-semibold text-stone-500 uppercase tracking-wide">{MONTH_NAME}</span>
            <div className="flex-1 bg-stone-100 rounded-full h-1.5 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-rose-400 to-pink-500 rounded-full transition-all duration-700"
                style={{ width: `${Math.round((stats.posted / stats.total) * 100)}%` }}
              />
            </div>
            <span className="text-[10px] font-bold text-stone-600 flex-shrink-0">
              {stats.posted}/{stats.total}
            </span>
          </div>

          {/* Next / latest row */}
          <div className="flex items-center gap-3 text-[10px] text-stone-400">
            {stats.lastPosted && (
              <span className="flex items-center gap-1">
                <CheckCircle2 size={9} className="text-green-500" />
                Latest: <span className="font-medium text-stone-600">{formatDate(stats.lastPosted.postDate!)}</span>
              </span>
            )}
            {stats.nextUpcoming && (
              <span className="flex items-center gap-1">
                <Calendar size={9} className="text-blue-400" />
                Next: <span className="font-medium text-stone-600">{formatDate(stats.nextUpcoming.postDate!)}</span>
              </span>
            )}
          </div>
        </div>
      )}

      {/* Footer meta */}
      <div className="flex items-center gap-4 mt-3 pt-3 border-t border-stone-50">
        {project.dueDate && (
          <div className="flex items-center gap-1 text-[10px] text-stone-400">
            <Calendar size={10} />
            <span>Due {formatDate(project.dueDate)}</span>
          </div>
        )}
        {totalTasks > 0 && (
          <div className="flex items-center gap-1 text-[10px] text-stone-400">
            <CheckCircle2 size={10} />
            <span>{completedTasks}/{totalTasks} tasks</span>
          </div>
        )}
        {project.value && (
          <div className="flex items-center gap-1 text-[10px] text-stone-400 ml-auto">
            <IndianRupee size={10} />
            <span className="font-semibold text-stone-600">{formatMoney(project.value)}</span>
          </div>
        )}
      </div>
    </Link>
  )
}

export function ClientProjectsView() {
  const [projects, setProjects] = useState<ClientProject[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/projects')
      .then((r) => r.json())
      .then((j) => {
        setProjects(j.data ?? [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const activeCount = projects.filter((p) => p.status === 'ACTIVE').length

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full py-24">
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={28} className="animate-spin text-indigo-400" />
          <p className="text-sm text-stone-400">Loading your projects…</p>
        </div>
      </div>
    )
  }

  if (projects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-24 text-center gap-4">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-50 to-violet-50 flex items-center justify-center">
          <Folder size={28} className="text-indigo-400" />
        </div>
        <div>
          <p className="text-base font-semibold text-stone-700 mb-1">No projects yet</p>
          <p className="text-sm text-stone-400 max-w-xs">
            Your campaigns will appear here once your team sets them up. Reach out to your project manager to get started.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header summary */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div className="bg-gradient-to-br from-indigo-50 to-violet-50 border border-indigo-100 rounded-xl p-4">
          <p className="text-[10px] font-semibold text-indigo-600 uppercase tracking-wider mb-1">Active Campaigns</p>
          <p className="text-2xl font-bold text-indigo-800">{activeCount}</p>
        </div>
        <div className="bg-gradient-to-br from-emerald-50 to-green-50 border border-emerald-100 rounded-xl p-4">
          <p className="text-[10px] font-semibold text-emerald-600 uppercase tracking-wider mb-1">Total Projects</p>
          <p className="text-2xl font-bold text-emerald-800">{projects.length}</p>
        </div>
        <div className="bg-white border border-stone-100 rounded-xl p-4 md:col-span-1 col-span-2">
          <p className="text-[10px] font-semibold text-stone-500 uppercase tracking-wider mb-1">Status</p>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <p className="text-sm font-semibold text-stone-700">All systems active</p>
          </div>
        </div>
      </div>

      {/* Project cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {projects.map((project) => (
          <ProjectCard key={project.id} project={project} />
        ))}
      </div>
    </div>
  )
}
