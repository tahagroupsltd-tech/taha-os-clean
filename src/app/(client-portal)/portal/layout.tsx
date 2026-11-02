'use client'
// src/app/(client-portal)/portal/layout.tsx
import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { useAuthStore } from '@/store/auth.store'
import {
  LayoutDashboard,
  FileVideo,
  Calendar,
  Receipt,
  MessageSquare,
  LogOut,
} from 'lucide-react'

const NAV_ITEMS = [
  { href: '/portal/overview', label: 'Overview', icon: LayoutDashboard },
  { href: '/portal/content', label: 'Content', icon: FileVideo },
  { href: '/portal/calendar', label: 'Calendar', icon: Calendar },
  { href: '/portal/invoices', label: 'Invoices', icon: Receipt },
  { href: '/portal/messages', label: 'Messages', icon: MessageSquare },
]

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const { user, clearUser } = useAuthStore()

  useEffect(() => {
    if (!user) {
      router.replace('/client-login')
      return
    }
    if (user.role !== 'CLIENT') {
      router.replace('/client-login')
    }
  }, [user, router])

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    clearUser()
    router.push('/client-login')
  }

  if (!user || user.role !== 'CLIENT') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-stone-50 flex flex-col">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-40 bg-white border-b border-stone-200 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          {/* Logo */}
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center">
              <span className="text-white text-[10px] font-bold">TM</span>
            </div>
            <span className="text-sm font-semibold text-stone-900 hidden sm:block">Client Portal</span>
          </div>

          {/* Nav links */}
          <nav className="flex items-center gap-0.5 overflow-x-auto no-scrollbar">
            {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
              const active = pathname.startsWith(href)
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                    active
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-stone-500 hover:text-stone-800 hover:bg-stone-100'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span className="hidden sm:block">{label}</span>
                </Link>
              )
            })}
          </nav>

          {/* Right: user + logout */}
          <div className="flex items-center gap-3 shrink-0">
            <span className="text-xs text-stone-600 font-medium hidden md:block">
              {user.name}
            </span>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-stone-500 hover:text-red-600 hover:bg-red-50 transition-colors"
              title="Logout"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:block">Logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* Page content */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 py-6">
        {children}
      </main>
    </div>
  )
}
