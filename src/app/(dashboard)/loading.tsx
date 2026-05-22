// src/app/(dashboard)/loading.tsx
// Shown by Next.js while any dashboard page is streaming / fetching
export default function DashboardLoading() {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* TopBar skeleton */}
      <div className="h-14 border-b border-stone-100 bg-white flex items-center px-5 flex-shrink-0">
        <div className="skeleton-shimmer h-5 w-48 rounded" />
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {/* Stat cards skeleton — 4 columns */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="stat-card space-y-3">
              <div className="skeleton-shimmer h-8 w-8 rounded-md" />
              <div className="skeleton-shimmer h-7 w-16 rounded" />
              <div className="skeleton-shimmer h-3 w-20 rounded" />
              <div className="skeleton-shimmer h-3 w-24 rounded" />
            </div>
          ))}
        </div>

        {/* Finance strip skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="stat-card space-y-2">
              <div className="skeleton-shimmer h-3 w-24 rounded" />
              <div className="skeleton-shimmer h-6 w-28 rounded" />
            </div>
          ))}
        </div>

        {/* Two-column skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="bg-white rounded-lg border border-stone-100">
              <div className="px-4 py-3 border-b border-stone-100">
                <div className="skeleton-shimmer h-3 w-24 rounded" />
              </div>
              <div className="divide-y divide-stone-50">
                {[...Array(4)].map((_, j) => (
                  <div key={j} className="px-4 py-3 flex items-center gap-3">
                    <div className="flex-1 space-y-1.5">
                      <div className="skeleton-shimmer h-3 w-3/4 rounded" />
                      <div className="skeleton-shimmer h-3 w-1/2 rounded" />
                    </div>
                    <div className="skeleton-shimmer h-3 w-12 rounded" />
                  </div>
                ))}
              </div>
            </div>
          ))}
          </div>
      </div>
    </div>
  )
}
