// scratch/test-overview-queries.js
const { sbSelect, sbCount, TASK_SELECT, CONTENT_SELECT, EVENT_SELECT } = require('../src/lib/supa.ts');

const users = [
  { id: 'cmofwn3ov0000cv3oag2v1duo', name: 'Taha (Admin)', role: 'ADMIN' },
  { id: 'cmohlklls0002m9hho5v3uh5f', name: 'sarah jewellers', role: 'CLIENT' },
  { id: 'f6f3a661-e845-49d1-895d-08d7d1d7a552', name: 'scriptx head', role: 'SCRIPTWRITER' }
];

async function getStats(userId, role) {
  const isAdmin = role === 'ADMIN';
  const isManager = role === 'MANAGER';
  const isEmployee = role === 'EMPLOYEE' || ['EDITOR', 'SCRIPTWRITER', 'GRAPHIC_DESIGNER', 'WEB_DESIGNER'].includes(role);
  const canSeeFinance = isAdmin;
  const canSeeTeamCount = isAdmin || isManager;

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const endOfWeek = new Date();
  endOfWeek.setDate(endOfWeek.getDate() + 7);

  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const endOfMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0, 23, 59, 59);
  const now = new Date();

  const safe = async (fn, fallback) => {
    try {
      return await fn();
    } catch (e) {
      console.error(`[overview-test] Query failed for user ${userId} (${role}):`, e.message || e);
      throw e; // Throw so we see it!
    }
  };

  const taskFilters = {};
  if (isEmployee) taskFilters.assignedToId = `eq.${userId}`;

  const contentFilters = {};
  if (isEmployee) contentFilters.assigneeId = `eq.${userId}`;

  const projectFilters = {};
  if (role === 'CLIENT') projectFilters.clientId = `eq.${userId}`;

  console.log(`\n--- Running queries for ${userId} (${role}) ---`);

  const [
    totalTasks, todoTasks, recentTasks, recentContent, upcomingEvents,
    totalContent, totalProjects, activeProjects,
    loans,
  ] = await Promise.all([
    safe(() => sbCount('tasks', taskFilters), 0),
    safe(() => sbCount('tasks', { ...taskFilters, status: 'eq.TODO' }), 0),
    safe(() => sbSelect('tasks', {
      select: TASK_SELECT,
      filters: { ...taskFilters, status: 'neq.DONE' },
      order: 'priority.desc,deadline.asc',
    }), []),
    safe(() => sbSelect('content', {
      select: CONTENT_SELECT,
      filters: contentFilters,
      order: 'updatedAt.desc',
    }), []),
    safe(() => sbSelect('events', {
      select: EVENT_SELECT,
      filters: isEmployee ? { ownerId: `eq.${userId}` } : {},
      order: 'startTime.asc',
    }), []),
    safe(() => sbCount('content', contentFilters), 0),
    safe(() => sbCount('projects', projectFilters), 0),
    safe(() => sbCount('projects', { ...projectFilters, status: 'eq.ACTIVE' }), 0),
    canSeeFinance
      ? safe(() => sbSelect('loans', { select: 'amount,status', filters: { status: 'eq.PENDING' } }), [])
      : Promise.resolve([]),
  ]);

  console.log(`Success! totalTasks: ${totalTasks}, totalContent: ${totalContent}, totalProjects: ${totalProjects}`);
}

async function run() {
  for (const u of users) {
    try {
      await getStats(u.id, u.role);
    } catch (err) {
      console.error(`CRITICAL QUERY FAILED for ${u.name} (${u.role}):`, err);
    }
  }
}

run();
