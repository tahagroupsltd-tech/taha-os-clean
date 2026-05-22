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
import { TAHA_LOGO } from '@/lib/logo'

const NAV_ITEMS = [
  { href: '/overview',  label: 'Overview',      icon: LayoutDashboard, roles: ['ADMIN','MANAGER','EMPLOYEE','CLIENT'], color: 'text-violet-400' },
  { href: '/tasks',     label: 'Tasks',          icon: CheckSquare,     roles: ['ADMIN','MANAGER','EMPLOYEE'],          color: 'text-blue-400'   },
  { href: '/calendar',  label: 'Calendar',       icon: Calendar,        roles: ['ADMIN','MANAGER','EMPLOYEE','CLIENT'], color: 'text-cyan-400'   },
  { href: '/content',   label: 'Content',        icon: FileVideo,       roles: ['ADMIN','MANAGER','EMPLOYEE'],          color: 'text-pink-400'   },
  { href: '/schedule',  label: 'Bulk Schedule',  icon: CalendarRange,   roles: ['ADMIN','MANAGER'],                     color: 'text-orange-400' },
  { href: '/notes',     label: 'Notes',          icon: StickyNote,      roles: ['ADMIN','MANAGER','EMPLOYEE'],          color: 'text-yellow-400' },
  { href: '/finance',   label: 'Finance',        icon: Wallet,          roles: ['ADMIN'],                               color: 'text-green-400'  },
  { href: '/billing',   label: 'Client Billing', icon: IndianRupee,     roles: ['ADMIN'],                               color: 'text-emerald-400'},
  { href: '/projects',  label: 'Projects',       icon: FolderKanban,    roles: ['ADMIN','MANAGER','EMPLOYEE','CLIENT'], color: 'text-indigo-400' },
  { href: '/reports',   label: 'Daily Reports',  icon: ClipboardList,   roles: ['ADMIN','MANAGER','EMPLOYEE'],          color: 'text-sky-400'    },
  { href: '/team',      label: 'Team',           icon: Users,           roles: ['ADMIN','MANAGER'],                     color: 'text-teal-400'   },
  { href: '/sop',       label: 'SOP Pipeline',   icon: BookMarked,      roles: ['ADMIN','MANAGER','EMPLOYEE'],          color: 'text-amber-400'  },
  { href: '/ai-tools',  label: 'AI Tools',       icon: Sparkles,        roles: ['ADMIN','MANAGER'],                     color: 'text-purple-400' },
  { href: '/settings',  label: 'Settings',       icon: Settings,        roles: ['ADMIN','MANAGER','EMPLOYEE','CLIENT'], color: 'text-slate-400'  },
]

const CRM_ITEMS = [
  { href: '/crm',          label: 'Overview',  icon: TrendingUp  },
  { href: '/crm/pipeline', label: 'Pipeline',  icon: Target      },
  { href: '/crm/contacts', label: 'Contacts',  icon: UserCircle  },
  { href: '/crm/deals',    label: 'Deals',     icon: IndianRupee },
]

const ROLE_COLORS: Record<string, string> = {
  ADMIN:    'bg-violet-500/20 text-violet-300',
  MANAGER:  'bg-blue-500/20 text-blue-300',
  EMPLOYEE: 'bg-cyan-500/20 text-cyan-300',
  EDITOR:   'bg-cyan-500/20 text-cyan-300',
  SCRIPTWRITER: 'bg-cyan-500/20 text-cyan-300',
  GRAPHIC_DESIGNER: 'bg-cyan-500/20 text-cyan-300',
  WEB_DESIGNER: 'bg-cyan-500/20 text-cyan-300',
  CLIENT:   'bg-emerald-500/20 text-emerald-300',
}

export function Sidebar() {
  const pathname = usePathname()
  const { user, logout } = useAuth()
  const { sidebarOpen, setSidebarOpen } = useUIStore()
  const [crmOpen, setCrmOpen] = useState(pathname.startsWith('/crm'))

  const effectiveRole = user && ['EDITOR', 'SCRIPTWRITER', 'GRAPHIC_DESIGNER', 'WEB_DESIGNER'].includes(user.role)
    ? 'EMPLOYEE'
    : user?.role

  const visibleItems = NAV_ITEMS.filter(item => user && effectiveRole && item.roles.includes(effectiveRole))
  const showCrm = user && ['ADMIN','MANAGER'].includes(user.role)
  const crmActive = pathname.startsWith('/crm')

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

        {/* Nav */}
        <nav className="flex-1 px-2 py-3 overflow-y-auto scrollbar-hidden">
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
                    'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all duration-150',
                    active
                      ? 'bg-white/10 text-white font-medium'
                      : 'text-white/50 hover:bg-white/5 hover:text-white/80'
                  )}
                >
                  <Icon
                    size={15}
                    className={active ? item.color : 'text-white/30'}
                  />
                  {item.label}
                  {active && (
                    <span className="ml-auto w-1.5 h-1.5 rounded-full bg-current opacity-60" />
                  )}
                </Link>
              )
            })}

            {/* CRM Section */}
            {showCrm && (
              <div className="pt-1">
                <button
                  onClick={() => setCrmOpen(o => !o)}
                  className={cn(
                    'flex items-center justify-between w-full px-3 py-2 rounded-lg text-sm transition-all',
                    crmActive
                      ? 'bg-white/10 text-white font-medium'
                      : 'text-white/50 hover:bg-white/5 hover:text-white/80'
                  )}
                >
                  <div className="flex items-center gap-2.5">
                    <TrendingUp size={15} className={crmActive ? 'text-rose-400' : 'text-white/30'} />
                    <span>CRM</span>
                  </div>
                  {crmOpen
                    ? <ChevronDown size={12} className="text-white/30" />
                    : <ChevronRight size={12} className="text-white/30" />
                  }
                </button>
                {crmOpen && (
                  <div className="ml-4 mt-0.5 space-y-0.5 border-l border-white/10 pl-2">
                    {CRM_ITEMS.map(item => {
                      const Icon = item.icon
                      const active = pathname === item.href || (item.href !== '/crm' && pathname.startsWith(item.href))
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setSidebarOpen(false)}
                          className={cn(
                            'flex items-center gap-2 px-2 py-1.5 rounded-md text-xs transition-all',
                            active
                              ? 'bg-white/10 text-white font-medium'
                              : 'text-white/40 hover:bg-white/5 hover:text-white/70'
                          )}
                        >
                          <Icon size={13} className={active ? 'text-rose-400' : 'text-white/25'} />
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
        <div className="p-3 border-t border-white/5">
          <div className="flex items-center gap-2.5 mb-2 px-3 py-2 rounded-lg bg-white/5">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center flex-shrink-0">
              <span className="text-[11px] font-bold text-white">
                {user?.name?.[0]?.toUpperCase() ?? '?'}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-white/90 truncate">{user?.name}</p>
              <span className={cn(
                'text-[9px] font-semibold px-1.5 py-0.5 rounded-sm uppercase tracking-wider',
                ROLE_COLORS[user?.role ?? ''] ?? 'bg-white/10 text-white/50'
              )}>
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
    <button
      className="lg:hidden p-2 text-stone-500 hover:text-stone-900"
      onClick={() => setSidebarOpen(true)}
    >
      <Menu size={18} />
    </button>
  )
}
