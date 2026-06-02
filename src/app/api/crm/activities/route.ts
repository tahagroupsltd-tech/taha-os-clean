// src/app/api/crm/activities/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { sbSelect, sbInsert, sbFindOne, nowTs } from '@/lib/supa'

const canViewCRM = (role: string) => role === 'ADMIN' || role === 'MANAGER'

export const dynamic = 'force-dynamic'

const ACTIVITY_SELECT = '*,createdBy:users!createdById(id,name),lead:crm_leads!leadId(id,title),deal:crm_deals!dealId(id,title),contact:crm_contacts!contactId(id,name)'

export async function GET(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!canViewCRM(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { searchParams } = new URL(req.url)
    const leadId = searchParams.get('leadId')
    const dealId = searchParams.get('dealId')
    const contactId = searchParams.get('contactId')

    const filters: Record<string, string> = {}
    if (leadId) filters.leadId = `eq.${leadId}`
    if (dealId) filters.dealId = `eq.${dealId}`
    if (contactId) filters.contactId = `eq.${contactId}`

    const activities = await sbSelect('crm_activities', {
      select: ACTIVITY_SELECT,
      filters,
      order: 'createdAt.desc',
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
    if (!canViewCRM(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await req.json()
    const { type, subject, description, dueDate, leadId, dealId, contactId } = body

    if (!subject) return NextResponse.json({ error: 'Subject is required' }, { status: 400 })

    const now = nowTs()
    const activity = await sbInsert('crm_activities', {
      type: type ?? 'NOTE',
      subject,
      description: description || null,
      dueDate: dueDate ? new Date(dueDate).toISOString() : null,
      leadId: leadId || null,
      dealId: dealId || null,
      contactId: contactId || null,
      completed: false,
      createdById: user.id,
      createdAt: now,
      updatedAt: now,
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
