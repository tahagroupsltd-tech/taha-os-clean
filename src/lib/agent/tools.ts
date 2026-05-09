// src/lib/agent/tools.ts
// Tool definitions exposed to the LLM. Each tool runs server-side and
// uses the logged-in user's role for permission gating.

import { db } from '@/lib/db'
import { notify } from '@/lib/notify'
import type { AuthUser } from '@/types'
import {
  canCreateTasks,
  canCreateContent,
  canManageProjects,
  canCreateUsers,
  canAssignRole,
} from '@/lib/permissions'
import bcrypt from 'bcryptjs'
import type { Role } from '@prisma/client'

// ── Tool schema as sent to OpenAI ───────────────────────────
export const TOOL_DEFS = [
  {
    type: 'function',
    function: {
      name: 'list_users',
      description:
        'List users in the system, optionally filtered by role. Use this to find a user id when the human refers to someone by name or username.',
      parameters: {
        type: 'object',
        properties: {
          role: {
            type: 'string',
            enum: ['ADMIN', 'MANAGER', 'EMPLOYEE', 'CLIENT'],
            description: 'Optional role filter',
          },
          query: {
            type: 'string',
            description: 'Optional search by name or username (case-insensitive contains)',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_projects',
      description: 'List all projects with their client. Use this to resolve a project id when the human refers to a project by name.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Optional name search' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_event',
      description:
        'Create a calendar event. Use ISO 8601 dates (YYYY-MM-DDTHH:mm:ss). type values: MEETING, SHOOT, DEADLINE, REVIEW, CALL, OTHER.',
      parameters: {
        type: 'object',
        required: ['title', 'startTime', 'endTime'],
        properties: {
          title: { type: 'string' },
          description: { type: 'string' },
          type: { type: 'string', enum: ['MEETING', 'SHOOT', 'DEADLINE', 'REVIEW', 'CALL', 'OTHER'] },
          startTime: { type: 'string', description: 'ISO 8601 datetime' },
          endTime: { type: 'string', description: 'ISO 8601 datetime' },
          location: { type: 'string' },
          meetingLink: { type: 'string' },
          ownerId: { type: 'string', description: 'User id of the event owner. Defaults to current user.' },
          projectId: { type: 'string', description: 'Optional project id' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_task',
      description: 'Create a task and (optionally) assign it. Triggers a notification to the assignee.',
      parameters: {
        type: 'object',
        required: ['title'],
        properties: {
          title: { type: 'string' },
          description: { type: 'string' },
          status: { type: 'string', enum: ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE'] },
          priority: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] },
          deadline: { type: 'string', description: 'ISO date YYYY-MM-DD' },
          assignedToId: { type: 'string' },
          projectId: { type: 'string' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_content',
      description: 'Create a content item (reel/poster/etc).',
      parameters: {
        type: 'object',
        required: ['title', 'type'],
        properties: {
          title: { type: 'string' },
          type: { type: 'string', enum: ['REEL', 'POSTER', 'STORY', 'VIDEO', 'GRAPHIC'] },
          status: { type: 'string', enum: ['IDEA', 'SCRIPTING', 'SHOOTING', 'EDITING', 'REVIEW', 'POSTED'] },
          description: { type: 'string' },
          driveLink: { type: 'string' },
          caption: { type: 'string' },
          postDate: { type: 'string', description: 'ISO date YYYY-MM-DD' },
          assigneeId: { type: 'string' },
          projectId: { type: 'string' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_project',
      description: 'Create a new project. Founder/manager only.',
      parameters: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string' },
          description: { type: 'string' },
          status: { type: 'string', enum: ['ACTIVE', 'PAUSED', 'COMPLETED', 'ARCHIVED'] },
          clientId: { type: 'string', description: 'User id of the client (must have role=CLIENT)' },
          startDate: { type: 'string' },
          dueDate: { type: 'string' },
          driveFolder: { type: 'string', description: 'Google Drive folder URL' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_user',
      description:
        'Create a new user account. Founder or manager only. Manager cannot create ADMIN. Returns the new user id.',
      parameters: {
        type: 'object',
        required: ['username', 'name', 'password', 'role'],
        properties: {
          username: { type: 'string' },
          name: { type: 'string' },
          phone: { type: 'string' },
          password: { type: 'string', description: 'Initial password (min 6 chars)' },
          role: { type: 'string', enum: ['ADMIN', 'MANAGER', 'EMPLOYEE', 'CLIENT'] },
        },
      },
    },
  },
] as const

// ── Tool handlers ───────────────────────────────────────────
export type ToolResult =
  | { ok: true; data: any }
  | { ok: false; error: string }

export async function runTool(
  name: string,
  args: any,
  user: AuthUser
): Promise<ToolResult> {
  try {
    switch (name) {
      // ── Lookups ─────────────────────────────────
      case 'list_users': {
        const where: any = { isActive: true }
        if (args.role) where.role = args.role
        if (args.query) {
          where.OR = [
            { name: { contains: args.query, mode: 'insensitive' } },
            { username: { contains: args.query, mode: 'insensitive' } },
          ]
        }
        const users = await db.user.findMany({
          where,
          select: { id: true, username: true, name: true, role: true },
          take: 25,
          orderBy: { name: 'asc' },
        })
        return { ok: true, data: users }
      }

      case 'list_projects': {
        const where: any = {}
        if (args.query) where.name = { contains: args.query, mode: 'insensitive' }
        if (user.role === 'CLIENT') where.clientId = user.id
        const projects = await db.project.findMany({
          where,
          select: {
            id: true,
            name: true,
            status: true,
            client: { select: { id: true, name: true } },
            dueDate: true,
          },
          take: 25,
          orderBy: { createdAt: 'desc' },
        })
        return { ok: true, data: projects }
      }

      // ── Create event ────────────────────────────
      case 'create_event': {
        if (user.role === 'CLIENT')
          return { ok: false, error: 'Clients cannot create events' }
        const start = new Date(args.startTime)
        const end = new Date(args.endTime)
        if (isNaN(start.getTime()) || isNaN(end.getTime()))
          return { ok: false, error: 'Invalid startTime or endTime' }
        const event = await db.event.create({
          data: {
            title: args.title,
            description: args.description ?? null,
            type: args.type ?? 'MEETING',
            startTime: start,
            endTime: end,
            location: args.location ?? null,
            meetingLink: args.meetingLink ?? null,
            ownerId: args.ownerId || user.id,
            projectId: args.projectId || null,
          },
          select: { id: true, title: true, startTime: true, endTime: true },
        })
        return { ok: true, data: event }
      }

      // ── Create task ─────────────────────────────
      case 'create_task': {
        if (!canCreateTasks(user.role))
          return { ok: false, error: 'You do not have permission to create tasks' }
        const task = await db.task.create({
          data: {
            title: args.title,
            description: args.description ?? null,
            status: args.status ?? 'TODO',
            priority: args.priority ?? 'MEDIUM',
            deadline: args.deadline ? new Date(args.deadline) : null,
            assignedToId: args.assignedToId || null,
            createdById: user.id,
            projectId: args.projectId || null,
          },
          include: {
            assignedTo: { select: { id: true, name: true } },
            project: { select: { id: true, name: true } },
          },
        })
        if (task.assignedToId && task.assignedToId !== user.id) {
          const projectLabel = task.project ? ` · ${task.project.name}` : ''
          await notify({
            userId: task.assignedToId,
            type: 'TASK_ASSIGNED',
            title: `New task: ${task.title}`,
            message: `${user.name} assigned you a ${task.priority.toLowerCase()} task${projectLabel}.`,
            link: '/tasks',
          })
        }
        return { ok: true, data: { id: task.id, title: task.title, assignee: task.assignedTo?.name ?? null } }
      }

      // ── Create content ──────────────────────────
      case 'create_content': {
        if (!canCreateContent(user.role))
          return { ok: false, error: 'You do not have permission to create content' }
        const item = await db.content.create({
          data: {
            title: args.title,
            type: args.type,
            status: args.status ?? 'IDEA',
            description: args.description ?? null,
            driveLink: args.driveLink ?? null,
            caption: args.caption ?? null,
            postDate: args.postDate ? new Date(args.postDate) : null,
            assigneeId: args.assigneeId || null,
            createdById: user.id,
            projectId: args.projectId || null,
          },
          include: {
            assignee: { select: { id: true, name: true } },
            project: { select: { id: true, name: true, clientId: true } },
          },
        })
        if (item.assigneeId && item.assigneeId !== user.id) {
          const projectLabel = item.project ? ` · ${item.project.name}` : ''
          await notify({
            userId: item.assigneeId,
            type: 'CONTENT_ASSIGNED',
            title: `New content assigned: ${item.title}`,
            message: `${user.name} assigned you a ${item.type.toLowerCase()}${projectLabel}.`,
            link: '/content',
          })
        }
        if (item.postDate && item.project?.clientId && item.project.clientId !== user.id) {
          await notify({
            userId: item.project.clientId,
            type: 'CONTENT_SCHEDULED',
            title: `New content scheduled: ${item.title}`,
            message: `Scheduled for ${new Date(item.postDate).toLocaleDateString('en-IN')} on ${item.project.name}.`,
            link: '/content',
          })
        }
        return { ok: true, data: { id: item.id, title: item.title } }
      }

      // ── Create project ──────────────────────────
      case 'create_project': {
        if (!canManageProjects(user.role))
          return { ok: false, error: 'You do not have permission to create projects' }
        const project = await db.project.create({
          data: {
            name: args.name,
            description: args.description ?? null,
            status: args.status ?? 'ACTIVE',
            clientId: args.clientId || null,
            startDate: args.startDate ? new Date(args.startDate) : null,
            dueDate: args.dueDate ? new Date(args.dueDate) : null,
            driveFolder: args.driveFolder ?? null,
          },
          include: { client: { select: { id: true, name: true } } },
        })
        if (project.clientId && project.clientId !== user.id) {
          await notify({
            userId: project.clientId,
            type: 'PROJECT_ASSIGNED',
            title: `New project: ${project.name}`,
            message: `${user.name} created a new project for you.`,
            link: '/clients',
          })
        }
        return { ok: true, data: { id: project.id, name: project.name } }
      }

      // ── Create user ─────────────────────────────
      case 'create_user': {
        if (!canCreateUsers(user.role))
          return { ok: false, error: 'You do not have permission to create users' }
        if (!canAssignRole(user.role, args.role as Role))
          return { ok: false, error: `You cannot assign role ${args.role}` }
        if (!args.password || args.password.length < 6)
          return { ok: false, error: 'Password must be at least 6 characters' }
        const existing = await db.user.findFirst({
          where: { username: args.username.toLowerCase() },
          select: { id: true },
        })
        if (existing) return { ok: false, error: 'Username already exists' }
        const hashed = await bcrypt.hash(args.password, 10)
        const created = await db.user.create({
          data: {
            username: args.username.toLowerCase().trim(),
            name: args.name.trim(),
            phone: args.phone?.trim() || null,
            password: hashed,
            role: args.role as Role,
          },
          select: { id: true, username: true, name: true, role: true },
        })
        return { ok: true, data: created }
      }

      default:
        return { ok: false, error: `Unknown tool: ${name}` }
    }
  } catch (err: any) {
    console.error(`[tool ${name}] failed:`, err)
    return { ok: false, error: err?.message ?? 'Tool execution failed' }
  }
}
