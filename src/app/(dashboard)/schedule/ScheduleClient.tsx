'use client'
// src/app/(dashboard)/schedule/ScheduleClient.tsx
import { useState, useMemo } from 'react'
import { format, parseISO, subDays, isValid } from 'date-fns'
import {
  CalendarDays, Plus, X, AlertTriangle, CheckCircle2,
  Trash2, ChevronRight, RefreshCw, Users, FolderKanban, Scale,
} from 'lucide-react'
import toast from 'react-hot-toast'
import Link from 'next/link'

// ─── Types ───────────────────────────────────────────────────────────────────

type Project = { id: string; name: string }
type Editor  = { id: string; name: string; username: string; role: string }

type ContentType = 'REEL' | 'VIDEO' | 'STORY' | 'POSTER' | 'GRAPHIC'
const CONTENT_TYPES: ContentType[] = ['REEL', 'VIDEO', 'STORY', 'POSTER', 'GRAPHIC']

type ScheduleResult = {
  created: number
  projectName: string
  editorName: string
  items: { id: string; title: string; postDate: string | null; editorName?: string }[]
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseLooseDate(raw: string): string | null {
  const s = raw.trim()
  if (!s) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const d = new Date(s)
    return isValid(d) ? s : null
  }
  const dmy = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/)
  if (dmy) {
    const d = new Date(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]))
    return isValid(d) ? format(d, 'yyyy-MM-dd') : null
  }
  const attempt = new Date(s.replace(/(\d+)(st|nd|rd|th)/i, '$1') + (/ \d{4}$/.test(s) ? '' : ` ${new Date().getFullYear()}`))
  if (isValid(attempt)) return format(attempt, 'yyyy-MM-dd')
  return null
}

function fmtDate(iso: string) { return format(parseISO(iso), 'dd MMM yyyy') }
function fmtDay(iso: string)  { return format(parseISO(iso), 'EEE, dd MMM') }

// Editor colour palette for balance mode
const EDITOR_COLORS = [
  'bg-blue-100 text-blue-700 border-blue-200',
  'bg-violet-100 text-violet-700 border-violet-200',
  'bg-amber-100 text-amber-700 border-amber-200',
  'bg-green-100 text-green-700 border-green-200',
  'bg-rose-100 text-rose-700 border-rose-200',
  'bg-cyan-100 text-cyan-700 border-cyan-200',
]

// ─── Component ───────────────────────────────────────────────────────────────

