'use client'
// src/app/(dashboard)/projects/[id]/page.tsx
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { TopBar } from '@/components/layout/TopBar'
import { useAuthStore } from '@/store/auth.store'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import {
  formatDate,
  PROJECT_STATUS_LABELS,
  projectStatusColor,
  taskStatusColor,
  contentStatusColor,
  KANBAN_STAGE_LABELS,
  kanbanStageColor,
} from '@/lib/utils'
import type {
  Project,
  ProjectStatus,
  Task,
  Content,
  TaskStatus,
  ContentStatus,
  KanbanStage,
} from '@/types'
import { ArrowLeft, CheckSquare, FileVideo, Calendar, User as UserIcon, FolderOpen, CalendarRange, BookMarked } from 'lucide-react'

const SOP_COLORS: Record<number, string> = {
  1: 'bg-blue-100 text-blue-800',
  2: 'bg-violet-100 text-violet-800',
  3: 'bg-amber-100 text-amber-800',
  4: 'bg-red-100 text-red-800',
  5: 'bg-stone-100 text-stone-700',
  6: 'bg-orange-100 text-orange-800',
  7: 'bg-green-100 text-green-800',
}

const SOP_LABELS: Record<number, string> = {
  1: 'L1 · Sales & Onboarding',
  2: 'L2 · PM Setup',
  3: 'L3 · Script Prep',
  4: 'L4 · Script Approval 🔒',
  5: 'L5 · Shoot Logistics',
  6: 'L6 · Shoot Day',
  7: 'L7 · Post-Production',
}

interface ProjectDetail extends Project {
  tasks: Task[]
  content: Content[]
}

