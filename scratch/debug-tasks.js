const { sbSelect } = require('../src/lib/supa.ts');

async function debug() {
  console.log('--- Fetching all tasks from database ---');
  try {
    const tasks = await sbSelect('tasks', {
      select: 'id,title,status,priority,deadline,assignedToId,projectId'
    });
    console.log(`Found ${tasks.length} tasks.`);
    for (const t of tasks) {
      console.log(`Task ID: ${t.id} | Title: "${t.title}" | Status: "${t.status}" | Priority: "${t.priority}" | Deadline: ${t.deadline}`);
    }
  } catch (err) {
    console.error('Error fetching tasks:', err);
  }
}

debug();