export function ScheduleClient({ projects, editors }: { projects: Project[]; editors: Editor[] }) {
  // Config state
  const [projectId, setProjectId]         = useState('')
  const [assigneeId, setAssigneeId]       = useState('')
  const [balanceMode, setBalanceMode]     = useState(false)
  const [balanceEditorIds, setBalanceEditorIds] = useState<string[]>([])
  const [contentType, setContentType]     = useState<ContentType>('REEL')
  const [bufferDays, setBufferDays]       = useState(2)
  const [titlePrefix, setTitlePrefix]     = useState('')

  // Date entry
  const [singleDate, setSingleDate]       = useState('')
  const [bulkInput, setBulkInput]         = useState('')
  const [postingDates, setPostingDates]   = useState<string[]>([])

  // UI state
  const [submitting, setSubmitting]       = useState(false)
  const [result, setResult]               = useState<ScheduleResult | null>(null)

  // ── Derived ─────────────────────────────────────────────────────────────

  const selectedProject = projects.find((p) => p.id === projectId)
  const selectedEditor  = editors.find((e) => e.id === assigneeId)

  // Active editor IDs depending on mode
  const activeEditorIds = useMemo(
    () => balanceMode ? balanceEditorIds : (assigneeId ? [assigneeId] : []),
    [balanceMode, balanceEditorIds, assigneeId]
  )

  const sortedDates = useMemo(() => [...postingDates].sort(), [postingDates])

  const dateCounts = useMemo(() => {
    const m = new Map<string, number>()
    for (const d of sortedDates) m.set(d, (m.get(d) ?? 0) + 1)
    return m
  }, [sortedDates])

  const conflicts = useMemo(
    () => [...dateCounts.entries()].filter(([, count]) => count > 1),
    [dateCounts]
  )

  const uniqueDates = useMemo(() => [...new Set(sortedDates)], [sortedDates])
  const prefix = titlePrefix.trim() || selectedProject?.name || 'Video'

  // Safe buffer: always at least 1
  const safeBuffer = Math.max(1, bufferDays)

  const previewRows = useMemo(
    () =>
      uniqueDates.map((iso, i) => {
        const editorId = activeEditorIds.length > 0
          ? activeEditorIds[i % activeEditorIds.length]
          : null
        const editor = editorId ? editors.find((e) => e.id === editorId) : null
        const colorIdx = editorId ? (activeEditorIds.indexOf(editorId) % EDITOR_COLORS.length) : 0
        return {
          idx: i + 1,
          postDate: iso,
          readyBy: format(subDays(parseISO(iso), safeBuffer), 'yyyy-MM-dd'),
          title: `${prefix} #${i + 1} — ${fmtDate(iso)}`,
          editorId,
          editorName: editor?.name ?? null,
          colorCls: EDITOR_COLORS[colorIdx],
        }
      }),
    [uniqueDates, safeBuffer, prefix, activeEditorIds, editors]
  )

  // Per-editor item count for balance stats
  const editorLoadMap = useMemo(() => {
    const m = new Map<string, number>()
    for (const row of previewRows) {
      if (row.editorId) m.set(row.editorId, (m.get(row.editorId) ?? 0) + 1)
    }
    return m
  }, [previewRows])

  // ── Handlers ────────────────────────────────────────────────────────────

  function toggleBalanceEditor(id: string) {
    setBalanceEditorIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  function addSingleDate() {
    if (!singleDate) return
    if (postingDates.includes(singleDate)) { toast.error('Date already in list'); return }
    setPostingDates((prev) => [...prev, singleDate])
    setSingleDate('')
  }

  function parseBulkInput() {
    const raw = bulkInput.split(/[,\n]+/).map((s) => s.trim()).filter(Boolean)
    const parsed: string[] = []
    const failed: string[] = []
    for (const s of raw) {
      const d = parseLooseDate(s)
      if (d && !postingDates.includes(d) && !parsed.includes(d)) parsed.push(d)
      else if (!d) failed.push(s)
    }
    if (parsed.length) {
      setPostingDates((prev) => [...prev, ...parsed])
      setBulkInput('')
      toast.success(`Added ${parsed.length} date${parsed.length > 1 ? 's' : ''}`)
    }
    if (failed.length) {
      toast.error(`Couldn't parse: ${failed.slice(0, 3).join(', ')}${failed.length > 3 ? '…' : ''}`)
    }
  }

  function removeDate(iso: string) { setPostingDates((prev) => prev.filter((d) => d !== iso)) }
  function clearAll() { setPostingDates([]); setBulkInput('') }

  async function handleSubmit() {
    if (!projectId) { toast.error('Select a client project'); return }
    if (balanceMode && balanceEditorIds.length === 0) { toast.error('Select at least one editor to balance across'); return }
    if (!balanceMode && !assigneeId) { toast.error('Select an editor'); return }
    if (!uniqueDates.length) { toast.error('Add at least one posting date'); return }

    setSubmitting(true)
    try {
      const payload: Record<string, any> = {
        projectId,
        contentType,
        bufferDays: safeBuffer,
        titlePrefix: prefix,
        postingDates: uniqueDates,
      }
      if (balanceMode) {
        payload.assigneeIds = balanceEditorIds
      } else {
        payload.assigneeId = assigneeId
      }

      const res = await fetch('/api/schedule/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to create schedule')

      setResult(data)
      toast.success(`${data.created} items created for ${data.projectName}`)
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  function resetForNextClient() {
    setProjectId(''); setAssigneeId(''); setTitlePrefix('')
    setPostingDates([]); setBulkInput(''); setResult(null)
    setBalanceEditorIds([])
  }

  // ── Success Screen ───────────────────────────────────────────────────────

  if (result) {
    return (
      <div className="flex-1 overflow-y-auto p-5">
        <div className="max-w-lg mx-auto mt-8">
          <div className="bg-white rounded-xl border border-green-200 p-6 text-center">
            <div className="w-12 h-12 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 size={24} className="text-green-500" />
            </div>
            <h2 className="text-base font-semibold text-stone-900 mb-1">
              {result.created} videos scheduled
            </h2>
            <p className="text-sm text-stone-500 mb-6">
              Client: <span className="font-medium text-stone-700">{result.projectName}</span>
            </p>

            <div className="text-left border border-stone-100 rounded-lg overflow-hidden mb-6">
              <div className="px-3 py-2 bg-stone-50 border-b border-stone-100">
                <p className="text-[11px] font-semibold text-stone-500 uppercase tracking-wide">Created items</p>
              </div>
              <div className="divide-y divide-stone-50 max-h-56 overflow-y-auto">
                {result.items.map((item) => (
                  <div key={item.id} className="px-3 py-2 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs text-stone-700 truncate">{item.title}</p>
                      {item.editorName && (
                        <p className="text-[10px] text-stone-400">{item.editorName}</p>
                      )}
                    </div>
                    {item.postDate && (
                      <span className="text-[10px] text-stone-400 flex-shrink-0">
                        {fmtDay(item.postDate.slice(0, 10))}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-3 justify-center">
              <Link href="/content" className="inline-flex items-center gap-2 bg-stone-900 text-white text-sm font-medium px-4 py-2.5 rounded-lg hover:bg-stone-800 transition-colors">
                View in Content
              </Link>
              <button onClick={resetForNextClient} className="inline-flex items-center gap-2 bg-white border border-stone-200 text-stone-700 text-sm font-medium px-4 py-2.5 rounded-lg hover:bg-stone-50 transition-colors">
                <RefreshCw size={14} /> Schedule another
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── Main Form ────────────────────────────────────────────────────────────

  return (
    <div className="flex-1 overflow-y-auto p-5">
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 max-w-6xl">

        {/* ─── LEFT: Config ─────────────────────────────────────────────── */}
        <div className="space-y-4">

          {/* Client + Editor */}
          <div className="bg-white rounded-lg border border-stone-100 overflow-hidden">
            <div className="px-4 py-3 border-b border-stone-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FolderKanban size={13} className="text-stone-400" />
                <p className="panel-title">Client &amp; Editor</p>
              </div>
              {/* Balance toggle */}
              <button
                type="button"
                onClick={() => { setBalanceMode((v) => !v); setBalanceEditorIds([]); setAssigneeId('') }}
                className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-md border transition-colors ${
                  balanceMode
                    ? 'bg-violet-50 text-violet-700 border-violet-200'
                    : 'bg-stone-50 text-stone-500 border-stone-200 hover:bg-stone-100'
                }`}
              >
                <Scale size={11} />
                {balanceMode ? 'Balance on' : 'Balance off'}
              </button>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-stone-600 mb-1">Client project</label>
                <select
                  value={projectId}
                  onChange={(e) => { setProjectId(e.target.value); setTitlePrefix('') }}
                  className="input-base text-sm"
                >
                  <option value="">— Select client —</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              {/* Single editor mode */}
              {!balanceMode && (
                <div>
                  <label className="block text-xs font-medium text-stone-600 mb-1">Assign to editor</label>
                  <select
                    value={assigneeId}
                    onChange={(e) => setAssigneeId(e.target.value)}
                    className="input-base text-sm"
                  >
                    <option value="">— Select editor —</option>
                    {editors.map((e) => (
                      <option key={e.id} value={e.id}>{e.name} ({e.role.toLowerCase()})</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Balance mode: multi-editor picker */}
              {balanceMode && (
                <div>
                  <label className="block text-xs font-medium text-stone-600 mb-2">
                    Select editors to balance across
                    <span className="text-stone-400 font-normal ml-1">— content distributed evenly in order</span>
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {editors.map((e, idx) => {
                      const selected = balanceEditorIds.includes(e.id)
                      const colorCls = selected
                        ? EDITOR_COLORS[balanceEditorIds.indexOf(e.id) % EDITOR_COLORS.length]
                        : 'bg-stone-50 text-stone-500 border-stone-200'
                      return (
                        <button
                          key={e.id}
                          type="button"
                          onClick={() => toggleBalanceEditor(e.id)}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium border transition-colors ${colorCls}`}
                        >
                          <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold ${
                            selected ? 'bg-current/20' : 'bg-stone-200 text-stone-500'
                          }`}>
                            {selected ? balanceEditorIds.indexOf(e.id) + 1 : '+'}
                          </span>
                          {e.name}
                        </button>
                      )
                    })}
                  </div>
                  {balanceEditorIds.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-stone-50">
                      <p className="text-[10px] text-stone-400">
                        Order: {balanceEditorIds.map((id, i) => {
                          const e = editors.find(x => x.id === id)
                          return `${e?.name ?? '?'}`
                        }).join(' → ')} → (repeats)
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Content settings */}
          <div className="bg-white rounded-lg border border-stone-100 overflow-hidden">
            <div className="px-4 py-3 border-b border-stone-100">
              <p className="panel-title">Content settings</p>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-stone-600 mb-1">Content type</label>
                <div className="flex gap-1.5 flex-wrap">
                  {CONTENT_TYPES.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setContentType(t)}
                      className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                        contentType === t
                          ? 'bg-stone-900 text-white border-stone-900'
                          : 'bg-white text-stone-600 border-stone-200 hover:border-stone-400'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-stone-600 mb-1">
                    Buffer days
                    <span className="text-stone-400 font-normal ml-1">(min 1 — deadline before posting)</span>
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={30}
                    value={bufferDays}
                    onChange={(e) => setBufferDays(Math.max(1, Number(e.target.value)))}
                    className="input-base text-sm"
                  />
                  {bufferDays < 1 && (
                    <p className="text-[10px] text-amber-600 mt-1 flex items-center gap-1">
                      <AlertTriangle size={10} /> Minimum 1 day required
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-600 mb-1">
                    Title prefix
                    <span className="text-stone-400 font-normal ml-1">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={titlePrefix}
                    onChange={(e) => setTitlePrefix(e.target.value)}
                    placeholder={selectedProject?.name ?? 'e.g. AXS Reel'}
                    className="input-base text-sm"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Add dates */}
          <div className="bg-white rounded-lg border border-stone-100 overflow-hidden">
            <div className="px-4 py-3 border-b border-stone-100 flex items-center gap-2">
              <CalendarDays size={13} className="text-stone-400" />
              <p className="panel-title">Add posting dates</p>
            </div>
            <div className="p-4 space-y-3">
              <div className="flex gap-2">
                <input
                  type="date"
                  value={singleDate}
                  onChange={(e) => setSingleDate(e.target.value)}
                  className="input-base text-sm flex-1"
                />
                <button
                  type="button"
                  onClick={addSingleDate}
                  disabled={!singleDate}
                  className="flex items-center gap-1.5 px-3 py-2 bg-stone-900 text-white text-xs font-medium rounded-lg hover:bg-stone-800 disabled:opacity-40 transition-colors flex-shrink-0"
                >
                  <Plus size={13} /> Add
                </button>
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-600 mb-1">
                  Or paste multiple dates
                  <span className="text-stone-400 font-normal ml-1">— comma-separated or one per line</span>
                </label>
                <textarea
                  rows={3}
                  value={bulkInput}
                  onChange={(e) => setBulkInput(e.target.value)}
                  placeholder={"May 1, May 5, May 10\n20 May, 25 May\n2026-06-01"}
                  className="input-base text-sm resize-none font-mono"
                />
                <button
                  type="button"
                  onClick={parseBulkInput}
                  disabled={!bulkInput.trim()}
                  className="mt-2 w-full py-2 bg-stone-100 text-stone-700 text-xs font-medium rounded-lg hover:bg-stone-200 disabled:opacity-40 transition-colors"
                >
                  Parse &amp; add dates
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ─── RIGHT: Preview ───────────────────────────────────────────── */}
        <div className="space-y-4">

          {/* Stats strip */}
          {uniqueDates.length > 0 && (
            <div className={`grid gap-2 sm:gap-3 ${balanceMode && balanceEditorIds.length > 0 ? 'grid-cols-4' : 'grid-cols-3'}`}>
              <div className="stat-card text-center p-3 sm:p-4">
                <p className="text-lg sm:text-2xl font-bold text-stone-900">{uniqueDates.length}</p>
                <p className="text-[10px] sm:text-[11px] text-stone-400 mt-0.5">Videos</p>
              </div>
              <div className="stat-card text-center p-3 sm:p-4">
                <p className="text-lg sm:text-2xl font-bold text-stone-900 truncate">
                  {fmtDate(sortedDates[0]).replace(/\d{4}$/, '').trim()}
                </p>
                <p className="text-[10px] sm:text-[11px] text-stone-400 mt-0.5">First post</p>
              </div>
              <div className="stat-card text-center p-3 sm:p-4">
                <p className={`text-lg sm:text-2xl font-bold ${conflicts.length > 0 ? 'text-amber-500' : 'text-stone-900'}`}>
                  {conflicts.length}
                </p>
                <p className="text-[10px] sm:text-[11px] text-stone-400 mt-0.5">Conflicts</p>
              </div>
              {balanceMode && balanceEditorIds.length > 0 && (
                <div className="stat-card text-center p-3 sm:p-4">
                  <p className="text-lg sm:text-2xl font-bold text-violet-700">{balanceEditorIds.length}</p>
                  <p className="text-[10px] sm:text-[11px] text-stone-400 mt-0.5">Editors</p>
                </div>
              )}
            </div>
          )}

          {/* Balance load summary */}
          {balanceMode && balanceEditorIds.length > 0 && uniqueDates.length > 0 && (
            <div className="bg-violet-50 border border-violet-100 rounded-lg px-4 py-3">
              <p className="text-[11px] font-semibold text-violet-800 mb-2 flex items-center gap-1.5">
                <Scale size={11} /> Editing load distribution
              </p>
              <div className="flex flex-wrap gap-2">
                {balanceEditorIds.map((id, idx) => {
                  const editor = editors.find((e) => e.id === id)
                  const count = editorLoadMap.get(id) ?? 0
                  const colorCls = EDITOR_COLORS[idx % EDITOR_COLORS.length]
                  return (
                    <span key={id} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border ${colorCls}`}>
                      {editor?.name ?? '?'} — {count} video{count !== 1 ? 's' : ''}
                    </span>
                  )
                })}
              </div>
            </div>
          )}

          {/* Conflict alert */}
          {conflicts.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 flex gap-2.5">
              <AlertTriangle size={15} className="text-amber-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs font-semibold text-amber-800 mb-0.5">Duplicate dates detected</p>
                <p className="text-xs text-amber-700">
                  {conflicts.map(([d, n]) => `${fmtDay(d)} (×${n})`).join(', ')}
                  {' — '}duplicates removed from the final list.
                </p>
              </div>
            </div>
          )}

          {/* Preview table */}
          <div className="bg-white rounded-lg border border-stone-100 overflow-hidden">
            <div className="px-4 py-3 border-b border-stone-100 flex items-center justify-between">
              <p className="panel-title">
                Preview
                {uniqueDates.length > 0 && (
                  <span className="ml-2 text-stone-400 font-normal normal-case">
                    {uniqueDates.length} item{uniqueDates.length !== 1 ? 's' : ''}
                  </span>
                )}
              </p>
              {postingDates.length > 0 && (
                <button
                  onClick={clearAll}
                  className="flex items-center gap-1 text-[10px] text-stone-400 hover:text-red-500 transition-colors"
                >
                  <Trash2 size={11} /> Clear all
                </button>
              )}
            </div>

            {uniqueDates.length === 0 ? (
              <div className="empty-state">
                <CalendarDays size={20} className="text-stone-300 mx-auto mb-2" />
                <p>Add posting dates to see a preview</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-stone-100 bg-stone-50">
                      <th className="px-3 py-2 text-left text-[10px] font-semibold text-stone-500 uppercase tracking-wide w-8">#</th>
                      <th className="px-3 py-2 text-left text-[10px] font-semibold text-stone-500 uppercase tracking-wide">Title</th>
                      <th className="px-3 py-2 text-left text-[10px] font-semibold text-stone-500 uppercase tracking-wide">Posts on</th>
                      <th className="px-3 py-2 text-left text-[10px] font-semibold text-stone-500 uppercase tracking-wide">
                        Deadline
                        <span className="ml-1 text-stone-400 font-normal normal-case">({safeBuffer}d before)</span>
                      </th>
                      {balanceMode && (
                        <th className="px-3 py-2 text-left text-[10px] font-semibold text-stone-500 uppercase tracking-wide">Editor</th>
                      )}
                      <th className="px-3 py-2 w-6" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-50">
                    {previewRows.map((row) => (
                      <tr key={row.postDate} className="table-row-hover">
                        <td className="px-3 py-2.5 text-stone-400">{row.idx}</td>
                        <td className="px-3 py-2.5 text-stone-700 max-w-[160px] truncate">{row.title}</td>
                        <td className="px-3 py-2.5 text-stone-600 whitespace-nowrap">{fmtDay(row.postDate)}</td>
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          <span className="font-medium text-blue-600">{fmtDay(row.readyBy)}</span>
                        </td>
                        {balanceMode && (
                          <td className="px-3 py-2.5">
                            {row.editorName ? (
                              <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-medium border ${row.colorCls}`}>
                                {row.editorName}
                              </span>
                            ) : (
                              <span className="text-stone-300">—</span>
                            )}
                          </td>
                        )}
                        <td className="px-3 py-2.5">
                          <button
                            onClick={() => removeDate(row.postDate)}
                            className="text-stone-300 hover:text-red-400 transition-colors"
                          >
                            <X size={12} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Submit */}
          {uniqueDates.length > 0 && (
            <div className="bg-white rounded-lg border border-stone-100 p-4">
              <div className="flex items-center gap-2 mb-4 text-xs text-stone-500 flex-wrap">
                <FolderKanban size={12} className="text-stone-400" />
                <span>{selectedProject?.name ?? <span className="text-red-400">no project</span>}</span>
                <ChevronRight size={11} className="text-stone-300" />
                <Users size={12} className="text-stone-400" />
                {balanceMode ? (
                  <span>
                    {balanceEditorIds.length > 0
                      ? balanceEditorIds.map((id) => editors.find((e) => e.id === id)?.name ?? '?').join(', ')
                      : <span className="text-red-400">no editors selected</span>}
                  </span>
                ) : (
                  <span>{selectedEditor?.name ?? <span className="text-red-400">no editor</span>}</span>
                )}
                <ChevronRight size={11} className="text-stone-300" />
                <span className="font-medium text-stone-700">{uniqueDates.length} × {contentType}</span>
              </div>

              <button
                onClick={handleSubmit}
                disabled={
                  submitting || !projectId || uniqueDates.length === 0 ||
                  (balanceMode ? balanceEditorIds.length === 0 : !assigneeId)
                }
                className="w-full py-2.5 bg-stone-900 text-white text-sm font-medium rounded-lg hover:bg-stone-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    Creating…
                  </>
                ) : (
                  `Create ${uniqueDates.length} content item${uniqueDates.length !== 1 ? 's' : ''}`
                )}
              </button>
              <p className="text-[10px] text-stone-400 text-center mt-2">
                {balanceMode
                  ? `Each editor will be notified with their portion of the batch`
                  : `Editor will receive a notification with the full batch summary`}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
