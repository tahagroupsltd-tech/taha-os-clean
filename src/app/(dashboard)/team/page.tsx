// src/app/(dashboard)/team/page.tsx
import { redirect } from 'next/navigation'
import { getServerUser } from '@/lib/auth'
import { sbSelect } from '@/lib/supa'
import { TeamClient } from './team-client'
import { canViewTeam } from '@/lib/permissions'
import type { User } from '@/types'

export default async function TeamPage() {
  const me = await getServerUser()
  if (!me) redirect('/login')
  if (!canViewTeam(me.role)) redirect('/overview')

  const rows = await sbSelect('users', {
    select: 'id,username,name,role,phone,isActive,createdAt',
    filters: {},
    order: 'createdAt.desc',
  }).catch(() => [] as any[])

  const initialUsers: User[] = rows.map((u: any) => ({
    id: u.id,
    username: u.username,
    name: u.name,
    role: u.role,
    phone: u.phone,
    isActive: u.isActive,
    createdAt: u.createdAt,
  }))

  return (
    <TeamClient
      initialUsers={initialUsers}
      currentUserId={me.id}
      currentUserRole={me.role}
    />
  )
}
