// src/app/api/content/metrics/route.ts
// GET  /api/content/metrics?projectId=&platform=&limit=  — top content by views
// POST /api/content/metrics  — add metrics for a content item (manual or n8n webhook)
import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { sbSelect, sbInsert, nowTs } from '@/lib/supa'

export const dynamic = 'force-dynamic'

const METRICS_SELECT =
  '*,content:content!content_id(id,title,type,status,project:projects!projectId(id,name))'

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const projectId = searchParams.get('projectId')
  const platform  = searchParams.get('platform')
  const limit     = Math.min(parseInt(searchParams.get('limit') ?? '20'), 100)

  const filters: Record<string, string> = {}
  if (platform) filters.platform = `eq.${platform}`

  let rows = await sbSelect('content_metrics', {
    select: METRICS_SELECT,
    filters,
    order: 'views.desc,recorded_at.desc',
    limit,
  })

  // filter by project if provided (post-fetch, content join)
  if (projectId) {
    rows = rows.filter((r: any) => r.content?.project?.id === projectId)
  }

  // Aggregate: for each content item keep latest snapshot + compute totals
  const map = new Map<string, any>()
  for (const r of rows) {
    const cid = r.content_id
    if (!map.has(cid) || new Date(r.recorded_at) > new Date(map.get(cid).recorded_at)) {
      map.set(cid, r)
    }
  }

  return NextResponse.json({ data: Array.from(map.values()) })
}

export async function POST(req: NextRequest) {
  // Allow both authenticated users and n8n webhook (checked via WEBHOOK_SECRET header)
  const authHeader = req.headers.get('authorization') ?? ''
  const webhookSecret = process.env.WEBHOOK_SECRET
  const isWebhook = webhookSecret && authHeader === `Bearer ${webhookSecret}`

  if (!isWebhook) {
    const user = await getUserFromRequest(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const { contentId, platform = 'INSTAGRAM', postUrl, views = 0, likes = 0, comments = 0, shares = 0, reach = 0, saved = 0, recordedAt } = body

  if (!contentId) return NextResponse.json({ error: 'contentId required' }, { status: 400 })

  const now = nowTs()
  const row = await sbInsert('content_metrics', {
    content_id: contentId,
    platform,
    post_url: postUrl ?? null,
    views: Math.round(views),
    likes: Math.round(likes),
    comments: Math.round(comments),
    shares: Math.round(shares),
    reach: Math.round(reach),
    saved: Math.round(saved),
    recorded_at: recordedAt ? new Date(recordedAt).toISOString() : now,
    created_at: now,
  })

  return NextResponse.json({ data: row }, { status: 201 })
}