export default function ProjectDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const user = useAuthStore((s) => s.user)
  const canSchedule = user?.role === 'ADMIN' || user?.role === 'MANAGER'
  const [project, setProject] = useState<ProjectDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (!params?.id) return
    fetch(`/api/projects/${params.id}`)
      .then((r) => {
        if (r.status === 404) { setNotFound(true); return null }
        return r.json()
      })
      .then((j) => { if (j?.data) setProject(j.data) })
      .finally(() => setLoading(false))
  }, [params?.id])

  if (loading) {
    return (
      <div className="flex flex-col h-full overflow-hidden">
        <TopBar title="Project" />
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div className="bg-white rounded-lg border border-stone-100 p-5">
            <Skeleton className="h-5 w-48 mb-3" />
            <Skeleton className="h-3 w-full mb-2" />
            <Skeleton className="h-3 w-3/4" />
          </div>
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="bg-white rounded-lg border border-stone-100 p-4 space-y-3">
              <Skeleton className="h-3 w-24" />
              {Array.from({ length: 3 }).map((_, j) => (
                <div key={j} className="flex items-center gap-3">
                  <Skeleton className="h-3 flex-1" />
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (notFound || !project) {
    return (
      <div className="flex flex-col h-full overflow-hidden">
        <TopBar title="Project" />
        <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
          <p className="text-sm font-medium text-stone-600">Project not found</p>
          <Button size="sm" variant="secondary" onClick={() => router.push('/projects')}>
            Back to projects
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <TopBar
        title={project.name}
        actions={
          <div className="flex items-center gap-2">
            {canSchedule && (
              <Link
                href="/schedule"
                className="inline-flex items-center gap-1.5 text-xs font-medium text-stone-700 bg-stone-100 hover:bg-stone-200 px-2.5 py-1.5 rounded-md transition-colors"
              >
                <CalendarRange size={12} /> Bulk Schedule
              </Link>
            )}
            <Link
              href="/projects"
              className="inline-flex items-center gap-1 text-xs text-stone-500 hover:text-stone-900 px-2 py-1 rounded hover:bg-stone-100"
            >
              <ArrowLeft size={12} /> All projects
            </Link>
          </div>
        }
      />
      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {/* Project meta */}
        <div className="bg-white rounded-lg border border-stone-100 p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex-1 min-w-0">
              <h2 className="text-base font-semibold text-stone-900 mb-1">{project.name}</h2>
              {project.description && (
                <p className="text-xs text-stone-500 leading-relaxed">{project.description}</p>
              )}
            </div>
            <div className="flex flex-col items-end gap-1.5">
              <Badge className={projectStatusColor(project.status)}>
                {PROJECT_STATUS_LABELS[project.status as ProjectStatus]}
              </Badge>
              {project.boardColumn && (
                <Badge className={kanbanStageColor(project.boardColumn as KanbanStage)}>
                  {KANBAN_STAGE_LABELS[project.boardColumn as KanbanStage]}
                </Badge>
              )}
            </div>
          </div>

          {project.driveFolder && (
            <a
              href={project.driveFolder}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 mt-3 px-2.5 py-1.5 rounded-md bg-stone-50 hover:bg-stone-100 border border-stone-200 text-xs font-medium text-stone-700 hover:text-stone-900 transition-colors"
            >
              <FolderOpen size={12} /> Open Drive folder
            </a>
          )}

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4 pt-3 border-t border-stone-50">
            <MetaCell icon={<UserIcon size={11} />} label="Client" value={project.client?.name ?? '—'} />
            <MetaCell icon={<Calendar size={11} />} label="Start" value={project.startDate ? formatDate(project.startDate) : '—'} />
            <MetaCell icon={<Calendar size={11} />} label="Due" value={project.dueDate ? formatDate(project.dueDate) : '—'} />
            <MetaCell
              icon={<CheckSquare size={11} />}
              label="Activity"
              value={`${project.tasks.length} tasks · ${project.content.length} content`}
            />
            {project.sopLevel != null && (
              <div className="col-span-2 md:col-span-4">
                <div className="flex items-center gap-1 text-[10px] font-medium text-stone-400 uppercase tracking-wide mb-1">
                  <BookMarked size={11} /> SOP Level
                </div>
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-md inline-block ${SOP_COLORS[project.sopLevel]}`}>
                  {SOP_LABELS[project.sopLevel] ?? `Level ${project.sopLevel}`}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Tasks */}
        <Section title="Tasks" icon={<CheckSquare size={13} />} count={project.tasks.length} empty="No tasks on this project yet">
          {project.tasks.map((t) => (
            <div key={t.id} className="flex items-center gap-3 px-4 py-3 hover:bg-stone-50/50">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-stone-900 truncate">{t.title}</p>
                <div className="flex items-center gap-2 text-[10px] text-stone-400 mt-0.5">
                  {t.assignedTo && <span>{t.assignedTo.name}</span>}
                  {t.deadline && (<><span>•</span><span>Due {formatDate(t.deadline)}</span></>)}
                </div>
              </div>
              <Badge className={taskStatusColor(t.status as TaskStatus)}>{t.status.replace('_', ' ')}</Badge>
            </div>
          ))}
        </Section>

        {/* Content */}
        <Section title="Content" icon={<FileVideo size={13} />} count={project.content.length} empty="No content on this project yet">
          {project.content.map((c) => (
            <div key={c.id} className="flex items-center gap-3 px-4 py-3 hover:bg-stone-50/50">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-stone-900 truncate">{c.title}</p>
                <div className="flex items-center gap-2 text-[10px] text-stone-400 mt-0.5">
                  <span>{c.type}</span>
                  {c.assignee && (<><span>•</span><span>{c.assignee.name}</span></>)}
                  {c.postDate && (<><span>•</span><span>{formatDate(c.postDate)}</span></>)}
                </div>
              </div>
              <Badge className={contentStatusColor(c.status as ContentStatus)}>{c.status}</Badge>
            </div>
          ))}
        </Section>
      </div>
    </div>
  )
}

function MetaCell({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div>
      <div className="flex items-center gap-1 text-[10px] font-medium text-stone-400 uppercase tracking-wide">{icon} {label}</div>
      <p className="text-xs font-medium text-stone-900 mt-0.5 truncate">{value}</p>
    </div>
  )
}

function Section({ title, icon, count, empty, children }: {
  title: string; icon: React.ReactNode; count: number; empty: string; children: React.ReactNode
}) {
  return (
    <div className="bg-white rounded-lg border border-stone-100 shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-stone-100 flex items-center justify-between">
        <p className="text-xs font-semibold text-stone-700 uppercase tracking-wider flex items-center gap-1.5">{icon}{title}</p>
        <p className="text-[10px] text-stone-400">{count}</p>
      </div>
      {count === 0
        ? <p className="text-xs text-stone-400 text-center py-8">{empty}</p>
        : <div className="divide-y divide-stone-50">{children}</div>
      }
    </div>
  )
}
