'use client'
// src/app/(auth)/login/page.tsx
// NOTE: Demo credentials block is intentionally visible in dev; hidden in production.
import { useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

export default function LoginPage() {
  const router = useRouter()
  const { login } = useAuth()
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(identifier.trim(), password)
      router.push('/overview')
    } catch (err: any) {
      setError(err.message ?? 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-8 h-8 rounded-lg bg-stone-900 flex items-center justify-center">
            <span className="text-white text-xs font-bold">TM</span>
          </div>
          <div>
            <p className="text-sm font-semibold text-stone-900">Taha Media OS</p>
            <p className="text-xs text-stone-400">Internal platform</p>
          </div>
        </div>

        {/* Card */}
        <div className="bg-white rounded-xl border border-stone-200 p-6 shadow-card">
          <h1 className="text-base font-semibold text-stone-900 mb-1">Sign in</h1>
          <p className="text-xs text-stone-400 mb-5">
            Use your username or phone number
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Username or phone"
              type="text"
              placeholder="admin or 9840000001"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              autoComplete="username"
              required
            />
            <Input
              label="Password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />

            {error && (
              <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2.5">
                <p className="text-xs text-red-600">{error}</p>
              </div>
            )}

            <Button
              type="submit"
              loading={loading}
              className="w-full"
              size="md"
            >
              Sign in
            </Button>
          </form>

          {/* Demo credentials hint — dev only, stripped from production builds */}
          {process.env.NEXT_PUBLIC_SHOW_DEMO_ACCOUNTS === 'true' && (
            <div className="mt-5 pt-4 border-t border-stone-100">
              <p className="text-xs text-stone-400 font-medium mb-2">Demo accounts</p>
              <div className="space-y-1">
                {[
                  ['admin', 'admin123', 'Founder'],
                  ['manager', 'manager123', 'Manager'],
                  ['editor', 'editor123', 'Employee'],
                  ['axsclient', 'client123', 'Client'],
                ].map(([u, p, r]) => (
                  <button
                    key={u}
                    type="button"
                    onClick={() => { setIdentifier(u); setPassword(p) }}
                    className="w-full flex items-center justify-between px-2.5 py-1.5 rounded text-xs hover:bg-stone-50 transition-colors text-left"
                  >
                    <span className="text-stone-600 font-mono">{u}</span>
                    <span className="text-stone-400">{r}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
