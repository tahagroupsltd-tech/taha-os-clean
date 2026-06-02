// src/app/api/crm/contacts/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { sbSelect, sbInsert, sbFindOne, nowTs } from '@/lib/supa'

const canViewCRM = (role: string) => role === 'ADMIN' || role === 'MANAGER'

export const dynamic = 'force-dynamic'

const CONTACT_SELECT = '*,company:crm_companies!companyId(id,name),leads:crm_leads!contactId(id,title,stage)'

export async function GET(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!canViewCRM(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const contacts = await sbSelect('crm_contacts', {
      select: CONTACT_SELECT,
      filters: {},
      order: 'name.asc',
    })

    return NextResponse.json({ data: contacts })
  } catch (err) {
    console.error('[CRM contacts GET]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!canViewCRM(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await req.json()
    const { name, email, phone, position, companyId, notes } = body

    if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 })

    const now = nowTs()
    const contact = await sbInsert('crm_contacts', {
      name,
      email: email || null,
      phone: phone || null,
      position: position || null,
      companyId: companyId || null,
      notes: notes || null,
      createdById: user.id,
      createdAt: now,
      updatedAt: now,
    })

    const full = await sbFindOne('crm_contacts', {
      select: CONTACT_SELECT,
      filters: { id: `eq.${contact.id}` },
    }) ?? contact

    return NextResponse.json({ data: full }, { status: 201 })
  } catch (err) {
    console.error('[CRM contacts POST]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
