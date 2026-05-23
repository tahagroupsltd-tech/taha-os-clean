'use client'
// src/app/error.tsx
import { useEffect } from 'react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log to console in development; swap for a real error-tracking service (e.g. Sentry) in prod
    console.error('[GlobalError]', error)
  }, [error])

  return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center px-4">
      <div className="text-center max-w-sm">
        {/* Logo mark */}
        <div className="w-12 h-12 rounded-xl bg-stone-900 flex items-center justify-center mx-auto mb-6">
          <span className="text-white font-bold text-lg tracking-tight">T</span>
        </div>

        <p className="text-[11px] font-semibold text-red-400 uppercase tracking-widest mb-2">
          Something went wrong
        </p>
        <h1 className="text-xl font-semibold text-stone-900 mb-2">
          Unexpected error
        </h1>
        <div className="text-left bg-red-50 border border-red-200 rounded-lg p-3.5 mb-6 max-h-60 overflow-y-auto">
          <p className="text-xs font-bold text-red-800 font-mono">
            {error?.name || 'Error'}: {error?.message || 'Unknown error'}
          </p>
          {error?.stack && (
            <pre className="text-[10px] text-red-700 font-mono mt-2 whitespace-pre-wrap leading-tight">
              {error.stack}
            </pre>
          )}
        </div>
        {error?.digest && (
          <p className="text-[11px] text-stone-400 font-mono mb-6">
            ID: {error.digest}
          </p>
        )}

        <div className="flex items-center gap-3 justify-center">
          <button
            onClick={reset}
            className="inline-flex items-center gap-2 bg-stone-900 text-white text-sm font-medium
                       px-5 py-2.5 rounded-lg hover:bg-stone-800 transition-colors"
          >
            Try again
          </button>
          <a
            href=