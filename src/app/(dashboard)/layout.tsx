// src/app/(dashboard)/layout.tsx
import { Sidebar } from '@/components/layout/Sidebar'
import { ChatLauncher } from '@/components/layout/ChatLauncher'
import { ActiveClientsSidebar } from '@/components/layout/ActiveClientsSidebar'

export const dynamic = 'force-dynamic'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-stone-50 relative">
      <Sidebar />
      {/* Main content — offset by sidebar width on lg+ */}
      <div className="flex-1 flex flex-col overflow-hidden lg:ml-56">
        {children}
      </div>
      {/* Right Collapsible Active Clients Sidebar */}
      <ActiveClientsSidebar />
      {/* Floating AI assistant — visible on every dashboard page */}
      <ChatLauncher />
    </div>
  )
}

