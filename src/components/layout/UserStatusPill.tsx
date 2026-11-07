// src/components/layout/UserStatusPill.tsx
'use client'
import { useState, useRef, useEffect } from 'react'
import { useAuthStore } from '@/store/auth.store'
import { getLevelInfo } from '@/lib/gamification'
import type { AvailabilityStatus } from '@/types'
import toast from 'react-hot-toast'
import { Flame, Zap, Check, ChevronDown, Award } from 'lucide-react'

const AVAILABILITY_CONFIG: Record<AvailabilityStatus, { label: string; dot: string; bg: string; text: string }> = {
  AVAILABLE: {
    label: 'Available',
    dot: 'bg-emerald-500',
    bg: 'bg-emerald-50 border-emerald-200/60',
    text: 'text-emerald-700',
  },
  ON_SHOOT: {
    label: 'On Shoot',
    dot: 'bg-amber-500 animate-pulse',
    bg: 'bg-amber-50 border-amber-200/60',
    text: 'text-amber-800',
  },
  ON_LEAVE: {
    label: 'On Leave',
    dot: 'bg-rose-500',
    bg: 'bg-rose-50 border-rose-200/60',
    text: 'text-rose-700',
  },
}

export function UserStatusPill() {
  const { user, setUser } = useAuthStore()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Sync latest user status & XP
  useEffect(() => {
    if (!user || user.role === 'CLIENT') return
    fetch('/api/auth/me')
      .then(r => r.json())
      .then(j => {
        if (j?.data) {
          setUser({
            ...user,
            availabilityStatus: j.data.availabilityStatus ?? user.availabilityStatus ?? 'AVAILABLE',
            xp: j.data.xp ?? user.xp ?? 0,
            streak: j.data.streak ?? user.streak ?? 1,
            level: j.data.level ?? user.level ?? 1,
          })
        }
      })
      .catch(() => {})
  }, [])

  // Close on outside click
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

  const availStatus = (user.availabilityStatus || 'AVAILABLE') as AvailabilityStatus
  const avail = AVAILABILITY_CONFIG[availStatus] || AVAILABILITY_CONFIG.AVAILABLE
  const xp = user.xp || 0
  const streak = user.streak || 1
  const levelInfo = getLevelInfo(xp)

  const handleSetAvailability = async (newStatus: AvailabilityStatus) => {
    if (newStatus === availStatus) return
    setSaving(true)
    try {
      const res = await fetch('/api/auth/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ availabilityStatus: newStatus }),
      })
      if (!res.ok) throw new Error()
      setUser({ ...user, availabilityStatus: newStatus })
      toast.success(`Status: ${AVAILABILITY_CONFIG[newStatus].label}`)
    } catch {
      toast.error('Could not update status')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="relative inline-block text-left" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-[11px] font-medium bg-white hover:bg-stone-50 border border-stone-200/80 shadow-2xs transition-all"
        title="Your Status, XP & Rank"
      >
        <span className="flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full ${avail.dot}`} />
          <span className="text-stone-700 font-semibold">{avail.label}</span>
        </span>
        <span className="text-stone-300">·</span>
        <span className="flex items-center gap-1 text-amber-700 font-bold">
          <Flame size={12} className="fill-orange-500 text-orange-500" />
          <span>{streak}d</span>
          <span className="text-stone-300 font-normal">·</span>
          <span>{xp.toLocaleString()} XP</span>
        </span>
        <ChevronDown size={10} className={`text-stone-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 mt-1.5 w-64 rounded-xl bg-white shadow-xl border border-stone-100 p-3 z-50 animate-in fade-in slide-in-from-top-1 text-stone-800">
          {/* Availability Switcher */}
          <div className="mb-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400 mb-1.5">
              Live Status
            </p>
            <div className="grid grid-cols-3 gap-1">
              {(Object.keys(AVAILABILITY_CONFIG) as AvailabilityStatus[]).map((st) => {
                const conf = AVAILABILITY_CONFIG[st]
                const isSelected = st === availStatus
                return (
                  <button
                    key={st}
                    onClick={() => handleSetAvailability(st)}
                    disabled={saving}
                    className={`py-1.5 px-2 rounded-lg text-xs font-medium flex items-center justify-center gap-1 transition-all ${
                      isSelected
                        ? `${conf.bg} ${conf.text} font-bold shadow-2xs`
                        : 'text-stone-500 hover:bg-stone-50'
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${conf.dot}`} />
                    <span>{conf.label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="h-px bg-stone-100 my-2.5" />

          {/* Level & Rank Summary */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-extrabold text-stone-900 flex items-center gap-1">
                {levelInfo.badge} Level {levelInfo.level} · {levelInfo.title}
              </span>
              <span className="text-[10px] font-mono text-stone-400">{xp.toLocaleString()} XP</span>
            </div>
            <div className="w-full h-1.5 bg-stone-100 rounded-full overflow-hidden mt-1.5">
              <div
                className="h-full bg-gradient-to-r from-amber-400 to-orange-400 rounded-full"
                style={{ width: `${levelInfo.progressPct}%` }}
              />
            </div>
            <p className="text-[10px] text-stone-400 mt-1">
              {levelInfo.xpToNext > 0 ? `${levelInfo.xpToNext.toLocaleString()} XP to next level` : 'Top rank reached'}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
