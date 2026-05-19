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
    <header className="h-14 bg-white border-b border-stone-100 flex items-center px-4 gap-3 flex-shrink-0 shadow-sm">
      <SidebarToggle />
      <div className="flex-1">
        <h1 className="text-sm font-bold text-stone-900 tracking-tight">{title}</h1>
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
      <NotificationBell />
    </header>
  )
}
