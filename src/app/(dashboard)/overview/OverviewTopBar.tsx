'use client'
import { useState, useEffect } from 'react'
import { TopBar } from '@/components/layout/TopBar'

function getGreeting(name: string) {
  const h = new Date().getHours()
  const part = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
  return `${part}, ${name.split(' ')[0]}`
}

export function OverviewTopBar({ name }: { name: string }) {
  // Start with a neutral title to avoid server/client hydration mismatch
  const [title, setTitle] = useState(`Hello, ${name.split(' ')[0]}`)

  useEffect(() => {
    // Set the time-of-day greeting after the component mounts (client only)
    setTitle(getGreeting(name))
  }, [name])

  return <TopBar title={title} />
}
