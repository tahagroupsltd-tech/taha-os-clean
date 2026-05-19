// src/app/api/crm/contacts/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { sbUpdate, sbDelete, sbFindOne } from '@/lib/supa'

export const dynamic = 'force-dynamic'

const CONTACT_SELECT = '*,company:crm_companies!company_id(id,name)'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getUserFromRequest(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const patch: Record<string, any> = {}

    if (body.name !== undefined) patch.name = body.name
    if (body.email !== undefined) patch.email = body.email || null
    if (body.phone !== undefined) patch.phone = body.phone || null
    if (body.position !== undefined) patch.position = body.position || null
    if (body.companyId !== undefined) patch.company_id = body.companyId || null
    if (body.notes !== undefined) patch.notes = body.notes || null

    await sbUpdate('crm_contacts', { id: `eq.${params.id}` }, patch)

    const contact = await sbFindOne('crm_contacts', {
      select: CONTACT_SELECT,
      filters: { id: `eq.${params.id}` },
    })

    return NextResponse.json({ data: contact })
  } catch (err) {
    console.error('[CRM contacts PATCH]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getUserFromRequest(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (user.role !== 'ADMIN' && user.role !== 'MANAGER') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await sbDelete('crm_contacts', { id: `eq.${params.id}` })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[CRM contacts DELETE]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
