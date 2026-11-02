'use client'
// src/app/(client-portal)/portal/messages/page.tsx
import { useEffect, useRef, useState } from 'react'
import { useAuthStore } from '@/store/auth.store'
import { formatDate } from '@/lib/utils'
import type { Note } from '@/types'
import { Send, MessageSquare } from 'lucide-react'
import toast from 'react-hot-toast'

// We use notes with tag 'client_message' for the messaging feature.
// Messages from the client (ownerId === user.id) appear on the right (blue).
// Messages from team appear on the left (stone).

export default function PortalMessagesPage() {
  const { user } = useAuthStore()
  const [messages, setMessages] = useState<Note[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  const fetchMessages = async () => {
    try {
      const res = await fetch('/api/notes?tag=client_message')
      const data = await res.json()
      // Filter notes that are tagged client_message; owner might be client or team
      // We only show notes where either ownerId === user.id (client's own messages)
      // OR notes that are replies/messages from team (different ownerId but same project context)
      // Since we can't filter by projectId here easily without knowing them,
      // we show all notes with client_message tag — the API already filters by ownerId for clients
      // Team messages to this client would need a separate mechanism.
      // For now, show all notes tagged client_message that the API returns.
      const notes: Note[] = data.data ?? []
      // Sort by createdAt ascending
      notes.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      setMessages(notes)
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchMessages()
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async () => {
    if (!message.trim()) return
    setSending(true)
    try {
      const res = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `Message from ${user?.name}`,
          content: message.trim(),
          tags: ['client_message'],
          icon: '💬',
        }),
      })
      if (!res.ok) {
        const j = await res.json()
        throw new Error(j.error ?? 'Failed to send')
      }
      setMessage('')
      await fetchMessages()
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setSending(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="space-y-4 flex flex-col h-[calc(100vh-160px)]">
      <div>
        <h1 className="text-xl font-bold text-stone-900">Messages</h1>
        <p className="text-sm text-stone-400 mt-0.5">Chat with the Taha Media team</p>
      </div>

      {/* Message thread */}
      <div className="flex-1 bg-white border border-stone-200 rounded-2xl overflow-hidden flex flex-col">
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <MessageSquare className="w-10 h-10 text-stone-300 mb-3" />
              <p className="text-sm text-stone-400">No messages yet</p>
              <p className="text-xs text-stone-300 mt-1">Send a message to the Taha Media team below</p>
            </div>
          ) : (
            messages.map((msg) => {
              const isOwn = msg.ownerId === user?.id
              return (
                <div
                  key={msg.id}
                  className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-xs sm:max-w-sm md:max-w-md rounded-2xl px-4 py-3 ${
                      isOwn
                        ? 'bg-blue-600 text-white rounded-br-sm'
                        : 'bg-stone-100 text-stone-900 rounded-bl-sm'
                    }`}
                  >
                    {!isOwn && (
                      <p className={`text-[10px] font-semibold mb-1 ${isOwn ? 'text-blue-200' : 'text-stone-400'}`}>
                        {msg.owner?.name ?? 'Team'}
                      </p>
                    )}
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                    <p className={`text-[10px] mt-1.5 ${isOwn ? 'text-blue-200' : 'text-stone-400'} text-right`}>
                      {new Date(msg.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                      {' · '}
                      {formatDate(msg.createdAt)}
                    </p>
                  </div>
                </div>
              )
            })
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="border-t border-stone-100 p-4 flex items-end gap-3">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message… (Enter to send)"
            rows={1}
            className="flex-1 resize-none px-3 py-2.5 text-sm bg-stone-50 border border-stone-200 rounded-xl text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
            style={{ maxHeight: '120px' }}
          />
          <button
            onClick={handleSend}
            disabled={sending || !message.trim()}
            className="shrink-0 w-10 h-10 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl flex items-center justify-center transition-colors"
          >
            {sending ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
