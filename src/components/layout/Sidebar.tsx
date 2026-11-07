// src/components/layout/Sidebar.tsx
'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, CheckSquare, FileVideo, FolderKanban,
  Users, Settings, LogOut, Menu, X,
  Calendar, Wallet, ClipboardList,
  Target, BookMarked, FileText, IndianRupee,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import { useUIStore } from '@/store/ui.store'
import { useState, useEffect } from 'react'
import { TAHA_LOGO } from '@/lib/logo'

interface NavGroup {
  label: string
  roles: string[]
  items: {
    href: string
    label: string
    icon: any
    color?: string
    roles?: string[]
  }[]
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Work',
    roles: ['ADMIN', 'MANAGER', 'EMPLOYEE', 'SCRIPTWRITER', 'GRAPHIC_DESIGNER', 'WEB_DESIGNER', 'EDITOR'],
    items: [
      { href: '/overview', label: 'Overview', icon: LayoutDashboard, color: 'text-violet-400' },
      { href: '/tasks', label: 'Tasks', icon: CheckSquare, color: 'text-blue-400' },
      { href: '/content', label: 'Content Pipeline', icon: FileVideo, color: 'text-pink-400' },
      { href: '/projects', label: 'Projects', icon: FolderKanban, color: 'text-indigo-400' },
      { href: '/calendar', label: 'Calendar', icon: Calendar, color: 'text-cyan-400', roles: ['ADMIN', 'MANAGER'] },
    ],
  },
  {
    label: 'Business',
    roles: ['ADMIN', 'MANAGER'],
    items: [
      { href: '/finance', label: 'Finance', icon: Wallet, color: 'text-emerald-400', roles: ['ADMIN'] },
      { href: '/invoices', label: 'Invoices', icon: IndianRupee, color: 'text-lime-400' },
      { href: '/crm/pipeline', label: 'Sales Pipeline', icon: Target, color: 'text-rose-400' },
    ],
  },
  {
    label: 'Studio',
    roles: ['ADMIN', 'MANAGER', 'EMPLOYEE', 'SCRIPTWRITER', 'GRAPHIC_DESIGNER', 'WEB_DESIGNER', 'EDITOR'],
    items: [
      { href: '/team', label: 'Team', icon: Users, color: 'text-teal-400', roles: ['ADMIN', 'MANAGER'] },
      { href: '/sop', label: 'SOP Pipeline', icon: BookMarked, color: 'text-amber-400' },
      { href: '/documents', label: 'Legal Agreements', icon: FileText, color: 'text-amber-300', roles: ['ADMIN', 'MANAGER'] },
      { href: '/reports', label: 'Daily Reports', icon: ClipboardList, color: 'text-sky-400' },
    ],
  },
]

const ROLE_COLORS: Record<string, string> = {
  ADMIN: 'bg-violet-500/20 text-violet-300',
  MANAGER: 'bg-blue-500/20 text-blue-300',
  EMPLOYEE: 'bg-cyan-500/20 text-cyan-300',
  EDITOR: 'bg-cyan-500/20 text-cyan-300',
  SCRIPTWRITER: 'bg-cyan-500/20 text-cyan-300',
  GRAPHIC_DESIGNER: 'bg-cyan-500/20 text-cyan-300',
  WEB_DESIGNER: 'bg-cyan-500/20 text-cyan-300',
  CLIENT: 'bg-emerald-500/20 text-emerald-300',
}

