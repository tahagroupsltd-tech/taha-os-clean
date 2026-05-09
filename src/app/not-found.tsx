// src/app/not-found.tsx
import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center px-4">
      <div className="text-center max-w-sm">
        {/* Logo mark */}
        <div className="w-12 h-12 rounded-xl bg-stone-900 flex items-center justify-center mx-auto mb-6">
          <span className="text-white font-bold text-lg tracking-tight">T</span>
        </div>

        <p className="text-[11px] font-semibold text-stone-400 uppercase tracking-widest mb-2">
          404
        </p>
        <h1 className="text-xl font-semibold text-stone-900 mb-2">
          Page not found
        </h1>
        <p className="text-sm text-stone-500 mb-8 leading-relaxed">
          This page doesn&apos;t exist or you don&apos;t have permission to view it.
        </p>

        <Link
          href="/overview"
          className="inline-flex items-center gap-2 bg-stone-900 text-white text-sm font-medium
                     px-5 py-2.5 rounded-lg hover:bg-stone-800 transition-colors"
        >
          ← Back to overview
        </Link>
      </div>
    </div>
  )
}
