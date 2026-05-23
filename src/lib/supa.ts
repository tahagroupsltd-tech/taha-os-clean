// src/lib/supa.ts
// Supabase PostgREST REST client — replaces Prisma for ALL DB operations.
// Uses HTTPS (port 443) which always works from Vercel serverless.
// NOTE: RLS is disabled; all access is gated by our own JWT auth middleware.

const SB_URL = process.env.SUPABASE_URL
  ? `${process.env.SUPABASE_URL}/rest/v1`
  : 'https://zmhmxfndzrrdmvvqblkx.supabase.co/rest/v1'

// SECURITY: Never hardcode this key. Set SUPABASE_ANON_KEY in Vercel env vars.
// Fallback keeps the app working during the transition — remove once env var is set.
const SB_KEY = process.env.SUPABASE_ANON_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InptaG14Zm5kenJyZG12dnFibGt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcxMDMzMzksImV4cCI6MjA5MjY3OTMzOX0.1i4olAULwrRO7wAP1Hpwur9Jl0SxieAn7dP5BaeyY9E'

if (!process.env.SUPABASE_ANON_KEY && process.env.NODE_ENV === 'production') {
  console.error('[supa] WARNING: SUPABASE_ANON_KEY env var is not set — using hardcoded fallback. Set it in Vercel dashboard immediately.')
}

function hdrs(extra: Record<string, string> = {}) {
  return {
    'Content-Type': 'application/json',
    apikey: SB_KEY,
    Authorization: `Bearer ${SB_KEY}`,
    ...extra,
  }
}

export function nowTs() {
  return new Date().toISOString()
}

/** SELECT — returns array of rows */
export async function sbSelect(
  table: string,
  opts: {
    select?: string
    filters?: Record<string, string>
    order?: string
    limit?: number
    offset?: number
  } = {}
): Promise<any[]> {
  const p = new URLSearchParams({ select: opts.select ?? '*' })
  if (opts.filters) {
    for (const [k, v] of Object.entries(opts.filters)) p.append(k, v)
  }
  if (opts.order) p.append('order', opts.order)
  if (opts.limit != null) p.append('limit', String(opts.limit))
  if (opts.offset != null) p.append('offset', String(opts.offset))

  const res = await fetch(`${SB_URL}/${table}?${p}`, { headers: hdrs(), cache: 'no-store' })
  if (!res.ok) {
    console.error(`[sb] SELECT ${table} failed (${res.status}):`, await res.text())
    return []
  }
  return res.json()
}

/** Find one — returns first match or null */
export async function sbFindOne(
  table: string,
  opts: { select?: string; filters?: Record<string, string> } = {}
): Promise<any | null> {
  const rows = await sbSelect(table, { ...opts, limit: 1 })
  return rows[0] ?? null
}

/** COUNT — returns integer count */
export async function sbCount(
  table: string,
  filters: Record<string, string> = {}
): Promise<number> {
  const p = new URLSearchParams({ select: 'id' })
  for (const [k, v] of Object.entries(filters)) p.append(k, v)
  const res = await fetch(`${SB_URL}/${table}?${p}`, {
    headers: hdrs({ Prefer: 'count=exact' }),
    cache: 'no-store',
  })
  const range = res.headers.get('content-range') ?? '*/0'
  return parseInt(range.split('/')[1] ?? '0', 10)
}

/** INSERT — returns inserted row with id auto-generated if omitted */
export async function sbInsert(
  table: string,
  data: Record<string, any>
): Promise<any> {
  const row = { id: crypto.randomUUID(), ...data }
  const res = await fetch(`${SB_URL}/${table}`, {
    method: 'POST',
    headers: hdrs({ Prefer: 'return=representation' }),
    body: JSON.stringify(row),
    cache: 'no-store',
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`[sb] INSERT ${table} failed: ${err}`)
  }
  const rows = await res.json()
  return Array.isArray(rows) ? rows[0] : rows
}

/** INSERT MANY — returns array of inserted rows */
export async function sbInsertMany(
  table: string,
  data: Record<string, any>[]
): Promise<any[]> {
  const rows = data.map(d => ({ id: crypto.randomUUID(), ...d }))
  const res = await fetch(`${SB_URL}/${table}`, {
    method: 'POST',
    headers: hdrs({ Prefer: 'return=representation' }),
    body: JSON.stringify(rows),
    cache: 'no-store',
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`[sb] INSERT MANY ${table} failed: ${err}`)
  }
  return res.json()
}

/** UPDATE — returns updated row.
 *  Auto-adds updatedAt timestamp unless the caller already provides
 *  updatedAt or updated_at (CRM tables use snake_case). */
export async function sbUpdate(
  table: string,
  filters: Record<string, string>,
  data: Record<string, any>
): Promise<any> {
  const p = new URLSearchParams()
  for (const [k, v] of Object.entries(filters)) p.append(k, v)
  // Only inject a timestamp if caller hasn't already provided one
  const hasTs = 'updatedAt' in data || 'updated_at' in data
  const tsAddition = hasTs ? {} : { updatedAt: nowTs() }
  const res = await fetch(`${SB_URL}/${table}?${p}`, {
    method: 'PATCH',
    headers: hdrs({ Prefer: 'return=representation' }),
    body: JSON.stringify({ ...data, ...tsAddition }),
    cache: 'no-store',
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`[sb] UPDATE ${table} failed: ${err}`)
  }
  const rows = await res.json()
  return Array.isArray(rows) ? rows[0] : rows
}

/** DELETE — deletes matching rows */
export async function sbDelete(
  table: string,
  filters: Record<string, string>
): Promise<void> {
  const p = new URLSearchParams()
  for (const [k, v] of Object.entries(filters)) p.append(k, v)
  const res = await fetch(`${SB_URL}/${table}?${p}`, {
    method: 'DELETE',
    headers: hdrs(),
    cache: 'no-store',
  })
  if (!res.ok) console.error(`[sb] DELETE ${table} failed (${res.status}):`, await res.text())
}

/** RPC — calls a Supabase SECURITY DEFINER SQL function */
export async function sbRpc(fn: string, args: Record<string, unknown>): Promise<any> {
  const res = await fetch(`https://zmhmxfndzrrdmvvqblkx.supabase.co/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: hdrs(),
    body: JSON.stringify(args),
    cache: 'no-store',
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`[sb] RPC ${fn} failed: ${err}`)
  }
  return res.json()
}

// ─── Convenience select strings ──────────────────────────────────────────────

export const TASK_SELECT =
  '*,assignedTo:users!assignedToId(id,name,phone),createdBy:users!createdById(id,name,phone),project:projects!projectId(id,name)'

export const CONTENT_SELECT =
  '*,assignee:users!assigneeId(id,name),createdBy:users!createdById(id,name),project:projects!projectId(id,name)'

export const PROJECT_SELECT =
  'id,name,description,status,boardColumn,sopLevel,value,clientId,startDate,dueDate,driveFolder,createdAt,updatedAt,client:users!clientId(id,name)'

export const EVENT_SELECT =
  '*,owner:users!ownerId(id,name),project:projects!projectId(id,name)'

export const NOTE_SELECT =
  '*,owner:users!ownerId(id,name),project:projects!projectId(id,name)'


export const TRANSACTION_SELECT =
  '*,owner:users!ownerId(id,name),project:projects!projectId(id,name)'

/** Normalise a raw Supabase project row → camelCase shape expected by the frontend */
export function normalizeProject(p: any): any {
  if (!p) return p
  const { boardColumn, ...rest } = p
  return { ...rest, boardColumn: boardColumn ?? 'ACTIVE' }
}