export function Sidebar() {
  const pathname = usePathname()
  const { user, logout } = useAuth()
  const { sidebarOpen, setSidebarOpen } = useUIStore()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const effectiveRole = user?.role ?? ''

  if (!mounted) {
    return (
      <aside className="fixed top-0 left-0 h-full w-56 z-30 bg-[#0F0F14] border-r border-white/5 lg:translate-x-0 -translate-x-full" />
    )
  }

  // Filter groups visible to user
  const visibleGroups = NAV_GROUPS.filter((g) => g.roles.includes(effectiveRole))

  return (
    <>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-20 lg:hidden backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed top-0 left-0 h-full w-56 z-30',
          'flex flex-col transition-transform duration-200',
          'bg-[#0F0F14] border-r border-white/5',
          'lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Logo */}
        <div className="flex items-center justify-between h-14 px-4 border-b border-white/5">
          <div className="flex items-center gap-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={TAHA_LOGO}
              alt="Taha Media"
              className="h-8 w-auto"
              style={{ filter: 'invert(1) brightness(2)' }}
            />
          </div>
          <button
            className="lg:hidden text-white/40 hover:text-white/80"
            onClick={() => setSidebarOpen(false)}
          >
            <X size={16} />
          </button>
        </div>

        {/* Clean, Simple Navigation */}
        <nav className="flex-1 px-3 py-4 overflow-y-auto scrollbar-hidden space-y-4">
          {visibleGroups.map((group) => {
            const filteredItems = group.items.filter(
              (item) => !item.roles || item.roles.includes(effectiveRole)
            )

            if (filteredItems.length === 0) return null

            return (
              <div key={group.label} className="space-y-1">
                <p className="px-2.5 text-[10px] font-bold uppercase tracking-wider text-white/30 mb-1">
                  {group.label}
                </p>
                {filteredItems.map((item) => {
                  const Icon = item.icon
                  const active = pathname === item.href || (item.href !== '/overview' && pathname.startsWith(item.href))
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setSidebarOpen(false)}
                      className={cn(
                        'flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs transition-colors duration-150',
                        active
                          ? 'bg-white/10 text-white font-semibold shadow-xs'
                          : 'text-white/60 hover:bg-white/5 hover:text-white/90'
                      )}
                    >
                      <Icon size={14} className={active ? item.color : 'text-white/40'} />
                      <span className="truncate">{item.label}</span>
                      {active && <span className="ml-auto w-1 h-1 rounded-full bg-white opacity-80" />}
                    </Link>
                  )
                })}
              </div>
            )
          })}

          {/* Settings */}
          <div className="pt-2 border-t border-white/5">
            <Link
              href="/settings"
              onClick={() => setSidebarOpen(false)}
              className={cn(
                'flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs transition-colors',
                pathname === '/settings'
                  ? 'bg-white/10 text-white font-semibold'
                  : 'text-white/40 hover:bg-white/5 hover:text-white/70'
              )}
            >
              <Settings size={14} className="text-white/40" />
              <span>Settings</span>
            </Link>
          </div>
        </nav>

        {/* User footer */}
        <div className="p-3 border-t border-white/5">
          <div className="flex items-center gap-2.5 mb-2 px-2.5 py-2 rounded-lg bg-white/5">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center flex-shrink-0">
              <span className="text-[11px] font-bold text-white">
                {user?.name?.[0]?.toUpperCase() ?? '?'}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-white/90 truncate">{user?.name}</p>
              <span
                className={cn(
                  'text-[9px] font-semibold px-1.5 py-0.2 rounded-xs uppercase tracking-wider',
                  ROLE_COLORS[user?.role ?? ''] ?? 'bg-white/10 text-white/50'
                )}
              >
                {user?.role?.toLowerCase()}
              </span>
            </div>
          </div>

          <button
            onClick={() => logout()}
            className="w-full flex items-center justify-center gap-2 px-3 py-1.5 rounded-md text-xs text-white/40 hover:text-white/80 hover:bg-white/5 transition-colors"
          >
            <LogOut size={13} />
            <span>Sign out</span>
          </button>
        </div>
      </aside>
    </>
  )
}

export function SidebarToggle() {
  const { toggleSidebar } = useUIStore()
  return (
    <button
      onClick={toggleSidebar}
      className="p-1.5 -ml-1.5 rounded-md text-stone-500 hover:text-stone-900 hover:bg-stone-100 lg:hidden transition-colors"
      aria-label="Toggle navigation"
    >
      <Menu size={18} />
    </button>
  )
}
