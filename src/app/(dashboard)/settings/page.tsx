// src/app/(dashboard)/settings/page.tsx
import { getServerUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { TopBar } from '@/components/layout/TopBar'
import { formatDate } from '@/lib/utils'
import { SettingsClient } from './settings-client'
import {
  canViewSystemStats,
  canResetPassword,
  ROLE_LABEL,
} from '@/lib/permissions'
import type { Role } from '@/types'

export default async function SettingsPage() {
  const user = await getServerUser()
  if (!user) return null

  const showSystemStats = canViewSystemStats(user.role)

  const safe = async <T,>(fn: () => Promise<T>, fallback: T): Promise<T> => {
    try { return await fn() } catch (e) { console.error('[settings] query failed:', e); return fallback }
  }

  // sequential to avoid pooler prepared-statement issues
  const userCount = await safe(() => db.user.count(), 0)
  const taskCount = await safe(() => db.task.count(), 0)
  const contentCount = await safe(() => db.content.count(), 0)
  const projectCount = await safe(() => db.project.count(), 0)

  // Both admins and managers see the user list (managers can reset non-admin passwords)
  const allUsers = showSystemStats
    ? await safe(
        () => db.user.findMany({
          orderBy: { createdAt: 'desc' },
          select: { id: true, username: true, name: true, role: true, createdAt: true },
        }),
        [] as any[]
      )
    : []

  // Only show users in the password-reset dropdown that the current user can actually reset
  const resettableUsers = allUsers.filter((u: any) =>
    u.id !== user.id && canResetPassword(user.role, u.role as Role)
  )

  // Google Calendar connection state
  const gcalToken = await safe(
    () => db.googleCalendarToken.findUnique({ where: { userId: user.id }, select: { id: true } }),
    null
  )
  const gcalConnected = !!gcalToken
  // Fetch current reminder preference
  const reminderUser = await safe(
    () => db.user.findUnique({ where: { id: user.id }, select: { calendarReminderMins: true } }),
    null
  )
  const calendarReminderMins = reminderUser?.calendarReminderMins ?? null

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <TopBar title="Settings" />

      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {/* Account info */}
        <div className="bg-white rounded-lg border border-stone-100 p-5">
          <h2 className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-4">
            Your Account
          </h2>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-stone-100 flex items-center justify-center">
              <span className="text-lg font-bold text-stone-600">
                {user.name[0].toUpperCase()}
              </span>
            </div>
            <div>
              <p className="text-sm font-semibold text-stone-900">{user.name}</p>
              <p className="text-xs text-stone-400 font-mono mt-0.5">@{user.username}</p>
              <span className="inline-flex mt-1.5 items-center rounded px-2 py-0.5 text-[11px] font-medium bg-stone-900 text-white">
                {ROLE_LABEL[user.role as Role]}
              </span>
            </div>
          </div>
        </div>

        {/* Password change + admin/manager reset (client-side) */}
        <SettingsClient
          currentUserId={user.id}
          canResetOthers={resettableUsers.length > 0}
          users={resettableUsers.map((u: any) => ({
            id: u.id,
            username: u.username,
            name: u.name,
            role: u.role,
          }))}
          gcalConnected={gcalConnected}
          calendarReminderMins={calendarReminderMins}
        />

        {/* System stats — admin + manager */}
        {showSystemStats && (
          <div className="bg-white rounded-lg border border-stone-100 p-5">
            <h2 className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-4">
              System Overview
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: 'Users', value: userCount },
                { label: 'Projects', value: projectCount },
                { label: 'Tasks', value: taskCount },
                { label: 'Content items', value: contentCount },
              ].map((stat) => (
                <div key={stat.label} className="bg-stone-50 rounded-md p-3">
                  <p className="text-xl font-bold text-stone-900">{stat.value}</p>
                  <p className="text-xs text-stone-400 mt-0.5">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* All users table — admin + manager */}
        {showSystemStats && (
          <div className="bg-white rounded-lg border border-stone-100 overflow-hidden">
            <div className="px-5 py-3 border-b border-stone-100">
              <h2 className="text-xs font-semibold text-stone-500 uppercase tracking-wide">
                All Users ({allUsers.length})
              </h2>
            </div>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-stone-50 bg-stone-50">
                  <th className="text-left px-5 py-2.5 font-medium text-stone-400 uppercase tracking-wide">Name</th>
                  <th className="text-left px-5 py-2.5 font-medium text-stone-400 uppercase tracking-wide">Username</th>
                  <th className="text-left px-5 py-2.5 font-medium text-stone-400 uppercase tracking-wide">Role</th>
                  <th className="text-left px-5 py-2.5 font-medium text-stone-400 uppercase tracking-wide">Joined</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-50">
                {allUsers.map((u) => (
                  <tr key={u.id}>
                    <td className="px-5 py-3 font-medium text-stone-900">{u.name}</td>
                    <td className="px-5 py-3 text-stone-500 font-mono">{u.username}</td>
                    <td className="px-5 py-3 text-stone-500">{ROLE_LABEL[u.role as Role]}</td>
                    <td className="px-5 py-3 text-stone-400">{formatDate(u.createdAt.toISOString())}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
