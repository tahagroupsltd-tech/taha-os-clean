// src/components/layout/Sidebar.tsx
'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, CheckSquare, FileVideo, FolderKanban,
  Users, Settings, LogOut, Menu, X,
  Calendar, StickyNote, Wallet, ClipboardList, IndianRupee, CalendarRange,
  TrendingUp, UserCircle, Target, ChevronDown, ChevronRight, BookMarked, Sparkles,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import { useUIStore } from '@/store/ui.store'
import { useState } from 'react'

const NAV_ITEMS = [
  { href: '/overview', label: 'Overview', icon: LayoutDashboard, roles: ['ADMIN', 'MANAGER', 'EMPLOYEE', 'CLIENT'] },
  { href: '/tasks', label: 'Tasks', icon: CheckSquare, roles: ['ADMIN', 'MANAGER', 'EMPLOYEE'] },
  { href: '/calendar', label: 'Calendar', icon: Calendar, roles: ['ADMIN', 'MANAGER', 'EMPLOYEE', 'CLIENT'] },
  { href: '/content', label: 'Content', icon: FileVideo, roles: ['ADMIN', 'MANAGER', 'EMPLOYEE'] },
  { href: '/schedule', label: 'Bulk Schedule', icon: CalendarRange, roles: ['ADMIN', 'MANAGER'] },
  { href: '/notes', label: 'Notes', icon: StickyNote, roles: ['ADMIN', 'MANAGER', 'EMPLOYEE'] },
  // Finance + Billing are FOUNDER ONLY
  { href: '/finance', label: 'Finance', icon: Wallet, roles: ['ADMIN'] },
  { href: '/billing', label: 'Client Billing', icon: IndianRupee, roles: ['ADMIN'] },
  { href: '/projects', label: 'Projects', icon: FolderKanban, roles: ['ADMIN', 'MANAGER', 'EMPLOYEE', 'CLIENT'] },
  { href: '/reports', label: 'Daily Reports', icon: ClipboardList, roles: ['ADMIN', 'MANAGER', 'EMPLOYEE'] },
  { href: '/team', label: 'Team', icon: Users, roles: ['ADMIN', 'MANAGER'] },
  { href: '/sop', label: 'SOP Pipeline', icon: BookMarked, roles: ['ADMIN', 'MANAGER', 'EMPLOYEE'] },
  { href: '/ai-tools', label: 'AI Tools', icon: Sparkles, roles: ['ADMIN', 'MANAGER'] },
  { href: '/settings', label: 'Settings', icon: Settings, roles: ['ADMIN', 'MANAGER', 'EMPLOYEE', 'CLIENT'] },
]

const CRM_ITEMS = [
  { href: '/crm', label: 'Overview', icon: TrendingUp },
  { href: '/crm/pipeline', label: 'Pipeline', icon: Target },
  { href: '/crm/contacts', label: 'Contacts', icon: UserCircle },
  { href: '/crm/deals', label: 'Deals', icon: IndianRupee },
]

export function Sidebar() {
  const pathname = usePathname()
  const { user, logout } = useAuth()
  const { sidebarOpen, setSidebarOpen } = useUIStore()
  const [crmOpen, setCrmOpen] = useState(pathname.startsWith('/crm'))

  const visibleItems = NAV_ITEMS.filter(
    (item) => user && item.roles.includes(user.role)
  )
  const showCrm = user && ['ADMIN', 'MANAGER'].includes(user.role)
  const crmActive = pathname.startsWith('/crm')

  return (
    <>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed top-0 left-0 h-full w-56 bg-white border-r border-stone-100 z-30',
          'flex flex-col transition-transform duration-200',
          'lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Logo */}
        <div className="flex items-center justify-between h-14 px-4 border-b border-stone-100">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-md bg-stone-900 flex items-center justify-center">
              <span className="text-white text-[10px] font-bold">TM</span>
            </div>
            <span className="text-sm font-semibold text-stone-900 tracking-tight">
              Taha Media
            </span>
          </div>
          <button
            className="lg:hidden text-stone-400 hover:text-stone-700"
            onClick={() => setSidebarOpen(false)}
          >
            <X size={16} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 py-3 overflow-y-auto">
          <div className="space-y-0.5">
            {visibleItems.map((item) => {
              const Icon = item.icon
              const active = pathname === item.href || pathname.startsWith(item.href + '/')
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={cn(
                    'flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors',
                    active
                      ? 'bg-stone-100 text-stone-900 font-medium'
                      : 'text-stone-500 hover:bg-stone-50 hover:text-stone-800'
                  )}
                >
                  <Icon size={15} className={active ? 'text-stone-900' : 'text-stone-400'} />
                  {item.label}
                </Link>
              )
            })}

            {/* CRM Section */}
            {showCrm && (
              <div className="pt-2">
                <button
                  onClick={() => setCrmOpen(o => !o)}
                  className={cn(
                    'flex items-center justify-between w-full px-3 py-2 rounded-md text-sm transition-colors',
                    crmActive
                      ? 'bg-stone-100 text-stone-900 font-medium'
                      : 'text-stone-500 hover:bg-stone-50 hover:text-stone-800'
                  )}
                >
                  <div className="flex items-center gap-2.5">
                    <TrendingUp size={15} className={crmActive ? 'text-stone-900' : 'text-stone-400'} />
                    <span>CRM</span>
                  </div>
                  {crmOpen
                    ? <ChevronDown size={12} className="text-stone-400" />
                    : <ChevronRight size={12} className="text-stone-400" />
                  }
                </button>
                {crmOpen && (
                  <div className="ml-4 mt-0.5 space-y-0.5 border-l border-stone-100 pl-2">
                    {CRM_ITEMS.map(item => {
                      const Icon = item.icon
                      const active = pathname === item.href || (item.href !== '/crm' && pathname.startsWith(item.href))
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setSidebarOpen(false)}
                          className={cn(
                            'flex items-center gap-2 px-2 py-1.5 rounded-md text-xs transition-colors',
                            active
                              ? 'bg-stone-100 text-stone-900 font-medium'
                              : 'text-stone-500 hover:bg-stone-50 hover:text-stone-800'
                          )}
                        >
                          <Icon size={13} className={active ? 'text-stone-900' : 'text-stone-400'} />
                          {item.label}
                        </Link>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </nav>

        {/* User footer */}
        <div className="p-3 border-t border-stone-100">
          <div className="flex items-center gap-2.5 mb-2 px-3 py-2">
            <div className="w-7 h-7 rounded-full bg-stone-200 flex items-center justify-center flex-shrink-0">
              <span className="text-[11px] font-bold text-stone-600">
                {user?.name?.[0]?.toUpperCase() ?? '?'}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-stone-900 truncate">{user?.name}</p>
              <p className="text-[10px] text-stone-400 capitalize">{user?.role?.toLowerCase()}</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="flex items-center gap-2.5 w-full px-3 py-2 rounded-md text-sm text-stone-400 hover:bg-stone-50 hover:text-stone-700 transition-colors"
          >
            <LogOut size={14} />
            Sign out
          </button>
        </div>
      </aside>
    </>
  )
}

// Mobile toggle button used in TopBar
export function SidebarToggle() {
  const { setSidebarOpen } = useUIStore()
  return (
    <button
      className="lg:hidden p-2 text-stone-500 hover:text-stone-900"
      onClick={() => setSidebarOpen(true)}
    >
      <Menu size={18} />
    </button>
  )
}
