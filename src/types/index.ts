// src/types/index.ts

export type Role = 'ADMIN' | 'MANAGER' | 'EMPLOYEE' | 'CLIENT'

export type ProjectStatus = 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'ARCHIVED'

export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'IN_REVIEW' | 'DONE'

export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'

export type ContentType = 'REEL' | 'POSTER' | 'STORY' | 'VIDEO' | 'GRAPHIC'

export type ContentStatus =
  | 'IDEA'
  | 'SCRIPTING'
  | 'SHOOTING'
  | 'EDITING'
  | 'REVIEW'
  | 'POSTED'

export interface AuthUser {
  id: string
  username: string
  name: string
  role: Role
  phone?: string | null
}

export interface User {
  id: string
  username: string
  name: string
  role: Role
  phone?: string | null
  isActive: boolean
  createdAt: string
}

export interface Project {
  id: string
  name: string
  description?: string | null
  status: ProjectStatus
  clientId?: string | null
  client?: { id: string; name: string } | null
  startDate?: string | null
  dueDate?: string | null
  driveFolder?: string | null
  createdAt: string
  _count?: { tasks: number; content: number }
}

export interface Task {
  id: string
  title: string
  description?: string | null
  status: TaskStatus
  priority: TaskPriority
  deadline?: string | null
  assignedToId?: string | null
  assignedTo?: { id: string; name: string } | null
  createdById: string
  createdBy?: { id: string; name: string }
  projectId?: string | null
  project?: { id: string; name: string } | null
  createdAt: string
  updatedAt: string
}

export interface Content {
  id: string
  title: string
  type: ContentType
  status: ContentStatus
  description?: string | null
  driveLink?: string | null
  caption?: string | null
  postDate?: string | null
  assigneeId?: string | null
  assignee?: { id: string; name: string } | null
  createdById: string
  projectId?: string | null
  project?: { id: string; name: string } | null
  createdAt: string
  updatedAt: string
}

export type EventType = 'MEETING' | 'SHOOT' | 'DEADLINE' | 'REVIEW' | 'CALL' | 'OTHER'

export type TransactionType = 'INCOME' | 'EXPENSE'

export type TransactionCategory =
  | 'CLIENT_PAYMENT'
  | 'SALARY'
  | 'EQUIPMENT'
  | 'SOFTWARE'
  | 'MARKETING'
  | 'TRAVEL'
  | 'RENT'
  | 'UTILITIES'
  | 'OTHER'

export interface Event {
  id: string
  title: string
  description?: string | null
  type: EventType
  startTime: string
  endTime: string
  location?: string | null
  meetingLink?: string | null
  ownerId: string
  owner?: { id: string; name: string }
  projectId?: string | null
  project?: { id: string; name: string } | null
  createdAt: string
  updatedAt: string
}

export interface Note {
  id: string
  title: string
  content: string
  icon?: string | null
  pinned: boolean
  tags: string[]
  ownerId: string
  owner?: { id: string; name: string }
  projectId?: string | null
  project?: { id: string; name: string } | null
  createdAt: string
  updatedAt: string
}

export interface Transaction {
  id: string
  title: string
  amount: string | number
  type: TransactionType
  category: TransactionCategory
  notes?: string | null
  date: string
  ownerId: string
  owner?: { id: string; name: string }
  projectId?: string | null
  project?: { id: string; name: string } | null
  createdAt: string
  updatedAt: string
}

export interface ApiResponse<T = unknown> {
  data?: T
  error?: string
  message?: string
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  pageSize: number
}
