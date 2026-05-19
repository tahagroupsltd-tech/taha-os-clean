'use client'
import { useState, useEffect, useCallback } from 'react'
import { TopBar } from '@/components/layout/TopBar'
import { useAuthStore } from '@/store/auth.store'
import { cn } from '@/lib/utils'
import { CheckCircle2, Circle, RefreshCw, ChevronDown, ChevronRight, BookOpen, X } from 'lucide-react'
import toast from 'react-hot-toast'

// ─── Step definitions with HOW-TO guides ─────────────────────────────────────
const SOP: { id: number; icon: string; title: string; color: string; steps: { key: string; label: string; how: string; tips?: string[] }[] }[] = [
  {
    id: 1, icon: '🛒', title: 'L1 — Sales & Onboarding', color: 'bg-blue-600',
    steps: [
      { key: 'quotation', label: 'Share quotation with client',
        how: 'Send a formal quotation PDF to the client via WhatsApp or email. Include package breakdown, deliverables, timeline, and total amount. Use the agency quote template.',
        tips: ['Always CC the PM', 'Include a validity date (7 days)', 'Send a follow-up after 24h if no reply'] },
      { key: 'mou', label: 'Get MOU / agreement confirmed',
        how: 'Once the client verbally agrees, send the MOU/contract PDF for signature. Use DocuSign, Adobe Sign, or WhatsApp acknowledgement for quick clients.',
        tips: ['Store signed MOU in the project Drive folder', 'Never start work without written confirmation'] },
      { key: 'payment', label: 'Collect advance / full payment',
        how: 'Share payment details (bank transfer or UPI). Request 50% advance before kick-off. Log the received amount in Finance → New Transaction (Type: INCOME).',
        tips: ['Send payment confirmation receipt to client', 'Record it in OS Finance tab immediately'] },
      { key: 'requirement', label: 'Conduct requirement discussion',
        how: 'Schedule a 30–45 min call with the client. Gather: brand voice, target audience, content goals, competitors, reference videos. Fill in the project brief doc.',
        tips: ['Record the call (with permission)', 'Take notes in real-time', 'Share a summary after the call'] },
      { key: 'onboarding', label: 'Complete client onboarding',
        how: 'Add the client to your WhatsApp group. Share: team intro, workflow overview, next steps timeline. Create the project in OS → Projects page.',
        tips: ['Pin important messages in the WA group', 'Set clear response time expectations'] },
      { key: 'brand_details', label: 'Collect brand details & references',
        how: 'Ask client to share: brand logo, colour palette, fonts, brand guidelines PDF, 3–5 competitor or inspiration videos. Save all in the project Drive folder.',
        tips: ['Create a Google Form for this to save time', 'Organise Drive: /Branding /References /Scripts /Footage'] },
    ],
  },
  {
    id: 2, icon: '🕸️', title: 'L2 — PM Setup', color: 'bg-violet-600',
    steps: [
      { key: 'assign_team', label: 'Assign core team members',
        how: 'Open the project in OS → Projects. Assign a Script Head, Director, Cameraman, and Editor. Create tasks for each via OS → Tasks with deadlines.',
        tips: ['Check team availability in OS → Calendar before assigning', 'Set task priority to HIGH for all L2 assignments'] },
      { key: 'welcome_client', label: 'Welcome client & share workflow',
        how: 'Send a welcome message in the client WhatsApp group. Share: a project timeline PDF, who their point of contact is, how approvals will work, and expected response times.',
        tips: ['Use a saved template for the welcome message', 'Pin the timeline PDF in the WA group'] },
      { key: 'brief_script_head', label: 'Brief Script Head',
        how: 'Share the completed project brief, brand guidelines, and reference videos with the Script Head. Set a script delivery deadline (usually 2–3 days). Create a task in OS.',
        tips: ['Always set a deadline in the task', 'Include reference links directly in the task description'] },
    ],
  },
  {
    id: 3, icon: '📝', title: 'L3 — Script Preparation', color: 'bg-amber-600',
    steps: [
      { key: 'alignment_call', label: 'Schedule & run alignment call',
        how: 'Book a GMeet with Client + PM + Script Head. Agenda: brand overview (5 min), content goals (10 min), tone & style (10 min), Q&A (10 min). Share a brief recap after.',
        tips: ['Send calendar invite with GMeet link 24h before', 'Prepare a 5-point agenda doc to share on the call', 'Record the meeting'] },
      { key: 'scripts_complete', label: 'Scripts written & ready for review',
        how: 'Script Head writes scripts in a shared Google Doc. Each script should have: Hook (0–3s), Main content, Call-to-action. PM reviews for brand alignment before sending to client.',
        tips: ['Use a script template with Hook/Body/CTA sections', 'Scripts must be done within the agreed timeline — no exceptions', 'Add word count & estimated duration to each script'] },
    ],
  },
  {
    id: 4, icon: '🔒', title: 'L4 — Script Approval (HARD GATE)', color: 'bg-red-600',
    steps: [
      { key: 'schedule_approval_call', label: 'Schedule script approval call',
        how: 'PM books a GMeet/call with the client. Share the Google Doc link 30 min before the call so client can pre-read. Remind them this is the formal approval session.',
        tips: ['Schedule within 24h of scripts being ready', 'Send a calendar invite with the doc link attached'] },
      { key: 'present_scripts', label: 'Script team presents scripts',
        how: 'Script Head reads each script aloud on the call. Explain the reasoning behind the hook, tone, and CTA. Client can interrupt with questions. Note all feedback in real-time.',
        tips: ['Read slowly and clearly', 'Have a notepad open for feedback', 'Do not argue — note feedback and move on'] },
      { key: 'client_feedback', label: 'Apply client revisions',
        how: 'After the call, list all changes in the Google Doc as comments. Script Head implements revisions. One revision round is standard — additional rounds may require extra charge.',
        tips: ['Apply all feedback within 24h', 'Track changes using Google Docs version history', 'If revision scope is large, inform PM immediately'] },
      { key: 'final_approval', label: '✅ Get FINAL client approval (mandatory)',
        how: 'Send revised scripts to client via WhatsApp with a message: "Please confirm approval of the attached scripts so we can proceed to shoot scheduling." Get a clear "Approved" reply.',
        tips: ['Screenshot or save the approval message', 'Never proceed to L5 without this', 'If client is unresponsive, escalate to founder after 48h'] },
    ],
  },
  {
    id: 5, icon: '📅', title: 'L5 — Shoot Logistics (48h window)', color: 'bg-stone-700',
    steps: [
      { key: 'confirm_client', label: 'Confirm client availability',
        how: 'WhatsApp the client with 3 date options for the shoot. Ask them to confirm by EOD. Once confirmed, add the shoot date to OS → Calendar.',
        tips: ['Offer weekday morning slots first (9am–1pm)', 'Give a 48h window to respond', 'Always have a backup date ready'] },
      { key: 'confirm_studio', label: 'Confirm studio availability',
        how: 'Check the studio booking calendar. Reserve the studio for the confirmed shoot date. Get a written booking confirmation. Add studio address to the shoot event in OS Calendar.',
        tips: ['Book at least 3 days in advance', 'Confirm technical setup: lighting, backdrop, monitors'] },
      { key: 'confirm_team', label: 'Confirm team availability',
        how: 'WhatsApp the Director, Cameraman, and Editor confirming the shoot date/time/location. Get explicit confirmation from each. Create a shoot day event in OS → Calendar.',
        tips: ['Share the shoot call sheet 24h before', 'Include: location, call time, wrap time, parking details', 'Confirm equipment list with Cameraman'] },
    ],
  },
  {
    id: 6, icon: '🎥', title: 'L6 — Shoot Day', color: 'bg-orange-600',
    steps: [
      { key: 'monitor_shoot', label: 'Execute & monitor the shoot',
        how: 'Director runs the shoot per the approved scripts. PM checks in at start and midway. Ensure each script is covered. If client is on set, manage their energy and time.',
        tips: ['Arrive 30 min early to set up', 'Brief the client on what to expect before starting', 'Keep shoot moving — max 2 takes per script section unless critical'] },
      { key: 'verify_clips', label: 'Verify approved clips on-set',
        how: 'After each script is shot, Director reviews the clip on camera monitor. Confirm: correct framing, clear audio, good performance. Mark "approved" in the shot list.',
        tips: ['Review every clip before moving to next script', 'Check audio with headphones', 'Use a physical shot list printed out'] },
      { key: 'log_clips', label: 'Log final selected clip numbers',
        how: 'Cameraman records clip numbers (e.g. A001–A017 for Script 1) in the shared shot log. PM receives this list at wrap. Store in the project Drive folder.',
        tips: ['Use a simple Google Sheet for the shot log', 'Include clip number, script name, take rating (1–5)'] },
      { key: 'handoff_data', label: 'Hand off footage to Data Handler',
        how: 'Cameraman transfers approved footage to the Data Handler via hard drive or AirDrop immediately after wrap. Data Handler uploads to the project Google Drive folder within 2h.',
        tips: ['Never leave the shoot location without completing the handoff', 'Data Handler confirms receipt via WhatsApp', 'Upload to Drive: /[ProjectName]/Raw Footage/[ShootDate]'] },
    ],
  },
  {
    id: 7, icon: '✂️', title: 'L7 — Post-Production', color: 'bg-green-700',
    steps: [
      { key: 'ingest', label: 'Stage 1 — Ingest raw clips',
        how: 'Editor downloads all footage from Drive. Organises clips by script in editing software (Premiere/DaVinci). Reviews all raw clips and logs usable takes.',
        tips: ['Create a project folder: /Project/Sequences /Audio /Graphics', 'Back up raw footage locally before editing'] },
      { key: 'cloud_sync', label: 'Stage 2 — Cloud sync & access',
        how: 'Ensure all raw footage is uploaded to the correct Drive folder. Share access with the editor, PM, and founder. Set permissions (Editor = Edit, Client = View).',
        tips: ['Drive path: /[ClientName]/[ProjectName]/[Month]', 'Double-check client cannot see raw/unedited files'] },
      { key: 'assign_editing', label: 'Stage 3 — Assign editing schedule',
        how: 'PM creates editing tasks in OS → Tasks with deadlines. Assign to Editor. Typical timeline: rough cut in 2 days, final cut in 4 days, client revisions in 6 days.',
        tips: ['Set task: "Rough cut — Script 1" due 2 days from now', 'Set task: "Final edit — all scripts" due 4 days from now'] },
      { key: 'monitor_editing', label: 'Stage 4 — Monitor editing progress',
        how: 'PM checks in with Editor daily via WhatsApp. Editor shares rough cuts via Drive link. PM reviews before sending to client. Log feedback in the OS task comments.',
        tips: ['Review rough cut within 4h of receiving', 'Use timestamps for feedback: "2:34 — cut here"', 'Never send unreviewed cuts to client'] },
      { key: 'posting_schedule', label: 'Stage 5 — Finalise posting schedule',
        how: 'PM creates a content calendar with posting dates, platforms, and captions. Share with client for approval. Schedule posts using Buffer/Meta Planner or post manually.',
        tips: ['Best posting times: Tue–Thu, 7–9pm IST', 'Prepare caption, hashtags, and thumbnail for each video', 'Create a content calendar in Google Sheets'] },
      { key: 'performance_report', label: 'Stage 6 — Prepare performance report',
        how: 'After 7 days of posting, pull analytics from Instagram/YouTube. Create a PDF report with: reach, engagement rate, top video, growth. Share with client via WhatsApp.',
        tips: ['Use Canva for a professional report template', 'Include a "next steps" recommendation section', 'This data informs L4 of the next content batch'] },
    ],
  },
]

