// src/app/api/crm/activities/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { sbSelect, sbInsert, sbFindOne, nowTs } from '@/lib/supa'

export const dynamic = 'force-dynamic'

const ACTIVITY_SELECT = '*,createdBy:users!created_by_id(id,name),lead:crm_leads!lead_id(id,title),deal:crm_deals!deal_id(id,title),contact:crm_contacts!contact_id(id,name)'

export async function GET(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const leadId = searchParams.get('leadId')
    const dealId = searchParams.get('dealId')
    const contactId = searchParams.get('contactId')

    const filters: Record<string, string> = {}
    if (leadId) filters.lead_id = `eq.${leadId}`
    if (dealId) filters.deal_id = `eq.${dealId}`
    if (contactId) filters.contact_id = `eq.${contactId}`

    const activities = await sbSelect('crm_activities', {
      select: ACTIVITY_SELECT,
      filters,
      order: 'created_at.desc',
    })

    return NextResponse.json({ data: activities })
  } catch (err) {
    console.error('[CRM activities GET]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { type, subject, description, dueDate, leadId, dealId, contactId } = body

    if (!subject) return NextResponse.json({ error: 'Subject is required' }, { status: 400 })

    const now = nowTs()
    const activity = await sbInsert('crm_activities', {
      type: type ?? 'NOTE',
      subject,
      description: description || null,
      due_date: dueDate ? new Date(dueDate).toISOString() : null,
      lead_id: leadId || null,
      deal_id: dealId || null,
      contact_id: contactId || null,
      completed: false,
      created_by_id: user.id,
      created_at: now,
      updated_at: now,
    })

    const full = await sbFindOne('crm_activities', {
      select: ACTIVITY_SELECT,
      filters: { id: `eq.${activity.id}` },
    }) ?? activity

    return NextResponse.json({ data: full }, { status: 201 })
  } catch (err) {
    console.error('[CRM activities POST]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
