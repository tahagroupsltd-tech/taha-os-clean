// src/app/api/crm/deals/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { sbSelect, sbInsert, sbFindOne, nowTs } from '@/lib/supa'

export const dynamic = 'force-dynamic'

const DEAL_SELECT = '*,lead:crm_leads!lead_id(id,title),contact:crm_contacts!contact_id(id,name),company:crm_companies!company_id(id,name),project:projects!project_id(id,name),assignedTo:users!assigned_to_id(id,name)'

export async function GET(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const deals = await sbSelect('crm_deals', {
      select: DEAL_SELECT,
      filters: {},
      order: 'updated_at.desc',
    })

    return NextResponse.json({ data: deals })
  } catch (err) {
    console.error('[CRM deals GET]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { title, value, stage, probability, closeDate, leadId, contactId, companyId, projectId, assignedToId, notes } = body

    if (!title) return NextResponse.json({ error: 'Title is required' }, { status: 400 })

    const now = nowTs()
    const deal = await sbInsert('crm_deals', {
      title,
      value: value ? Number(value) : null,
      stage: stage ?? 'PROPOSAL',
      probability: probability ?? 50,
      close_date: closeDate ? new Date(closeDate).toISOString() : null,
      lead_id: leadId || null,
      contact_id: contactId || null,
      company_id: companyId || null,
      project_id: projectId || null,
      assigned_to_id: assignedToId || null,
      notes: notes || null,
      created_by_id: user.id,
      created_at: now,
      updated_at: now,
    })

    const full = await sbFindOne('crm_deals', {
      select: DEAL_SELECT,
      filters: { id: `eq.${deal.id}` },
    }) ?? deal

    return NextResponse.json({ data: full }, { status: 201 })
  } catch (err) {
    console.error('[CRM deals POST]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
