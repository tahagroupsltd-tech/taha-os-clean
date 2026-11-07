// src/components/layout/GamificationPill.tsx
'use client'
import { useState, useEffect } from 'react'
import { useAuthStore } from '@/store/auth.store'
import { getLevelInfo, LEVEL_TIERS } from '@/lib/gamification'
import { Modal } from '@/components/ui/Modal'
import { Flame, Zap, Trophy, Award, CheckCircle2, Star, Shield, ArrowRight } from 'lucide-react'

export function GamificationPill() {
  const { user, setUser } = useAuthStore()
  const [open, setOpen] = useState(false)

  // Sync latest XP & streak from API
  useEffect(() => {
    if (!user || user.role === 'CLIENT') return
    fetch('/api/auth/me')
      .then(r => r.json())
      .then(j => {
        if (j?.data) {
          setUser({
            ...user,
            xp: j.data.xp ?? user.xp ?? 0,
            streak: j.data.streak ?? user.streak ?? 1,
            level: j.data.level ?? user.level ?? 1,
          })
        }
      })
      .catch(() => {})
  }, [])

  if (!user || user.role === 'CLIENT') return null

  const xp = user.xp || 0
  const streak = user.streak || 1
  const levelInfo = getLevelInfo(xp)

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/70 text-amber-800 hover:shadow-xs transition-all shadow-2xs"
        title="Click to view your DRI Level, XP & Badges"
      >
        <span className="flex items-center gap-0.5 text-orange-600 font-bold">
          <Flame size={12} className="fill-orange-500 text-orange-500 animate-pulse" />
          {streak}d
        </span>
        <span className="text-stone-300">·</span>
        <span className="flex items-center gap-1 font-bold text-amber-900">
          <Zap size={11} className="fill-amber-500 text-amber-500" />
          {xp.toLocaleString()} XP
        </span>
        <span className="text-[10px] bg-amber-500/15 text-amber-900 font-extrabold px-1.5 py-0.2 rounded-full border border-amber-300/40">
          Lvl {levelInfo.level}
        </span>
      </button>

      {open && (
        <Modal open={open} onClose={() => setOpen(false)} title="DRI Performance & Gamification" size="lg">
          <div className="space-y-5">
            {/* Header card with current Level & XP */}
            <div className="bg-gradient-to-br from-stone-900 via-stone-800 to-amber-950 text-white rounded-xl p-5 shadow-sm relative overflow-hidden">
              <div className="absolute right-4 -bottom-4 text-7xl opacity-10 select-none">
                {levelInfo.badge}
              </div>
              <div className="flex items-start justify-between relative z-10">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-amber-400">
                    DRI Rank · Level {levelInfo.level}
                  </span>
                  <h3 className="text-xl font-extrabold mt-0.5 flex items-center gap-2">
                    {levelInfo.badge} {levelInfo.title}
                  </h3>
                  <p className="text-xs text-stone-300 mt-1">
                    Directly Responsible Individual: <strong className="text-white">{user.name}</strong>
                  </p>
                </div>
                <div className="text-right">
                  <div className="inline-flex items-center gap-1 bg-orange-500/20 border border-orange-500/40 px-2.5 py-1 rounded-full text-xs font-bold text-orange-300">
                    <Flame size={13} className="fill-orange-400 text-orange-400" />
                    {streak} Day Streak
                  </div>
                  <p className="text-[11px] text-amber-200/80 mt-1.5 font-mono">{xp.toLocaleString()} Total XP</p>
                </div>
              </div>

              {/* XP Progress bar */}
              <div className="mt-5 relative z-10">
                <div className="flex justify-between text-[11px] font-medium text-stone-300 mb-1.5">
                  <span>Level Progress ({levelInfo.progressPct}%)</span>
                  <span>{levelInfo.xpToNext > 0 ? `${levelInfo.xpToNext.toLocaleString()} XP to Level ${levelInfo.level + 1}` : 'Max Tier Achieved'}</span>
                </div>
                <div className="h-2.5 w-full bg-stone-700/80 rounded-full overflow-hidden p-0.5 border border-stone-600/50">
                  <div
                    className="h-full bg-gradient-to-r from-amber-400 via-orange-400 to-amber-300 rounded-full transition-all duration-700 shadow-xs"
                    style={{ width: `${Math.min(100, Math.max(5, levelInfo.progressPct))}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Achievement Badges */}
            <div>
              <p className="text-xs font-bold text-stone-700 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                <Award size={14} className="text-amber-500" /> Earned Badges & Milestones
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className={`p-3 rounded-lg border text-center transition-all ${
                  xp >= 500 ? 'bg-amber-50/70 border-amber-200/80 text-amber-900' : 'bg-stone-50 border-stone-100 text-stone-400 opacity-60'
                }`}>
                  <span className="text-2xl block mb-1">⚡</span>
                  <p className="text-xs font-bold">Speed Demon</p>
                  <p className="text-[10px] mt-0.5">{xp >= 500 ? 'Unlocked' : 'Reach 500 XP'}</p>
                </div>

                <div className={`p-3 rounded-lg border text-center transition-all ${
                  streak >= 3 ? 'bg-orange-50/70 border-orange-200/80 text-orange-900' : 'bg-stone-50 border-stone-100 text-stone-400 opacity-60'
                }`}>
                  <span className="text-2xl block mb-1">🔥</span>
                  <p className="text-xs font-bold">Streak Master</p>
                  <p className="text-[10px] mt-0.5">{streak >= 3 ? `${streak}d Active` : '3d Streak req.'}</p>
                </div>

                <div className={`p-3 rounded-lg border text-center transition-all ${
                  xp >= 1500 ? 'bg-emerald-50/70 border-emerald-200/80 text-emerald-900' : 'bg-stone-50 border-stone-100 text-stone-400 opacity-60'
                }`}>
                  <span className="text-2xl block mb-1">🎯</span>
                  <p className="text-xs font-bold">DRI Assassin</p>
                  <p className="text-[10px] mt-0.5">{xp >= 1500 ? 'Unlocked' : 'Reach 1,500 XP'}</p>
                </div>

                <div className={`p-3 rounded-lg border text-center transition-all ${
                  xp >= 3500 ? 'bg-purple-50/70 border-purple-200/80 text-purple-900' : 'bg-stone-50 border-stone-100 text-stone-400 opacity-60'
                }`}>
                  <span className="text-2xl block mb-1">👑</span>
                  <p className="text-xs font-bold">Lead Director</p>
                  <p className="text-[10px] mt-0.5">{xp >= 3500 ? 'Unlocked' : 'Reach 3,500 XP'}</p>
                </div>
              </div>
            </div>

            {/* XP Scoring Rules */}
            <div className="bg-stone-50 rounded-lg p-3.5 border border-stone-200/60">
              <p className="text-xs font-bold text-stone-800 uppercase tracking-wider mb-2">How DRI XP is Earned</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-stone-600">
                <div className="flex items-center gap-2">
                  <span className="text-emerald-600 font-bold">+100 XP</span>
                  <span>On-Time DRI Task Completion</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-amber-600 font-bold">+150 XP</span>
                  <span>Task completed &gt;24h early (Speed Bonus)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-blue-600 font-bold">+200 XP</span>
                  <span>Content Video / Reel POSTED</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-purple-600 font-bold">+100 XP</span>
                  <span>SOP Checkpoint Cleared</span>
                </div>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </>
  )
}
