'use client'
// src/app/(dashboard)/sop/page.tsx
import { useState, useEffect, useCallback } from 'react'
import { TopBar } from '@/components/layout/TopBar'
import { useAuthStore } from '@/store/auth.store'
import { cn } from '@/lib/utils'
import { CheckCircle2, Circle, ChevronDown, ChevronRight, AlertTriangle, RefreshCw, Lock } from 'lucide-react'
import toast from 'react-hot-toast'

// ─── SOP Data ────────────────────────────────────────────────────────────────
interface Step {
  key: string
  label: string
  note?: string
}
interface Level {
  id: number
  icon: string
  title: string
  subtitle: string
  color: string          // bg color for header
  textColor: string      // text on header
  badgeLabel: string
  isHardGate?: boolean
  steps: Step[]
  callout?: string
}

const SOP_LEVELS: Level[] = [
  {
    id: 1, icon: '🛒',
    title: 'L1 — Sales & Onboarding', subtitle: 'Owner: Sales team',
    color: 'bg-blue-600', textColor: 'text-white', badgeLabel: 'SALES',
    callout: '➡️ Pass complete project details to PM to unlock Level 2.',
    steps: [
      { key: 'quotation',    label: 'Share quotation with client' },
      { key: 'mou',          label: 'Get MOU / agreement confirmed' },
      { key: 'payment',      label: 'Collect advance / full payment' },
      { key: 'requirement',  label: 'Conduct requirement discussion' },
      { key: 'onboarding',   label: 'Complete client onboarding' },
      { key: 'brand_details',label: 'Collect brand details & references from client' },
    ],
  },
  {
    id: 2, icon: '🕸️',
    title: 'L2 — PM Setup', subtitle: 'Owner: Project Manager',
    color: 'bg-violet-600', textColor: 'text-white', badgeLabel: 'PROJECT MANAGER',
    callout: 'PM is the only role active across ALL 7 levels — the thread that holds everything together.',
    steps: [
      { key: 'assign_team',      label: 'Assign core team members to project' },
      { key: 'welcome_client',   label: 'Welcome client — share workflow & timelines' },
      { key: 'brief_script_head',label: 'Brief Script Head & align on project goals' },
    ],
  },
  {
    id: 3, icon: '📝',
    title: 'L3 — Script Preparation', subtitle: 'Owner: Script Team + PM + Client',
    color: 'bg-amber-600', textColor: 'text-white', badgeLabel: 'SCRIPT TEAM',
    callout: '⚠️ Scripts must be completed strictly within the agreed timeline.',
    steps: [
      { key: 'alignment_call',   label: 'Schedule & run alignment call (Client + PM + Script Team)', note: 'Calibrate: brand, audience, goals, tone & style' },
      { key: 'scripts_complete', label: 'Scripts written & ready for review', note: 'Complete within agreed timeline — no exceptions' },
    ],
  },
  {
    id: 4, icon: '🔒',
    title: 'L4 — Script Approval', subtitle: 'Owner: PM schedules; Script Team presents',
    color: 'bg-red-600', textColor: 'text-white', badgeLabel: 'HARD GATE',
    isHardGate: true,
    callout: '🔒 HARD RULE: Final client approval is mandatory before shoot. No exceptions. This is also the perpetual restart point for retainer clients.',
    steps: [
      { key: 'schedule_approval_call', label: 'PM schedules script approval call with client' },
      { key: 'present_scripts',        label: 'Script team presents scripts to client' },
      { key: 'client_feedback',        label: 'Client feedback collected & revisions applied (if any)' },
      { key: 'final_approval',         label: '✅ Final client approval received — Level 5 unlocked', note: 'This is the mandatory gate — nothing proceeds without this' },
    ],
  },
  {
    id: 5, icon: '📅',
    title: 'L5 — Shoot Logistics', subtitle: '⏱️ Must be locked within 48h of script approval',
    color: 'bg-stone-700', textColor: 'text-white', badgeLabel: 'DIRECTOR / PM',
    callout: '✅ All three confirmations required before the shoot can be scheduled.',
    steps: [
      { key: 'confirm_client', label: '🧑‍💼 Confirm CLIENT availability for shoot' },
      { key: 'confirm_studio', label: '🏢 Confirm STUDIO availability for shoot' },
      { key: 'confirm_team',   label: '👥 Confirm TEAM availability for shoot' },
    ],
  },
  {
    id: 6, icon: '🎥',
    title: 'L6 — Shoot Day', subtitle: 'Owner: Director on-set; handoff to PM after',
    color: 'bg-orange-600', textColor: 'text-white', badgeLabel: 'DIRECTOR',
    callout: 'Handoff flows: Director → Cameraman + Data Handler → Project Manager.',
    steps: [
      { key: 'monitor_shoot',    label: 'Execute & monitor the shoot' },
      { key: 'verify_clips',     label: 'Verify approved clips & specific shots on-set' },
      { key: 'log_clips',        label: 'Log final selected clip numbers' },
      { key: 'handoff_data',     label: 'Share clip handling + contacts with Cameraman & Data Handler' },
    ],
  },
  {
    id: 7, icon: '✂️',
    title: 'L7 — Post-Production', subtitle: 'Owner: PM coordinates; Editing team executes',
    color: 'bg-green-700', textColor: 'text-white', badgeLabel: 'EDITING + PM',
    callout: '🔄 Perpetual engine: After delivery, data feeds back into L4. The cycle restarts for the next batch.',
    steps: [
      { key: 'ingest',              label: 'Stage 1 — Ingest: collect raw clips from cameraman' },
      { key: 'cloud_sync',          label: 'Stage 2 — Cloud sync: upload to Google Drive & share access' },
      { key: 'assign_editing',      label: 'Stage 3 — Resource: assign editing schedule' },
      { key: 'monitor_editing',     label: 'Stage 4 — Monitor: track editing progress' },
      { key: 'posting_schedule',    label: 'Stage 5 — Deploy: finalise posting schedule' },
      { key: 'performance_report',  label: 'Stage 6 — Analyse: prepare performance report for client' },
    ],
  },
]

