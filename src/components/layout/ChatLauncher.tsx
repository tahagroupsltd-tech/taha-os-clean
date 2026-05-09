'use client'
// src/components/layout/ChatLauncher.tsx
// Floating trigger button that opens the right-side AI chat panel.
import { useState } from 'react'
import { Sparkles, X } from 'lucide-react'
import { ChatPanel } from '@/components/chat/ChatPanel'

export function ChatLauncher() {
  const [open, setOpen] = useState(false)
  return (
    <>
      {/* Trigger button — always visible, toggles the panel */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-5 right-5 z-40 h-11 px-4 rounded-full bg-stone-900 text-white shadow-lg hover:bg-stone-700 transition-all hover:scale-105 active:scale-95 flex items-center gap-2"
        aria-label={open ? 'Close assistant' : 'Open assistant'}
      >
        {open ? <X size={14} /> : <Sparkles size={14} />}
        <span className="text-xs font-medium">{open ? 'Close' : 'Ask AI'}</span>
      </button>

      <ChatPanel open={open} onClose={() => setOpen(false)} />
    </>
  )
}
