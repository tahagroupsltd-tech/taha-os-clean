// src/app/(dashboard)/schedule/page.tsx
import { getServerUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { TopBar } from '@/components/layout/TopBar'
import { redirect } from 'next/navigation'
import { ScheduleClient } from './ScheduleClient'

export const metadata = { title: 'Bulk Schedule' }

export default async function SchedulePage() {
  const user = await getServerUser()
  if (!user) redirect('/login')
  if (!['ADMIN', 'MANAGER'].includes(user.role)) redirect('/overview')

  const [projects, editors] = await Promise.all([
    db.project.findMany({
      where: { status: { in: ['ACTIVE', 'PAUSED'] } },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    db.user.findMany({
      where: { role: { in: ['EMPLOYEE', 'MANAGER'] }, isActive: true },
      select: { id: true, name: true, username: true, role: true },
      orderBy: { name: 'asc' },
    }),
  ])

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <TopBar title="Bulk Schedule" />
      <ScheduleClient projects={projects} editors={editors} />
    </div>
  )
}
