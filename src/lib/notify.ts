// src/lib/notify.ts
// Lightweight wrapper for creating notifications. Always non-blocking & best-effort —
// a notification failure should never break the underlying mutation (task save, etc.)
import { db } from '@/lib/db'
import { NotificationType } from '@prisma/client'

interface NotifyArgs {
  userId: string
  title: string
  message: string
  type?: NotificationType
  link?: string | null
}

export async function notify(args: NotifyArgs): Promise<void> {
  try {
    if (!args.userId) return
    await db.notification.create({
      data: {
        userId: args.userId,
        title: args.title.slice(0, 200),
        message: args.message.slice(0, 1000),
        type: args.type ?? 'GENERAL',
        link: args.link ?? null,
      },
    })
  } catch (err) {
    console.error('[notify] failed:', err)
  }
}

// Fire-and-forget bulk notify for many users at once.
export async function notifyMany(
  userIds: string[],
  payload: Omit<NotifyArgs, 'userId'>
): Promise<void> {
  const unique = Array.from(new Set(userIds.filter(Boolean)))
  if (unique.length === 0) return
  try {
    await db.notification.createMany({
      data: unique.map((userId) => ({
        userId,
        title: payload.title.slice(0, 200),
        message: payload.message.slice(0, 1000),
        type: payload.type ?? 'GENERAL',
        link: payload.link ?? null,
      })),
    })
  } catch (err) {
    console.error('[notifyMany] failed:', err)
  }
}
