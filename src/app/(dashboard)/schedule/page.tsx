// src/app/(dashboard)/schedule/page.tsx
import { getServerUser } from '@/lib/auth'
import { sbSelect } from '@/lib/supa'
import { TopBar } from '@/components/layout/TopBar'
import { redirect } from 'next/navigation'
import { ScheduleClient } from './ScheduleClient'

export const metadata = { title: 'Bulk Schedule' }

export default async function SchedulePage() {
  const user = await getServerUser()
  if (!user) redirect('/login')
  if (!['ADMIN', 'MANAGER'].includes(user.role)) redirect('/overview')

  const [projects, editors] = await Promise.all([
    sbSelect('projects', {
      select: 'id,name',
      filters: { status: 'in.(ACTIVE,PAUSED)' },
      order: 'name.asc',
    }).catch(() => [] as any[]),
    sbSelect('users', {
      select: 'id,name,username,role',
      filters: { isActive: 'eq.true' },
      order: 'name.asc',
    }).then((users: any[]) =>
      users.filter((u: any) => ['EMPLOYEE', 'MANAGER'].includes(u.role))
    ).catch(() => [] as any[]),
  ])

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <TopBar title="Bulk Schedule" />
      <ScheduleClient projects={projects} editors={editors} />
    </div>
  )
}
