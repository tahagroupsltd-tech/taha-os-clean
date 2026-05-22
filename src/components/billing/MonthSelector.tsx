'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { Calendar } from 'lucide-react'

export function MonthSelector() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const currentMonthVal = searchParams.get('month') || ''

  // Generate last 12 months, current month, and next 6 months
  const options: { val: string; label: string }[] = []
  const now = new Date()
  
  // We want to generate from 12 months ago to 6 months ahead
  const start = new Date(now.getFullYear(), now.getMonth() - 12, 1)
  const end = new Date(now.getFullYear(), now.getMonth() + 6, 1)
  
  let iter = new Date(start)
  while (iter <= end) {
    const y = iter.getFullYear()
    const m = iter.getMonth()
    const val = `${y}-${String(m + 1).padStart(2, '0')}`
    const label = iter.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    options.push({ val, label })
    iter.setMonth(iter.getMonth() + 1)
  }

  // Find if default value is in options, else prepend/append
  const activeVal = currentMonthVal || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value
    router.push(`/billing?month=${val}`)
  }

  return (
    <div className="flex items-center gap-2 bg-stone-50 border border-stone-200 rounded-lg px-2.5 py-1.5 text-xs text-stone-600 focus-within:ring-1 focus-within:ring-stone-400">
      <Calendar size={13} className="text-stone-400" />
      <select
        value={activeVal}
        onChange={handleChange}
        className="bg-transparent border-none outline-none font-medium text-stone-700 cursor-pointer pr-1"
      >
        {options.map((opt) => (
          <option key={opt.val} value={opt.val}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  )
}
