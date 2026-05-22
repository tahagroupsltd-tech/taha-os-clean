'use client'
// src/app/(dashboard)/ai-tools/page.tsx
import { useState, useRef, useEffect } from 'react'
import { TopBar } from '@/components/layout/TopBar'
import { useAuthStore } from '@/store/auth.store'
import { cn } from '@/lib/utils'
import {
  Sparkles, Send, RefreshCw, Copy, CheckCheck,
  Zap, BookMarked, ListTodo, FileText, BarChart2, MessageSquare,
  ChevronRight, Lightbulb,
} from 'lucide-react'
import toast from 'react-hot-toast'



// ─── Types ────────────────────────────────────────────────────────────────────
interface Message {
  role: 'user' | 'assistant'
  content: string
  ts: number
}

interface PromptCard {
  icon: React.ReactNode
  label: string
  description: string
  prompt: string
  color: string
}

// ─── Prompt templates ─────────────────────────────────────────────────────────
const PROMPT_CARDS: PromptCard[] = [
  {
    icon: <BookMarked size={16} />,
    label: 'Run SOP Level',
    description: 'Auto-create tasks & events for a project SOP stage',
    prompt: 'Run L3 SOP for [project name] — create all required tasks, calendar events and content updates',
    color: 'bg-violet-50 text-violet-700 border-violet-100',
  },
  {
    icon: <ListTodo size={16} />,
    label: 'Generate Task List',
    description: 'Break a project into actionable tasks',
    prompt: 'Generate a detailed task list for a social media content project for a fashion brand',
    color: 'bg-blue-50 text-blue-700 border-blue-100',
  },
  {
    icon: <FileText size={16} />,
    label: 'Draft Script Brief',
    description: 'Create a video script brief from a topic',
    prompt: 'Draft a script brief for a 60-second Instagram Reel promoting a new restaurant launch',
    color: 'bg-amber-50 text-amber-700 border-amber-100',
  },
  {
    icon: <BarChart2 size={16} />,
    label: 'Performance Report',
    description: 'Summarise content metrics into a client report',
    prompt: 'Summarise these metrics into a professional client performance report: Reach 45k, Engagement 3.2%, Top video: 120k views',
    color: 'bg-green-50 text-green-700 border-green-100',
  },
  {
    icon: <Lightbulb size={16} />,
    label: 'Content Ideas',
    description: 'Generate creative content concepts',
    prompt: 'Generate 5 creative Reel ideas for a fitness coaching brand targeting young professionals',
    color: 'bg-orange-50 text-orange-700 border-orange-100',
  },
  {
    icon: <Zap size={16} />,
    label: 'SOP Checklist',
    description: 'Get a quick checklist for any SOP level',
    prompt: 'Give me the complete checklist for SOP Level 5 — Shoot Logistics',
    color: 'bg-red-50 text-red-700 border-red-100',
  },
]

// ─── SOP quick-actions ────────────────────────────────────────────────────────
const SOP_ACTIONS = [
  { level: 1, label: 'L1 · Sales', color: 'bg-blue-100 text-blue-800' },
  { level: 2, label: 'L2 · PM Setup', color: 'bg-violet-100 text-violet-800' },
  { level: 3, label: 'L3 · Script', color: 'bg-amber-100 text-amber-800' },
  { level: 4, label: 'L4 · Approval 🔒', color: 'bg-red-100 text-red-800' },
  { level: 5, label: 'L5 · Shoot', color: 'bg-stone-100 text-stone-700' },
  { level: 6, label: 'L6 · Shoot Day', color: 'bg-orange-100 text-orange-800' },
  { level: 7, label: 'L7 · Post-Prod', color: 'bg-green-100 text-green-800' },
]

