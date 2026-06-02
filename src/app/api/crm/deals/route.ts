// src/app/api/crm/deals/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { sbSelect, sbInsert, sbFindOne, nowTs } from '@/lib/supa'

const canViewCRM = (role: string) => role === 'ADMIN' || role === 'MANAGER'

export const dynamic = 'force-dynamic'

const DEAL_SELECT = '*,lead:crm_leads!leadId(id,title),contact:crm_contacts!contactId(id,name),company:crm_companies!companyId(id,name),project:projects!projectId(id,name),assignedTo:users!assignedToId(id,name)'

export async function GET(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!canViewCRM(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const deals = await sbSelect('crm_deals', {
      select: DEAL_SELECT,
      filters: {},
      order: 'updatedAt.desc',
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
    if (!canViewCRM(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await req.json()
    const { title, value, stage, probability, closeDate, leadId, contactId, companyId, projectId, assignedToId, notes } = body

    if (!title) return NextResponse.json({ error: 'Title is required' }, { status: 400 })

    const now = nowTs()
    const deal = await sbInsert('crm_deals', {
      title,
      value: value ? Number(value) : null,
      stage: stage ?? 'PROPOSAL',
      probability: probability ?? 50,
      closeDate: closeDate ? new Date(closeDate).toISOString() : null,
      leadId: leadId || null,
      contactId: contactId || null,
      companyId: companyId || null,
      projectId: projectId || null,
      assignedToId: assignedToId || null,
      notes: notes || null,
      createdById: user.id,
      createdAt: now,
      updatedAt: now,
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
