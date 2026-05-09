// src/lib/gcal.ts
// Google Calendar OAuth2 helper — syncs task deadlines and content post-dates
// as calendar events with popup reminders for each user.
//
// Requires: npm install googleapis
// Env vars: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI

import { google } from 'googleapis'
import { db } from '@/lib/db'

// ─── OAuth2 client factory ───────────────────────────────────────────────────

function buildOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI ??
      `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/google-calendar/callback`,
  )
}

export function getGoogleAuthUrl(): string {
  const client = buildOAuth2Client()
  return client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: ['https://www.googleapis.com/auth/calendar.events'],
  })
}

/** Exchange the OAuth code for tokens and persist them in the DB. */
export async function exchangeCodeAndStore(code: string, userId: string): Promise<void> {
  const client = buildOAuth2Client()
  const { tokens } = await client.getToken(code)
  if (!tokens.access_token || !tokens.refresh_token) {
    throw new Error('Google did not return required tokens. Re-connect and grant all permissions.')
  }
  await db.googleCalendarToken.upsert({
    where: { userId },
    create: {
      userId,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : new Date(Date.now() + 3600_000),
    },
    update: {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      ...(tokens.expiry_date ? { expiresAt: new Date(tokens.expiry_date) } : {}),
    },
  })
}

/** Revoke Google access and delete stored tokens for this user. */
export async function revokeGoogleAccess(userId: string): Promise<void> {
  const token = await db.googleCalendarToken.findUnique({ where: { userId } })
  if (token) {
    try {
      const client = buildOAuth2Client()
      client.setCredentials({ access_token: token.accessToken })
      await client.revokeCredentials()
    } catch { /* ignore — token may already be expired */ }
    await db.googleCalendarToken.delete({ where: { userId } })
  }
}

// ─── Authenticated calendar client ──────────────────────────────────────────

async function getAuthClientForUser(userId: string) {
  const token = await db.googleCalendarToken.findUnique({ where: { userId } })
  if (!token) return null

  const client = buildOAuth2Client()
  client.setCredentials({
    access_token: token.accessToken,
    refresh_token: token.refreshToken,
    expiry_date: token.expiresAt.getTime(),
  })

  // Persist refreshed tokens automatically
  client.on('tokens', async (newTokens) => {
    await db.googleCalendarToken.update({
      where: { userId },
      data: {
        ...(newTokens.access_token ? { accessToken: newTokens.access_token } : {}),
        ...(newTokens.refresh_token ? { refreshToken: newTokens.refresh_token } : {}),
        ...(newTokens.expiry_date ? { expiresAt: new Date(newTokens.expiry_date) } : {}),
      },
    }).catch(() => { /* ignore */ })
  })

  return client
}

// ─── Event sync ─────────────────────────────────────────────────────────────

export interface CalendarEventInput {
  title: string
  description?: string
  /** The day of the event (time will be set to 09:00 IST) */
  date: Date
  /** Existing gcal event ID to update; omit to create a new event */
  gcalEventId?: string | null
}

/**
 * Creates or updates a Google Calendar event for the given user.
 * Uses the user's `calendarReminderMins` preference for the popup alarm.
 * Returns the gcalEventId (to store) or null if the user has no connected calendar.
 */
export async function syncCalendarEvent(
  userId: string,
  input: CalendarEventInput,
): Promise<string | null> {
  try {
    const authClient = await getAuthClientForUser(userId)
    if (!authClient) return null

    // Fetch user's reminder preference
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { calendarReminderMins: true },
    })

    const cal = google.calendar({ version: 'v3', auth: authClient })

    // Build start/end — 30-minute slot at 09:00 IST on the given day
    const startDt = new Date(input.date)
    startDt.setHours(9, 0, 0, 0)
    const endDt = new Date(startDt)
    endDt.setMinutes(endDt.getMinutes() + 30)

    const reminderMins = user?.calendarReminderMins
    const reminders =
      reminderMins != null && reminderMins > 0
        ? { useDefault: false, overrides: [{ method: 'popup', minutes: reminderMins }] }
        : { useDefault: false, overrides: [] }

    const eventBody = {
      summary: input.title,
      description: input.description,
      start: { dateTime: startDt.toISOString(), timeZone: 'Asia/Kolkata' },
      end:   { dateTime: endDt.toISOString(),   timeZone: 'Asia/Kolkata' },
      reminders,
    }

    if (input.gcalEventId) {
      const res = await cal.events.update({
        calendarId: 'primary',
        eventId: input.gcalEventId,
        requestBody: eventBody,
      })
      return res.data.id ?? null
    } else {
      const res = await cal.events.insert({
        calendarId: 'primary',
        requestBody: eventBody,
      })
      return res.data.id ?? null
    }
  } catch (err) {
    console.error('[gcal] syncCalendarEvent error:', err)
    return null
  }
}

