'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil, Check, X, Loader2 } from 'lucide-react'
import { formatMoney } from '@/lib/utils'
import toast from 'react-hot-toast'

interface ProjectValueInputProps {
  projectId: string
  initialValue: number | null
}

export function ProjectValueInput({ projectId, initialValue }: ProjectValueInputProps) {
  const router = useRouter()
  const [isEditing, setIsEditing] = useState(false)
  const [value, setValue] = useState(initialValue !== null ? String(initialValue) : '')
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isEditing])

  const handleSave = async () => {
    const parsedValue = value.trim() === '' ? null : parseFloat(value)
    if (parsedValue !== null && isNaN(parsedValue)) {
      return toast.error('Please enter a valid number')
    }

    setLoading(true)
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ value: parsedValue }),
      })

      const json = await res.ok ? await res.json() : null
      if (!res.ok) {
        throw new Error(json?.error ?? 'Failed to update project value')
      }

      toast.success('Project value updated')
      setIsEditing(false)
      router.refresh()
    } catch (error: any) {
      toast.error(error.message ?? 'Failed to save')
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSave()
    } else if (e.key === 'Escape') {
      setValue(initialValue !== null ? String(initialValue) : '')
      setIsEditing(false)
    }
  }

  if (isEditing) {
    return (
      <div className="flex items-center gap-1.5 justify-end">
        <input
          ref={inputRef}
          type="number"
          min="0"
          step="0.01"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={loading}
          className="w-24 px-2 py-1 text-right text-xs bg-white border border-stone-200 rounded-md focus:outline-none focus:ring-1 focus:ring-stone-400 focus:border-stone-400 disabled:bg-stone-50 disabled:text-stone-400"
          placeholder="0.00"
        />
        <button
          onClick={handleSave}
          disabled={loading}
          className="p-1 text-green-600 hover:bg-green-50 rounded-md transition-colors disabled:opacity-50"
          title="Save"
        >
          {loading ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
        </button>
        <button
          onClick={() => {
            setValue(initialValue !== null ? String(initialValue) : '')
            setIsEditing(false)
          }}
          disabled={loading}
          className="p-1 text-red-500 hover:bg-red-50 rounded-md transition-colors disabled:opacity-50"
          title="Cancel"
        >
          <X size={12} />
        </button>
      </div>
    )
  }

  if (initialValue === null || initialValue <= 0) {
    return (
      <div className="flex justify-end">
        <button
          onClick={() => setIsEditing(true)}
          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-stone-500 hover:text-stone-850 bg-stone-50 hover:bg-stone-100 border border-stone-200 border-dashed rounded-md transition-colors"
          title="Add contract value"
        >
          <Pencil size={11} className="text-stone-400" />
          Add Amount
        </button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-1.5 justify-end">
      <span className="font-semibold text-stone-900">
        {formatMoney(initialValue)}
      </span>
      <button
        onClick={() => setIsEditing(true)}
        className="p-1 text-stone-400 hover:text-stone-700 hover:bg-stone-50 rounded-md transition-colors"
        title="Edit contract value"
      >
        <Pencil size={11} />
      </button>
    </div>
  )
}

