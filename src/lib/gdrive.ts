// src/lib/gdrive.ts
// Google Drive helper — reuses the same OAuth2 tokens stored by gcal.ts.
// SERVER-ONLY — never import from client components.
import 'server-only'
import { google } from 'googleapis'

const SUPABASE_URL = process.env.SUPABASE_URL ?? 'https://zmhmxfndzrrdmvvqblkx.supabase.co'
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY ??
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

function buildOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI,
  )
}

async function getToken(userId: string) {
  try {
    const res = await fetch(
      `${REST}/google_calendar_tokens?userId=eq.${encodeURIComponent(userId)}&limit=1`,
      { headers: sbHdrs(), cache: 'no-store' },
    )
    if (!res.ok) return null
    const rows = await res.json()
    return rows[0] ?? null
  } catch {
    return null
  }
}

async function buildDriveClient(userId: string) {
  const row = await getToken(userId)
  if (!row) throw new Error('NO_TOKEN')

  const oauth2 = buildOAuth2Client()
  oauth2.setCredentials({
    access_token: row.accessToken,
    refresh_token: row.refreshToken,
    expiry_date: row.expiresAt ? new Date(row.expiresAt).getTime() : undefined,
  })

  // Persist refreshed access token automatically
  oauth2.on('tokens', async (tokens) => {
    if (tokens.access_token) {
      await fetch(
        `${REST}/google_calendar_tokens?userId=eq.${encodeURIComponent(userId)}`,
        {
          method: 'PATCH',
          headers: sbHdrs({ Prefer: 'return=minimal' }),
          body: JSON.stringify({
            accessToken: tokens.access_token,
            ...(tokens.refresh_token ? { refreshToken: tokens.refresh_token } : {}),
            updatedAt: new Date().toISOString(),
          }),
          cache: 'no-store',
        },
      )
    }
  })

  return google.drive({ version: 'v3', auth: oauth2 })
}

// ─── Public: check Drive access ──────────────────────────────────────────────

export async function hasDriveAccess(userId: string): Promise<boolean> {
  try {
    const drive = await buildDriveClient(userId)
    await drive.about.get({ fields: 'user' })
    return true
  } catch {
    return false
  }
}

// ─── Public types ─────────────────────────────────────────────────────────────

export interface DriveFile {
  id: string
  name: string
  mimeType: string
  size?: string | null
  modifiedTime?: string | null
  webViewLink?: string | null
  iconLink?: string | null
  isFolder: boolean
}

// ─── Extract folder ID from a Google Drive URL ───────────────────────────────

export function extractFolderId(url: string): string | null {
  if (!url) return null
  // https://drive.google.com/drive/folders/FOLDER_ID
  // https://drive.google.com/drive/u/0/folders/FOLDER_ID
  const match = url.match(/\/folders\/([a-zA-Z0-9_-]+)/)
  return match?.[1] ?? null
}

// ─── List files in a folder ───────────────────────────────────────────────────

export async function listDriveFiles(userId: string, folderId: string): Promise<DriveFile[]> {
  const drive = await buildDriveClient(userId)

  const res = await drive.files.list({
    q: `'${folderId}' in parents and trashed = false`,
    fields: 'files(id,name,mimeType,size,modifiedTime,webViewLink,iconLink)',
    orderBy: 'folder,name',
    pageSize: 100,
  })

  return (res.data.files ?? []).map((f: any) => ({
    id: f.id ?? '',
    name: f.name ?? '',
    mimeType: f.mimeType ?? '',
    size: f.size ?? null,
    modifiedTime: f.modifiedTime ?? null,
    webViewLink: f.webViewLink ?? null,
    iconLink: f.iconLink ?? null,
    isFolder: f.mimeType === 'application/vnd.google-apps.folder',
  }))
}

// ─── Upload a file to a folder ────────────────────────────────────────────────

export async function uploadToDrive(
  userId: string,
  folderId: string,
  name: string,
  buffer: Buffer,
  mimeType: string,
): Promise<DriveFile> {
  const drive = await buildDriveClient(userId)
  const { Readable } = await import('stream')

  const res = await drive.files.create({
    requestBody: { name, parents: [folderId] },
    media: { mimeType, body: Readable.from(buffer) },
    fields: 'id,name,mimeType,size,modifiedTime,webViewLink,iconLink',
  })

  const f = res.data
  return {
    id: f.id ?? '',
    name: f.name ?? '',
    mimeType: f.mimeType ?? '',
    size: f.size ?? null,
    modifiedTime: f.modifiedTime ?? null,
    webViewLink: f.webViewLink ?? null,
    iconLink: f.iconLink ?? null,
    isFolder: false,
  }
}
