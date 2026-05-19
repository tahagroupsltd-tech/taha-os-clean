// src/app/api/crm/deals/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { sbUpdate, sbDelete, sbFindOne } from '@/lib/supa'

export const dynamic = 'force-dynamic'

const DEAL_SELECT = '*,lead:crm_leads!lead_id(id,title),contact:crm_contacts!contact_id(id,name),company:crm_companies!company_id(id,name),project:projects!project_id(id,name),assignedTo:users!assigned_to_id(id,name)'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getUserFromRequest(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const patch: Record<string, any> = {}

    if (body.title !== undefined) patch.title = body.title
    if (body.value !== undefined) patch.value = body.value ? Number(body.value) : null
    if (body.stage !== undefined) patch.stage = body.stage
    if (body.probability !== undefined) patch.probability = body.probability
    if (body.closeDate !== undefined) patch.close_date = body.closeDate ? new Date(body.closeDate).toISOString() : null
    if (body.leadId !== undefined) patch.lead_id = body.leadId || null
    if (body.contactId !== undefined) patch.contact_id = body.contactId || null
    if (body.companyId !== undefined) patch.company_id = body.companyId || null
    if (body.projectId !== undefined) patch.project_id = body.projectId || null
    if (body.assignedToId !== undefined) patch.assigned_to_id = body.assignedToId || null
    if (body.notes !== undefined) patch.notes = body.notes || null

    await sbUpdate('crm_deals', { id: `eq.${params.id}` }, patch)

    const deal = await sbFindOne('crm_deals', {
      select: DEAL_SELECT,
      filters: { id: `eq.${params.id}` },
    })

    return NextResponse.json({ data: deal })
  } catch (err) {
    console.error('[CRM deals PATCH]', err)
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

    await sbDelete('crm_deals', { id: `eq.${params.id}` })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[CRM deals DELETE]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
