// src/app/api/crm/leads/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { sbSelect, sbInsert, sbFindOne, nowTs } from '@/lib/supa'

export const dynamic = 'force-dynamic'

const LEAD_SELECT = '*,contact:crm_contacts!contact_id(id,name,email,phone),company:crm_companies!company_id(id,name),assignedTo:users!assigned_to_id(id,name),project:projects!project_id(id,name)'

export async function GET(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const stage = searchParams.get('stage')

    const filters: Record<string, string> = {}
    if (stage) filters.stage = `eq.${stage}`

    const leads = await sbSelect('crm_leads', {
      select: LEAD_SELECT,
      filters,
      order: 'updated_at.desc',
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

    const body = await req.json()
    const { title, stage, source, value, contactId, companyId, assignedToId, projectId, notes, niche, expectedCloseDate } = body

    if (!title) return NextResponse.json({ error: 'Title is required' }, { status: 400 })

    const now = nowTs()
    const lead = await sbInsert('crm_leads', {
      title,
      stage: stage ?? 'NEW',
      source: source ?? 'OTHER',
      value: value ? Number(value) : null,
      contact_id: contactId || null,
      company_id: companyId || null,
      assigned_to_id: assignedToId || null,
      project_id: projectId || null,
      notes: notes || null,
      niche: niche || null,
      expected_close_date: expectedCloseDate ? new Date(expectedCloseDate).toISOString() : null,
      created_by_id: user.id,
      created_at: now,
      updated_at: now,
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
