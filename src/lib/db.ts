// src/lib/db.ts
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

/**
 * Supabase's direct connection (port 5432) is unreachable from Vercel serverless (IPv6-only).
 * Resolution order:
 *   1. POOLER_URL env var — explicit Transaction Pooler URL (set this in Vercel dashboard)
 *   2. DATABASE_URL already pointing at pooler — use as-is
 *   3. DATABASE_URL pointing at direct connection — auto-rewrite to Supavisor Transaction Pooler
 */
function getDbUrl(): string {
  // 1. Explicit override: copy the Transaction Pooler URL from Supabase dashboard
  //    and set POOLER_URL in Vercel env vars (Settings → Environment Variables)
  if (process.env.POOLER_URL) return process.env.POOLER_URL

  const url = process.env.DATABASE_URL ?? ''

  // 2. Already using pooler or local dev — leave as-is
  if (!url.includes('@db.') || !url.includes('.supabase.co:5432')) return url

  // 3. Auto-convert direct → Supavisor Session Pooler (port 5432, supports prepared statements)
  //    Falls back to Transaction Pooler (port 6543) if POOLER_URL is not set.
  //    Session mode is preferred for Prisma because it supports prepared statements.
  const projectRef = 'zmhmxfndzrrdmvvqblkx'
  const pooler = url
    .replace(/postgresql:\/\/postgres:/, `postgresql://postgres.${projectRef}:`)
    .replace(
      new RegExp(`@db\\.${projectRef}\\.supabase\\.co:5432/postgres`),
      `@aws-0-ap-south-1.pooler.supabase.com:5432/postgres`
    )
  // Session Pooler: no pgbouncer flag needed; add connection_limit for serverless
  return pooler.includes('?')
    ? `${pooler}&connection_limit=1`
    : `${pooler}?connection_limit=1`
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    datasources: { db: { url: getDbUrl() } },
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
