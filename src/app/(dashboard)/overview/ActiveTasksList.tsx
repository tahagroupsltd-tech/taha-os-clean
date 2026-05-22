'use client'

import { useState, useEffect } from 'react'
import { AlertCircle } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import {
  taskStatusColor, taskPriorityColor, formatDate, cn, getTaskUrgencyColors, TASK_STATUS_LABELS
} from '@/lib/utils'
import type { Task, TaskStatus } from '@/types'

export function ActiveTasksList({ recentTasks }: { recentTasks: Task[] }) {
  const [now, setNow] = useState<Date>(() => new Date())

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(new Date())
    }, 30000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="divide-y divide-stone-50">
      {recentTasks.length === 0 && (
        <p className="px-4 py-6 text-xs text-stone-400 text-center">No active tasks</p>
      )}
      {recentTasks.map((task: any) => {
        const colors = getTaskUrgencyColors(task.deadline, task.status as TaskStatus, now)
        return (
          <div key={task.id} className="px-4 py-3 flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-1">
                <p className="text-xs font-medium text-stone-900 truncate">{task.title}</p>
                {task.deadline && colors.isOverdue && (
                  <AlertCircle size={11} className="text-red-400 flex-shrink-0 animate-pulse" />
                )}
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <Badge className={taskStatusColor(task.status as TaskStatus)}>
                  {TASK_STATUS_LABELS[task.status as TaskStatus]}
                </Badge>
                <Badge className={taskPriorityColor(task.priority)}>{task.priority}</Badge>
                {task.project && (
                  <span className="text-[10px] text-stone-400">{task.project.name}</span>
                )}
              </div>
            </div>
            <div className="text-right flex-shrink-0">
              {task.assignedTo && (
                <p className="text-[10px] text-stone-400">{task.assignedTo.name}</p>
              )}
              {task.deadline ? (
                <span className={cn("inline-block text-[10px] font-medium px-2 py-0.5 rounded-full border mt-0.5", colors.badgeClasses)}>
                  {formatDate(task.deadline)}
                  {colors.timeLeftStr && ` (${colors.timeLeftStr})`}
                </span>
              ) : (
                <span className="text-stone-400">—</span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
