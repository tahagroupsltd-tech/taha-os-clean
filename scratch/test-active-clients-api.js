// scratch/test-active-clients-api.js
const { sbSelect } = require('../src/lib/supa.ts');

async function testApi() {
  console.log('--- Testing /api/clients/active logic ---');
  try {
    // 1. Fetch active or paused projects that have a client
    const projects = await sbSelect('projects', {
      select: 'id,name,status,sopLevel,value,clientId,client:users!clientId(id,name,username)',
      filters: { status: 'in.(ACTIVE,PAUSED)' },
      order: 'name.asc',
    });

    console.log(`Fetched ${projects.length} projects`);

    // Filter out projects that don't have a client
    const activeProjects = projects.filter((p) => p.clientId && p.client);
    console.log(`Active projects with clients: ${activeProjects.length}`);

    // 2. Fetch details for each active project
    const data = await Promise.all(
      activeProjects.map(async (p) => {
        const projectId = p.id;
        console.log(`Processing project: ${p.name} (${projectId})`);
        
        // Income transactions for this project
        const transactions = await sbSelect('transactions', {
          select: 'amount',
          filters: { projectId: `eq.${projectId}`, type: 'eq.INCOME' },
        }).catch(() => []);

        const totalPaid = transactions.reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
        const projectValue = p.value ? Number(p.value) : 0;
        const outstandingBalance = Math.max(0, projectValue - totalPaid);

        // Next upcoming shoot
        const shoots = await sbSelect('events', {
          select: 'title,startTime,location',
          filters: { projectId: `eq.${projectId}`, type: 'eq.SHOOT', startTime: `gte.${new Date().toISOString()}` },
          order: 'startTime.asc',
          limit: 1,
        }).catch(() => []);
        const nextShoot = shoots[0] || null;

        // Next scheduled video post
        const nextPosts = await sbSelect('content', {
          select: 'title,postDate,status,type',
          filters: { projectId: `eq.${projectId}`, postDate: `gte.${new Date().toISOString()}` },
          order: 'postDate.asc',
          limit: 1,
        }).catch(() => []);
        const nextPost = nextPosts[0] || null;

        // Last posted video
        const lastPosts = await sbSelect('content', {
          select: 'title,postDate,status,type',
          filters: { projectId: `eq.${projectId}`, status: 'eq.POSTED' },
          order: 'postDate.desc',
          limit: 1,
        }).catch(() => []);
        const lastPost = lastPosts[0] || null;

        // All content items for this project to find the last video of the current month
        const projectContent = await sbSelect('content', {
          select: 'title,postDate,status,type',
          filters: { projectId: `eq.${projectId}` },
          order: 'postDate.desc',
        }).catch(() => []);

        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth(); // 0-indexed

        const lastVideoCurrentMonth = projectContent.find((c) => {
          if (!c.postDate) return false;
          if (c.type !== 'REEL' && c.type !== 'VIDEO') return false;
          const pDate = new Date(c.postDate);
          return pDate.getFullYear() === currentYear && pDate.getMonth() === currentMonth;
        }) || null;

        // Compute current month's video progress
        const currentMonthContent = projectContent.filter((c) => {
          if (!c.postDate) return false;
          const pDate = new Date(c.postDate);
          return pDate.getFullYear() === currentYear && pDate.getMonth() === currentMonth;
        });
        const currentMonthVideos = currentMonthContent.filter((c) => c.type === 'REEL' || c.type === 'VIDEO');
        const targetList = currentMonthVideos.length > 0 ? currentMonthVideos : currentMonthContent;

        const currentMonthTotal = targetList.length;
        const currentMonthPosted = targetList.filter((c) => c.status === 'POSTED').length;
        const currentMonthProgress = currentMonthTotal > 0 ? Math.round((currentMonthPosted / currentMonthTotal) * 100) : 0;

        const SOP_LEVEL_LABELS = {
          1: 'Onboarding',
          2: 'PM Setup',
          3: 'Script Prep',
          4: 'Script Approval',
          5: 'Shoot Logistics',
          6: 'Shoot Day',
          7: 'Post-Prod',
        };

        const currentSop = p.sopLevel ?? 1;
        let nextMonthScriptsNeeded = false;
        let scriptStatusLabel = '';

        if (currentSop < 4) {
          nextMonthScriptsNeeded = true;
          scriptStatusLabel = `⚠️ Needed (In ${SOP_LEVEL_LABELS[currentSop] || 'Prep'})`;
        } else {
          if (currentMonthProgress >= 60) {
            nextMonthScriptsNeeded = true;
            scriptStatusLabel = `⚠️ Next Month Scripts (${currentMonthProgress}% posted)`;
          } else {
            nextMonthScriptsNeeded = false;
            scriptStatusLabel = `Not needed yet (${currentMonthProgress}%)`;
          }
        }

        return {
          projectId,
          projectName: p.name,
          projectStatus: p.status,
          clientId: p.clientId,
          clientName: p.client.name,
          clientUsername: p.client.username,
          sopLevel: p.sopLevel ?? 1,
          projectValue,
          outstandingBalance,
          nextShoot,
          nextPost,
          lastPost,
          lastVideoCurrentMonth,
          currentMonthProgress,
          currentMonthPosted,
          currentMonthTotal,
          nextMonthScriptsNeeded,
          scriptStatusLabel,
        };
      })
    );

    console.log(`API response calculation complete. Generated ${data.length} active client details.`);
    console.log(JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('API execution failed:', err);
  }
}

testApi();