// ─── Inline SOP Run Modal ─────────────────────────────────────────────────────
function SOPRunModal({ level, onClose }: { level: number; onClose: () => void }) {
  const [projects, setProjects] = useState<{ id: string; name: string; sopLevel: number | null }[]>([])
  const [users, setUsers] = useState<{ id: string; name: string; role: string }[]>([])
  const [selectedProject, setSelectedProject] = useState('')
  const [selectedUser, setSelectedUser] = useState('')
  const [running, setRunning] = useState(false)
  const [done, setDone] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/projects').then(r => r.json()).then(j => setProjects(j.data ?? []))
    fetch('/api/users').then(r => r.json()).then(j => {
      const team = (j.data ?? []).filter((u: any) => u.role !== 'CLIENT')
      setUsers(team)
    })
  }, [])

  const run = async () => {
    if (!selectedProject) return toast.error('Select a project')
    setRunning(true)
    try {
      const res = await fetch('/api/sop/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ level, projectId: selectedProject, assignedToId: selectedUser || null }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setDone(json.summary)
      toast.success(`L${level} SOP activated!`)
    } catch (e: any) {
      toast.error(e.message ?? 'Failed')
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-5" onClick={e => e.stopPropagation()}>
        <p className="text-sm font-semibold text-stone-900 mb-3">⚡ Run L{level} SOP in OS</p>
        {done ? (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
            <p className="text-xs font-semibold text-green-800 mb-1">✅ Done!</p>
            <p className="text-xs text-green-700 leading-relaxed">{done}</p>
          </div>
        ) : (
          <div className="mb-4 space-y-4">
            <div>
              <label className="text-[10px] font-semibold text-stone-500 uppercase tracking-wider block mb-1.5">Select Project</label>
              <select value={selectedProject} onChange={e => setSelectedProject(e.target.value)}
                className="w-full text-sm border border-stone-200 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-stone-400">
                <option value="">— Choose a project —</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.name}{p.sopLevel ? ` (L${p.sopLevel})` : ''}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-semibold text-stone-500 uppercase tracking-wider block mb-1.5">Assign Tasks To</label>
              <select value={selectedUser} onChange={e => setSelectedUser(e.target.value)}
                className="w-full text-sm border border-stone-200 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-stone-400">
                <option value="">— Unassigned (None) —</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>{u.name} ({u.role.toLowerCase()})</option>
                ))}
              </select>
            </div>
          </div>
        )}
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 text-xs font-medium text-stone-600 bg-stone-100 hover:bg-stone-200 rounded-md py-2">
            {done ? 'Close' : 'Cancel'}
          </button>
          {!done && (
            <button onClick={run} disabled={!selectedProject || running}
              className={cn('flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold rounded-md py-2',
                selectedProject && !running ? 'bg-stone-900 text-white' : 'bg-stone-100 text-stone-400 cursor-not-allowed')}>
              {running ? <RefreshCw size={11} className="animate-spin" /> : <Zap size={11} />}
              {running ? 'Running…' : 'Run Now'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function AIToolsPage() {
  const user = useAuthStore((s) => s.user)
  const canRun = user?.role === 'ADMIN' || user?.role === 'MANAGER'
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null)
  const [sopModal, setSopModal] = useState<number | null>(null)
  const [viewMode, setViewMode] = useState<'chat' | 'templates'>('chat')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])
  const send = async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || loading) return

    const userMsg: Message = { role: 'user', content: trimmed, ts: Date.now() }
    const updatedMessages = [...messages, userMsg]
    setMessages(updatedMessages)
    setInput('')
    setLoading(true)

    try {
      const payload = {
        messages: updatedMessages.map(m => ({ role: m.role, content: m.content }))
      }
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      const reply =
        json?.reply ??
        (json?.error ? `Error: ${json.error}` : 'No response from AI.')

      setMessages(prev => [...prev, { role: 'assistant', content: reply, ts: Date.now() }])
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Failed to reach AI. Check your connection.', ts: Date.now() }])
    } finally {
      setLoading(false)
    }
  }

  const copyMsg = (content: string, idx: number) => {
    navigator.clipboard.writeText(content).then(() => {
      setCopiedIdx(idx)
      setTimeout(() => setCopiedIdx(null), 2000)
    })
  }

  const clearChat = () => {
    setMessages([])
    toast.success('Chat cleared')
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <TopBar title="AI Tools" />
      {sopModal !== null && canRun && (
        <SOPRunModal level={sopModal} onClose={() => { setSopModal(null); setViewMode('chat') }} />
      )}

      <div className="flex-1 overflow-hidden flex flex-col lg:flex-row gap-0">
        {/* ── Left panel: prompt cards + SOP quick-actions ── */}
        <div className={cn(
          "w-full lg:w-72 flex-shrink-0 border-r border-stone-100 overflow-y-auto p-4 space-y-5 bg-stone-50/50",
          viewMode === 'chat' ? 'hidden lg:block' : 'block'
        )}>
          <div className="lg:hidden flex items-center justify-between border-b border-stone-100 pb-2.5">
            <span className="text-xs font-semibold text-stone-700">Templates & SOPs</span>
            <button
              onClick={() => setViewMode('chat')}
              className="text-xs text-stone-500 hover:text-stone-900 font-medium underline"
            >
              Back to Chat
            </button>
          </div>
          {/* Header blurb */}
          <div className="flex items-start gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-stone-900 flex items-center justify-center flex-shrink-0">
              <Sparkles size={14} className="text-white" />
            </div>
            <div>
              <p className="text-xs font-semibold text-stone-900">Taha Media AI</p>
              <p className="text-[10px] text-stone-500 leading-relaxed mt-0.5">
                Powered by your OS — automate tasks, create scripts, and run SOP levels instantly.
              </p>
            </div>
          </div>

          {/* SOP Quick Actions */}
          <div>
            <p className="text-[10px] font-semibold text-stone-500 uppercase tracking-wider mb-2">⚡ SOP Quick-Run</p>
            <div className="grid grid-cols-2 gap-1.5">
              {SOP_ACTIONS.map(({ level, label, color }) => (
                <button
                  key={level}
                  onClick={() => {
                    if (canRun) {
                      setSopModal(level)
                    } else {
                      setInput(`Run L${level} SOP for [project name]`)
                      setViewMode('chat')
                    }
                  }}
                  className={cn(
                    'text-[10px] font-semibold px-2 py-1.5 rounded-md text-left border transition-opacity hover:opacity-80',
                    color, 'border-transparent'
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Prompt cards */}
          <div>
            <p className="text-[10px] font-semibold text-stone-500 uppercase tracking-wider mb-2">🎯 Prompt Templates</p>
            <div className="space-y-2">
              {PROMPT_CARDS.map((card) => (
                <button
                  key={card.label}
                  onClick={() => { setInput(card.prompt); setViewMode('chat') }}
                  className={cn(
                    'w-full text-left rounded-lg border p-3 transition-all hover:shadow-sm group',
                    card.color
                  )}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5 font-semibold text-[11px]">
                      {card.icon}
                      {card.label}
                    </div>
                    <ChevronRight size={11} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <p className="text-[10px] opacity-70 leading-relaxed">{card.description}</p>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Right panel: chat ── */}
        <div className={cn(
          "flex-1 flex flex-col overflow-hidden bg-white",
          viewMode === 'templates' ? 'hidden lg:flex' : 'flex'
        )}>
          {/* Chat header */}
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-stone-100 flex-shrink-0">
            <div className="flex items-center gap-2">
              <MessageSquare size={13} className="text-stone-400" />
              <span className="text-xs font-medium text-stone-600 mr-1">Chat</span>
              <button
                onClick={() => setViewMode('templates')}
                className="lg:hidden flex items-center gap-1 text-[10px] text-stone-500 hover:text-stone-700 bg-stone-100 hover:bg-stone-200 px-2 py-0.5 rounded-full transition-colors"
              >
                Templates & SOPs
              </button>
              {messages.length > 0 && (
                <span className="text-[10px] text-stone-400 bg-stone-100 px-1.5 py-0.5 rounded-full hidden sm:inline-block">
                  {messages.length} messages
                </span>
              )}
            </div>
            {messages.length > 0 && (
              <button
                onClick={clearChat}
                className="flex items-center gap-1 text-[11px] text-stone-400 hover:text-stone-700 px-2 py-1 rounded hover:bg-stone-100 transition-colors"
              >
                <RefreshCw size={11} /> Clear
              </button>
            )}
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center gap-3 pb-8">
                <div className="w-12 h-12 rounded-2xl bg-stone-100 flex items-center justify-center">
                  <Sparkles size={20} className="text-stone-400" />
                </div>
                <p className="text-sm font-semibold text-stone-700">Ask the AI anything</p>
                <p className="text-xs text-stone-400 max-w-xs leading-relaxed">
                  Use a prompt template on the left, run a SOP level, or type your own question below.
                </p>
              </div>
            )}

            {messages.map((msg, idx) => (
              <div
                key={msg.ts}
                className={cn('flex gap-2 group', msg.role === 'user' ? 'flex-row-reverse' : 'flex-row')}
              >
                {/* Avatar */}
                <div className={cn(
                  'w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5',
                  msg.role === 'user' ? 'bg-stone-900' : 'bg-stone-100'
                )}>
                  {msg.role === 'user'
                    ? <span className="text-[9px] font-bold text-white">You</span>
                    : <Sparkles size={10} className="text-stone-500" />
                  }
                </div>

                {/* Bubble */}
                <div className={cn(
                  'relative max-w-[75%] rounded-xl px-3 py-2 text-xs leading-relaxed',
                  msg.role === 'user'
                    ? 'bg-stone-900 text-white rounded-tr-sm'
                    : 'bg-stone-50 border border-stone-100 text-stone-800 rounded-tl-sm'
                )}>
                  <p className="whitespace-pre-wrap">{msg.content}</p>

                  {/* Copy button */}
                  {msg.role === 'assistant' && (
                    <button
                      onClick={() => copyMsg(msg.content, idx)}
                      className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-stone-200"
                    >
                      {copiedIdx === idx
                        ? <CheckCheck size={10} className="text-green-600" />
                        : <Copy size={10} className="text-stone-400" />
                      }
                    </button>
                  )}
                </div>
              </div>
            ))}

            {/* Loading indicator */}
            {loading && (
              <div className="flex gap-2">
                <div className="w-6 h-6 rounded-full bg-stone-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Sparkles size={10} className="text-stone-500" />
                </div>
                <div className="bg-stone-50 border border-stone-100 rounded-xl rounded-tl-sm px-3 py-2">
                  <div className="flex gap-1 items-center h-4">
                    {[0, 1, 2].map(i => (
                      <div
                        key={i}
                        className="w-1.5 h-1.5 rounded-full bg-stone-400 animate-bounce"
                        style={{ animationDelay: `${i * 150}ms` }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="flex-shrink-0 border-t border-stone-100 p-3">
            <form
              onSubmit={(e) => { e.preventDefault(); send(input) }}
              className="flex items-end gap-2"
            >
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    send(input)
                  }
                }}
                rows={2}
                placeholder="Ask something or pick a template…"
                className="flex-1 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-xs text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-400 resize-none leading-relaxed"
              />
              <button
                type="submit"
                disabled={!input.trim() || loading}
                className={cn(
                  'flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center transition-colors',
                  input.trim() && !loading
                    ? 'bg-stone-900 text-white hover:bg-stone-700'
                    : 'bg-stone-100 text-stone-400 cursor-not-allowed'
                )}
              >
                <Send size={14} />
              </button>
            </form>
            <p className="text-[10px] text-stone-400 mt-1.5 px-1">
              Press Enter to send · Shift+Enter for new line
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
