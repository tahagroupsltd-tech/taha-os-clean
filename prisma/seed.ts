// prisma/seed.ts
import { PrismaClient, Role } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding database...')

  const hash = (pw: string) => bcrypt.hashSync(pw, 10)

  // Admin
  const admin = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      name: 'Taha (Admin)',
      phone: '9840000001',
      password: hash('admin123'),
      role: Role.ADMIN,
    },
  })

  // Manager (team lead — admin powers EXCEPT finance & promoting to founder)
  const manager = await prisma.user.upsert({
    where: { username: 'manager' },
    update: { role: Role.MANAGER },
    create: {
      username: 'manager',
      name: 'Team Manager',
      phone: '9840000099',
      password: hash('manager123'),
      role: Role.MANAGER,
    },
  })

  // Employees
  const editor = await prisma.user.upsert({
    where: { username: 'editor' },
    update: {},
    create: {
      username: 'editor',
      name: 'Video Editor',
      phone: '9840000002',
      password: hash('editor123'),
      role: Role.EMPLOYEE,
    },
  })

  const designer = await prisma.user.upsert({
    where: { username: 'designer' },
    update: {},
    create: {
      username: 'designer',
      name: 'Graphic Designer',
      phone: '9840000003',
      password: hash('designer123'),
      role: Role.EMPLOYEE,
    },
  })

  // Client
  const client = await prisma.user.upsert({
    where: { username: 'axsclient' },
    update: {},
    create: {
      username: 'axsclient',
      name: 'AXS Architects',
      phone: '9840000010',
      password: hash('client123'),
      role: Role.CLIENT,
    },
  })

  // Projects
  const project1 = await prisma.project.upsert({
    where: { id: 'proj_axs_001' },
    update: {},
    create: {
      id: 'proj_axs_001',
      name: 'AXS Architects — April Campaign',
      description: 'Monthly social media campaign for AXS Architects',
      status: 'ACTIVE',
      clientId: client.id,
      dueDate: new Date('2026-05-01'),
    },
  })

  const project2 = await prisma.project.upsert({
    where: { id: 'proj_aruvi_001' },
    update: {},
    create: {
      id: 'proj_aruvi_001',
      name: 'Aruvi Bakery — Eid Campaign',
      description: 'Eid special content and ads',
      status: 'ACTIVE',
      dueDate: new Date('2026-04-22'),
    },
  })

  // Tasks
  await prisma.task.createMany({
    skipDuplicates: true,
    data: [
      {
        id: 'task_001',
        title: 'Edit Renovation Reveal Reel — AXS',
        description: 'Before/after reel. 3 min. Add trending audio.',
        status: 'IN_PROGRESS',
        priority: 'URGENT',
        deadline: new Date('2026-04-21'),
        assignedToId: editor.id,
        createdById: admin.id,
        projectId: project1.id,
      },
      {
        id: 'task_002',
        title: 'Design May Static Posts — AXS',
        description: '12 posts. Brand colour overlay.',
        status: 'TODO',
        priority: 'MEDIUM',
        deadline: new Date('2026-04-28'),
        assignedToId: designer.id,
        createdById: admin.id,
        projectId: project1.id,
      },
      {
        id: 'task_003',
        title: 'Edit Eid Special Menu Reel',
        description: '30 sec reel. Food close-ups. URGENT.',
        status: 'TODO',
        priority: 'URGENT',
        deadline: new Date('2026-04-21'),
        assignedToId: editor.id,
        createdById: admin.id,
        projectId: project2.id,
      },
      {
        id: 'task_004',
        title: 'Write captions for Aruvi Eid posts',
        description: 'Festive tone. Include CTA.',
        status: 'DONE',
        priority: 'MEDIUM',
        deadline: new Date('2026-04-19'),
        assignedToId: editor.id,
        createdById: admin.id,
        projectId: project2.id,
      },
    ],
  })

  // Content
  await prisma.content.createMany({
    skipDuplicates: true,
    data: [
      {
        id: 'content_001',
        title: 'Office Renovation Reveal Reel',
        type: 'REEL',
        status: 'EDITING',
        description: 'Before/after format. 3 min.',
        assigneeId: editor.id,
        createdById: admin.id,
        projectId: project1.id,
        postDate: new Date('2026-04-22'),
      },
      {
        id: 'content_002',
        title: 'AXS May Portfolio Posts',
        type: 'POSTER',
        status: 'IDEA',
        description: '12 static posts for May',
        assigneeId: designer.id,
        createdById: admin.id,
        projectId: project1.id,
        postDate: new Date('2026-05-01'),
      },
      {
        id: 'content_003',
        title: 'Eid Special Menu Reel — Aruvi',
        type: 'REEL',
        status: 'SHOOTING',
        description: '30 sec. Food close-ups.',
        assigneeId: editor.id,
        createdById: admin.id,
        projectId: project2.id,
        postDate: new Date('2026-04-21'),
      },
    ],
  })

  // Events
  await prisma.event.createMany({
    skipDuplicates: true,
    data: [
      {
        id: 'event_001',
        title: 'AXS — April Review Call',
        description: 'Walk through approved reels and finalize May plan.',
        type: 'CALL',
        startTime: new Date('2026-04-26T10:00:00'),
        endTime: new Date('2026-04-26T11:00:00'),
        meetingLink: 'https://meet.google.com/axs-review-april',
        ownerId: admin.id,
        projectId: project1.id,
      },
      {
        id: 'event_002',
        title: 'Aruvi Eid Shoot',
        description: 'On-location food shoot. Bring tripod + ring light.',
        type: 'SHOOT',
        startTime: new Date('2026-04-27T07:30:00'),
        endTime: new Date('2026-04-27T12:00:00'),
        location: 'Aruvi Bakery, T. Nagar',
        ownerId: editor.id,
        projectId: project2.id,
      },
      {
        id: 'event_003',
        title: 'AXS Reel Final Submission',
        type: 'DEADLINE',
        startTime: new Date('2026-04-28T18:00:00'),
        endTime: new Date('2026-04-28T19:00:00'),
        ownerId: admin.id,
        projectId: project1.id,
      },
    ],
  })

  // Notes
  await prisma.note.createMany({
    skipDuplicates: true,
    data: [
      {
        id: 'note_001',
        title: 'Brand Voice — AXS Architects',
        content: 'Tone: confident, minimal, warm. Avoid jargon.\nColor palette: stone-900, sage, off-white.\nHashtags: #AXSArchitects #ChennaiArchitecture #SpaceDesign',
        icon: '🎯',
        pinned: true,
        tags: ['axs', 'brand'],
        ownerId: admin.id,
      },
      {
        id: 'note_002',
        title: 'Reel Hooks That Work',
        content: '1. "Wait until you see this..."\n2. "Three things nobody tells you about ___"\n3. Before/after with timer\n4. POV: opening day reveal',
        icon: '💡',
        pinned: true,
        tags: ['reels', 'hooks'],
        ownerId: editor.id,
      },
      {
        id: 'note_003',
        title: 'May Content Calendar — Draft',
        content: 'Week 1: Office tour series\nWeek 2: Material spotlight\nWeek 3: Client testimonial reel\nWeek 4: BTS shorts',
        icon: '📅',
        tags: ['may', 'planning'],
        ownerId: admin.id,
      },
    ],
  })

  // Transactions
  await prisma.transaction.createMany({
    skipDuplicates: true,
    data: [
      {
        id: 'tx_001',
        title: 'AXS Architects — April Retainer',
        amount: 45000,
        type: 'INCOME',
        category: 'CLIENT_PAYMENT',
        date: new Date('2026-04-05'),
        notes: 'Invoice #AXS-2026-04',
        ownerId: admin.id,
        projectId: project1.id,
      },
      {
        id: 'tx_002',
        title: 'Aruvi Bakery — Eid Campaign',
        amount: 28000,
        type: 'INCOME',
        category: 'CLIENT_PAYMENT',
        date: new Date('2026-04-10'),
        ownerId: admin.id,
        projectId: project2.id,
      },
      {
        id: 'tx_003',
        title: 'Adobe CC subscription',
        amount: 4200,
        type: 'EXPENSE',
        category: 'SOFTWARE',
        date: new Date('2026-04-01'),
        ownerId: admin.id,
      },
      {
        id: 'tx_004',
        title: 'Editor salary — April',
        amount: 25000,
        type: 'EXPENSE',
        category: 'SALARY',
        date: new Date('2026-04-30'),
        ownerId: admin.id,
      },
      {
        id: 'tx_005',
        title: 'Tripod + softbox kit',
        amount: 8500,
        type: 'EXPENSE',
        category: 'EQUIPMENT',
        date: new Date('2026-04-12'),
        ownerId: admin.id,
      },
    ],
  })

  console.log('Seed complete.')
  console.log('\nLogin credentials:')
  console.log('  Admin:    admin     / admin123')
  console.log('  Manager:  manager   / manager123')
  console.log('  Editor:   editor    / editor123')
  console.log('  Designer: designer / designer123')
  console.log('  Client:   axsclient / client123')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
