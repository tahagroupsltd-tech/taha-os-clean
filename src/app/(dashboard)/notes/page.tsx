'use client'
// src/app/(dashboard)/notes/page.tsx
import { useState, useEffect, useCallback } from 'react'
import { TopBar } from '@/components/layout/TopBar'
import { Button } from '@/components/ui/Button'
import { useAuthStore } from '@/store/auth.store'
import { cn, formatDateTime, formatTime } from '@/lib/utils'
import type { Note } from '@/types'
import { Plus, Pin, PinOff, Trash2, Search, Hash, X } from 'lucide-react'
import toast from 'react-hot-toast'

const ICON_OPTIONS = ['📝', '💡', '📌', '🎬', '📞', '🎯', '🔥', '⭐', '📅', '💰', '🎨', '🚀']

export default function NotesPage() {
  const user = useAuthStore((s) => s.user)
  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [activeId, setActiveId] = useState<string | null>(null)
  const [draft, setDraft] = useState<{ title: string; content: string; icon: string; tags: string[] }>({
    title: '', content: '', icon: '📝', tags: [],
  })
  const [tagInput, setTagInput] = useState('')
  const [savedAt, setSavedAt] = useState<string>('')

  const fetchNotes = useCallback(async (q?: string) => {
    setLoading(true)
    const params = new URLSearchParams()
    if (q) params.set('q', q)
    const res = await fetch(`/api/notes?${params}`)
    const json = await res.json()
    setNotes(json.data ?? [])
    setLoading(false)
    if (!activeId && json.data?.length) setActiveId(json.data[0].id)
  }, [activeId])

  useEffect(() => { fetchNotes() }, [])

  // Search debounce
  useEffect(() => {
    const t = setTimeout(() => fetchNotes(search), 250)
    return () => clearTimeout(t)
  }, [search])

  // Load active note into draft
  useEffect(() => {
    if (!activeId) {
      setDraft({ title: '', content: '', icon: '📝', tags: [] })
      return
    }
    const n = notes.find((x) => x.id === activeId)
    if (n) {
      setDraft({ title: n.title, content: n.content, icon: n.icon ?? '📝', tags: n.tags ?? [] })
    }
  }, [activeId, notes])

  // Auto-save on change (debounced)
  useEffect(() => {
    if (!activeId) return
    const original = notes.find((x) => x.id === activeId)
    if (!original) return
    const dirty =
      draft.title !== original.title ||
      draft.content !== original.content ||
      draft.icon !== (original.icon ?? '📝') ||
      JSON.stringify(draft.tags) !== JSON.stringify(original.tags ?? [])
    if (!dirty) return

    const t = setTimeout(async () => {
      const res = await fetch(`/api/notes/${activeId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      })
      if (res.ok) {
        const j = await res.json()
        setNotes((p) => p.map((x) => x.id === activeId ? j.data : x))
        setSavedAt(new Date().toISOString())
      }
    }, 600)
    return () => clearTimeout(t)
  }, [draft, activeId, notes])

  const createNote = async () => {
    const res = await fetch('/api/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Untitled', content: '', icon: '📝' }),
    })
    if (res.ok) {
      const j = await res.json()
      setNotes((p) => [j.data, ...p])
      setActiveId(j.data.id)
      toast.success('Note created')
    }
  }

  const togglePin = async (id: string, currentlyPinned: boolean) => {
    const res = await fetch(`/api/notes/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pinned: !currentlyPinned }),
    })
    if (res.ok) {
      const j = await res.json()
      setNotes((p) => {
        const updated = p.map((n) => n.id === id ? j.data : n)
        return [...updated].sort((a, b) =>
          (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) ||
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        )
      })
    }
  }

  const deleteNote = async (id: string) => {
    if (!confirm('Delete this note?')) return
    const res = await fetch(`/api/notes/${id}`, { method: 'DELETE' })
    if (res.ok) {
      const remaining = notes.filter((n) => n.id !== id)
      setNotes(remaining)
      if (activeId === id) setActiveId(remaining[0]?.id ?? null)
      toast.success('Deleted')
    }
  }

  const addTag = () => {
    const t = tagInput.trim().toLowerCase()
    if (!t) return
    if (draft.tags.includes(t)) { setTagInput(''); return }
    setDraft({ ...draft, tags: [...draft.tags, t] })
    setTagInput('')
  }

  const removeTag = (t: string) => {
    setDraft({ ...draft, tags: draft.tags.filter((x) => x !== t) })
  }

  const activeNote = notes.find((n) => n.id === activeId)

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <TopBar
        title="Notes"
        actions={
          <Button size="sm" onClick={createNote}>
            <Plus size={13} /> New note
          </Button>
        }
      />

      <div className="flex flex-1 overflow-hidden">
        {/* Note list */}
        <div className="w-72 border-r border-stone-100 bg-stone-50/30 flex flex-col">
          <div className="p-3 border-b border-stone-100">
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400" />
              <input
                type="text"
                placeholder="Search notes..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full text-xs pl-7 pr-2 py-2 rounded-md border border-stone-200 bg-white focus:outline-none focus:ring-2 focus:ring-stone-300"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <p className="text-xs text-stone-400 text-center py-8">Loading...</p>
            ) : notes.length === 0 ? (
              <div className="text-center py-12 px-4">
                <p className="text-xs text-stone-500 mb-2">No notes yet</p>
                <button onClick={createNote} className="text-xs text-stone-900 underline">
                  Create your first note
                </button>
              </div>
            ) : (
              notes.map((n) => (
                <button
                  key={n.id}
                  onClick={() => setActiveId(n.id)}
                  className={cn(
                    'w-full text-left px-3 py-2.5 border-b border-stone-100 hover:bg-white transition-colors flex gap-2',
                    activeId === n.id && 'bg-white'
                  )}
                >
                  <span className="text-base flex-shrink-0">{n.icon ?? '📝'}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                      {n.pinned && <Pin size={9} className="text-amber-600 flex-shrink-0" />}
                      <p className="text-xs font-semibold text-stone-900 truncate">{n.title || 'Untitled'}</p>
                    </div>
                    <p className="text-[10px] text-stone-400 truncate mt-0.5">
                      {n.content.slice(0, 60) || 'Empty note'}
                    </p>
                    <p className="text-[9px] text-stone-300 mt-1">
                      {formatDateTime(n.updatedAt)}
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Editor */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {!activeNote ? (
            <div className="flex-1 flex items-center justify-center text-stone-400 text-sm">
              Select a note or create a new one
            </div>
          ) : (
            <>
              {/* Toolbar */}
              <div className="flex items-center justify-between px-6 py-2 border-b border-stone-100">
                <div className="flex items-center gap-2">
                  <select
                    value={draft.icon}
                    onChange={(e) => setDraft({ ...draft, icon: e.target.value })}
                    className="text-xl bg-transparent border-none focus:outline-none cursor-pointer hover:bg-stone-100 rounded p-1"
                  >
                    {ICON_OPTIONS.map((i) => <option key={i} value={i}>{i}</option>)}
                  </select>
                  <span className="text-[10px] text-stone-400">
                    {savedAt ? `Saved ${formatTime(savedAt)}` : `Updated ${formatDateTime(activeNote.updatedAt)}`}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => togglePin(activeNote.id, activeNote.pinned)}
                    className={cn(
                      'p-1.5 rounded hover:bg-stone-100',
                      activeNote.pinned ? 'text-amber-600' : 'text-stone-400'
                    )}
                    title={activeNote.pinned ? 'Unpin' : 'Pin'}
                  >
                    {activeNote.pinned ? <PinOff size={13} /> : <Pin size={13} />}
                  </button>
                  <button
                    onClick={() => deleteNote(activeNote.id)}
                    className="p-1.5 rounded text-stone-400 hover:text-red-500 hover:bg-red-50"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>

              {/* Editor body */}
              <div className="flex-1 overflow-y-auto px-10 py-8">
                <input
                  type="text"
                  placeholder="Untitled"
                  value={draft.title}
                  onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                  className="w-full text-3xl font-bold text-stone-900 placeholder:text-stone-300 bg-transparent border-none focus:outline-none mb-3"
                />

                {/* Tags */}
                <div className="flex flex-wrap items-center gap-1.5 mb-4">
                  {draft.tags.map((t) => (
                    <span key={t} className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-stone-100 text-stone-600">
                      <Hash size={9} />
                      {t}
                      <button onClick={() => removeTag(t)} className="hover:text-red-500">
                        <X size={9} />
                      </button>
                    </span>
                  ))}
                  <input
                    type="text"
                    placeholder="+ tag"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') { e.preventDefault(); addTag() }
                    }}
                    className="text-[10px] px-2 py-0.5 bg-transparent border-b border-stone-200 focus:outline-none focus:border-stone-500 w-16"
                  />
                </div>

                <textarea
                  placeholder="Start writing..."
                  value={draft.content}
                  onChange={(e) => setDraft({ ...draft, content: e.target.value })}
                  className="w-full min-h-[60vh] text-sm text-stone-700 leading-relaxed bg-transparent border-none focus:outline-none resize-none placeholder:text-stone-300"
                />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
