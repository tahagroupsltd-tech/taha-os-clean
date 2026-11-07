// src/lib/gamification.ts
import { sbFindOne, sbUpdate, nowTs } from './supa'

export interface LevelThreshold {
  level: number
  title: string
  minXp: number
  maxXp: number
  badge: string
}

export const LEVEL_TIERS: LevelThreshold[] = [
  { level: 1, title: 'Apprentice', minXp: 0, maxXp: 500, badge: '🌱' },
  { level: 2, title: 'Producer', minXp: 501, maxXp: 1500, badge: '⚡' },
  { level: 3, title: 'Specialist', minXp: 1501, maxXp: 3500, badge: '🎯' },
  { level: 4, title: 'Senior Creator', minXp: 3501, maxXp: 7000, badge: '🔥' },
  { level: 5, title: 'Master Producer', minXp: 7001, maxXp: 12000, badge: '👑' },
  { level: 6, title: 'Elite Director', minXp: 12001, maxXp: 999999, badge: '🏆' },
]

export function getLevelInfo(xp: number = 0) {
  const safeXp = Math.max(0, xp || 0)
  const tier = LEVEL_TIERS.find(t => safeXp >= t.minXp && safeXp <= t.maxXp) || LEVEL_TIERS[LEVEL_TIERS.length - 1]
  
  const span = tier.maxXp - tier.minXp
  const currentInTier = safeXp - tier.minXp
  const progressPct = tier.level === 6 ? 100 : Math.min(100, Math.max(0, Math.round((currentInTier / span) * 100)))

  return {
    level: tier.level,
    title: tier.title,
    badge: tier.badge,
    currentXp: safeXp,
    minXp: tier.minXp,
    maxXp: tier.maxXp,
    progressPct,
    xpToNext: tier.level === 6 ? 0 : Math.max(0, tier.maxXp - safeXp + 1),
  }
}

/**
 * Awards XP and updates streaks for a user in the database.
 */
export async function awardUserXp(userId: string, xpDelta: number, isStreakActivity: boolean = true) {
  if (!userId || xpDelta === 0) return null

  try {
    const user = await sbFindOne('users', {
      select: 'id,xp,streak,level,lastActiveDate',
      filters: { id: `eq.${userId}` },
    })
    if (!user) return null

    const currentXp = Number(user.xp) || 0
    const newXp = Math.max(0, currentXp + xpDelta)
    const { level: newLevel } = getLevelInfo(newXp)

    // Calculate streak
    let newStreak = Number(user.streak) || 1
    const today = new Date().toISOString().split('T')[0]
    const lastActive = user.lastActiveDate

    if (isStreakActivity) {
      if (!lastActive) {
        newStreak = 1
      } else if (lastActive === today) {
        // Already active today, streak stays the same
      } else {
        const last = new Date(lastActive)
        const curr = new Date(today)
        const diffDays = Math.round((curr.getTime() - last.getTime()) / (1000 * 3600 * 24))
        if (diffDays === 1) {
          newStreak += 1 // consecutive day!
        } else if (diffDays > 1) {
          newStreak = 1 // missed days, reset streak
        }
      }
    }

    await sbUpdate('users', { id: `eq.${userId}` }, {
      xp: newXp,
      level: newLevel,
      streak: newStreak,
      lastActiveDate: today,
      updatedAt: nowTs(),
    })

    return {
      xpEarned: xpDelta,
      totalXp: newXp,
      level: newLevel,
      streak: newStreak,
      levelUp: newLevel > (Number(user.level) || 1),
    }
  } catch (err) {
    console.error('[gamification] failed to award XP:', err)
    return null
  }
}
