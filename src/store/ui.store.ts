// src/store/ui.store.ts
import { create } from 'zustand'

interface UIState {
  sidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void
  toggleSidebar: () => void
  activeClientsOpen: boolean
  setActiveClientsOpen: (open: boolean) => void
  toggleActiveClients: () => void
}

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: true,
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  activeClientsOpen: false,
  setActiveClientsOpen: (open) => set({ activeClientsOpen: open }),
  toggleActiveClients: () => set((s) => ({ activeClientsOpen: !s.activeClientsOpen })),
}))
