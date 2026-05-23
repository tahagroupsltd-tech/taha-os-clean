const { sbSelect } = require('../src/lib/supa.ts');

async function debug() {
  console.log('--- Fetching all events from database ---');
  try {
    const events = await sbSelect('events', {
      select: 'id,title,type,startTime,endTime,projectId'
    });
    console.log(`Found ${events.length} events.`);
    for (const e of events) {
      console.log(`Event ID: ${e.id} | Title: "${e.title}" | Type: "${e.type}" | Start: ${e.startTime} | End: ${e.endTime}`);
    }
  } catch (err) {
    console.error('Error fetching events:', err);
  }
}

debug();
