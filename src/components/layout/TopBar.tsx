// src/components/layout/TopBar.tsx
'use client'
import { SidebarToggle } from './Sidebar'
import { NotificationBell } from './NotificationBell'

interface TopBarProps {
  title: string
  actions?: React.ReactNode
}

export function TopBar({ title, actions }: TopBarProps) {
  return (
    <header className="min-h-[3.5rem] py-2.5 md:py-0 md:h-14 bg-white border-b border-stone-100 flex flex-col md:flex-row md:items-center justify-center md:justify-between px-4 gap-2 md:gap-3 flex-shrink-0 shadow-sm">
      <div className="flex items-center justify-between w-full md:w-auto">
        <div className="flex items-center gap-3">
          <SidebarToggle />
          <h1 className="text-sm font-bold text-stone-900 tracking-tight">{title}</h1>
        </div>
        <div className="flex items-center gap-2 md:hidden">
          {actions && <div className="flex items-center gap-2">{actions}</div>}
          <NotificationBell />
        </div>
      </div>
      <div className="hidden md:flex items-center gap-2">
        {actions && <div className="flex items-center gap-2">{actions}</div>}
        <NotificationBell />
      </div>
    </header>
  )
}
