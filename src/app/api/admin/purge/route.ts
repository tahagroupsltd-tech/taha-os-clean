// src/app/api/admin/purge/route.ts
// ADMIN-only endpoint to delete finance data or client accounts.
// Every action requires explicit confirmation of the action type.
import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { sbSelect, sbDelete } from '@/lib/supa'

export const dynamic = 'force-dynamic'

// Only ADMIN (founder) can call this endpoint
function guard(role: string) {
  return role !== 'ADMIN'
}

export async function DELETE(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (guard(user.role)) return NextResponse.json({ error: 'Forbidden — ADMIN only' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const action = searchParams.get('action')

  // ── 1. Clear all finance records ───────────────────────────────────────────
  if (action === 'finance') {
    // Delete in safe order (children before parents)
    await sbDelete('transactions', { id: 'not.is.null' })   // all transactions
    await sbDelete('invoices', { id: 'not.is.null' })        // all invoices
    await sbDelete('loans', { id: 'not.is.null' })           // all loans
    await sbDelete('receivables', { id: 'not.is.null' })     // all receivables

    return NextResponse.json({
      message: 'All finance records deleted: transactions, invoices, loans, receivables.',
    })
  }

  // ── 2. Remove all CLIENT accounts (and their linked data) ──────────────────
  if (action === 'clients') {
    // Fetch all CLIENT user IDs first
    const clients = await sbSelect('users', {
      select: 'id',
      filters: { role: 'eq.CLIENT' },
    })

    if (clients.length === 0) {
      return NextResponse.json({ message: 'No client accounts found.' })
    }

    const clientIds = clients.map((c: any) => c.id)

    // Unlink projects from these clients (set clientId = null) rather than
    // deleting the projects themselves — tasks, content, etc. stay intact.
    for (const id of clientIds) {
      await sbDelete('notifications', { userId: `eq.${id}` })
    }

    // Nullify clientId on projects so the projects remain but lose the client link
    for (const id of clientIds) {
      // Update projects to remove client link
      await fetch(
        `${process.env.SUPABASE_URL ?? 'https://zmhmxfndzrrdmvvqblkx.supabase.co'}/rest/v1/projects?clientId=eq.${id}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            apikey: process.env.SUPABASE_ANON_KEY ?? '',
            Authorization: `Bearer ${process.env.SUPABASE_ANON_KEY ?? ''}`,
            Prefer: 'return=minimal',
          },
          body: JSON.stringify({ clientId: null }),
          cache: 'no-store',
        }
      )
    }

    // Delete CLIENT invoices (client_id references)
    for (const id of clientIds) {
      await sbDelete('invoices', { client_id: `eq.${id}` })
    }

    // Finally delete the CLIENT user accounts
    for (const id of clientIds) {
      await sbDelete('users', { id: `eq.${id}` })
    }

    return NextResponse.json({
      message: `${clientIds.length} client account(s) removed. Their projects remain but are now unlinked.`,
      count: clientIds.length,
    })
  }

  // ── 3. Remove a single client by ID ────────────────────────────────────────
  if (action === 'client') {
    const clientId = searchParams.get('clientId')
    if (!clientId) return NextResponse.json({ error: 'clientId is required' }, { status: 400 })

    // Verify they're actually a CLIENT
    const clientUsers = await sbSelect('users', {
      select: 'id,name,role',
      filters: { id: `eq.${clientId}`, role: 'eq.CLIENT' },
    })
    if (clientUsers.length === 0) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 })
    }

    const clientName = clientUsers[0].name

    // Remove notifications
    await sbDelete('notifications', { userId: `eq.${clientId}` })

    // Nullify project client links
    await fetch(
      `${process.env.SUPABASE_URL ?? 'https://zmhmxfndzrrdmvvqblkx.supabase.co'}/rest/v1/projects?clientId=eq.${clientId}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          apikey: process.env.SUPABASE_ANON_KEY ?? '',
          Authorization: `Bearer ${process.env.SUPABASE_ANON_KEY ?? ''}`,
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({ clientId: null }),
        cache: 'no-store',
      }
    )

    // Remove invoices belonging to this client
    await sbDelete('invoices', { client_id: `eq.${clientId}` })

    // Delete the user
    await sbDelete('users', { id: `eq.${clientId}` })

    return NextResponse.json({
      message: `Client "${clientName}" removed successfully. Their projects remain but are now unlinked.`,
    })
  }

  return NextResponse.json({ error: 'Unknown action. Use ?action=finance, clients, or client&clientId=...' }, { status: 400 })
}
