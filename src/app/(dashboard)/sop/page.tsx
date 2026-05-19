'use client'
// src/app/(dashboard)/sop/page.tsx
import { useState, useEffect } from 'react'
import { TopBar } from '@/components/layout/TopBar'
import { useAuthStore } from '@/store/auth.store'
import { cn } from '@/lib/utils'
import { Zap, CheckSquare, Calendar, BookMarked, ChevronRight, AlertTriangle, RefreshCw } from 'lucide-react'
import toast from 'react-hot-toast'

export const metadata = { title: 'SOP Pipeline' }

// ─── Types ────────────────────────────────────────────────────────────────────
interface SopLevel {
  id: number
  icon: string
  title: string
  badge: string
  badgeColor: string
  tabColor: string
  owner: string
  extra?: { label: string; value: string }[]
  sections: { title: string; type: 'checklist' | 'text' | 'flow' | 'grid'; items: string[]; note?: string }[]
  callout?: { type: 'info' | 'warn' | 'danger' | 'green'; text: string }
  isHardGate?: boolean
}

// ─── SOP Data (from official Taha Media SOP HTML) ────────────────────────────
const SOP_LEVELS: SopLevel[] = [
  {
    id: 1, icon: '🛒', title: 'Level 1 — Sales & Onboarding', badge: 'SALES',
    badgeColor: 'bg-blue-100 text-blue-800', tabColor: 'bg-[#1C3F6E]',
    owner: 'Sales team',
    extra: [{ label: 'Hands off to', value: 'Project Manager — complete project details' }],
    sections: [
      { title: '💰 Commercials', type: 'checklist', items: ['Quotation sharing', 'MOU confirmation', 'Advance / full payment collection'] },
      { title: '🧠 Client Intelligence', type: 'checklist', items: ['Requirement discussion', 'Client onboarding', 'Collect client brand details'] },
      { title: '⚡ Creative Fuel', type: 'checklist', items: ['Collect additional notes & references from client'] },
    ],
    callout: { type: 'info', text: '➡️ Next step: Pass complete project details to PM to unlock Level 2.' },
  },
  {
    id: 2, icon: '🕸️', title: 'Level 2 — Central Communication Network', badge: 'PROJECT MANAGER',
    badgeColor: 'bg-violet-100 text-violet-800', tabColor: 'bg-[#6B3A6E]',
    owner: 'Project Manager (central hub)',
    extra: [
      { label: 'Channel', value: 'Messenger — PM acts as central connector' },
      { label: 'Active until', value: 'Level 7 (PM spans the entire lifecycle)' },
    ],
    sections: [
      { title: '🔗 PM Connects To', type: 'checklist', items: ['Core team members (internal)', 'Client — welcome onboard & share workflow/timelines', 'Script Head — brief & align'] },
      { title: '📌 Key Insight', type: 'text', items: ['The Project Manager is the only role active across all 7 levels. Every other department is a specialist node that engages at specific levels. The PM is the thread that holds the chain together.'] },
    ],
  },
  {
    id: 3, icon: '📝', title: 'Level 3 — Strategy & Script Preparation', badge: 'SCRIPT TEAM',
    badgeColor: 'bg-amber-100 text-amber-800', tabColor: 'bg-[#7A5B1C]',
    owner: 'Script Team + PM + Client (alignment call)',
    sections: [
      { title: '📞 The Alignment Call', type: 'checklist', items: ['Schedule GMeet/Call with Client + PM + Script Team', 'Calibrate: Brand identity', 'Calibrate: Target audience behaviour', 'Calibrate: Content goals', 'Calibrate: Tone and style'] },
      { title: '✅ The Output', type: 'checklist', items: ['Script team initiates preparation immediately after the call', '⚠️ Scripts must be completed strictly within the agreed timeline'] },
    ],
    callout: { type: 'warn', text: '⚠️ Strict parameter: Scripts must be completed strictly within the agreed timeline.' },
  },
  {
    id: 4, icon: '🔒', title: 'Level 4 — Gatekeeper: Final Script Approval', badge: 'HARD GATE',
    badgeColor: 'bg-red-100 text-red-800', tabColor: 'bg-[#8B3A1C]',
    owner: 'PM schedules; Script Team presents to Client',
    extra: [{ label: 'Also', value: 'Perpetual restart point for all retainer clients' }],
    isHardGate: true,
    sections: [
      { title: '🔄 Approval Flow', type: 'flow', items: ['PM schedules script approval call', 'Script team presents scripts to client', 'Client reviews → corrections? Script team revises & loops back', '🔓 Final client approval granted → Level 5 unlocked'] },
    ],
    callout: { type: 'danger', text: '🔒 Hard rule: Final client approval is strictly mandatory before shoot planning can commence. No exceptions.' },
  },
  {
    id: 5, icon: '📅', title: 'Level 5 — Shoot Logistics (48-Hour Window)', badge: 'DIRECTOR / PM',
    badgeColor: 'bg-stone-100 text-stone-700', tabColor: 'bg-[#3B3B3B]',
    owner: 'Director + PM',
    extra: [
      { label: 'Constraint', value: 'Must be locked within 1–2 days after script approval' },
      { label: 'Gate condition', value: 'All three availabilities confirmed → finalise shoot schedule' },
    ],
    sections: [
      { title: '✅ Three Confirmations Required', type: 'grid', items: ['🧑‍💼 Confirm CLIENT availability', '🏢 Confirm STUDIO availability', '👥 Confirm TEAM availability'] },
    ],
    callout: { type: 'green', text: '✅ All three confirmed → Finalise the shoot schedule.' },
  },
  {
    id: 6, icon: '🎥', title: 'Level 6 — Shoot Day: Capture & Log', badge: 'DIRECTOR',
    badgeColor: 'bg-orange-100 text-orange-800', tabColor: 'bg-[#8B2828]',
    owner: 'Director on-set; data handoff to PM post-shoot',
    sections: [
      { title: "🎬 Director's On-Set Checklist", type: 'checklist', items: ['Execution: monitor the shoot', 'Verification: verify approved clips & specific shots', 'Logging: note final selected clip numbers'] },
      { title: '📦 Mandatory Data Handoff', type: 'checklist', items: ['Share clip handling + contact details with Cameraman', 'Hand off to Data Handler', 'Share with Editor support (if required)', '↳ Handoff flows to: Project Manager'] },
    ],
  },
  {
    id: 7, icon: '✂️', title: 'Level 7 — Post-Production & Delivery', badge: 'EDITING + PM',
    badgeColor: 'bg-green-100 text-green-800', tabColor: 'bg-[#2E5E3E]',
    owner: 'PM coordinates; Editing team executes',
    extra: [{ label: 'Feeds into', value: 'Level 4 (Script Approval) — perpetual engine restarts' }],
    sections: [
      { title: '🚀 6-Stage Post-Production Pipeline', type: 'grid', items: ['S1 · Ingest — Collect raw clips from cameraman', 'S2 · Cloud sync — Upload to Google Drive & share access', 'S3 · Resource — Assign editing schedule', 'S4 · Monitor — Track editing progress', 'S5 · Deploy — Finalise posting schedule', 'S6 · Analyse — Prepare performance report for client'] },
      { title: '📊 Client Metrics Dashboard', type: 'checklist', items: ['Reach & engagement metrics', 'Growth insights', 'Overall content performance', 'Best-performing videos'] },
      { title: '🎨 Creative Metrics (Internal)', type: 'checklist', items: ['Audience behaviour insights', 'High vs low-performing concepts', 'Strategic mapping for next script direction'] },
    ],
    callout: { type: 'info', text: '🔄 Perpetual engine: Reporting data feeds back into Level 4. The cycle restarts automatically — ensuring data-driven content decisions every batch.' },
  },
]

