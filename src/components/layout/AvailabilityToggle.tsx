// src/components/layout/AvailabilityToggle.tsx
'use client'
import { useState, useRef, useEffect } from 'react'
import { useAuthStore } from '@/store/auth.store'
import type { AvailabilityStatus } from '@/types'
import toast from 'react-hot-toast'
import { ChevronDown, Check } from 'lucide-react'

const STATUS_CONFIG: Record<AvailabilityStatus, { label: string; dot: string; bg: string; text: string; desc: string }> = {
  AVAILABLE: {
    label: 'Available',
    dot: 'bg-emerald-500',
    bg: 'bg-emerald-50 border-emerald-200/60',
    text: 'text-emerald-700',
    desc: 'Ready for tasks & editing',
  },
  ON_SHOOT: {
    label: 'On Shoot',
    dot: 'bg-amber-500 animate-pulse',
    bg: 'bg-amber-50 border-amber-200/60',
    text: 'text-amber-800',
    desc: 'On set / shooting on location',
  },
  ON_LEAVE: {
    label: 'On Leave',
    dot: 'bg-rose-500',
    bg: 'bg-rose-50 border-rose-200/60',
    text: 'text-rose-700',
    desc: 'Away / unavailable for tasks',
  },
}

export function AvailabilityToggle() {
  const { user, setUser } = useAuthStore()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Sync initial status if not in auth store
  useEffect(() => {
    if (!user || user.role === 'CLIENT') return
    if (!user.availabilityStatus) {
      fetch('/api/auth/me')
        .then(r => r.json())
        .then(j => {
          if (j?.data?.availabilityStatus) {
            setUser({ ...user, availabilityStatus: j.data.availabilityStatus })
          }
        })
        .catch(() => {})
    }
  }, [user, setUser])

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [open])

  if (!user || user.role === 'CLIENT') return null

  const currentStatus: AvailabilityStatus = user.availabilityStatus || 'AVAILABLE'
  const current = STATUS_CONFIG[currentStatus] || STATUS_CONFIG.AVAILABLE

  const handleSelect = async (newStatus: AvailabilityStatus) => {
    if (newStatus === currentStatus) {
      setOpen(false)
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/auth/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ availabilityStatus: newStatus }),
      })
      if (!res.ok) throw new Error()
      setUser({ ...user, availabilityStatus: newStatus })
      toast.success(`Availability set to: ${STATUS_CONFIG[newStatus].label}`)
      setOpen(false)
    } catch {
      toast.error('Failed to update status')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="relative inline-block text-left" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        disabled={saving}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors ${current.bg} ${current.text} hover:opacity-90 shadow-2xs`}
        title="Click to toggle your availability"
      >
        <span className={`w-2 h-2 rounded-full ${current.dot}`} />
        <span>{current.label}</span>
        <ChevronDown size={11} className={`opacity-60 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 mt-1.5 w-52 rounded-xl bg-white shadow-xl border border-stone-100 p-1.5 z-50 animate-in fade-in slide-in-from-top-1">
          <div className="px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-stone-400 border-b border-stone-50 mb-1">
            Staff Availability
          </div>
          {(Object.keys(STATUS_CONFIG) as AvailabilityStatus[]).map((status) => {
            const item = STATUS_CONFIG[status]
            const isSelected = status === currentStatus
            return (
              <button
                key={status}
                onClick={() => handleSelect(status)}
                className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-left text-xs transition-colors ${
                  isSelected ? 'bg-stone-50 text-stone-900 font-medium' : 'text-stone-600 hover:bg-stone-50/70'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${item.dot}`} />
                  <div>
                    <p className="text-xs font-medium text-stone-800 leading-tight">{item.label}</p>
                    <p className="text-[10px] text-stone-400 leading-tight">{item.desc}</p>
                  </div>
                </div>
                {isSelected && <Check size={13} className="text-stone-900 flex-shrink-0" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
