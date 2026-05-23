const { sbSelect, sbCount, TASK_SELECT, CONTENT_SELECT, EVENT_SELECT } = require('../src/lib/supa.ts');

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
    try { return await fn() } catch (e) { console.error('[overview] query failed:', e); return fallback }
  };

  const taskFilters = {};
  if (isEmployee) taskFilters.assignedToId = `eq.${userId}`;

  const contentFilters = {};
  if (isEmployee) contentFilters.assigneeId = `eq.${userId}`;

  const projectFilters = {};
  if (role === 'CLIENT') projectFilters.clientId = `eq.${userId}`;

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

  const urgentTasks = (recentTasks || []).filter(
    (t) => t.priority === 'URGENT' && t.status !== 'DONE'
  ).length;
  const overdueTasks = (recentTasks || []).filter(
    (t) => t.status !== 'DONE' && t.deadline && new Date(t.deadline) < now
  ).length;

  const editingContent = (recentContent || []).filter((c) => c.status === 'EDITING').length;

  const filteredEvents = (upcomingEvents || []).filter((e) => {
    const st = new Date(e.startTime);
    return st >= startOfDay && st <= endOfWeek;
  }).slice(0, 5);

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

  const pendingLoans = loans.reduce((acc, item) => acc + (parseFloat(item.amount) || 0), 0);

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

  return {
    totalTasks, todoTasks, urgentTasks, overdueTasks,
    totalContent, editingContent,
    totalProjects, activeProjects,
    totalUsers,
    recentTasks: (recentTasks || []).slice(0, 6),
    recentContent: filteredContent.slice(0, 5),
    upcomingEvents: filteredEvents,
    monthlyIncome,
    monthlyExpense,
    topClients,
    topMetrics: dedupedMetrics,
    clientOutstanding,
    clientPaid,
    clientTotalValue,
    pendingLoans,
    pendingScriptingAlerts,
  };
}

async function run() {
  const stats = await getStats('cmofwn3ov0000cv3oag2v1duo', 'ADMIN');
  console.log(JSON.stringify(stats, null, 2));
}

run();
