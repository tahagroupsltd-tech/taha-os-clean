'use client'
// src/components/layout/NotificationBell.tsx
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Bell, CheckCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'

interface Notification {
  id: string
  title: string
  message: string
  type: string
  read: boolean
  link: string | null
  createdAt: string
}

const POLL_INTERVAL_MS = 30_000 // 30s

function timeAgo(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(iso).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
  })
}

export function NotificationBell() {
  const router = useRouter()
  const [items, setItems] = useState<Notification[]>([])
  const [unread, setUnread] = useState(0)
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const seenIdsRef = useRef<Set<string>>(new Set())
  const isFirstLoadRef = useRef(true)

  const fetchAll = async () => {
    try {
      const res = await fetch('/api/notifications?limit=15', { cache: 'no-store' })
      if (!res.ok) return
      const json = await res.json()
      const incoming: Notification[] = json.data ?? []

      // ── Detect new notifications since last poll and show a toast ──
      if (!isFirstLoadRef.current) {
        const newOnes = incoming.filter(
          (n) => !n.read && !seenIdsRef.current.has(n.id)
        )
        // Cap toasts to 3 per poll cycle to avoid spam if many arrive at once
        for (const n of newOnes.slice(0, 3)) {
          toast(
            (t) => (
              <button
                onClick={() => {
                  toast.dismiss(t.id)
                  if (n.link) router.push(n.link)
                }}
                className="text-left"
              >
                <p className="text-xs font-semibold text-stone-900">{n.title}</p>
                <p className="text-[11px] text-stone-500 mt-0.5 line-clamp-2">
                  {n.message}
                </p>
              </button>
            ),
            { duration: 6000, icon: '🔔' }
          )
        }
        if (newOnes.length > 3) {
          toast(`+${newOnes.length - 3} more notifications`, { icon: '🔔' })
        }
      } else {
        isFirstLoadRef.current = false
      }

      // Track every id we've seen so we don't re-toast on next poll
      seenIdsRef.current = new Set(incoming.map((n) => n.id))

      setItems(incoming)
      setUnread(json.unreadCount ?? 0)
    } catch {
      /* ignore — best effort */
    }
  }

  // Initial load + polling
  useEffect(() => {
    fetchAll()
    const id = setInterval(fetchAll, POLL_INTERVAL_MS)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Refresh when dropdown opens
  useEffect(() => {
    if (open) fetchAll()
  }, [open])

  // Click outside closes the dropdown
  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  const markRead = async (id: string) => {
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)))
    setUnread((u) => Math.max(0, u - 1))
    try {
      await fetch(`/api/notifications/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ read: true }),
      })
    } catch {
      /* will reconcile on next poll */
    }
  }

  const markAllRead = async () => {
    setItems((prev) => prev.map((n) => ({ ...n, read: true })))
    setUnread(0)
    try {
      await fetch('/api/notifications/read-all', { method: 'PATCH' })
    } catch {
      /* ignore */
    }
  }

  const handleClick = async (n: Notification) => {
    if (!n.read) await markRead(n.id)
    setOpen(false)
    if (n.link) router.push(n.link)
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative p-2 rounded-md text-stone-500 hover:text-stone-900 hover:bg-stone-100 transition-colors"
        aria-label="Notifications"
      >
        <Bell size={16} />
        {unread > 0 && (
          <span className="absolute top-0.5 right-0.5 min-w-[16px] h-[16px] px-1 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center leading-none">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 max-h-[480px] bg-white rounded-lg border border-stone-200 shadow-lg z-50 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-stone-100">
            <p className="text-xs font-semibold text-stone-900">
              Notifications
              {unread > 0 && (
                <span className="ml-2 text-[10px] font-medium text-stone-400">
                  {unread} new
                </span>
              )}
            </p>
            {unread > 0 && (
              <button
                onClick={markAllRead}
                className="flex items-center gap-1 text-[10px] font-medium text-stone-500 hover:text-stone-900"
              >
                <CheckCheck size={11} /> Mark all read
              </button>
            )}
          </div>
          <div className="flex-1 overflow-y-auto">
            {items.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <p className="text-xs text-stone-400">No notifications yet</p>
              </div>
            ) : (
              <ul className="divide-y divide-stone-50">
                {items.map((n) => (
                  <li key={n.id}>
                    <button
                      onClick={() => handleClick(n)}
                      className={cn(
                        'w-full text-left px-4 py-3 hover:bg-stone-50 transition-colors',
                        !n.read && 'bg-blue-50/40'
                      )}
                    >
                      <div className="flex items-start gap-2">
                        {!n.read && (
                          <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p
                            className={cn(
                              'text-xs leading-snug',
                              n.read ? 'text-stone-700' : 'font-semibold text-stone-900'
                            )}
                          >
                            {n.title}
                          </p>
                          <p className="text-[11px] text-stone-500 mt-0.5 leading-snug line-clamp-2">
                            {n.message}
                          </p>
                          <p className="text-[10px] text-stone-400 mt-1">
                            {timeAgo(n.createdAt)}
                          </p>
                        </div>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
