'use client'
// src/app/(client-portal)/portal/content/page.tsx
import { useEffect, useState } from 'react'
import { contentStatusColor, CONTENT_STATUS_LABELS, formatDate } from '@/lib/utils'
import type { Content, ContentType, ContentStatus } from '@/types'
import { ChevronDown, ChevronUp } from 'lucide-react'

const TYPE_FILTERS: Array<ContentType | 'ALL'> = ['ALL', 'REEL', 'POSTER', 'STORY', 'VIDEO', 'GRAPHIC']

const STATUS_PIPELINE: ContentStatus[] = ['SCRIPTING', 'SHOOTING', 'EDITING', 'REVIEW']

function ContentCard({ item }: { item: Content }) {
  return (
    <div className="bg-white border border-stone-200 rounded-xl p-4 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-stone-900 leading-tight">{item.title}</p>
        <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${contentStatusColor(item.status)}`}>
          {CONTENT_STATUS_LABELS[item.status]}
        </span>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs px-2 py-0.5 rounded-full bg-stone-100 text-stone-600 font-medium">
          {item.type}
        </span>
        {item.project?.name && (
          <span className="text-xs text-stone-400">{item.project.name}</span>
        )}
      </div>
      {item.postDate && (
        <p className="text-xs text-stone-400">Due: {formatDate(item.postDate)}</p>
      )}
    </div>
  )
}

function SkeletonCard() {
  return (
    <div className="bg-white border border-stone-200 rounded-xl p-4 animate-pulse space-y-2">
      <div className="h-4 w-3/4 bg-stone-100 rounded" />
      <div className="h-3 w-1/3 bg-stone-100 rounded" />
    </div>
  )
}

export default function PortalContentPage() {
  const [content, setContent] = useState<Content[]>([])
  const [loading, setLoading] = useState(true)
  const [typeFilter, setTypeFilter] = useState<ContentType | 'ALL'>('ALL')
  const [postedExpanded, setPostedExpanded] = useState(false)

  useEffect(() => {
    fetch('/api/content')
      .then((r) => r.json())
      .then((d) => setContent(d.data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const filtered = typeFilter === 'ALL'
    ? content
    : content.filter((c) => c.type === typeFilter)

  const active = filtered.filter((c) => c.status !== 'POSTED')
  const posted = filtered.filter((c) => c.status === 'POSTED')

  const byStatus = STATUS_PIPELINE.reduce<Record<ContentStatus, Content[]>>((acc, s) => {
    acc[s] = active.filter((c) => c.status === s)
    return acc
  }, {} as Record<ContentStatus, Content[]>)

  // Also include IDEA items in Scripting column
  const ideaItems = active.filter((c) => c.status === 'IDEA')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-stone-900">Your Content</h1>
        <p className="text-sm text-stone-400 mt-0.5">Track all your content pieces across projects</p>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-2 flex-wrap">
        {TYPE_FILTERS.map((t) => (
          <button
            key={t}
            onClick={() => setTypeFilter(t as ContentType | 'ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              typeFilter === t
                ? 'bg-blue-600 text-white'
                : 'bg-white border border-stone-200 text-stone-600 hover:bg-stone-50'
            }`}
          >
            {t === 'ALL' ? 'All Types' : t}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : active.length === 0 && posted.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-stone-400 text-sm">No content found</p>
        </div>
      ) : (
        <>
          {/* Pipeline columns */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {STATUS_PIPELINE.map((status) => {
              const items = status === 'SCRIPTING'
                ? [...ideaItems, ...byStatus[status]]
                : byStatus[status]
              return (
                <div key={status} className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${contentStatusColor(status)}`}>
                      {CONTENT_STATUS_LABELS[status]}
                    </span>
                    <span className="text-xs text-stone-400 font-medium">{items.length}</span>
                  </div>
                  <div className="space-y-2">
                    {items.length === 0 ? (
                      <div className="border-2 border-dashed border-stone-200 rounded-xl p-4 text-center">
                        <p className="text-xs text-stone-300">Empty</p>
                      </div>
                    ) : (
                      items.map((item) => <ContentCard key={item.id} item={item} />)
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Posted section */}
          {posted.length > 0 && (
            <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
              <button
                className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-stone-50 transition-colors"
                onClick={() => setPostedExpanded((v) => !v)}
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-stone-900">Posted</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-700 font-medium">{posted.length}</span>
                </div>
                {postedExpanded ? <ChevronUp className="w-4 h-4 text-stone-400" /> : <ChevronDown className="w-4 h-4 text-stone-400" />}
              </button>
              {postedExpanded && (
                <div className="border-t border-stone-100 p-4 grid sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {posted.map((item) => <ContentCard key={item.id} item={item} />)}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
