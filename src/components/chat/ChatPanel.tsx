'use client'
// src/components/chat/ChatPanel.tsx
// Right-side sliding panel — keeps the element in the DOM for smooth transition.
import { useEffect, useRef, useState } from 'react'
import { X, Send, Sparkles, RotateCcw, Bot } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Msg {
  role: 'user' | 'assistant'
  content: string
}

interface Props {
  open: boolean
  onClose: () => void
}

const STORAGE_KEY = 'taha_chat_history'
const HISTORY_CAP = 30

const SUGGESTIONS = [
  'Add a calendar event for AXS shoot from May 1 to May 30, assign to editor1',
  'Create task: edit the AXS reel, urgent, due Friday, assign to editor1',
  'Add a CRM lead called "Karthick project", stage Qualified, assign to me',
  'Create a CRM contact: Karthick, phone 9876543210, company AXS Media',
]

export function ChatPanel({ open, onClose }: Props) {
  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Restore history on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed)) setMessages(parsed.slice(-HISTORY_CAP))
      }
    } catch { /* ignore */ }
  }, [])

  // Persist on change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-HISTORY_CAP)))
    } catch { /* quota — ignore */ }
  }, [messages])

  // Auto-scroll on new message or typing indicator
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, sending])

  // Focus textarea when panel opens
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 320)
  }, [open])

  const send = async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || sending) return
    const next: Msg[] = [...messages, { role: 'user', content: trimmed }]
    setMessages(next)
    setInput('')
    setSending(true)
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next }),
      })
      const json = await res.json()
      setMessages([
        ...next,
        {
          role: 'assistant',
          content: res.ok ? (json.reply || '(no reply)') : `⚠️ ${json.error ?? 'Request failed'}`,
        },
      ])
    } catch (err: any) {
      setMessages([...next, { role: 'assistant', content: `⚠️ ${err?.message ?? 'Network error'}` }])
    } finally {
      setSending(false)
    }
  }

  const reset = () => {
    setMessages([])
    try { localStorage.removeItem(STORAGE_KEY) } catch { /* ignore */ }
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send(input)
    }
  }

  return (
    <>
      {/* Backdrop — only on mobile / tablet */}
      <div
        className={cn(
          'fixed inset-0 bg-black/25 z-40 transition-opacity duration-300 lg:hidden',
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        )}
        onClick={onClose}
        aria-hidden
      />

      {/* Sliding panel */}
      <aside
        className={cn(
          'fixed top-0 right-0 bottom-0 z-50',
          'w-full sm:w-[380px]',
          'bg-white border-l border-stone-200 shadow-2xl',
          'flex flex-col',
          'transition-transform duration-300 ease-in-out',
          open ? 'translate-x-0' : 'translate-x-full'
        )}
        aria-label="AI Assistant"
      >
        {/* ── Header ── */}
        <header className="flex items-center justify-between px-4 py-3.5 border-b border-stone-100 bg-white">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-stone-900 flex items-center justify-center shadow-sm">
              <Sparkles size={14} className="text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold text-stone-900 leading-tight">AI Assistant</p>
              <p className="text-[10px] text-stone-400 leading-tight">Tasks · Events · Projects · Content · CRM</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {messages.length > 0 && (
              <button
                onClick={reset}
                className="p-1.5 rounded-md text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors"
                title="Clear conversation"
              >
                <RotateCcw size={13} />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-md text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors"
              aria-label="Close assistant"
            >
              <X size={15} />
            </button>
          </div>
        </header>

        {/* ── Messages ── */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {messages.length === 0 ? (
            <div className="space-y-4">
              {/* Welcome */}
              <div className="flex items-start gap-2.5">
                <div className="w-6 h-6 rounded-full bg-stone-900 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Bot size={11} className="text-white" />
                </div>
                <p className="text-xs text-stone-600 leading-relaxed bg-stone-50 rounded-xl rounded-tl-sm px-3 py-2.5">
                  Hi! I can create tasks, events, content, projects, users, and CRM records (leads, contacts, companies, deals) — just tell me what you need. Try one of these:
                </p>
              </div>
              {/* Suggestion chips */}
              <div className="space-y-2 pl-8">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="w-full text-left text-[11px] text-stone-600 bg-stone-50 hover:bg-stone-100 border border-stone-200 rounded-lg px-3 py-2 transition-colors leading-relaxed"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((m, i) => (
              <div
                key={i}
                className={cn('flex items-end gap-2', m.role === 'user' ? 'justify-end' : 'justify-start')}
              >
                {m.role === 'assistant' && (
                  <div className="w-6 h-6 rounded-full bg-stone-900 flex items-center justify-center flex-shrink-0 mb-0.5">
                    <Bot size={11} className="text-white" />
                  </div>
                )}
                <div
                  className={cn(
                    'rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed max-w-[82%] whitespace-pre-wrap',
                    m.role === 'user'
                      ? 'bg-stone-900 text-white rounded-br-sm'
                      : 'bg-stone-100 text-stone-800 rounded-bl-sm'
                  )}
                >
                  {m.content}
                </div>
              </div>
            ))
          )}

          {/* Typing indicator */}
          {sending && (
            <div className="flex items-end gap-2 justify-start">
              <div className="w-6 h-6 rounded-full bg-stone-900 flex items-center justify-center flex-shrink-0 mb-0.5">
                <Bot size={11} className="text-white" />
              </div>
              <div className="bg-stone-100 rounded-2xl rounded-bl-sm px-3.5 py-3">
                <span className="inline-flex gap-1 items-center">
                  <span className="w-1.5 h-1.5 rounded-full bg-stone-400 animate-bounce" />
                  <span className="w-1.5 h-1.5 rounded-full bg-stone-400 animate-bounce [animation-delay:130ms]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-stone-400 animate-bounce [animation-delay:260ms]" />
                </span>
              </div>
            </div>
          )}
        </div>

        {/* ── Input ── */}
        <div className="border-t border-stone-100 p-3 bg-white">
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Ask me to create or manage something…"
              rows={1}
              disabled={sending}
              className="flex-1 resize-none rounded-xl border border-stone-200 bg-stone-50 px-3.5 py-2.5 text-xs text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-300 focus:bg-white max-h-32 disabled:opacity-50 transition-colors"
            />
            <button
              onClick={() => send(input)}
              disabled={!input.trim() || sending}
              className="p-2.5 rounded-xl bg-stone-900 text-white hover:bg-stone-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95"
              aria-label="Send"
            >
              <Send size={13} />
            </button>
          </div>
          <p className="text-[10px] text-stone-400 mt-2 pl-1">
            Enter ↵ to send · Shift+Enter for new line
          </p>
        </div>
      </aside>
    </>
  )
}
