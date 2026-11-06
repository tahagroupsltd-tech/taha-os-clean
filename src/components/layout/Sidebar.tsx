// src/components/layout/Sidebar.tsx
'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, CheckSquare, FileVideo, FolderKanban,
  Users, Settings, LogOut, Menu, X,
  Calendar, Wallet, ClipboardList,
  Target, ChevronDown, ChevronRight, BookMarked,
  FileText, IndianRupee, Megaphone, Scale, Briefcase,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import { useUIStore } from '@/store/ui.store'
import { useState, useEffect } from 'react'
import { TAHA_LOGO } from '@/lib/logo'

interface NavSection {
  title: string
  roles: string[]
  icon: any
  items: {
    href: string
    label: string
    icon: any
    color?: string
  }[]
}

const SECTIONS: NavSection[] = [
  {
    title: 'Management',
    roles: ['ADMIN', 'MANAGER', 'EMPLOYEE', 'SCRIPTWRITER', 'GRAPHIC_DESIGNER', 'WEB_DESIGNER', 'EDITOR'],
    icon: LayoutDashboard,
    items: [
      { href: '/overview', label: 'Overview', icon: LayoutDashboard, color: 'text-violet-400' },
      { href: '/calendar', label: 'Calendar', icon: Calendar, color: 'text-cyan-400' },
    ],
  },
  {
    title: 'Operations',
    roles: ['ADMIN', 'MANAGER', 'EMPLOYEE', 'SCRIPTWRITER', 'GRAPHIC_DESIGNER', 'WEB_DESIGNER', 'EDITOR'],
    icon: Briefcase,
    items: [
      { href: '/tasks', label: 'My Tasks', icon: CheckSquare, color: 'text-blue-400' },
      { href: '/projects', label: 'Projects', icon: FolderKanban, color: 'text-indigo-400' },
      { href: '/sop', label: 'SOP Pipeline', icon: BookMarked, color: 'text-amber-400' },
    ],
  },
  {
    title: 'Marketing',
    roles: ['ADMIN', 'MANAGER', 'EMPLOYEE', 'SCRIPTWRITER', 'GRAPHIC_DESIGNER', 'WEB_DESIGNER', 'EDITOR'],
    icon: Megaphone,
    items: [
      { href: '/content', label: 'Content Pipeline', icon: FileVideo, color: 'text-pink-400' },
      { href: '/schedule', label: 'Bulk Schedule', icon: Calendar, color: 'text-orange-400' },
    ],
  },
  {
    title: 'Sales',
    roles: ['ADMIN', 'MANAGER'],
    icon: Target,
    items: [
      { href: '/crm/pipeline', label: 'Sales Pipeline', icon: Target, color: 'text-rose-400' },
      { href: '/crm/deals', label: 'Deals', icon: IndianRupee, color: 'text-emerald-400' },
    ],
  },
  {
    title: 'Accounts',
    roles: ['ADMIN'],
    icon: Wallet,
    items: [
      { href: '/finance', label: 'Finance & Books', icon: Wallet, color: 'text-green-400' },
      { href: '/invoices', label: 'Invoices & Quotes', icon: IndianRupee, color: 'text-lime-400' },
    ],
  },
  {
    title: 'HR',
    roles: ['ADMIN', 'MANAGER', 'EMPLOYEE', 'SCRIPTWRITER', 'GRAPHIC_DESIGNER', 'WEB_DESIGNER', 'EDITOR'],
    icon: Users,
    items: [
      { href: '/reports', label: 'Daily Reports', icon: ClipboardList, color: 'text-sky-400' },
      { href: '/team', label: 'Team Directory', icon: Users, color: 'text-teal-400' },
    ],
  },
  {
    title: 'Legal',
    roles: ['ADMIN', 'MANAGER'],
    icon: Scale,
    items: [
      { href: '/documents', label: 'MOU & Agreements', icon: FileText, color: 'text-amber-400' },
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

  // Track which sections are open (default all active or relevant open)
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    Management: true,
    Operations: true,
    Marketing: true,
    Sales: true,
    Accounts: true,
    HR: true,
    Legal: true,
  })

  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
  }, [])

  const toggleSection = (title: string) => {
    setOpenSections((prev) => ({ ...prev, [title]: !prev[title] }))
  }

  const effectiveRole = user?.role ?? ''

  // Filter sections visible to current user
  const visibleSections = SECTIONS.filter((s) => s.roles.includes(effectiveRole))

  if (!mounted) {
    return (
      <aside className="fixed top-0 left-0 h-full w-56 z-30 bg-[#0F0F14] border-r border-white/5 lg:translate-x-0 -translate-x-full" />
    )
  }

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

        {/* 7 Business Functions Accordion Nav */}
        <nav className="flex-1 px-2 py-3 overflow-y-auto scrollbar-hidden space-y-2">
          {visibleSections.map((sec) => {
            const isOpen = openSections[sec.title] ?? true
            const hasActiveItem = sec.items.some(
              (item) => pathname === item.href || (item.href !== '/overview' && pathname.startsWith(item.href))
            )
            const SecIcon = sec.icon

            // Filter items by role if any specific check needed
            let items = sec.items
            if (sec.title === 'HR' && user?.role !== 'ADMIN' && user?.role !== 'MANAGER') {
              items = items.filter((i) => i.href !== '/team')
            }
            if (sec.title === 'Management' && user?.role !== 'ADMIN' && user?.role !== 'MANAGER') {
              items = items.filter((i) => i.href !== '/calendar')
            }

            if (items.length === 0) return null

            return (
              <div key={sec.title} className="rounded-lg bg-white/[0.02] border border-white/[0.04] overflow-hidden">
                <button
                  onClick={() => toggleSection(sec.title)}
                  className="w-full flex items-center justify-between px-2.5 py-1.5 text-xs font-semibold text-white/40 hover:text-white/70 transition-colors uppercase tracking-wider"
                >
                  <div className="flex items-center gap-1.5">
                    <SecIcon size={12} className={hasActiveItem ? 'text-white' : 'text-white/30'} />
                    <span className={hasActiveItem ? 'text-white/90 font-bold' : ''}>{sec.title}</span>
                  </div>
                  {isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                </button>

                {isOpen && (
                  <div className="px-1 pb-1 space-y-0.5">
                    {items.map((item) => {
                      const Icon = item.icon
                      const active = pathname === item.href || (item.href !== '/overview' && pathname.startsWith(item.href))
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setSidebarOpen(false)}
                          className={cn(
                            'flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs transition-all duration-150',
                            active
                              ? 'bg-white/10 text-white font-medium shadow-sm'
                              : 'text-white/50 hover:bg-white/5 hover:text-white/80'
                          )}
                        >
                          <Icon size={13} className={active ? item.color : 'text-white/30'} />
                          <span className="truncate">{item.label}</span>
                          {active && <span className="ml-auto w-1 h-1 rounded-full bg-current opacity-80" />}
                        </Link>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}

          {/* Quick Settings Link */}
          <div className="pt-2">
            <Link
              href="/settings"
              onClick={() => setSidebarOpen(false)}
              className={cn(
                'flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs transition-all',
                pathname === '/settings'
                  ? 'bg-white/10 text-white font-medium'
                  : 'text-white/40 hover:bg-white/5 hover:text-white/70'
              )}
            >
              <Settings size={13} className="text-white/30" />
              <span>Settings</span>
            </Link>
          </div>
        </nav>

        {/* User footer */}
        <div className="p-3 border-t border-white/5">
          <div className="flex items-center gap-2.5 mb-2 px-3 py-2 rounded-lg bg-white/5">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center flex-shrink-0">
              <span className="text-[11px] font-bold text-white">
                {user?.name?.[0]?.toUpperCase() ?? '?'}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-white/90 truncate">{user?.name}</p>
              <span
                className={cn(
                  'text-[9px] font-semibold px-1.5 py-0.5 rounded-sm uppercase tracking-wider',
                  ROLE_COLORS[user?.role ?? ''] ?? 'bg-white/10 text-white/50'
                )}
              >
                {user?.role?.toLowerCase()}
              </span>
            </div>
          </div>
          <button
            onClick={logout}
            className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-sm text-white/30 hover:bg-white/5 hover:text-white/60 transition-colors"
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
    <button className="lg:hidden p-2 text-stone-500 hover:text-stone-900" onClick={() => setSidebarOpen(true)}>
      <Menu size={18} />
    </button>
  )
}