/** Deletes a Google Calendar event (soft-fail). */
export async function deleteCalendarEvent(userId: string, gcalEventId: string): Promise<void> {
  try {
    const authClient = await getAuthClientForUser(userId)
    if (!authClient) return
    const cal = google.calendar({ version: 'v3', auth: authClient })
    await cal.events.delete({ calendarId: 'primary', eventId: gcalEventId })
  } catch { /* ignore — event may already be deleted */ }
}

// ─── High-level helpers called from API routes ───────────────────────────────

/**
 * Sync (create/update) calendar events for a content item.
 * - Assignee (editor) gets an event on postDate: "✂️ Finish: [title]"
 * - Creator (manager/admin) gets an event on postDate: "📤 Post: [title]"
 */
export async function syncContentEvents(
  contentId: string,
  opts: {
    title: string
    postDate: Date | null
    assigneeId: string | null
    createdById: string
    projectName?: string | null
  },
): Promise<void> {
  const { title, postDate, assigneeId, createdById, projectName } = opts
  if (!postDate) return

  const desc = projectName ? `Project: ${projectName}` : undefined

  // Helper to upsert/delete CalendarEventLink
  const upsertLink = async (userId: string, role: string, gcalEventId: string | null) => {
    if (!gcalEventId) return
    await db.calendarEventLink.upsert({
      where: { userId_entityType_entityId_role: { userId, entityType: 'content', entityId: contentId, role } },
      create: { userId, entityType: 'content', entityId: contentId, role, gcalEventId },
      update: { gcalEventId },
    }).catch(() => {})
  }

  const getLink = async (userId: string, role: string) => {
    const link = await db.calendarEventLink.findUnique({
      where: { userId_entityType_entityId_role: { userId, entityType: 'content', entityId: contentId, role } },
    }).catch(() => null)
    return link?.gcalEventId ?? null
  }

  // Editor event
  if (assigneeId) {
    const existingId = await getLink(assigneeId, 'assignee')
    const eventId = await syncCalendarEvent(assigneeId, {
      title: `✂️ Finish: ${title}`,
      description: `Post date: ${postDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}${desc ? '\n' + desc : ''}`,
      date: postDate,
      gcalEventId: existingId,
    })
    await upsertLink(assigneeId, 'assignee', eventId)
  }

  // Manager event (skip if creator is same as assignee)
  if (createdById && createdById !== assigneeId) {
    const existingId = await getLink(createdById, 'manager')
    const eventId = await syncCalendarEvent(createdById, {
      title: `📤 Post: ${title}`,
      description: desc,
      date: postDate,
      gcalEventId: existingId,
    })
    await upsertLink(createdById, 'manager', eventId)
  }
}

/**
 * Sync (create/update) a calendar event for an assigned task.
 * Assignee gets: "✅ Due: [title]" on the deadline.
 */
export async function syncTaskEvent(
  taskId: string,
  opts: {
    title: string
    deadline: Date | null
    assigneeId: string | null
    projectName?: string | null
  },
): Promise<void> {
  const { title, deadline, assigneeId, projectName } = opts
  if (!deadline || !assigneeId) return

  const desc = projectName ? `Project: ${projectName}` : undefined
  const existing = await db.calendarEventLink.findUnique({
    where: { userId_entityType_entityId_role: { userId: assigneeId, entityType: 'task', entityId: taskId, role: 'assignee' } },
  }).catch(() => null)

  const eventId = await syncCalendarEvent(assigneeId, {
    title: `✅ Due: ${title}`,
    description: desc,
    date: deadline,
    gcalEventId: existing?.gcalEventId ?? null,
  })

  if (eventId) {
    await db.calendarEventLink.upsert({
      where: { userId_entityType_entityId_role: { userId: assigneeId, entityType: 'task', entityId: taskId, role: 'assignee' } },
      create: { userId: assigneeId, entityType: 'task', entityId: taskId, role: 'assignee', gcalEventId: eventId },
      update: { gcalEventId: eventId },
    }).catch(() => {})
  }
}

/**
 * Delete all calendar events linked to an entity (when task/content is deleted).
 */
export async function deleteEntityCalendarEvents(
  entityType: 'task' | 'content',
  entityId: string,
): Promise<void> {
  const links = await db.calendarEventLink.findMany({
    where: { entityType, entityId },
  }).catch(() => [] as any[])

  await Promise.allSettled(
    links.map((l: any) => deleteCalendarEvent(l.userId, l.gcalEventId))
  )
  await db.calendarEventLink.deleteMany({ where: { entityType, entityId } }).catch(() => {})
}