// ─── LevelCard ───────────────────────────────────────────────────────────────
function LevelCard({
  level,
  done,          // set of stepKeys that are checked
  onToggle,      // (stepKey, newValue) => void
  saving,        // stepKey currently being saved
  disabled,
}: {
  level: Level
  done: Set<string>
  onToggle: (stepKey: string, val: boolean) => void
  saving: string | null
  disabled: boolean
}) {
  const [open, setOpen] = useState(true)
  const total = level.steps.length
  const completed = level.steps.filter(s => done.has(s.key)).length
  const isComplete = completed === total
  const pct = total === 0 ? 0 : Math.round((completed / total) * 100)

  return (
    <div className={cn('rounded-xl border overflow-hidden shadow-sm transition-all', isComplete ? 'border-green-300' : 'border-stone-200')}>
      {/* Header */}
      <button
        onClick={() => setOpen(o => !o)}
        className={cn('w-full flex items-center gap-3 px-4 py-3 text-left transition-colors', level.color, level.textColor)}
      >
        <span className="text-xl flex-shrink-0">{level.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-bold">{level.title}</span>
            {level.isHardGate && (
              <span className="flex items-center gap-0.5 text-[9px] font-bold bg-white/20 px-1.5 py-0.5 rounded border border-white/30">
                <Lock size={8} /> HARD GATE
              </span>
            )}
          </div>
          <p className="text-[11px] opacity-75 mt-0.5">{level.subtitle}</p>
        </div>

        {/* Progress badge */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {isComplete ? (
            <span className="flex items-center gap-1 text-[11px] font-bold bg-white/20 px-2 py-1 rounded-full">
              <CheckCircle2 size={12} /> Done
            </span>
          ) : (
            <span className="text-[11px] font-semibold bg-white/20 px-2 py-1 rounded-full">
              {completed}/{total}
            </span>
          )}
          {open ? <ChevronDown size={14} className="opacity-70" /> : <ChevronRight size={14} className="opacity-70" />}
        </div>
      </button>

      {/* Progress bar */}
      <div className="h-1 bg-stone-100">
        <div
          className={cn('h-full transition-all duration-500', isComplete ? 'bg-green-500' : 'bg-stone-400')}
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Steps */}
      {open && (
        <div className="bg-white">
          <ul className="divide-y divide-stone-50">
            {level.steps.map(step => {
              const isChecked = done.has(step.key)
              const isSaving = saving === step.key

              return (
                <li key={step.key}>
                  <label className={cn(
                    'flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors select-none',
                    isChecked ? 'bg-green-50' : 'hover:bg-stone-50',
                    (disabled || isSaving) && 'opacity-60 cursor-not-allowed'
                  )}>
                    <div className="flex-shrink-0 mt-0.5">
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={isChecked}
                        disabled={disabled || isSaving}
                        onChange={e => onToggle(step.key, e.target.checked)}
                      />
                      {isSaving ? (
                        <RefreshCw size={16} className="text-stone-400 animate-spin" />
                      ) : isChecked ? (
                        <CheckCircle2 size={18} className="text-green-600" />
                      ) : (
                        <Circle size={18} className="text-stone-300" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={cn('text-sm leading-snug', isChecked ? 'text-stone-500 line-through' : 'text-stone-900')}>
                        {step.label}
                      </p>
                      {step.note && (
                        <p className="text-[10px] text-stone-400 mt-0.5 leading-snug">{step.note}</p>
                      )}
                    </div>
                  </label>
                </li>
              )
            })}
          </ul>

          {/* Callout */}
          {level.callout && (
            <div className={cn(
              'mx-4 mb-4 mt-1 rounded-lg px-3 py-2.5 text-xs leading-relaxed border',
              level.isHardGate
                ? 'bg-red-50 border-red-200 text-red-800'
                : isComplete
                ? 'bg-green-50 border-green-200 text-green-800'
                : 'bg-stone-50 border-stone-200 text-stone-600'
            )}>
              {level.callout}
            </div>
          )}

          {/* Level complete banner */}
          {isComplete && (
            <div className="mx-4 mb-4 mt-1 rounded-lg bg-green-600 text-white text-xs font-semibold px-3 py-2 flex items-center gap-2">
              <CheckCircle2 size={14} /> Level complete — project sopLevel updated ✓
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function SOPPage() {
  const user = useAuthStore(s => s.user)
  const canEdit = user?.role === 'ADMIN' || user?.role === 'MANAGER' || user?.role === 'EMPLOYEE'

  const [projects, setProjects] = useState<{ id: string; name: string; sopLevel: number | null }[]>([])
  const [selectedProject, setSelectedProject] = useState('')
  const [done, setDone] = useState<Set<string>>(new Set())  // "level:stepKey"
  const [saving, setSaving] = useState<string | null>(null) // "level:stepKey"
  const [loadingProgress, setLoadingProgress] = useState(false)

  // Load projects
  useEffect(() => {
    fetch('/api/projects')
      .then(r => r.json())
      .then(j => {
        const list = j.data ?? []
        setProjects(list)
        if (list.length > 0 && !selectedProject) setSelectedProject(list[0].id)
      })
  }, [])

  // Load progress when project changes
  useEffect(() => {
    if (!selectedProject) return
    setLoadingProgress(true)
    setDone(new Set())
    fetch(`/api/sop/progress?projectId=${selectedProject}`)
      .then(r => r.json())
      .then(j => {
        const rows: { level: number; stepKey: string }[] = j.data ?? []
        setDone(new Set(rows.map(r => `${r.level}:${r.stepKey}`)))
      })
      .finally(() => setLoadingProgress(false))
  }, [selectedProject])

  const toggle = useCallback(async (level: number, stepKey: string, val: boolean) => {
    if (!selectedProject || !canEdit) return
    const key = `${level}:${stepKey}`
    setSaving(key)

    // Optimistic update
    setDone(prev => {
      const next = new Set(prev)
      if (val) next.add(key); else next.delete(key)
      return next
    })

    try {
      const res = await fetch('/api/sop/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: selectedProject, level, stepKey, completed: val }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)

      if (json.levelComplete && val) {
        toast.success(`🎉 L${level} complete! Project stage updated.`, { duration: 4000 })
      }
    } catch (e: any) {
      // Revert on failure
      setDone(prev => {
        const next = new Set(prev)
        if (val) next.delete(key); else next.add(key)
        return next
      })
      toast.error(e.message ?? 'Failed to save')
    } finally {
      setSaving(null)
    }
  }, [selectedProject, canEdit])

  const currentProject = projects.find(p => p.id === selectedProject)
  const totalSteps = SOP_LEVELS.reduce((acc, l) => acc + l.steps.length, 0)
  const completedSteps = done.size
  const overallPct = totalSteps === 0 ? 0 : Math.round((completedSteps / totalSteps) * 100)

  return (
    <div className="flex flex-col h-full overflow-hidden bg-stone-50">
      <TopBar title="SOP Pipeline" />

      <div className="flex-1 overflow-y-auto">
        {/* Project selector bar */}
        <div className="bg-white border-b border-stone-200 px-5 py-3 flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <label className="text-xs font-semibold text-stone-500 flex-shrink-0">Project</label>
            <select
              value={selectedProject}
              onChange={e => setSelectedProject(e.target.value)}
              className="flex-1 min-w-0 text-sm font-medium text-stone-900 bg-stone-50 border border-stone-200 rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-stone-400 max-w-xs"
            >
              {projects.length === 0 && <option>Loading…</option>}
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          {/* Overall progress */}
          {selectedProject && (
            <div className="flex items-center gap-3 flex-shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-28 h-2 bg-stone-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-stone-800 rounded-full transition-all duration-500"
                    style={{ width: `${overallPct}%` }}
                  />
                </div>
                <span className="text-xs font-semibold text-stone-600">{completedSteps}/{totalSteps}</span>
              </div>
              {currentProject?.sopLevel && (
                <span className="text-xs font-bold bg-stone-900 text-white px-2.5 py-1 rounded-full">
                  L{currentProject.sopLevel} active
                </span>
              )}
              {loadingProgress && <RefreshCw size={13} className="text-stone-400 animate-spin" />}
            </div>
          )}
        </div>

        {/* Instructions */}
        {!canEdit && (
          <div className="mx-5 mt-4 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-xs text-amber-800 flex items-center gap-2">
            <AlertTriangle size={13} /> You have view-only access to the SOP pipeline.
          </div>
        )}

        {/* SOP Levels */}
        {selectedProject ? (
          <div className="p-5 space-y-3 max-w-2xl">
            {SOP_LEVELS.map(level => (
              <LevelCard
                key={level.id}
                level={level}
                done={new Set(
                  [...done]
                    .filter(k => k.startsWith(`${level.id}:`))
                    .map(k => k.split(':')[1])
                )}
                onToggle={(stepKey, val) => toggle(level.id, stepKey, val)}
                saving={saving?.startsWith(`${level.id}:`) ? saving.split(':')[1] : null}
                disabled={!canEdit || loadingProgress}
              />
            ))}

            {/* All done banner */}
            {completedSteps === totalSteps && totalSteps > 0 && (
              <div className="rounded-xl bg-green-600 text-white px-5 py-4 text-center shadow-lg">
                <p className="text-xl mb-1">🎬</p>
                <p className="font-bold text-sm">Full SOP cycle complete!</p>
                <p className="text-xs text-green-100 mt-1">
                  Ready to restart from L4 for the next content batch.
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center h-64">
            <p className="text-sm text-stone-400">Select a project to start tracking</p>
          </div>
        )}
      </div>
    </div>
  )
}
