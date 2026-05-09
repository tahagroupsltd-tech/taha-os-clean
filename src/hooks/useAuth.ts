// src/hooks/useAuth.ts
'use client'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/auth.store'
import toast from 'react-hot-toast'

export function useAuth() {
  const router = useRouter()
  const { user, setUser, clearUser } = useAuthStore()

  const login = async (identifier: string, password: string) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier, password }),
    })

    const json = await res.json()

    if (!res.ok) {
      throw new Error(json.error ?? 'Login failed')
    }

    setUser(json.data)
    return json.data
  }

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    clearUser()
    router.push('/login')
    toast.success('Logged out')
  }

  return { user, login, logout }
}
