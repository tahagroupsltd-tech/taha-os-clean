// src/lib/agent/tools.ts
// Tool definitions exposed to the LLM. Each tool runs server-side and
// uses the logged-in user's role for permission gating.

import { sbSelect, sbInsert, sbUpdate, sbFindOne, nowTs } from '@/lib/supa'
import { notify } from '@/lib/notify'
import { syncOsEventToGcal } from '@/lib/gcal'
import type { AuthUser } from '@/types'
import {
  canCreateTasks,
  canCreateContent,
  canManageProjects,
  canCreateUsers,
  canAssignRole,
} from '@/lib/permissions'
import bcrypt from 'bcryptjs'

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
  // ── CRM tools ─────────────────────────────────────────────
  {
    type: 'function',
    function: {
      name: 'list_leads',
      description: 'List CRM leads, optionally filtered by stage. Use to find a lead id by title.',
      parameters: {
        type: 'object',
        properties: {
          stage: { type: 'string', enum: ['NEW', 'CONTACTED', 'QUALIFIED', 'PROPOSAL', 'NEGOTIATION', 'WON', 'LOST'], description: 'Optional stage filter' },
          query: { type: 'string', description: 'Optional title search' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_lead',
      description: 'Create a new CRM lead. Optionally attach a contact, company, and assignee.',
      parameters: {
        type: 'object',
        required: ['title'],
        properties: {
          title: { type: 'string' },
          stage: { type: 'string', enum: ['NEW', 'CONTACTED', 'QUALIFIED', 'PROPOSAL', 'NEGOTIATION', 'WON', 'LOST'] },
          source: { type: 'string', enum: ['REFERRAL', 'WEBSITE', 'SOCIAL_MEDIA', 'EMAIL', 'COLD_CALL', 'EVENT', 'OTHER'] },
          value: { type: 'number', description: 'Estimated value in currency units' },
          notes: { type: 'string' },
          contactId: { type: 'string', description: 'CRM contact id (resolve first via list_contacts)' },
          companyId: { type: 'string', description: 'CRM company id (resolve first via list_companies)' },
          assignedToId: { type: 'string', description: 'User id to assign to (resolve via list_users)' },
          projectId: { type: 'string', description: 'Project id if linked' },
          expectedCloseDate: { type: 'string', description: 'ISO date YYYY-MM-DD' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_lead_stage',
      description: 'Move a CRM lead to a new stage (e.g. from NEW to QUALIFIED).',
      parameters: {
        type: 'object',
        required: ['leadId', 'stage'],
        properties: {
          leadId: { type: 'string' },
          stage: { type: 'string', enum: ['NEW', 'CONTACTED', 'QUALIFIED', 'PROPOSAL', 'NEGOTIATION', 'WON', 'LOST'] },
          notes: { type: 'string', description: 'Optional notes to append on the lead' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_contacts',
      description: 'List CRM contacts. Use to find a contact id by name or email.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Optional search by name or email' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_contact',
      description: 'Create a new CRM contact person.',
      parameters: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string' },
          email: { type: 'string' },
          phone: { type: 'string' },
          position: { type: 'string', description: 'Job title / position' },
          companyId: { type: 'string', description: 'CRM company id (resolve via list_companies)' },
          notes: { type: 'string' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_companies',
      description: 'List CRM companies. Use to find a company id by name.',
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
      name: 'create_company',
      description: 'Create a new CRM company.',
      parameters: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string' },
          industry: { type: 'string' },
          website: { type: 'string' },
          address: { type: 'string' },
          notes: { type: 'string' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_deals',
      description: 'List CRM deals, optionally filtered by stage.',
      parameters: {
        type: 'object',
        properties: {
          stage: { type: 'string', enum: ['PROPOSAL', 'NEGOTIATION', 'CONTRACT', 'CLOSED_WON', 'CLOSED_LOST'], description: 'Optional stage filter' },
          query: { type: 'string', description: 'Optional title search' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_deal',
      description: 'Create a new CRM deal.',
      parameters: {
        type: 'object',
        required: ['title'],
        properties: {
          title: { type: 'string' },
          value: { type: 'number', description: 'Deal value in currency units' },
          stage: { type: 'string', enum: ['PROPOSAL', 'NEGOTIATION', 'CONTRACT', 'CLOSED_WON', 'CLOSED_LOST'] },
          probability: { type: 'number', description: 'Win probability 0-100' },
          closeDate: { type: 'string', description: 'Expected close date YYYY-MM-DD' },
          leadId: { type: 'string', description: 'Linked lead id' },
          contactId: { type: 'string', description: 'CRM contact id' },
          companyId: { type: 'string', description: 'CRM company id' },
          assignedToId: { type: 'string', description: 'User id to assign to' },
          projectId: { type: 'string', description: 'Linked project id' },
          notes: { type: 'string' },
        },
      },
    },
  },
  // ── Read / update tools ───────────────────────────────────
  {
    type: 'function',
    function: {
      name: 'list_tasks',
      description: 'List tasks, optionally filtered by status, priority, or assignee. Use this to find a task id by title, or to show the user their tasks.',
      parameters: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE'], description: 'Optional status filter' },
          priority: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'], description: 'Optional priority filter' },
          assignedToId: { type: 'string', description: 'Filter by assignee user id' },
          projectId: { type: 'string', description: 'Filter by project id' },
          query: { type: 'string', description: 'Optional title search' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_task',
      description: 'Update an existing task — change status, priority, deadline, assignee, or title. Resolve the taskId first via list_tasks.',
      parameters: {
        type: 'object',
        required: ['taskId'],
        properties: {
          taskId: { type: 'string' },
          title: { type: 'string' },
          status: { type: 'string', enum: ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE'] },
          priority: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] },
          deadline: { type: 'string', description: 'ISO date YYYY-MM-DD' },
          assignedToId: { type: 'string' },
          description: { type: 'string' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_content',
      description: 'List content items, optionally filtered by status, type, or project. Use to find a content id by title.',
      parameters: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['IDEA', 'SCRIPTING', 'SHOOTING', 'EDITING', 'REVIEW', 'POSTED'] },
          type: { type: 'string', enum: ['REEL', 'POSTER', 'STORY', 'VIDEO', 'GRAPHIC'] },
          projectId: { type: 'string' },
          assigneeId: { type: 'string' },
          query: { type: 'string', description: 'Optional title search' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_content',
      description: 'Update an existing content item — change status, post date, caption, assignee, drive link, etc. Resolve the contentId first via list_content.',
      parameters: {
        type: 'object',
        required: ['contentId'],
        properties: {
          contentId: { type: 'string' },
          title: { type: 'string' },
          status: { type: 'string', enum: ['IDEA', 'SCRIPTING', 'SHOOTING', 'EDITING', 'REVIEW', 'POSTED'] },
          postDate: { type: 'string', description: 'ISO date YYYY-MM-DD' },
          caption: { type: 'string' },
          driveLink: { type: 'string' },
          assigneeId: { type: 'string' },
          description: { type: 'string' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_events',
      description: 'List upcoming calendar events, optionally filtered by date range or type.',
      parameters: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ['MEETING', 'SHOOT', 'DEADLINE', 'REVIEW', 'CALL', 'OTHER'] },
          from: { type: 'string', description: 'ISO date YYYY-MM-DD — only events on or after this date' },
          to: { type: 'string', description: 'ISO date YYYY-MM-DD — only events on or before this date' },
          projectId: { type: 'string' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_transactions',
      description: 'List finance transactions (income & expenses), optionally filtered by type or category. Founder only.',
      parameters: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ['INCOME', 'EXPENSE'], description: 'Optional type filter' },
          category: { type: 'string', description: 'Optional category filter' },
          projectId: { type: 'string' },
          limit: { type: 'number', description: 'Max rows to return (default 20)' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'add_transaction',
      description: 'Log a new income or expense transaction. Founder only. category values: SALARY, FREELANCE, SOFTWARE, MARKETING, OFFICE, TRAVEL, UTILITIES, EQUIPMENT, OTHER.',
      parameters: {
        type: 'object',
        required: ['title', 'amount', 'type'],
        properties: {
          title: { type: 'string' },
          amount: { type: 'number', description: 'Positive number' },
          type: { type: 'string', enum: ['INCOME', 'EXPENSE'] },
          category: { type: 'string', enum: ['SALARY', 'FREELANCE', 'SOFTWARE', 'MARKETING', 'OFFICE', 'TRAVEL', 'UTILITIES', 'EQUIPMENT', 'OTHER'] },
          date: { type: 'string', description: 'ISO date YYYY-MM-DD (defaults to today)' },
          notes: { type: 'string' },
          projectId: { type: 'string' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_stats',
      description: 'Get a high-level dashboard snapshot: task counts by status, content counts by status, open leads, upcoming events today/this week, and (for founders) finance summary.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'log_metrics',
      description: 'Log engagement metrics for a posted content item (views, likes, comments, shares, reach). Use after the user mentions performance numbers for a reel, video, or post.',
      parameters: {
        type: 'object',
        properties: {
          contentId:  { type: 'string', description: 'ID of the content item' },
          platform:   { type: 'string', enum: ['INSTAGRAM','YOUTUBE','TIKTOK','FACEBOOK','OTHER'], description: 'Platform where it was posted' },
          postUrl:    { type: 'string', description: 'Direct URL to the post (optional)' },
          views:      { type: 'number' },
          likes:      { type: 'number' },
          comments:   { type: 'number' },
          shares:     { type: 'number' },
          reach:      { type: 'number' },
          saved:      { type: 'number' },
        },
        required: ['contentId', 'platform', 'views'],
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
        const filters: Record<string, string> = { isActive: 'eq.true' }
        if (args.role) filters.role = `eq.${args.role}`
        let users = await sbSelect('users', {
          select: 'id,username,name,role',
          filters,
          order: 'name.asc',
        })
        if (args.query) {
          const q = args.query.toLowerCase()
          users = users.filter((u: any) =>
            u.name?.toLowerCase().includes(q) || u.username?.toLowerCase().includes(q)
          )
        }
        return { ok: true, data: users.slice(0, 25) }
      }

      case 'list_projects': {
        const filters: Record<string, string> = {}
        if (user.role === 'CLIENT') filters.clientId = `eq.${user.id}`
        let projects = await sbSelect('projects', {
          select: '*,client:users!clientId(id,name)',
          filters,
          order: 'createdAt.desc',
        })
        if (args.query) {
          const q = args.query.toLowerCase()
          projects = projects.filter((p: any) => p.name?.toLowerCase().includes(q))
        }
        return { ok: true, data: projects.slice(0, 25) }
      }

      // ── Create event ────────────────────────────
      case 'create_event': {
        if (user.role === 'CLIENT')
          return { ok: false, error: 'Clients cannot create events' }
        const start = new Date(args.startTime)
        const end = new Date(args.endTime)
        if (isNaN(start.getTime()) || isNaN(end.getTime()))
          return { ok: false, error: 'Invalid startTime or endTime' }
        const now = nowTs()
        const event = await sbInsert('events', {
          title: args.title,
          description: args.description ?? null,
          type: args.type ?? 'MEETING',
          startTime: start.toISOString(),
          endTime: end.toISOString(),
          location: args.location ?? null,
          meetingLink: args.meetingLink ?? null,
          ownerId: args.ownerId || user.id,
          projectId: args.projectId || null,
          createdAt: now,
          updatedAt: now,
        })
        // Fire-and-forget gcal sync — doesn't block response
        syncOsEventToGcal(args.ownerId || user.id, {
          osEventId: event.id,
          title: event.title,
          description: args.description ?? null,
          startTime: start.toISOString(),
          endTime: end.toISOString(),
        }).catch(() => {})

        return { ok: true, data: { id: event.id, title: event.title, startTime: event.startTime, endTime: event.endTime } }
      }

      // ── Create task ─────────────────────────────
      case 'create_task': {
        if (!canCreateTasks(user.role))
          return { ok: false, error: 'You do not have permission to create tasks' }
        const now = nowTs()
        const task = await sbInsert('tasks', {
          title: args.title,
          description: args.description ?? null,
          status: args.status ?? 'TODO',
          priority: args.priority ?? 'MEDIUM',
          deadline: args.deadline ? new Date(args.deadline).toISOString() : null,
          assignedToId: args.assignedToId || null,
          createdById: user.id,
          projectId: args.projectId || null,
          createdAt: now,
          updatedAt: now,
        })
        const full = await sbFindOne('tasks', {
          select: '*,assignedTo:users!assignedToId(id,name),project:projects!projectId(id,name)',
          filters: { id: `eq.${task.id}` },
        }) ?? task
        if (full.assignedToId && full.assignedToId !== user.id) {
          const projectLabel = full.project ? ` · ${full.project.name}` : ''
          const dueLabel = full.deadline
            ? ` (due ${new Date(full.deadline).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })})`
            : ''
          await notify({
            userId: full.assignedToId,
            type: 'TASK_ASSIGNED',
            title: `New task: ${full.title}`,
            message: `${user.name} assigned you a ${full.priority.toLowerCase()} task${projectLabel}${dueLabel}.`,
            link: '/tasks',
            gcalEvent: {
              title: `📋 New task: ${full.title}`,
              description: `${user.name} assigned you this task${projectLabel}${dueLabel}.`,
              date: full.deadline ? new Date(full.deadline) : new Date(),
            },
          })
        }
        return { ok: true, data: { id: full.id, title: full.title, assignee: full.assignedTo?.name ?? null } }
      }

      // ── Create content ──────────────────────────
      case 'create_content': {
        if (!canCreateContent(user.role))
          return { ok: false, error: 'You do not have permission to create content' }
        const now = nowTs()
        const item = await sbInsert('content', {
          title: args.title,
          type: args.type,
          status: args.status ?? 'IDEA',
          description: args.description ?? null,
          driveLink: args.driveLink ?? null,
          caption: args.caption ?? null,
          postDate: args.postDate ? new Date(args.postDate).toISOString() : null,
          assigneeId: args.assigneeId || null,
          createdById: user.id,
          projectId: args.projectId || null,
          createdAt: now,
          updatedAt: now,
        })
        const full = await sbFindOne('content', {
          select: '*,assignee:users!assigneeId(id,name),project:projects!projectId(id,name,clientId)',
          filters: { id: `eq.${item.id}` },
        }) ?? item
        if (full.assigneeId && full.assigneeId !== user.id) {
          const projectLabel = full.project ? ` · ${full.project.name}` : ''
          await notify({
            userId: full.assigneeId,
            type: 'CONTENT_ASSIGNED',
            title: `New content assigned: ${full.title}`,
            message: `${user.name} assigned you a ${full.type.toLowerCase()}${projectLabel}.`,
            link: '/content',
          })
        }
        if (full.postDate && full.project?.clientId && full.project.clientId !== user.id) {
          await notify({
            userId: full.project.clientId,
            type: 'CONTENT_SCHEDULED',
            title: `New content scheduled: ${full.title}`,
            message: `Scheduled for ${new Date(full.postDate).toLocaleDateString('en-IN')} on ${full.project.name}.`,
            link: '/content',
          })
        }
        return { ok: true, data: { id: full.id, title: full.title } }
      }

      // ── Create project ──────────────────────────
      case 'create_project': {
        if (!canManageProjects(user.role))
          return { ok: false, error: 'You do not have permission to create projects' }
        const now = nowTs()
        const project = await sbInsert('projects', {
          name: args.name,
          description: args.description ?? null,
          status: args.status ?? 'ACTIVE',
          clientId: args.clientId || null,
          startDate: args.startDate ? new Date(args.startDate).toISOString() : null,
          dueDate: args.dueDate ? new Date(args.dueDate).toISOString() : null,
          driveFolder: args.driveFolder ?? null,
          createdAt: now,
          updatedAt: now,
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
        if (!canAssignRole(user.role, args.role))
          return { ok: false, error: `You cannot assign role ${args.role}` }
        if (!args.password || args.password.length < 6)
          return { ok: false, error: 'Password must be at least 6 characters' }
        const existing = await sbFindOne('users', {
          filters: { username: `eq.${args.username.toLowerCase()}` },
        })
        if (existing) return { ok: false, error: 'Username already exists' }
        const hashed = await bcrypt.hash(args.password, 10)
        const now = nowTs()
        const created = await sbInsert('users', {
          username: args.username.toLowerCase().trim(),
          name: args.name.trim(),
          phone: args.phone?.trim() || null,
          password: hashed,
          role: args.role,
          isActive: true,
          createdAt: now,
          updatedAt: now,
        })
        return { ok: true, data: { id: created.id, username: created.username, name: created.name, role: created.role } }
      }

      // ── CRM: list_leads ────────────────────────
      case 'list_leads': {
        const filters: Record<string, string> = {}
        if (args.stage) filters.stage = `eq.${args.stage}`
        let leads = await sbSelect('crm_leads', {
          select: 'id,title,stage,source,value,updated_at,contact:crm_contacts!contact_id(id,name),company:crm_companies!company_id(id,name),assignedTo:users!assigned_to_id(id,name)',
          filters,
          order: 'updated_at.desc',
          limit: 25,
        })
        if (args.query) {
          const q = args.query.toLowerCase()
          leads = leads.filter((l: any) => l.title?.toLowerCase().includes(q))
        }
        return { ok: true, data: leads }
      }

      // ── CRM: create_lead ───────────────────────
      case 'create_lead': {
        const now = nowTs()
        const lead = await sbInsert('crm_leads', {
          title: args.title,
          stage: args.stage ?? 'NEW',
          source: args.source ?? 'OTHER',
          value: args.value ? Number(args.value) : null,
          notes: args.notes || null,
          contact_id: args.contactId || null,
          company_id: args.companyId || null,
          assigned_to_id: args.assignedToId || null,
          project_id: args.projectId || null,
          expected_close_date: args.expectedCloseDate ? new Date(args.expectedCloseDate).toISOString() : null,
          created_by_id: user.id,
          created_at: now,
          updated_at: now,
        })
        return { ok: true, data: { id: lead.id, title: lead.title, stage: lead.stage } }
      }

      // ── CRM: update_lead_stage ─────────────────
      case 'update_lead_stage': {
        const patch: Record<string, any> = { stage: args.stage, updated_at: nowTs() }
        if (args.notes) patch.notes = args.notes
        const updated = await sbUpdate('crm_leads', { id: `eq.${args.leadId}` }, patch)
        return { ok: true, data: { id: args.leadId, stage: args.stage } }
      }

      // ── CRM: list_contacts ─────────────────────
      case 'list_contacts': {
        let contacts = await sbSelect('crm_contacts', {
          select: 'id,name,email,phone,position,company:crm_companies!company_id(id,name)',
          filters: {},
          order: 'name.asc',
          limit: 25,
        })
        if (args.query) {
          const q = args.query.toLowerCase()
          contacts = contacts.filter((c: any) =>
            c.name?.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q)
          )
        }
        return { ok: true, data: contacts }
      }

      // ── CRM: create_contact ────────────────────
      case 'create_contact': {
        const now = nowTs()
        const contact = await sbInsert('crm_contacts', {
          name: args.name,
          email: args.email || null,
          phone: args.phone || null,
          position: args.position || null,
          company_id: args.companyId || null,
          notes: args.notes || null,
          created_by_id: user.id,
          created_at: now,
          updated_at: now,
        })
        return { ok: true, data: { id: contact.id, name: contact.name } }
      }

      // ── CRM: list_companies ────────────────────
      case 'list_companies': {
        let companies = await sbSelect('crm_companies', {
          select: 'id,name,industry,website',
          filters: {},
          order: 'name.asc',
          limit: 25,
        })
        if (args.query) {
          const q = args.query.toLowerCase()
          companies = companies.filter((c: any) => c.name?.toLowerCase().includes(q))
        }
        return { ok: true, data: companies }
      }

      // ── CRM: create_company ────────────────────
      case 'create_company': {
        const now = nowTs()
        const company = await sbInsert('crm_companies', {
          name: args.name,
          industry: args.industry || null,
          website: args.website || null,
          address: args.address || null,
          notes: args.notes || null,
          created_by_id: user.id,
          created_at: now,
          updated_at: now,
        })
        return { ok: true, data: { id: company.id, name: company.name } }
      }

      // ── CRM: list_deals ────────────────────────
      case 'list_deals': {
        const filters: Record<string, string> = {}
        if (args.stage) filters.stage = `eq.${args.stage}`
        let deals = await sbSelect('crm_deals', {
          select: 'id,title,stage,value,probability,close_date,contact:crm_contacts!contact_id(id,name),company:crm_companies!company_id(id,name),assignedTo:users!assigned_to_id(id,name)',
          filters,
          order: 'updated_at.desc',
          limit: 25,
        })
        if (args.query) {
          const q = args.query.toLowerCase()
          deals = deals.filter((d: any) => d.title?.toLowerCase().includes(q))
        }
        return { ok: true, data: deals }
      }

      // ── CRM: create_deal ───────────────────────
      case 'create_deal': {
        const now = nowTs()
        const deal = await sbInsert('crm_deals', {
          title: args.title,
          value: args.value ? Number(args.value) : null,
          stage: args.stage ?? 'PROPOSAL',
          probability: args.probability ?? 50,
          close_date: args.closeDate ? new Date(args.closeDate).toISOString() : null,
          lead_id: args.leadId || null,
          contact_id: args.contactId || null,
          company_id: args.companyId || null,
          project_id: args.projectId || null,
          assigned_to_id: args.assignedToId || null,
          notes: args.notes || null,
          created_by_id: user.id,
          created_at: now,
          updated_at: now,
        })
        return { ok: true, data: { id: deal.id, title: deal.title, stage: deal.stage } }
      }

      // ── list_tasks ─────────────────────────────
      case 'list_tasks': {
        const filters: Record<string, string> = {}
        if (args.status) filters.status = `eq.${args.status}`
        if (args.priority) filters.priority = `eq.${args.priority}`
        if (args.assignedToId) filters.assignedToId = `eq.${args.assignedToId}`
        if (args.projectId) filters.projectId = `eq.${args.projectId}`
        // Employees can only see their own tasks
        if (user.role === 'EMPLOYEE') filters.assignedToId = `eq.${user.id}`
        if (user.role === 'CLIENT') return { ok: false, error: 'Clients cannot view tasks' }
        let tasks = await sbSelect('tasks', {
          select: '*,assignedTo:users!assignedToId(id,name),project:projects!projectId(id,name)',
          filters,
          order: 'createdAt.desc',
          limit: 25,
        })
        if (args.query) {
          const q = args.query.toLowerCase()
          tasks = tasks.filter((t: any) => t.title?.toLowerCase().includes(q))
        }
        return { ok: true, data: tasks }
      }

      // ── update_task ────────────────────────────
      case 'update_task': {
        if (!canCreateTasks(user.role))
          return { ok: false, error: 'You do not have permission to update tasks' }
        const patch: Record<string, any> = {}
        if (args.title) patch.title = args.title
        if (args.status) patch.status = args.status
        if (args.priority) patch.priority = args.priority
        if (args.deadline !== undefined) patch.deadline = args.deadline ? new Date(args.deadline).toISOString() : null
        if (args.assignedToId !== undefined) patch.assignedToId = args.assignedToId || null
        if (args.description !== undefined) patch.description = args.description || null
        if (Object.keys(patch).length === 0)
          return { ok: false, error: 'No fields to update were provided' }
        const updated = await sbUpdate('tasks', { id: `eq.${args.taskId}` }, patch)
        // Notify new assignee if changed
        if (args.assignedToId && args.assignedToId !== user.id) {
          const deadlineDate = patch.deadline ? new Date(patch.deadline) : null
          await notify({
            userId: args.assignedToId,
            type: 'TASK_ASSIGNED',
            title: `Task updated: ${updated?.title ?? args.taskId}`,
            message: `${user.name} assigned you a task.`,
            link: '/tasks',
            gcalEvent: {
              title: `📋 Task: ${updated?.title ?? args.taskId}`,
              description: `${user.name} assigned you this task.`,
              date: deadlineDate ?? new Date(),
            },
          }).catch(() => {})
        }
        return { ok: true, data: { id: args.taskId, ...patch } }
      }

      // ── list_content ───────────────────────────
      case 'list_content': {
        if (user.role === 'CLIENT') return { ok: false, error: 'Clients cannot view content list' }
        const filters: Record<string, string> = {}
        if (args.status) filters.status = `eq.${args.status}`
        if (args.type) filters.type = `eq.${args.type}`
        if (args.projectId) filters.projectId = `eq.${args.projectId}`
        if (args.assigneeId) filters.assigneeId = `eq.${args.assigneeId}`
        let items = await sbSelect('content', {
          select: '*,assignee:users!assigneeId(id,name),project:projects!projectId(id,name)',
          filters,
          order: 'createdAt.desc',
          limit: 25,
        })
        if (args.query) {
          const q = args.query.toLowerCase()
          items = items.filter((c: any) => c.title?.toLowerCase().includes(q))
        }
        return { ok: true, data: items }
      }

      // ── update_content ─────────────────────────
      case 'update_content': {
        if (!canCreateContent(user.role))
          return { ok: false, error: 'You do not have permission to update content' }
        const patch: Record<string, any> = {}
        if (args.title) patch.title = args.title
        if (args.status) patch.status = args.status
        if (args.postDate !== undefined) patch.postDate = args.postDate ? new Date(args.postDate).toISOString() : null
        if (args.caption !== undefined) patch.caption = args.caption || null
        if (args.driveLink !== undefined) patch.driveLink = args.driveLink || null
        if (args.assigneeId !== undefined) patch.assigneeId = args.assigneeId || null
        if (args.description !== undefined) patch.description = args.description || null
        if (Object.keys(patch).length === 0)
          return { ok: false, error: 'No fields to update were provided' }
        await sbUpdate('content', { id: `eq.${args.contentId}` }, patch)
        return { ok: true, data: { id: args.contentId, ...patch } }
      }

      // ── list_events ────────────────────────────
      case 'list_events': {
        if (user.role === 'CLIENT') return { ok: false, error: 'Clients cannot view events' }
        const filters: Record<string, string> = {}
        if (args.type) filters.type = `eq.${args.type}`
        if (args.projectId) filters.projectId = `eq.${args.projectId}`
        if (args.from) filters.startTime = `gte.${new Date(args.from).toISOString()}`
        if (args.to) filters.endTime = `lte.${new Date(args.to + 'T23:59:59').toISOString()}`
        const events = await sbSelect('events', {
          select: '*,owner:users!ownerId(id,name),project:projects!projectId(id,name)',
          filters,
          order: 'startTime.asc',
          limit: 25,
        })
        return { ok: true, data: events }
      }

      // ── list_transactions ──────────────────────
      case 'list_transactions': {
        if (user.role !== 'ADMIN')
          return { ok: false, error: 'Finance data is only accessible to the founder' }
        const filters: Record<string, string> = {}
        if (args.type) filters.type = `eq.${args.type}`
        if (args.category) filters.category = `eq.${args.category}`
        if (args.projectId) filters.projectId = `eq.${args.projectId}`
        const txns = await sbSelect('transactions', {
          select: '*,project:projects!projectId(id,name)',
          filters,
          order: 'date.desc',
          limit: args.limit ?? 20,
        })
        const income = txns.filter((t: any) => t.type === 'INCOME').reduce((s: number, t: any) => s + Number(t.amount), 0)
        const expense = txns.filter((t: any) => t.type === 'EXPENSE').reduce((s: number, t: any) => s + Number(t.amount), 0)
        return { ok: true, data: { transactions: txns, summary: { income, expense, net: income - expense } } }
      }

      // ── add_transaction ────────────────────────
      case 'add_transaction': {
        if (user.role !== 'ADMIN')
          return { ok: false, error: 'Only the founder can log transactions' }
        if (!args.amount || Number(args.amount) <= 0)
          return { ok: false, error: 'Amount must be a positive number' }
        const now = nowTs()
        const today = new Date().toISOString().split('T')[0]
        const txn = await sbInsert('transactions', {
          title: args.title,
          amount: Number(args.amount),
          type: args.type,
          category: args.category ?? 'OTHER',
          date: args.date ? new Date(args.date).toISOString() : new Date(today).toISOString(),
          notes: args.notes || null,
          projectId: args.projectId || null,
          ownerId: user.id,
          createdAt: now,
          updatedAt: now,
        })
        return { ok: true, data: { id: txn.id, title: txn.title, amount: txn.amount, type: txn.type } }
      }

      // ── get_stats ──────────────────────────────
      case 'get_stats': {
        const [taskRows, contentRows, leadRows, eventRows] = await Promise.all([
          sbSelect('tasks', { select: 'status', filters: {}, limit: 1000 }),
          sbSelect('content', { select: 'status', filters: {}, limit: 1000 }),
          sbSelect('crm_leads', { select: 'stage', filters: {}, limit: 1000 }),
          sbSelect('events', {
            select: 'id,title,startTime,type',
            filters: { startTime: `gte.${new Date().toISOString()}` },
            order: 'startTime.asc',
            limit: 5,
          }),
        ])

        const taskCounts = taskRows.reduce((acc: any, t: any) => {
          acc[t.status] = (acc[t.status] ?? 0) + 1; return acc
        }, {})
        const contentCounts = contentRows.reduce((acc: any, c: any) => {
          acc[c.status] = (acc[c.status] ?? 0) + 1; return acc
        }, {})
        const openLeads = leadRows.filter((l: any) => !['WON', 'LOST'].includes(l.stage)).length

        const stats: any = {
          tasks: { total: taskRows.length, byStatus: taskCounts },
          content: { total: contentRows.length, byStatus: contentCounts },
          crm: { openLeads },
          upcomingEvents: eventRows,
        }

        if (user.role === 'ADMIN') {
          const txns = await sbSelect('transactions', { select: 'type,amount', filters: {}, limit: 1000 })
          const income = txns.filter((t: any) => t.type === 'INCOME').reduce((s: number, t: any) => s + Number(t.amount), 0)
          const expense = txns.filter((t: any) => t.type === 'EXPENSE').reduce((s: number, t: any) => s + Number(t.amount), 0)
          stats.finance = { income, expense, net: income - expense }
        }

        return { ok: true, data: stats }
      }

      case 'log_metrics': {
        const { contentId, platform = 'INSTAGRAM', postUrl, views = 0, likes = 0, comments = 0, shares = 0, reach = 0, saved = 0 } = args
        if (!contentId) return { ok: false, error: 'contentId required' }
        const { sbInsert, nowTs } = await import('@/lib/supa')
        const row = await sbInsert('content_metrics', {
          content_id: contentId, platform,
          post_url: postUrl ?? null,
          views: Math.round(views), likes: Math.round(likes),
          comments: Math.round(comments), shares: Math.round(shares),
          reach: Math.round(reach), saved: Math.round(saved),
          recorded_at: nowTs(), created_at: nowTs(),
        })
        return { ok: true, data: { id: row.id, contentId, platform, views, likes, comments } }
      }

      default:
        return { ok: false, error: `Unknown tool: ${name}` }
    }
  } catch (err: any) {
    console.error(`[tool ${name}] failed:`, err)
    return { ok: false, error: err?.message ?? 'Tool execution failed' }
  }
}
