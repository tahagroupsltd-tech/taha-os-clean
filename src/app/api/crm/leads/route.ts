// src/app/api/crm/leads/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { sbSelect, sbInsert, sbFindOne, nowTs } from '@/lib/supa'

const canViewCRM = (role: string) => role === 'ADMIN' || role === 'MANAGER'

export const dynamic = 'force-dynamic'

const LEAD_SELECT = '*,contact:crm_contacts!contactId(id,name,email,phone),company:crm_companies!companyId(id,name),assignedTo:users!assignedToId(id,name),project:projects!projectId(id,name)'

export async function GET(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!canViewCRM(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { searchParams } = new URL(req.url)
    const stage = searchParams.get('stage')

    const filters: Record<string, string> = {}
    if (stage) filters.stage = `eq.${stage}`

    const leads = await sbSelect('crm_leads', {
      select: LEAD_SELECT,
      filters,
      order: 'updatedAt.desc',
    })

    return NextResponse.json({ data: leads })
  } catch (err) {
    console.error('[CRM leads GET]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!canViewCRM(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await req.json()
    const {
      title, stage, source, value, contactId, companyId, assignedToId, projectId, notes,
      niche, phone, instagram_url, youtube_url, facebook_url, website_url, other_links,
      expectedCloseDate
    } = body

    if (!title) return NextResponse.json({ error: 'Title is required' }, { status: 400 })

    const now = nowTs()
    const lead = await sbInsert('crm_leads', {
      title,
      stage: stage ?? 'NEW',
      source: source ?? 'OTHER',
      value: value ? Number(value) : null,
      contactId: contactId || null,
      companyId: companyId || null,
      assignedToId: assignedToId || null,
      projectId: projectId || null,
      notes: notes || null,
      niche: niche || null,
      phone: phone || null,
      instagram_url: instagram_url || null,
      youtube_url: youtube_url || null,
      facebook_url: facebook_url || null,
      website_url: website_url || null,
      other_links: other_links || null,
      expectedCloseDate: expectedCloseDate ? new Date(expectedCloseDate).toISOString() : null,
      createdById: user.id,
      createdAt: now,
      updatedAt: now,
    })

    const full = await sbFindOne('crm_leads', {
      select: LEAD_SELECT,
      filters: { id: `eq.${lead.id}` },
    }) ?? lead

    return NextResponse.json({ data: full }, { status: 201 })
  } catch (err) {
    console.error('[CRM leads POST]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
