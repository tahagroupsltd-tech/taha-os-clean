// src/app/(dashboard)/team/page.tsx
import { redirect } from 'next/navigation'
import { getServerUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { TeamClient } from './team-client'
import { canViewTeam } from '@/lib/permissions'
import type { User } from '@/types'

export default async function TeamPage() {
  const me = await getServerUser()
  if (!me) redirect('/login')
  if (!canViewTeam(me.role)) redirect('/overview')

  // Initial server-side fetch — no client-side loading flicker on first paint.
  // The client component will refresh from /api/users after any mutation.
  const safe = async <T,>(fn: () => Promise<T>, fallback: T): Promise<T> => {
    try {
      return await fn()
    } catch (e) {
      console.error('[team] query failed:', e)
      return fallback
    }
  }

  const rows = await safe(
    () =>
      db.user.findMany({
        select: {
          id: true,
          username: true,
          name: true,
          role: true,
          phone: true,
          isActive: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
    [] as any[]
  )

  // Serialize Date → ISO string so it matches the User type (createdAt: string)
  const initialUsers: User[] = rows.map((u: any) => ({
    id: u.id,
    username: u.username,
    name: u.name,
    role: u.role,
    phone: u.phone,
    isActive: u.isActive,
    createdAt: u.createdAt instanceof Date ? u.createdAt.toISOString() : u.createdAt,
  }))

  return (
    <TeamClient
      initialUsers={initialUsers}
      currentUserId={me.id}
      currentUserRole={me.role}
    />
  )
}