const CALLOUT_STYLES = {
  info: 'bg-blue-50 border-blue-200 text-blue-800',
  warn: 'bg-amber-50 border-amber-200 text-amber-800',
  danger: 'bg-red-50 border-red-200 text-red-800',
  green: 'bg-green-50 border-green-200 text-green-800',
}

const OS_MAP: Record<number, string> = {
  1: 'CRM Lead → Deal → create_project in OS',
  2: 'Assign Tasks to PM + team via OS, send Notifications',
  3: 'Calendar CALL event + Content status: SCRIPTING',
  4: 'Content status → REVIEW; Task: "Script approval call"',
  5: '3 Tasks (confirm each) + Calendar SHOOT event',
  6: 'Content status → SHOOTING; Tasks: clip log + handoff',
  7: 'Content status → EDITING → POSTED; Drive link; Daily Report',
}

// ─── RunSOPModal ──────────────────────────────────────────────────────────────
function RunSOPModal({
  level,
  onClose,
}: {
  level: SopLevel
  onClose: () => void
}) {
  const user = useAuthStore((s) => s.user)
  const [projects, setProjects] = useState<{ id: string; name: string; sopLevel: number | null }[]>([])
  const [selectedProject, setSelectedProject] = useState('')
  const [running, setRunning] = useState(false)
  const [done, setDone] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/projects')
      .then((r) => r.json())
      .then((j) => setProjects(j.data ?? []))
  }, [])

  const run = async () => {
    if (!selectedProject) return toast.error('Select a project first')
    setRunning(true)
    try {
      const res = await fetch('/api/sop/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ level: level.id, projectId: selectedProject }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setDone(json.summary)
      toast.success(`L${level.id} SOP activated!`)
    } catch (e: any) {
      toast.error(e.message ?? 'Failed')
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-3 mb-4">
          <span className="text-2xl">{level.icon}</span>
          <div>
            <p className="text-sm font-semibold text-stone-900">{level.title}</p>
            <p className="text-xs text-stone-500 mt-0.5">This will create tasks & calendar events in the OS</p>
          </div>
        </div>

        {done ? (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
            <p className="text-xs font-semibold text-green-800 mb-1">✅ Done!</p>
            <p className="text-xs text-green-700 leading-relaxed">{done}</p>
          </div>
        ) : (
          <div className="mb-4">
            <label className="text-[10px] font-semibold text-stone-500 uppercase tracking-wider block mb-1.5">Select Project</label>
            <select
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
              className="w-full text-sm border border-stone-200 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-stone-400"
            >
              <option value="">— Choose a project —</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}{p.sopLevel ? ` (currently L${p.sopLevel})` : ''}
                </option>
              ))}
            </select>

            <div className="mt-3 bg-stone-50 rounded-lg p-3 border border-stone-100">
              <p className="text-[10px] font-semibold text-stone-500 uppercase tracking-wider mb-1.5">What will be created</p>
              <p className="text-xs text-stone-600 leading-relaxed">{OS_MAP[level.id]}</p>
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 text-xs font-medium text-stone-600 bg-stone-100 hover:bg-stone-200 rounded-md py-2 transition-colors"
          >
            {done ? 'Close' : 'Cancel'}
          </button>
          {!done && (
            <button
              onClick={run}
              disabled={!selectedProject || running}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold rounded-md py-2 transition-colors',
                selectedProject && !running
                  ? 'bg-stone-900 text-white hover:bg-stone-700'
                  : 'bg-stone-100 text-stone-400 cursor-not-allowed'
              )}
            >
              {running ? <RefreshCw size={12} className="animate-spin" /> : <Zap size={12} />}
              {running ? 'Running…' : `Run L${level.id} SOP`}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Level Panel ──────────────────────────────────────────────────────────────
function LevelPanel({ level, onRun, canRun }: { level: SopLevel; onRun: () => void; canRun: boolean }) {
  return (
    <div className="space-y-3">
      {/* Meta card */}
      <div className="bg-white rounded-lg border border-stone-100 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">{level.icon}</span>
            <div>
              <p className="text-sm font-semibold text-stone-900">{level.title}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded', level.badgeColor)}>
                  {level.badge}
                </span>
                {level.isHardGate && (
                  <span className="flex items-center gap-1 text-[10px] font-bold text-red-700 bg-red-50 px-2 py-0.5 rounded border border-red-200">
                    <AlertTriangle size={9} /> HARD GATE
                  </span>
                )}
              </div>
            </div>
          </div>
          {canRun && (
            <button
              onClick={onRun}
              className="flex items-center gap-1.5 text-xs font-semibold bg-stone-900 text-white px-3 py-1.5 rounded-md hover:bg-stone-700 transition-colors flex-shrink-0"
            >
              <Zap size={11} /> Run in OS
            </button>
          )}
        </div>

        <div className="mt-3 pt-3 border-t border-stone-50 space-y-1.5">
          <div className="flex gap-2 text-xs">
            <span className="text-stone-400 w-24 flex-shrink-0">Owner</span>
            <span className="text-stone-700 font-medium">{level.owner}</span>
          </div>
          {level.extra?.map((e) => (
            <div key={e.label} className="flex gap-2 text-xs">
              <span className="text-stone-400 w-24 flex-shrink-0">{e.label}</span>
              <span className="text-stone-700">{e.value}</span>
            </div>
          ))}
          <div className="flex gap-2 text-xs mt-1">
            <span className="text-stone-400 w-24 flex-shrink-0">OS action</span>
            <span className="text-stone-600 font-mono text-[10px] bg-stone-50 px-2 py-0.5 rounded">{OS_MAP[level.id]}</span>
          </div>
        </div>
      </div>

      {/* Sections */}
      <div className={cn('grid gap-3', level.sections.length >= 3 ? 'grid-cols-1 sm:grid-cols-3' : level.sections.length === 2 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1')}>
        {level.sections.map((sec) => (
          <div key={sec.title} className="bg-white rounded-lg border border-stone-100 p-3">
            <p className="text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-2.5">{sec.title}</p>

            {sec.type === 'checklist' && (
              <ul className="space-y-1.5">
                {sec.items.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-xs text-stone-700 leading-snug">
                    <div className="w-3.5 h-3.5 rounded border border-stone-300 bg-white flex-shrink-0 mt-0.5" />
                    {item}
                  </li>
                ))}
              </ul>
            )}

            {sec.type === 'text' && (
              <p className="text-xs text-stone-700 leading-relaxed">{sec.items[0]}</p>
            )}

            {sec.type === 'flow' && (
              <div className="space-y-2">
                {sec.items.map((item, i) => (
                  <div key={i} className="flex items-start gap-2">
                    {i < sec.items.length - 1 ? (
                      <>
                        <div className="flex flex-col items-center">
                          <div className="w-5 h-5 rounded-full bg-stone-100 border border-stone-200 flex items-center justify-center flex-shrink-0 text-[9px] font-bold text-stone-500">{i + 1}</div>
                          {i < sec.items.length - 2 && <div className="w-px h-4 bg-stone-200 mt-1" />}
                        </div>
                        <p className="text-xs text-stone-700 leading-snug pt-0.5">{item}</p>
                      </>
                    ) : (
                      <div className="w-full bg-green-50 border border-green-200 rounded-md px-3 py-2 text-xs font-semibold text-green-800">
                        {item}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {sec.type === 'grid' && (
              <div className="grid grid-cols-2 gap-1.5">
                {sec.items.map((item, i) => (
                  <div key={i} className={cn('rounded-md p-2 text-center text-[10px] font-medium leading-snug', i % 2 === 0 ? 'bg-green-50 text-green-800' : 'bg-violet-50 text-violet-800')}>
                    {item}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Callout */}
      {level.callout && (
        <div className={cn('rounded-lg border px-4 py-3 text-xs leading-relaxed', CALLOUT_STYLES[level.callout.type])}>
          {level.callout.text}
        </div>
      )}
    </div>
  )
}

// ─── SOP Overview Table ───────────────────────────────────────────────────────
function OverviewTable({ onTabSelect }: { onTabSelect: (n: number) => void }) {
  return (
    <div className="bg-white rounded-lg border border-stone-100 overflow-hidden">
      <div className="px-4 py-3 border-b border-stone-100 flex items-center gap-2">
        <BookMarked size={13} className="text-stone-400" />
        <p className="text-xs font-semibold text-stone-700 uppercase tracking-wider">SOP → OS Feature Map</p>
      </div>
      <div className="divide-y divide-stone-50">
        {SOP_LEVELS.map((lvl) => (
          <button
            key={lvl.id}
            onClick={() => onTabSelect(lvl.id)}
            className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-stone-50 transition-colors text-left group"
          >
            <span className={cn('flex-shrink-0 text-[10px] font-bold px-2 py-0.5 rounded text-white', lvl.tabColor)}>
              L{lvl.id}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-stone-800 truncate">{lvl.title.split('—')[1]?.trim()}</p>
            </div>
            <p className="text-[10px] text-stone-400 hidden sm:block max-w-[200px] text-right leading-tight">{OS_MAP[lvl.id]}</p>
            <ChevronRight size={12} className="text-stone-300 group-hover:text-stone-500 flex-shrink-0" />
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function SOPPage() {
  const user = useAuthStore((s) => s.user)
  const [activeLevel, setActiveLevel] = useState(0) // 0 = overview
  const [runningLevel, setRunningLevel] = useState<SopLevel | null>(null)

  const canRun = user?.role === 'ADMIN' || user?.role === 'MANAGER'
  const currentLevel = SOP_LEVELS.find((l) => l.id === activeLevel)

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <TopBar title="SOP Pipeline" />

      {runningLevel && (
        <RunSOPModal level={runningLevel} onClose={() => setRunningLevel(null)} />
      )}

      <div className="flex-1 overflow-y-auto p-5 space-y-4 max-w-4xl">

        {/* AI tip */}
        <div className="bg-stone-900 text-white rounded-lg px-4 py-3 flex items-start gap-3">
          <span className="text-xl flex-shrink-0">🤖</span>
          <div>
            <p className="text-xs font-semibold mb-0.5">AI Shortcut</p>
            <p className="text-xs text-stone-400 leading-relaxed">
              Use <span className="text-white font-mono">AI Tools → "Run L5 SOP for [project]"</span> to auto-create all tasks, events and content updates for any level instantly.
            </p>
          </div>
        </div>

        {/* Level tabs */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setActiveLevel(0)}
            className={cn(
              'px-3 py-1.5 rounded-md text-xs font-medium border transition-colors',
              activeLevel === 0
                ? 'bg-stone-900 text-white border-stone-900'
                : 'text-stone-500 border-stone-200 hover:text-stone-800 hover:border-stone-300'
            )}
          >
            Overview
          </button>
          {SOP_LEVELS.map((lvl) => (
            <button
              key={lvl.id}
              onClick={() => setActiveLevel(lvl.id)}
              className={cn(
                'px-3 py-1.5 rounded-md text-xs font-medium border transition-colors',
                activeLevel === lvl.id
                  ? `${lvl.tabColor} text-white border-transparent`
                  : 'text-stone-500 border-stone-200 hover:text-stone-800 hover:border-stone-300'
              )}
            >
              L{lvl.id} — {lvl.title.split('—')[1]?.trim().split(' ').slice(0, 2).join(' ')}
            </button>
          ))}
        </div>

        {/* Content */}
        {activeLevel === 0 ? (
          <OverviewTable onTabSelect={setActiveLevel} />
        ) : currentLevel ? (
          <LevelPanel
            level={currentLevel}
            canRun={canRun}
            onRun={() => setRunningLevel(currentLevel)}
          />
        ) : null}

        {/* Quick run all buttons */}
        {canRun && activeLevel === 0 && (
          <div>
            <p className="text-[10px] font-semibold text-stone-500 uppercase tracking-wider mb-2">⚡ Quick Run a Level</p>
            <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5">
              {SOP_LEVELS.map((lvl) => (
                <button
                  key={lvl.id}
                  onClick={() => setRunningLevel(lvl)}
                  className={cn(
                    'flex flex-col items-center gap-1 py-2 px-1 rounded-lg border-2 border-transparent hover:border-stone-300 transition-all text-center',
                    lvl.badgeColor
                  )}
                >
                  <span className="text-base">{lvl.icon}</span>
                  <span className="text-[9px] font-bold">L{lvl.id}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
