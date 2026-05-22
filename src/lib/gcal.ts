// src/lib/gcal.ts
// Google Calendar OAuth2 helper — syncs task deadlines and content post-dates
// as calendar events with popup reminders for each user.
//
// Uses Supabase REST API (HTTPS) for all DB operations — bypasses IPv6/TCP issues.
// SERVER-ONLY — never import this file from client components.
import 'server-only'

import { google } from 'googleapis'

// ─── Supabase REST helpers ───────────────────────────────────────────────────

const SUPABASE_URL = 'https://zmhmxfndzrrdmvvqblkx.supabase.co'
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InptaG14Zm5kenJyZG12dnFibGt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcxMDMzMzksImV4cCI6MjA5MjY3OTMzOX0.1i4olAULwrRO7wAP1Hpwur9Jl0SxieAn7dP5BaeyY9E'
const REST = `${SUPABASE_URL}/rest/v1`

function sbHdrs(extra: Record<string, string> = {}) {
  return {
    'Content-Type': 'application/json',
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    ...extra,
  }
}

// Still used for calendar_event_links / user reminder mins (those RPCs are fine)
async function supabaseRpc(fn: string, args: Record<string, unknown>): Promise<any> {
  const res = await fetch(`${REST}/rpc/${fn}`, {
    method: 'POST',
    headers: sbHdrs(),
    body: JSON.stringify(args),
    cache: 'no-store',
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Supabase RPC ${fn} error ${res.status}: ${err}`)
  }
  return res.json()
}

// ─── Token CRUD via direct REST (bypasses RPC failure points) ────────────────

async function getToken(userId: string) {
  try {
    const res = await fetch(
      `${REST}/google_calendar_tokens?userId=eq.${encodeURIComponent(userId)}&limit=1`,
      { headers: sbHdrs(), cache: 'no-store' },
    )
    if (!res.ok) { console.error('[gcal] getToken REST failed:', res.status, await res.text()); return null }
    const rows = await res.json()
    const row = rows[0] ?? null
    if (!row) return null
    // Expose snake_case aliases so existing callers work unchanged
    return { ...row, access_token: row.accessToken, refresh_token: row.refreshToken, expires_at: row.expiresAt }
  } catch (e) { console.error('[gcal] getToken error:', e); return null }
}

async function upsertToken(userId: string, accessToken: string, refreshToken: string, expiresAt: Date) {
  const now = new Date().toISOString()
  // Check if row exists
  const chk = await fetch(
    `${REST}/google_calendar_tokens?userId=eq.${encodeURIComponent(userId)}&select=id&limit=1`,
    { headers: sbHdrs(), cache: 'no-store' },
  )
  const existing = chk.ok ? await chk.json() : []

  if (existing.length > 0) {
    const r = await fetch(
      `${REST}/google_calendar_tokens?userId=eq.${encodeURIComponent(userId)}`,
      {
        method: 'PATCH',
        headers: sbHdrs({ Prefer: 'return=minimal' }),
        body: JSON.stringify({ accessToken, ...(refreshToken ? { refreshToken } : {}), expiresAt: expiresAt.toISOString(), updatedAt: now }),
        cache: 'no-store',
      },
    )
    if (!r.ok) throw new Error(`[gcal] upsertToken PATCH failed: ${r.status} ${await r.text()}`)
  } else {
    const r = await fetch(`${REST}/google_calendar_tokens`, {
      method: 'POST',
      headers: sbHdrs({ Prefer: 'return=minimal' }),
      body: JSON.stringify({
        id: crypto.randomUUID(),
        userId,
        accessToken,
        refreshToken,
        expiresAt: expiresAt.toISOString(),
        createdAt: now,
        updatedAt: now,
      }),
      cache: 'no-store',
    })
    if (!r.ok) throw new Error(`[gcal] upsertToken POST failed: ${r.status} ${await r.text()}`)
  }
}

async function updateToken(userId: string, patch: { accessToken?: string; refreshToken?: string; expiresAt?: Date }) {
  try {
    const data: Record<string, any> = { updatedAt: new Date().toISOString() }
    if (patch.accessToken) data.accessToken = patch.accessToken
    if (patch.refreshToken) data.refreshToken = patch.refreshToken
    if (patch.expiresAt) data.expiresAt = patch.expiresAt.toISOString()
    await fetch(
      `${REST}/google_calendar_tokens?userId=eq.${encodeURIComponent(userId)}`,
      { method: 'PATCH', headers: sbHdrs({ Prefer: 'return=minimal' }), body: JSON.stringify(data), cache: 'no-store' },
    )
  } catch (e) { console.error('[gcal] updateToken error:', e) }
}

async function deleteToken(userId: string) {
  try {
    await fetch(
      `${REST}/google_calendar_tokens?userId=eq.${encodeURIComponent(userId)}`,
      { method: 'DELETE', headers: sbHdrs(), cache: 'no-store' },
    )
  } catch (e) { console.error('[gcal] deleteToken error:', e) }
}

async function getUserReminderMins(userId: string): Promise<number | null> {
  try {
    const res = await fetch(
      `${REST}/users?id=eq.${encodeURIComponent(userId)}&select=calendarReminderMins&limit=1`,
      { headers: sbHdrs(), cache: 'no-store' },
    )
    if (!res.ok) return null
    const rows = await res.json()
    return rows[0]?.calendarReminderMins ?? null
  } catch { return null }
}

async function getEventLink(userId: string, entityType: string, entityId: string, role: string) {
  const rows = await supabaseRpc('gcal_get_event_link', {
    p_user_id: userId, p_entity_type: entityType, p_entity_id: entityId, p_role: role,
  }).catch(() => [])
  return rows?.[0] ?? null
}

async function upsertEventLink(userId: string, entityType: string, entityId: string, role: string, gcalEventId: string) {
  await supabaseRpc('gcal_upsert_event_link', {
    p_user_id: userId, p_entity_type: entityType, p_entity_id: entityId, p_role: role, p_gcal_event_id: gcalEventId,
  }).catch(() => {})
}

async function getEntityLinks(entityType: string, entityId: string) {
  const rows = await supabaseRpc('gcal_get_entity_links', {
    p_entity_type: entityType, p_entity_id: entityId,
  }).catch(() => [])
  return rows ?? []
}

async function deleteEntityLinks(entityType: string, entityId: string) {
  await supabaseRpc('gcal_delete_entity_links', {
    p_entity_type: entityType, p_entity_id: entityId,
  }).catch(() => {})
}

// ─── OAuth2 client factory ───────────────────────────────────────────────────

function buildOAuth2Client() {
  // Use || not ?? so that an empty-string env var also falls back to the computed URL
  const redirectUri =
    process.env.GOOGLE_REDIRECT_URI ||
    `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/google-calendar/callback`
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    redirectUri,
  )
}

/** Returns true if the user has a stored Google Calendar token (connected). */
export async function isGCalConnected(userId: string): Promise<boolean> {
  const token = await getToken(userId)
  return !!token
}

export function getGoogleAuthUrl(): string {
  const client = buildOAuth2Client()
  return client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: [
      'https://www.googleapis.com/auth/calendar.events',
      'https://www.googleapis.com/auth/drive',
    ],
  })
}

/** Exchange the OAuth code for tokens and persist them in the DB. */
export async function exchangeCodeAndStore(code: string, userId: string): Promise<void> {
  const client = buildOAuth2Client()

  let tokens: any
  try {
    const result = await client.getToken(code)
    tokens = result.tokens
  } catch (err: any) {
    // Surface the real Google error so it shows in Vercel logs and in the UI
    const googleMsg = err?.response?.data?.error_description
      ?? err?.response?.data?.error
      ?? err?.message
      ?? 'unknown'
    const redirectUri =
      process.env.GOOGLE_REDIRECT_URI ||
      `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/google-calendar/callback`
    console.error('[gcal] getToken failed:', googleMsg, '| redirect_uri used:', redirectUri)
    throw new Error(`GOOGLE_ERROR:${googleMsg}`)
  }

  if (!tokens.access_token) {
    throw new Error('Google did not return an access token.')
  }

  // Google only sends refresh_token on the FIRST grant (or after revoking access).
  const existing = await getToken(userId)
  const refreshToken = tokens.refresh_token ?? existing?.refresh_token

  if (!refreshToken) {
    throw new Error(
      'NEEDS_REVOKE: Please go to myaccount.google.com/permissions, revoke access for this app, then try connecting again.'
    )
  }

  await upsertToken(
    userId,
    tokens.access_token,
    refreshToken,
    tokens.expiry_date ? new Date(tokens.expiry_date) : new Date(Date.now() + 3_600_000),
  )
}

/** Revoke Google access and delete stored tokens for this user. */
export async function revokeGoogleAccess(userId: string): Promise<void> {
  const token = await getToken(userId)
  if (token) {
    try {
      const client = buildOAuth2Client()
      client.setCredentials({ access_token: token.access_token })
      await client.revokeCredentials()
    } catch { /* ignore — token may already be expired */ }
    await deleteToken(userId)
  }
}

// ─── Authenticated calendar client ──────────────────────────────────────────

async function getAuthClientForUser(userId: string) {
  const token = await getToken(userId)
  if (!token) return null

  const client = buildOAuth2Client()
  client.setCredentials({
    access_token: token.access_token,
    refresh_token: token.refresh_token,
    expiry_date: token.expires_at ? new Date(token.expires_at).getTime() : undefined,
  })

  // Persist refreshed tokens automatically
  client.on('tokens', async (newTokens) => {
    await updateToken(userId, {
      accessToken: newTokens.access_token ?? undefined,
      refreshToken: newTokens.refresh_token ?? undefined,
      expiresAt: newTokens.expiry_date ? new Date(newTokens.expiry_date) : undefined,
    })
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
 * Returns the gcalEventId (to store) or null if the user has no connected calendar.
 */
export async function syncCalendarEvent(
  userId: string,
  input: CalendarEventInput,
): Promise<string | null> {
  try {
    const authClient = await getAuthClientForUser(userId)
    if (!authClient) return null

    const reminderMins = await getUserReminderMins(userId)

    const cal = google.calendar({ version: 'v3', auth: authClient })

    // Build start/end — 30-minute slot at 09:00 IST on the given day
    const startDt = new Date(input.date)
    startDt.setHours(9, 0, 0, 0)
    const endDt = new Date(startDt)
    endDt.setMinutes(endDt.getMinutes() + 30)

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

/**
 * Creates or updates a Google Calendar event with exact start/end times.
 * Unlike syncCalendarEvent (which forces 09:00 IST), this respects the caller's times.
 * Designed for OS calendar events created via the UI or AI chatbot.
 */
export async function syncOsEventToGcal(
  userId: string,
  input: {
    osEventId: string
    title: string
    description?: string | null
    startTime: string // ISO datetime
    endTime: string   // ISO datetime
  },
): Promise<void> {
  try {
    const authClient = await getAuthClientForUser(userId)
    if (!authClient) return

    // Gather project attendee emails if event belongs to a project
    let attendees: { email: string }[] = []
    try {
      const eventRes = await fetch(
        `${REST}/events?id=eq.${encodeURIComponent(input.osEventId)}&select=projectId`,
        { headers: sbHdrs(), cache: 'no-store' }
      )
      if (eventRes.ok) {
        const eventRows = await eventRes.json()
        const projectId = eventRows[0]?.projectId
        if (projectId) {
          // Fetch client id from project
          const projectRes = await fetch(
            `${REST}/projects?id=eq.${encodeURIComponent(projectId)}&select=clientId`,
            { headers: sbHdrs(), cache: 'no-store' }
          )
          let clientId: string | null = null
          if (projectRes.ok) {
            const projectRows = await projectRes.json()
            clientId = projectRows[0]?.clientId ?? null
          }

          // Fetch content assignees (editors) and creators (managers)
          const contentRes = await fetch(
            `${REST}/content?projectId=eq.${encodeURIComponent(projectId)}&select=assigneeId,createdById`,
            { headers: sbHdrs(), cache: 'no-store' }
          )
          const contentRows = contentRes.ok ? await contentRes.json() : []

          // Fetch task assignees and creators
          const tasksRes = await fetch(
            `${REST}/tasks?projectId=eq.${encodeURIComponent(projectId)}&select=assignedToId,createdById`,
            { headers: sbHdrs(), cache: 'no-store' }
          )
          const tasksRows = tasksRes.ok ? await tasksRes.json() : []

          const userIds = new Set<string>()
          if (clientId) userIds.add(clientId)
          for (const c of contentRows) {
            if (c.assigneeId) userIds.add(c.assigneeId)
            if (c.createdById) userIds.add(c.createdById)
          }
          for (const t of tasksRows) {
            if (t.assignedToId) userIds.add(t.assignedToId)
            if (t.createdById) userIds.add(t.createdById)
          }
          userIds.delete(userId) // Exclude current user (organizer)

          if (userIds.size > 0) {
            const idList = Array.from(userIds).map(id => `eq.${encodeURIComponent(id)}`).join(',')
            const usersRes = await fetch(
              `${REST}/users?id=in.(${idList})&select=email`,
              { headers: sbHdrs(), cache: 'no-store' }
            )
            if (usersRes.ok) {
              const userRows = await usersRes.json()
              const emails = userRows
                .map((u: any) => u.email?.trim())
                .filter(Boolean)
              attendees = Array.from(new Set<string>(emails)).map(email => ({ email }))
            }
          }
        }
      }
    } catch (err) {
      console.error('[gcal] error gathering project attendee emails:', err)
    }

    const reminderMins = await getUserReminderMins(userId)
    const cal = google.calendar({ version: 'v3', auth: authClient })

    const reminders =
      reminderMins != null && reminderMins > 0
        ? { useDefault: false, overrides: [{ method: 'popup', minutes: reminderMins }] }
        : { useDefault: true, overrides: [] }

    const eventBody = {
      summary: input.title,
      description: input.description ?? undefined,
      start: { dateTime: new Date(input.startTime).toISOString(), timeZone: 'Asia/Kolkata' },
      end:   { dateTime: new Date(input.endTime).toISOString(),   timeZone: 'Asia/Kolkata' },
      reminders,
      attendees: attendees.length > 0 ? attendees : undefined,
    }

    const existing = await getEventLink(userId, 'os_event', input.osEventId, 'owner')
    let gcalEventId: string | null = null

    if (existing?.gcal_event_id) {
      const res = await cal.events.update({
        calendarId: 'primary',
        eventId: existing.gcal_event_id,
        requestBody: eventBody,
        sendUpdates: 'all',
      })
      gcalEventId = res.data.id ?? null
    } else {
      const res = await cal.events.insert({
        calendarId: 'primary',
        requestBody: eventBody,
        sendUpdates: 'all',
      })
      gcalEventId = res.data.id ?? null
    }

    if (gcalEventId) {
      await upsertEventLink(userId, 'os_event', input.osEventId, 'owner', gcalEventId)
    }
  } catch (err) {
    // Soft-fail — don't block event creation if gcal sync fails
    console.error('[gcal] syncOsEventToGcal error:', err)
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
 * Sync calendar events for a content item.
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

  // Editor event
  if (assigneeId) {
    const link = await getEventLink(assigneeId, 'content', contentId, 'assignee')
    const deadlineDate = new Date(postDate.getTime() - 2 * 24 * 60 * 60 * 1000)
    const eventId = await syncCalendarEvent(assigneeId, {
      title: `✂️ Finish: ${title}`,
      description: `Post date: ${postDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}${desc ? '\n' + desc : ''}`,
      date: deadlineDate,
      gcalEventId: link?.gcal_event_id ?? null,
    })
    if (eventId) await upsertEventLink(assigneeId, 'content', contentId, 'assignee', eventId)
  }

  // Manager event (skip if creator is same as assignee)
  if (createdById && createdById !== assigneeId) {
    const link = await getEventLink(createdById, 'content', contentId, 'manager')
    const eventId = await syncCalendarEvent(createdById, {
      title: `📤 Post: ${title}`,
      description: desc,
      date: postDate,
      gcalEventId: link?.gcal_event_id ?? null,
    })
    if (eventId) await upsertEventLink(createdById, 'content', contentId, 'manager', eventId)
  }
}

/**
 * Sync a calendar event for an assigned task.
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
  const link = await getEventLink(assigneeId, 'task', taskId, 'assignee')

  const eventId = await syncCalendarEvent(assigneeId, {
    title: `✅ Due: ${title}`,
    description: desc,
    date: deadline,
    gcalEventId: link?.gcal_event_id ?? null,
  })

  if (eventId) await upsertEventLink(assigneeId, 'task', taskId, 'assignee', eventId)
}

/**
 * Delete all calendar events linked to an entity (when task/content is deleted).
 */
export async function deleteEntityCalendarEvents(
  entityType: 'task' | 'content' | 'os_event',
  entityId: string,
): Promise<void> {
  const links = await getEntityLinks(entityType, entityId)
  await Promise.allSettled(
    links.map((l: any) => deleteCalendarEvent(l.user_id, l.gcal_event_id))
  )
  await deleteEntityLinks(entityType, entityId)
}