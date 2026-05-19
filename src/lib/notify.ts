// src/lib/notify.ts
// Uses Supabase REST API — no Prisma/TCP dependency.
import { sbInsert, sbInsertMany, nowTs } from '@/lib/supa'

interface NotifyArgs {
  userId: string
  title: string
  message: string
  type?: string
  link?: string | null
}

export async function notify(args: NotifyArgs): Promise<void> {
  try {
    if (!args.userId) return
    await sbInsert('notifications', {
      userId: args.userId,
      title: args.title.slice(0, 200),
      message: args.message.slice(0, 1000),
      type: args.type ?? 'GENERAL',
      read: false,
      link: args.link ?? null,
      createdAt: nowTs(),
    })
  } catch (err) {
    console.error('[notify] failed:', err)
  }
}

export async function notifyMany(
  userIds: string[],
  payload: Omit<NotifyArgs, 'userId'>
): Promise<void> {
  const unique = Array.from(new Set(userIds.filter(Boolean)))
  if (unique.length === 0) return
  try {
    const now = nowTs()
    await sbInsertMany(
      'notifications',
      unique.map(userId => ({
        userId,
        title: payload.title.slice(0, 200),
        message: payload.message.slice(0, 1000),
        type: payload.type ?? 'GENERAL',
        read: false,
        link: payload.link ?? null,
        createdAt: now,
      }))
    )
  } catch (err) {
    console.error('[notifyMany] failed:', err)
  }
}
