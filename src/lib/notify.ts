// src/lib/notify.ts
// Uses Supabase REST API — no Prisma/TCP dependency.
import { sbInsert, sbInsertMany, nowTs } from '@/lib/supa'
import { isGCalConnected, syncCalendarEvent } from '@/lib/gcal'

/**
 * Optional Google Calendar event to create alongside the in-app notification.
 * If the recipient has GCal connected, a 30-min event is added at 09:00 IST
 * on the specified date.
 */
export interface GCalEventHint {
  /** Event title shown in Google Calendar */
  title: string
  /** Optional body text */
  description?: string
  /** Date for the event (time will be 09:00 IST) */
  date: Date
}

interface NotifyArgs {
  userId: string
  title: string
  message: string
  type?: string
  link?: string | null
  /** If provided, also creates a matching Google Calendar event (fire-and-forget). */
  gcalEvent?: GCalEventHint | null
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

  // ── GCal push (fire-and-forget) ───────────────────────────────────────────
  if (args.gcalEvent && args.userId) {
    isGCalConnected(args.userId)
      .then(connected => {
        if (!connected) return
        return syncCalendarEvent(args.userId, args.gcalEvent!).catch(() => {})
      })
      .catch(() => {})
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

  // ── GCal push for each recipient (fire-and-forget) ────────────────────────
  if (payload.gcalEvent) {
    const hint = payload.gcalEvent
    for (const uid of unique) {
      isGCalConnected(uid)
        .then(connected => {
          if (!connected) return
          return syncCalendarEvent(uid, hint).catch(() => {})
        })
        .catch(() => {})
    }
  }
}

export async function triggerWhatsAppNotification(payload: {
  event: string
  task: any
  updatedBy: { id: string; name: string; role: string }
  changes: any
}): Promise<void> {
  const url = process.env.WHATSAPP_WEBHOOK_URL
  if (!url) {
    console.log('[whatsapp-webhook] WHATSAPP_WEBHOOK_URL is not set, skipping WhatsApp trigger.')
    return
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })
    console.log(`[whatsapp-webhook] Dispatched event ${payload.event}. Status: ${res.status}`)
  } catch (err) {
    console.error('[whatsapp-webhook] Dispatch failed:', err)
  }
}

