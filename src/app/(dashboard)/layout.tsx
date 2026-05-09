// src/app/(dashboard)/layout.tsx
import { Sidebar } from '@/components/layout/Sidebar'
import { ChatLauncher } from '@/components/layout/ChatLauncher'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-stone-50">
      <Sidebar />
      {/* Main content — offset by sidebar width on lg+ */}
      <div className="flex-1 flex flex-col overflow-hidden lg:ml-56">
        {children}
      </div>
      {/* Floating AI assistant — visible on every dashboard page */}
      <ChatLauncher />
    </div>
  )
}