// ─── HOW-TO GUIDE PANEL ───────────────────────────────────────────────────────
function HowToPanel({ step, levelColor, onClose }: {
  step: { key: string; label: string; how: string; tips?: string[] }
  levelColor: string
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        <div className={cn('px-5 py-4 flex items-start justify-between', levelColor)}>
          <div>
            <p className="text-[10px] font-bold text-white/60 uppercase tracking-widest mb-0.5">How to do this</p>
            <p className="text-sm font-bold text-white leading-snug">{step.label}</p>
          </div>
          <button onClick={onClose} className="text-white/60 hover:text-white mt-0.5 flex-shrink-0 ml-3">
            <X size={16} />
          </button>
        </div>
        <div className="overflow-y-auto p-5 space-y-4">
          <div>
            <p className="text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <BookOpen size={11} /> Step-by-step
            </p>
            <p className="text-sm text-stone-800 leading-relaxed">{step.how}</p>
          </div>
          {step.tips && step.tips.length > 0 && (
            <div>
              <p className="text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-2">💡 Tips</p>
              <ul className="space-y-1.5">
                {step.tips.map((tip, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-stone-700 leading-snug">
                    <span className="text-amber-500 flex-shrink-0 mt-0.5">→</span>
                    {tip}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Level Card ───────────────────────────────────────────────────────────────
function LevelCard({ level, done, onToggle, saving, disabled, onGuide }: {
  level: typeof SOP[0]
  done: Set<string>
  onToggle: (k: string, v: boolean) => void
  saving: string | null
  disabled: boolean
  onGuide: (step: typeof SOP[0]['steps'][0]) => void
}) {
  const [open, setOpen] = useState(true)
  const total = level.steps.length
  const completed = level.steps.filter(s => done.has(s.key)).length
  const isComplete = completed === total
  const pct = Math.round((completed / total) * 100)

  return (
    <div className={cn('rounded-xl border overflow-hidden shadow-sm', isComplete ? 'border-green-300' : 'border-stone-200')}>
      <button onClick={() => setOpen(o => !o)} className={cn('w-full flex items-center gap-3 px-4 py-3 text-left', level.color)}>
        <span className="text-xl flex-shrink-0">{level.icon}</span>
        <div className="flex-1">
          <p className="text-sm font-bold text-white">{level.title}</p>
        </div>
        <span className="text-[11px] font-semibold bg-white/20 px-2 py-1 rounded-full text-white flex-shrink-0">
          {isComplete ? '✓ Done' : `${completed}/${total}`}
        </span>
        {open ? <ChevronDown size={14} className="text-white/60 flex-shrink-0" /> : <ChevronRight size={14} className="text-white/60 flex-shrink-0" />}
      </button>
      <div className="h-1 bg-stone-100">
        <div className={cn('h-full transition-all duration-500', isComplete ? 'bg-green-500' : 'bg-stone-400')} style={{ width: `${pct}%` }} />
      </div>
      {open && (
        <div className="bg-white divide-y divide-stone-50">
          {level.steps.map(step => {
            const isChecked = done.has(step.key)
            const isSaving = saving === step.key
            return (
              <div key={step.key} className={cn('flex items-start gap-3 px-4 py-3', isChecked ? 'bg-green-50' : 'hover:bg-stone-50')}>
                <label className="flex items-start gap-3 flex-1 cursor-pointer select-none">
                  <div className="flex-shrink-0 mt-0.5">
                    <input type="checkbox" className="sr-only" checked={isChecked} disabled={disabled || isSaving}
                      onChange={e => onToggle(step.key, e.target.checked)} />
                    {isSaving ? <RefreshCw size={16} className="text-stone-400 animate-spin" /> :
                      isChecked ? <CheckCircle2 size={18} className="text-green-600" /> :
                        <Circle size={18} className="text-stone-300" />}
                  </div>
                  <p className={cn('text-sm leading-snug', isChecked ? 'text-stone-400 line-through' : 'text-stone-900')}>{step.label}</p>
                </label>
                <button onClick={() => onGuide(step)}
                  className="flex-shrink-0 mt-0.5 text-[10px] font-semibold text-stone-400 hover:text-stone-700 bg-stone-100 hover:bg-stone-200 px-2 py-1 rounded transition-colors whitespace-nowrap">
                  How to
                </button>
              </div>
            )
          })}
          {isComplete && (
            <div className="mx-4 mb-3 mt-2 rounded-lg bg-green-600 text-white text-xs font-semibold px-3 py-2 flex items-center gap-2">
              <CheckCircle2 size={13} /> Level complete — project stage updated ✓
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
  const canEdit = ['ADMIN','MANAGER','EMPLOYEE'].includes(user?.role ?? '')
  const [projects, setProjects] = useState<{ id: string; name: string; sopLevel: number | null }[]>([])
  const [selectedProject, setSelectedProject] = useState('')
  const [done, setDone] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState<string | null>(null)
  const [loadingProgress, setLoadingProgress] = useState(false)
  const [guide, setGuide] = useState<{ step: typeof SOP[0]['steps'][0]; color: string } | null>(null)

  useEffect(() => {
    fetch('/api/projects').then(r => r.json()).then(j => {
      const list = j.data ?? []
      setProjects(list)
      if (list.length > 0) setSelectedProject(list[0].id)
    })
  }, [])

  useEffect(() => {
    if (!selectedProject) return
    setLoadingProgress(true)
    setDone(new Set())
    fetch(`/api/sop/progress?projectId=${selectedProject}`)
      .then(r => r.json())
      .then(j => setDone(new Set((j.data ?? []).map((r: any) => `${r.level}:${r.stepKey}`))))
      .finally(() => setLoadingProgress(false))
  }, [selectedProject])

  const toggle = useCallback(async (level: number, stepKey: string, val: boolean) => {
    if (!selectedProject || !canEdit) return
    const key = `${level}:${stepKey}`
    setSaving(key)
    setDone(prev => { const n = new Set(prev); val ? n.add(key) : n.delete(key); return n })
    try {
      const res = await fetch('/api/sop/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: selectedProject, level, stepKey, completed: val }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      if (json.levelComplete && val) toast.success(`🎉 L${level} complete!`, { duration: 4000 })
    } catch (e: any) {
      setDone(prev => { const n = new Set(prev); val ? n.delete(key) : n.add(key); return n })
      toast.error(e.message ?? 'Failed')
    } finally { setSaving(null) }
  }, [selectedProject, canEdit])

  const total = SOP.reduce((a, l) => a + l.steps.length, 0)
  const completed = done.size
  const currentProject = projects.find(p => p.id === selectedProject)

  return (
    <div className="flex flex-col h-full overflow-hidden bg-stone-50">
      <TopBar title="SOP Pipeline" />
      {guide && <HowToPanel step={guide.step} levelColor={guide.color} onClose={() => setGuide(null)} />}

      {/* Project selector */}
      <div className="bg-white border-b border-stone-200 px-5 py-3 flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <label className="text-xs font-semibold text-stone-500 flex-shrink-0">Project</label>
          <select value={selectedProject} onChange={e => setSelectedProject(e.target.value)}
            className="flex-1 min-w-0 text-sm font-medium text-stone-900 bg-stone-50 border border-stone-200 rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-violet-400 max-w-xs">
            {projects.length === 0 && <option>Loading…</option>}
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-28 h-2 bg-stone-100 rounded-full overflow-hidden">
              <div className="h-full bg-stone-800 rounded-full transition-all duration-500" style={{ width: `${total === 0 ? 0 : Math.round((completed / total) * 100)}%` }} />
            </div>
            <span className="text-xs font-semibold text-stone-600">{completed}/{total} steps</span>
          </div>
          {currentProject?.sopLevel && (
            <span className="text-xs font-bold bg-stone-900 text-white px-2.5 py-1 rounded-full">L{currentProject.sopLevel} active</span>
          )}
          {loadingProgress && <RefreshCw size={13} className="text-stone-400 animate-spin" />}
        </div>
      </div>

      {/* Tip bar */}
      <div className="bg-violet-600 text-white px-5 py-2 flex items-center gap-2">
        <BookOpen size={12} className="flex-shrink-0" />
        <p className="text-xs">Tap <span className="font-bold bg-white/20 px-1.5 py-0.5 rounded text-[10px]">How to</span> on any step to see exactly how to complete it.</p>
      </div>

      {/* Levels */}
      <div className="flex-1 overflow-y-auto p-5 space-y-3 max-w-2xl">
        {selectedProject ? SOP.map(level => (
          <LevelCard key={level.id} level={level}
            done={new Set([...done].filter(k => k.startsWith(`${level.id}:`)).map(k => k.split(':')[1]))}
            onToggle={(k, v) => toggle(level.id, k, v)}
            saving={saving?.startsWith(`${level.id}:`) ? saving.split(':')[1] : null}
            disabled={!canEdit || loadingProgress}
            onGuide={step => setGuide({ step, color: level.color })}
          />
        )) : (
          <div className="flex items-center justify-center h-48">
            <p className="text-sm text-stone-400">Select a project to start</p>
          </div>
        )}
        {completed === total && total > 0 && (
          <div className="rounded-xl bg-green-600 text-white px-5 py-4 text-center shadow-lg">
            <p className="text-xl mb-1">🎬</p>
            <p className="font-bold text-sm">Full SOP cycle complete!</p>
            <p className="text-xs text-green-100 mt-1">Restart from L4 for the next content batch.</p>
          </div>
        )}
      </div>
    </div>
  )
}
