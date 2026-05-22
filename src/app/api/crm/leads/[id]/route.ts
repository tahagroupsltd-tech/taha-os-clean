// src/app/api/crm/leads/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { sbUpdate, sbDelete, sbFindOne } from '@/lib/supa'

export const dynamic = 'force-dynamic'

const LEAD_SELECT = '*,contact:crm_contacts!contact_id(id,name,email,phone),company:crm_companies!company_id(id,name),assignedTo:users!assigned_to_id(id,name),project:projects!project_id(id,name)'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getUserFromRequest(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const patch: Record<string, any> = {}

    if (body.title !== undefined) patch.title = body.title
    if (body.stage !== undefined) patch.stage = body.stage
    if (body.source !== undefined) patch.source = body.source
    if (body.value !== undefined) patch.value = body.value ? Number(body.value) : null
    if (body.contactId !== undefined) patch.contact_id = body.contactId || null
    if (body.companyId !== undefined) patch.company_id = body.companyId || null
    if (body.assignedToId !== undefined) patch.assigned_to_id = body.assignedToId || null
    if (body.projectId !== undefined) patch.project_id = body.projectId || null
    if (body.notes !== undefined) patch.notes = body.notes || null
    if (body.niche !== undefined) patch.niche = body.niche || null
    if (body.phone !== undefined) patch.phone = body.phone || null
    if (body.instagram_url !== undefined) patch.instagram_url = body.instagram_url || null
    if (body.youtube_url !== undefined) patch.youtube_url = body.youtube_url || null
    if (body.facebook_url !== undefined) patch.facebook_url = body.facebook_url || null
    if (body.website_url !== undefined) patch.website_url = body.website_url || null
    if (body.other_links !== undefined) patch.other_links = body.other_links || null
    if (body.expectedCloseDate !== undefined) {
      patch.expected_close_date = body.expectedCloseDate ? new Date(body.expectedCloseDate).toISOString() : null
    }

    await sbUpdate('crm_leads', { id: `eq.${params.id}` }, patch)

    const lead = await sbFindOne('crm_leads', {
      select: LEAD_SELECT,
      filters: { id: `eq.${params.id}` },
    })

    return NextResponse.json({ data: lead })
  } catch (err) {
    console.error('[CRM leads PATCH]', err)
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

    await sbDelete('crm_leads', { id: `eq.${params.id}` })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[CRM leads DELETE]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
