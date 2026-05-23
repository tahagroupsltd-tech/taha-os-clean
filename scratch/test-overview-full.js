// scratch/test-overview-full.js
const { sbSelect, sbCount, TASK_SELECT, CONTENT_SELECT, EVENT_SELECT } = require('../src/lib/supa.ts');

const users = [
  { id: 'cmofwn3ov0000cv3oag2v1duo', name: 'Taha (Admin)', role: 'ADMIN' },
  { id: 'cmohlklls0002m9hho5v3uh5f', name: 'sarah jewellers', role: 'CLIENT' },
  { id: 'f6f3a661-e845-49d1-895d-08d7d1d7a552', name: 'scriptx head', role: 'SCRIPTWRITER' },
  { id: 'cmofwn46e0002cv3otcoo5nu2', name: 'Team Manager', role: 'MANAGER' }
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
      throw e;
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

  // Filter urgent/overdue in-memory
  const urgentTasks = (recentTasks || []).filter(
    (t) => t.priority === 'URGENT' && t.status !== 'DONE'
  ).length;
  const overdueTasks = (recentTasks || []).filter(
    (t) => t.status !== 'DONE' && t.deadline && new Date(t.deadline) < now
  ).length;

  const editingContent = (recentContent || []).filter((c) => c.status === 'EDITING').length;

  // Filter upcoming events for this week
  const filteredEvents = (upcomingEvents || []).filter((e) => {
    const st = new Date(e.startTime);
    return st >= startOfDay && st <= endOfWeek;
  }).slice(0, 5);

  // Client filter for content
  const filteredContent = role === 'CLIENT'
    ? (recentContent || []).filter((c) => c.project?.clientId === userId)
    : (recentContent || []);

  const totalUsers = canSeeTeamCount
    ? await safe(() => sbCount('users', {}), 0)
    : null;

  let monthlyIncome = 0;
  let monthlyExpense = 0;
  let topClients = [];

  if (canSeeFinance) {
    const transactions = await safe(() => sbSelect('transactions', {
      select: '*,project:projects!projectId(id,name,client:users!clientId(name))',
      filters: {},
      order: 'date.desc',
    }), []);

    for (const t of transactions) {
      const tDate = new Date(t.date);
      if (tDate >= startOfMonth && tDate <= endOfMonth) {
        if (t.type === 'INCOME') monthlyIncome += parseFloat(t.amount);
        if (t.type === 'EXPENSE') monthlyExpense += parseFloat(t.amount);
      }
    }

    // Top projects by income
    const incomeByProject = new Map();
    for (const t of transactions) {
      if (t.type === 'INCOME' && t.projectId) {
        const existing = incomeByProject.get(t.projectId);
        if (existing) {
          existing.amount += parseFloat(t.amount);
        } else {
          incomeByProject.set(t.projectId, {
            project: t.project?.name ?? 'Unknown',
            client: t.project?.client?.name ?? null,
            amount: parseFloat(t.amount),
          });
        }
      }
    }
    topClients = Array.from(incomeByProject.values())
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5)
      .filter(c => c.amount > 0);
  }

  // Engagement metrics — top content by views
  const rawMetrics = await safe(
    () => sbSelect('content_metrics', {
      select: '*,content:content!content_id(id,title,type,project:projects!projectId(id,name))',
      filters: {},
      order: 'views.desc,recorded_at.desc',
      limit: 20,
    }),
    []
  );
  const seenMetrics = new Set();
  const dedupedMetrics = rawMetrics.filter((m) => {
    if (seenMetrics.has(m.content_id)) return false;
    seenMetrics.add(m.content_id); return true;
  }).slice(0, 5);

  let clientOutstanding = 0;
  let clientPaid = 0;
  let clientTotalValue = 0;

  if (role === 'CLIENT') {
    const clientProjects = await safe(() => sbSelect('projects', {
      select: 'id,value,status',
      filters: { clientId: `eq.${userId}` }
    }), []);

    const projectIds = clientProjects.map((p) => p.id);
    let clientTransactions = [];
    if (projectIds.length > 0) {
      clientTransactions = await safe(() => sbSelect('transactions', {
        select: 'id,amount,projectId,type',
        filters: {
          type: 'eq.INCOME',
          projectId: `in.(${projectIds.join(',')})`
        }
      }), []);
    }

    const txByProj = new Map();
    for (const t of clientTransactions) {
      if (!t.projectId) continue;
      txByProj.set(t.projectId, (txByProj.get(t.projectId) ?? 0) + Number(t.amount));
    }

    for (const p of clientProjects) {
      const pVal = p.value ? Number(p.value) : 0;
      const pPaid = txByProj.get(p.id) ?? 0;
      clientTotalValue += pVal;
      clientPaid += pPaid;
      if (p.status === 'ACTIVE' || p.status === 'PAUSED') {
        clientOutstanding += Math.max(0, pVal - pPaid);
      }
    }
  }

  const pendingLoans = loans.reduce((acc, item) => acc + (parseFloat(item.amount) || 0), 0);

  // --- 60% completion check for SOP Level 4 scripting follow-up ---
  const pendingScriptingAlerts = [];
  if (isAdmin || isManager) {
    const activeProjectsList = await safe(() => sbSelect('projects', {
      select: 'id,name,sopLevel',
      filters: { status: 'eq.ACTIVE' }
    }), []);

    const activeProjectIds = activeProjectsList.map((p) => p.id);
    if (activeProjectIds.length > 0) {
      const activeProjectContent = await safe(() => sbSelect('content', {
        select: 'id,projectId,status,type',
        filters: { projectId: `in.(${activeProjectIds.join(',')})` }
      }), []);

      const contentByProject = new Map();
      for (const c of activeProjectContent) {
        if (!c.projectId) continue;
        const arr = contentByProject.get(c.projectId) ?? [];
        arr.push(c);
        contentByProject.set(c.projectId, arr);
      }

      for (const p of activeProjectsList) {
        const items = contentByProject.get(p.id) ?? [];
        const videos = items.filter((c) => c.type === 'REEL' || c.type === 'VIDEO');
        const trackedItems = videos.length > 0 ? videos : items;
        const totalTracked = trackedItems.length;
        const postedTracked = trackedItems.filter((c) => c.status === 'POSTED').length;
        const pct = totalTracked > 0 ? Math.round((postedTracked / totalTracked) * 100) : 0;
        
        if (totalTracked > 0 && pct >= 60 && (!p.sopLevel || p.sopLevel < 4)) {
          pendingScriptingAlerts.push({
            id: p.id,
            name: p.name,
            posted: postedTracked,
            total: totalTracked,
            pct,
          });
        }
      }
    }
  }

  console.log(`Success! Completed stats for ${userId} (${role})`);
}

async function run() {
  for (const u of users) {
    try {
      await getStats(u.id, u.role);
    } catch (err) {
      console.error(`\nCRITICAL ERROR for ${u.name} (${u.role}):`, err);
    }
  }
}

run();
