'use client'
// src/app/(client-portal)/client-login/page.tsx
import { useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/hooks/useAuth'

export default function ClientLoginPage() {
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
      const userData = await login(identifier.trim(), password)
      if (userData.role !== 'CLIENT') {
        setError('This portal is for clients only. Staff please use the main login.')
        // Clear the auth store entry since we don't want staff stored here
        return
      }
      router.push('/portal/overview')
    } catch (err: any) {
      setError(err.message ?? 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center shadow-sm">
            <span className="text-white text-xs font-bold tracking-tight">TM</span>
          </div>
          <div>
            <p className="text-sm font-semibold text-stone-900">Taha Media — Client Portal</p>
            <p className="text-xs text-stone-400">Access your project dashboard</p>
          </div>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl border border-stone-200 p-7 shadow-sm">
          <h1 className="text-lg font-semibold text-stone-900 mb-1">Welcome back</h1>
          <p className="text-sm text-stone-400 mb-6">Sign in to view your projects and content</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-stone-700 mb-1.5">
                Username or phone
              </label>
              <input
                type="text"
                placeholder="Your username or phone"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                autoComplete="username"
                required
                className="w-full px-3 py-2.5 text-sm bg-stone-50 border border-stone-200 rounded-lg text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-700 mb-1.5">
                Password
              </label>
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
                className="w-full px-3 py-2.5 text-sm bg-stone-50 border border-stone-200 rounded-lg text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              />
            </div>

            {error && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2.5">
                <p className="text-xs text-red-600">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>

        {/* Footer link */}
        <p className="text-center text-xs text-stone-400 mt-5">
          Are you a team member?{' '}
          <Link href="/login" className="text-blue-600 hover:underline">
            Staff login →
          </Link>
        </p>
      </div>
    </div>
  )
}
