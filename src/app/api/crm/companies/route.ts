// src/app/api/crm/companies/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { sbSelect, sbInsert, sbCount, nowTs } from '@/lib/supa'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const companies = await sbSelect('crm_companies', {
      select: '*',
      filters: {},
      order: 'name.asc',
    })

    // Attach counts
    const withCounts = await Promise.all(
      companies.map(async (c: any) => {
        const [contacts, leads, deals] = await Promise.all([
          sbCount('crm_contacts', { company_id: `eq.${c.id}` }),
          sbCount('crm_leads', { company_id: `eq.${c.id}` }),
          sbCount('crm_deals', { company_id: `eq.${c.id}` }),
        ])
        return { ...c, _count: { contacts, leads, deals } }
      })
    )

    return NextResponse.json({ data: withCounts })
  } catch (err) {
    console.error('[CRM companies GET]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { name, industry, website, address, notes } = body

    if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 })

    const now = nowTs()
    const company = await sbInsert('crm_companies', {
      name,
      industry: industry || null,
      website: website || null,
      address: address || null,
      notes: notes || null,
      created_by_id: user.id,
      created_at: now,
      updated_at: now,
    })

    return NextResponse.json({ data: { ...company, _count: { contacts: 0, leads: 0, deals: 0 } } }, { status: 201 })
  } catch (err) {
    console.error('[CRM companies POST]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
